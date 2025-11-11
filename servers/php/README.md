# PHP 版本

使用 PHP + Twig 模板引擎实现的多云平台管理系统。

## 特性

- 🌐 **虚拟主机友好** - 适合共享主机部署
- 🎨 **原生 Twig** - PHP 官方 Jinja2 实现
- 📦 **Composer 管理** - 标准 PHP 包管理
- 🔒 **沙盒模式** - Twig 自动转义防止 XSS

## 运行

```bash
# 安装依赖
composer install

# 开发模式 (PHP 内置服务器)
php -S localhost:8080 index.php

# 生产环境 (Apache/Nginx)
# 配置虚拟主机指向 servers/php 目录
```

服务器启动在 `http://localhost:8080`

## 依赖

- PHP 7.4+
- Composer
- twig/twig 3.0+

## 路由

- `/` → 默认站点（aliyun）
- `/aliyun/` → 阿里云首页
- `/aliyun/ecs_instances.html` → ECS 实例页
- `/aliyun/api/config` → 配置 API
- `/aliyun/static/*` → 静态文件

## 项目结构

```
servers/php/
├── index.php         # 主程序
├── composer.json     # 依赖配置
├── vendor/           # Composer 依赖
└── README.md         # 本文件
```

## Apache 配置

```apache
<VirtualHost *:80>
    ServerName cloud.example.com
    DocumentRoot /var/www/cloud-manager/servers/php

    <Directory /var/www/cloud-manager/servers/php>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # 路由重写
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^ index.php [QSA,L]
    </Directory>
</VirtualHost>
```

## Nginx 配置

```nginx
server {
    listen 80;
    server_name cloud.example.com;
    root /var/www/cloud-manager/servers/php;
    index index.php;

    location / {
        try_files $uri $uri/ /index.php$is_args$args;
    }

    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.1-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # 静态文件缓存
    location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
        expires 7d;
    }
}
```

## Docker 部署

```dockerfile
FROM php:8.1-apache
WORKDIR /var/www/html
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer
COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader
COPY index.php .
COPY ../../sites /var/www/sites
RUN a2enmod rewrite
EXPOSE 80
```

## 宝塔面板部署

1. 创建站点，选择 PHP 8.1+
2. 站点目录设置为 `servers/php`
3. 运行目录设置为 `/`
4. 伪静态规则：

```nginx
if (!-e $request_filename) {
    rewrite ^(.*)$ /index.php?s=$1 last;
}
```

5. 安装 Composer 并执行 `composer install`

## 性能优化

- 启用 OPcache 加速 PHP 代码
- 启用 Twig 模板缓存
- 使用 Apache/Nginx 处理静态文件
- 启用 Gzip 压缩

```php
// 生产环境启用模板缓存
$twig = new Environment($loader, [
    'cache' => __DIR__ . '/cache/twig',
    'autoescape' => 'html',
]);
```
