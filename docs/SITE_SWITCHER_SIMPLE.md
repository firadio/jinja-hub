# 站点切换器组件使用指南（简洁版）

## 简介

`site_switcher_simple.html` 是一个简洁美观的站点切换器组件，可以方便地在不同站点之间切换。

## 特点

- ✨ **简洁美观**: 看起来像普通的站点标题，点击后展开下拉菜单
- 🎨 **样式自包含**: 组件内置 CSS 和 JavaScript，无需额外配置
- 🔄 **完全可复用**: 任何站点都可以直接使用
- 📱 **交互友好**: 点击外部自动关闭，箭头旋转动画

## 使用方法

### 1. 在导航栏中使用

在你的导航栏组件中（如 `navbar.html`）引入：

```html
<div class="nav-left">
    {% include 'components/site_switcher_simple.html' %}
</div>
```

### 2. 确保必需的变量

组件需要以下变量（通常由服务器自动传递）：

- `config.site.title` - 当前站点标题
- `platform.name` - 平台名称
- `all_sites` - 所有站点列表
- `site_name` - 当前站点ID

这些变量在 Jinja Hub 中会自动传递，无需手动配置。

### 3. 确保有基础样式

组件依赖 `.nav-brand` 基础样式（用于站点标题外观）：

```css
.nav-brand {
    font-size: 20px;
    font-weight: bold;
    color: #ff6a00;
    margin-right: 40px;
}
```

## 示例

### 完整导航栏示例

```html
<nav class="navbar">
    <div class="nav-container">
        <div class="nav-left">
            {% include 'components/site_switcher_simple.html' %}
        </div>
        <ul class="nav-menu">
            <!-- 菜单项 -->
        </ul>
        <div class="nav-right">
            <!-- 右侧按钮 -->
        </div>
    </div>
</nav>
```

## 外观效果

**正常状态:**
```
[阿里云管理平台 ▼]  [菜单项1] [菜单项2] ...
```

**点击后展开:**
```
[阿里云管理平台 ▲]
  ┌─────────────────────┐
  │ 🏠 Jinja Hub        │
  ├─────────────────────┤
  │ 🇨🇳 阿里云管理平台 ✓ │ ← 当前站点（橙色背景）
  │ 🎨 演示站点          │
  └─────────────────────┘
```

## 自定义

### 修改主题色

如果你想修改组件颜色以匹配你的站点主题，编辑组件内的样式：

```css
/* 修改当前站点背景色 */
.dropdown-item.active {
    background: #fff7ed;  /* 改成你喜欢的颜色 */
}

/* 修改 ✓ 标记颜色 */
.check-mark {
    color: #ff6a00;  /* 改成你的主题色 */
}
```

### 修改下拉菜单样式

```css
.site-switcher-dropdown {
    min-width: 240px;      /* 调整宽度 */
    border-radius: 8px;    /* 调整圆角 */
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);  /* 调整阴影 */
}
```

## 复制到其他站点

### 方法1: 直接复制组件文件

```bash
# 复制到新站点
cp sites/aliyun/templates/components/site_switcher_simple.html \
   sites/your_site/templates/components/
```

### 方法2: 使用共享组件（推荐）

可以考虑创建共享组件目录：

```
sites/
  _shared/
    components/
      site_switcher_simple.html
  aliyun/
  demo/
  your_site/
```

然后在模板中引用：

```html
{% include '../_shared/components/site_switcher_simple.html' %}
```

## 注意事项

1. **组件自包含**: 组件内部已包含所有必要的 CSS 和 JavaScript
2. **无依赖**: 除了 `.nav-brand` 基础样式外，不依赖其他样式
3. **单次引入**: 一个页面只需引入一次，不要重复引入
4. **变量传递**: 确保服务器正确传递必需变量

## 技术细节

- **HTML**: 使用 Jinja2/Nunjucks 模板语法
- **CSS**: 内联样式，使用现代 CSS 特性（flexbox, transitions）
- **JavaScript**: 使用 IIFE 封装，避免全局变量污染
- **兼容性**: 支持现代浏览器（Chrome, Firefox, Safari, Edge）

## 故障排除

### 切换器不显示？

检查：
1. 变量是否正确传递（在浏览器控制台检查）
2. `.nav-brand` 样式是否存在
3. 组件文件路径是否正确

### 下拉菜单不工作？

检查：
1. JavaScript 是否正常执行（查看控制台是否有错误）
2. 是否有其他 JavaScript 冲突
3. 元素 ID 是否重复（`siteSwitcherBtn`, `siteSwitcherDropdown`）

### 样式显示异常？

检查：
1. 是否有 CSS 冲突
2. z-index 是否被其他元素覆盖
3. 浏览器是否缓存了旧样式（强制刷新 Ctrl+F5）

## 更新日志

- **v1.0** (2025-01-11): 首次发布，简洁样式设计

---

如有问题请访问 [GitHub Issues](https://github.com/firadio/jinja-hub/issues)
