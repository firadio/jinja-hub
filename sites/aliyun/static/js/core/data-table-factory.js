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
                'Pending': { text: '创建中', class: 'pending' },
                // 云盘状态
                'In_use': { text: '使用中', class: 'inuse' },
                'Attaching': { text: '挂载中', class: 'associating' },
                'Detaching': { text: '卸载中', class: 'stopping' },
                'Creating': { text: '创建中', class: 'pending' },
                'ReIniting': { text: '初始化中', class: 'pending' }
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
