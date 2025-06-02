/**
 * 脚本插件任务日志工具
 * 用于记录和展示任务执行日志
 */

// 日志类型常量
const LOG_TYPES = {
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

// 日志观察者列表
const logObservers = new Set();

/**
 * 任务日志工具类
 */
export class TaskLogger {
    /**
     * 添加一条信息日志
     * @param {string} message - 日志消息
     */
    static logInfo(message) {
        TaskLogger._addLogEntry(LOG_TYPES.INFO, message);
    }
    
    /**
     * 添加一条成功日志
     * @param {string} message - 日志消息
     */
    static logSuccess(message) {
        TaskLogger._addLogEntry(LOG_TYPES.SUCCESS, message);
    }
    
    /**
     * 添加一条警告日志
     * @param {string} message - 日志消息
     */
    static logWarning(message) {
        TaskLogger._addLogEntry(LOG_TYPES.WARNING, message);
    }
    
    /**
     * 添加一条错误日志
     * @param {string} message - 日志消息
     */
    static logError(message) {
        TaskLogger._addLogEntry(LOG_TYPES.ERROR, message);
    }
    
    /**
     * 添加日志条目并通知观察者 - 移除过度修复
     * @param {string} type - 日志类型
     * @param {string} message - 日志消息
     * @private
     */
    static _addLogEntry(type, message) {
        // 只在真正需要时应用中文修复
        let processedMessage = message;
        
        // 只对包含特定中文乱码的消息进行修复
        if (typeof message === 'string' && /鑴氭湰|鎵ц|閰嶇疆|鍒濆鍖|姝ｅ湪|瀹屾垚|閽卞寘|鑾峰彇|鎴愬姛|澶辫触/.test(message)) {
            if (typeof window !== 'undefined' && typeof window.__fixChineseText === 'function') {
                processedMessage = window.__fixChineseText(message);
            }
        }
        
        const entry = {
            type,
            message: processedMessage,
            timestamp: new Date(),
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
        };
        
        // 将日志输出到控制台
        TaskLogger._logToConsole(entry);
        
        // 通知所有观察者
        logObservers.forEach(observer => {
            try {
                observer(entry);
            } catch (error) {
                console.error('执行日志观察者回调时出错:', error);
            }
        });
    }
    
    /**
     * 将日志输出到控制台
     * @param {Object} logEntry - 日志条目
     * @private
     */
    static _logToConsole(logEntry) {
        const { type, message, timestamp } = logEntry;
        const timeString = TaskLogger._formatTimestamp(timestamp);
        const logMessage = `[${timeString}] [${type.toUpperCase()}] ${message}`;
        
        switch (type) {
            case LOG_TYPES.INFO:
                console.log(logMessage);
                break;
            case LOG_TYPES.SUCCESS:
                console.log(`%c${logMessage}`, 'color: green');
                break;
            case LOG_TYPES.WARNING:
                console.warn(logMessage);
                break;
            case LOG_TYPES.ERROR:
                console.error(logMessage);
                break;
            default:
                console.log(logMessage);
        }
    }
    
    /**
     * 格式化时间戳
     * @param {Date} timestamp - 时间戳
     * @returns {string} 格式化后的时间字符串
     * @private
     */
    static _formatTimestamp(timestamp) {
        const hours = timestamp.getHours().toString().padStart(2, '0');
        const minutes = timestamp.getMinutes().toString().padStart(2, '0');
        const seconds = timestamp.getSeconds().toString().padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }
    
    /**
     * 添加日志观察者
     * @param {Function} observer - 观察者回调函数
     * @returns {Function} 移除观察者的函数
     */
    static addObserver(observer) {
        if (typeof observer === 'function') {
            logObservers.add(observer);
            
            // 返回移除观察者的函数
            return () => {
                logObservers.delete(observer);
            };
        }
        
        return () => {}; // 返回空函数
    }
    
    /**
     * 移除日志观察者
     * @param {Function} observer - 要移除的观察者
     */
    static removeObserver(observer) {
        logObservers.delete(observer);
    }
    
    /**
     * 渲染日志到HTML容器 - 移除过度修复
     * @param {HTMLElement} container - 日志容器元素
     * @param {boolean} [autoScroll=true] - 是否自动滚动到最新日志
     * @returns {Function} 停止日志渲染的函数
     */
    static renderLogsToContainer(container, autoScroll = true) {
        if (!container) return () => {};
        
        // 清空容器
        container.innerHTML = '';
        
        // 添加初始日志
        const initialLogElement = document.createElement('div');
        initialLogElement.className = 'log-entry log-type-info';
        initialLogElement.innerHTML = `
            <span class="log-time">[${TaskLogger._formatTimestamp(new Date())}]</span>
            <span class="log-message">日志系统已初始化，准备接收脚本执行日志...</span>
        `;
        container.appendChild(initialLogElement);
        
        // 创建日志渲染器
        const logRenderer = (logEntry) => {
            const { type, message, timestamp, id } = logEntry;
            const timeString = TaskLogger._formatTimestamp(timestamp);
            
            // 直接使用已处理的消息，不再重复修复
            const displayMessage = message || '';
            
            // 创建日志元素
            const logElement = document.createElement('div');
            logElement.className = `log-entry log-type-${type}`;
            logElement.id = id;
            logElement.innerHTML = `
                <span class="log-time">[${timeString}]</span>
                <span class="log-message">${displayMessage}</span>
            `;
            
            // 添加到容器
            container.appendChild(logElement);
            
            // 自动滚动到底部
            if (autoScroll) {
                container.scrollTop = container.scrollHeight;
            }
        };
        
        // 添加观察者
        const removeObserver = TaskLogger.addObserver(logRenderer);
        
        // 返回停止渲染的函数
        return removeObserver;
    }
    
    /**
     * 清空日志容器
     * @param {HTMLElement} container - 日志容器元素
     */
    static clearLogContainer(container) {
        if (container) {
            container.innerHTML = '';
        }
    }
} 