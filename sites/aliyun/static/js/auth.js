// 前端认证逻辑 - 使用 localStorage 存储，无自动跳转

// AccessKey 存储管理
class AccessKeyStore {
    constructor() {
        this.storageKey = 'aliyun_access_keys';
        this.currentIndexKey = 'aliyun_current_index';
        this.defaultRegionKey = 'aliyun_default_region';
    }

    getKeys() {
        const keysJson = localStorage.getItem(this.storageKey);
        return keysJson ? JSON.parse(keysJson) : [];
    }

    saveKeys(keys) {
        localStorage.setItem(this.storageKey, JSON.stringify(keys));
    }

    getCurrentIndex() {
        const index = localStorage.getItem(this.currentIndexKey);
        return index !== null ? parseInt(index) : 0;
    }

    setCurrentIndex(index) {
        localStorage.setItem(this.currentIndexKey, index.toString());
    }

    getCurrentKey() {
        const keys = this.getKeys();
        const index = this.getCurrentIndex();
        return keys[index] || null;
    }

    addKey(key) {
        const keys = this.getKeys();

        // 检查是否已存在相同的 AccessKeyId
        const existingKey = keys.find(k => k.accessKeyId === key.accessKeyId);
        if (existingKey) {
            return { success: false, message: '该 AccessKey ID 已存在' };
        }

        keys.push(key);
        this.saveKeys(keys);
        if (keys.length === 1) {
            this.setCurrentIndex(0);
        }
        return { success: true, index: keys.length - 1 };
    }

    switchKey(index) {
        const keys = this.getKeys();
        if (index >= 0 && index < keys.length) {
            this.setCurrentIndex(index);
            return true;
        }
        return false;
    }

    deleteKey(index) {
        const keys = this.getKeys();
        if (index >= 0 && index < keys.length) {
            keys.splice(index, 1);
            this.saveKeys(keys);
            const currentIndex = this.getCurrentIndex();
            if (currentIndex >= keys.length) {
                this.setCurrentIndex(Math.max(0, keys.length - 1));
            }
            return true;
        }
        return false;
    }

    updateKey(index, updatedKey) {
        const keys = this.getKeys();
        if (index >= 0 && index < keys.length) {
            // 检查是否与其他密钥的 AccessKeyId 冲突
            const existingKey = keys.find((k, i) => i !== index && k.accessKeyId === updatedKey.accessKeyId);
            if (existingKey) {
                return { success: false, message: '该 AccessKey ID 已被其他密钥使用' };
            }
            keys[index] = updatedKey;
            this.saveKeys(keys);
            return { success: true };
        }
        return { success: false, message: '密钥不存在' };
    }

    getDefaultRegion() {
        return localStorage.getItem(this.defaultRegionKey) || 'cn-hangzhou';
    }

    setDefaultRegion(region) {
        localStorage.setItem(this.defaultRegionKey, region);
    }

    isLoggedIn() {
        return this.getKeys().length > 0;
    }

    clear() {
        localStorage.removeItem(this.storageKey);
        localStorage.removeItem(this.currentIndexKey);
        localStorage.removeItem(this.defaultRegionKey);
    }
}

// 登录页面逻辑
if (document.getElementById('loginForm')) {
    const keyStore = new AccessKeyStore();
    const errorDiv = document.getElementById('error');
    const infoDiv = document.getElementById('info');

    // 获取 base_path，默认为空
    const basePath = window.APP_CONFIG?.base_path || '';

    // 检查是否已登录，提示用户
    if (keyStore.isLoggedIn()) {
        const keys = keyStore.getKeys();
        const currentKey = keyStore.getCurrentKey();

        infoDiv.innerHTML = `
            <p>您已登录，当前使用: <strong>${currentKey.name}</strong> (${currentKey.accessKeyId})</p>
            <p>共有 ${keys.length} 个密钥</p>
            <p><a href="${basePath}/ecs_instances.html" class="btn btn-sm btn-primary">前往 ECS 实例页面</a></p>
        `;
        infoDiv.style.display = 'block';
    }

    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();

        const accessKeyId = document.getElementById('accessKeyId').value.trim();
        const accessKeySecret = document.getElementById('accessKeySecret').value.trim();
        const name = document.getElementById('name').value.trim() || '默认密钥';
        const region = document.getElementById('region').value;

        if (!accessKeyId || !accessKeySecret) {
            errorDiv.textContent = 'AccessKey ID 和 AccessKey Secret 不能为空';
            errorDiv.style.display = 'block';
            return;
        }

        const key = {
            accessKeyId: accessKeyId,
            accessKeySecret: accessKeySecret,
            name: name
        };

        keyStore.addKey(key);
        keyStore.setDefaultRegion(region);

        // 登录成功，自动跳转到 ECS 实例页面
        window.location.href = `${basePath}/ecs_instances.html`;
    });
}

// 导出供其他页面使用
window.AccessKeyStore = AccessKeyStore;
