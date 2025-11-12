package main

import (
	"bytes"
	"compress/gzip"
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/flosch/pongo2/v6"
)

type SiteInfo struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Icon        string   `json:"icon"`
	Path        string   `json:"path"`
	Enabled     bool     `json:"enabled"`
	Category    string   `json:"category"`
	Domains     []string `json:"domains"`
	Order       int      `json:"order"`
}

type PlatformInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Version     string `json:"version"`
}

type SitesConfig struct {
	Platform      PlatformInfo        `json:"platform"`
	Sites         map[string]SiteInfo `json:"sites"`
	HomeSite      string              `json:"home_site"`
	DomainMapping map[string]string   `json:"domain_mapping"`
}

var domainToSite = make(map[string]string)

// 流量记录
type trafficRecord struct {
	timestamp time.Time
	bytes     int64
}

// 速率限制器
type rateLimiter struct {
	mu          sync.Mutex
	requests    map[string][]time.Time
	traffic     map[string][]trafficRecord
	windowMs    time.Duration
	maxRequests int
	maxBytes    int64 // 每分钟最大字节数
}

func newRateLimiter() *rateLimiter {
	return &rateLimiter{
		requests:    make(map[string][]time.Time),
		traffic:     make(map[string][]trafficRecord),
		windowMs:    time.Minute,
		maxRequests: 1000,               // 每分钟1000个请求（静态资源服务器）
		maxBytes:    100 * 1024 * 1024, // 每分钟100MB
	}
}

func (rl *rateLimiter) check(ip string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	// 清理旧的时间戳
	var validTimestamps []time.Time
	if timestamps, exists := rl.requests[ip]; exists {
		for _, t := range timestamps {
			if now.Sub(t) < rl.windowMs {
				validTimestamps = append(validTimestamps, t)
			}
		}
	}

	// 先检查是否超过请求数限制，再添加时间戳
	if len(validTimestamps) >= rl.maxRequests {
		return false
	}

	validTimestamps = append(validTimestamps, now)
	rl.requests[ip] = validTimestamps

	// 简单的内存管理
	if len(rl.requests) > 10000 {
		for k := range rl.requests {
			delete(rl.requests, k)
			break
		}
	}

	return true
}

func (rl *rateLimiter) checkTraffic(ip string, bytes int64) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()

	// 清理旧的流量记录
	var validRecords []trafficRecord
	var totalBytes int64
	if records, exists := rl.traffic[ip]; exists {
		for _, r := range records {
			if now.Sub(r.timestamp) < rl.windowMs {
				validRecords = append(validRecords, r)
				totalBytes += r.bytes
			}
		}
	}

	// 检查是否超过流量限制
	if totalBytes+bytes > rl.maxBytes {
		log.Printf("[Traffic] IP: %s, Current: %d bytes, Request: %d bytes, Limit: %d bytes - BLOCKED",
			ip, totalBytes, bytes, rl.maxBytes)
		return false
	}

	// 添加新的流量记录
	validRecords = append(validRecords, trafficRecord{
		timestamp: now,
		bytes:     bytes,
	})
	rl.traffic[ip] = validRecords

	log.Printf("[Traffic] IP: %s, Current: %d bytes, Request: %d bytes, Total: %d bytes, Limit: %d bytes",
		ip, totalBytes, bytes, totalBytes+bytes, rl.maxBytes)

	// 简单的内存管理
	if len(rl.traffic) > 10000 {
		for k := range rl.traffic {
			delete(rl.traffic, k)
			break
		}
	}

	return true
}

var limiter = newRateLimiter()

type Config struct {
	Site struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	} `json:"site"`
	API struct {
		ECS map[string]string `json:"ecs"`
		VPC map[string]string `json:"vpc"`
	} `json:"api"`
	Pages          map[string]map[string]interface{} `json:"pages"`
	Tables         map[string]map[string]interface{} `json:"tables"`
	ResourceManage map[string]map[string]interface{} `json:"resource_manage"`
}

var sitesConfig SitesConfig
var siteConfigs = make(map[string]Config)
var templateSets = make(map[string]*pongo2.TemplateSet)

func loadSitesConfig() error {
	file, err := os.ReadFile("../../sites/sites.json")
	if err != nil {
		return err
	}
	return json.Unmarshal(file, &sitesConfig)
}

func loadSiteConfig(siteName string) error {
	configPath := filepath.Join("../../sites", siteName, "config.json")
	file, err := os.ReadFile(configPath)
	if err != nil {
		return err
	}
	var config Config
	if err := json.Unmarshal(file, &config); err != nil {
		return err
	}
	siteConfigs[siteName] = config
	return nil
}

func getSitePath(siteName string) string {
	return filepath.Join("../../sites", siteName)
}

func init() {
	// 注册自定义 filter: json
	pongo2.RegisterFilter("json", func(in *pongo2.Value, param *pongo2.Value) (*pongo2.Value, *pongo2.Error) {
		jsonBytes, err := json.Marshal(in.Interface())
		if err != nil {
			return nil, &pongo2.Error{
				Sender:    "filter:json",
				OrigError: err,
			}
		}
		return pongo2.AsValue(string(jsonBytes)), nil
	})

	// 启用沙盒模式
	pongo2.SetAutoescape(true)
}

func main() {
	// 定义命令行参数
	addr := flag.String("addr", ":8080", "服务器监听地址 (例如: :8080 或 :8081)")
	flag.Parse()

	// 加载站点配置
	if err := loadSitesConfig(); err != nil {
		log.Fatal("Failed to load sites config:", err)
	}

	// 加载所有启用的站点配置和模板
	for siteName, siteInfo := range sitesConfig.Sites {
		if !siteInfo.Enabled {
			continue
		}

		// 加载站点配置
		if err := loadSiteConfig(siteName); err != nil {
			log.Printf("Warning: Failed to load %s config: %v", siteName, err)
			continue
		}

		// 初始化站点模板集
		templateDir := filepath.Join(getSitePath(siteName), "templates")
		templateSets[siteName] = pongo2.NewSet(siteName, pongo2.MustNewLocalFileSystemLoader(templateDir))

		// 构建域名映射
		for _, domain := range siteInfo.Domains {
			domainToSite[domain] = siteName
		}
	}

	// 加载自定义域名映射
	for domain, siteName := range sitesConfig.DomainMapping {
		domainToSite[domain] = siteName
	}

	// 设置路由
	mux := http.NewServeMux()

	// 所有路由统一处理
	mux.HandleFunc("/", handleAllRoutes)

	// 启动服务器
	platformName := sitesConfig.Platform.Name
	if platformName == "" {
		platformName = "Jinja Hub"
	}

	log.Printf("%s starting on %s", platformName, *addr)
	log.Printf("Platform home: http://localhost%s/", *addr)
	log.Printf("CDN proxy: http://localhost%s/cdn/", *addr)

	// 列出所有启用的站点
	log.Println("\nEnabled sites:")
	for siteName, siteInfo := range sitesConfig.Sites {
		if siteInfo.Enabled {
			log.Printf("  - %s: http://localhost%s/%s/", siteInfo.Name, *addr, siteName)
		}
	}

	// 预加载常用 CDN 文件
	go prewarmCache()

	// 创建带超时和限制的服务器
	srv := &http.Server{
		Addr:              *addr,
		Handler:           mux,
		ReadTimeout:       60 * time.Second,
		ReadHeaderTimeout: 60 * time.Second,
		WriteTimeout:      120 * time.Second,
		IdleTimeout:       120 * time.Second,
		MaxHeaderBytes:    1 << 20, // 1 MB
	}

	if err := srv.ListenAndServe(); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

// handleAllRoutes 处理所有路由
func handleAllRoutes(w http.ResponseWriter, r *http.Request) {
	// 限制请求体大小（10MB）
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)

	// 速率限制检查
	clientIP := r.RemoteAddr
	if colonIndex := strings.LastIndex(clientIP, ":"); colonIndex != -1 {
		clientIP = clientIP[:colonIndex]
	}
	if !limiter.check(clientIP) {
		http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
		return
	}

	// CDN 代理路由
	if strings.HasPrefix(r.URL.Path, "/cdn/") {
		handleCDNProxy(w, r)
		return
	}

	// 检查是否通过域名访问
	host := r.Host
	// 移除端口号
	if colonIndex := strings.Index(host, ":"); colonIndex != -1 {
		host = host[:colonIndex]
	}

	// 检查域名映射
	if siteName, exists := domainToSite[host]; exists {
		// 域名直接映射到站点，处理站点路由
		handleDomainSiteRoute(w, r, siteName)
		return
	}

	// 根路径: 显示首页（所有站点列表）
	if r.URL.Path == "/" {
		renderHomePage(w, r)
		return
	}

	// 站点路由处理
	path := strings.TrimPrefix(r.URL.Path, "/")
	parts := strings.Split(path, "/")

	if len(parts) == 0 {
		http.NotFound(w, r)
		return
	}

	siteName := parts[0]

	// 检查站点是否存在
	siteInfo, exists := sitesConfig.Sites[siteName]
	if !exists {
		http.NotFound(w, r)
		return
	}

	// 检查站点是否启用
	if !siteInfo.Enabled {
		http.Error(w, "Site not enabled", http.StatusNotFound)
		return
	}

	// 静态文件路由
	if len(parts) >= 2 && parts[1] == "static" {
		staticPath := filepath.Join(getSitePath(siteName), strings.Join(parts[1:], "/"))
		serveStaticFile(w, r, staticPath)
		return
	}

	// API 路由
	if len(parts) >= 3 && parts[1] == "api" && parts[2] == "config" {
		handleSiteAPIConfig(w, r, siteName)
		return
	}

	// 页面路由
	if len(parts) == 1 || (len(parts) == 2 && (parts[1] == "" || parts[1] == "index.html")) {
		// 站点首页 - 路径模式，base_path 为 /siteName
		renderSitePageWithBasePath(w, r, siteName, "login", "/"+siteName)
		return
	}

	if len(parts) == 2 && strings.HasSuffix(parts[1], ".html") {
		// 站点页面 - 路径模式，base_path 为 /siteName
		pageName := strings.TrimSuffix(parts[1], ".html")
		renderSitePageWithBasePath(w, r, siteName, pageName, "/"+siteName)
		return
	}

	http.NotFound(w, r)
}

// handleDomainSiteRoute 处理域名直接访问站点的路由
func handleDomainSiteRoute(w http.ResponseWriter, r *http.Request, siteName string) {
	// 检查站点是否存在和启用
	siteInfo, exists := sitesConfig.Sites[siteName]
	if !exists || !siteInfo.Enabled {
		http.Error(w, "Site not found", http.StatusNotFound)
		return
	}

	path := r.URL.Path

	// 静态文件路由
	if strings.HasPrefix(path, "/static/") {
		staticPath := filepath.Join(getSitePath(siteName), strings.TrimPrefix(path, "/"))
		serveStaticFile(w, r, staticPath)
		return
	}

	// API 路由
	if strings.HasPrefix(path, "/api/config") {
		handleSiteAPIConfig(w, r, siteName)
		return
	}

	// 页面路由
	if path == "/" || path == "" || path == "/index.html" {
		// 站点首页 - 域名模式，base_path 为 /
		renderSitePageWithBasePath(w, r, siteName, "login", "/")
		return
	}

	// 匹配 *.html 页面
	if strings.HasSuffix(path, ".html") {
		pageName := strings.TrimSuffix(strings.TrimPrefix(path, "/"), ".html")
		renderSitePageWithBasePath(w, r, siteName, pageName, "/")
		return
	}

	http.NotFound(w, r)
}

// handleSiteAPIConfig 处理站点配置 API 请求
func handleSiteAPIConfig(w http.ResponseWriter, r *http.Request, siteName string) {
	config, exists := siteConfigs[siteName]
	if !exists {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(config)
}

// renderHomePage 渲染首页（所有站点列表）
func renderHomePage(w http.ResponseWriter, r *http.Request) {
	// 初始化首页模板集
	homeTemplateDir := filepath.Join("../../sites/_home/templates")
	homeTemplateSet := pongo2.NewSet("_home", pongo2.MustNewLocalFileSystemLoader(homeTemplateDir))

	// 加载首页模板
	tmpl, err := homeTemplateSet.FromFile("index.html")
	if err != nil {
		log.Printf("Home template error: %v", err)
		http.Error(w, "Home template error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 构建默认平台信息
	platform := sitesConfig.Platform
	if platform.Name == "" {
		platform.Name = "Jinja Hub"
		platform.Description = "开放式前端开发平台"
	}

	// 将 sites 转换为排序后的数组
	type siteEntry struct {
		name string
		info SiteInfo
	}
	var entries []siteEntry
	for name, info := range sitesConfig.Sites {
		entries = append(entries, siteEntry{name: name, info: info})
	}

	sort.Slice(entries, func(i, j int) bool {
		if entries[i].info.Order != entries[j].info.Order {
			return entries[i].info.Order < entries[j].info.Order
		}
		return entries[i].name < entries[j].name
	})

	sitesArray := []map[string]interface{}{}
	for _, entry := range entries {
		sitesArray = append(sitesArray, map[string]interface{}{
			"name": entry.name,
			"info": map[string]interface{}{
				"name":        entry.info.Name,
				"description": entry.info.Description,
				"icon":        entry.info.Icon,
				"enabled":     entry.info.Enabled,
				"category":    entry.info.Category,
				"path":        entry.info.Path,
				"domains":     entry.info.Domains,
				"order":       entry.info.Order,
			},
		})
	}

	// 构建上下文
	ctx := pongo2.Context{
		"platform": platform,
		"sites":    sitesArray,
	}

	// 执行模板
	html, err := tmpl.Execute(ctx)
	if err != nil {
		log.Printf("Home render error: %v", err)
		http.Error(w, "Home render error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 返回 HTML (带 gzip 压缩)
	sendResponse(w, r, "text/html; charset=utf-8", []byte(html))
}

// renderSitePage 渲染站点页面 (使用路径模式)
func renderSitePage(w http.ResponseWriter, r *http.Request, siteName, pageName string) {
	renderSitePageWithBasePath(w, r, siteName, pageName, "/"+siteName)
}

// renderSitePageWithBasePath 渲染站点页面，指定 base_path
func renderSitePageWithBasePath(w http.ResponseWriter, r *http.Request, siteName, pageName, basePath string) {
	// 获取站点配置
	config, exists := siteConfigs[siteName]
	if !exists {
		http.NotFound(w, r)
		return
	}

	// 获取模板集
	templateSet, exists := templateSets[siteName]
	if !exists {
		http.NotFound(w, r)
		return
	}

	// 查找页面配置
	var pageConfig map[string]interface{}
	var templatePath string

	for key, val := range config.Pages {
		if key == pageName {
			pageConfig = val
			templatePath = "pages/" + key + ".html"
			break
		}
	}

	// 如果找不到配置,使用默认路径
	if templatePath == "" {
		templatePath = "pages/" + pageName + ".html"
	}

	// 检查模板文件是否存在
	fullPath := filepath.Join(getSitePath(siteName), "templates", templatePath)
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		http.NotFound(w, r)
		return
	}

	// 加载并执行模板
	tmpl, err := templateSet.FromFile(templatePath)
	if err != nil {
		log.Printf("Template error: %v", err)
		http.Error(w, "Template error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 将 config 序列化为 map 并添加 base_path
	configWithBasePath := make(map[string]interface{})
	configBytes, _ := json.Marshal(config)
	json.Unmarshal(configBytes, &configWithBasePath)
	configWithBasePath["base_path"] = basePath

	// 将 pages 转换为排序后的数组
	if pagesMap, ok := configWithBasePath["pages"].(map[string]interface{}); ok {
		type pageEntry struct {
			key   string
			value map[string]interface{}
		}
		var pageEntries []pageEntry
		for key, val := range pagesMap {
			if pageMap, ok := val.(map[string]interface{}); ok {
				pageEntries = append(pageEntries, pageEntry{key: key, value: pageMap})
			}
		}

		sort.Slice(pageEntries, func(i, j int) bool {
			orderI, okI := pageEntries[i].value["order"].(float64)
			orderJ, okJ := pageEntries[j].value["order"].(float64)
			if !okI {
				orderI = 0
			}
			if !okJ {
				orderJ = 0
			}
			if orderI != orderJ {
				return orderI < orderJ
			}
			return pageEntries[i].key < pageEntries[j].key
		})

		sortedPages := make([]map[string]interface{}, 0)
		for _, entry := range pageEntries {
			sortedPages = append(sortedPages, map[string]interface{}{
				"key":   entry.key,
				"value": entry.value,
			})
		}
		configWithBasePath["pages_array"] = sortedPages
	}

	// 将 sites 转换为排序后的数组
	type siteEntry struct {
		id   string
		info SiteInfo
	}
	var allSitesEntries []siteEntry
	for siteID, siteInfo := range sitesConfig.Sites {
		allSitesEntries = append(allSitesEntries, siteEntry{id: siteID, info: siteInfo})
	}

	sort.Slice(allSitesEntries, func(i, j int) bool {
		if allSitesEntries[i].info.Order != allSitesEntries[j].info.Order {
			return allSitesEntries[i].info.Order < allSitesEntries[j].info.Order
		}
		return allSitesEntries[i].id < allSitesEntries[j].id
	})

	var allSitesArray []map[string]interface{}
	for _, entry := range allSitesEntries {
		allSitesArray = append(allSitesArray, map[string]interface{}{
			"id": entry.id,
			"info": map[string]interface{}{
				"name":        entry.info.Name,
				"description": entry.info.Description,
				"icon":        entry.info.Icon,
				"enabled":     entry.info.Enabled,
				"category":    entry.info.Category,
				"path":        entry.info.Path,
				"domains":     entry.info.Domains,
				"order":       entry.info.Order,
			},
		})
	}

	// 构建 page 对象,确保包含 name 字段
	pageObject := make(map[string]interface{})
	if pageConfig != nil {
		for k, v := range pageConfig {
			pageObject[k] = v
		}
	}
	pageObject["name"] = pageName

	// 构建上下文
	ctx := pongo2.Context{
		"config":    configWithBasePath,
		"page":      pageObject,
		"site":      sitesConfig.Sites[siteName],
		"site_name": siteName,
		"platform":  sitesConfig.Platform,
		"all_sites": allSitesArray,
		"base_path": basePath,
	}

	// 执行模板
	html, err := tmpl.Execute(ctx)
	if err != nil {
		log.Printf("Render error: %v", err)
		http.Error(w, "Render error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// 返回 HTML (带 gzip 压缩)
	sendResponse(w, r, "text/html; charset=utf-8", []byte(html))
}

// 可压缩的 MIME 类型
var compressibleTypes = map[string]bool{
	"text/html":              true,
	"text/css":               true,
	"application/javascript": true,
	"application/json":       true,
	"image/svg+xml":          true,
	"text/plain":             true,
	"application/xml":        true,
	"text/xml":               true,
}

// 检查客户端是否支持 gzip
func supportsGzip(r *http.Request) bool {
	acceptEncoding := r.Header.Get("Accept-Encoding")
	return strings.Contains(acceptEncoding, "gzip")
}

// 检查内容类型是否可压缩
func isCompressible(contentType string) bool {
	// 移除参数部分 (如 charset)
	parts := strings.Split(contentType, ";")
	return compressibleTypes[strings.TrimSpace(parts[0])]
}

// 添加 charset 到 Content-Type
func addCharset(contentType string) string {
	// 如果已经包含 charset，不重复添加
	if strings.Contains(contentType, "charset") {
		return contentType
	}

	// 对文本类型添加 charset=UTF-8
	textTypes := []string{"text/", "application/json", "application/javascript", "application/xml"}
	for _, prefix := range textTypes {
		if strings.HasPrefix(contentType, prefix) {
			return contentType + "; charset=UTF-8"
		}
	}

	return contentType
}

// 发送响应（带 gzip 压缩支持）
func sendResponse(w http.ResponseWriter, r *http.Request, contentType string, data []byte) {
	// 获取客户端IP进行流量检查
	clientIP := r.RemoteAddr
	if colonIndex := strings.LastIndex(clientIP, ":"); colonIndex != -1 {
		clientIP = clientIP[:colonIndex]
	}

	// 添加 charset
	fullContentType := addCharset(contentType)

	// 限制压缩内容大小（5MB），防止压缩炸弹攻击
	maxCompressSize := 5 * 1024 * 1024
	if len(data) > maxCompressSize {
		// 检查流量限制
		if !limiter.checkTraffic(clientIP, int64(len(data))) {
			http.Error(w, "Bandwidth Limit Exceeded", http.StatusTooManyRequests)
			return
		}
		w.Header().Set("Content-Type", fullContentType)
		w.WriteHeader(http.StatusOK)
		w.Write(data)
		return
	}

	// 如果内容小于 1KB 或不可压缩，直接发送
	if len(data) < 1024 || !isCompressible(contentType) || !supportsGzip(r) {
		// 检查流量限制
		if !limiter.checkTraffic(clientIP, int64(len(data))) {
			http.Error(w, "Bandwidth Limit Exceeded", http.StatusTooManyRequests)
			return
		}
		w.Header().Set("Content-Type", fullContentType)
		w.WriteHeader(http.StatusOK)
		w.Write(data)
		return
	}

	// 使用 gzip 压缩
	var buf bytes.Buffer
	gzipWriter := gzip.NewWriter(&buf)
	if _, err := gzipWriter.Write(data); err != nil {
		// 压缩失败，发送原始内容
		if !limiter.checkTraffic(clientIP, int64(len(data))) {
			http.Error(w, "Bandwidth Limit Exceeded", http.StatusTooManyRequests)
			return
		}
		w.Header().Set("Content-Type", fullContentType)
		w.WriteHeader(http.StatusOK)
		w.Write(data)
		return
	}
	gzipWriter.Close()

	// 检查流量限制（使用压缩后的大小）
	if !limiter.checkTraffic(clientIP, int64(buf.Len())) {
		http.Error(w, "Bandwidth Limit Exceeded", http.StatusTooManyRequests)
		return
	}

	// 发送压缩后的内容
	w.Header().Set("Content-Type", fullContentType)
	w.Header().Set("Content-Encoding", "gzip")
	w.WriteHeader(http.StatusOK)
	w.Write(buf.Bytes())
}

// 发送静态文件（带 gzip 压缩支持）
func serveStaticFile(w http.ResponseWriter, r *http.Request, filePath string) {
	// 规范化路径并检查是否在允许的目录内（防止路径遍历攻击）
	normalizedPath, err := filepath.Abs(filePath)
	if err != nil {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}

	// 获取基础路径
	basePath, err := filepath.Abs("../../sites")
	if err != nil {
		http.Error(w, "Server error", http.StatusInternalServerError)
		return
	}

	// 检查路径是否在允许的目录内
	if !strings.HasPrefix(normalizedPath, basePath) {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// 读取文件内容
	data, err := os.ReadFile(filePath)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// 确定 MIME 类型
	ext := filepath.Ext(filePath)
	mimeTypes := map[string]string{
		".html": "text/html",
		".css":  "text/css",
		".js":   "application/javascript",
		".json": "application/json",
		".png":  "image/png",
		".jpg":  "image/jpeg",
		".jpeg": "image/jpeg",
		".gif":  "image/gif",
		".svg":  "image/svg+xml",
	}
	contentType := mimeTypes[ext]
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// 发送响应（自动处理压缩）
	sendResponse(w, r, contentType, data)
}
