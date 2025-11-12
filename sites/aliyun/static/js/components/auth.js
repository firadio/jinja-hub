// 密钥管理器
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
