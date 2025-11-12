/**
 * 开发者工具
 * 提供调试面板、状态查看、数据导出等功能
 */

class DevTools {
    constructor() {
        this.isOpen = false;
        this.activeTab = 'state';
        this.logs = [];
        this.maxLogs = 100;

        // 拦截 console 方法
        this.interceptConsole();

        // 监听键盘快捷键
        this.setupKeyboardShortcuts();
    }

    /**
     * 初始化开发者工具
     */
    init() {
        // 只在开发环境启用 (检测 localhost 或特定参数)
        if (!this.shouldEnable()) {
            return;
        }

        this.injectStyles();
        this.injectPanel();
        this.attachEventListeners();

        console.log('[DevTools] 已启用 - 按 Ctrl+Shift+D 打开面板');
    }

    /**
     * 判断是否应该启用开发者工具
     */
    shouldEnable() {
        // 在 localhost 或有 ?debug 参数时启用
        const isLocalhost = window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1';
        const hasDebugParam = new URLSearchParams(window.location.search).has('debug');

        return isLocalhost || hasDebugParam;
    }

    /**
     * 拦截 console 方法记录日志
     */
    interceptConsole() {
        const originalLog = console.log;
        const originalError = console.error;
        const originalWarn = console.warn;

        console.log = (...args) => {
            this.addLog('log', args);
            originalLog.apply(console, args);
        };

        console.error = (...args) => {
            this.addLog('error', args);
            originalError.apply(console, args);
        };

        console.warn = (...args) => {
            this.addLog('warn', args);
            originalWarn.apply(console, args);
        };
    }

    /**
     * 添加日志记录
     */
    addLog(type, args) {
        const log = {
            type,
            message: args.map(arg =>
                typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
            ).join(' '),
            timestamp: new Date().toLocaleTimeString()
        };

        this.logs.push(log);

        // 限制日志数量
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // 如果面板已打开,更新日志显示
        if (this.isOpen) {
            this.updateLogsTab();
        }
    }

    /**
     * 设置键盘快捷键
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Shift+D 切换面板
            if (e.ctrlKey && e.shiftKey && e.key === 'D') {
                e.preventDefault();
                this.toggle();
            }

            // ESC 关闭面板
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });
    }

    /**
     * 注入样式
     */
    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .dev-tools {
                position: fixed;
                bottom: 0;
                right: 0;
                width: 600px;
                height: 400px;
                background: #1e1e1e;
                color: #d4d4d4;
                border: 1px solid #3c3c3c;
                border-radius: 8px 0 0 0;
                box-shadow: -2px -2px 10px rgba(0,0,0,0.3);
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 12px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                transition: transform 0.3s ease;
            }

            .dev-tools.closed {
                transform: translateY(100%);
            }

            .dev-tools-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #252526;
                border-bottom: 1px solid #3c3c3c;
                cursor: move;
            }

            .dev-tools-title {
                font-weight: 600;
                color: #ff6a00;
            }

            .dev-tools-controls {
                display: flex;
                gap: 8px;
            }

            .dev-tools-btn {
                background: transparent;
                border: 1px solid #3c3c3c;
                color: #d4d4d4;
                padding: 2px 8px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
            }

            .dev-tools-btn:hover {
                background: #3c3c3c;
            }

            .dev-tools-tabs {
                display: flex;
                border-bottom: 1px solid #3c3c3c;
                background: #2d2d30;
            }

            .dev-tools-tab {
                padding: 8px 16px;
                background: transparent;
                border: none;
                color: #969696;
                cursor: pointer;
                border-bottom: 2px solid transparent;
            }

            .dev-tools-tab:hover {
                color: #d4d4d4;
            }

            .dev-tools-tab.active {
                color: #ff6a00;
                border-bottom-color: #ff6a00;
            }

            .dev-tools-content {
                flex: 1;
                overflow-y: auto;
                padding: 12px;
            }

            .dev-tools-section {
                margin-bottom: 16px;
            }

            .dev-tools-section-title {
                font-weight: 600;
                color: #ff6a00;
                margin-bottom: 8px;
                font-size: 13px;
            }

            .dev-tools-pre {
                background: #252526;
                padding: 8px;
                border-radius: 4px;
                overflow-x: auto;
                max-height: 200px;
                margin: 4px 0;
            }

            .dev-tools-action {
                display: inline-block;
                margin: 4px 8px 4px 0;
                padding: 4px 12px;
                background: #0e639c;
                color: white;
                border: none;
                border-radius: 3px;
                cursor: pointer;
                font-size: 11px;
            }

            .dev-tools-action:hover {
                background: #1177bb;
            }

            .dev-tools-action.danger {
                background: #c72e2e;
            }

            .dev-tools-action.danger:hover {
                background: #e04747;
            }

            .dev-log {
                padding: 4px 8px;
                margin: 2px 0;
                border-left: 3px solid #3c3c3c;
                background: #252526;
            }

            .dev-log.error {
                border-left-color: #f14c4c;
                background: #2d1f1f;
            }

            .dev-log.warn {
                border-left-color: #cca700;
                background: #2d2a1f;
            }

            .dev-log-time {
                color: #858585;
                margin-right: 8px;
            }

            .dev-tools-stat {
                display: flex;
                justify-content: space-between;
                padding: 6px 0;
                border-bottom: 1px solid #3c3c3c;
            }

            .dev-tools-stat-label {
                color: #969696;
            }

            .dev-tools-stat-value {
                color: #4ec9b0;
                font-weight: 600;
            }

            /* 最小化按钮 */
            .dev-tools-toggle {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: #ff6a00;
                color: white;
                border: none;
                border-radius: 50%;
                cursor: pointer;
                font-size: 20px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                z-index: 9998;
                display: none;
            }

            .dev-tools-toggle.visible {
                display: block;
            }

            .dev-tools-toggle:hover {
                background: #ff8533;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * 注入面板 HTML
     */
    injectPanel() {
        const panel = document.createElement('div');
        panel.className = 'dev-tools closed';
        panel.innerHTML = `
            <div class="dev-tools-header">
                <div class="dev-tools-title">🛠️ 开发者工具</div>
                <div class="dev-tools-controls">
                    <button class="dev-tools-btn" id="dev-tools-minimize">最小化</button>
                    <button class="dev-tools-btn" id="dev-tools-close">关闭</button>
                </div>
            </div>
            <div class="dev-tools-tabs">
                <button class="dev-tools-tab active" data-tab="state">状态</button>
                <button class="dev-tools-tab" data-tab="storage">存储</button>
                <button class="dev-tools-tab" data-tab="logs">日志</button>
                <button class="dev-tools-tab" data-tab="actions">操作</button>
            </div>
            <div class="dev-tools-content" id="dev-tools-content">
                <!-- 动态内容 -->
            </div>
        `;
        document.body.appendChild(panel);

        // 添加切换按钮
        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'dev-tools-toggle';
        toggleBtn.innerHTML = '🛠️';
        toggleBtn.id = 'dev-tools-toggle-btn';
        document.body.appendChild(toggleBtn);

        this.panel = panel;
        this.toggleBtn = toggleBtn;
    }

    /**
     * 绑定事件监听器
     */
    attachEventListeners() {
        // 关闭按钮
        document.getElementById('dev-tools-close').addEventListener('click', () => {
            this.close();
        });

        // 最小化按钮
        document.getElementById('dev-tools-minimize').addEventListener('click', () => {
            this.minimize();
        });

        // 切换按钮
        document.getElementById('dev-tools-toggle-btn').addEventListener('click', () => {
            this.open();
        });

        // 标签切换
        document.querySelectorAll('.dev-tools-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // 使面板可拖动
        this.makeDraggable();
    }

    /**
     * 使面板可拖动
     */
    makeDraggable() {
        const header = this.panel.querySelector('.dev-tools-header');
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            initialX = e.clientX - this.panel.offsetLeft;
            initialY = e.clientY - this.panel.offsetTop;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;

                this.panel.style.left = currentX + 'px';
                this.panel.style.top = currentY + 'px';
                this.panel.style.right = 'auto';
                this.panel.style.bottom = 'auto';
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });
    }

    /**
     * 切换标签
     */
    switchTab(tabName) {
        this.activeTab = tabName;

        // 更新标签样式
        document.querySelectorAll('.dev-tools-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // 更新内容
        this.updateContent();
    }

    /**
     * 更新内容
     */
    updateContent() {
        const content = document.getElementById('dev-tools-content');

        switch (this.activeTab) {
            case 'state':
                content.innerHTML = this.renderStateTab();
                break;
            case 'storage':
                content.innerHTML = this.renderStorageTab();
                break;
            case 'logs':
                content.innerHTML = this.renderLogsTab();
                break;
            case 'actions':
                content.innerHTML = this.renderActionsTab();
                this.attachActionListeners();
                break;
        }
    }

    /**
     * 渲染状态标签
     */
    renderStateTab() {
        const keys = window.appStore.keys.getKeys();
        const currentKeyId = window.appStore.keys.getCurrentKeyId();
        const regions = window.appStore.regions.getCached();

        return `
            <div class="dev-tools-section">
                <div class="dev-tools-section-title">密钥状态</div>
                <div class="dev-tools-stat">
                    <span class="dev-tools-stat-label">密钥数量:</span>
                    <span class="dev-tools-stat-value">${keys.length}</span>
                </div>
                <div class="dev-tools-stat">
                    <span class="dev-tools-stat-label">当前密钥 ID:</span>
                    <span class="dev-tools-stat-value">${currentKeyId !== null ? currentKeyId : '无'}</span>
                </div>
                ${currentKeyId !== null ? `
                <div class="dev-tools-stat">
                    <span class="dev-tools-stat-label">当前密钥名称:</span>
                    <span class="dev-tools-stat-value">${keys[currentKeyId]?.name || '未命名'}</span>
                </div>
                ` : ''}
            </div>

            <div class="dev-tools-section">
                <div class="dev-tools-section-title">缓存状态</div>
                <div class="dev-tools-stat">
                    <span class="dev-tools-stat-label">缓存区域数:</span>
                    <span class="dev-tools-stat-value">${regions ? regions.length : 0}</span>
                </div>
            </div>

            <div class="dev-tools-section">
                <div class="dev-tools-section-title">当前密钥详情</div>
                <pre class="dev-tools-pre">${currentKeyId !== null ? JSON.stringify(keys[currentKeyId], null, 2) : '无'}</pre>
            </div>
        `;
    }

    /**
     * 渲染存储标签
     */
    renderStorageTab() {
        const storageKeys = window.appStore.storage.keys();
        const storageData = {};

        storageKeys.forEach(key => {
            storageData[key] = window.appStore.storage.get(key);
        });

        return `
            <div class="dev-tools-section">
                <div class="dev-tools-section-title">LocalStorage 数据</div>
                <div class="dev-tools-stat">
                    <span class="dev-tools-stat-label">键数量:</span>
                    <span class="dev-tools-stat-value">${storageKeys.length}</span>
                </div>
                <pre class="dev-tools-pre">${JSON.stringify(storageData, null, 2)}</pre>
            </div>
        `;
    }

    /**
     * 渲染日志标签
     */
    renderLogsTab() {
        if (this.logs.length === 0) {
            return '<div style="text-align: center; padding: 40px; color: #858585;">暂无日志</div>';
        }

        return `
            <div class="dev-tools-section">
                <div class="dev-tools-section-title">控制台日志 (最近 ${this.logs.length} 条)</div>
                ${this.logs.map(log => `
                    <div class="dev-log ${log.type}">
                        <span class="dev-log-time">${log.timestamp}</span>
                        <span>${log.message}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * 更新日志标签 (实时更新)
     */
    updateLogsTab() {
        if (this.activeTab === 'logs') {
            this.updateContent();
        }
    }

    /**
     * 渲染操作标签
     */
    renderActionsTab() {
        return `
            <div class="dev-tools-section">
                <div class="dev-tools-section-title">数据操作</div>
                <button class="dev-tools-action" id="export-data">导出数据</button>
                <button class="dev-tools-action" id="import-data">导入数据</button>
                <button class="dev-tools-action danger" id="clear-cache">清除缓存</button>
                <button class="dev-tools-action danger" id="clear-all">清除所有数据</button>
            </div>

            <div class="dev-tools-section">
                <div class="dev-tools-section-title">调试操作</div>
                <button class="dev-tools-action" id="reload-page">重新加载页面</button>
                <button class="dev-tools-action" id="test-api">测试 API 调用</button>
            </div>

            <div class="dev-tools-section">
                <div class="dev-tools-section-title">系统信息</div>
                <pre class="dev-tools-pre">${JSON.stringify({
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    cookieEnabled: navigator.cookieEnabled,
                    onLine: navigator.onLine
                }, null, 2)}</pre>
            </div>
        `;
    }

    /**
     * 绑定操作按钮事件
     */
    attachActionListeners() {
        document.getElementById('export-data')?.addEventListener('click', () => {
            this.exportData();
        });

        document.getElementById('import-data')?.addEventListener('click', () => {
            this.importData();
        });

        document.getElementById('clear-cache')?.addEventListener('click', () => {
            this.clearCache();
        });

        document.getElementById('clear-all')?.addEventListener('click', () => {
            window.appStore.clearAll();
        });

        document.getElementById('reload-page')?.addEventListener('click', () => {
            location.reload();
        });

        document.getElementById('test-api')?.addEventListener('click', () => {
            this.testApi();
        });
    }

    /**
     * 导出数据
     */
    exportData() {
        const data = window.appStore.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jinja-hub-backup-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);

        console.log('[DevTools] 数据已导出');
    }

    /**
     * 导入数据
     */
    importData() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';

        input.onchange = (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    window.appStore.importData(data);
                    console.log('[DevTools] 数据已导入');
                    this.updateContent();
                } catch (err) {
                    console.error('[DevTools] 导入失败:', err);
                    alert('导入失败: ' + err.message);
                }
            };

            reader.readAsText(file);
        };

        input.click();
    }

    /**
     * 清除缓存
     */
    clearCache() {
        if (confirm('确定要清除所有缓存吗？')) {
            window.appStore.cache.clear();
            console.log('[DevTools] 缓存已清除');
            this.updateContent();
        }
    }

    /**
     * 测试 API
     */
    async testApi() {
        console.log('[DevTools] 测试 API 调用...');

        const key = window.appStore.keys.getCurrentKey();
        if (!key) {
            console.error('[DevTools] 未找到当前密钥');
            return;
        }

        try {
            const regions = await window.appStore.regions.load(
                key.accessKeyId,
                key.accessKeySecret
            );
            console.log('[DevTools] API 调用成功, 区域数量:', regions.length);
        } catch (err) {
            console.error('[DevTools] API 调用失败:', err);
        }
    }

    /**
     * 打开面板
     */
    open() {
        this.isOpen = true;
        this.panel.classList.remove('closed');
        this.toggleBtn.classList.remove('visible');
        this.updateContent();
    }

    /**
     * 关闭面板
     */
    close() {
        this.isOpen = false;
        this.panel.classList.add('closed');
    }

    /**
     * 最小化面板
     */
    minimize() {
        this.close();
        this.toggleBtn.classList.add('visible');
    }

    /**
     * 切换面板
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    window.devTools = new DevTools();
    window.devTools.init();
});
