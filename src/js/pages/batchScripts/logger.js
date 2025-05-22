/**
 * 批量脚本任务日志工具
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
     * 添加日志条目并通知观察者
     * @param {string} type - 日志类型
     * @param {string} message - 日志消息
     * @private
     */
    static _addLogEntry(type, message) {
        const entry = {
            type,
            message,
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
     * 渲染日志到HTML容器
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
            
            // 处理可能的编码问题
            let displayMessage = message;
            
            // 如果检测到可能的乱码，尝试修复
            if (displayMessage && /[\ufffd\uFFFD]/.test(displayMessage)) {
                try {
                    // 尝试修复双重编码问题
                    displayMessage = "【注意：可能存在编码问题】" + displayMessage;
                } catch (e) {
                    console.warn('日志消息编码修复失败:', e);
                }
            }

            // 处理可能的中文乱码
            // 尝试识别并替换常见的中文乱码模式
            if (displayMessage) {
                // 处理脚本信息和钱包信息中的常见中文乱码
                const chineseReplacements = {
                    '鑴氭湰': '脚本',
                    '鎵ц': '执行',
                    '閰嶇疆': '配置',
                    '鍒濆鍖?': '初始化',
                    '姝ｅ湪': '正在',
                    '瀹屾垚': '完成',
                    '閽卞寘': '钱包',
                    '鑾峰彇': '获取',
                    '璇︾粏': '详细',
                    '淇℃伅': '信息',
                    '璁よ瘉': '认证',
                    '杩涘害': '进度',
                    '灏濊瘯': '尝试',
                    '杩炴帴': '连接',
                    '鎵撳嵃': '打印'
                };
                
                // 替换乱码
                Object.keys(chineseReplacements).forEach(key => {
                    displayMessage = displayMessage.replace(new RegExp(key, 'g'), chineseReplacements[key]);
                });
                
                // 如果仍有乱码字符，添加提示
                if (/[\ufffd\uFFFD]|鑴氭湰|閰嶇疆|姝ｅ湪/.test(displayMessage)) {
                    displayMessage += " [可能存在部分编码问题]";
                }
            }
            
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
            
            // 保留最多500条日志，避免内存占用过多
            const maxLogs = 500;
            const logs = container.querySelectorAll('.log-entry');
            if (logs.length > maxLogs) {
                for (let i = 0; i < logs.length - maxLogs; i++) {
                    container.removeChild(logs[i]);
                }
            }
        };
        
        // 添加为观察者
        const removeObserver = TaskLogger.addObserver(logRenderer);
        
        // 返回清理函数
        return () => {
            removeObserver();
        };
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