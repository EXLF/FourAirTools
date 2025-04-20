/**
 * Toast Notification Component
 */

// 确保 toast 容器存在
function ensureToastContainer() {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * 显示一个 Toast 通知。
 * @param {string} message - 要显示的消息。
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - 通知的类型 (影响样式)。
 * @param {number} [duration=3000] - 通知显示的持续时间 (毫秒)。
 */
export function showToast(message, type = 'info', duration = 3000) {
    console.log(`[${Date.now()}] showToast: Start - "${message}", type: ${type}, duration: ${duration}`);
    const container = ensureToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    console.log(`[${Date.now()}] showToast: Appending toast element`);
    container.appendChild(toast);

    // 触发显示动画 (需要一个小的延迟)
    requestAnimationFrame(() => {
        console.log(`[${Date.now()}] showToast: requestAnimationFrame callback - adding 'show' class`);
        toast.classList.add('show');
    });

    // 设置自动隐藏
    console.log(`[${Date.now()}] showToast: Setting timeout for ${duration}ms`);
    setTimeout(() => {
        console.log(`[${Date.now()}] showToast: Timeout fired - Removing toast element`);
        if (toast.parentElement) {
            toast.remove(); // 直接移除，不使用过渡
            console.log(`[${Date.now()}] showToast: Toast element removed`);
        }
    }, duration);
} 