# 站点切换器使用指南

站点切换器是 Jinja Hub 内置的导航组件，让用户可以方便地在不同站点之间切换。

## 效果预览

站点切换器显示在导航栏左侧，包含:
- 当前站点图标和名称
- 下拉菜单展示所有可用站点
- 返回平台首页的快捷链接
- 当前站点的勾选标记

## 快速开始

### 1. 在现有站点中添加站点切换器

编辑导航栏组件，添加站点切换器:

```html
<nav class="navbar">
    <div class="nav-container">
        <div class="nav-left">
            <!-- 站点切换器 -->
            {% include 'components/site_switcher.html' %}
            <div class="nav-brand">{{ config.site_title }}</div>
        </div>
        <!-- 其他导航内容 -->
    </div>
</nav>
```

### 2. 复制组件文件

站点切换器组件位于 `sites/_home/components/site_switcher.html`，有两种使用方式:

**方式一：直接复制**
```bash
cp sites/_home/components/site_switcher.html sites/my-site/templates/components/
```

**方式二：创建符号链接（推荐）**
```bash
# Linux/Mac
ln -s ../../../../_home/components/site_switcher.html sites/my-site/templates/components/

# Windows (需要管理员权限)
mklink sites\my-site\templates\components\site_switcher.html ..\..\..\..\..\_home\components\site_switcher.html
```

### 3. 确保 CSS 布局支持

在站点的 CSS 文件中添加:

```css
.nav-container {
    display: flex;
    align-items: center;
    gap: 20px;
}

.nav-left {
    display: flex;
    align-items: center;
}
```

## 组件说明

### 必需的模板变量

站点切换器需要以下变量（服务器自动传递）:

| 变量 | 类型 | 说明 |
|------|------|------|
| `site` | Object | 当前站点信息 |
| `site_name` | String | 当前站点ID |
| `platform` | Object | 平台信息 |
| `all_sites` | Object | 所有站点列表 |

### 组件功能

1. **当前站点显示**:
   - 图标：显示站点的 emoji 图标
   - 名称：显示站点的中文名称
   - 下拉箭头：点击展开菜单

2. **下拉菜单**:
   - 平台首页链接：点击返回站点导航页
   - 所有启用的站点列表
   - 当前站点带勾选标记
   - 显示站点分类

3. **交互效果**:
   - 点击按钮展开/收起菜单
   - 点击其他地方自动关闭
   - 平滑的动画过渡

## 自定义样式

站点切换器包含完整的 CSS 样式，你可以覆盖以下类来自定义外观:

```css
/* 按钮样式 */
.site-switcher-btn {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.2);
    /* 自定义颜色 */
}

/* 下拉菜单 */
.site-switcher-dropdown {
    min-width: 280px;
    /* 自定义宽度 */
}

/* 站点项目 */
.site-item:hover {
    background: #f3f4f6;
    /* 自定义悬停颜色 */
}
```

## 完整示例

这是一个完整的导航栏示例，集成了站点切换器:

```html
<nav class="navbar">
    <div class="nav-container">
        <div class="nav-left">
            <!-- 站点切换器 -->
            {% include 'components/site_switcher.html' %}
            <div class="nav-brand">{{ config.site_title }}</div>
        </div>

        <ul class="nav-menu">
            <li><a href="/">首页</a></li>
            <li><a href="/about.html">关于</a></li>
        </ul>

        <div class="nav-right">
            <button class="btn">设置</button>
        </div>
    </div>
</nav>
```

配套 CSS:

```css
.navbar {
    background-color: #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.nav-container {
    max-width: 1400px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    padding: 0 20px;
    height: 60px;
    gap: 20px;
}

.nav-left {
    display: flex;
    align-items: center;
    gap: 15px;
}

.nav-brand {
    font-size: 20px;
    font-weight: bold;
    color: #667eea;
}

.nav-menu {
    display: flex;
    list-style: none;
    gap: 5px;
    flex: 1;
}

.nav-menu li a {
    display: block;
    padding: 18px 20px;
    text-decoration: none;
    color: #333;
}

.nav-right {
    display: flex;
    align-items: center;
    gap: 10px;
}
```

## 域名绑定支持

站点切换器自动支持域名绑定：

- **路径方式**: 点击站点跳转到 `/site-name/`
- **域名方式**: 点击站点跳转到 `https://site-domain.com/`

无需额外配置，组件会自动使用站点的 `path` 配置。

## 故障排查

### 问题：站点切换器不显示

**原因**：组件文件不存在或路径错误

**解决**：
```bash
# 检查文件是否存在
ls sites/my-site/templates/components/site_switcher.html

# 如果不存在，复制文件
cp sites/_home/components/site_switcher.html sites/my-site/templates/components/
```

### 问题：样式错乱

**原因**：CSS 冲突或布局不兼容

**解决**：
1. 确保 `.nav-container` 使用 flexbox 布局
2. 检查是否有全局 CSS 覆盖了组件样式
3. 使用浏览器开发者工具检查元素样式

### 问题：点击没有反应

**原因**：JavaScript 未加载或有冲突

**解决**：
1. 打开浏览器控制台检查错误
2. 确保没有其他 JS 代码阻止事件冒泡
3. 检查组件中的 `<script>` 标签是否完整

### 问题：下拉菜单被遮挡

**原因**：z-index 层级问题

**解决**：
```css
.site-switcher-dropdown {
    z-index: 1000; /* 增加层级 */
}
```

## 最佳实践

1. **统一位置**: 将站点切换器放在导航栏左侧第一个位置
2. **保持简洁**: 不要在站点列表过长时使用，建议不超过 10 个站点
3. **分类管理**: 使用 `category` 字段对站点分类
4. **图标选择**: 为每个站点选择合适的 emoji 图标，便于快速识别
5. **测试兼容性**: 在不同浏览器和设备上测试切换器的显示效果

## 参考

- [创建新站点指南](CREATE_SITE.md)
- [域名绑定配置](DOMAIN_BINDING.md)
- 示例站点：
  - `sites/aliyun/` - 完整的站点切换器实现
  - `sites/demo/` - 简化的演示版本

---

如有问题，欢迎在 [GitHub Issues](https://github.com/firadio/jinja-hub/issues) 反馈。
