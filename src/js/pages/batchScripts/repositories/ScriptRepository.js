/**
 * 脚本仓库类
 * 专门处理脚本相关的数据访问操作
 * 包括脚本列表获取、脚本执行、脚本同步等功能
 */

import { BaseRepository } from './BaseRepository.js';
import { FeatureFlags, isFeatureEnabled } from '../infrastructure/types.js';

export class ScriptRepository extends BaseRepository {
    constructor(options = {}) {
        super({
            repositoryName: 'ScriptRepository',
            defaultCacheTTL: 5 * 60 * 1000, // 脚本列表缓存5分钟
            ...options
        });

        // 脚本特定配置
        this.scriptCacheTTL = options.scriptCacheTTL || 10 * 60 * 1000; // 10分钟
        this.enableScriptValidation = options.enableScriptValidation !== false;
        
        console.log('[ScriptRepository] 脚本仓库初始化完成');
    }

    /**
     * 获取所有可用脚本
     * @param {Object} options - 获取选项
     * @returns {Promise<Object>} 脚本列表响应
     */
    async getAllScripts(options = {}) {
        const { forceRefresh = false, includeInactive = false } = options;
        
        try {
            console.log('[ScriptRepository] 获取所有脚本列表');
            
            const cacheKey = this.generateCacheKey('getAllScripts', [includeInactive]);
            const result = await this.executeWithCache(
                'getAllScripts', 
                [], 
                {
                    cacheKey,
                    cacheTTL: this.scriptCacheTTL,
                    forceRefresh,
                    apiType: 'script'
                }
            );

            if (result.success && result.data) {
                // 提取实际的脚本数据（处理双重包装问题）
                let actualData = result.data;
                console.log('[ScriptRepository] 原始result.data:', actualData);
                
                if (actualData && actualData.success && Array.isArray(actualData.data)) {
                    // 如果被双重包装，提取内层数据
                    console.log('[ScriptRepository] 检测到双重包装，提取内层数据');
                    actualData = actualData.data;
                }
                
                console.log('[ScriptRepository] 最终actualData:', actualData, '类型:', Array.isArray(actualData) ? 'Array' : typeof actualData);
                
                // 对脚本数据进行后处理
                const processedScripts = this.processScriptList(actualData, includeInactive);
                console.log('[ScriptRepository] 处理后的脚本数量:', processedScripts.length);
                return this.wrapSuccessResponse(processedScripts);
            }

            return result;

        } catch (error) {
            console.error('[ScriptRepository] 获取脚本列表失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 根据ID获取单个脚本
     * @param {string} scriptId - 脚本ID
     * @param {Object} options - 获取选项
     * @returns {Promise<Object>} 脚本详情响应
     */
    async getScriptById(scriptId, options = {}) {
        if (!scriptId) {
            return this.wrapErrorResponse(new Error('脚本ID不能为空'));
        }

        try {
            console.log(`[ScriptRepository] 获取脚本详情: ${scriptId}`);
            
            const cacheKey = this.generateCacheKey('getScriptById', [scriptId]);
            const result = await this.executeWithCache(
                'getScriptById',
                [scriptId],
                {
                    cacheKey,
                    cacheTTL: this.scriptCacheTTL,
                    forceRefresh: options.forceRefresh || false,
                    apiType: 'script'
                }
            );

            if (result.success && result.data) {
                // 提取实际的脚本数据（处理双重包装问题）
                let actualData = result.data;
                if (actualData && actualData.success && actualData.data) {
                    actualData = actualData.data;
                }
                
                // 验证脚本数据完整性
                const validatedScript = this.validateScriptData(actualData);
                return this.wrapSuccessResponse(validatedScript);
            }

            return result;

        } catch (error) {
            console.error(`[ScriptRepository] 获取脚本详情失败 (${scriptId}):`, error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 执行脚本
     * @param {string} scriptId - 脚本ID
     * @param {Object} executionConfig - 执行配置
     * @returns {Promise<Object>} 执行响应
     */
    async executeScript(scriptId, executionConfig = {}) {
        if (!scriptId) {
            return this.wrapErrorResponse(new Error('脚本ID不能为空'));
        }

        try {
            console.log(`[ScriptRepository] 执行脚本: ${scriptId}`);
            
            // 验证执行配置
            const validatedConfig = this.validateExecutionConfig(executionConfig);
            
            // 直接执行（不缓存执行结果）
            const result = await this.executeDirect(
                'script',
                'executeScript',
                [scriptId, validatedConfig]
            );

            if (result.success) {
                console.log(`[ScriptRepository] 脚本执行成功: ${scriptId}`, result.data);
                
                // 记录执行历史（可选）
                this.recordExecutionHistory(scriptId, validatedConfig, result.data);
            }

            return result;

        } catch (error) {
            console.error(`[ScriptRepository] 脚本执行失败 (${scriptId}):`, error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 停止脚本执行
     * @param {string} executionId - 执行ID
     * @returns {Promise<Object>} 停止响应
     */
    async stopScript(executionId) {
        if (!executionId) {
            return this.wrapErrorResponse(new Error('执行ID不能为空'));
        }

        try {
            console.log(`[ScriptRepository] 停止脚本执行: ${executionId}`);
            
            const result = await this.executeDirect(
                'script',
                'stopScript',
                [executionId]
            );

            if (result.success) {
                console.log(`[ScriptRepository] 脚本停止成功: ${executionId}`);
            }

            return result;

        } catch (error) {
            console.error(`[ScriptRepository] 停止脚本失败 (${executionId}):`, error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 同步脚本列表
     * @param {Object} options - 同步选项
     * @returns {Promise<Object>} 同步响应
     */
    async syncScripts(options = {}) {
        try {
            console.log('[ScriptRepository] 开始同步脚本列表');
            
            const result = await this.executeDirect(
                'script',
                'syncScripts',
                []
            );

            if (result.success) {
                // 同步成功后清除相关缓存
                this.clearCache('getAllScripts');
                console.log('[ScriptRepository] 脚本同步完成，缓存已清除');
                
                // 如果有删除的脚本，记录日志
                if (result.data && result.data.processedScripts) {
                    const deletedScripts = result.data.processedScripts.filter(s => s.status === 'deleted');
                    if (deletedScripts.length > 0) {
                        console.log(`[ScriptRepository] 清理了 ${deletedScripts.length} 个无效脚本`);
                    }
                }
            }

            return result;

        } catch (error) {
            console.error('[ScriptRepository] 脚本同步失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 获取脚本执行历史
     * @param {string} scriptId - 脚本ID（可选）
     * @param {number} limit - 限制数量
     * @returns {Promise<Object>} 执行历史响应
     */
    async getExecutionHistory(scriptId = null, limit = 50) {
        try {
            console.log(`[ScriptRepository] 获取执行历史 (${scriptId || '全部'})`);
            
            const args = scriptId ? [scriptId, limit] : [limit];
            const cacheKey = this.generateCacheKey('getExecutionHistory', args);
            
            const result = await this.executeWithCache(
                'getExecutionHistory',
                args,
                {
                    cacheKey,
                    cacheTTL: 2 * 60 * 1000, // 执行历史缓存2分钟
                    apiType: 'script'
                }
            );

            return result;

        } catch (error) {
            console.error('[ScriptRepository] 获取执行历史失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 处理脚本列表数据
     * @param {Array} scripts - 原始脚本列表
     * @param {boolean} includeInactive - 是否包含非活跃脚本
     * @returns {Array} 处理后的脚本列表
     */
    processScriptList(scripts, includeInactive = false) {
        console.log('[ScriptRepository] processScriptList 接收到的数据:', scripts, '类型:', Array.isArray(scripts) ? 'Array' : typeof scripts);
        
        if (!Array.isArray(scripts)) {
            console.warn('[ScriptRepository] 脚本数据不是数组格式:', scripts);
            return [];
        }

        return scripts
            .map(script => this.normalizeScriptData(script))
            .filter(script => includeInactive || script.status === 'active')
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * 标准化脚本数据格式
     * @param {Object} script - 原始脚本数据
     * @returns {Object} 标准化后的脚本数据
     */
    normalizeScriptData(script) {
        return {
            id: script.id || '',
            name: script.name || '未命名脚本',
            description: script.description || '',
            version: script.version || '1.0.0',
            author: script.author || '',
            category: script.category || 'other',
            status: script.status || 'active',
            // 保留图片和图标字段
            imageUrl: script.imageUrl || null,
            icon: script.icon || null,
            requires: {
                wallets: script.requires?.wallets || false,
                proxies: script.requires?.proxies || false,
                socialsAccounts: script.requires?.socialsAccounts || false
            },
            params: script.params || {},
            filePath: script.filePath || '',
            createdAt: script.createdAt || null,
            updatedAt: script.updatedAt || null,
            // 添加额外的元数据
            _metadata: {
                lastAccessed: Date.now(),
                source: 'ScriptRepository'
            }
        };
    }

    /**
     * 验证脚本数据完整性
     * @param {Object} script - 脚本数据
     * @returns {Object} 验证后的脚本数据
     */
    validateScriptData(script) {
        if (!this.enableScriptValidation) {
            return script;
        }

        const errors = [];
        
        if (!script.id) errors.push('缺少脚本ID');
        if (!script.name) errors.push('缺少脚本名称');
        if (!script.filePath) errors.push('缺少脚本文件路径');

        if (errors.length > 0) {
            console.warn(`[ScriptRepository] 脚本数据验证警告 (${script.id}):`, errors);
        }

        return this.normalizeScriptData(script);
    }

    /**
     * 验证执行配置
     * @param {Object} config - 执行配置
     * @returns {Object} 验证后的配置
     */
    validateExecutionConfig(config) {
        const validatedConfig = {
            wallets: config.wallets || [],
            proxyConfig: config.proxyConfig || null,
            scriptParams: config.scriptParams || {},
            // 添加默认配置
            maxRetries: config.maxRetries || 3,
            timeout: config.timeout || 300000, // 5分钟超时
            parallel: config.parallel || false
        };

        // 验证钱包数据
        if (Array.isArray(validatedConfig.wallets) && validatedConfig.wallets.length === 0) {
            console.warn('[ScriptRepository] 执行配置中没有钱包数据');
        }

        return validatedConfig;
    }

    /**
     * 记录执行历史
     * @param {string} scriptId - 脚本ID
     * @param {Object} config - 执行配置
     * @param {Object} result - 执行结果
     */
    recordExecutionHistory(scriptId, config, result) {
        try {
            const historyEntry = {
                scriptId,
                executionId: result.executionId,
                timestamp: Date.now(),
                walletCount: config.wallets?.length || 0,
                hasProxy: !!config.proxyConfig,
                status: 'started'
            };

            // 这里可以扩展为实际的历史记录存储
            console.log('[ScriptRepository] 执行历史记录:', historyEntry);
        } catch (error) {
            console.warn('[ScriptRepository] 记录执行历史失败:', error);
        }
    }

    /**
     * 批量获取脚本详情
     * @param {Array} scriptIds - 脚本ID列表
     * @returns {Promise<Object>} 批量脚本详情响应
     */
    async getBatchScripts(scriptIds) {
        if (!Array.isArray(scriptIds) || scriptIds.length === 0) {
            return this.wrapErrorResponse(new Error('脚本ID列表不能为空'));
        }

        try {
            console.log(`[ScriptRepository] 批量获取脚本详情: ${scriptIds.length} 个`);
            
            const calls = scriptIds.map(scriptId => ({
                apiType: 'script',
                method: 'getScriptById',
                args: [scriptId],
                options: { cacheTTL: this.scriptCacheTTL }
            }));

            const results = await this.executeBatch(calls);
            
            // 处理批量结果
            const processedResults = results.map((result, index) => {
                if (result.status === 'fulfilled' && result.value.success) {
                    return {
                        scriptId: scriptIds[index],
                        success: true,
                        data: this.validateScriptData(result.value.data)
                    };
                } else {
                    return {
                        scriptId: scriptIds[index],
                        success: false,
                        error: result.reason?.message || '获取失败'
                    };
                }
            });

            return this.wrapSuccessResponse(processedResults);

        } catch (error) {
            console.error('[ScriptRepository] 批量获取脚本失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 清除脚本相关缓存
     * @param {string} scriptId - 特定脚本ID（可选）
     */
    clearScriptCache(scriptId = null) {
        if (scriptId) {
            this.clearCache(`getScriptById.*${scriptId}`);
            console.log(`[ScriptRepository] 已清除脚本 ${scriptId} 的缓存`);
        } else {
            this.clearCache();
            console.log('[ScriptRepository] 已清除所有脚本缓存');
        }
    }

    /**
     * 获取脚本仓库特定统计信息
     * @returns {Object} 扩展统计信息
     */
    getExtendedStats() {
        const baseStats = this.getStats();
        
        return {
            ...baseStats,
            scriptSpecific: {
                scriptCacheTTL: this.scriptCacheTTL,
                validationEnabled: this.enableScriptValidation,
                // 可以添加更多脚本特定的统计信息
            }
        };
    }
} 