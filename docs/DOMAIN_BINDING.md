# 域名绑定指南

Jinja Hub 支持为每个站点绑定独立域名，用户可以直接通过域名访问站点，无需通过路径方式。

## 配置方式

### 方式一：在站点配置中添加域名

编辑 `sites/sites.json`，在对应站点的配置中添加 `domains` 字段:

```json
{
  "platform": {
    "name": "Jinja Hub",
    "description": "开放式前端开发平台",
    "version": "1.0.0"
  },
  "sites": {
    "aliyun": {
      "name": "阿里云管理平台",
      "description": "多云平台管理系统示例",
      "icon": "🇨🇳",
      "path": "/aliyun",
      "enabled": true,
      "category": "示例项目",
      "domains": ["aliyun.example.com", "cloud.example.com"]
    },
    "demo": {
      "name": "演示站点",
      "description": "站点切换功能演示",
      "icon": "🎨",
      "path": "/demo",
      "enabled": true,
      "category": "示例项目",
      "domains": ["demo.example.com"]
    }
  },
  "home_site": "_home"
}
```

### 方式二：使用全局域名映射

如果需要更灵活的域名管理，可以使用 `domain_mapping` 字段:

```json
{
  "platform": {
    "name": "Jinja Hub",
    "description": "开放式前端开发平台",
    "version": "1.0.0"
  },
  "sites": {
    "aliyun": {
      "name": "阿里云管理平台",
      "path": "/aliyun",
      "enabled": true
    }
  },
  "home_site": "_home",
  "domain_mapping": {
    "aliyun.example.com": "aliyun",
    "cloud.example.com": "aliyun",
    "demo.example.com": "demo"
  }
}
```

## DNS 配置

配置好 `sites.json` 后，需要在 DNS 服务商添加域名解析:

### A 记录方式

```
类型    主机记录              记录值
A       aliyun               服务器IP地址
A       demo                 服务器IP地址
```

### CNAME 方式

```
类型    主机记录              记录值
CNAME   aliyun               主域名 (example.com)
CNAME   demo                 主域名 (example.com)
```

## 访问方式对比

### 路径方式（默认）

```
http://example.com/aliyun/              -> 阿里云站点首页
http://example.com/aliyun/ecs_instances.html  -> ECS 实例页面
http://example.com/demo/                -> 演示站点首页
```

### 域名方式（绑定后）

```
http://aliyun.example.com/              -> 阿里云站点首页
http://aliyun.example.com/ecs_instances.html  -> ECS 实例页面
http://demo.example.com/                -> 演示站点首页
```

注意：使用域名方式时，路径中不再包含站点名称。

## 静态文件路径自动适配

服务器会自动传递 `base_path` 变量，根据访问方式自动调整:

- **路径访问** (`/aliyun/`): `base_path` = `/aliyun`
- **域名访问** (`aliyun.example.com`): `base_path` = `/`

### 推荐写法（自动适配）

在模板中使用 `base_path` 变量:

```html
<!-- 静态文件 -->
<link rel="stylesheet" href="{{ base_path }}/static/css/style.css">
<script src="{{ base_path }}/static/js/main.js"></script>
<img src="{{ base_path }}/static/images/logo.png">

<!-- 页面链接 -->
<a href="{{ base_path }}/">首页</a>
<a href="{{ base_path }}/ecs_instances.html">ECS 实例</a>

<!-- API 调用 -->
<script>
    fetch('{{ base_path }}/api/config')
        .then(res => res.json())
        .then(data => console.log(data));
</script>
```

### 访问结果对比

#### 路径方式访问 `http://example.com/aliyun/`
```html
<link rel="stylesheet" href="/aliyun/static/css/style.css">
<a href="/aliyun/">首页</a>
<a href="/aliyun/ecs_instances.html">ECS 实例</a>
```

#### 域名方式访问 `http://aliyun.example.com/`
```html
<link rel="stylesheet" href="/static/css/style.css">
<a href="/">首页</a>
<a href="/ecs_instances.html">ECS 实例</a>
```

**完全自动!** 无需修改模板代码,路径会自动调整。

## 本地测试

### 修改 hosts 文件

在本地测试域名绑定前，需要修改 hosts 文件:

**Windows**: `C:\Windows\System32\drivers\etc\hosts`
**Linux/Mac**: `/etc/hosts`

添加:
```
127.0.0.1  aliyun.localhost
127.0.0.1  demo.localhost
```

然后访问:
- `http://aliyun.localhost:8080/`
- `http://demo.localhost:8080/`

### 使用 .localhost 域名

现代浏览器自动解析 `.localhost` 到 127.0.0.1，无需修改 hosts 文件。

在 `sites.json` 中配置:

```json
{
  "sites": {
    "aliyun": {
      "domains": ["aliyun.localhost"]
    },
    "demo": {
      "domains": ["demo.localhost"]
    }
  }
}
```

启动服务器后直接访问:
- `http://aliyun.localhost:8080/`
- `http://demo.localhost:8080/`

## Nginx 反向代理配置

如果使用 Nginx 作为反向代理:

```nginx
# 主域名 - 平台首页
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

# 站点子域名
server {
    listen 80;
    server_name aliyun.example.com demo.example.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

**重要**: 确保 `proxy_set_header Host $host;` 存在，这样服务器才能正确识别域名。

## 宝塔面板配置

1. **添加站点**
   - 站点管理 -> 添加站点
   - 域名: `aliyun.example.com`
   - 根目录: 任意（将使用反向代理）

2. **配置反向代理**
   - 点击站点设置 -> 反向代理
   - 目标URL: `http://127.0.0.1:8080`
   - 发送域名: `$host`
   - 启用反向代理

3. **SSL 证书**（可选）
   - 站点设置 -> SSL -> Let's Encrypt
   - 申请免费证书

## 常见问题

### Q: 域名绑定后，站点切换器还能用吗?

A: 可以。站点切换器会自动适配，点击其他站点时会跳转到对应的路径或域名。

### Q: 同一个站点可以绑定多个域名吗?

A: 可以。在 `domains` 数组中添加多个域名即可。

### Q: 域名绑定后，原来的路径访问还能用吗?

A: 可以。域名方式和路径方式可以同时使用，互不冲突。

### Q: 如何取消域名绑定?

A: 从 `sites.json` 的 `domains` 数组中移除对应域名，或删除 `domain_mapping` 中的映射，然后重启服务器。

### Q: 支持通配符域名吗?

A: 不支持。需要明确指定每个域名。

### Q: 域名访问和路径访问有什么区别?

A: 技术上完全一样，只是 URL 形式不同。域名方式更简洁专业，路径方式便于在一个域名下管理多个站点。

## 最佳实践

1. **开发环境**: 使用路径方式 (`/aliyun/`)
2. **生产环境**: 如果站点独立性强，推荐域名方式
3. **内部工具**: 如果多个相关项目，推荐路径方式
4. **公开服务**: 推荐域名方式，更专业

## 示例配置

### 完整示例

```json
{
  "platform": {
    "name": "我的工作台",
    "description": "企业内部工具平台",
    "version": "1.0.0"
  },
  "sites": {
    "admin": {
      "name": "管理后台",
      "icon": "⚙️",
      "path": "/admin",
      "enabled": true,
      "domains": ["admin.mycompany.com"]
    },
    "api-docs": {
      "name": "API 文档",
      "icon": "📚",
      "path": "/api-docs",
      "enabled": true,
      "domains": ["docs.mycompany.com", "api.mycompany.com"]
    },
    "monitor": {
      "name": "监控面板",
      "icon": "📊",
      "path": "/monitor",
      "enabled": true,
      "domains": ["monitor.mycompany.com"]
    }
  },
  "home_site": "_home",
  "domain_mapping": {
    "dashboard.mycompany.com": "admin"
  }
}
```

这样配置后:
- `https://mycompany.com/` - 平台首页（站点导航）
- `https://admin.mycompany.com/` - 管理后台
- `https://docs.mycompany.com/` - API 文档
- `https://monitor.mycompany.com/` - 监控面板
- `https://mycompany.com/admin/` - 管理后台（路径方式，依然可用）

---

更多问题请参考 [GitHub Issues](https://github.com/firadio/jinja-hub/issues)。
