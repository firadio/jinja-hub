// ECS 管理组件
function ecsManage() {
    return createResourceManage('ecs_instance');
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
