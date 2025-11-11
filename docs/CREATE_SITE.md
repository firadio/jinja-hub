# 创建新站点指南

本指南将帮助你在 Jinja Hub 平台上创建自己的站点。

## 快速开始

### 方式一：使用示例站点模板（推荐）

1. **复制示例站点**

```bash
# 复制 aliyun 站点作为模板
cp -r sites/aliyun sites/my-site

# Windows 用户
xcopy sites\aliyun sites\my-site /E /I
```

2. **修改站点配置**

编辑 `sites/my-site/config.json`:

```json
{
  "site_name": "my-site",
  "site_title": "我的站点",
  "api_base_url": "/my-site/api",
  "pages": {
    "index": {
      "title": "首页",
      "description": "我的站点首页"
    },
    "about": {
      "title": "关于",
      "description": "关于页面"
    }
  }
}
```

3. **注册站点**

编辑 `sites/sites.json`，添加你的站点:

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
      "category": "示例项目"
    },
    "my-site": {
      "name": "我的站点",
      "description": "我的第一个 Jinja Hub 站点",
      "icon": "🚀",
      "path": "/my-site",
      "enabled": true,
      "category": "个人项目"
    }
  },
  "home_site": "_home"
}
```

4. **修改模板**

编辑 `sites/my-site/templates/pages/` 下的 HTML 文件，根据需求调整页面内容。

5. **启动服务器**

```bash
cd servers/nodejs
npm install
node server.js
```

访问: `http://localhost:8080/my-site/`

---

### 方式二：从零开始创建

#### 1. 创建站点目录结构

```bash
mkdir -p sites/my-site/{templates/{pages,components,layouts},static/{css,js,images}}
```

目录结构:
```
sites/my-site/
├── config.json              # 站点配置
├── templates/               # 模板目录
│   ├── layouts/            # 布局模板
│   │   └── base.html       # 基础布局
│   ├── components/         # 组件模板
│   │   └── navbar.html     # 导航栏
│   └── pages/              # 页面模板
│       └── index.html      # 首页
└── static/                 # 静态文件
    ├── css/                # 样式文件
    ├── js/                 # JavaScript 文件
    └── images/             # 图片文件
```

#### 2. 创建配置文件

创建 `sites/my-site/config.json`:

```json
{
  "site_name": "my-site",
  "site_title": "我的站点",
  "api_base_url": "/my-site/api",
  "pages": {
    "index": {
      "title": "首页",
      "description": "欢迎来到我的站点"
    }
  }
}
```

#### 3. 创建基础布局

创建 `sites/my-site/templates/layouts/base.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}{{ config.site_title }}{% endblock %}</title>
    <link rel="stylesheet" href="/{{ site_name }}/static/css/style.css">
    {% block head %}{% endblock %}
</head>
<body>
    <header>
        {% include 'components/navbar.html' %}
    </header>

    <main>
        {% block content %}{% endblock %}
    </main>

    <footer>
        <p>&copy; 2024 {{ config.site_title }}</p>
    </footer>

    <script src="/{{ site_name }}/static/js/main.js"></script>
    {% block scripts %}{% endblock %}
</body>
</html>
```

#### 4. 创建导航栏组件

创建 `sites/my-site/templates/components/navbar.html`:

```html
<nav class="navbar">
    <div class="navbar-brand">
        <a href="/{{ site_name }}/">{{ config.site_title }}</a>
    </div>
    <ul class="navbar-menu">
        <li><a href="/{{ site_name }}/">首页</a></li>
        <li><a href="/{{ site_name }}/about.html">关于</a></li>
    </ul>
</nav>
```

#### 5. 创建首页

创建 `sites/my-site/templates/pages/index.html`:

```html
{% extends "layouts/base.html" %}

{% block title %}{{ page.title }} - {{ config.site_title }}{% endblock %}

{% block content %}
<div class="container">
    <h1>欢迎来到 {{ config.site_title }}</h1>
    <p>{{ page.description }}</p>

    <div class="features">
        <div class="feature-card">
            <h3>特性 1</h3>
            <p>描述内容...</p>
        </div>
        <div class="feature-card">
            <h3>特性 2</h3>
            <p>描述内容...</p>
        </div>
    </div>
</div>
{% endblock %}

{% block scripts %}
<script>
    console.log('Hello from {{ config.site_title }}!');
</script>
{% endblock %}
```

#### 6. 创建样式文件

创建 `sites/my-site/static/css/style.css`:

```css
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
}

.navbar {
    background: #667eea;
    color: white;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.navbar-brand a {
    color: white;
    text-decoration: none;
    font-size: 1.5rem;
    font-weight: bold;
}

.navbar-menu {
    display: flex;
    list-style: none;
    gap: 1.5rem;
}

.navbar-menu a {
    color: white;
    text-decoration: none;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
}

.features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-top: 2rem;
}

.feature-card {
    padding: 2rem;
    border: 1px solid #ddd;
    border-radius: 8px;
}

footer {
    text-align: center;
    padding: 2rem;
    background: #f5f5f5;
    margin-top: 4rem;
}
```

#### 7. 创建 JavaScript 文件

创建 `sites/my-site/static/js/main.js`:

```javascript
// 站点通用 JavaScript
console.log('Site loaded');

// 添加你的自定义功能
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM ready');
});
```

#### 8. 注册站点

在 `sites/sites.json` 中添加你的站点（参考方式一步骤3）。

#### 9. 测试站点

启动服务器并访问你的站点:
```bash
cd servers/nodejs
node server.js
```

访问: `http://localhost:8080/my-site/`

---

## 模板语法

Jinja Hub 使用 Jinja2 模板语法（在 Node.js 版本中使用 Nunjucks，语法完全兼容）。

### 变量输出

```html
{{ variable }}
{{ config.site_title }}
{{ page.description }}
```

### 条件语句

```html
{% if user %}
    <p>欢迎, {{ user.name }}!</p>
{% else %}
    <p>请登录</p>
{% endif %}
```

### 循环

```html
{% for item in items %}
    <li>{{ item.name }}</li>
{% endfor %}
```

### 包含组件

```html
{% include 'components/navbar.html' %}
{% include 'components/site_switcher.html' %}
```

### 继承布局

```html
{% extends "layouts/base.html" %}

{% block content %}
    <h1>页面内容</h1>
{% endblock %}
```

---

## 配置说明

### config.json 配置项

```json
{
  "site_name": "站点标识符（对应路由）",
  "site_title": "站点标题",
  "api_base_url": "API 基础路径",
  "pages": {
    "page_name": {
      "title": "页面标题",
      "description": "页面描述",
      "custom_field": "自定义字段"
    }
  },
  "custom_config": {
    "可以添加任何自定义配置": "在模板中通过 config.custom_config 访问"
  }
}
```

### sites.json 配置项

```json
{
  "platform": {
    "name": "平台名称",
    "description": "平台描述",
    "version": "版本号"
  },
  "sites": {
    "site_id": {
      "name": "站点显示名称",
      "description": "站点描述",
      "icon": "站点图标（emoji 或图片）",
      "path": "站点路径",
      "enabled": true,
      "category": "站点分类"
    }
  },
  "home_site": "_home"
}
```

---

## 站点切换功能

平台提供了内置的站点切换组件,让用户可以方便地在不同站点之间切换。

### 使用站点切换器

在导航栏中添加站点切换器:

```html
<nav class="navbar">
    <div class="nav-container">
        <div class="nav-left">
            <!-- 站点切换器 -->
            {% include 'components/site_switcher.html' %}
        </div>
        <ul class="nav-menu">
            <!-- 你的菜单项 -->
        </ul>
    </div>
</nav>
```

### 复制站点切换器组件

站点切换器组件位于 `sites/_home/components/site_switcher.html`，你可以:

1. 直接复制到你的站点:
```bash
cp sites/_home/components/site_switcher.html sites/my-site/templates/components/
```

2. 或者创建符号链接(推荐):
```bash
# Linux/Mac
ln -s ../../../../_home/components/site_switcher.html sites/my-site/templates/components/

# Windows (管理员权限)
mklink sites\my-site\templates\components\site_switcher.html ..\..\..\..\..\_home\components\site_switcher.html
```

### 可用变量

站点切换器组件使用以下变量:
- `site` - 当前站点信息
- `site_name` - 当前站点ID
- `platform` - 平台信息
- `all_sites` - 所有站点列表

这些变量由服务器自动传递到模板。

---

## 最佳实践

### 1. 目录组织

- 将可复用的组件放在 `templates/components/`
- 使用 `templates/layouts/` 创建统一的页面布局
- 页面模板放在 `templates/pages/`
- 考虑从 `sites/_home/components/` 复用通用组件

### 2. 样式管理

- 全局样式放在 `static/css/style.css`
- 页面特定样式可以创建单独的 CSS 文件
- 使用 CSS 变量统一主题颜色

### 3. JavaScript 组织

- 通用功能放在 `static/js/main.js`
- 页面特定功能创建单独的 JS 文件
- 避免在模板中编写大量 JavaScript

### 4. 配置管理

- 将可配置的内容放在 `config.json`
- 避免在模板中硬编码
- 使用模板变量提高可维护性

### 5. API 集成

如果站点需要调用后端 API，可以:
- 在 `static/js/` 中创建 API 客户端
- 使用 `config.api_base_url` 配置 API 路径
- 参考 `aliyun` 示例站点的 API 集成方式

---

## 常见问题

### Q: 如何添加新页面?

1. 在 `templates/pages/` 下创建新的 HTML 文件
2. 在 `config.json` 的 `pages` 中添加页面配置
3. 访问 `/{site_name}/{page_name}.html`

### Q: 如何使用静态资源?

在模板中使用相对路径:
```html
<link rel="stylesheet" href="/{{ site_name }}/static/css/style.css">
<script src="/{{ site_name }}/static/js/main.js"></script>
<img src="/{{ site_name }}/static/images/logo.png" alt="Logo">
```

### Q: 如何禁用站点?

在 `sites/sites.json` 中将站点的 `enabled` 设为 `false`。

### Q: 多个站点可以共享代码吗?

可以。你可以:
1. 创建公共组件在不同站点中引用
2. 使用公共的 CSS/JS 文件
3. 考虑创建一个 `_shared` 目录存放共享资源

---

## 下一步

- 查看 [阿里云管理平台示例](../sites/aliyun/) 学习完整的站点实现
- 阅读各语言服务器的文档了解后端实现
- 探索 Jinja2/Nunjucks 模板的高级特性

有问题? 欢迎在 GitHub 提 Issue!
