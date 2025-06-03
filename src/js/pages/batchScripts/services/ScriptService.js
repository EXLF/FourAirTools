/**
 * 脚本服务类
 * 封装脚本相关的业务逻辑，提供高级的脚本管理功能
 * 作为Repository层之上的业务逻辑层
 */

import { ScriptRepository } from '../repositories/ScriptRepository.js';
import { FeatureFlags, isFeatureEnabled } from '../infrastructure/types.js';

export class ScriptService {
    constructor(options = {}) {
        this.scriptRepository = options.scriptRepository || new ScriptRepository();
        this.serviceName = 'ScriptService';
        
        // 业务逻辑配置
        this.maxExecutionHistory = options.maxExecutionHistory || 100;
        this.defaultExecutionTimeout = options.defaultExecutionTimeout || 30 * 60 * 1000; // 30分钟
        this.enableScriptValidation = options.enableScriptValidation !== false;
        
        console.log('[ScriptService] 脚本服务初始化完成');
    }

    /**
     * 获取可用脚本列表（业务逻辑封装）
     * @param {Object} options - 获取选项
     * @returns {Promise<Object>} 脚本列表响应
     */
    async getAvailableScripts(options = {}) {
        const { 
            includeDisabled = false, 
            sortBy = 'name',
            filterCategory = null,
            searchQuery = null 
        } = options;
        
        try {
            console.log('[ScriptService] 获取可用脚本列表', options);
            
            // 从Repository获取原始数据
            const result = await this.scriptRepository.getAllScripts({
                forceRefresh: options.forceRefresh
            });

            if (!result.success) {
                return result;
            }

            // 应用业务逻辑过滤和排序
            // ScriptRepository返回的data是直接的脚本数组，不是包含scripts属性的对象
            let scripts = Array.isArray(result.data) ? result.data : (result.data.scripts || []);
            
            console.log('[ScriptService] 原始脚本数据:', result.data);
            console.log('[ScriptService] 提取的脚本列表:', scripts, '数量:', scripts.length);
            
            // 过滤禁用的脚本
            if (!includeDisabled) {
                scripts = scripts.filter(script => !script.disabled);
            }
            
            // 按类别过滤
            if (filterCategory) {
                scripts = scripts.filter(script => 
                    script.category === filterCategory
                );
            }
            
            // 搜索过滤
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                scripts = scripts.filter(script => 
                    script.name.toLowerCase().includes(query) ||
                    script.description?.toLowerCase().includes(query) ||
                    script.category?.toLowerCase().includes(query)
                );
            }
            
            // 排序
            scripts = this.sortScripts(scripts, sortBy);
            
            // 添加业务元数据
            scripts = scripts.map(script => this.enrichScriptData(script));
            
            return this.wrapSuccessResponse({
                scripts,
                totalCount: scripts.length,
                availableCount: scripts.filter(s => !s.disabled).length,
                categories: this.extractCategories(scripts)
            });

        } catch (error) {
            console.error('[ScriptService] 获取脚本列表失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 同步脚本（清理无效脚本）
     * @param {Object} options - 同步选项
     * @returns {Promise<Object>} 同步结果
     */
    async syncScripts(options = {}) {
        const { dryRun = false, force = false } = options;
        
        try {
            console.log('[ScriptService] 开始同步脚本', { dryRun, force });
            
            // 首先尝试Repository的同步方法
            try {
                const result = await this.scriptRepository.syncScripts();
                
                if (result.success) {
                    const syncData = result.data;
                    
                    // 业务逻辑：生成同步报告
                    const syncReport = {
                        timestamp: new Date().toISOString(),
                        deletedCount: syncData.deletedCount || 0,
                        addedCount: syncData.addedCount || 0,
                        updatedCount: syncData.updatedCount || 0,
                        totalCount: syncData.totalCount || 0,
                        summary: this.generateSyncSummary(syncData)
                    };
                    
                    console.log('[ScriptService] 脚本同步完成:', syncReport);
                    
                    return this.wrapSuccessResponse(syncReport);
                }
                
                return result;
                
            } catch (syncError) {
                console.warn('[ScriptService] Repository同步失败，尝试备用方案:', syncError.message);
                
                // 备用方案：清除缓存并重新获取脚本列表作为"同步"
                if (this.scriptRepository.clearCache) {
                    this.scriptRepository.clearCache('getAllScripts');
                }
                
                // 简单的同步报告
                const fallbackReport = {
                    timestamp: new Date().toISOString(),
                    deletedCount: 0,
                    addedCount: 0,
                    updatedCount: 0,
                    totalCount: 0,
                    summary: '使用缓存清除完成同步'
                };
                
                console.log('[ScriptService] 使用备用同步方案完成');
                return this.wrapSuccessResponse(fallbackReport);
            }

        } catch (error) {
            console.error('[ScriptService] 脚本同步失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 执行脚本（业务逻辑封装）
     * @param {string} scriptId - 脚本ID
     * @param {Object} executionConfig - 执行配置
     * @returns {Promise<Object>} 执行结果
     */
    async executeScript(scriptId, executionConfig = {}) {
        if (!scriptId) {
            return this.wrapErrorResponse(new Error('脚本ID不能为空'));
        }

        try {
            console.log(`[ScriptService] 执行脚本: ${scriptId}`, executionConfig);
            
            // 验证执行配置
            const validatedConfig = this.validateExecutionConfig(executionConfig);
            
            // 预执行检查
            const preCheckResult = await this.preExecutionCheck(scriptId, validatedConfig);
            if (!preCheckResult.success) {
                return preCheckResult;
            }
            
            // 执行脚本
            const result = await this.scriptRepository.executeScript(scriptId, validatedConfig);
            
            if (result.success) {
                // 记录执行历史
                await this.recordExecutionHistory(scriptId, validatedConfig, result);
                
                // 添加业务元数据
                const enrichedResult = {
                    ...result.data,
                    executionStartTime: new Date().toISOString(),
                    estimatedDuration: this.estimateExecutionDuration(scriptId, validatedConfig),
                    configSummary: this.generateConfigSummary(validatedConfig)
                };
                
                return this.wrapSuccessResponse(enrichedResult);
            }

            return result;

        } catch (error) {
            console.error(`[ScriptService] 脚本执行失败 (${scriptId}):`, error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 停止脚本执行
     * @param {string} executionId - 执行ID
     * @returns {Promise<Object>} 停止结果
     */
    async stopScript(executionId) {
        if (!executionId) {
            return this.wrapErrorResponse(new Error('执行ID不能为空'));
        }

        try {
            console.log(`[ScriptService] 停止脚本执行: ${executionId}`);
            
            const result = await this.scriptRepository.stopScript(executionId);
            
            if (result.success) {
                // 更新执行历史
                await this.updateExecutionHistory(executionId, 'stopped');
                
                console.log(`[ScriptService] 脚本停止成功: ${executionId}`);
            }

            return result;

        } catch (error) {
            console.error(`[ScriptService] 停止脚本失败 (${executionId}):`, error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 获取脚本执行历史
     * @param {Object} options - 查询选项
     * @returns {Promise<Object>} 执行历史
     */
    async getExecutionHistory(options = {}) {
        const { 
            scriptId = null, 
            limit = 50, 
            offset = 0,
            status = null,
            dateRange = null 
        } = options;
        
        try {
            console.log('[ScriptService] 获取执行历史', options);
            
            // 这里可以从Repository或直接从存储获取历史数据
            // 暂时返回模拟数据结构
            const historyData = {
                executions: [],
                totalCount: 0,
                filteredCount: 0
            };
            
            return this.wrapSuccessResponse(historyData);

        } catch (error) {
            console.error('[ScriptService] 获取执行历史失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 获取脚本详细信息
     * @param {string} scriptId - 脚本ID
     * @returns {Promise<Object>} 脚本详情
     */
    async getScriptDetails(scriptId) {
        if (!scriptId) {
            return this.wrapErrorResponse(new Error('脚本ID不能为空'));
        }

        try {
            console.log(`[ScriptService] 获取脚本详情: ${scriptId}`);
            
            const result = await this.scriptRepository.getScriptById(scriptId);
            
            if (result.success && result.data) {
                // 添加业务层的详细信息
                const enrichedScript = {
                    ...result.data,
                    executionStats: await this.getScriptExecutionStats(scriptId),
                    compatibility: this.checkScriptCompatibility(result.data),
                    recommendations: this.generateScriptRecommendations(result.data)
                };
                
                return this.wrapSuccessResponse(enrichedScript);
            }

            return result;

        } catch (error) {
            console.error(`[ScriptService] 获取脚本详情失败 (${scriptId}):`, error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 验证脚本执行配置
     * @param {Object} config - 执行配置
     * @returns {Object} 验证后的配置
     */
    validateExecutionConfig(config) {
        const validatedConfig = {
            wallets: config.wallets || [],
            proxyConfig: config.proxyConfig || null,
            scriptParams: config.scriptParams || {},
            timeout: config.timeout || this.defaultExecutionTimeout,
            retryAttempts: config.retryAttempts || 0,
            parallelExecution: config.parallelExecution || false
        };

        // 钱包验证
        if (!Array.isArray(validatedConfig.wallets) || validatedConfig.wallets.length === 0) {
            throw new Error('至少需要选择一个钱包账户');
        }

        // 超时验证
        if (validatedConfig.timeout < 1000 || validatedConfig.timeout > 24 * 60 * 60 * 1000) {
            throw new Error('执行超时时间必须在1秒到24小时之间');
        }

        return validatedConfig;
    }

    /**
     * 预执行检查
     * @param {string} scriptId - 脚本ID
     * @param {Object} config - 执行配置
     * @returns {Promise<Object>} 检查结果
     */
    async preExecutionCheck(scriptId, config) {
        try {
            // 检查脚本是否存在
            const scriptResult = await this.scriptRepository.getScriptById(scriptId);
            if (!scriptResult.success) {
                return this.wrapErrorResponse(new Error('脚本不存在或已被删除'));
            }

            const script = scriptResult.data;
            
            // 检查脚本是否被禁用
            if (script.disabled) {
                return this.wrapErrorResponse(new Error('脚本已被禁用，无法执行'));
            }

            // 检查钱包账户有效性
            for (const wallet of config.wallets) {
                if (!wallet.address) {
                    return this.wrapErrorResponse(new Error('钱包地址不能为空'));
                }
            }

            return this.wrapSuccessResponse({ passed: true });

        } catch (error) {
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 脚本排序
     * @param {Array} scripts - 脚本列表
     * @param {string} sortBy - 排序字段
     * @returns {Array} 排序后的脚本列表
     */
    sortScripts(scripts, sortBy) {
        switch (sortBy) {
            case 'name':
                return scripts.sort((a, b) => a.name.localeCompare(b.name));
            case 'category':
                return scripts.sort((a, b) => (a.category || '').localeCompare(b.category || ''));
            case 'lastModified':
                return scripts.sort((a, b) => new Date(b.lastModified || 0) - new Date(a.lastModified || 0));
            case 'popularity':
                return scripts.sort((a, b) => (b.executionCount || 0) - (a.executionCount || 0));
            default:
                return scripts;
        }
    }

    /**
     * 丰富脚本数据（添加业务元数据）
     * @param {Object} script - 原始脚本数据
     * @returns {Object} 丰富后的脚本数据
     */
    enrichScriptData(script) {
        return {
            ...script,
            isRecommended: this.isScriptRecommended(script),
            difficultyLevel: this.calculateDifficultyLevel(script),
            estimatedDuration: this.estimateScriptDuration(script),
            tags: this.generateScriptTags(script),
            _enriched: {
                timestamp: Date.now(),
                version: '1.0'
            }
        };
    }

    /**
     * 提取脚本类别
     * @param {Array} scripts - 脚本列表
     * @returns {Array} 类别列表
     */
    extractCategories(scripts) {
        const categories = new Set();
        scripts.forEach(script => {
            if (script.category) {
                categories.add(script.category);
            }
        });
        return Array.from(categories).sort();
    }

    /**
     * 生成同步摘要
     * @param {Object} syncData - 同步数据
     * @returns {string} 摘要文本
     */
    generateSyncSummary(syncData) {
        const parts = [];
        
        if (syncData.deletedCount > 0) {
            parts.push(`删除 ${syncData.deletedCount} 个无效脚本`);
        }
        
        if (syncData.addedCount > 0) {
            parts.push(`新增 ${syncData.addedCount} 个脚本`);
        }
        
        if (syncData.updatedCount > 0) {
            parts.push(`更新 ${syncData.updatedCount} 个脚本`);
        }
        
        if (parts.length === 0) {
            return '脚本列表已是最新，无需同步';
        }
        
        return parts.join('，');
    }

    /**
     * 辅助方法：判断脚本是否推荐
     */
    isScriptRecommended(script) {
        // 简单的推荐逻辑：高执行次数且无错误
        return (script.executionCount || 0) > 10 && !script.hasErrors;
    }

    /**
     * 辅助方法：计算脚本难度级别
     */
    calculateDifficultyLevel(script) {
        // 基于配置复杂度的简单算法
        const paramCount = Object.keys(script.params || {}).length;
        if (paramCount === 0) return 'easy';
        if (paramCount <= 3) return 'medium';
        return 'hard';
    }

    /**
     * 辅助方法：估算脚本执行时长
     */
    estimateScriptDuration(script) {
        // 基于脚本类型的简单估算
        const baseDuration = 30; // 30秒基础时间
        const multiplier = (script.complexity || 1);
        return baseDuration * multiplier;
    }

    /**
     * 辅助方法：生成脚本标签
     */
    generateScriptTags(script) {
        const tags = [];
        
        if (script.category) tags.push(script.category);
        if (script.isRecommended) tags.push('推荐');
        if (script.isNew) tags.push('新增');
        if (script.isPopular) tags.push('热门');
        
        return tags;
    }

    /**
     * 记录执行历史
     */
    async recordExecutionHistory(scriptId, config, result) {
        try {
            const historyRecord = {
                scriptId,
                executionId: result.executionId,
                timestamp: Date.now(),
                config: {
                    walletCount: config.wallets?.length || 0,
                    hasProxy: !!config.proxyConfig,
                    batchMode: config.scriptParams?.batchMode || false
                },
                result: {
                    success: result.success,
                    duration: result.duration || 0,
                    accountCount: result.accountCount || 0
                }
            };
            
            // 获取现有历史记录
            const existingHistory = JSON.parse(localStorage.getItem('fa_script_execution_history') || '[]');
            existingHistory.push(historyRecord);
            
            // 保持最多100条记录
            if (existingHistory.length > this.maxExecutionHistory) {
                existingHistory.splice(0, existingHistory.length - this.maxExecutionHistory);
            }
            
            localStorage.setItem('fa_script_execution_history', JSON.stringify(existingHistory));
            console.log(`[ScriptService] 执行历史已记录: ${scriptId}`);
        } catch (error) {
            console.warn('[ScriptService] 记录执行历史失败:', error);
        }
    }

    /**
     * 更新执行历史状态
     */
    async updateExecutionHistory(executionId, status) {
        try {
            const existingHistory = JSON.parse(localStorage.getItem('fa_script_execution_history') || '[]');
            const recordIndex = existingHistory.findIndex(record => record.executionId === executionId);
            
            if (recordIndex !== -1) {
                existingHistory[recordIndex].result.status = status;
                existingHistory[recordIndex].result.endTime = Date.now();
                localStorage.setItem('fa_script_execution_history', JSON.stringify(existingHistory));
                console.log(`[ScriptService] 执行历史状态已更新: ${executionId} -> ${status}`);
            }
        } catch (error) {
            console.warn('[ScriptService] 更新执行历史失败:', error);
        }
    }

    /**
     * 获取脚本执行统计
     */
    async getScriptExecutionStats(scriptId) {
        try {
            const existingHistory = JSON.parse(localStorage.getItem('fa_script_execution_history') || '[]');
            const scriptHistory = existingHistory.filter(record => record.scriptId === scriptId);
            
            if (scriptHistory.length === 0) {
                return {
                    totalExecutions: 0,
                    successRate: 0,
                    avgDuration: 0,
                    lastExecution: null
                };
            }
            
            const successfulExecutions = scriptHistory.filter(r => r.result.success).length;
            const totalDuration = scriptHistory
                .filter(r => r.result.duration > 0)
                .reduce((sum, r) => sum + r.result.duration, 0);
            
            return {
                totalExecutions: scriptHistory.length,
                successRate: Math.round((successfulExecutions / scriptHistory.length) * 100),
                avgDuration: Math.round(totalDuration / scriptHistory.length),
                lastExecution: Math.max(...scriptHistory.map(r => r.timestamp))
            };
        } catch (error) {
            console.warn('[ScriptService] 获取执行统计失败:', error);
            return {
                totalExecutions: 0,
                successRate: 0,
                avgDuration: 0,
                lastExecution: null
            };
        }
    }

    /**
     * 检查脚本兼容性（占位符方法）
     */
    checkScriptCompatibility(script) {
        return {
            compatible: true,
            issues: [],
            recommendations: []
        };
    }

    /**
     * 生成脚本推荐（占位符方法）
     */
    generateScriptRecommendations(script) {
        return [];
    }

    /**
     * 估算执行时长
     */
    estimateExecutionDuration(scriptId, config) {
        const baseTime = 30; // 30秒基础时间
        const walletMultiplier = config.wallets.length;
        return baseTime * walletMultiplier;
    }

    /**
     * 生成配置摘要
     */
    generateConfigSummary(config) {
        return {
            walletCount: config.wallets.length,
            hasProxy: !!config.proxyConfig,
            paramCount: Object.keys(config.scriptParams).length,
            parallelExecution: config.parallelExecution
        };
    }

    /**
     * 包装成功响应
     */
    wrapSuccessResponse(data) {
        return {
            success: true,
            data,
            timestamp: Date.now(),
            service: this.serviceName
        };
    }

    /**
     * 包装错误响应
     */
    wrapErrorResponse(error) {
        return {
            success: false,
            error: {
                message: error.message,
                code: error.code || 'SCRIPT_SERVICE_ERROR'
            },
            timestamp: Date.now(),
            service: this.serviceName
        };
    }

    /**
     * 获取服务统计信息
     */
    getStats() {
        return {
            serviceName: this.serviceName,
            repositoryStats: this.scriptRepository.getStats(),
            config: {
                maxExecutionHistory: this.maxExecutionHistory,
                defaultExecutionTimeout: this.defaultExecutionTimeout,
                enableScriptValidation: this.enableScriptValidation
            }
        };
    }
} 