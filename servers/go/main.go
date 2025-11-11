package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

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

type Config struct {
	Site struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	} `json:"site"`
	API struct {
		ECS map[string]string `json:"ecs"`
		VPC map[string]string `json:"vpc"`
	} `json:"api"`
	Regions []struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"regions"`
	Pages map[string]map[string]interface{} `json:"pages"`
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

	// 列出所有启用的站点
	log.Println("\nEnabled sites:")
	for siteName, siteInfo := range sitesConfig.Sites {
		if siteInfo.Enabled {
			log.Printf("  - %s: http://localhost%s/%s/", siteInfo.Name, *addr, siteName)
		}
	}

	if err := http.ListenAndServe(*addr, mux); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}

// handleAllRoutes 处理所有路由
func handleAllRoutes(w http.ResponseWriter, r *http.Request) {
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
		http.ServeFile(w, r, staticPath)
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
		http.ServeFile(w, r, staticPath)
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

	// 返回 HTML
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(html))
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

	// 构建上下文
	ctx := pongo2.Context{
		"config":    configWithBasePath,
		"page":      pageConfig,
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

	// 返回 HTML
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(html))
}
