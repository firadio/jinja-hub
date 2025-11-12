// Alpine.js 组件定义

// 通用表格组件工厂函数
function createDataTable(tableKey) {
    const tableConfig = window.APP_CONFIG?.tables?.[tableKey];
    if (!tableConfig) {
        console.error(`Table config not found: ${tableKey}`);
        return {};
    }

    return {
        ...regionMixin(),
        config: tableConfig,
        dataItems: [],
        loading: false,
        error: '',
        currentPage: 1,
        pageSize: 10,
        totalCount: 0,
        regionId: '',
        filters: {},

        // 计算属性：筛选字段
        get filterFields() {
            return tableConfig.fields?.filter(f => f.showInFilter) || [];
        },

        // 计算属性：表格字段
        get tableFields() {
            return tableConfig.fields?.filter(f => f.showInTable) || [];
        },

        // 初始化筛选字段
        initFilters() {
            if (tableConfig.fields) {
                tableConfig.fields.forEach(field => {
                    if (field.showInFilter && field.filterField) {
                        this.filters[field.filterField] = '';
                    }
                });
            }
        },

        get totalPages() {
            return Math.ceil(this.totalCount / this.pageSize);
        },

        get startItem() {
            return (this.currentPage - 1) * this.pageSize + 1;
        },

        get endItem() {
            return Math.min(this.currentPage * this.pageSize, this.totalCount);
        },

        async init() {
            this.initFilters();

            // 从 URL hash 参数读取状态
            const hash = window.location.hash.substring(1);
            const urlParams = new URLSearchParams(hash);

            // 读取地域
            this.regionId = urlParams.get('regionId') || window.appStore.keys.getDefaultRegion() || 'cn-hangzhou';

            // 读取分页参数
            const page = urlParams.get('page');
            if (page) this.currentPage = parseInt(page);

            const pageSize = urlParams.get('pageSize');
            if (pageSize) this.pageSize = parseInt(pageSize);

            // 读取搜索条件
            if (tableConfig.fields) {
                tableConfig.fields.forEach(field => {
                    if (field.showInFilter && field.filterField) {
                        const value = urlParams.get(field.filterField);
                        if (value) this.filters[field.filterField] = value;
                    }
                });
            }

            await this.loadRegions();
            await this.loadData(this.currentPage);
        },

        // 更新 URL hash 参数
        updateUrl() {
            const params = new URLSearchParams();
            params.set('regionId', this.regionId);

            if (this.currentPage > 1) {
                params.set('page', this.currentPage.toString());
            }
            if (this.pageSize !== 10) {
                params.set('pageSize', this.pageSize.toString());
            }

            // 添加搜索条件
            if (tableConfig.fields) {
                tableConfig.fields.forEach(field => {
                    if (field.showInFilter && field.filterField && this.filters[field.filterField]) {
                        params.set(field.filterField, this.filters[field.filterField]);
                    }
                });
            }

            const basePath = window.APP_CONFIG?.base_path || '';
            const currentPath = window.location.pathname.split('/').pop();
            const newUrl = `${basePath}/${currentPath}#${params.toString()}`;
            window.history.pushState({}, '', newUrl);
        },

        async loadData(page = 1) {
            this.loading = true;
            this.error = '';
            this.currentPage = page;

            this.updateUrl();

            try {
                const currentKey = window.appStore.keys.getCurrentKey();

                if (!currentKey) {
                    this.error = '请先登录';
                    return;
                }

                // 构建搜索过滤参数
                const searchFilters = {};
                if (tableConfig.fields) {
                    tableConfig.fields.forEach(field => {
                        if (field.showInFilter && field.filterField && this.filters[field.filterField]) {
                            searchFilters[field.filterField] = this.filters[field.filterField];
                        }
                    });
                }

                // 调用 API 函数
                const apiFunction = window[tableConfig.apiFunction];
                if (!apiFunction) {
                    this.error = `API function not found: ${tableConfig.apiFunction}`;
                    return;
                }

                const data = await apiFunction(
                    this.regionId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret,
                    this.currentPage,
                    this.pageSize,
                    searchFilters
                );

                if (data.Code) {
                    this.error = data.Message || '加载失败';
                    return;
                }

                // 根据配置的数据路径提取数据
                const dataPath = tableConfig.dataPath.split('.');
                let items = data;
                for (const key of dataPath) {
                    items = items?.[key];
                }

                this.dataItems = items || [];
                this.totalCount = data.TotalCount || 0;

                console.log('Data loaded:', {
                    items: this.dataItems.length,
                    totalCount: this.totalCount,
                    pageSize: this.pageSize,
                    totalPages: this.totalPages,
                    currentPage: this.currentPage,
                    calculation: `Math.ceil(${this.totalCount} / ${this.pageSize}) = ${Math.ceil(this.totalCount / this.pageSize)}`
                });
            } catch (error) {
                this.error = error.message || '加载失败';
            } finally {
                this.loading = false;
            }
        },

        async search() {
            await this.loadData(1);
        },

        async changeRegion() {
            window.appStore.keys.setDefaultRegion(this.regionId);
            await this.loadData(1);
        },

        async changePageSize() {
            await this.loadData(1);
        },

        async prevPage() {
            if (this.currentPage > 1) {
                await this.loadData(this.currentPage - 1);
            }
        },

        async nextPage() {
            if (this.currentPage < this.totalPages) {
                await this.loadData(this.currentPage + 1);
            }
        },

        // 获取列值
        getColumnValue(item, field) {
            const fieldPath = field.field.replace(/\[(\d+)\]/g, '.$1').split('.');
            let value = item;

            for (const key of fieldPath) {
                value = value?.[key];
                if (value === undefined || value === null) break;
            }

            // 处理特殊类型
            if (value === undefined || value === null || value === '') {
                return field.defaultValue || '-';
            }

            // 处理时间类型
            if (field.columnType === 'datetime') {
                return this.formatTime(value);
            }

            // 处理后缀
            if (field.suffix) {
                return `${value}${field.suffix}`;
            }

            // 处理 badge 类型
            if (field.columnType === 'badge') {
                const statusInfo = this.formatStatus(value);
                return `<div class="badge ${this.getBadgeClass(statusInfo.class)}">${statusInfo.text}</div>`;
            }

            return value;
        },

        getBadgeClass(statusClass) {
            const classMap = {
                'running': 'badge-success',
                'stopped': 'badge-error',
                'starting': 'badge-warning',
                'stopping': 'badge-warning',
                'available': 'badge-info',
                'inuse': 'badge-success',
                'associating': 'badge-warning',
                'pending': 'badge-warning'
            };
            return classMap[statusClass] || 'badge-ghost';
        },

        formatStatus(status) {
            const statusMap = {
                // ECS 状态
                'Running': { text: '运行中', class: 'running' },
                'Stopped': { text: '已停止', class: 'stopped' },
                'Starting': { text: '启动中', class: 'starting' },
                'Stopping': { text: '停止中', class: 'stopping' },
                // EIP 状态
                'Available': { text: '可用', class: 'available' },
                'InUse': { text: '使用中', class: 'inuse' },
                'Associating': { text: '绑定中', class: 'associating' },
                // VPC/VSwitch 状态
                'Pending': { text: '创建中', class: 'pending' }
            };
            return statusMap[status] || { text: status, class: 'unknown' };
        },

        formatTime(timeStr) {
            if (!timeStr) return '-';
            const date = new Date(timeStr);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };
}

// 通用表格组件包装函数（用于向后兼容）
function dataTable() {
    // 从当前页面路径推断表格配置 key
    const pathname = window.location.pathname;
    const pageMatch = pathname.match(/\/([^/]+)\.html$/);
    const tableKey = pageMatch ? pageMatch[1] : 'ecs_instances';
    return createDataTable(tableKey);
}

// 通用资源管理组件工厂函数
function createResourceManage(resourceKey) {
    const manageConfig = window.APP_CONFIG?.resource_manage?.[resourceKey];
    if (!manageConfig) {
        console.error(`Resource manage config not found: ${resourceKey}`);
        return {};
    }

    return {
        config: manageConfig,
        resource: null,
        resourceId: '',
        regionId: '',
        loading: true,
        error: '',
        operating: false,
        showRenameForm: false,
        isEmbedMode: false,
        renameForm: {
            name: ''
        },

        // 计算属性：可见的操作按钮
        get visibleActions() {
            if (!this.resource) return [];
            return manageConfig.actions.filter(action => {
                try {
                    if (action.showWhen === 'true') return true;

                    // 创建一个安全的评估环境，只包含 resource 的属性
                    const evalFunction = new Function('resource', `return ${action.showWhen}`);
                    return evalFunction(this.resource);
                } catch (e) {
                    console.error('Error evaluating showWhen:', action.showWhen, e);
                    return true;
                }
            });
        },

        async init() {
            // 从 URL hash 参数中读取参数
            const hash = window.location.hash.substring(1);
            const urlParams = new URLSearchParams(hash);

            // 尝试多种参数名称格式
            const idFieldLower = manageConfig.idField.toLowerCase();
            const idFieldCamel = manageConfig.idField.charAt(0).toLowerCase() + manageConfig.idField.slice(1);
            this.resourceId = urlParams.get(idFieldCamel) || urlParams.get(idFieldLower) || urlParams.get(manageConfig.idField) || urlParams.get('instanceId');
            this.regionId = urlParams.get('regionId');
            this.isEmbedMode = urlParams.get('embed') === 'true';

            if (!this.resourceId || !this.regionId) {
                this.error = '缺少必要参数';
                this.loading = false;
                return;
            }

            await this.loadResource();
        },

        async loadResource() {
            this.loading = true;
            this.error = '';

            try {
                const currentKey = window.appStore.keys.getCurrentKey();
                if (!currentKey) {
                    this.error = '请先登录';
                    this.loading = false;
                    return;
                }

                const apiFunction = window[manageConfig.apiGetFunction];
                if (!apiFunction) {
                    this.error = `API function not found: ${manageConfig.apiGetFunction}`;
                    this.loading = false;
                    return;
                }

                // 根据资源类型构建查询参数
                const queryParams = {};
                if (manageConfig.idField === 'InstanceId') {
                    queryParams.instanceIds = [this.resourceId];
                } else if (manageConfig.idField === 'AllocationId') {
                    queryParams.allocationId = this.resourceId;
                }

                const data = await apiFunction(
                    this.regionId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret,
                    1,
                    1,
                    queryParams
                );

                if (data.Code) {
                    this.error = data.Message || '加载失败';
                    this.loading = false;
                    return;
                }

                const dataPath = manageConfig.apiGetDataPath.split('.');
                let items = data;
                for (const key of dataPath) {
                    items = items?.[key];
                }

                const resources = items || [];
                if (resources.length === 0) {
                    this.error = '资源不存在';
                    this.loading = false;
                    return;
                }

                this.resource = resources[0];
                this.renameForm.name = this.getFieldValue(this.resource, {field: manageConfig.nameField}) || '';
            } catch (error) {
                this.error = error.message || '加载失败';
            } finally {
                this.loading = false;
            }
        },

        // 获取字段值
        getFieldValue(resource, field) {
            const fieldPath = field.field.replace(/\[(\d+)\]/g, '.$1').split('.');
            let value = resource;

            for (const key of fieldPath) {
                value = value?.[key];
                if (value === undefined || value === null) break;
            }

            if (value === undefined || value === null || value === '') {
                return field.defaultValue || '-';
            }

            return value;
        },

        // 获取详细字段值（支持后缀、格式化等）
        getDetailFieldValue(resource, field) {
            let value = this.getFieldValue(resource, field);

            // 使用 fallback 字段
            if ((value === '-' || !value) && field.fallback) {
                value = this.getFieldValue(resource, {field: field.fallback}) || '-';
            }

            // 应用格式化器
            if (field.formatter) {
                if (field.formatter === 'memory') {
                    value = `${value / 1024} GB`;
                } else if (field.formatter === 'boolean') {
                    return value === true ? '已开启' : '未开启';
                }
            }

            // 时间类型
            if (field.type === 'datetime') {
                return this.formatTime(value);
            }

            // 后缀
            if (field.suffix && value !== '-') {
                return `${value}${field.suffix}`;
            }

            return value;
        },

        formatStatus(status) {
            const statusMap = {
                'Running': { text: '运行中', class: 'running' },
                'Stopped': { text: '已停止', class: 'stopped' },
                'Starting': { text: '启动中', class: 'starting' },
                'Stopping': { text: '停止中', class: 'stopping' }
            };
            return statusMap[status] || { text: status, class: 'unknown' };
        },

        formatTime(timeStr) {
            if (!timeStr || timeStr === '-') return '-';
            return new Date(timeStr).toLocaleString('zh-CN');
        },

        // 处理操作按钮点击
        async handleAction(action) {
            if (action.type === 'form') {
                // 显示表单类型的操作（如重命名）
                if (action.name === 'rename') {
                    this.showRenameForm = !this.showRenameForm;
                }
                return;
            }

            if (action.type === 'custom') {
                // 自定义操作（如VNC）
                if (action.name === 'vnc') {
                    await this.openVnc();
                }
                return;
            }

            // API 操作
            if (action.confirmMessage && !confirm(action.confirmMessage)) {
                return;
            }

            await this.executeAction(action);
        },

        // 执行API操作
        async executeAction(action) {
            if (this.operating) return;
            this.operating = true;

            try {
                const currentKey = window.appStore.keys.getCurrentKey();
                const apiFunction = window[action.apiFunction];

                if (!apiFunction) {
                    alert(`API function not found: ${action.apiFunction}`);
                    return;
                }

                const result = await apiFunction(
                    this.regionId,
                    this.resourceId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret
                );

                if (result.Code) {
                    alert(`操作失败：${result.Message}`);
                } else {
                    alert(`${action.label}指令已发送`);

                    // 特殊处理：释放操作成功后
                    if (action.name === 'release') {
                        if (this.isEmbedMode) {
                            // iframe 嵌入模式：通知父窗口关闭模态框并刷新列表
                            if (window.parent && window.parent !== window) {
                                // 通知父窗口
                                window.parent.postMessage({ type: 'closeModal', reason: 'released' }, '*');
                            }
                        } else {
                            // 独立页面模式：跳转回列表页
                            const basePath = window.APP_CONFIG?.base_path || '';
                            const listPageMap = {
                                'eip': 'eip_list.html',
                                'ecs_instance': 'ecs_instances.html'
                            };
                            const listPage = listPageMap[manageConfig.idField.includes('Allocation') ? 'eip' : 'ecs_instance'];
                            if (listPage) {
                                window.location.href = `${basePath}/${listPage}`;
                            }
                        }
                        return;
                    }

                    await this.loadResource();
                }
            } catch (error) {
                alert(`操作失败：${error.message}`);
            } finally {
                this.operating = false;
            }
        },

        // 保存重命名
        async saveRename() {
            if (!this.renameForm.name.trim()) {
                alert('请输入名称');
                return;
            }

            try {
                const currentKey = window.appStore.keys.getCurrentKey();
                const apiFunction = window[manageConfig.renameConfig.apiFunction];

                if (!apiFunction) {
                    alert(`API function not found: ${manageConfig.renameConfig.apiFunction}`);
                    return;
                }

                const result = await apiFunction(
                    this.regionId,
                    this.resourceId,
                    this.renameForm.name,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret
                );

                if (result.Code) {
                    alert(`修改失败：${result.Message}`);
                } else {
                    alert('修改成功');
                    this.showRenameForm = false;
                    await this.loadResource();
                }
            } catch (error) {
                alert(`修改失败：${error.message}`);
            }
        },

        // VNC 连接（ECS专用）
        async openVnc() {
            try {
                const currentKey = window.appStore.keys.getCurrentKey();
                const result = await DescribeInstanceVncUrl(
                    this.regionId,
                    this.resourceId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret
                );

                if (result.Code) {
                    alert(`获取 VNC 连接失败：${result.Message}`);
                } else {
                    const isWindows = this.resource.OSType === 'windows' ||
                                     (this.resource.OSName && this.resource.OSName.toLowerCase().includes('windows'));

                    const vncUrl = encodeURIComponent(result.VncUrl);
                    const consoleUrl = `https://g.alicdn.com/aliyun/ecs-console-vnc2/0.0.8/index.html?vncUrl=${vncUrl}&instanceId=${this.resourceId}&isWindows=${isWindows}`;

                    window.open(consoleUrl, '_blank', 'width=1024,height=768');
                }
            } catch (error) {
                alert(`获取 VNC 连接失败：${error.message}`);
            }
        }
    };
}

// ECS 实例管理组件
function ecsManage() {
    return createResourceManage('ecs_instance');
}

// EIP 管理组件
function eipManage() {
    return createResourceManage('eip');
}

// EIP 申请组件
function eipAllocate() {
    return {
        ...regionMixin(),
        form: {
            regionId: '',
            name: '',
            bandwidth: 5,
            internetChargeType: 'PayByTraffic',
            isp: 'BGP',
            description: ''
        },
        loading: false,
        error: '',
        success: false,
        allocatedEip: {
            eipAddress: '',
            allocationId: ''
        },

        async init() {
            // 从 URL hash 参数读取地域，如果没有则使用默认地域
            const hash = window.location.hash.substring(1);
            const urlParams = new URLSearchParams(hash);
            const regionFromUrl = urlParams.get('regionId');
            const defaultRegion = window.appStore.keys.getDefaultRegion() || 'cn-hangzhou';

            // 先设置地域ID
            this.form.regionId = regionFromUrl || defaultRegion;

            console.log('EIP Allocate Init - RegionId from URL:', regionFromUrl);
            console.log('EIP Allocate Init - Default Region:', defaultRegion);
            console.log('EIP Allocate Init - Final RegionId:', this.form.regionId);

            // 加载地域列表
            await this.loadRegions();
        },

        async submitForm() {
            this.loading = true;
            this.error = '';
            this.success = false;

            try {
                const currentKey = window.appStore.keys.getCurrentKey();
                if (!currentKey) {
                    this.error = '请先登录';
                    this.loading = false;
                    return;
                }

                // 构建请求参数
                const options = {};
                if (this.form.name) options.name = this.form.name;
                if (this.form.bandwidth) options.bandwidth = this.form.bandwidth;
                if (this.form.internetChargeType) options.internetChargeType = this.form.internetChargeType;
                if (this.form.isp) options.isp = this.form.isp;
                if (this.form.description) options.description = this.form.description;

                const result = await AllocateEipAddress(
                    this.form.regionId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret,
                    options
                );

                if (result.Code) {
                    this.error = `申请失败：${result.Message}`;
                } else {
                    this.success = true;
                    this.allocatedEip.eipAddress = result.EipAddress;
                    this.allocatedEip.allocationId = result.AllocationId;

                    // 3秒后跳转到列表页
                    setTimeout(() => {
                        this.goBack();
                    }, 3000);
                }
            } catch (error) {
                this.error = `申请失败：${error.message}`;
            } finally {
                this.loading = false;
            }
        },

        goBack() {
            const basePath = window.APP_CONFIG?.base_path || '';
            window.location.href = `${basePath}/eip_list.html`;
        }
    };
}

// 开启 EIP 删除保护的封装函数
async function EnableEipDeletionProtection(regionId, allocationId, accessKeyId, accessKeySecret) {
    return await SetEipDeletionProtection(regionId, allocationId, true, accessKeyId, accessKeySecret);
}

// 关闭 EIP 删除保护的封装函数
async function DisableEipDeletionProtection(regionId, allocationId, accessKeyId, accessKeySecret) {
    return await SetEipDeletionProtection(regionId, allocationId, false, accessKeyId, accessKeySecret);
}

// ECS 实例表格组件（带管理功能）
function ecsInstancesTable() {
    const base = createDataTable('ecs_instances');

    return {
        ...base,
        // ECS 专用状态
        currentInstance: null,
        showManageModal: false,

        // 初始化时添加消息监听
        init() {
            base.init.call(this);

            // 监听来自 iframe 的消息
            window.addEventListener('message', (event) => {
                if (event.data.type === 'closeModal') {
                    this.closeManageModal();
                }
            });
        },

        // 操作按钮处理
        handleAction(instance) {
            this.openManageModal(instance);
        },

        // 打开管理模态框
        openManageModal(instance) {
            const isMobile = window.innerWidth < 1024;

            if (isMobile) {
                const basePath = window.APP_CONFIG?.base_path || '';
                window.location.href = `${basePath}/ecs_manage.html#instanceId=${instance.InstanceId}&regionId=${this.regionId}`;
            } else {
                this.currentInstance = instance;
                this.showManageModal = true;
            }
        },

        closeManageModal() {
            this.showManageModal = false;
            this.currentInstance = null;
            this.loadData(this.currentPage);
        },

        // 重新定义 getter 以修复展开操作符问题
        get totalPages() {
            return Math.ceil(this.totalCount / this.pageSize);
        },

        get startItem() {
            return (this.currentPage - 1) * this.pageSize + 1;
        },

        get endItem() {
            return Math.min(this.currentPage * this.pageSize, this.totalCount);
        },

        get filterFields() {
            const tableConfig = window.APP_CONFIG?.tables?.ecs_instances;
            return tableConfig?.fields?.filter(f => f.showInFilter) || [];
        },

        get tableFields() {
            const tableConfig = window.APP_CONFIG?.tables?.ecs_instances;
            return tableConfig?.fields?.filter(f => f.showInTable) || [];
        }
    };
}

// VPC 表格组件
function vpcListTable() {
    return createDataTable('vpc_list');
}

// VSwitch 表格组件
function vswitchListTable() {
    return createDataTable('vswitch_list');
}

// EIP 表格组件（带管理功能）
function eipListTable() {
    const base = createDataTable('eip_list');

    return {
        ...base,
        // EIP 专用状态
        currentEip: null,
        showManageModal: false,

        // 初始化时添加消息监听
        init() {
            base.init.call(this);

            // 监听来自 iframe 的消息
            window.addEventListener('message', (event) => {
                if (event.data.type === 'closeModal') {
                    this.closeManageModal();
                }
            });
        },

        // 行操作按钮处理
        handleAction(eip) {
            this.openManageModal(eip);
        },

        // 表格级别操作处理
        handleTableAction(action) {
            if (action.type === 'navigate') {
                const basePath = window.APP_CONFIG?.base_path || '';
                // 如果是申请EIP，带上当前地域参数
                if (action.name === 'allocate' && this.regionId) {
                    window.location.href = `${basePath}${action.url}#regionId=${this.regionId}`;
                } else {
                    window.location.href = `${basePath}${action.url}`;
                }
            }
        },

        // 打开管理模态框
        openManageModal(eip) {
            const isMobile = window.innerWidth < 1024;

            if (isMobile) {
                const basePath = window.APP_CONFIG?.base_path || '';
                window.location.href = `${basePath}/eip_manage.html#allocationId=${eip.AllocationId}&regionId=${this.regionId}`;
            } else {
                this.currentEip = eip;
                this.showManageModal = true;
            }
        },

        closeManageModal() {
            this.showManageModal = false;
            this.currentEip = null;
            this.loadData(this.currentPage);
        },

        // 重新定义 getter 以修复展开操作符问题
        get totalPages() {
            return Math.ceil(this.totalCount / this.pageSize);
        },

        get startItem() {
            return (this.currentPage - 1) * this.pageSize + 1;
        },

        get endItem() {
            return Math.min(this.currentPage * this.pageSize, this.totalCount);
        },

        get filterFields() {
            const tableConfig = window.APP_CONFIG?.tables?.eip_list;
            return tableConfig?.fields?.filter(f => f.showInFilter) || [];
        },

        get tableFields() {
            const tableConfig = window.APP_CONFIG?.tables?.eip_list;
            return tableConfig?.fields?.filter(f => f.showInTable) || [];
        }
    };
}

// 通用地域加载 Mixin
function regionMixin() {
    return {
        regions: [],
        regionsLoading: false,

        async loadRegions() {
            if (this.regionsLoading || this.regions.length > 0) return;

            this.regionsLoading = true;
            try {
                const currentKey = window.appStore.keys.getCurrentKey();

                if (!currentKey) {
                    // 未登录时使用默认地域列表
                    this.regions = [{ id: 'cn-hangzhou', name: '华东1(杭州)' }];
                    if (!this.regionId) {
                        this.regionId = this.regions[0].id;
                    }
                    return;
                }

                // 使用新的 RegionManager 加载地域列表
                const regions = await window.appStore.regions.load(
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret
                );

                this.regions = regions;

                // 确保regionId有效
                if (this.regions.length > 0) {
                    if (!this.regionId || !this.regions.find(r => r.id === this.regionId)) {
                        this.regionId = this.regions[0].id;
                    }
                }
            } catch (e) {
                console.error('Failed to load regions:', e);
                this.regions = [{ id: 'cn-hangzhou', name: '华东1(杭州)' }];
                if (!this.regionId) {
                    this.regionId = this.regions[0].id;
                }
            } finally {
                this.regionsLoading = false;
            }
        }
    };
}

// 密钥管理器组件
function keyManager() {
    return {
        keys: [],
        currentKeyId: null,
        showModal: false,
        showEditModal: false,
        editingIndex: -1,
        editForm: {
            name: '',
            accessKeyId: '',
            accessKeySecret: ''
        },
        addForm: {
            name: '',
            accessKeyId: '',
            accessKeySecret: ''
        },

        init() {
            this.keys = window.appStore.keys.getKeys();
            this.currentKeyId = window.appStore.keys.getCurrentKeyId();
        },

        openModal() {
            this.showModal = true;
        },

        closeModal() {
            this.showModal = false;
        },

        addKey() {
            const result = window.appStore.keys.addKey(this.addForm);

            if (!result.success) {
                alert(result.message);
                return;
            }

            this.addForm = {
                name: '',
                accessKeyId: '',
                accessKeySecret: ''
            };

            this.keys = window.appStore.keys.getKeys();
            this.currentKeyId = window.appStore.keys.getCurrentKeyId();
        },

        switchKey(index) {
            if (window.appStore.keys.switchKey(index)) {
                location.reload();
            }
        },

        deleteKey(index) {
            const key = this.keys[index];
            if (!confirm(`确定要删除密钥 "${key.name}" 吗？`)) {
                return;
            }

            if (window.appStore.keys.deleteKey(index)) {
                this.keys = window.appStore.keys.getKeys();
                this.currentKeyId = window.appStore.keys.getCurrentKeyId();

                const basePath = window.APP_CONFIG?.base_path || '';
                if (this.keys.length === 0) {
                    window.location.href = `${basePath}/login.html`;
                }
            }
        },

        openEditModal(index) {
            const key = this.keys[index];
            this.editingIndex = index;
            this.editForm = {
                name: key.name,
                accessKeyId: key.accessKeyId,
                accessKeySecret: key.accessKeySecret
            };
            this.showEditModal = true;
        },

        closeEditModal() {
            this.showEditModal = false;
            this.editingIndex = -1;
        },

        saveEdit() {
            if (window.appStore.keys.updateKey(this.editingIndex, this.editForm)) {
                this.keys = window.appStore.keys.getKeys();
                this.closeEditModal();

                if (this.editingIndex === this.currentKeyId) {
                    location.reload();
                }
            }
        },

        logout() {
            if (!confirm('确定要退出登录吗？所有保存的 AccessKey 将被清除。')) {
                return;
            }

            window.appStore.keys.clearAll();

            const basePath = window.APP_CONFIG?.base_path || '';
            window.location.href = `${basePath}/login.html`;
        }
    };
}

// ECS实例列表组件
function ecsInstances() {
    return {
        ...regionMixin(),
        instances: [],
        loading: false,
        error: '',
        currentPage: 1,
        pageSize: 50,
        totalCount: 0,
        regionId: '',
        filters: {
            instanceName: '',
            privateIp: '',
            publicIp: '',
            eipAddress: '',
            status: ''
        },
        // 当前操作的实例
        currentInstance: null,
        // 模态框状态
        showManageModal: false,

        get totalPages() {
            return Math.ceil(this.totalCount / this.pageSize);
        },

        get startItem() {
            return (this.currentPage - 1) * this.pageSize + 1;
        },

        get endItem() {
            return Math.min(this.currentPage * this.pageSize, this.totalCount);
        },

        async init() {
            // 从 URL hash 参数读取状态
            const hash = window.location.hash.substring(1); // 去掉 #
            const urlParams = new URLSearchParams(hash);

            // 读取地域
            this.regionId = urlParams.get('regionId') || window.appStore.keys.getDefaultRegion() || 'cn-hangzhou';

            // 读取分页参数
            const page = urlParams.get('page');
            if (page) this.currentPage = parseInt(page);

            const pageSize = urlParams.get('pageSize');
            if (pageSize) this.pageSize = parseInt(pageSize);

            // 读取搜索条件
            this.filters.instanceName = urlParams.get('instanceName') || '';
            this.filters.privateIp = urlParams.get('privateIp') || '';
            this.filters.publicIp = urlParams.get('publicIp') || '';
            this.filters.eipAddress = urlParams.get('eipAddress') || '';
            this.filters.status = urlParams.get('status') || '';

            await this.loadRegions();
            await this.loadInstances(this.currentPage);
        },

        // 更新 URL hash 参数
        updateUrl() {
            const params = new URLSearchParams();

            // 添加地域
            params.set('regionId', this.regionId);

            // 添加分页参数
            if (this.currentPage > 1) {
                params.set('page', this.currentPage.toString());
            }
            if (this.pageSize !== 10) {
                params.set('pageSize', this.pageSize.toString());
            }

            // 添加搜索条件
            if (this.filters.instanceName) params.set('instanceName', this.filters.instanceName);
            if (this.filters.privateIp) params.set('privateIp', this.filters.privateIp);
            if (this.filters.publicIp) params.set('publicIp', this.filters.publicIp);
            if (this.filters.eipAddress) params.set('eipAddress', this.filters.eipAddress);
            if (this.filters.status) params.set('status', this.filters.status);

            // 更新浏览器 URL hash（不刷新页面）
            const basePath = window.APP_CONFIG?.base_path || '';
            const newUrl = `${basePath}/ecs_instances.html#${params.toString()}`;
            window.history.pushState({}, '', newUrl);
        },

        async loadInstances(page = 1) {
            this.loading = true;
            this.error = '';
            this.currentPage = page;

            // 更新 URL
            this.updateUrl();

            try {
                // 使用 window.appStore.keys
                const currentKey = window.appStore.keys.getCurrentKey();

                if (!currentKey) {
                    this.error = '请先登录';
                    return;
                }

                const searchFilters = {};
                if (this.filters.instanceName) searchFilters.instanceName = this.filters.instanceName;
                if (this.filters.privateIp) searchFilters.privateIp = this.filters.privateIp;
                if (this.filters.publicIp) searchFilters.publicIp = this.filters.publicIp;
                if (this.filters.eipAddress) searchFilters.eipAddress = this.filters.eipAddress;
                if (this.filters.status) searchFilters.status = this.filters.status;

                const data = await DescribeInstances(
                    this.regionId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret,
                    this.currentPage,
                    this.pageSize,
                    searchFilters
                );

                if (data.Code) {
                    this.error = data.Message || '加载失败';
                    // 不清空原有数据，保持上次加载的数据
                    return;
                }

                // 成功获取数据后才更新
                this.instances = data.Instances?.Instance || [];
                this.totalCount = data.TotalCount || 0;
            } catch (error) {
                this.error = error.message || '加载失败';
                // 不清空原有数据，保持上次加载的数据
            } finally {
                this.loading = false;
            }
        },

        async search() {
            await this.loadInstances(1);
        },

        async changeRegion() {
            // 使用 window.appStore.keys
            window.appStore.keys.setDefaultRegion(this.regionId);
            await this.loadInstances(1);
        },

        async changePageSize() {
            await this.loadInstances(1);
        },

        async prevPage() {
            if (this.currentPage > 1) {
                await this.loadInstances(this.currentPage - 1);
            }
        },

        async nextPage() {
            if (this.currentPage < this.totalPages) {
                await this.loadInstances(this.currentPage + 1);
            }
        },

        formatStatus(status) {
            const statusMap = {
                'Running': { text: '运行中', class: 'running' },
                'Stopped': { text: '已停止', class: 'stopped' },
                'Starting': { text: '启动中', class: 'starting' },
                'Stopping': { text: '停止中', class: 'stopping' }
            };
            return statusMap[status] || { text: status, class: 'unknown' };
        },

        formatTime(timeStr) {
            if (!timeStr) return '-';
            const date = new Date(timeStr);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        },

        // 启动实例
        async startInstance(instance) {
            if (!confirm(`确定要启动实例 "${instance.InstanceName || instance.InstanceId}" 吗？`)) {
                return;
            }

            this.operatingInstanceId = instance.InstanceId;
            try {
                const currentKey = window.appStore.keys.getCurrentKey();
                const result = await StartInstance(
                    this.regionId,
                    instance.InstanceId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret
                );

                if (result.Code) {
                    alert(`启动失败：${result.Message}`);
                } else {
                    alert('启动指令已发送，实例正在启动中...');
                    await this.loadInstances(this.currentPage);
                }
            } catch (error) {
                alert(`启动失败：${error.message}`);
            } finally {
                this.operatingInstanceId = null;
            }
        },

        // 停止实例
        async stopInstance(instance) {
            if (!confirm(`确定要停止实例 "${instance.InstanceName || instance.InstanceId}" 吗？`)) {
                return;
            }

            this.operatingInstanceId = instance.InstanceId;
            try {
                const currentKey = window.appStore.keys.getCurrentKey();
                const result = await StopInstance(
                    this.regionId,
                    instance.InstanceId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret
                );

                if (result.Code) {
                    alert(`停止失败：${result.Message}`);
                } else {
                    alert('停止指令已发送，实例正在停止中...');
                    await this.loadInstances(this.currentPage);
                }
            } catch (error) {
                alert(`停止失败：${error.message}`);
            } finally {
                this.operatingInstanceId = null;
            }
        },

        // 重启实例
        async rebootInstance(instance) {
            if (!confirm(`确定要重启实例 "${instance.InstanceName || instance.InstanceId}" 吗？`)) {
                return;
            }

            this.operatingInstanceId = instance.InstanceId;
            try {
                const currentKey = window.appStore.keys.getCurrentKey();
                const result = await RebootInstance(
                    this.regionId,
                    instance.InstanceId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret
                );

                if (result.Code) {
                    alert(`重启失败：${result.Message}`);
                } else {
                    alert('重启指令已发送，实例正在重启中...');
                    await this.loadInstances(this.currentPage);
                }
            } catch (error) {
                alert(`重启失败：${error.message}`);
            } finally {
                this.operatingInstanceId = null;
            }
        },

        // 打开管理模态框
        openManageModal(instance) {
            // 检测是否为移动设备
            const isMobile = window.innerWidth < 1024; // lg 断点

            if (isMobile) {
                // 移动端：通过 hash 参数跳转到管理页面
                const basePath = window.APP_CONFIG?.base_path || '';
                window.location.href = `${basePath}/ecs_manage.html#instanceId=${instance.InstanceId}&regionId=${this.regionId}`;
            } else {
                // 桌面端：打开模态框
                this.currentInstance = instance;
                this.showManageModal = true;
            }
        },

        closeManageModal() {
            this.showManageModal = false;
            this.currentInstance = null;
            // 刷新列表以获取最新状态
            this.loadInstances(this.currentPage);
        }
    };
}

// VPC列表组件
function vpcList() {
    return {
        ...regionMixin(),
        vpcs: [],
        loading: false,
        error: '',
        currentPage: 1,
        pageSize: 50,
        totalCount: 0,
        regionId: '',

        get totalPages() {
            return Math.ceil(this.totalCount / this.pageSize);
        },

        async init() {
            // 使用 window.appStore.keys
            this.regionId = window.appStore.keys.getDefaultRegion() || 'cn-hangzhou';
            await this.loadRegions();
            await this.loadVpcs();
        },

        async loadVpcs(page = 1) {
            this.loading = true;
            this.error = '';
            this.currentPage = page;

            try {
                // 使用 window.appStore.keys
                const currentKey = window.appStore.keys.getCurrentKey();

                if (!currentKey) {
                    this.error = '请先登录';
                    return;
                }

                const data = await DescribeVpcs(
                    this.regionId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret,
                    this.currentPage,
                    this.pageSize
                );

                if (data.Code) {
                    this.error = data.Message || '加载失败';
                    this.vpcs = [];
                    return;
                }

                this.vpcs = data.Vpcs?.Vpc || [];
                this.totalCount = data.TotalCount || 0;
            } catch (error) {
                this.error = error.message || '加载失败';
                this.vpcs = [];
            } finally {
                this.loading = false;
            }
        },

        async changeRegion() {
            // 使用 window.appStore.keys
            window.appStore.keys.setDefaultRegion(this.regionId);
            await this.loadVpcs(1);
        },

        async changePageSize() {
            await this.loadVpcs(1);
        },

        formatStatus(status) {
            const statusMap = {
                'Available': { text: '可用', class: 'status-available' }
            };
            return statusMap[status] || { text: status, class: '' };
        },

        formatTime(timeStr) {
            if (!timeStr) return '-';
            const date = new Date(timeStr);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };
}

// VSwitch列表组件
function vswitchList() {
    return {
        ...regionMixin(),
        vswitches: [],
        loading: false,
        error: '',
        currentPage: 1,
        pageSize: 50,
        totalCount: 0,
        regionId: '',

        get totalPages() {
            return Math.ceil(this.totalCount / this.pageSize);
        },

        async init() {
            // 使用 window.appStore.keys
            this.regionId = window.appStore.keys.getDefaultRegion() || 'cn-hangzhou';
            await this.loadRegions();
            await this.loadVSwitches();
        },

        async loadVSwitches(page = 1) {
            this.loading = true;
            this.error = '';
            this.currentPage = page;

            try {
                // 使用 window.appStore.keys
                const currentKey = window.appStore.keys.getCurrentKey();

                if (!currentKey) {
                    this.error = '请先登录';
                    return;
                }

                const data = await DescribeVSwitches(
                    this.regionId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret,
                    this.currentPage,
                    this.pageSize
                );

                if (data.Code) {
                    this.error = data.Message || '加载失败';
                    this.vswitches = [];
                    return;
                }

                this.vswitches = data.VSwitches?.VSwitch || [];
                this.totalCount = data.TotalCount || 0;
            } catch (error) {
                this.error = error.message || '加载失败';
                this.vswitches = [];
            } finally {
                this.loading = false;
            }
        },

        async changeRegion() {
            // 使用 window.appStore.keys
            window.appStore.keys.setDefaultRegion(this.regionId);
            await this.loadVSwitches(1);
        },

        async changePageSize() {
            await this.loadVSwitches(1);
        },

        formatStatus(status) {
            const statusMap = {
                'Available': { text: '可用', class: 'status-available' }
            };
            return statusMap[status] || { text: status, class: '' };
        },

        formatTime(timeStr) {
            if (!timeStr) return '-';
            const date = new Date(timeStr);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };
}


// EIP列表组件
function eipList() {
    return {
        ...regionMixin(),
        eips: [],
        loading: false,
        error: '',
        currentPage: 1,
        pageSize: 50,
        totalCount: 0,
        regionId: '',
        filters: {
            eipName: '',
            eipAddress: '',
            allocationId: '',
            associatedInstanceId: '',
            status: ''
        },

        get totalPages() {
            return Math.ceil(this.totalCount / this.pageSize);
        },

        async init() {
            // 从 URL hash 参数读取状态
            const hash = window.location.hash.substring(1); // 去掉 #
            const urlParams = new URLSearchParams(hash);

            // 读取地域
            this.regionId = urlParams.get('regionId') || window.appStore.keys.getDefaultRegion() || 'cn-hangzhou';

            // 读取分页参数
            const page = urlParams.get('page');
            if (page) this.currentPage = parseInt(page);

            const pageSize = urlParams.get('pageSize');
            if (pageSize) this.pageSize = parseInt(pageSize);

            // 读取搜索条件
            this.filters.eipName = urlParams.get('eipName') || '';
            this.filters.eipAddress = urlParams.get('eipAddress') || '';
            this.filters.allocationId = urlParams.get('allocationId') || '';
            this.filters.associatedInstanceId = urlParams.get('associatedInstanceId') || '';
            this.filters.status = urlParams.get('status') || '';

            await this.loadRegions();
            await this.loadEips(this.currentPage);
        },

        // 更新 URL hash 参数
        updateUrl() {
            const params = new URLSearchParams();

            // 添加地域
            params.set('regionId', this.regionId);

            // 添加分页参数
            if (this.currentPage > 1) {
                params.set('page', this.currentPage.toString());
            }
            if (this.pageSize !== 10) {
                params.set('pageSize', this.pageSize.toString());
            }

            // 添加搜索条件
            if (this.filters.eipName) params.set('eipName', this.filters.eipName);
            if (this.filters.eipAddress) params.set('eipAddress', this.filters.eipAddress);
            if (this.filters.allocationId) params.set('allocationId', this.filters.allocationId);
            if (this.filters.associatedInstanceId) params.set('associatedInstanceId', this.filters.associatedInstanceId);
            if (this.filters.status) params.set('status', this.filters.status);

            // 更新浏览器 URL hash（不刷新页面）
            const basePath = window.APP_CONFIG?.base_path || '';
            const newUrl = `${basePath}/eip_list.html#${params.toString()}`;
            window.history.pushState({}, '', newUrl);
        },

        async loadEips(page = 1) {
            this.loading = true;
            this.error = '';
            this.currentPage = page;

            // 更新 URL
            this.updateUrl();

            try {
                // 使用 window.appStore.keys
                const currentKey = window.appStore.keys.getCurrentKey();

                if (!currentKey) {
                    this.error = '请先登录';
                    return;
                }

                const searchFilters = {};
                if (this.filters.eipName) searchFilters.eipName = this.filters.eipName;
                if (this.filters.eipAddress) searchFilters.eipAddress = this.filters.eipAddress;
                if (this.filters.allocationId) searchFilters.allocationId = this.filters.allocationId;
                if (this.filters.associatedInstanceId) searchFilters.associatedInstanceId = this.filters.associatedInstanceId;
                if (this.filters.status) searchFilters.status = this.filters.status;

                const data = await DescribeEipAddresses(
                    this.regionId,
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret,
                    this.currentPage,
                    this.pageSize,
                    searchFilters
                );

                if (data.Code) {
                    this.error = data.Message || '加载失败';
                    // 不清空原有数据，保持上次加载的数据
                    return;
                }

                // 成功获取数据后才更新
                this.eips = data.EipAddresses?.EipAddress || [];
                this.totalCount = data.TotalCount || 0;
            } catch (error) {
                this.error = error.message || '加载失败';
                // 不清空原有数据，保持上次加载的数据
            } finally {
                this.loading = false;
            }
        },

        async search() {
            await this.loadEips(1);
        },

        async changeRegion() {
            // 使用 window.appStore.keys
            window.appStore.keys.setDefaultRegion(this.regionId);
            await this.loadEips(1);
        },

        async changePageSize() {
            await this.loadEips(1);
        },

        formatStatus(status) {
            const statusMap = {
                'Available': { text: '可用', class: 'available' },
                'InUse': { text: '使用中', class: 'inuse' },
                'Associating': { text: '绑定中', class: 'associating' }
            };
            return statusMap[status] || { text: status, class: 'unknown' };
        },

        formatTime(timeStr) {
            if (!timeStr) return '-';
            const date = new Date(timeStr);
            return date.toLocaleString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    };
}

// 登录组件
function loginPage() {
    return {
        keys: [],
        hasKeys: false,
        form: {
            name: '',
            accessKeyId: '',
            accessKeySecret: ''
        },
        error: '',
        loading: false,

        init() {
            // 使用 window.appStore.keys
            this.keys = window.appStore.keys.getKeys();
            this.hasKeys = this.keys.length > 0;
        },

        selectKey(index) {
            // 使用 window.appStore.keys
            if (window.appStore.keys.switchKey(index)) {
                const basePath = window.APP_CONFIG?.base_path || '';
                window.location.href = `${basePath}/ecs_instances.html`;
            }
        },

        deleteKey(index) {
            const key = this.keys[index];
            if (!confirm(`确定要删除密钥 "${key.name}" 吗？`)) {
                return;
            }

            // 使用 window.appStore.keys
            if (window.appStore.keys.deleteKey(index)) {
                this.keys = window.appStore.keys.getKeys();
                this.hasKeys = this.keys.length > 0;
            }
        },

        showAddForm() {
            this.hasKeys = false;
        },

        async login() {
            if (!this.form.accessKeyId || !this.form.accessKeySecret) {
                this.error = '请填写 AccessKey ID 和 AccessKey Secret';
                return;
            }

            this.loading = true;
            this.error = '';

            try {
                // 使用 window.appStore.keys
                const result = window.appStore.keys.addKey(this.form);

                if (!result.success) {
                    this.error = result.message;
                    this.loading = false;
                    return;
                }

                const basePath = window.APP_CONFIG?.base_path || '';
                window.location.href = `${basePath}/ecs_instances.html`;
            } catch (error) {
                this.error = error.message || '登录失败';
                this.loading = false;
            }
        }
    };
}
