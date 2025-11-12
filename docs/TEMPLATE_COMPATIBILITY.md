# 模板语法兼容性指南

本项目支持多个模板引擎,本文档列出了各引擎的兼容性。

## 支持的模板引擎

| 语言 | 模板引擎 | 版本 | 文档 |
|------|---------|------|------|
| Node.js | Nunjucks | 3.x | [nunjucks.org](https://mozilla.github.io/nunjucks/) |
| Go | pongo2 | 6.x | [github.com/flosch/pongo2](https://github.com/flosch/pongo2) |
| Python | Jinja2 | 3.x | [jinja.palletsprojects.com](https://jinja.palletsprojects.com/) (未来支持) |
| PHP | Twig | 3.x | [twig.symfony.com](https://twig.symfony.com/) (未来支持) |

## 兼容性表格

### 基础语法

| 语法 | Nunjucks | pongo2 | 说明 | 推荐 |
|------|---------|--------|------|------|
| `{{ variable }}` | ✅ | ✅ | 变量输出 | ✅ 使用 |
| `{% if condition %}` | ✅ | ✅ | 条件判断 | ✅ 使用 |
| `{% for item in list %}` | ✅ | ✅ | 循环 | ✅ 使用 |
| `{% include 'file.html' %}` | ✅ | ✅ | 包含其他模板 | ✅ 使用 |
| `{% extends 'base.html' %}` | ✅ | ✅ | 模板继承 | ✅ 使用 |
| `{% block name %}` | ✅ | ✅ | 内容块 | ✅ 使用 |
| `{# comment #}` | ✅ | ✅ | 注释 | ✅ 使用 |
| `<!-- comment -->` | ✅ | ✅ | HTML 注释 | ✅ 使用 |

### 变量和过滤器

| 语法 | Nunjucks | pongo2 | 说明 | 推荐 |
|------|---------|--------|------|------|
| `{{ var\|upper }}` | ✅ | ✅ | 大写过滤器 | ✅ 使用 |
| `{{ var\|lower }}` | ✅ | ✅ | 小写过滤器 | ✅ 使用 |
| `{{ var\|default('text') }}` | ✅ | ✅ | 默认值 | ✅ 使用 |
| `{{ var\|length }}` | ✅ | ✅ | 长度 | ✅ 使用 |
| `{{ var\|json }}` | ✅ | ✅ (自定义) | JSON 序列化 | ✅ 使用 |
| `{{ var\|safe }}` | ✅ | ✅ | 禁用转义 | ⚠️ 谨慎使用 |

### 条件语句

| 语法 | Nunjucks | pongo2 | 说明 | 推荐 |
|------|---------|--------|------|------|
| `{% if a == b %}` | ✅ | ✅ | 相等比较 | ✅ 使用 |
| `{% if a != b %}` | ✅ | ✅ | 不等比较 | ✅ 使用 |
| `{% if a > b %}` | ✅ | ✅ | 大于比较 | ✅ 使用 |
| `{% if a and b %}` | ✅ | ✅ | 逻辑与 | ✅ 使用 |
| `{% if a or b %}` | ✅ | ✅ | 逻辑或 | ✅ 使用 |
| `{% if not a %}` | ✅ | ✅ | 逻辑非 | ✅ 使用 |
| `{% elif condition %}` | ✅ | ✅ | Else if | ✅ 使用 |
| `{% else %}` | ✅ | ✅ | Else | ✅ 使用 |

### 循环

| 语法 | Nunjucks | pongo2 | 说明 | 推荐 |
|------|---------|--------|------|------|
| `{% for item in list %}` | ✅ | ✅ | 遍历列表 | ✅ 使用 |
| `{{ loop.index }}` | ✅ | ✅ (`forloop.Counter`) | 循环索引 (从1开始) | ⚠️ 注意变量名 |
| `{{ loop.index0 }}` | ✅ | ✅ (`forloop.Counter0`) | 循环索引 (从0开始) | ⚠️ 注意变量名 |
| `{{ loop.first }}` | ✅ | ✅ (`forloop.First`) | 是否第一项 | ⚠️ 注意变量名 |
| `{{ loop.last }}` | ✅ | ✅ (`forloop.Last`) | 是否最后一项 | ⚠️ 注意变量名 |
| `{% else %}` (在 for 中) | ✅ | ✅ | 列表为空时执行 | ✅ 使用 |

### 赋值和宏

| 语法 | Nunjucks | pongo2 | 说明 | 推荐 |
|------|---------|--------|------|------|
| `{% set var = value %}` | ✅ | ✅ | 变量赋值 | ✅ 使用 |
| `{% macro name(args) %}` | ✅ | ✅ | 宏定义 | ⚠️ 谨慎使用 |
| `{{ macro(args) }}` | ✅ | ✅ | 调用宏 | ⚠️ 谨慎使用 |

## ❌ 不兼容的语法

### 三元表达式

❌ **不推荐** (pongo2 不支持):

```html
<!-- Nunjucks 支持,但 pongo2 不支持 -->
<div class="{{ 'active' if isActive else '' }}">
```

✅ **推荐写法**:

```html
<!-- 方案1: 使用 if/else 块 -->
{% if isActive %}
<div class="active">
{% else %}
<div>
{% endif %}

<!-- 方案2: 使用属性内条件 (需要后端支持传递正确的数据) -->
<div class="{% if isActive %}active{% endif %}">
```

### 内联条件 (属性中)

⚠️ **条件支持,但要注意**:

```html
<!-- ✅ 可以用,但之前有问题 -->
<a class="{% if page.name == item.key %}active{% endif %}">

<!-- ❌ pongo2 不支持三元表达式 -->
<a class="{{ 'active' if condition else '' }}">
```

**重要**: 确保后端传递了正确的 `page.name` 变量!

### 自定义过滤器

⚠️ **需要在各引擎中注册**:

```javascript
// Nunjucks (Node.js)
env.addFilter('json', function(value) {
    return JSON.stringify(value);
});

// pongo2 (Go)
pongo2.RegisterFilter("json", func(in *pongo2.Value, param *pongo2.Value) (*pongo2.Value, *pongo2.Error) {
    jsonBytes, err := json.Marshal(in.Interface())
    if err != nil {
        return nil, &pongo2.Error{Sender: "filter:json", OrigError: err}
    }
    return pongo2.AsValue(string(jsonBytes)), nil
})
```

使用自定义过滤器前,确保所有引擎都已注册!

### 循环变量名差异

⚠️ **变量名不同**:

| 功能 | Nunjucks | pongo2 |
|------|---------|--------|
| 索引 (从1开始) | `loop.index` | `forloop.Counter` |
| 索引 (从0开始) | `loop.index0` | `forloop.Counter0` |
| 是否第一项 | `loop.first` | `forloop.First` |
| 是否最后一项 | `loop.last` | `forloop.Last` |

**解决方案**: 使用时传递索引作为变量而非依赖内置变量。

## 编写兼容模板的最佳实践

### 1. 避免三元表达式

❌ 不要写:
```html
<div class="{{ 'active' if x else '' }}">
```

✅ 改为:
```html
{% if x %}
<div class="active">
{% else %}
<div>
{% endif %}
```

或者 (如果确保 `x` 变量存在):
```html
<div class="{% if x %}active{% endif %}">
```

### 2. 统一循环变量

❌ 不要直接用 `loop` 或 `forloop`:
```html
{% for item in items %}
    <li>第 {{ loop.index }} 项</li>
{% endfor %}
```

✅ 改为传递索引:
```html
{% for item in items %}
    {% set itemIndex = loop.index %}  {# Nunjucks #}
    <li>第 {{ itemIndex }} 项</li>
{% endfor %}
```

或在后端处理索引:
```javascript
// 后端添加索引
const itemsWithIndex = items.map((item, i) => ({ ...item, index: i + 1 }));
```

### 3. 确保变量存在

模板中引用的变量必须在后端传递:

```javascript
// ❌ 错误 - page 可能是 null
ctx := pongo2.Context{
    "page": pageConfig,  // 可能是 nil
}

// ✅ 正确 - 确保 page 有 name 字段
pageObject := map[string]interface{}{}
if pageConfig != nil {
    for k, v := range pageConfig {
        pageObject[k] = v
    }
}
pageObject["name"] = pageName

ctx := pongo2.Context{
    "page": pageObject,
}
```

### 4. 使用通用过滤器

优先使用所有引擎都支持的过滤器:

✅ 通用过滤器:
- `upper`, `lower`, `capitalize`
- `default`, `length`
- `first`, `last`
- `join`, `split` (注意参数差异)

⚠️ 自定义过滤器需要在所有引擎中注册:
- `json` (需要手动注册)
- `safe` (转义控制,注意安全性)

### 5. 注释约定

使用 Jinja2 注释而非 HTML 注释 (避免输出到客户端):

```html
{# 这是模板注释,不会输出到 HTML #}

<!-- 这是 HTML 注释,会输出到客户端 -->
```

## 测试模板兼容性

### 手动测试

启动两个服务器:

```bash
# Node.js
cd servers/nodejs && node server.js --addr :8080

# Go
cd servers/go && go run main.go --addr :8081
```

访问相同页面,对比 HTML 输出:

```bash
curl http://localhost:8080/aliyun/ecs_instances.html > node.html
curl http://localhost:8081/aliyun/ecs_instances.html > go.html

diff node.html go.html
```

### 自动化测试 (未来)

```javascript
// tests/template-compat.test.js
const nodeOutput = await fetch('http://localhost:8080/aliyun/ecs_instances.html');
const goOutput = await fetch('http://localhost:8081/aliyun/ecs_instances.html');

// 规范化 HTML (忽略空白符差异)
const normalize = (html) => html.replace(/\s+/g, ' ').trim();

expect(normalize(nodeOutput)).toBe(normalize(goOutput));
```

## 添加新模板引擎

如果要添加新的模板引擎 (如 Python Jinja2, PHP Twig):

### 1. 实现基础功能

```python
# servers/python/server.py
from jinja2 import Environment, FileSystemLoader

env = Environment(loader=FileSystemLoader('../../sites/aliyun/templates'))

# 注册自定义过滤器
env.filters['json'] = lambda x: json.dumps(x)
```

### 2. 测试兼容性

使用 `tests/template-compat.test.js` 测试套件验证输出一致性。

### 3. 更新文档

在本文档中添加新引擎的兼容性说明。

## 常见问题

### Q: 为什么不统一用一个模板引擎?

A: 这个项目的目标是演示模板的跨语言可移植性。在实际项目中,选择你熟悉的语言/引擎即可。

### Q: 如何知道某个语法是否兼容?

A: 查看本文档的兼容性表格,或在两个服务器上测试相同页面。

### Q: pongo2 为什么不支持三元表达式?

A: pongo2 严格遵循 Django 模板语法,而 Django 不支持三元表达式。Nunjucks 则添加了 JavaScript 风格的扩展。

### Q: 如何报告兼容性问题?

A: 在项目 issue 中提交,标题格式: `[Compat] 语法 X 在引擎 Y 中不工作`

---

**最后更新**: 2025-11-12
