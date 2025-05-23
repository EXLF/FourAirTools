/**
 * @fileoverview 应用错误定义 - 统一的错误处理
 * @module shared/errors/AppError
 */

/**
 * 应用错误类
 * 继承自Error，添加错误码和详细信息
 */
class AppError extends Error {
    /**
     * 创建应用错误
     * @param {string} message - 错误消息
     * @param {string} code - 错误码
     * @param {Object} [details] - 错误详情
     * @param {number} [statusCode] - HTTP状态码（如果适用）
     */
    constructor(message, code, details = {}, statusCode = 500) {
        super(message);
        this.name = 'AppError';
        this.code = code;
        this.details = details;
        this.statusCode = statusCode;
        this.timestamp = new Date().toISOString();
        
        // 捕获堆栈跟踪
        Error.captureStackTrace(this, this.constructor);
    }

    /**
     * 转换为JSON格式
     * @returns {Object} JSON表示
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            details: this.details,
            statusCode: this.statusCode,
            timestamp: this.timestamp,
            stack: this.stack
        };
    }

    /**
     * 获取用户友好的错误消息
     * @returns {string} 用户友好的消息
     */
    getUserMessage() {
        // 根据错误码返回用户友好的消息
        return ErrorMessages[this.code] || this.message;
    }

    /**
     * 创建验证错误
     * @param {string} field - 字段名
     * @param {string} message - 错误消息
     * @returns {AppError} 错误实例
     */
    static validation(field, message) {
        return new AppError(
            message,
            ErrorCodes.VALIDATION_ERROR,
            { field },
            400
        );
    }

    /**
     * 创建认证错误
     * @param {string} message - 错误消息
     * @returns {AppError} 错误实例
     */
    static authentication(message = '认证失败') {
        return new AppError(
            message,
            ErrorCodes.AUTH_FAILED,
            {},
            401
        );
    }

    /**
     * 创建权限错误
     * @param {string} resource - 资源名称
     * @returns {AppError} 错误实例
     */
    static authorization(resource) {
        return new AppError(
            `无权访问 ${resource}`,
            ErrorCodes.PERMISSION_DENIED,
            { resource },
            403
        );
    }

    /**
     * 创建未找到错误
     * @param {string} resource - 资源名称
     * @param {string|number} id - 资源ID
     * @returns {AppError} 错误实例
     */
    static notFound(resource, id) {
        return new AppError(
            `${resource} ${id} 未找到`,
            ErrorCodes.NOT_FOUND,
            { resource, id },
            404
        );
    }

    /**
     * 创建网络错误
     * @param {string} message - 错误消息
     * @param {Object} details - 错误详情
     * @returns {AppError} 错误实例
     */
    static network(message, details = {}) {
        return new AppError(
            message,
            ErrorCodes.NETWORK_ERROR,
            details,
            503
        );
    }

    /**
     * 创建数据库错误
     * @param {string} operation - 操作名称
     * @param {Error} originalError - 原始错误
     * @returns {AppError} 错误实例
     */
    static database(operation, originalError) {
        return new AppError(
            `数据库操作失败: ${operation}`,
            ErrorCodes.DATABASE_ERROR,
            { 
                operation,
                originalError: originalError.message 
            },
            500
        );
    }
}

/**
 * 错误码定义
 */
const ErrorCodes = {
    // 认证相关
    AUTH_FAILED: 'AUTH_001',
    AUTH_EXPIRED: 'AUTH_002',
    AUTH_LOCKED: 'AUTH_003',
    
    // 权限相关
    PERMISSION_DENIED: 'PERM_001',
    INSUFFICIENT_PRIVILEGE: 'PERM_002',
    
    // 数据相关
    VALIDATION_ERROR: 'DATA_001',
    DUPLICATE_ENTRY: 'DATA_002',
    DATA_INTEGRITY: 'DATA_003',
    NOT_FOUND: 'DATA_004',
    
    // 网络相关
    NETWORK_ERROR: 'NET_001',
    TIMEOUT_ERROR: 'NET_002',
    CONNECTION_REFUSED: 'NET_003',
    
    // 数据库相关
    DATABASE_ERROR: 'DB_001',
    TRANSACTION_FAILED: 'DB_002',
    
    // 脚本执行相关
    SCRIPT_ERROR: 'SCRIPT_001',
    SCRIPT_TIMEOUT: 'SCRIPT_002',
    SCRIPT_STOPPED: 'SCRIPT_003',
    
    // 系统相关
    SYSTEM_ERROR: 'SYS_001',
    FILE_NOT_FOUND: 'SYS_002',
    INSUFFICIENT_STORAGE: 'SYS_003',
    
    // 业务逻辑相关
    INVALID_OPERATION: 'BIZ_001',
    LIMIT_EXCEEDED: 'BIZ_002',
    RESOURCE_BUSY: 'BIZ_003'
};

/**
 * 用户友好的错误消息
 */
const ErrorMessages = {
    [ErrorCodes.AUTH_FAILED]: '认证失败，请检查您的凭据',
    [ErrorCodes.AUTH_EXPIRED]: '认证已过期，请重新登录',
    [ErrorCodes.AUTH_LOCKED]: '账户已被锁定，请稍后重试',
    
    [ErrorCodes.PERMISSION_DENIED]: '您没有权限执行此操作',
    [ErrorCodes.INSUFFICIENT_PRIVILEGE]: '权限不足',
    
    [ErrorCodes.VALIDATION_ERROR]: '输入数据验证失败',
    [ErrorCodes.DUPLICATE_ENTRY]: '数据已存在',
    [ErrorCodes.DATA_INTEGRITY]: '数据完整性错误',
    [ErrorCodes.NOT_FOUND]: '请求的资源未找到',
    
    [ErrorCodes.NETWORK_ERROR]: '网络连接错误',
    [ErrorCodes.TIMEOUT_ERROR]: '请求超时',
    [ErrorCodes.CONNECTION_REFUSED]: '连接被拒绝',
    
    [ErrorCodes.DATABASE_ERROR]: '数据库操作失败',
    [ErrorCodes.TRANSACTION_FAILED]: '事务处理失败',
    
    [ErrorCodes.SCRIPT_ERROR]: '脚本执行错误',
    [ErrorCodes.SCRIPT_TIMEOUT]: '脚本执行超时',
    [ErrorCodes.SCRIPT_STOPPED]: '脚本已停止',
    
    [ErrorCodes.SYSTEM_ERROR]: '系统错误',
    [ErrorCodes.FILE_NOT_FOUND]: '文件未找到',
    [ErrorCodes.INSUFFICIENT_STORAGE]: '存储空间不足',
    
    [ErrorCodes.INVALID_OPERATION]: '无效的操作',
    [ErrorCodes.LIMIT_EXCEEDED]: '超出限制',
    [ErrorCodes.RESOURCE_BUSY]: '资源正忙，请稍后重试'
};

module.exports = {
    AppError,
    ErrorCodes,
    ErrorMessages
}; 