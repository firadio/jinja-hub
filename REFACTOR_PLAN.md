# JS 重构方案 - 简化版

## 问题
- alpine-components.js 有 1876 行，难以维护
- 需要拆分但不想依赖外部构建工具

## 简化方案

### 方案：只拆分，不打包

**保持原有的多文件加载方式，只是把大文件拆小**

```
static/js/
├── core/
│   ├── mixins.js              # 48 行
│   ├── data-table-factory.js  # 290 行
│   └── resource-manage-factory.js  # 338 行
├── components/
│   ├── ecs.js        # ECS 相关 (~200 行)
│   ├── eip.js        # EIP 相关 (~250 行)
│   ├── disk.js       # 云盘相关 (~250 行)
│   ├── vpc.js        # VPC 相关 (~200 行)
│   └── auth.js       # 认证相关 (~400 行)
├── aliyun-api.js     # 保持不变
├── store.js          # 保持不变
├── error-handler.js  # 保持不变
└── dev-tools.js      # 保持不变
```

### base.html 加载顺序

```html
<script src="{{ base_path }}/static/js/error-handler.js"></script>
<script src="{{ base_path }}/static/js/aliyun-api.js"></script>
<script src="{{ base_path }}/static/js/store.js"></script>
<!-- 核心工厂 -->
<script src="{{ base_path }}/static/js/core/mixins.js"></script>
<script src="{{ base_path }}/static/js/core/data-table-factory.js"></script>
<script src="{{ base_path }}/static/js/core/resource-manage-factory.js"></script>
<!-- 业务组件 -->
<script src="{{ base_path }}/static/js/components/ecs.js"></script>
<script src="{{ base_path }}/static/js/components/eip.js"></script>
<script src="{{ base_path }}/static/js/components/disk.js"></script>
<script src="{{ base_path }}/static/js/components/vpc.js"></script>
<script src="{{ base_path }}/static/js/components/auth.js"></script>
<script src="{{ base_path }}/static/js/dev-tools.js"></script>
```

## 优点
- ✅ 无需构建工具
- ✅ 代码模块化，易维护
- ✅ 开发时修改单个文件即可
- ✅ 浏览器缓存更有效（只缓存变化的文件）

## 缺点
- HTTP 请求从 5 个增加到 12 个（可接受，都是小文件）
- 生产环境可以后期再用 CDN 合并

## 实施步骤
1. 手动拆分 alpine-components.js
2. 创建 core/ 和 components/ 目录
3. 更新 base.html 引用
4. 测试所有功能

**无需 Python，无需 Go 打包工具，只是简单的文件拆分！**
