// EIP 列表页面 - 后端分页版本

let currentRegion = 'cn-hangzhou';
let currentPage = 1;
let pageSize = 10;
let totalCount = 0;
let searchFilters = {
    eipName: '',
    ipAddress: '',
    allocationId: '',
    instanceId: ''
};

document.addEventListener('DOMContentLoaded', async function() {
    const regionSelect = document.getElementById('regionSelect');
    const refreshBtn = document.getElementById('refreshBtn');
    const searchToggleBtn = document.getElementById('searchToggleBtn');
    const searchPanel = document.getElementById('searchPanel');
    const searchBtn = document.getElementById('searchBtn');
    const resetSearchBtn = document.getElementById('resetSearchBtn');

    currentRegion = keyStore.getDefaultRegion();
    await loadRegions('regionSelect');
    loadEips();

    if (regionSelect) {
        regionSelect.addEventListener('change', function() {
            currentRegion = this.value;
            keyStore.setDefaultRegion(currentRegion);
            currentPage = 1;
            loadEips();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            currentPage = 1;
            loadEips();
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
            searchFilters.eipName = document.getElementById('searchEipName')?.value.trim() || '';
            searchFilters.ipAddress = document.getElementById('searchIpAddress')?.value.trim() || '';
            searchFilters.allocationId = document.getElementById('searchAllocationId')?.value.trim() || '';
            searchFilters.instanceId = document.getElementById('searchInstanceId')?.value.trim() || '';
            currentPage = 1;
            loadEips();
        });
    }

    // 重置按钮
    if (resetSearchBtn) {
        resetSearchBtn.addEventListener('click', function() {
            document.getElementById('searchEipName').value = '';
            document.getElementById('searchIpAddress').value = '';
            document.getElementById('searchAllocationId').value = '';
            document.getElementById('searchInstanceId').value = '';
            searchFilters = {
                eipName: '',
                ipAddress: '',
                allocationId: '',
                instanceId: ''
            };
            currentPage = 1;
            loadEips();
        });
    }
});

async function loadEips() {
    const currentKey = keyStore.getCurrentKey();
    if (!currentKey) {
        showError('未找到 AccessKey,请先登录');
        return;
    }

    showLoading();
    hideError();

    try {
        console.log('Loading EIPs for region:', currentRegion, 'page:', currentPage, 'filters:', searchFilters);

        // 构建 API 搜索过滤器
        const apiFilters = {};

        // EIP名称（支持模糊搜索，添加通配符）
        if (searchFilters.eipName) {
            let namePattern = searchFilters.eipName;
            if (!namePattern.includes('*')) {
                namePattern = `*${namePattern}*`;
            }
            apiFilters.eipName = namePattern;
        }

        // IP地址（精确匹配）
        if (searchFilters.ipAddress) {
            apiFilters.eipAddress = searchFilters.ipAddress;
        }

        // EIP ID（精确匹配）
        if (searchFilters.allocationId) {
            apiFilters.allocationId = searchFilters.allocationId;
        }

        // 绑定实例ID（精确匹配）
        if (searchFilters.instanceId) {
            apiFilters.associatedInstanceId = searchFilters.instanceId;
        }

        const data = await DescribeEipAddresses(
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

        const eips = data.EipAddresses?.EipAddress || [];
        totalCount = data.TotalCount || 0;

        renderEips(eips);

        const totalPages = Math.ceil(totalCount / pageSize);
        renderPagination('pagination', currentPage, totalPages, totalCount, pageSize, (page) => {
            currentPage = page;
            loadEips();
        });

        hideLoading();
    } catch (error) {
        console.error('Error loading EIPs:', error);
        showError('加载EIP列表失败: ' + error.message);
        hideLoading();
    }
}

function renderEips(eips) {
    const tbody = document.getElementById('eipsBody');
    tbody.innerHTML = '';

    if (eips.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">暂无数据</td></tr>';
        return;
    }

    eips.forEach(eip => {
        const instanceId = eip.InstanceId || '-';
        const chargeTypeMap = {
            'PostPaid': '按量付费',
            'PrePaid': '包年包月'
        };
        const chargeType = chargeTypeMap[eip.ChargeType] || eip.ChargeType;

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${eip.AllocationId}</td>
            <td>${eip.IpAddress}</td>
            <td>${eip.Name || '-'}</td>
            <td>${formatStatus(eip.Status)}</td>
            <td>${eip.Bandwidth} Mbps</td>
            <td>${instanceId}</td>
            <td>${chargeType}</td>
            <td>${formatTime(eip.AllocationTime)}</td>
        `;
        tbody.appendChild(row);
    });
}
