/**
 * 日志管理器 - 统一日志处理
 * 职责：日志收集和分发、日志持久化、日志查看器支持
 */

// 日志级别枚举
export const LogLevel = {
    DEBUG: 'debug',
    INFO: 'info',
    SUCCESS: 'success',
    WARNING: 'warning',
    ERROR: 'error'
};

export class LogManager {
    constructor() {
        this.logEntries = new Map(); // 按执行ID分组的日志
        this.observers = new Set(); // 日志观察者
        this.maxLogsPerExecution = 1000; // 每个执行最大日志数量
        this.autoCleanupInterval = 5 * 60 * 1000; // 5分钟清理一次
        this.electronListenerInitialized = false; // 标记是否已初始化electron监听器
        
        // 延迟初始化全局监听器，确保electron API已准备好
        this.initializeGlobalListeners();
        
        // 启动自动清理
        this.startAutoCleanup();
        
        console.log('[LogManager] 初始化完成');
    }

    /**
     * 初始化全局监听器（带重试机制）
     */
    async initializeGlobalListeners() {
        const maxRetries = 10;
        let retryCount = 0;
        
        const trySetupListeners = () => {
            try {
                if (typeof window !== 'undefined' && 
                    window.electron && 
                    typeof window.electron.on === 'function') {
                    
                    this.setupGlobalLogListeners();
                    this.electronListenerInitialized = true;
                    console.log('[LogManager] 全局日志监听器已成功初始化');
                    return true;
                }
                return false;
            } catch (error) {
                console.warn('[LogManager] 设置监听器失败:', error.message);
                return false;
            }
        };
        
        // 立即尝试一次
        if (trySetupListeners()) {
            return;
        }
        
        // 如果失败，使用间隔重试
        const retryInterval = setInterval(() => {
            retryCount++;
            
            if (trySetupListeners()) {
                clearInterval(retryInterval);
                return;
            }
            
            if (retryCount >= maxRetries) {
                clearInterval(retryInterval);
                console.warn('[LogManager] 达到最大重试次数，无法初始化electron监听器');
                console.warn('[LogManager] 日志系统将以降级模式运行');
            }
        }, 100); // 每100ms重试一次
    }

    /**
     * 设置全局日志监听器
     */
    setupGlobalLogListeners() {
        try {
            // 检查electron API是否可用
            if (!window.electron || typeof window.electron.on !== 'function') {
                throw new Error('electron.on 方法不可用');
            }
            
            // 监听全局脚本日志事件
            window.electron.on('script-log', (data) => {
                this.handleGlobalLog(data);
            });
            
            console.log('[LogManager] 全局日志监听器设置成功');
        } catch (error) {
            console.error('[LogManager] 设置全局日志监听器失败:', error);
            throw error;
        }
    }

    /**
     * 处理全局日志事件
     * @param {Object} data - 日志数据
     */
    handleGlobalLog(data) {
        try {
            const { level, message, timestamp, executionId } = data;
            
            if (executionId) {
                this.addLog(executionId, level, message, {
                    timestamp: timestamp ? new Date(timestamp) : new Date(),
                    source: 'script'
                });
            }
        } catch (error) {
            console.error('[LogManager] 处理全局日志事件失败:', error);
        }
    }

    /**
     * 添加日志
     * @param {string} executionId - 执行ID
     * @param {string} level - 日志级别
     * @param {string} message - 日志消息
     * @param {Object} metadata - 元数据
     */
    addLog(executionId, level, message, metadata = {}) {
        try {
            const logEntry = {
                id: this.generateLogId(),
                executionId,
                level,
                message: this.sanitizeMessage(message),
                timestamp: metadata.timestamp || new Date(),
                metadata: {
                    ...metadata,
                    addedAt: Date.now()
                }
            };

            // 获取或创建执行的日志数组
            if (!this.logEntries.has(executionId)) {
                this.logEntries.set(executionId, []);
            }

            const logs = this.logEntries.get(executionId);
            logs.push(logEntry);

            // 限制日志数量
            if (logs.length > this.maxLogsPerExecution) {
                logs.splice(0, logs.length - this.maxLogsPerExecution);
            }

            // 通知观察者
            this.notifyObservers(logEntry);

            // 输出到控制台（可选）
            this.outputToConsole(logEntry);
        } catch (error) {
            console.error('[LogManager] 添加日志失败:', error);
        }
    }

    /**
     * 清理消息中的特殊字符和编码问题
     * @param {string} message - 原始消息
     * @returns {string} 清理后的消息
     */
    sanitizeMessage(message) {
        if (typeof message !== 'string') {
            return String(message);
        }

        // 处理可能的编码问题
        let sanitized = message;
        
        // 替换常见的乱码字符
        const replacements = {
            '�': '[?]',
            '\uFFFD': '[?]'
        };

        for (const [from, to] of Object.entries(replacements)) {
            sanitized = sanitized.replace(new RegExp(from, 'g'), to);
        }

        // 处理中文乱码修复
        const chineseReplacements = {
            '鑴氭湰': '脚本',
            '鎵ц': '执行',
            '閰嶇疆': '配置',
            '鍒濆鍖?': '初始化',
            '姝ｅ湪': '正在',
            '瀹屾垚': '完成',
            '閽卞寘': '钱包',
            '鑾峰彇': '获取'
        };

        for (const [from, to] of Object.entries(chineseReplacements)) {
            sanitized = sanitized.replace(new RegExp(from, 'g'), to);
        }

        return sanitized;
    }

    /**
     * 输出日志到控制台
     * @param {Object} logEntry - 日志条目
     */
    outputToConsole(logEntry) {
        const { level, message, executionId, timestamp } = logEntry;
        const timeStr = timestamp.toLocaleTimeString();
        const prefix = `[${timeStr}][${executionId}]`;
        
        switch (level) {
            case LogLevel.DEBUG:
                console.debug(`${prefix}[DEBUG] ${message}`);
                break;
            case LogLevel.INFO:
                console.log(`${prefix}[INFO] ${message}`);
                break;
            case LogLevel.SUCCESS:
                console.log(`%c${prefix}[SUCCESS] ${message}`, 'color: green; font-weight: bold');
                break;
            case LogLevel.WARNING:
                console.warn(`${prefix}[WARNING] ${message}`);
                break;
            case LogLevel.ERROR:
                console.error(`${prefix}[ERROR] ${message}`);
                break;
            default:
                console.log(`${prefix}[${level.toUpperCase()}] ${message}`);
        }
    }

    /**
     * 获取执行的日志
     * @param {string} executionId - 执行ID
     * @param {Object} options - 选项
     * @returns {Array} 日志数组
     */
    getLogs(executionId, options = {}) {
        const logs = this.logEntries.get(executionId) || [];
        const { level, limit, offset = 0 } = options;

        let filteredLogs = logs;

        // 按级别过滤
        if (level) {
            filteredLogs = logs.filter(log => log.level === level);
        }

        // 分页
        if (limit) {
            filteredLogs = filteredLogs.slice(offset, offset + limit);
        }

        return filteredLogs;
    }

    /**
     * 获取所有执行的日志统计
     * @returns {Object} 统计信息
     */
    getLogStats() {
        const stats = {
            executions: this.logEntries.size,
            totalLogs: 0,
            byLevel: {}
        };

        // 初始化级别统计
        for (const level of Object.values(LogLevel)) {
            stats.byLevel[level] = 0;
        }

        // 统计日志
        for (const logs of this.logEntries.values()) {
            stats.totalLogs += logs.length;
            
            for (const log of logs) {
                if (stats.byLevel[log.level] !== undefined) {
                    stats.byLevel[log.level]++;
                }
            }
        }

        return stats;
    }

    /**
     * 搜索日志
     * @param {string} query - 搜索关键词
     * @param {Object} options - 搜索选项
     * @returns {Array} 匹配的日志
     */
    searchLogs(query, options = {}) {
        const { executionId, level, caseSensitive = false } = options;
        const results = [];
        const searchQuery = caseSensitive ? query : query.toLowerCase();

        const logsToSearch = executionId ? 
            (this.logEntries.get(executionId) || []) : 
            Array.from(this.logEntries.values()).flat();

        for (const log of logsToSearch) {
            // 级别过滤
            if (level && log.level !== level) continue;

            // 消息搜索
            const message = caseSensitive ? log.message : log.message.toLowerCase();
            if (message.includes(searchQuery)) {
                results.push(log);
            }
        }

        return results;
    }

    /**
     * 清理执行的日志
     * @param {string} executionId - 执行ID
     */
    clearLogs(executionId) {
        if (this.logEntries.has(executionId)) {
            this.logEntries.delete(executionId);
            console.log(`[LogManager] 已清理执行 ${executionId} 的日志`);
        }
    }

    /**
     * 清理所有日志
     */
    clearAllLogs() {
        this.logEntries.clear();
        console.log('[LogManager] 已清理所有日志');
    }

    /**
     * 自动清理过期日志
     */
    autoCleanup() {
        const now = Date.now();
        const maxAge = 2 * 60 * 60 * 1000; // 2小时
        let cleanedCount = 0;

        for (const [executionId, logs] of this.logEntries.entries()) {
            if (logs.length === 0) {
                this.logEntries.delete(executionId);
                cleanedCount++;
                continue;
            }

            // 检查最后一条日志的时间
            const lastLog = logs[logs.length - 1];
            if (now - lastLog.timestamp.getTime() > maxAge) {
                this.logEntries.delete(executionId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            console.log(`[LogManager] 自动清理了 ${cleanedCount} 个过期执行的日志`);
        }
    }

    /**
     * 启动自动清理
     */
    startAutoCleanup() {
        setInterval(() => {
            this.autoCleanup();
        }, this.autoCleanupInterval);
    }

    /**
     * 订阅日志事件
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    subscribe(callback) {
        this.observers.add(callback);
        return () => {
            this.observers.delete(callback);
        };
    }

    /**
     * 通知观察者
     * @param {Object} logEntry - 日志条目
     */
    notifyObservers(logEntry) {
        this.observers.forEach(callback => {
            try {
                callback(logEntry);
            } catch (error) {
                console.error('[LogManager] 通知观察者失败:', error);
            }
        });
    }

    /**
     * 生成日志ID
     * @returns {string} 日志ID
     */
    generateLogId() {
        return `log_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * 导出日志
     * @param {string} executionId - 执行ID
     * @param {string} format - 导出格式 ('txt', 'json')
     * @returns {string} 导出内容
     */
    exportLogs(executionId, format = 'txt') {
        const logs = this.getLogs(executionId);
        
        if (format === 'json') {
            return JSON.stringify(logs, null, 2);
        }
        
        // 文本格式
        return logs.map(log => {
            const timestamp = log.timestamp.toLocaleString();
            return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
        }).join('\n');
    }

    /**
     * 获取内存使用情况
     * @returns {Object} 内存使用信息
     */
    getMemoryUsage() {
        const stats = this.getLogStats();
        return {
            executions: stats.executions,
            totalLogs: stats.totalLogs,
            estimatedMemoryKB: Math.round(stats.totalLogs * 0.5) // 粗略估算每条日志0.5KB
        };
    }
} 