// ECS 实例列表页面 - 后端分页版本

let currentRegion = 'cn-hangzhou';
let currentPage = 1;
let pageSize = 10;
let totalCount = 0;
let searchFilters = {
    instanceName: '',
    instanceId: '',
    privateIp: '',
    publicIp: '',
    eipAddress: ''
};

document.addEventListener('DOMContentLoaded', async function() {
    const regionSelect = document.getElementById('regionSelect');
    const refreshBtn = document.getElementById('refreshBtn');
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    const searchPanel = document.getElementById('searchPanel');
    const searchBtn = document.getElementById('searchBtn');
    const resetSearchBtn = document.getElementById('resetSearchBtn');

    // 获取默认地域
    currentRegion = keyStore.getDefaultRegion();

    // 先加载地域列表
    await loadRegions('regionSelect');

    // 加载实例列表
    loadInstances();

    if (regionSelect) {
        regionSelect.addEventListener('change', function() {
            currentRegion = this.value;
            keyStore.setDefaultRegion(currentRegion);
            currentPage = 1;
            loadInstances();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            currentPage = 1;
            loadInstances();
        });
    }

    // 搜索面板切换
    if (searchToggleBtn && searchPanel) {
        searchToggleBtn.addEventListener('click', function() {
            if (searchPanel.style.display === 'none') {
                searchPanel.style.display = 'block';
            } else {
                searchPanel.style.display = 'none';
            }
        });
    }

    // 搜索按钮
    if (searchBtn) {
        searchBtn.addEventListener('click', function() {
            searchFilters.instanceName = document.getElementById('searchInstanceName')?.value.trim() || '';
            searchFilters.instanceId = document.getElementById('searchInstanceId')?.value.trim() || '';
            searchFilters.privateIp = document.getElementById('searchPrivateIp')?.value.trim() || '';
            searchFilters.publicIp = document.getElementById('searchPublicIp')?.value.trim() || '';
            searchFilters.eipAddress = document.getElementById('searchEipAddress')?.value.trim() || '';
            currentPage = 1;
            loadInstances();
        });
    }

    // 重置按钮
    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', function() {
            document.getElementById('searchInstanceName').value = '';
            document.getElementById('searchInstanceId').value = '';
            document.getElementById('searchPrivateIp').value = '';
            document.getElementById('searchPublicIp').value = '';
            document.getElementById('searchEipAddress').value = '';
            searchFilters = {
                instanceName: '',
                instanceId: '',
                privateIp: '',
                publicIp: '',
                eipAddress: ''
            };
            currentPage = 1;
            loadInstances();
        });
    }
});

async function loadInstances() {
    const currentKey = keyStore.getCurrentKey();
    if (!currentKey) {
        showError('未找到 AccessKey,请先登录');
        return;
    }

    showLoading();
    hideError();

    try {
        console.log('Loading instances for region:', currentRegion, 'page:', currentPage, 'filters:', searchFilters);

        // 构建 API 搜索过滤器
        const apiFilters = {};

        // 实例名称（支持通配符 * 模糊搜索）
        if (searchFilters.instanceName) {
            // 如果用户没有输入通配符，自动添加 *keyword* 实现模糊搜索
            let namePattern = searchFilters.instanceName;
            if (!namePattern.includes('*')) {
                namePattern = `*${namePattern}*`;
            }
            apiFilters.instanceName = namePattern;
        }

        // 实例 ID（精确匹配）
        if (searchFilters.instanceId) {
            apiFilters.instanceIds = [searchFilters.instanceId];
        }

        // 内网 IP（精确匹配）
        if (searchFilters.privateIp) {
            apiFilters.privateIp = searchFilters.privateIp;
        }

        // 公网 IP（精确匹配）
        if (searchFilters.publicIp) {
            apiFilters.publicIp = searchFilters.publicIp;
        }

        // EIP 地址（精确匹配）
        if (searchFilters.eipAddress) {
            apiFilters.eipAddress = searchFilters.eipAddress;
        }

        const data = await DescribeInstances(
            currentRegion,
            currentKey.accessKeyId,
            currentKey.accessKeySecret,
            currentPage,
            pageSize,
            apiFilters
        );

        if (data.Code) {
            showError(`API错误 [${data.Code}]: ${data.Message}`);
            hideLoading();
            return;
        }

        const instances = data.Instances?.Instance || [];
        totalCount = data.TotalCount || 0;

        renderInstances(instances);

        const totalPages = Math.ceil(totalCount / pageSize);
        renderPagination('pagination', currentPage, totalPages, totalCount, pageSize, (page) => {
            currentPage = page;
            loadInstances();
        });

        hideLoading();
    } catch (error) {
        console.error('Error loading instances:', error);
        showError('加载实例列表失败: ' + error.message);
        hideLoading();
    }
}

function renderInstances(instances) {
    const tbody = document.getElementById('instancesBody');
    tbody.innerHTML = '';

    if (instances.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">暂无数据</td></tr>';
        return;
    }

    instances.forEach(instance => {
        // 获取公网 IP：优先显示固定公网 IP，如果没有则显示绑定的 EIP
        let publicIp = instance.PublicIpAddress?.IpAddress?.[0];
        if (!publicIp && instance.EipAddress?.IpAddress) {
            publicIp = `${instance.EipAddress.IpAddress} (EIP)`;
        }
        if (!publicIp) {
            publicIp = '-';
        }

        const privateIp = instance.VpcAttributes?.PrivateIpAddress?.IpAddress?.[0] ||
                         instance.InnerIpAddress?.IpAddress?.[0] || '-';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${instance.InstanceId}</td>
            <td>${instance.InstanceName || '-'}</td>
            <td>${formatStatus(instance.Status)}</td>
            <td>${publicIp}</td>
            <td>${privateIp}</td>
            <td>${instance.InstanceType}</td>
            <td>${instance.RegionId} / ${instance.ZoneId}</td>
            <td>${formatTime(instance.CreationTime)}</td>
        `;
        tbody.appendChild(row);
    });
}
