# Jinja Hub 架构说明

## 项目定位

Jinja Hub 是一个**客户端直连云 API 的纯前端应用框架**，不是传统的前后端分离应用。

### 架构模式

```
┌─────────────┐
│   浏览器     │ ← 用户界面
│  (Alpine.js) │
└──────┬──────┘
       │
       ├─→ [HTML] ─→ 模板服务器 (Go/Node.js) ← 仅用于渲染静态 HTML
       │                                      不处理业务逻辑
       │
       └─→ [API]  ─→ 云厂商 API (阿里云/AWS等) ← 真正的后端
                     - 鉴权通过客户端签名
                     - 数据直接返回浏览器
```

### 与传统架构的区别

| 项目 | 传统架构 | Jinja Hub 架构 |
|-----|---------|---------------|
| 后端服务器 | 处理业务逻辑、鉴权、数据库 | **不存在** |
| 模板服务器 | 渲染页面 + 业务逻辑 | **仅渲染静态页面** |
| API 调用 | 浏览器 → 后端 → 云 API | **浏览器 → 云 API** |
| 密钥存储 | 服务器端 | **浏览器 localStorage** |
| 适用场景 | 多用户生产应用 | **个人工具、开发者工具** |

## 目录结构

```
jinja-hub/
├── servers/              # 模板渲染服务器 (未来可改名 generators/)
│   ├── nodejs/          # Node.js + Nunjucks 实现
│   └── go/              # Go + pongo2 实现
│
├── sites/               # 站点定义
│   ├── _home/          # 平台首页
│   ├── aliyun/         # 阿里云管理站点
│   │   ├── config.json       # 站点配置
│   │   ├── templates/        # Jinja2 模板
│   │   └── static/
│   │       ├── css/         # 样式
│   │       └── js/
│   │           ├── aliyun-api.js        # 阿里云 API 客户端
│   │           ├── auth.js              # 认证逻辑 (已废弃)
│   │           ├── alpine-components.js  # Alpine.js 组件
│   │           └── store.js             # 状态管理 (新)
│   │
│   └── sites.json      # 站点注册表
│
└── docs/
    └── ARCHITECTURE.md  # 本文件
```

## 核心组件

### 1. 模板服务器

**职责**: 仅负责渲染 HTML，不处理任何业务逻辑

**支持的模板引擎**:
- Node.js: Nunjucks (Jinja2 兼容)
- Go: pongo2 (Jinja2/Django 兼容)

**兼容性注意事项**:
- ✅ 支持: `{% if %}...{% endif %}`、`{% for %}`、`{{ variable }}`
- ❌ 不支持 (pongo2): 三元表达式 `{{ 'a' if x else 'b' }}`
- 📖 详见: [模板语法兼容性文档](./docs/TEMPLATE_COMPATIBILITY.md)

**API 端点**:
```
GET  /                        # 平台首页
GET  /{site}/                 # 站点首页
GET  /{site}/{page}.html      # 站点页面
GET  /{site}/static/*         # 静态资源
GET  /{site}/api/config       # 站点配置 (JSON)
```

### 2. 前端应用 (浏览器)

**技术栈**:
- **Alpine.js**: 轻量级响应式框架 (~15KB)
- **localStorage**: 持久化存储 (密钥、缓存)
- **Fetch API**: 调用云厂商 API
- **Web Crypto API**: HMAC-SHA1 签名

**状态管理** (`store.js`):
```javascript
window.appStore = {
    storage: StorageManager,    // localStorage 封装
    cache: CacheManager,         // 缓存管理 (带过期)
    keys: KeyManager,            // 密钥管理
    regions: RegionManager       // 区域列表管理
}
```

**组件架构** (`alpine-components.js`):
```javascript
// Mixin 模式 - 共享逻辑
function regionMixin() { ... }

// 页面组件
function ecsInstances() {
    return {
        ...regionMixin(),  // 复用区域加载逻辑
        instances: [],
        async init() { ... },
        async loadInstances() { ... }
    }
}
```

### 3. 云 API 客户端

**示例**: `aliyun-api.js`

```javascript
// 客户端签名 + 直连调用
async function AliyunApi(params, accessKeyId, accessKeySecret) {
    const signature = await generateSignature(params, accessKeySecret);
    const response = await fetch(aliyunEndpoint + '?' + queryString);
    return await response.json();
}

// 使用示例
const instances = await DescribeInstances(regionId, accessKeyId, accessKeySecret);
```

**安全性说明**:
- ⚠️ AccessKeySecret 存储在浏览器 localStorage
- 🔒 适用于个人工具、受信任环境
- 🚫 **不适合**多用户生产环境 (用户可通过 DevTools 看到密钥)

## 数据流

### 页面加载流程

```
1. 浏览器请求: GET /aliyun/ecs_instances.html
   ↓
2. 模板服务器:
   - 读取 sites/aliyun/config.json
   - 渲染 templates/pages/ecs_instances.html
   - 注入配置到模板变量
   ↓
3. 返回 HTML + Alpine.js 组件代码
   ↓
4. 浏览器执行:
   - Alpine.js 初始化 ecsInstances() 组件
   - 从 localStorage 读取当前密钥
   - 调用 DescribeInstances API
   - 渲染实例列表
```

### API 调用流程

```
1. 组件触发: loadInstances()
   ↓
2. 获取密钥: appStore.keys.getCurrentKey()
   ↓
3. 生成签名: HMAC-SHA1(params, secret)
   ↓
4. 发起请求: fetch('https://ecs.aliyuncs.com/?...')
   ↓
5. 阿里云验证签名并返回数据
   ↓
6. 更新组件状态: this.instances = response.Instances
   ↓
7. Alpine.js 自动更新 DOM
```

## 缓存策略

### localStorage 数据

| 键 | 内容 | 过期时间 |
|----|------|---------|
| `aliyun_access_keys` | 密钥列表 | 永久 |
| `aliyun_current_key_id` | 当前密钥索引 | 永久 |
| `aliyun_default_region` | 默认区域 | 永久 |
| `aliyun_cache_regions` | 区域列表缓存 | 24 小时 |

### 缓存管理

```javascript
// 自动过期检查
const regions = await appStore.regions.load(keyId, keySecret);
// 如果缓存未过期,直接返回
// 如果已过期,重新调用 API 并更新缓存

// 手动清除
appStore.cache.clear();
appStore.regions.clearCache();
```

## 扩展指南

### 添加新的云平台

1. 创建站点目录:
```bash
mkdir -p sites/aws/{templates,static/js,static/css}
```

2. 创建配置文件 `sites/aws/config.json`:
```json
{
  "site": {
    "title": "AWS 管理控制台",
    "description": "AWS 资源管理"
  },
  "pages": {
    "ec2_instances": {
      "title": "EC2 实例",
      "order": 1,
      "nav": "EC2 实例"
    }
  }
}
```

3. 实现 API 客户端 `sites/aws/static/js/aws-api.js`:
```javascript
async function AwsApi(action, params, accessKey, secretKey) {
    // AWS Signature Version 4 签名
    const signature = await generateAwsSignature(...);
    const response = await fetch(awsEndpoint, { ... });
    return response.json();
}
```

4. 创建 Alpine.js 组件 `sites/aws/static/js/alpine-components.js`

5. 注册站点到 `sites/sites.json`:
```json
{
  "sites": {
    "aws": {
      "name": "AWS",
      "enabled": true,
      "order": 2
    }
  }
}
```

### 添加新页面

在现有站点添加新页面:

1. 更新 `config.json`:
```json
{
  "pages": {
    "new_page": {
      "title": "新功能",
      "order": 10,
      "nav": "新功能"
    }
  }
}
```

2. 创建模板 `templates/pages/new_page.html`:
```html
{% extends "layouts/base.html" %}

{% block content %}
<main x-data="newPageComponent()">
  <!-- 页面内容 -->
</main>
{% endblock %}
```

3. 添加组件到 `alpine-components.js`:
```javascript
function newPageComponent() {
    return {
        data: [],
        async init() {
            await this.loadData();
        },
        async loadData() {
            const key = appStore.keys.getCurrentKey();
            this.data = await SomeApi(key.accessKeyId, key.accessKeySecret);
        }
    }
}
```

## 性能优化

### 已实现

1. ✅ **区域列表缓存**: 24 小时 localStorage 缓存
2. ✅ **Alpine.js 懒加载**: 仅在需要时加载组件
3. ✅ **模板缓存**: 服务器端模板编译缓存 (开发模式禁用)

### 可改进

1. **分页加载**: 大列表使用虚拟滚动
2. **Service Worker**: 离线支持
3. **资源预加载**: `<link rel="prefetch">`
4. **CDN**: 静态资源使用 CDN 加速

## 安全考虑

### 当前模式的安全性

✅ **适用场景**:
- 个人开发工具
- 企业内网环境
- 本地运行 (localhost)
- 受信任的用户

❌ **不适用场景**:
- 多用户 SaaS 应用
- 公网暴露的服务
- 不受信任的环境

### 安全最佳实践

1. **HTTPS**: 生产环境必须使用 HTTPS
2. **CSP**: 配置 Content-Security-Policy 头
3. **子资源完整性**: CDN 资源使用 SRI
4. **定期清理**: 提醒用户定期更换 AccessKey

### 升级到后端鉴权

如果需要多用户支持,应该创建新项目:

```
jinja-hub-server/
├── backend/
│   ├── api/           # 代理云 API 调用
│   ├── auth/          # 用户认证
│   └── db/            # 密钥加密存储
└── frontend/          # 调用后端 API
```

架构变为:
```
浏览器 → [JWT Token] → 后端服务器 → [云 API]
```

## 测试策略

### 单元测试

```javascript
// tests/store.test.js
import { StorageManager } from '../sites/aliyun/static/js/store.js';

test('StorageManager should handle expiration', () => {
    const storage = new StorageManager();
    storage.set('test', 'value', 100); // 100ms 过期

    expect(storage.get('test')).toBe('value');

    setTimeout(() => {
        expect(storage.get('test')).toBe(null);
    }, 150);
});
```

### 集成测试

```javascript
// tests/integration/navigation.test.js
test('Navigation highlights current page', async () => {
    const nodeHtml = await fetch('http://localhost:8080/aliyun/ecs_instances.html');
    const goHtml = await fetch('http://localhost:8081/aliyun/ecs_instances.html');

    expect(nodeHtml).toContain('class="active"');
    expect(goHtml).toContain('class="active"');
});
```

### E2E 测试

```javascript
// tests/e2e/login.spec.js
import { test, expect } from '@playwright/test';

test('User can login with AccessKey', async ({ page }) => {
    await page.goto('http://localhost:8080/aliyun/');

    await page.fill('[x-model="form.accessKeyId"]', 'TEST_KEY_ID');
    await page.fill('[x-model="form.accessKeySecret"]', 'TEST_KEY_SECRET');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/ecs_instances/);
});
```

## 常见问题

### Q: 为什么不用 React/Vue?

A: Alpine.js 只有 15KB,无需构建步骤,完美适配服务端渲染的模板。

### Q: 密钥存在浏览器安全吗?

A: 仅适用于个人工具。多用户应用需要后端代理 API 调用。

### Q: 如何切换不同的模板服务器?

A: Go 和 Node.js 服务器完全等价,渲染结果一致。选择你熟悉的语言即可。

### Q: 能否添加其他云平台?

A: 可以!参考 `sites/aliyun` 结构,实现对应的 API 客户端即可。

### Q: 如何备份密钥?

A: 使用导出功能:
```javascript
const backup = appStore.exportData();
console.log(JSON.stringify(backup));

// 恢复
appStore.importData(backup);
```

## 贡献指南

1. 创建新站点遵循 `sites/aliyun` 的目录结构
2. 模板语法使用 Jinja2 通用子集 (避免引擎特定语法)
3. Alpine.js 组件使用 Composition API 风格
4. 提交前运行: `npm test` (如果有测试)

## 许可证

[待定]

## 维护者

[待定]

---

**最后更新**: 2025-11-12
