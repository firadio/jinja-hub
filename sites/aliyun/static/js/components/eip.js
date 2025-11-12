// EIP 管理组件
function eipManage() {
    return createResourceManage('eip');
}

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
