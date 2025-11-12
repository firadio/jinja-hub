# 迁移到 Tailwind CSS + daisyUI

## 迁移状态

### ✅ 已完成
- **base.html**: 引入 Tailwind CSS + daisyUI (CDN)
- **navbar.html**: 导航栏完全使用 daisyUI 组件
- **ecs_instances.html**: ECS 实例列表页面完全迁移

### 🔄 待迁移
- vpc_list.html
- vswitch_list.html
- eip_list.html
- test.html
- login.html (如果有)

## 旧代码备份

所有旧的自定义 CSS 已备份到:
```
sites/aliyun/static/css_old_backup/
```

如需恢复,可以：
1. 将 `css_old_backup/` 重命名回 `css/`
2. 在 base.html 中恢复 CSS 引用

## 使用的 daisyUI 组件

### 布局组件
- `card` - 卡片容器
- `navbar` - 导航栏
- `drawer` / 侧边栏 - 移动端菜单

### 表单组件
- `input input-bordered` - 输入框
- `select select-bordered` - 下拉选择
- `btn btn-primary` - 按钮
- `form-control` - 表单控件包装
- `label` + `label-text` - 表单标签

### 数据展示
- `table table-zebra` - 斑马纹表格
- `badge` - 徽章 (状态显示)
- `alert alert-error` - 错误提示
- `loading loading-spinner` - 加载动画

### 交互组件
- `modal` + `modal-box` - 模态框
- `dropdown` + `dropdown-content` - 下拉菜单
- `join` - 按钮组 (用于分页)

## Tailwind 工具类

### 响应式布局
```html
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- 移动端1列, 平板2列, 桌面3列 -->
</div>
```

### 间距
- `p-4` - padding: 1rem
- `m-6` - margin: 1.5rem
- `gap-4` - gap: 1rem

### 尺寸
- `w-full` - width: 100%
- `max-w-7xl` - max-width: 80rem
- `min-h-screen` - min-height: 100vh

### 显示/隐藏
- `hidden lg:flex` - 小屏隐藏,大屏显示
- `block md:hidden` - 小屏显示,大屏隐藏

## 主题配置

当前使用 daisyUI 的 light 主题，可在 base.html 中配置：

```html
<html lang="zh-CN" data-theme="light">
```

可选主题:
- `light` (默认)
- `dark`
- `cupcake`
- `bumblebee`
- 等 30+ 主题

## 自定义颜色

在 base.html 的 Tailwind 配置中已添加阿里云橙色:

```javascript
tailwind.config = {
    theme: {
        extend: {
            colors: {
                'aliyun-orange': '#ff6a00',
            }
        }
    }
}
```

使用方式: `text-aliyun-orange` 或 `bg-aliyun-orange`

## 开发建议

1. **优先使用 daisyUI 组件**
   - 查阅文档: https://daisyui.com/components/
   - 使用语义化的类名

2. **善用 Tailwind 工具类**
   - 间距、颜色、字体等
   - 响应式断点: sm / md / lg / xl

3. **避免自定义 CSS**
   - 大部分需求都能用工具类实现
   - 特殊需求考虑提取为组件

4. **保持一致性**
   - 统一使用 daisyUI 的设计语言
   - 避免混用多种风格

## 性能优化 (未来)

当前使用 CDN 方式,适合开发阶段。

生产环境建议:
1. 安装本地依赖: `npm install -D tailwindcss daisyui`
2. 配置 Tailwind CLI 按需构建
3. 只打包使用到的类,文件体积可降至 10-50KB

## 问题反馈

如遇到样式问题:
1. 检查是否使用了正确的 daisyUI 组件类名
2. 查看浏览器控制台是否有 Tailwind 加载错误
3. 确认 base.html 中 CDN 链接可访问
