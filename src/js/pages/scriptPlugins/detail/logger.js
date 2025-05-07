// 脚本详情页面日志模块

/**
 * 添加日志条目
 * @param {string} type - 日志类型 (info, success, error, warning)
 * @param {string} source - 日志来源
 * @param {string} message - 日志消息
 * @param {HTMLElement} container - 日志容器元素
 */
export function addLogEntry(type, source, message, container) {
    if (!container) return;
    
    const time = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.setAttribute('data-log-type', type);
    
    logEntry.innerHTML = `
        <span class="time">${time}</span>
        <span class="source">[${source}]</span>
        <span class="message">${message}</span>
    `;
    
    container.appendChild(logEntry);
    container.scrollTop = container.scrollHeight;
}

/**
 * 筛选日志条目
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {string} filterType - 筛选类型 (all, info, success, error, warning)
 */
export function filterLogEntries(container, filterType) {
    const logEntries = container.querySelectorAll('.log-entry');
    
    logEntries.forEach(entry => {
        if (filterType === 'all') {
            entry.style.display = '';
        } else {
            const entryType = entry.getAttribute('data-log-type');
            entry.style.display = (entryType === filterType) ? '' : 'none';
        }
    });
}

/**
 * 设置脚本日志监听
 * @param {HTMLElement} container - 详情页面容器元素
 */
export function setupScriptLogListener(container) {
    const logContainer = container.querySelector('#scriptLogContainer');
    
    if (!logContainer) {
        console.error('日志容器未找到');
        return;
    }
    
    // 注册日志监听器
    const unsubscribe = window.scriptAPI.onLog((logData) => {
        const { level, message } = logData;
        addLogEntry(level, '脚本', message, logContainer);
        
        // 自动滚动到底部
        logContainer.scrollTop = logContainer.scrollHeight;
    });
    
    // 当容器被移除时取消订阅
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                for (const node of mutation.removedNodes) {
                    if (node.contains(container)) {
                        unsubscribe();
                        observer.disconnect();
                        return;
                    }
                }
            }
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
} 