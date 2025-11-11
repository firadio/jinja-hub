// 交换机列表页面 - 后端分页版本

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
    loadVSwitches();

    if (regionSelect) {
        regionSelect.addEventListener('change', function() {
            currentRegion = this.value;
            keyStore.setDefaultRegion(currentRegion);
            currentPage = 1;
            searchKeyword = '';
            if (searchInput) searchInput.value = '';
            loadVSwitches();
        });
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', function() {
            currentPage = 1;
            loadVSwitches();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                searchKeyword = this.value.trim();
                currentPage = 1;
                loadVSwitches();
            }, 500);
        });
    }
});

async function loadVSwitches() {
    const currentKey = keyStore.getCurrentKey();
    if (!currentKey) {
        showError('未找到 AccessKey,请先登录');
        return;
    }

    showLoading();
    hideError();

    try {
        const data = await DescribeVSwitches(
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

        const vswitches = data.VSwitches?.VSwitch || [];
        totalCount = data.TotalCount || 0;

        let filteredVSwitches = vswitches;
        if (searchKeyword) {
            filteredVSwitches = vswitches.filter(vswitch => {
                const vswitchId = (vswitch.VSwitchId || '').toLowerCase();
                const vswitchName = (vswitch.VSwitchName || '').toLowerCase();
                return vswitchId.includes(searchKeyword.toLowerCase()) ||
                       vswitchName.includes(searchKeyword.toLowerCase());
            });
        }

        renderVSwitches(filteredVSwitches);

        const totalPages = Math.ceil(totalCount / pageSize);
        renderPagination('pagination', currentPage, totalPages, totalCount, pageSize, (page) => {
            currentPage = page;
            loadVSwitches();
        });

        hideLoading();
    } catch (error) {
        console.error('Error loading VSwitches:', error);
        showError('加载交换机列表失败: ' + error.message);
        hideLoading();
    }
}

function renderVSwitches(vswitches) {
    const tbody = document.getElementById('vswitchesBody');
    tbody.innerHTML = '';

    if (vswitches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">暂无数据</td></tr>';
        return;
    }

    vswitches.forEach(vswitch => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${vswitch.VSwitchId}</td>
            <td>${vswitch.VSwitchName || '-'}</td>
            <td>${formatStatus(vswitch.Status)}</td>
            <td>${vswitch.VpcId}</td>
            <td>${vswitch.CidrBlock}</td>
            <td>${vswitch.ZoneId}</td>
            <td>${vswitch.AvailableIpAddressCount}</td>
            <td>${formatTime(vswitch.CreationTime)}</td>
        `;
        tbody.appendChild(row);
    });
}
