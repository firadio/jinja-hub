// Alpine.js 组件定义

// 通用地域加载 Mixin
function regionMixin() {
    return {
        regions: [],
        regionsLoading: false,

        async loadRegions() {
            if (this.regionsLoading || this.regions.length > 0) return;

            this.regionsLoading = true;
            try {
                const keyStore = new AccessKeyStore();
                const currentKey = keyStore.getCurrentKey();

                if (!currentKey) {
                    // 未登录时使用默认地域列表
                    this.regions = [{ id: 'cn-hangzhou', name: '华东1(杭州)' }];
                    // 如果还没有设置regionId,设置为第一个
                    if (!this.regionId) {
                        this.regionId = this.regions[0].id;
                    }
                    return;
                }

                // 使用缓存管理器加载地域列表
                const regions = await RegionCache.load(
                    currentKey.accessKeyId,
                    currentKey.accessKeySecret
                );

                this.regions = regions;

                // 确保regionId有效
                if (this.regions.length > 0) {
                    // 如果没有设置regionId,或者当前regionId不在列表中,选择第一个
                    if (!this.regionId || !this.regions.find(r => r.id === this.regionId)) {
                        this.regionId = this.regions[0].id;
                    }
                }
            } catch (e) {
                console.error('Failed to load regions:', e);
                // 加载失败时使用默认列表
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
            const keyStore = new AccessKeyStore();
            this.keys = keyStore.getKeys();
            this.currentKeyId = keyStore.getCurrentIndex();
        },

        openModal() {
            this.showModal = true;
        },

        closeModal() {
            this.showModal = false;
        },

        addKey() {
            const keyStore = new AccessKeyStore();
            const result = keyStore.addKey(this.addForm);

            if (!result.success) {
                alert(result.message);
                return;
            }

            this.addForm = {
                name: '',
                accessKeyId: '',
                accessKeySecret: ''
            };

            this.keys = keyStore.getKeys();
            this.currentKeyId = keyStore.getCurrentIndex();
        },

        switchKey(index) {
            const keyStore = new AccessKeyStore();
            if (keyStore.switchKey(index)) {
                location.reload();
            }
        },

        deleteKey(index) {
            const key = this.keys[index];
            if (!confirm(`确定要删除密钥 "${key.name}" 吗？`)) {
                return;
            }

            const keyStore = new AccessKeyStore();
            if (keyStore.deleteKey(index)) {
                this.keys = keyStore.getKeys();
                this.currentKeyId = keyStore.getCurrentIndex();

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
            const keyStore = new AccessKeyStore();
            const result = keyStore.updateKey(this.editingIndex, this.editForm);

            if (!result.success) {
                alert(result.message);
                return;
            }

            this.keys = keyStore.getKeys();
            this.closeEditModal();

            if (this.editingIndex === this.currentKeyId) {
                location.reload();
            }
        },

        logout() {
            if (!confirm('确定要退出登录吗？所有保存的 AccessKey 将被清除。')) {
                return;
            }

            const keyStore = new AccessKeyStore();
            keyStore.clear();

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
            eipAddress: ''
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
            const keyStore = new AccessKeyStore();
            this.regionId = keyStore.getDefaultRegion() || 'cn-hangzhou';
            await this.loadRegions();
            await this.loadInstances();
        },

        async loadInstances(page = 1) {
            this.loading = true;
            this.error = '';
            this.currentPage = page;

            try {
                const keyStore = new AccessKeyStore();
                const currentKey = keyStore.getCurrentKey();

                if (!currentKey) {
                    this.error = '请先登录';
                    return;
                }

                const searchFilters = {};
                if (this.filters.instanceName) searchFilters.instanceName = this.filters.instanceName;
                if (this.filters.privateIp) searchFilters.privateIp = this.filters.privateIp;
                if (this.filters.publicIp) searchFilters.publicIp = this.filters.publicIp;
                if (this.filters.eipAddress) searchFilters.eipAddress = this.filters.eipAddress;

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
                    this.instances = [];
                    return;
                }

                this.instances = data.Instances?.Instance || [];
                this.totalCount = data.TotalCount || 0;
            } catch (error) {
                this.error = error.message || '加载失败';
                this.instances = [];
            } finally {
                this.loading = false;
            }
        },

        async search() {
            await this.loadInstances(1);
        },

        async changeRegion() {
            const keyStore = new AccessKeyStore();
            keyStore.setDefaultRegion(this.regionId);
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
                'Running': { text: '运行中', class: 'status-running' },
                'Stopped': { text: '已停止', class: 'status-stopped' }
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
            const keyStore = new AccessKeyStore();
            this.regionId = keyStore.getDefaultRegion() || 'cn-hangzhou';
            await this.loadRegions();
            await this.loadVpcs();
        },

        async loadVpcs(page = 1) {
            this.loading = true;
            this.error = '';
            this.currentPage = page;

            try {
                const keyStore = new AccessKeyStore();
                const currentKey = keyStore.getCurrentKey();

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
            const keyStore = new AccessKeyStore();
            keyStore.setDefaultRegion(this.regionId);
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
            const keyStore = new AccessKeyStore();
            this.regionId = keyStore.getDefaultRegion() || 'cn-hangzhou';
            await this.loadRegions();
            await this.loadVSwitches();
        },

        async loadVSwitches(page = 1) {
            this.loading = true;
            this.error = '';
            this.currentPage = page;

            try {
                const keyStore = new AccessKeyStore();
                const currentKey = keyStore.getCurrentKey();

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
            const keyStore = new AccessKeyStore();
            keyStore.setDefaultRegion(this.regionId);
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
            associatedInstanceId: ''
        },

        get totalPages() {
            return Math.ceil(this.totalCount / this.pageSize);
        },

        async init() {
            const keyStore = new AccessKeyStore();
            this.regionId = keyStore.getDefaultRegion() || 'cn-hangzhou';
            await this.loadRegions();
            await this.loadEips();
        },

        async loadEips(page = 1) {
            this.loading = true;
            this.error = '';
            this.currentPage = page;

            try {
                const keyStore = new AccessKeyStore();
                const currentKey = keyStore.getCurrentKey();

                if (!currentKey) {
                    this.error = '请先登录';
                    return;
                }

                const searchFilters = {};
                if (this.filters.eipName) searchFilters.eipName = this.filters.eipName;
                if (this.filters.eipAddress) searchFilters.eipAddress = this.filters.eipAddress;
                if (this.filters.allocationId) searchFilters.allocationId = this.filters.allocationId;
                if (this.filters.associatedInstanceId) searchFilters.associatedInstanceId = this.filters.associatedInstanceId;

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
                    this.eips = [];
                    return;
                }

                this.eips = data.EipAddresses?.EipAddress || [];
                this.totalCount = data.TotalCount || 0;
            } catch (error) {
                this.error = error.message || '加载失败';
                this.eips = [];
            } finally {
                this.loading = false;
            }
        },

        async search() {
            await this.loadEips(1);
        },

        async changeRegion() {
            const keyStore = new AccessKeyStore();
            keyStore.setDefaultRegion(this.regionId);
            await this.loadEips(1);
        },

        async changePageSize() {
            await this.loadEips(1);
        },

        formatStatus(status) {
            const statusMap = {
                'Available': { text: '可用', class: 'status-available' },
                'InUse': { text: '使用中', class: 'status-running' },
                'Associating': { text: '绑定中', class: 'status-available' }
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
            const keyStore = new AccessKeyStore();
            this.keys = keyStore.getKeys();
            this.hasKeys = this.keys.length > 0;
        },

        selectKey(index) {
            const keyStore = new AccessKeyStore();
            if (keyStore.switchKey(index)) {
                const basePath = window.APP_CONFIG?.base_path || '';
                window.location.href = `${basePath}/ecs_instances.html`;
            }
        },

        deleteKey(index) {
            const key = this.keys[index];
            if (!confirm(`确定要删除密钥 "${key.name}" 吗？`)) {
                return;
            }

            const keyStore = new AccessKeyStore();
            if (keyStore.deleteKey(index)) {
                this.keys = keyStore.getKeys();
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
                const keyStore = new AccessKeyStore();
                const result = keyStore.addKey(this.form);

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
