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
                } else if (manageConfig.idField === 'DiskId') {
                    queryParams.diskId = this.resourceId;
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

