// 通用工具函数 - 无自动跳转版本

const keyStore = new AccessKeyStore();

// 获取 base_path，默认为空
const basePath = window.APP_CONFIG?.base_path || '';

document.addEventListener('DOMContentLoaded', function() {
    const isLoginPage = window.location.pathname.endsWith('/login.html') || window.location.pathname === basePath + '/';

    // 如果不是登录页且未登录，显示友好提示
    if (!isLoginPage && !keyStore.isLoggedIn()) {
        document.body.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f5f7fa;">
                <div style="text-align: center; background: white; padding: 60px 80px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                    <div style="font-size: 48px; margin-bottom: 20px;">🔐</div>
                    <h2 style="color: #333; margin-bottom: 10px;">需要登录</h2>
                    <p style="color: #666; margin-bottom: 30px;">您需要先登录才能访问此页面</p>
                    <a href="${basePath}/login.html" class="btn btn-primary" style="padding: 12px 40px; font-size: 16px;">前往登录</a>
                </div>
            </div>
        `;
        return;
    }

    if (isLoginPage) {
        return;
    }

    // 初始化导航栏
    initNavbar();

    // 高亮当前页面导航
    highlightCurrentNav();

    // AccessKey 切换
    const keySelector = document.getElementById('accessKeySelector');
    if (keySelector) {
        keySelector.addEventListener('change', function() {
            const index = parseInt(this.value);
            if (keyStore.switchKey(index)) {
                // 自动刷新页面以使用新密钥
                location.reload();
            }
        });
    }

    // 密钥管理模态框
    const manageKeysBtn = document.getElementById('manageKeysBtn');
    const keyManagerModal = document.getElementById('keyManagerModal');
    const closeKeyManager = document.getElementById('closeKeyManager');
    const addKeyForm = document.getElementById('addKeyForm');
    const keysList = document.getElementById('keysList');

    if (manageKeysBtn && keyManagerModal) {
        manageKeysBtn.addEventListener('click', function() {
            keyManagerModal.style.display = 'block';
            renderKeysList();
        });
    }

    if (closeKeyManager) {
        closeKeyManager.addEventListener('click', function() {
            keyManagerModal.style.display = 'none';
        });
    }

    window.addEventListener('click', function(event) {
        if (event.target == keyManagerModal) {
            keyManagerModal.style.display = 'none';
        }
    });

    if (addKeyForm) {
        addKeyForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const formData = new FormData(addKeyForm);
            const newKey = {
                name: formData.get('name'),
                accessKeyId: formData.get('accessKeyId'),
                accessKeySecret: formData.get('accessKeySecret')
            };

            const result = keyStore.addKey(newKey);
            if (!result.success) {
                alert(result.message);
                return;
            }

            addKeyForm.reset();
            renderKeysList(); // 刷新列表
            initNavbar(); // 刷新导航栏选择器
        });
    }

    // 退出登录
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (confirm('确定要退出登录吗？所有保存的 AccessKey 将被清除。')) {
                keyStore.clear();
                // 自动跳转到登录页面
                window.location.href = `${basePath}/login.html`;
            }
        });
    }
});

// 初始化导航栏
function initNavbar() {
    const currentKeyName = document.getElementById('currentKeyName');
    if (currentKeyName) {
        const currentKey = keyStore.getCurrentKey();
        if (currentKey) {
            currentKeyName.textContent = currentKey.name;
        }
    }
}

// 高亮当前页面导航
function highlightCurrentNav() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-menu a');

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        // 移除 base_path 前缀比较
        const currentPage = currentPath.split('/').pop();
        const linkPage = linkPath.split('/').pop();

        if (currentPage === linkPage) {
            link.style.borderBottomColor = '#fff';
            link.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        }
    });
}

// 渲染分页控件
function renderPagination(containerId, currentPage, totalPages, totalItems, pageSize, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }

    const startItem = (currentPage - 1) * pageSize + 1;
    const endItem = Math.min(currentPage * pageSize, totalItems);

    container.innerHTML = `
        <button id="prevPage" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>
        <span class="page-number">第 ${currentPage} / ${totalPages} 页</span>
        <button id="nextPage" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>
        <span class="pagination-info">共 ${totalItems} 条，显示 ${startItem}-${endItem}</span>
    `;

    const prevBtn = container.querySelector('#prevPage');
    const nextBtn = container.querySelector('#nextPage');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                // 禁用按钮防止重复点击
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                prevBtn.textContent = '加载中...';
                onPageChange(currentPage - 1);
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                // 禁用按钮防止重复点击
                prevBtn.disabled = true;
                nextBtn.disabled = true;
                nextBtn.textContent = '加载中...';
                onPageChange(currentPage + 1);
            }
        });
    }
}

// 加载地域列表
async function loadRegions(regionSelectId) {
    const regionSelect = document.getElementById(regionSelectId);
    if (!regionSelect) return;

    const currentKey = keyStore.getCurrentKey();
    if (!currentKey) return;

    try {
        const data = await DescribeRegions(currentKey.accessKeyId, currentKey.accessKeySecret);

        if (data.Code) {
            console.error('获取地域列表失败:', data.Message);
            return;
        }

        const regions = data.Regions?.Region || [];
        const currentValue = regionSelect.value || keyStore.getDefaultRegion();

        regionSelect.innerHTML = '';
        regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region.RegionId;
            option.textContent = `${region.LocalName} (${region.RegionId})`;
            if (region.RegionId === currentValue) {
                option.selected = true;
            }
            regionSelect.appendChild(option);
        });

        // 如果当前值不在列表中，选择第一个
        if (!regions.find(r => r.RegionId === currentValue) && regions.length > 0) {
            regionSelect.value = regions[0].RegionId;
        }
    } catch (error) {
        console.error('加载地域列表失败:', error);
    }
}

// 格式化状态
function formatStatus(status) {
    const statusMap = {
        'Running': { text: '运行中', class: 'status-running' },
        'Stopped': { text: '已停止', class: 'status-stopped' },
        'Available': { text: '可用', class: 'status-available' },
        'InUse': { text: '使用中', class: 'status-running' },
        'Associating': { text: '绑定中', class: 'status-available' }
    };

    const statusInfo = statusMap[status] || { text: status, class: '' };
    return `<span class="status-badge ${statusInfo.class}">${statusInfo.text}</span>`;
}

// 格式化时间
function formatTime(timeStr) {
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

// 显示错误
function showError(message) {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

// 隐藏错误
function hideError() {
    const errorDiv = document.getElementById('error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
    }
}

// 显示加载
function showLoading() {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'block';
    }
}

// 隐藏加载
function hideLoading() {
    const loadingDiv = document.getElementById('loading');
    if (loadingDiv) {
        loadingDiv.style.display = 'none';
    }
}

// 渲染密钥列表
function renderKeysList() {
    const keysList = document.getElementById('keysList');
    if (!keysList) return;

    const keys = keyStore.getKeys();
    const currentIndex = keyStore.getCurrentIndex();

    if (keys.length === 0) {
        keysList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #999;">
                <div style="font-size: 48px; margin-bottom: 10px;">🔑</div>
                <p>暂无密钥，请添加一个新密钥</p>
            </div>
        `;
        return;
    }

    keysList.innerHTML = keys.map((key, index) => `
        <div class="key-item ${index === currentIndex ? 'active' : ''}" data-index="${index}">
            <div class="key-item-info">
                <div class="key-item-name">${key.name}</div>
                <div class="key-item-id">${key.accessKeyId}</div>
            </div>
            <div class="key-item-actions">
                ${index !== currentIndex ? `<button class="btn btn-sm btn-primary" onclick="switchToKey(${index})">切换</button>` : ''}
                <button class="btn btn-sm" style="background-color: #17a2b8; color: white;" onclick="editKey(${index})">编辑</button>
                <button class="btn btn-sm btn-danger" onclick="deleteKey(${index})">删除</button>
            </div>
        </div>
    `).join('');
}

// 切换到指定密钥
function switchToKey(index) {
    if (keyStore.switchKey(index)) {
        location.reload();
    }
}

// 删除密钥
function deleteKey(index) {
    const keys = keyStore.getKeys();
    const key = keys[index];

    if (confirm(`确定要删除密钥 "${key.name}" 吗？`)) {
        if (keyStore.deleteKey(index)) {
            renderKeysList();
            initNavbar();

            // 如果删除了所有密钥，跳转到登录页
            if (keyStore.getKeys().length === 0) {
                window.location.href = `${basePath}/login.html`;
            }
        }
    }
}

// 编辑密钥
function editKey(index) {
    const keys = keyStore.getKeys();
    const key = keys[index];

    // 创建编辑对话框
    const editModal = document.createElement('div');
    editModal.className = 'modal';
    editModal.style.display = 'block';
    editModal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <span class="close" id="closeEditModal">&times;</span>
            <h2>编辑密钥</h2>
            <form id="editKeyForm">
                <div class="form-group">
                    <label>名称:</label>
                    <input type="text" name="name" value="${key.name}" required>
                </div>
                <div class="form-group">
                    <label>AccessKey ID:</label>
                    <input type="text" name="accessKeyId" value="${key.accessKeyId}" required>
                </div>
                <div class="form-group">
                    <label>AccessKey Secret:</label>
                    <input type="password" name="accessKeySecret" value="${key.accessKeySecret}" required>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button type="submit" class="btn btn-primary">保存</button>
                    <button type="button" class="btn" style="background-color: #6c757d; color: white;" id="cancelEdit">取消</button>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(editModal);

    // 关闭按钮
    const closeBtn = editModal.querySelector('#closeEditModal');
    const cancelBtn = editModal.querySelector('#cancelEdit');
    closeBtn.onclick = () => editModal.remove();
    cancelBtn.onclick = () => editModal.remove();
    editModal.onclick = (e) => {
        if (e.target === editModal) editModal.remove();
    };

    // 提交表单
    const editForm = editModal.querySelector('#editKeyForm');
    editForm.onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(editForm);
        const updatedKey = {
            name: formData.get('name'),
            accessKeyId: formData.get('accessKeyId'),
            accessKeySecret: formData.get('accessKeySecret')
        };

        const result = keyStore.updateKey(index, updatedKey);
        if (!result.success) {
            alert(result.message);
            return;
        }

        editModal.remove();
        renderKeysList();
        initNavbar();

        // 如果编辑的是当前密钥，刷新页面以使用新密钥
        if (index === keyStore.getCurrentIndex()) {
            location.reload();
        }
    };
}
