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
