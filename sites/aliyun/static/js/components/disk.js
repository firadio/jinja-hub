// 云盘管理组件
function diskManage() {
    return createResourceManage('disk');
}

// 云盘表格组件（带管理功能）
function diskListTable() {
    const base = createDataTable('disk_list');

    return {
        ...base,
        // 云盘专用状态
        currentDisk: null,
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
        handleAction(disk) {
            this.openManageModal(disk);
        },

        // 打开管理模态框
        openManageModal(disk) {
            const isMobile = window.innerWidth < 1024;

            if (isMobile) {
                const basePath = window.APP_CONFIG?.base_path || '';
                window.location.href = `${basePath}/disk_manage.html#diskId=${disk.DiskId}&regionId=${this.regionId}`;
            } else {
                this.currentDisk = disk;
                this.showManageModal = true;
            }
        },

        closeManageModal() {
            this.showManageModal = false;
            this.currentDisk = null;
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
            const tableConfig = window.APP_CONFIG?.tables?.disk_list;
            return tableConfig?.fields?.filter(f => f.showInFilter) || [];
        },

        get tableFields() {
            const tableConfig = window.APP_CONFIG?.tables?.disk_list;
            return tableConfig?.fields?.filter(f => f.showInTable) || [];
        }
    };
}
