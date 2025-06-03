/**
 * 统一错误处理器
 * 提供友好的错误信息、错误分类和恢复建议
 */

export class ErrorHandler {
    constructor() {
        this.errorCounts = new Map();
        this.errorHistory = [];
        this.maxHistorySize = 100;
        
        // 错误类型映射
        this.errorTypes = {
            NETWORK_ERROR: 'network',
            API_ERROR: 'api',
            PERMISSION_ERROR: 'permission',
            VALIDATION_ERROR: 'validation',
            TIMEOUT_ERROR: 'timeout',
            UNKNOWN_ERROR: 'unknown'
        };

        console.log('[ErrorHandler] 初始化完成');
    }

    /**
     * 处理API错误
     */
    handleApiError(error, apiType, method, args) {
        const errorInfo = this.analyzeError(error, apiType, method, args);
        this.recordError(errorInfo);
        
        // 创建用户友好的错误
        const userError = this.createUserFriendlyError(errorInfo);
        
        // 显示错误提示（如果需要）
        this.showErrorNotification(userError);
        
        return userError;
    }

    /**
     * 分析错误类型和原因
     */
    analyzeError(error, apiType, method, args) {
        const errorInfo = {
            originalError: error,
            apiType,
            method,
            args,
            timestamp: Date.now(),
            type: this.errorTypes.UNKNOWN_ERROR,
            severity: 'medium',
            recoverable: true,
            suggestion: null
        };

        const message = error.message?.toLowerCase() || '';

        // 网络相关错误
        if (message.includes('network') || message.includes('fetch') || 
            message.includes('connection') || error.code === 'NETWORK_ERROR') {
            errorInfo.type = this.errorTypes.NETWORK_ERROR;
            errorInfo.severity = 'high';
            errorInfo.suggestion = '请检查网络连接或稍后重试';
        }
        // API不存在错误
        else if (message.includes('方法不存在') || message.includes('is not a function')) {
            errorInfo.type = this.errorTypes.API_ERROR;
            errorInfo.severity = 'high';
            errorInfo.recoverable = false;
            errorInfo.suggestion = '该功能可能需要更新应用版本';
        }
        // 权限错误
        else if (message.includes('permission') || message.includes('unauthorized') ||
                 message.includes('access denied')) {
            errorInfo.type = this.errorTypes.PERMISSION_ERROR;
            errorInfo.severity = 'high';
            errorInfo.suggestion = '请检查应用权限设置';
        }
        // 超时错误
        else if (message.includes('timeout') || message.includes('时间超时')) {
            errorInfo.type = this.errorTypes.TIMEOUT_ERROR;
            errorInfo.severity = 'medium';
            errorInfo.suggestion = '操作超时，请重试';
        }
        // 验证错误
        else if (message.includes('validation') || message.includes('invalid') ||
                 message.includes('参数错误')) {
            errorInfo.type = this.errorTypes.VALIDATION_ERROR;
            errorInfo.severity = 'low';
            errorInfo.suggestion = '请检查输入参数';
        }

        return errorInfo;
    }

    /**
     * 创建用户友好的错误对象
     */
    createUserFriendlyError(errorInfo) {
        const friendlyMessages = {
            [this.errorTypes.NETWORK_ERROR]: '网络连接出现问题',
            [this.errorTypes.API_ERROR]: '应用接口出现问题',
            [this.errorTypes.PERMISSION_ERROR]: '权限不足',
            [this.errorTypes.VALIDATION_ERROR]: '输入参数有误',
            [this.errorTypes.TIMEOUT_ERROR]: '操作超时',
            [this.errorTypes.UNKNOWN_ERROR]: '出现未知错误'
        };

        const error = new Error(friendlyMessages[errorInfo.type] || '操作失败');
        
        // 添加额外信息
        error.type = errorInfo.type;
        error.severity = errorInfo.severity;
        error.recoverable = errorInfo.recoverable;
        error.suggestion = errorInfo.suggestion;
        error.originalError = errorInfo.originalError;
        error.context = {
            apiType: errorInfo.apiType,
            method: errorInfo.method,
            timestamp: errorInfo.timestamp
        };

        return error;
    }

    /**
     * 记录错误统计
     */
    recordError(errorInfo) {
        const key = `${errorInfo.apiType}_${errorInfo.method}_${errorInfo.type}`;
        const count = this.errorCounts.get(key) || 0;
        this.errorCounts.set(key, count + 1);

        // 添加到历史记录
        this.errorHistory.push({
            timestamp: errorInfo.timestamp,
            apiType: errorInfo.apiType,
            method: errorInfo.method,
            type: errorInfo.type,
            message: errorInfo.originalError.message
        });

        // 限制历史记录大小
        if (this.errorHistory.length > this.maxHistorySize) {
            this.errorHistory.shift();
        }

        console.error(`[ErrorHandler] 记录错误: ${key}`, errorInfo);
    }

    /**
     * 显示错误通知
     */
    showErrorNotification(error) {
        // 只显示高严重性或多次重复的错误
        if (error.severity === 'high' || this.isFrequentError(error)) {
            this.displayToast(error);
        }
    }

    /**
     * 检查是否是频繁出现的错误
     */
    isFrequentError(error) {
        const key = `${error.context.apiType}_${error.context.method}_${error.type}`;
        const count = this.errorCounts.get(key) || 0;
        return count >= 3; // 连续3次相同错误就显示提示
    }

    /**
     * 显示Toast提示
     */
    displayToast(error) {
        // 检查是否有全局的Toast系统
        if (window.showToast && typeof window.showToast === 'function') {
            const toastType = error.severity === 'high' ? 'error' : 'warning';
            let message = error.message;
            
            if (error.suggestion) {
                message += ` - ${error.suggestion}`;
            }
            
            window.showToast(message, toastType);
        } else {
            // 备用方案：使用console
            console.error(`[错误提示] ${error.message}`);
            if (error.suggestion) {
                console.info(`[建议] ${error.suggestion}`);
            }
        }
    }

    /**
     * 获取错误统计信息
     */
    getStats() {
        const typeStats = {};
        
        // 按类型统计错误
        for (const [key, count] of this.errorCounts.entries()) {
            const [apiType, method, errorType] = key.split('_');
            if (!typeStats[errorType]) {
                typeStats[errorType] = 0;
            }
            typeStats[errorType] += count;
        }

        return {
            totalErrors: this.errorHistory.length,
            errorsByType: typeStats,
            recentErrors: this.errorHistory.slice(-10), // 最近10个错误
            frequentErrors: this.getFrequentErrors()
        };
    }

    /**
     * 获取频繁出现的错误
     */
    getFrequentErrors() {
        return Array.from(this.errorCounts.entries())
            .filter(([key, count]) => count >= 3)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([key, count]) => ({ key, count }));
    }

    /**
     * 清除错误统计
     */
    clearStats() {
        this.errorCounts.clear();
        this.errorHistory = [];
        console.log('[ErrorHandler] 错误统计已清除');
    }
} 