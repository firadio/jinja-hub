# 宝塔面板部署指南

本项目支持在宝塔面板上快速部署 PHP 版本的多云平台管理系统。

## 目录结构

```
cloud-platform-manager/
├── sites/                  # 站点数据（所有语言版本共享）
│   ├── sites.json         # 站点配置
│   └── aliyun/            # 阿里云站点
│       ├── config.json
│       ├── templates/
│       └── static/        # 静态文件（CSS/JS/图片）
├── servers/
│   └── php/               # PHP 版本
│       ├── index.php      # PHP 入口文件
│       ├── composer.json
│       └── vendor/        # Composer 依赖
└── docs/
```

---

## 部署步骤

### 1. 上传项目文件

将整个项目文件夹上传到服务器 (例如: `/www/wwwroot/cloud-manager`)

### 2. 安装 Composer 依赖

在宝塔面板的 **终端** 中执行:

```bash
cd /www/wwwroot/cloud-manager/servers/php
composer install
```

> 如果宝塔未安装 Composer,先在 **软件商店** 中安装 **Composer**

### 3. 创建站点

在宝塔面板中:

1. 点击 **网站** → **添加站点**
2. 填写域名 (例如: `cloud.example.com`)
3. **根目录** 设置为: `/www/wwwroot/cloud-manager/servers/php`  ⚠️ 注意是 servers/php 目录
4. **运行目录** 设置为: `/` (根目录即可)
5. PHP 版本选择: **PHP 7.4** 或更高
6. 创建站点

### 4. 配置伪静态规则

#### 对于 Nginx

在站点设置中，点击 **伪静态**，选择 **自定义**，添加以下规则：

```nginx
location / {
    try_files $uri $uri/ /index.php?$query_string;
}
```

#### 对于 Apache

Apache 会自动读取 `.htaccess` 文件。如果不存在，创建 `servers/php/.htaccess`:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.php [QSA,L]
</IfModule>
```

### 5. 配置敏感文件保护

在站点设置中,点击 **配置文件**,在 `server` 块中添加:

```nginx
# 隐藏敏感文件
location ~* (composer\.json|composer\.lock|\.git) {
    deny all;
}

# 禁止直接访问 sites 配置文件
location ~* /sites/.+\.json$ {
    deny all;
}
```

完整的 Nginx 配置示例:

```nginx
server {
    listen 80;
    server_name cloud.example.com;

    root /www/wwwroot/cloud-manager/servers/php;
    index index.php index.html;

    # PHP 路由
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP 处理
    location ~ \.php$ {
        fastcgi_pass unix:/tmp/php-cgi-74.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # 隐藏敏感文件
    location ~* (composer\.json|composer\.lock|\.git) {
        deny all;
    }

    # 禁止直接访问配置文件
    location ~* /sites/.+\.json$ {
        deny all;
    }

    # 静态文件缓存（可选）
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
```

### 6. 设置目录权限

在宝塔面板的 **文件** 中:

1. 给 `servers/php/vendor/` 目录设置权限: `755`
2. 给 `sites/` 目录及其子目录设置权限: `755`

```bash
cd /www/wwwroot/cloud-manager
chmod -R 755 servers/php/vendor
chmod -R 755 sites
```

### 7. 配置站点信息

编辑 `sites/aliyun/config.json` 文件,根据需要修改站点配置:

```json
{
  "site": {
    "title": "阿里云管理平台",
    "description": "Alibaba Cloud Management Platform"
  },
  "api": {
    "ecs": {
      "endpoint": "ecs.aliyuncs.com",
      "version": "2014-05-26"
    }
  },
  "regions": [
    {"id": "cn-hangzhou", "name": "华东1（杭州）"},
    {"id": "cn-shanghai", "name": "华东2（上海）"}
  ]
}
```

### 8. 访问测试

在浏览器中访问你的域名:

- 默认首页: `http://cloud.example.com/` → 自动跳转到 aliyun 站点
- 阿里云站点: `http://cloud.example.com/aliyun/`
- API 配置: `http://cloud.example.com/aliyun/api/config`

---

## 路由说明

新版本支持多站点架构，路由规则如下：

```
/                              → 默认站点（aliyun）
/{站点名}/                      → 站点首页
/{站点名}/{页面}.html            → 站点页面
/{站点名}/api/config            → 站点配置 API
/{站点名}/static/{文件}         → 静态文件
```

示例：
- `/aliyun/` - 阿里云首页
- `/aliyun/ecs_instances.html` - ECS 实例页
- `/aliyun/static/css/style.css` - 静态文件

**重要**: 静态文件由 PHP 动态路由处理，**无需**配置 Nginx alias 或 Apache Alias。

---

## 添加新的云平台站点

### 1. 复制站点模板

```bash
cd /www/wwwroot/cloud-manager/sites
cp -r aliyun aws
```

### 2. 修改站点配置

编辑 `sites/aws/config.json`，修改为 AWS 相关配置

### 3. 在站点列表中启用

编辑 `sites/sites.json`:

```json
{
  "sites": {
    "aliyun": {
      "name": "阿里云管理平台",
      "description": "Alibaba Cloud Management Platform",
      "path": "/aliyun",
      "enabled": true
    },
    "aws": {
      "name": "AWS 管理平台",
      "description": "Amazon Web Services Management Platform",
      "path": "/aws",
      "enabled": true
    }
  },
  "default_site": "aliyun"
}
```

### 4. 重启 PHP（如果使用 OPcache）

在宝塔面板中重启 PHP 服务，或访问站点验证。

---

## 常见问题

### Q1: 页面显示 404 Not Found

**原因**: 伪静态规则未配置

**解决方案**:
- 检查宝塔面板的 **伪静态** 设置
- Nginx 用户需要添加 `try_files` 规则
- Apache 用户需要确保 `.htaccess` 存在且 `mod_rewrite` 已启用

### Q2: 静态文件无法加载（404）

**原因**: PHP 无法读取 `sites/` 目录

**解决方案**:
```bash
chmod -R 755 /www/wwwroot/cloud-manager/sites
```

检查 PHP 代码中的路径是否正确（应该使用相对路径 `../../sites/`）

### Q3: 500 Internal Server Error

**原因**: Composer 依赖未安装或 PHP 版本过低

**解决方案**:
```bash
cd /www/wwwroot/cloud-manager/servers/php
composer install
```

确保 PHP 版本 >= 7.4

### Q4: Template Error

**原因**: 模板目录不可读

**解决方案**:
```bash
chmod -R 755 /www/wwwroot/cloud-manager/sites/*/templates
```

### Q5: 切换站点后配置没有生效

**原因**: PHP OPcache 缓存了旧代码

**解决方案**: 在宝塔面板中重启 PHP 服务

---

## 性能优化 (生产环境)

### 1. 启用 Twig 缓存

编辑 `servers/php/index.php` 第 96 行:

```php
$twig = new Environment($loader, [
    'cache' => __DIR__ . '/../../cache/twig',  // 启用缓存
    'autoescape' => 'html',
]);
```

创建缓存目录:
```bash
mkdir -p /www/wwwroot/cloud-manager/cache/twig
chmod 755 /www/wwwroot/cloud-manager/cache
```

### 2. 启用 Composer 优化

```bash
cd /www/wwwroot/cloud-manager/servers/php
composer install --optimize-autoloader --no-dev
```

### 3. 启用 OPcache

在宝塔面板中:
1. 点击 **软件商店** → **PHP 7.4** → **设置**
2. 点击 **安装扩展** → 安装 **opcache**
3. 点击 **配置文件**,确认 opcache 已启用:

```ini
[opcache]
opcache.enable=1
opcache.memory_consumption=128
opcache.interned_strings_buffer=8
opcache.max_accelerated_files=10000
opcache.revalidate_freq=60
```

### 4. 启用 Gzip 压缩

在宝塔面板的站点设置中,开启 **Gzip 压缩**。

### 5. 静态文件缓存

在 Nginx 配置中添加:

```nginx
location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
    expires 7d;
    add_header Cache-Control "public, immutable";
}
```

---

## 安全建议

### 1. 隐藏 PHP 版本信息

在 PHP 配置文件中设置:

```ini
expose_php = Off
```

### 2. 限制敏感文件访问

确保 Nginx 配置包含:

```nginx
location ~* (composer\.json|composer\.lock|\.git) {
    deny all;
}

location ~* /sites/.+\.json$ {
    deny all;
}
```

### 3. 使用 HTTPS

在宝塔面板中:
1. 点击站点 → **SSL**
2. 选择 **Let's Encrypt** 或上传证书
3. 强制 HTTPS

### 4. 定期更新依赖

```bash
cd /www/wwwroot/cloud-manager/servers/php
composer update
```

---

## 使用其他面板

### cPanel / DirectAdmin

1. 上传项目到 `public_html/cloud-manager`
2. 创建子域名，根目录指向 `public_html/cloud-manager/servers/php`
3. 在 SSH 中运行 `composer install`
4. 配置 `.htaccess` (参考上方 Apache 配置)

### WDCP

1. 创建站点,指定根目录为 `servers/php`
2. 在 SSH 中运行 `composer install`
3. 配置 Nginx 规则 (参考上方 Nginx 配置)

---

## 技术支持

- 项目地址: https://github.com/firadio/golang-gin-aliyun
- 问题反馈: GitHub Issues
