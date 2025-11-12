package main

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

// CDN 缓存目录
var cdnCacheDir = filepath.Join("..", "..", "sites", "_static", "cdn")

// 确保缓存目录存在
func ensureCacheDir() error {
	return os.MkdirAll(cdnCacheDir, 0755)
}

// 下载 CDN 文件到本地
func downloadCDNFile(url, localPath string) (string, error) {
	if err := ensureCacheDir(); err != nil {
		return "", err
	}

	fullLocalPath := filepath.Join(cdnCacheDir, localPath)
	localDir := filepath.Dir(fullLocalPath)

	// 确保目标目录存在
	if err := os.MkdirAll(localDir, 0755); err != nil {
		return "", err
	}

	// 如果文件已存在，直接返回
	if _, err := os.Stat(fullLocalPath); err == nil {
		log.Printf("CDN cache hit: %s", localPath)
		return fullLocalPath, nil
	}

	log.Printf("Downloading CDN file: %s", url)

	// 发起 HTTP 请求
	resp, err := http.Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	// 处理重定向
	if resp.StatusCode == http.StatusMovedPermanently || resp.StatusCode == http.StatusFound {
		location := resp.Header.Get("Location")
		if location != "" {
			return downloadCDNFile(location, localPath)
		}
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("failed to download: %d", resp.StatusCode)
	}

	// 创建本地文件
	file, err := os.Create(fullLocalPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	// 写入文件内容
	if _, err := io.Copy(file, resp.Body); err != nil {
		os.Remove(fullLocalPath)
		return "", err
	}

	log.Printf("Downloaded: %s", localPath)
	return fullLocalPath, nil
}

// 处理 CDN 代理请求
func handleCDNProxy(w http.ResponseWriter, r *http.Request) {
	// 解析 URL: /cdn/npm/daisyui@4.12.24/dist/full.min.css
	//         or: /cdn/tailwindcss/tailwind.js
	urlPath := strings.TrimPrefix(r.URL.Path, "/cdn/")

	if urlPath == "" {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}

	// 构建完整的 CDN URL
	var cdnURL string
	if strings.HasPrefix(urlPath, "tailwindcss/") {
		// Tailwind CSS 使用特殊的 CDN
		cdnURL = "https://cdn.tailwindcss.com"
	} else {
		// 其他使用 jsDelivr CDN
		cdnURL = "https://cdn.jsdelivr.net/" + urlPath
	}
	localPath := filepath.FromSlash(urlPath)

	// 确定 MIME 类型
	ext := filepath.Ext(urlPath)
	mimeTypes := map[string]string{
		".css":   "text/css",
		".js":    "application/javascript",
		".map":   "application/json",
		".woff":  "font/woff",
		".woff2": "font/woff2",
		".ttf":   "font/ttf",
		".eot":   "application/vnd.ms-fontobject",
		".svg":   "image/svg+xml",
	}
	contentType := mimeTypes[ext]
	if contentType == "" {
		contentType = "application/octet-stream"
	}

	// 尝试从缓存提供文件
	fullLocalPath := filepath.Join(cdnCacheDir, localPath)
	if _, err := os.Stat(fullLocalPath); err == nil {
		data, err := os.ReadFile(fullLocalPath)
		if err != nil {
			http.Error(w, "Failed to read cache file", http.StatusInternalServerError)
			return
		}
		sendCDNResponse(w, r, contentType, data)
		return
	}

	// 下载并提供文件
	localFile, err := downloadCDNFile(cdnURL, localPath)
	if err != nil {
		log.Printf("CDN proxy error: %v", err)
		http.Error(w, "Failed to fetch from CDN", http.StatusBadGateway)
		return
	}

	data, err := os.ReadFile(localFile)
	if err != nil {
		http.Error(w, "Failed to read downloaded file", http.StatusInternalServerError)
		return
	}
	sendCDNResponse(w, r, contentType, data)
}

// 预下载常用 CDN 文件
func prewarmCache() {
	commonFiles := []struct {
		url  string
		path string
	}{
		{
			url:  "https://cdn.jsdelivr.net/npm/daisyui@4.12.24/dist/full.min.css",
			path: filepath.FromSlash("npm/daisyui@4.12.24/dist/full.min.css"),
		},
		{
			url:  "https://cdn.jsdelivr.net/npm/alpinejs@3.13.3/dist/cdn.min.js",
			path: filepath.FromSlash("npm/alpinejs@3.13.3/dist/cdn.min.js"),
		},
		{
			url:  "https://cdn.jsdelivr.net/npm/crypto-js@4.2.0/crypto-js.min.js",
			path: filepath.FromSlash("npm/crypto-js@4.2.0/crypto-js.min.js"),
		},
	}

	log.Println("Prewarming CDN cache...")
	for _, file := range commonFiles {
		if _, err := downloadCDNFile(file.url, file.path); err != nil {
			log.Printf("Failed to prewarm %s: %v", file.path, err)
		}
	}
	log.Println("CDN cache prewarm complete")
}

// 发送 CDN 响应（带 gzip 压缩和缓存头）
func sendCDNResponse(w http.ResponseWriter, r *http.Request, contentType string, data []byte) {
	// 添加 charset
	fullContentType := addCharset(contentType)

	// 如果内容小于 1KB 或不可压缩，直接发送
	if len(data) < 1024 || !isCompressible(contentType) || !supportsGzip(r) {
		w.Header().Set("Content-Type", fullContentType)
		w.Header().Set("Cache-Control", "public, max-age=31536000")
		w.WriteHeader(http.StatusOK)
		w.Write(data)
		return
	}

	// 使用 gzip 压缩
	var buf bytes.Buffer
	gzipWriter := gzip.NewWriter(&buf)
	if _, err := gzipWriter.Write(data); err != nil {
		// 压缩失败，发送原始内容
		w.Header().Set("Content-Type", fullContentType)
		w.Header().Set("Cache-Control", "public, max-age=31536000")
		w.WriteHeader(http.StatusOK)
		w.Write(data)
		return
	}
	gzipWriter.Close()

	// 发送压缩后的内容
	w.Header().Set("Content-Type", fullContentType)
	w.Header().Set("Content-Encoding", "gzip")
	w.Header().Set("Cache-Control", "public, max-age=31536000")
	w.WriteHeader(http.StatusOK)
	w.Write(buf.Bytes())
}
