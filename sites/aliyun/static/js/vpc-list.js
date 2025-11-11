// VPC 列表页面 - 后端分页版本

let currentRegion = 'cn-hangzhou';
let currentPage = 1;
let pageSize = 10;
let totalCount = 0;
let searchKeyword = '';
let searchTimer = null;

document.addEventListener('DOMContentLoaded', async function() {
    const regionSelect = document.getElementById('regionSelect');
    const refreshBtn = document.getElementById('refreshBtn');
    const searchInput = document.getElementById('searchInput');

    currentRegion = keyStore.getDefaultRegion();
    await loadRegions('regionSelect');
    loadVpcs();

    if (regionSelect) {
        regionSelect.addEventListener('change', function() {
            currentRegion = this.value;
            keyStore.setDefaultRegion(currentRegion);
            currentPage = 1;
            searchKeyword = '';
            if (searchInput) searchInput.value = '';
            loadVpcs();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            currentPage = 1;
            loadVpcs();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchKeyword = this.value.trim();
                currentPage = 1;
                loadVpcs();
            }, 500);
        });
    }
});

async function loadVpcs() {
    const currentKey = keyStore.getCurrentKey();
    if (!currentKey) {
        showError('未找到 AccessKey,请先登录');
        return;
    }

    showLoading();
    hideError();

    try {
        const data = await DescribeVpcs(
            currentRegion,
            currentKey.accessKeyId,
            currentKey.accessKeySecret,
            currentPage,
            pageSize
        );

        if (data.Code) {
            showError(`API错误 [${data.Code}]: ${data.Message}`);
            hideLoading();
            return;
        }

        const vpcs = data.Vpcs?.Vpc || [];
        totalCount = data.TotalCount || 0;

        let filteredVpcs = vpcs;
        if (searchKeyword) {
            filteredVpcs = vpcs.filter(vpc => {
                const vpcId = (vpc.VpcId || '').toLowerCase();
                const vpcName = (vpc.VpcName || '').toLowerCase();
                return vpcId.includes(searchKeyword.toLowerCase()) ||
                       vpcName.includes(searchKeyword.toLowerCase());
            });
        }

        renderVpcs(filteredVpcs);

        const totalPages = Math.ceil(totalCount / pageSize);
        renderPagination('pagination', currentPage, totalPages, totalCount, pageSize, (page) => {
            currentPage = page;
            loadVpcs();
        });

        hideLoading();
    } catch (error) {
        console.error('Error loading VPCs:', error);
        showError('加载VPC列表失败: ' + error.message);
        hideLoading();
    }
}

function renderVpcs(vpcs) {
    const tbody = document.getElementById('vpcsBody');
    tbody.innerHTML = '';

    if (vpcs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">暂无数据</td></tr>';
        return;
    }

    vpcs.forEach(vpc => {
        const ipv6CidrBlock = vpc.Ipv6CidrBlock || '-';
        const vSwitchIds = vpc.VSwitchIds?.VSwitchId || [];

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${vpc.VpcId}</td>
            <td>${vpc.VpcName || '-'}</td>
            <td>${formatStatus(vpc.Status)}</td>
            <td>${vpc.CidrBlock}</td>
            <td>${ipv6CidrBlock}</td>
            <td>${vpc.RegionId}</td>
            <td>${vSwitchIds.length}</td>
            <td>${formatTime(vpc.CreationTime)}</td>
        `;
        tbody.appendChild(row);
    });
}
