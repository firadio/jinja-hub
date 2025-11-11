# Node.js 版本

使用 Node.js 标准库 + Nunjucks 模板引擎实现的多云平台管理系统。

## 特性

- 🚀 **零框架依赖** - 使用原生 http 模块
- 🎨 **Nunjucks 模板** - 完全兼容 Jinja2 语法
- 📦 **轻量级** - 依赖极少，启动快速
- 🔒 **沙盒模式** - Nunjucks 自动转义防止 XSS

## 运行

```bash
# 安装依赖
npm install

# 开发模式
node server.js

# 生产环境 (使用 PM2)
npm install -g pm2
pm2 start server.js --name cloud-manager
```

服务器启动在 `http://localhost:8080`

## 依赖

- Node.js 14+
- nunjucks 3.2+

## 路由

- `/` → 默认站点（aliyun）
- `/aliyun/` → 阿里云首页
- `/aliyun/ecs_instances.html` → ECS 实例页
- `/aliyun/api/config` → 配置 API
- `/aliyun/static/*` → 静态文件

## 项目结构

```
servers/nodejs/
├── server.js         # 主程序
├── package.json      # 依赖配置
└── README.md         # 本文件
```

## PM2 进程管理

```bash
# 启动服务
pm2 start server.js --name cloud-manager

# 查看状态
pm2 status

# 查看日志
pm2 logs cloud-manager

# 重启服务
pm2 restart cloud-manager

# 停止服务
pm2 stop cloud-manager

# 开机自启
pm2 startup
pm2 save
```

## Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY server.js .
COPY ../../sites /app/sites
EXPOSE 8080
CMD ["node", "server.js"]
```

## 性能优化

- 模板缓存: 生产环境启用 noCache: false
- 静态文件: 使用 nginx 反向代理处理静态文件
- 进程管理: 使用 PM2 多进程集群模式

```bash
# PM2 集群模式 (4 个进程)
pm2 start server.js -i 4 --name cloud-manager
```
