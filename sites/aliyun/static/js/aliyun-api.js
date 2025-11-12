// 阿里云 API 调用工具 - 基于前端纯 JavaScript

// 生成 UUID (兼容非 HTTPS 环境)
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // 降级方案：使用 Math.random() 生成 UUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// HMAC-SHA1 签名 (兼容非 HTTPS 环境)
async function signHmacSha1ToBase64(key, message) {
    // 尝试使用 Web Crypto API (仅在 HTTPS 下可用)
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        try {
            const encoder = new TextEncoder();
            const keyData = encoder.encode(key);
            const messageData = encoder.encode(message);

            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'HMAC', hash: 'SHA-1' },
                false,
                ['sign']
            );

            const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
            return btoa(String.fromCharCode(...new Uint8Array(signature)));
        } catch (e) {
            console.warn('Web Crypto API failed, falling back to CryptoJS:', e);
        }
    }

    // 降级方案：使用 CryptoJS 库
    if (typeof CryptoJS !== 'undefined') {
        const hash = CryptoJS.HmacSHA1(message, key);
        return CryptoJS.enc.Base64.stringify(hash);
    }

    throw new Error('No crypto library available. Please use HTTPS or ensure CryptoJS is loaded.');
}

// 按照阿里云RFC3986规范进行URL编码
function percentEncode(str) {
    return encodeURIComponent(str)
        .replace(/!/g, '%21')
        .replace(/'/g, '%27')
        .replace(/\(/g, '%28')
        .replace(/\)/g, '%29')
        .replace(/\*/g, '%2A')
        .replace(/%7E/g, '~');
}

// 生成签名
async function generateSignature(params, accessKeySecret) {
    const queryString = Object.keys(params).sort().map(key => {
        return percentEncode(key) + '=' + percentEncode(params[key]);
    }).join('&');
    const stringToSign = `GET&%2F&${percentEncode(queryString)}`;
    return await signHmacSha1ToBase64(accessKeySecret + '&', stringToSign);
}

// 获取 API 端点
function getApiEndpoint(action, regionId) {
    // ECS API
    if (action.startsWith('Describe') && (action.includes('Instance') || action.includes('Region'))) {
        return `https://ecs.${regionId}.aliyuncs.com/`;
    }
    // VPC API (包括 EIP)
    if (action.includes('Vpc') || action.includes('VSwitch') || action.includes('Eip')) {
        return `https://vpc.${regionId}.aliyuncs.com/`;
    }
    // 默认 ECS
    return `https://ecs.${regionId}.aliyuncs.com/`;
}

// 获取 API 版本
function getApiVersion(action) {
    // VPC API 版本
    if (action.includes('Vpc') || action.includes('VSwitch') || action.includes('Eip')) {
        return '2016-04-28';
    }
    // ECS API 版本
    return '2014-05-26';
}

// 调用阿里云 API
async function AliyunApi(requestParams2, accessKeyId, accessKeySecret) {
    const requestParams1 = {
        AccessKeyId: accessKeyId,
        Format: 'JSON',
        SignatureMethod: 'HMAC-SHA1',
        SignatureVersion: '1.0',
        SignatureNonce: generateUUID(),
        Timestamp: new Date().toISOString(),
        Version: getApiVersion(requestParams2.Action),
    };

    const requestParams3 = { ...requestParams1, ...requestParams2 };

    const Signature = await generateSignature(requestParams3, accessKeySecret);
    const urlParams = new URLSearchParams({ ...requestParams3, Signature });
    const apiEndpoint = getApiEndpoint(requestParams2.Action, requestParams2.RegionId);
    const url = `${apiEndpoint}?${urlParams.toString()}`;

    try {
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
}

// 描述 ECS 实例
async function DescribeInstances(regionId, accessKeyId, accessKeySecret, pageNumber = 1, pageSize = 50, filters = {}) {
    const params = {
        Action: 'DescribeInstances',
        RegionId: regionId,
        PageNumber: pageNumber.toString(),
        PageSize: pageSize.toString()
    };

    // 添加搜索过滤参数
    if (filters.instanceName) {
        params.InstanceName = filters.instanceName;
    }
    if (filters.privateIp) {
        // PrivateIpAddresses 应该是一个 JSON 数组字符串
        params.PrivateIpAddresses = JSON.stringify([filters.privateIp]);
    }
    if (filters.publicIp) {
        // PublicIpAddresses 应该是一个 JSON 数组字符串
        params.PublicIpAddresses = JSON.stringify([filters.publicIp]);
    }
    if (filters.instanceIds && filters.instanceIds.length > 0) {
        // InstanceIds 应该是一个 JSON 数组字符串
        params.InstanceIds = JSON.stringify(filters.instanceIds);
    }
    if (filters.eipAddress) {
        // EipAddresses 应该是一个 JSON 数组字符串
        params.EipAddresses = JSON.stringify([filters.eipAddress]);
    }

    return await AliyunApi(params, accessKeyId, accessKeySecret);
}

// 描述 VPC
async function DescribeVpcs(regionId, accessKeyId, accessKeySecret, pageNumber = 1, pageSize = 50) {
    return await AliyunApi({
        Action: 'DescribeVpcs',
        RegionId: regionId,
        PageNumber: pageNumber.toString(),
        PageSize: pageSize.toString()
    }, accessKeyId, accessKeySecret);
}

// 描述交换机
async function DescribeVSwitches(regionId, accessKeyId, accessKeySecret, pageNumber = 1, pageSize = 50) {
    return await AliyunApi({
        Action: 'DescribeVSwitches',
        RegionId: regionId,
        PageNumber: pageNumber.toString(),
        PageSize: pageSize.toString()
    }, accessKeyId, accessKeySecret);
}

// 描述弹性公网IP
async function DescribeEipAddresses(regionId, accessKeyId, accessKeySecret, pageNumber = 1, pageSize = 50, filters = {}) {
    const params = {
        Action: 'DescribeEipAddresses',
        RegionId: regionId,
        PageNumber: pageNumber.toString(),
        PageSize: pageSize.toString()
    };

    // 添加搜索过滤参数
    if (filters.eipName) {
        params.EipName = filters.eipName;
    }
    if (filters.eipAddress) {
        params.EipAddress = filters.eipAddress;
    }
    if (filters.allocationId) {
        params.AllocationId = filters.allocationId;
    }
    if (filters.associatedInstanceId) {
        params.AssociatedInstanceId = filters.associatedInstanceId;
    }

    return await AliyunApi(params, accessKeyId, accessKeySecret);
}

// 描述地域列表
async function DescribeRegions(accessKeyId, accessKeySecret) {
    // DescribeRegions 可以使用任意地域的端点，这里使用杭州
    return await AliyunApi({
        Action: 'DescribeRegions',
        RegionId: 'cn-hangzhou'
    }, accessKeyId, accessKeySecret);
}

// 注意: 地域列表缓存管理已迁移到 store.js 的 RegionManager
// 使用 window.appStore.regions 访问地域相关功能
