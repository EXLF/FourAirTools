/**
 * 防抖函数，用于限制函数触发的频率。
 * @param {function} func - 需要防抖的函数。
 * @param {number} wait - 延迟的毫秒数。
 * @returns {function} - 经过防抖处理的函数。
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 截断钱包地址以便显示。
 * @param {string} address - 完整的钱包地址。
 * @returns {string} - 截断后的地址，如果地址过短或无效则返回原地址。
 */
export function truncateAddress(address) {
    if (!address || typeof address !== 'string' || address.length < 10) return address;
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

/**
 * 向指定的日志容器添加一条日志条目。
 * @param {'info'|'success'|'pending'|'error'} type - 日志级别。
 * @param {string} source - 日志来源 (例如, '系统', 钱包地址)。
 * @param {string} message - 日志消息。
 * @param {HTMLElement} containerElement - 要附加日志条目的 DOM 元素。
 */
export function addLogEntry(type, source, message, containerElement) {
    if (!containerElement) {
        console.warn("Log container not provided for addLogEntry.");
        return;
    }

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    entry.innerHTML = `
        <span class="time">${timeStr}</span>
        <span class="wallet">${truncateAddress(source)}</span>
        <span class="message">${message}</span>
    `;

    containerElement.appendChild(entry);
    // 滚动到底部
    containerElement.scrollTop = containerElement.scrollHeight;
} 