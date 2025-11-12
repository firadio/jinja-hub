# CSS 架构说明

## 目录结构

```
css/
├── main.css              # 主入口文件,导入所有模块
├── style.css             # 原有样式 (组件和页面样式)
│
├── base/                 # 基础层
│   ├── variables.css     # CSS 变量定义
│   ├── reset.css         # Reset 和基础样式
│   └── utilities.css     # 工具类
│
├── components/           # 组件层 (未来)
│   ├── button.css
│   ├── form.css
│   ├── table.css
│   └── modal.css
│
└── pages/                # 页面层 (未来)
    ├── login.css
    └── dashboard.css
```

## 加载顺序

CSS 模块按以下顺序加载 (在 `main.css` 中定义):

1. **base/variables.css** - CSS 变量
2. **base/reset.css** - Reset 样式
3. **base/utilities.css** - 工具类
4. **style.css** - 原有样式 (临时保留)

## CSS 变量使用

所有颜色、间距、字体等都定义为 CSS 变量,便于统一管理和主题切换。

### 颜色

```css
/* 使用品牌色 */
.button {
    background-color: var(--color-primary);
}

/* 使用功能色 */
.alert-error {
    color: var(--color-error);
}
```

### 间距

```css
/* 使用统一间距 */
.card {
    padding: var(--spacing-lg);
    margin-bottom: var(--spacing-md);
}
```

### 圆角和阴影

```css
.box {
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
}
```

## 工具类

提供常用的辅助类,减少重复 CSS:

```html
<!-- 布局 -->
<div class="flex items-center justify-between gap-md">

<!-- 文本 -->
<p class="text-center font-bold text-lg">

<!-- 间距 -->
<div class="mt-lg mb-md p-lg">

<!-- 样式 -->
<div class="rounded shadow transition">
```

## 主题切换

通过设置 `data-theme` 属性切换主题:

```html
<!-- 亮色主题 (默认) -->
<html lang="zh-CN">

<!-- 暗色主题 -->
<html lang="zh-CN" data-theme="dark">
```

切换主题的 JavaScript:

```javascript
// 切换到暗色主题
document.documentElement.setAttribute('data-theme', 'dark');

// 切换到亮色主题
document.documentElement.removeAttribute('data-theme');

// 保存用户偏好
localStorage.setItem('theme', 'dark');
```

## 迁移指南

### 从硬编码值迁移到 CSS 变量

**之前:**
```css
.button {
    color: #333;
    background: #ff6a00;
    padding: 12px 16px;
    border-radius: 4px;
}
```

**之后:**
```css
.button {
    color: var(--color-text);
    background: var(--color-primary);
    padding: var(--spacing-md) var(--spacing-lg);
    border-radius: var(--radius-md);
}
```

### 使用工具类减少自定义 CSS

**之前:**
```html
<style>
.my-box {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    border-radius: 6px;
}
</style>
<div class="my-box">...</div>
```

**之后:**
```html
<div class="flex items-center gap-md p-lg rounded-lg">...</div>
```

## 最佳实践

1. **优先使用 CSS 变量**
   - 所有颜色都使用变量,不要硬编码
   - 间距使用统一的变量值

2. **优先使用工具类**
   - 对于简单的样式,使用工具类
   - 避免为一次性样式创建 class

3. **组件样式模块化**
   - 每个组件的样式单独一个文件
   - 使用 BEM 命名规范

4. **避免深层嵌套**
   - CSS 选择器不要超过 3 层
   - 使用 class 而不是标签选择器

5. **移动端优先**
   - 使用 min-width 媒体查询
   - 先写移动端样式,再添加桌面端样式

## 性能优化

1. **CSS 文件拆分**
   - 按功能拆分文件
   - 使用 @import 或构建工具合并

2. **减少重复**
   - 提取公共样式为工具类
   - 使用 CSS 变量统一管理

3. **避免昂贵的选择器**
   - 避免通配符 `*` 选择器
   - 避免属性选择器 `[attr~="value"]`
   - 避免后代选择器 `.a .b .c .d`

## 未来计划

- [ ] 将 style.css 拆分为组件模块
- [ ] 创建 components/ 目录存放组件样式
- [ ] 创建 pages/ 目录存放页面特定样式
- [ ] 添加暗色主题完整支持
- [ ] 添加主题切换器组件
- [ ] 使用 PostCSS 或 Sass 预处理器

## 贡献指南

添加新样式时:

1. 检查是否已有 CSS 变量可用
2. 检查是否可以用工具类实现
3. 如需自定义样式,考虑是否可以提取为组件
4. 新组件放在 `components/` 目录
5. 页面特定样式放在 `pages/` 目录
6. 更新本 README 文档
