/**
 * 统一API客户端
 * 封装所有对window.scriptAPI和window.dbAPI的调用
 * 提供统一的错误处理、重试机制和缓存支持
 */

import { ErrorHandler } from './ErrorHandler.js';
import { CacheManager } from './CacheManager.js';

export class ApiClient {
    constructor() {
        this.errorHandler = new ErrorHandler();
        this.cache = new CacheManager();
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1秒
        
        // 特性开关
        this.useCache = localStorage.getItem('fa_use_api_cache') !== 'false';
        this.enableRetry = localStorage.getItem('fa_enable_api_retry') !== 'false';
        
        console.log('[ApiClient] 初始化完成, 缓存:', this.useCache, ', 重试:', this.enableRetry);
    }

    /**
     * 检测可用的API接口
     */
    detectScriptAPI() {
        if (window.scriptAPI && typeof window.scriptAPI === 'object') {
            return window.scriptAPI;
        }
        console.warn('[ApiClient] window.scriptAPI 未找到');
        return null;
    }

    detectDbAPI() {
        if (window.dbAPI && typeof window.dbAPI === 'object') {
            return window.dbAPI;
        }
        console.warn('[ApiClient] window.dbAPI 未找到');
        return null;
    }

    detectIPC() {
        const ipcOptions = [
            window.ipcRenderer,
            window.electron?.ipcRenderer,
            window.api?.invoke ? { invoke: window.api.invoke } : null,
            window.bridge?.invoke ? { invoke: window.bridge.invoke } : null,
            window.ipc
        ];
        
        for (const option of ipcOptions) {
            if (option && typeof option.invoke === 'function') {
                return option;
            }
        }
        
        console.warn('[ApiClient] IPC接口未找到');
        return null;
    }

    /**
     * 统一的API调用方法
     */
    async callAPI(apiType, method, ...args) {
        const cacheKey = `${apiType}_${method}_${JSON.stringify(args)}`;
        
        // 检查缓存
        if (this.useCache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
                console.log(`[ApiClient] 缓存命中: ${apiType}.${method}`);
                return cached;
            }
        }

        // 执行API调用（带重试）
        let lastError;
        const maxAttempts = this.enableRetry ? this.retryAttempts : 1;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                console.log(`[ApiClient] 调用 ${apiType}.${method} (尝试 ${attempt}/${maxAttempts})`);
                
                let result;
                if (apiType === 'script') {
                    const api = this.detectScriptAPI();
                    if (!api || typeof api[method] !== 'function') {
                        throw new Error(`scriptAPI.${method} 方法不存在`);
                    }
                    result = await api[method](...args);
                } else if (apiType === 'db' || apiType === 'wallet' || apiType === 'group') {
                    // 钱包和分组相关的调用都使用dbAPI
                    const api = this.detectDbAPI();
                    if (!api || typeof api[method] !== 'function') {
                        throw new Error(`dbAPI.${method} 方法不存在`);
                    }
                    result = await api[method](...args);
                } else if (apiType === 'ipc') {
                    const ipc = this.detectIPC();
                    if (!ipc || typeof ipc.invoke !== 'function') {
                        throw new Error('IPC invoke 方法不存在');
                    }
                    result = await ipc.invoke(method, ...args);
                } else {
                    throw new Error(`未知的API类型: ${apiType}`);
                }

                // 缓存成功结果
                if (this.useCache && this.shouldCache(apiType, method)) {
                    this.cache.set(cacheKey, result, this.getCacheTTL(apiType, method));
                }

                return result;

            } catch (error) {
                lastError = error;
                console.warn(`[ApiClient] 调用失败 (尝试 ${attempt}/${maxAttempts}):`, error.message);
                
                // 如果不是最后一次尝试，等待后重试
                if (attempt < maxAttempts) {
                    await this.sleep(this.retryDelay * attempt);
                    continue;
                }
                
                // 最后一次尝试失败，处理错误
                const handledError = this.errorHandler.handleApiError(error, apiType, method, args);
                throw handledError;
            }
        }
    }

    /**
     * 脚本相关API调用
     */
    async getAllScripts() {
        return this.callAPI('script', 'getAllScripts');
    }

    async executeScript(scriptId, config) {
        return this.callAPI('script', 'executeScript', scriptId, config);
    }

    async stopScript(executionId) {
        return this.callAPI('script', 'stopScript', executionId);
    }

    async syncScripts(options = {}) {
        // 同步操作不缓存
        return this.callAPI('script', 'syncScripts', options);
    }

    /**
     * 数据库相关API调用
     */
    async getWallets(options = {}) {
        return this.callAPI('db', 'getWallets', options);
    }

    async getWalletById(walletId) {
        return this.callAPI('db', 'getWalletById', walletId);
    }

    async addWallet(walletData) {
        return this.callAPI('db', 'addWallet', walletData);
    }

    async updateWallet(walletId, updateData) {
        return this.callAPI('db', 'updateWallet', walletId, updateData);
    }

    async deleteWallet(walletId) {
        return this.callAPI('db', 'deleteWallet', walletId);
    }

    async deleteWalletsByIds(walletIds) {
        return this.callAPI('db', 'deleteWalletsByIds', walletIds);
    }

    async getProxies(options = {}) {
        return this.callAPI('db', 'getProxies', options);
    }

    async getGroups() {
        return this.callAPI('db', 'getGroups');
    }

    /**
     * 事件监听器管理
     */
    onScriptLog(callback) {
        const api = this.detectScriptAPI();
        if (api && typeof api.onLog === 'function') {
            return api.onLog(callback);
        }
        console.warn('[ApiClient] onLog 方法不可用');
        return null;
    }

    onScriptCompleted(callback) {
        const api = this.detectScriptAPI();
        if (api && typeof api.onScriptCompleted === 'function') {
            return api.onScriptCompleted(callback);
        }
        console.warn('[ApiClient] onScriptCompleted 方法不可用');
        return null;
    }

    /**
     * 辅助方法
     */
    shouldCache(apiType, method) {
        // 只缓存读取操作，不缓存写入操作
        const readMethods = [
            'getAllScripts', 'getWallets', 'getWalletById', 'getProxies', 
            'getGroups', 'getSocialAccounts'
        ];
        return readMethods.includes(method);
    }

    getCacheTTL(apiType, method) {
        // 根据数据类型设置不同的缓存时间
        const ttlMap = {
            'getAllScripts': 5 * 60 * 1000,    // 5分钟
            'getWallets': 10 * 60 * 1000,      // 10分钟
            'getWalletById': 5 * 60 * 1000,    // 5分钟
            'getProxies': 10 * 60 * 1000,      // 10分钟
            'getGroups': 15 * 60 * 1000        // 15分钟
        };
        return ttlMap[method] || 5 * 60 * 1000; // 默认5分钟
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 清除缓存
     */
    clearCache(pattern = null) {
        if (pattern) {
            this.cache.clear(pattern);
        } else {
            this.cache.clearAll();
        }
        console.log('[ApiClient] 缓存已清除');
    }

    /**
     * 获取统计信息
     */
    getStats() {
        return {
            cacheStats: this.cache.getStats(),
            errorStats: this.errorHandler.getStats(),
            config: {
                useCache: this.useCache,
                enableRetry: this.enableRetry,
                retryAttempts: this.retryAttempts
            }
        };
    }
} 