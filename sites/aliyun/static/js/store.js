/**
 * 前端状态管理层
 * 统一管理 localStorage、缓存和应用状态
 */

// 存储管理器 - 封装 localStorage 操作
class StorageManager {
    constructor(prefix = 'app_') {
        this.prefix = prefix;
    }

    set(key, value, expiresIn = null) {
        const item = {
            value: value,
            timestamp: Date.now(),
            expiresIn: expiresIn
        };
        try {
            localStorage.setItem(this.prefix + key, JSON.stringify(item));
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    }

    get(key) {
        try {
            const item = localStorage.getItem(this.prefix + key);
            if (!item) return null;

            const data = JSON.parse(item);

            // 新格式: {value, timestamp, expiresIn}
            if (data && typeof data === 'object' && 'timestamp' in data) {
                // 检查是否过期
                if (data.expiresIn) {
                    const age = Date.now() - data.timestamp;
                    if (age > data.expiresIn) {
                        this.remove(key);
                        return null;
                    }
                }
                return data.value;
            }

            // 旧格式: 直接是 JSON 值 (对象、数组、字符串等)
            // 迁移到新格式
            this.set(key, data);
            return data;
        } catch (e) {
            // JSON 解析失败,可能是旧的纯字符串格式
            const item = localStorage.getItem(this.prefix + key);
            if (item) {
                // 迁移到新格式
                this.set(key, item);
                return item;
            }
            console.error('Storage error:', e);
            return null;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    }

    clear() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(this.prefix)) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch (e) {
            console.error('Storage error:', e);
            return false;
        }
    }

    // 获取所有带前缀的键
    keys() {
        const keys = Object.keys(localStorage);
        return keys
            .filter(key => key.startsWith(this.prefix))
            .map(key => key.substring(this.prefix.length));
    }
}

// 缓存管理器 - 专门用于 API 响应缓存
class CacheManager {
    constructor(storage, namespace = 'cache_') {
        this.storage = storage;
        this.namespace = namespace;
    }

    set(key, value, ttl = 24 * 60 * 60 * 1000) {
        return this.storage.set(this.namespace + key, value, ttl);
    }

    get(key) {
        return this.storage.get(this.namespace + key);
    }

    remove(key) {
        return this.storage.remove(this.namespace + key);
    }

    clear() {
        const keys = this.storage.keys();
        keys.forEach(key => {
            if (key.startsWith(this.namespace)) {
                this.storage.remove(key);
            }
        });
    }

    // 带加载器的缓存获取
    async getOrLoad(key, loader, ttl = null) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        const value = await loader();
        this.set(key, value, ttl);
        return value;
    }
}

// 密钥管理器
class KeyManager {
    constructor(storage) {
        this.storage = storage;
        this.KEYS_KEY = 'access_keys';
        this.CURRENT_KEY_KEY = 'current_key_id';
        this.DEFAULT_REGION_KEY = 'default_region';
    }

    // 获取所有密钥
    getKeys() {
        return this.storage.get(this.KEYS_KEY) || [];
    }

    // 添加密钥
    addKey(key) {
        const keys = this.getKeys();

        // 检查是否已存在
        const exists = keys.some(k => k.accessKeyId === key.accessKeyId);
        if (exists) {
            return { success: false, message: '该密钥已存在' };
        }

        keys.push({
            name: key.name || '未命名',
            accessKeyId: key.accessKeyId,
            accessKeySecret: key.accessKeySecret,
            createdAt: Date.now()
        });

        this.storage.set(this.KEYS_KEY, keys);

        // 如果是第一个密钥，设为当前密钥
        if (keys.length === 1) {
            this.setCurrentKeyId(0);
        }

        return { success: true };
    }

    // 删除密钥
    deleteKey(index) {
        const keys = this.getKeys();
        if (index < 0 || index >= keys.length) {
            return false;
        }

        keys.splice(index, 1);
        this.storage.set(this.KEYS_KEY, keys);

        // 如果删除的是当前密钥，重置
        const currentId = this.getCurrentKeyId();
        if (currentId === index) {
            this.setCurrentKeyId(keys.length > 0 ? 0 : null);
        } else if (currentId > index) {
            this.setCurrentKeyId(currentId - 1);
        }

        return true;
    }

    // 更新密钥
    updateKey(index, updatedKey) {
        const keys = this.getKeys();
        if (index < 0 || index >= keys.length) {
            return false;
        }

        keys[index] = {
            ...keys[index],
            ...updatedKey,
            updatedAt: Date.now()
        };

        this.storage.set(this.KEYS_KEY, keys);
        return true;
    }

    // 切换当前密钥
    switchKey(index) {
        const keys = this.getKeys();
        if (index < 0 || index >= keys.length) {
            return false;
        }

        this.setCurrentKeyId(index);
        return true;
    }

    // 获取当前密钥 ID
    getCurrentKeyId() {
        return this.storage.get(this.CURRENT_KEY_KEY);
    }

    // 设置当前密钥 ID
    setCurrentKeyId(id) {
        this.storage.set(this.CURRENT_KEY_KEY, id);
    }

    // 获取当前密钥
    getCurrentKey() {
        const id = this.getCurrentKeyId();
        if (id === null) return null;

        const keys = this.getKeys();
        return keys[id] || null;
    }

    // 清除所有密钥
    clearAll() {
        this.storage.remove(this.KEYS_KEY);
        this.storage.remove(this.CURRENT_KEY_KEY);
    }

    // 获取默认区域
    getDefaultRegion() {
        return this.storage.get(this.DEFAULT_REGION_KEY);
    }

    // 设置默认区域
    setDefaultRegion(regionId) {
        this.storage.set(this.DEFAULT_REGION_KEY, regionId);
    }
}

// 区域管理器
class RegionManager {
    constructor(cache) {
        this.cache = cache;
        this.CACHE_KEY = 'regions';
        this.CACHE_TTL = 24 * 60 * 60 * 1000; // 24小时
    }

    // 加载区域列表
    async load(accessKeyId, accessKeySecret) {
        return await this.cache.getOrLoad(
            this.CACHE_KEY,
            async () => {
                const response = await DescribeRegions(accessKeyId, accessKeySecret);
                if (response && response.Regions && response.Regions.Region) {
                    return response.Regions.Region.map(r => ({
                        id: r.RegionId,
                        name: r.LocalName
                    }));
                }
                return [];
            },
            this.CACHE_TTL
        );
    }

    // 清除缓存
    clearCache() {
        this.cache.remove(this.CACHE_KEY);
    }

    // 获取缓存的区域列表
    getCached() {
        return this.cache.get(this.CACHE_KEY);
    }
}

// 全局应用状态
class AppStore {
    constructor() {
        this.storage = new StorageManager('aliyun_');
        this.cache = new CacheManager(this.storage);
        this.keys = new KeyManager(this.storage);
        this.regions = new RegionManager(this.cache);
    }

    // 初始化
    init() {
        console.log('AppStore initialized');
        return this;
    }

    // 清除所有数据
    clearAll() {
        if (confirm('确定要清除所有本地数据吗？包括密钥和缓存。')) {
            this.storage.clear();
            window.location.href = '/';
        }
    }

    // 导出数据 (用于备份)
    exportData() {
        return {
            keys: this.keys.getKeys(),
            currentKeyId: this.keys.getCurrentKeyId(),
            defaultRegion: this.keys.getDefaultRegion(),
            timestamp: Date.now()
        };
    }

    // 导入数据 (用于恢复)
    importData(data) {
        if (data.keys) {
            this.storage.set('access_keys', data.keys);
        }
        if (data.currentKeyId !== undefined) {
            this.storage.set('current_key_id', data.currentKeyId);
        }
        if (data.defaultRegion) {
            this.storage.set('default_region', data.defaultRegion);
        }
        return true;
    }
}

// 创建全局单例
window.appStore = new AppStore().init();
