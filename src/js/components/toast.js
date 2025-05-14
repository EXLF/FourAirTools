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
        console.log(`[${Date.now()}] showToast: Timeout fired - Hiding toast element`);
        toast.classList.remove('show');

        // 等待动画结束后再移除元素
        const handleTransitionEnd = (event) => {
            // 确保只处理相关的过渡结束，并且元素仍然存在
            if (event.target === toast && toast.parentElement) {
                console.log(`[${Date.now()}] showToast: Transition ended for ${event.propertyName}, removing element.`);
                toast.remove();
                // 清理事件监听器，防止内存泄漏
                toast.removeEventListener('transitionend', handleTransitionEnd);
            }
        };
        toast.addEventListener('transitionend', handleTransitionEnd);

        // 安全回退：如果由于某些原因过渡事件没有触发，一段时间后也移除元素
        // 这对于transform: translateX(0)到translateX(100%)的过渡可能不是绝对必要，但作为保险措施可以考虑
        // 不过，对于标准的CSS过渡，这通常不是必须的，并可能导致在过渡完成前移除。
        // 为了简化，暂时不添加额外的超时回退，依赖 transitionend。

    }, duration);
} 