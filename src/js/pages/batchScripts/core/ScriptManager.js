/**
 * 脚本管理器 - 统一的脚本插件管理入口
 * 职责：脚本加载、缓存、配置管理、执行协调
 */

export class ScriptManager {
    constructor() {
        this.scriptCache = new Map(); // 脚本缓存
        this.configCache = new Map(); // 配置缓存
        this.loadingPromises = new Map(); // 防止重复加载
        
        console.log('[ScriptManager] 初始化完成');
    }

    /**
     * 获取所有可用脚本
     * @returns {Promise<Array>} 脚本列表
     */
    async getAvailableScripts() {
        try {
            console.log('[ScriptManager] 获取可用脚本列表');
            
            // 优先使用缓存
            if (this.scriptCache.size > 0) {
                return Array.from(this.scriptCache.values());
            }

            // 通过现有API获取脚本
            if (!window.scriptAPI) {
                throw new Error('脚本API不可用');
            }

            const response = await window.scriptAPI.getAllScripts();
            if (!response.success) {
                throw new Error(response.error || '获取脚本失败');
            }

            // 缓存脚本信息
            response.data.forEach(script => {
                this.scriptCache.set(script.id, script);
            });

            console.log(`[ScriptManager] 成功加载 ${response.data.length} 个脚本`);
            return response.data;
        } catch (error) {
            console.error('[ScriptManager] 获取脚本列表失败:', error);
            throw error;
        }
    }

    /**
     * 获取单个脚本信息
     * @param {string} scriptId - 脚本ID
     * @returns {Object|null} 脚本信息
     */
    getScript(scriptId) {
        return this.scriptCache.get(scriptId) || null;
    }

    /**
     * 获取脚本配置
     * @param {string} scriptId - 脚本ID
     * @returns {Object|null} 脚本配置
     */
    getScriptConfig(scriptId) {
        const script = this.getScript(scriptId);
        if (!script) return null;

        // 缓存配置信息
        if (!this.configCache.has(scriptId)) {
            this.configCache.set(scriptId, script.config || {});
        }

        return this.configCache.get(scriptId);
    }

    /**
     * 验证脚本执行参数
     * @param {string} scriptId - 脚本ID
     * @param {Object} params - 执行参数
     * @returns {Object} 验证结果 {valid: boolean, errors: Array}
     */
    validateScriptParams(scriptId, params) {
        const config = this.getScriptConfig(scriptId);
        if (!config) {
            return { valid: false, errors: ['脚本配置不存在'] };
        }

        const errors = [];
        
        // 验证必需的钱包参数
        if (config.requires?.wallets && (!params.wallets || params.wallets.length === 0)) {
            errors.push('该脚本需要至少选择一个钱包');
        }

        // 验证必需的代理参数
        if (config.requires?.proxy && !params.proxy) {
            errors.push('该脚本需要配置代理');
        }

        // 验证脚本特定参数
        if (config.params) {
            for (const [paramName, paramConfig] of Object.entries(config.params)) {
                if (paramConfig.required && !params.scriptParams?.[paramName]) {
                    errors.push(`参数 ${paramConfig.label || paramName} 是必需的`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 准备脚本执行上下文
     * @param {string} scriptId - 脚本ID
     * @param {Object} executionParams - 执行参数
     * @returns {Object} 执行上下文
     */
    prepareExecutionContext(scriptId, executionParams) {
        const script = this.getScript(scriptId);
        if (!script) {
            throw new Error(`脚本 ${scriptId} 不存在`);
        }

        const validation = this.validateScriptParams(scriptId, executionParams);
        if (!validation.valid) {
            throw new Error(`参数验证失败: ${validation.errors.join(', ')}`);
        }

        return {
            scriptId,
            scriptName: script.name,
            scriptConfig: this.getScriptConfig(scriptId),
            executionId: this.generateExecutionId(),
            timestamp: Date.now(),
            ...executionParams
        };
    }

    /**
     * 生成执行ID
     * @returns {string} 执行ID
     */
    generateExecutionId() {
        return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    }

    /**
     * 清理缓存
     */
    clearCache() {
        this.scriptCache.clear();
        this.configCache.clear();
        this.loadingPromises.clear();
        console.log('[ScriptManager] 缓存已清理');
    }

    /**
     * 刷新脚本列表
     * @returns {Promise<Array>} 脚本列表
     */
    async refreshScripts() {
        console.log('[ScriptManager] 刷新脚本列表');
        this.clearCache();
        return await this.getAvailableScripts();
    }

    /**
     * 获取脚本统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            scriptCount: this.scriptCache.size,
            configCacheSize: this.configCache.size,
            memoryUsage: {
                scripts: this.scriptCache.size,
                configs: this.configCache.size
            }
        };
    }
} 