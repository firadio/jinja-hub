# Go 版本

使用 Go 标准库 + pongo2 模板引擎实现的 Jinja Hub 平台。

## 特性

- ⚡ **高性能** - 每秒处理 ~35,000 请求
- 📦 **单文件部署** - 编译为单个二进制文件
- 💾 **低内存占用** - 运行时仅需 ~10MB
- 🔒 **沙盒模式** - pongo2 自动转义防止 XSS
- 🎛️ **灵活配置** - 支持自定义端口

## 运行

```bash
# 开发模式 (默认端口 8080)
go run .

# 自定义端口
go run . -addr :8081

# 查看帮助
go run . -h

# 编译
go build -o jinja-hub

# 运行二进制 (默认端口)
./jinja-hub

# 运行二进制 (自定义端口)
./jinja-hub -addr :9000

# 跨平台编译 (Windows)
GOOS=windows GOARCH=amd64 go build -o jinja-hub.exe

# 跨平台编译 (Linux)
GOOS=linux GOARCH=amd64 go build -o jinja-hub
```

默认访问: `http://localhost:8080`

## 依赖

- Go 1.21+
- pongo2/v6

## 命令行参数

```bash
-addr string
    服务器监听地址 (例如: :8080 或 :8081) (default ":8080")
```

示例:
```bash
go run . -addr :8081        # 监听 8081 端口
go run . -addr 0.0.0.0:8080 # 监听所有网卡的 8080 端口
go run . -addr :3000        # 监听 3000 端口
```

## 路由

- `/` → 平台首页（站点导航）
- `/{site}/` → 站点首页
- `/{site}/{page}.html` → 站点页面
- `/{site}/api/config` → 配置 API
- `/{site}/static/*` → 静态文件

示例:
- `http://localhost:8080/` - 平台首页
- `http://localhost:8080/aliyun/` - 阿里云站点首页
- `http://localhost:8080/aliyun/ecs_instances.html` - ECS 实例页面

## 项目结构

```
servers/go/
├── main.go       # 主程序
├── go.mod        # 依赖配置
└── README.md     # 本文件
```

## Docker 部署

```dockerfile
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY . .
RUN go build -o jinja-hub

FROM alpine:latest
COPY --from=builder /app/jinja-hub /app/
COPY ../../sites /app/sites
WORKDIR /app
EXPOSE 8080
CMD ["./jinja-hub"]
```

自定义端口:
```bash
docker run -p 8081:8081 jinja-hub ./jinja-hub -addr :8081
```

## 性能优化

- 模板缓存: pongo2 自动缓存已编译模板
- 静态文件: 使用 http.ServeFile 高效传输
- 无 GC 压力: 结构化数据最小化堆分配
