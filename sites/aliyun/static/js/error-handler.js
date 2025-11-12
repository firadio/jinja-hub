/**
 * 全局错误处理模块
 * 提供友好的错误提示、错误边界、API 重试等功能
 */

class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 50;
        this.retryConfig = {
            maxRetries: 3,
            retryDelay: 1000,
            retryableErrors: ['NetworkError', 'TimeoutError']
        };
    }

    /**
     * 初始化错误处理器
     */
    init() {
        this.setupGlobalHandlers();
        this.setupPromiseRejectionHandler();
        this.injectToastContainer();
        console.log('[ErrorHandler] 已初始化');
    }

    /**
     * 设置全局错误处理器
     */
    setupGlobalHandlers() {
        // 捕获 JavaScript 运行时错误
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'runtime',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });

        // 捕获资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleError({
                    type: 'resource',
                    message: `资源加载失败: ${event.target.src || event.target.href}`,
                    target: event.target
                });
            }
        }, true);
    }

    /**
     * 设置 Promise 拒绝处理器
     */
    setupPromiseRejectionHandler() {
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: event.reason?.message || String(event.reason),
                error: event.reason
            });
        });
    }

    /**
     * 注入 Toast 容器
     */
    injectToastContainer() {
        const style = document.createElement('style');
        style.textContent = `
            .error-toast-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 10px;
                max-width: 400px;
            }

            .error-toast {
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                padding: 16px;
                display: flex;
                align-items: flex-start;
                gap: 12px;
                animation: slideIn 0.3s ease;
                border-left: 4px solid #f14c4c;
            }

            .error-toast.warning {
                border-left-color: #cca700;
            }

            .error-toast.info {
                border-left-color: #0e639c;
            }

            .error-toast.success {
                border-left-color: #4ec9b0;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }

            .error-toast.hiding {
                animation: slideOut 0.3s ease;
            }

            .error-toast-icon {
                font-size: 24px;
                flex-shrink: 0;
            }

            .error-toast-content {
                flex: 1;
                min-width: 0;
            }

            .error-toast-title {
                font-weight: 600;
                font-size: 14px;
                color: #333;
                margin-bottom: 4px;
            }

            .error-toast-message {
                font-size: 13px;
                color: #666;
                word-break: break-word;
            }

            .error-toast-actions {
                display: flex;
                gap: 8px;
                margin-top: 8px;
            }

            .error-toast-btn {
                padding: 4px 12px;
                border: none;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                background: #f0f0f0;
                color: #333;
            }

            .error-toast-btn:hover {
                background: #e0e0e0;
            }

            .error-toast-btn.primary {
                background: #ff6a00;
                color: white;
            }

            .error-toast-btn.primary:hover {
                background: #ff8533;
            }

            .error-toast-close {
                background: transparent;
                border: none;
                font-size: 20px;
                color: #999;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }

            .error-toast-close:hover {
                color: #333;
            }

            /* 加载动画 */
            .error-loading {
                display: inline-block;
                width: 16px;
                height: 16px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #ff6a00;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.className = 'error-toast-container';
        container.id = 'error-toast-container';
        document.body.appendChild(container);

        this.toastContainer = container;
    }

    /**
     * 处理错误
     */
    handleError(errorInfo) {
        // 记录错误
        this.logError(errorInfo);

        // 判断错误类型并显示相应提示
        if (errorInfo.type === 'resource') {
            // 资源加载错误通常不需要显示给用户
            console.warn('[ErrorHandler] Resource load error:', errorInfo.message);
        } else {
            // 显示用户友好的错误提示
            this.showToast({
                type: 'error',
                title: this.getErrorTitle(errorInfo),
                message: this.getErrorMessage(errorInfo),
                actions: this.getErrorActions(errorInfo)
            });
        }
    }

    /**
     * 记录错误
     */
    logError(errorInfo) {
        const error = {
            ...errorInfo,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };

        this.errors.push(error);

        // 限制错误数量
        if (this.errors.length > this.maxErrors) {
            this.errors.shift();
        }

        console.error('[ErrorHandler]', error);
    }

    /**
     * 获取错误标题
     */
    getErrorTitle(errorInfo) {
        switch (errorInfo.type) {
            case 'runtime':
                return '程序错误';
            case 'promise':
                return 'API 调用失败';
            case 'network':
                return '网络错误';
            case 'auth':
                return '认证失败';
            default:
                return '出错了';
        }
    }

    /**
     * 获取用户友好的错误消息
     */
    getErrorMessage(errorInfo) {
        const message = errorInfo.message || '未知错误';

        // API 错误处理
        if (message.includes('NetworkError') || message.includes('Failed to fetch')) {
            return '网络连接失败,请检查网络设置';
        }

        if (message.includes('InvalidAccessKeyId')) {
            return 'AccessKey ID 无效,请检查密钥配置';
        }

        if (message.includes('SignatureDoesNotMatch')) {
            return 'AccessKey Secret 错误,请检查密钥配置';
        }

        if (message.includes('Forbidden.RAM')) {
            return '权限不足,请检查 RAM 角色权限';
        }

        if (message.includes('Throttling')) {
            return 'API 调用频率超限,请稍后重试';
        }

        // 通用错误消息截断
        if (message.length > 200) {
            return message.substring(0, 200) + '...';
        }

        return message;
    }

    /**
     * 获取错误操作按钮
     */
    getErrorActions(errorInfo) {
        const actions = [];

        // 网络错误 - 提供重试按钮
        if (errorInfo.type === 'network' || errorInfo.message?.includes('NetworkError')) {
            actions.push({
                text: '重试',
                primary: true,
                action: () => window.location.reload()
            });
        }

        // 认证错误 - 提供跳转到登录页
        if (errorInfo.type === 'auth' || errorInfo.message?.includes('InvalidAccessKey')) {
            actions.push({
                text: '重新登录',
                primary: true,
                action: () => {
                    const basePath = window.APP_CONFIG?.base_path || '';
                    window.location.href = `${basePath}/login.html`;
                }
            });
        }

        return actions;
    }

    /**
     * 显示 Toast 提示
     */
    showToast({ type = 'error', title, message, duration = 5000, actions = [] }) {
        const toast = document.createElement('div');
        toast.className = `error-toast ${type}`;

        const icons = {
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️',
            success: '✅'
        };

        toast.innerHTML = `
            <div class="error-toast-icon">${icons[type] || icons.error}</div>
            <div class="error-toast-content">
                <div class="error-toast-title">${title}</div>
                <div class="error-toast-message">${message}</div>
                ${actions.length > 0 ? `
                    <div class="error-toast-actions">
                        ${actions.map((action, index) => `
                            <button class="error-toast-btn ${action.primary ? 'primary' : ''}" data-action="${index}">
                                ${action.text}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <button class="error-toast-close">×</button>
        `;

        // 绑定操作按钮事件
        actions.forEach((action, index) => {
            const btn = toast.querySelector(`[data-action="${index}"]`);
            if (btn) {
                btn.addEventListener('click', () => {
                    action.action();
                    this.hideToast(toast);
                });
            }
        });

        // 绑定关闭按钮
        toast.querySelector('.error-toast-close').addEventListener('click', () => {
            this.hideToast(toast);
        });

        this.toastContainer.appendChild(toast);

        // 自动隐藏
        if (duration > 0) {
            setTimeout(() => {
                this.hideToast(toast);
            }, duration);
        }

        return toast;
    }

    /**
     * 隐藏 Toast
     */
    hideToast(toast) {
        toast.classList.add('hiding');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }

    /**
     * API 调用包装器 - 带重试和错误处理
     */
    async callApi(apiFunction, options = {}) {
        const {
            maxRetries = this.retryConfig.maxRetries,
            retryDelay = this.retryConfig.retryDelay,
            onRetry = null,
            showLoading = true
        } = options;

        let lastError;
        let loadingToast;

        if (showLoading) {
            loadingToast = this.showToast({
                type: 'info',
                title: '加载中',
                message: '<span class="error-loading"></span> 正在请求数据...',
                duration: 0
            });
        }

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await apiFunction();

                if (loadingToast) {
                    this.hideToast(loadingToast);
                }

                return result;
            } catch (error) {
                lastError = error;

                console.warn(`[ErrorHandler] API call failed (attempt ${attempt + 1}/${maxRetries + 1}):`, error);

                // 如果还有重试次数
                if (attempt < maxRetries) {
                    if (onRetry) {
                        onRetry(attempt + 1, maxRetries);
                    }

                    // 更新加载提示
                    if (loadingToast) {
                        const message = loadingToast.querySelector('.error-toast-message');
                        message.innerHTML = `<span class="error-loading"></span> 重试中 (${attempt + 1}/${maxRetries})...`;
                    }

                    // 等待后重试
                    await this.sleep(retryDelay * (attempt + 1));
                } else {
                    // 最后一次尝试也失败了
                    if (loadingToast) {
                        this.hideToast(loadingToast);
                    }

                    this.handleError({
                        type: 'network',
                        message: error.message || String(error),
                        error: error
                    });

                    throw error;
                }
            }
        }

        throw lastError;
    }

    /**
     * 延迟函数
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 显示成功提示
     */
    success(message, title = '成功') {
        this.showToast({
            type: 'success',
            title,
            message,
            duration: 3000
        });
    }

    /**
     * 显示警告提示
     */
    warning(message, title = '警告') {
        this.showToast({
            type: 'warning',
            title,
            message,
            duration: 4000
        });
    }

    /**
     * 显示信息提示
     */
    info(message, title = '提示') {
        this.showToast({
            type: 'info',
            title,
            message,
            duration: 3000
        });
    }

    /**
     * 显示错误提示
     */
    error(message, title = '错误') {
        this.showToast({
            type: 'error',
            title,
            message,
            duration: 5000
        });
    }

    /**
     * 获取所有错误日志
     */
    getErrors() {
        return this.errors;
    }

    /**
     * 清除错误日志
     */
    clearErrors() {
        this.errors = [];
    }
}

// 自动初始化
document.addEventListener('DOMContentLoaded', () => {
    window.errorHandler = new ErrorHandler();
    window.errorHandler.init();
});

// 导出到全局作用域
window.ErrorHandler = ErrorHandler;
