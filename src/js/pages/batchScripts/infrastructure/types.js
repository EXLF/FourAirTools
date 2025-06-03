/**
 * 类型定义和数据结构
 * 提供统一的数据接口定义
 */

// ============================================================================
// 功能开关配置
// ============================================================================

export const FeatureFlags = {
    USE_API_CACHE: 'fa_use_api_cache',
    ENABLE_API_RETRY: 'fa_enable_api_retry',
    USE_SCRIPT_SERVICE: 'fa_use_script_service',
    USE_SCRIPT_REPOSITORY: 'fa_use_script_repository',
    USE_TASK_SERVICE: 'fa_use_task_service',
    USE_WALLET_REPOSITORY: 'fa_use_wallet_repo',
    DEBUG_SERVICES: 'fa_debug_services'
};

/**
 * 检查功能开关是否启用
 */
export function isFeatureEnabled(flag) {
    return localStorage.getItem(flag) === 'true';
}

/**
 * 设置功能开关
 */
export function setFeatureFlag(flag, enabled) {
    localStorage.setItem(flag, enabled ? 'true' : 'false');
    console.log(`[FeatureFlag] ${flag} = ${enabled}`);
}

/**
 * 启用所有新特性
 */
export function enableAllNewFeatures() {
    Object.values(FeatureFlags).forEach(flag => {
        setFeatureFlag(flag, true);
    });
    console.log('[FeatureFlag] 所有新特性已启用');
}

/**
 * 禁用所有新特性（紧急回退）
 */
export function disableAllNewFeatures() {
    Object.values(FeatureFlags).forEach(flag => {
        setFeatureFlag(flag, false);
    });
    console.log('[FeatureFlag] 所有新特性已禁用');
}

// ============================================================================
// API 响应类型
// ============================================================================

/**
 * 创建标准API响应
 */
export function createApiResponse(success, data = null, error = null) {
    return {
        success,
        data,
        error,
        timestamp: Date.now()
    };
}

// ============================================================================
// 脚本相关类型
// ============================================================================

export const ScriptInfo = {
    id: '',
    name: '',
    description: '',
    version: '1.0.0',
    author: '',
    category: '',
    status: 'active',
    requires: {
        wallets: false,
        proxies: false,
        socialsAccounts: false
    },
    params: {},
    filePath: '',
    createdAt: null,
    updatedAt: null
};

export const TaskStatus = {
    PENDING: 'pending',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

// ============================================================================
// 错误相关类型
// ============================================================================

export const ErrorType = {
    NETWORK: 'network',
    API: 'api',
    PERMISSION: 'permission',
    VALIDATION: 'validation',
    TIMEOUT: 'timeout',
    UNKNOWN: 'unknown'
};

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建唯一ID
 */
export function createId(prefix = '') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

/**
 * 格式化持续时间
 */
export function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}:${(minutes % 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else if (minutes > 0) {
        return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`;
    } else {
        return `${seconds}s`;
    }
}

/**
 * 安全执行带回退的函数
 */
export function safeExecuteWithFallback(newMethod, fallbackMethod, context, ...args) {
    try {
        return newMethod.call(context, ...args);
    } catch (error) {
        console.error('新方法失败，回退到原始方法:', error);
        return fallbackMethod.call(context, ...args);
    }
}

/**
 * 安全执行异步函数带回退
 */
export async function safeExecuteAsyncWithFallback(newMethod, fallbackMethod, context, ...args) {
    try {
        return await newMethod.call(context, ...args);
    } catch (error) {
        console.error('新方法失败，回退到原始方法:', error);
        return await fallbackMethod.call(context, ...args);
    }
} 