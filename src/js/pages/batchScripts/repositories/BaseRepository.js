/**
 * 基础仓库类
 * 为所有Repository提供通用的缓存、错误处理和API调用功能
 * 实现Repository模式的核心基础设施
 */

import { ApiClient } from '../infrastructure/ApiClient.js';
import { ErrorHandler } from '../infrastructure/ErrorHandler.js';
import { CacheManager } from '../infrastructure/CacheManager.js';
import { createApiResponse, createId } from '../infrastructure/types.js';

export class BaseRepository {
    constructor(options = {}) {
        // 基础设施依赖注入
        this.apiClient = options.apiClient || new ApiClient();
        this.errorHandler = options.errorHandler || new ErrorHandler();
        this.cacheManager = options.cacheManager || new CacheManager();
        
        // Repository配置
        this.repositoryName = options.repositoryName || 'BaseRepository';
        this.defaultCacheTTL = options.defaultCacheTTL || 5 * 60 * 1000; // 5分钟
        this.enableCache = options.enableCache !== false; // 默认启用缓存
        this.enableRetry = options.enableRetry !== false; // 默认启用重试
        
        // 统计信息
        this.stats = {
            totalCalls: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
            lastAccess: null
        };
        
        console.log(`[${this.repositoryName}] 初始化完成`);
    }

    /**
     * 执行带缓存的API调用
     * @param {string} method - 调用方法名
     * @param {Array} args - 方法参数
     * @param {Object} options - 调用选项
     * @returns {Promise<any>} API调用结果
     */
    async executeWithCache(method, args = [], options = {}) {
        this.stats.totalCalls++;
        this.stats.lastAccess = Date.now();
        
        const {
            cacheKey = this.generateCacheKey(method, args),
            cacheTTL = this.defaultCacheTTL,
            forceRefresh = false,
            apiType = 'script'  // 默认使用script API
        } = options;

        try {
            // 检查缓存（如果启用且不强制刷新）
            if (this.enableCache && !forceRefresh) {
                const cached = this.cacheManager.get(cacheKey);
                if (cached !== undefined) {
                    this.stats.cacheHits++;
                    console.log(`[${this.repositoryName}] 缓存命中: ${method}`);
                    return this.wrapSuccessResponse(cached);
                }
            }

            this.stats.cacheMisses++;
            console.log(`[${this.repositoryName}] 执行API调用: ${apiType}.${method}`);

            // 执行API调用
            const result = await this.apiClient.callAPI(apiType, method, ...args);

            // 缓存结果（如果启用缓存且调用成功）
            if (this.enableCache && this.shouldCacheResult(method, result)) {
                this.cacheManager.set(cacheKey, result, cacheTTL);
            }

            return this.wrapSuccessResponse(result);

        } catch (error) {
            this.stats.errors++;
            
            // 使用ErrorHandler处理错误
            const handledError = this.errorHandler.handleApiError(
                error, 
                apiType, 
                method, 
                args
            );
            
            console.error(`[${this.repositoryName}] API调用失败:`, handledError);
            return this.wrapErrorResponse(handledError);
        }
    }

    /**
     * 直接执行API调用（不使用缓存）
     * @param {string} apiType - API类型 ('script', 'db', 'ipc')
     * @param {string} method - 方法名
     * @param {Array} args - 参数
     * @returns {Promise<any>} API调用结果
     */
    async executeDirect(apiType, method, args = []) {
        this.stats.totalCalls++;
        this.stats.lastAccess = Date.now();

        try {
            console.log(`[${this.repositoryName}] 直接API调用: ${apiType}.${method}`);
            const result = await this.apiClient.callAPI(apiType, method, ...args);
            return this.wrapSuccessResponse(result);
        } catch (error) {
            this.stats.errors++;
            const handledError = this.errorHandler.handleApiError(error, apiType, method, args);
            console.error(`[${this.repositoryName}] 直接API调用失败:`, handledError);
            return this.wrapErrorResponse(handledError);
        }
    }

    /**
     * 批量执行API调用
     * @param {Array} calls - 调用列表 [{apiType, method, args, options}]
     * @returns {Promise<Array>} 批量调用结果
     */
    async executeBatch(calls) {
        console.log(`[${this.repositoryName}] 执行批量调用: ${calls.length} 个请求`);
        
        const promises = calls.map(async (call, index) => {
            try {
                const { apiType, method, args = [], options = {} } = call;
                return await this.executeWithCache(method, args, { ...options, apiType });
            } catch (error) {
                console.error(`[${this.repositoryName}] 批量调用第${index}个失败:`, error);
                return this.wrapErrorResponse(error);
            }
        });

        return await Promise.allSettled(promises);
    }

    /**
     * 生成缓存键
     * @param {string} method - 方法名
     * @param {Array} args - 参数
     * @returns {string} 缓存键
     */
    generateCacheKey(method, args) {
        const argsStr = JSON.stringify(args || []);
        return `${this.repositoryName}_${method}_${this.hashCode(argsStr)}`;
    }

    /**
     * 简单的字符串哈希函数
     * @param {string} str - 输入字符串
     * @returns {string} 哈希值
     */
    hashCode(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    /**
     * 判断是否应该缓存结果
     * @param {string} method - 方法名
     * @param {any} result - API结果
     * @returns {boolean} 是否缓存
     */
    shouldCacheResult(method, result) {
        // 只缓存成功的读取操作
        const readMethods = [
            'getAllScripts', 'getScriptById', 'getAllWallets', 'getWalletById', 
            'getAllGroups', 'getProxies', 'getProxyById', 'getGroups', 'getSocialAccounts'
        ];
        
        return readMethods.includes(method) && 
               result && 
               (result.success !== false);
    }

    /**
     * 包装成功响应
     * @param {any} data - 响应数据
     * @returns {Object} 标准响应格式
     */
    wrapSuccessResponse(data) {
        return createApiResponse(true, data, null);
    }

    /**
     * 包装错误响应
     * @param {Error} error - 错误对象
     * @returns {Object} 标准响应格式
     */
    wrapErrorResponse(error) {
        return createApiResponse(false, null, {
            message: error.message,
            type: error.type || 'unknown',
            severity: error.severity || 'medium',
            suggestion: error.suggestion || '请稍后重试'
        });
    }

    /**
     * 清除缓存
     * @param {string} pattern - 缓存模式（可选）
     */
    clearCache(pattern = null) {
        if (pattern) {
            // 清除匹配模式的缓存
            const repoPattern = new RegExp(`^${this.repositoryName}_.*${pattern}.*`);
            this.cacheManager.clear(repoPattern);
        } else {
            // 清除该Repository的所有缓存
            const repoPattern = new RegExp(`^${this.repositoryName}_`);
            this.cacheManager.clear(repoPattern);
        }
        console.log(`[${this.repositoryName}] 缓存已清除:`, pattern || '全部');
    }

    /**
     * 获取Repository统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const cacheHitRate = this.stats.totalCalls > 0 
            ? ((this.stats.cacheHits / this.stats.totalCalls) * 100).toFixed(2)
            : 0;

        return {
            repositoryName: this.repositoryName,
            ...this.stats,
            cacheHitRate: `${cacheHitRate}%`,
            cacheManager: this.cacheManager.getStats(),
            errorHandler: this.errorHandler.getStats()
        };
    }

    /**
     * 重置统计信息
     */
    resetStats() {
        this.stats = {
            totalCalls: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
            lastAccess: null
        };
        console.log(`[${this.repositoryName}] 统计信息已重置`);
    }

    /**
     * 销毁Repository实例
     */
    destroy() {
        this.clearCache();
        this.resetStats();
        console.log(`[${this.repositoryName}] 实例已销毁`);
    }
}

/**
 * Repository工厂类
 * 用于创建和管理Repository实例
 */
export class RepositoryFactory {
    constructor() {
        this.repositories = new Map();
        this.sharedApiClient = new ApiClient();
        this.sharedErrorHandler = new ErrorHandler();
        this.sharedCacheManager = new CacheManager();
        
        console.log('[RepositoryFactory] 工厂初始化完成');
    }

    /**
     * 创建Repository实例
     * @param {string} repositoryType - Repository类型
     * @param {Function} RepositoryClass - Repository类
     * @param {Object} options - 创建选项
     * @returns {Object} Repository实例
     */
    createRepository(repositoryType, RepositoryClass, options = {}) {
        if (this.repositories.has(repositoryType)) {
            console.log(`[RepositoryFactory] 返回已存在的 ${repositoryType} 实例`);
            return this.repositories.get(repositoryType);
        }

        const repositoryOptions = {
            repositoryName: repositoryType,
            apiClient: this.sharedApiClient,
            errorHandler: this.sharedErrorHandler,
            cacheManager: this.sharedCacheManager,
            ...options
        };

        const repository = new RepositoryClass(repositoryOptions);
        this.repositories.set(repositoryType, repository);
        
        console.log(`[RepositoryFactory] 创建 ${repositoryType} Repository`);
        return repository;
    }

    /**
     * 获取Repository实例
     * @param {string} repositoryType - Repository类型
     * @returns {Object|null} Repository实例
     */
    getRepository(repositoryType) {
        return this.repositories.get(repositoryType) || null;
    }

    /**
     * 销毁Repository实例
     * @param {string} repositoryType - Repository类型
     */
    destroyRepository(repositoryType) {
        const repository = this.repositories.get(repositoryType);
        if (repository) {
            repository.destroy();
            this.repositories.delete(repositoryType);
            console.log(`[RepositoryFactory] 已销毁 ${repositoryType} Repository`);
        }
    }

    /**
     * 获取所有Repository的统计信息
     * @returns {Object} 全部统计信息
     */
    getAllStats() {
        const stats = {};
        for (const [type, repo] of this.repositories.entries()) {
            stats[type] = repo.getStats();
        }
        return stats;
    }

    /**
     * 清除所有Repository的缓存
     */
    clearAllCaches() {
        for (const [type, repo] of this.repositories.entries()) {
            repo.clearCache();
        }
        console.log('[RepositoryFactory] 已清除所有Repository缓存');
    }

    /**
     * 销毁工厂和所有Repository
     */
    destroy() {
        for (const type of this.repositories.keys()) {
            this.destroyRepository(type);
        }
        console.log('[RepositoryFactory] 工厂已销毁');
    }
} 