/**
 * 钱包仓库类
 * 专门处理钱包相关的数据访问操作
 * 包括钱包列表获取、钱包详情查询、钱包分组管理等功能
 */

import { BaseRepository } from './BaseRepository.js';
import { FeatureFlags, isFeatureEnabled } from '../infrastructure/types.js';

export class WalletRepository extends BaseRepository {
    constructor(options = {}) {
        super({
            repositoryName: 'WalletRepository',
            defaultCacheTTL: 3 * 60 * 1000, // 钱包列表缓存3分钟
            ...options
        });

        // 钱包特定配置
        this.walletCacheTTL = options.walletCacheTTL || 5 * 60 * 1000; // 5分钟
        this.groupCacheTTL = options.groupCacheTTL || 10 * 60 * 1000; // 分组缓存10分钟
        this.enableWalletValidation = options.enableWalletValidation !== false;
        
        console.log('[WalletRepository] 钱包仓库初始化完成');
    }

    /**
     * 获取所有钱包
     * @param {Object} options - 查询选项
     * @returns {Promise<Object>} 钱包列表响应
     */
    async getAllWallets(options = {}) {
        const { 
            forceRefresh = false, 
            groupId = null, 
            search = null,
            sortBy = 'createdAt',
            sortOrder = 'DESC',
            limit = null,
            offset = 0
        } = options;
        
        // 处理空对象参数，避免SQLite数据类型不匹配错误
        const cleanedOptions = {};
        if (groupId !== null) cleanedOptions.groupId = groupId;
        if (search !== null && search !== '') cleanedOptions.search = search;
        if (sortBy) cleanedOptions.sortBy = sortBy;
        if (sortOrder) cleanedOptions.sortOrder = sortOrder;
        if (limit !== null) cleanedOptions.limit = limit;
        if (offset !== 0) cleanedOptions.offset = offset;
        
        try {
            console.log('[WalletRepository] 获取钱包列表', options);
            
            const cacheKey = this.generateCacheKey('getAllWallets', [
                groupId, search, sortBy, sortOrder, limit, offset
            ]);
            
            const result = await this.executeWithCache(
                'getWallets', 
                [cleanedOptions], 
                {
                    cacheKey,
                    cacheTTL: this.walletCacheTTL,
                    forceRefresh,
                    apiType: 'db'
                }
            );

            if (result.success && result.data) {
                // 提取实际的钱包数据（处理可能的双重包装）
                let actualData = result.data;
                console.log('[WalletRepository] 原始result.data:', actualData);
                
                // 处理不同的返回格式
                if (actualData && actualData.success && actualData.data) {
                    // 双重包装的情况
                    console.log('[WalletRepository] 检测到双重包装，提取内层数据');
                    actualData = actualData.data;
                } else if (actualData && actualData.wallets && Array.isArray(actualData.wallets)) {
                    // 标准dbAPI返回格式：{wallets: [], totalCount: n}
                    console.log('[WalletRepository] 标准dbAPI格式，提取wallets数组');
                    const processedWallets = this.processWalletList(actualData.wallets);
                    return this.wrapSuccessResponse({
                        wallets: processedWallets,
                        totalCount: actualData.totalCount || processedWallets.length
                    });
                }
                
                if (Array.isArray(actualData)) {
                    // 直接是钱包数组
                    console.log('[WalletRepository] 钱包数组格式');
                    const processedWallets = this.processWalletList(actualData);
                    return this.wrapSuccessResponse({
                        wallets: processedWallets,
                        totalCount: processedWallets.length
                    });
                }
                
                console.log('[WalletRepository] 最终actualData:', actualData, '类型:', typeof actualData);
                
                // 如果数据格式不符合预期，返回空列表
                console.warn('[WalletRepository] 未知的数据格式，返回空列表');
                return this.wrapSuccessResponse({
                    wallets: [],
                    totalCount: 0
                });
            }

            return result;

        } catch (error) {
            console.error('[WalletRepository] 获取钱包列表失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 根据ID获取单个钱包
     * @param {number} walletId - 钱包ID
     * @param {Object} options - 获取选项
     * @returns {Promise<Object>} 钱包详情响应
     */
    async getWalletById(walletId, options = {}) {
        if (!walletId) {
            return this.wrapErrorResponse(new Error('钱包ID不能为空'));
        }

        try {
            console.log(`[WalletRepository] 获取钱包详情: ${walletId}`);
            
            const cacheKey = this.generateCacheKey('getWalletById', [walletId]);
            const result = await this.executeWithCache(
                'getWalletById',
                [walletId],
                {
                    cacheKey,
                    cacheTTL: this.walletCacheTTL,
                    forceRefresh: options.forceRefresh || false,
                    apiType: 'db'
                }
            );

            if (result.success && result.data) {
                // 提取实际的钱包数据（处理双重包装问题）
                let actualData = result.data;
                if (actualData && actualData.success && actualData.data) {
                    actualData = actualData.data;
                }
                
                // 验证钱包数据完整性
                const validatedWallet = this.validateWalletData(actualData);
                return this.wrapSuccessResponse(validatedWallet);
            }

            return result;

        } catch (error) {
            console.error(`[WalletRepository] 获取钱包详情失败 (${walletId}):`, error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 批量获取钱包详情
     * @param {Array} walletIds - 钱包ID列表
     * @returns {Promise<Object>} 批量钱包详情响应
     */
    async getWalletsByIds(walletIds) {
        if (!Array.isArray(walletIds) || walletIds.length === 0) {
            return this.wrapErrorResponse(new Error('钱包ID列表不能为空'));
        }

        try {
            console.log(`[WalletRepository] 批量获取钱包详情: ${walletIds.length} 个`);
            
            const calls = walletIds.map(walletId => ({
                apiType: 'db',
                method: 'getWalletById',
                args: [walletId],
                options: { cacheTTL: this.walletCacheTTL }
            }));

            const results = await this.executeBatch(calls);
            
            // 处理批量结果
            const processedResults = results.map((result, index) => {
                if (result.status === 'fulfilled' && result.value && result.value.success) {
                    return {
                        walletId: walletIds[index],
                        success: true,
                        data: this.validateWalletData(result.value.data)
                    };
                } else {
                    return {
                        walletId: walletIds[index],
                        success: false,
                        error: result.reason?.message || result.value?.error?.message || '获取失败'
                    };
                }
            });

            return this.wrapSuccessResponse(processedResults);

        } catch (error) {
            console.error('[WalletRepository] 批量获取钱包失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 获取所有分组
     * @param {Object} options - 获取选项
     * @returns {Promise<Object>} 分组列表响应
     */
    async getAllGroups(options = {}) {
        const { forceRefresh = false } = options;
        
        try {
            console.log('[WalletRepository] 获取分组列表');
            
            const cacheKey = this.generateCacheKey('getAllGroups', []);
            const result = await this.executeWithCache(
                'getGroups', 
                [], 
                {
                    cacheKey,
                    cacheTTL: this.groupCacheTTL,
                    forceRefresh,
                    apiType: 'db'
                }
            );

            if (result.success && result.data) {
                // 提取实际的分组数据
                let actualData = result.data;
                if (actualData && actualData.success && actualData.data) {
                    actualData = actualData.data;
                }
                
                // 处理分组数据
                const processedGroups = this.processGroupList(actualData);
                return this.wrapSuccessResponse(processedGroups);
            }

            return result;

        } catch (error) {
            console.error('[WalletRepository] 获取分组列表失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 添加新钱包
     * @param {Object} walletData - 钱包数据
     * @returns {Promise<Object>} 添加响应
     */
    async addWallet(walletData) {
        if (!walletData || !walletData.address) {
            return this.wrapErrorResponse(new Error('钱包地址不能为空'));
        }

        try {
            console.log('[WalletRepository] 添加新钱包:', walletData.address);
            
            // 验证钱包数据
            const validatedData = this.validateWalletInputData(walletData);
            
            // 直接执行（不缓存添加操作）
            const result = await this.executeDirect(
                'db',
                'addWallet',
                [validatedData]
            );

            if (result.success) {
                console.log('[WalletRepository] 钱包添加成功:', result.data);
                
                // 清除相关缓存
                this.clearCache('getAllWallets');
            }

            return result;

        } catch (error) {
            console.error('[WalletRepository] 添加钱包失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 更新钱包信息
     * @param {number} walletId - 钱包ID
     * @param {Object} updateData - 更新数据
     * @returns {Promise<Object>} 更新响应
     */
    async updateWallet(walletId, updateData) {
        if (!walletId) {
            return this.wrapErrorResponse(new Error('钱包ID不能为空'));
        }

        try {
            console.log(`[WalletRepository] 更新钱包: ${walletId}`);
            
            // 验证更新数据
            const validatedData = this.validateWalletUpdateData(updateData);
            
            const result = await this.executeDirect(
                'db',
                'updateWallet',
                [walletId, validatedData]
            );

            if (result.success) {
                console.log(`[WalletRepository] 钱包更新成功: ${walletId}`);
                
                // 清除相关缓存
                this.clearCache(`getWalletById.*${walletId}`);
                this.clearCache('getAllWallets');
            }

            return result;

        } catch (error) {
            console.error(`[WalletRepository] 更新钱包失败 (${walletId}):`, error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 删除钱包
     * @param {number} walletId - 钱包ID
     * @returns {Promise<Object>} 删除响应
     */
    async deleteWallet(walletId) {
        if (!walletId) {
            return this.wrapErrorResponse(new Error('钱包ID不能为空'));
        }

        try {
            console.log(`[WalletRepository] 删除钱包: ${walletId}`);
            
            const result = await this.executeDirect(
                'db',
                'deleteWallet',
                [walletId]
            );

            if (result.success) {
                console.log(`[WalletRepository] 钱包删除成功: ${walletId}`);
                
                // 清除相关缓存
                this.clearCache(`getWalletById.*${walletId}`);
                this.clearCache('getAllWallets');
            }

            return result;

        } catch (error) {
            console.error(`[WalletRepository] 删除钱包失败 (${walletId}):`, error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 批量删除钱包
     * @param {Array} walletIds - 钱包ID列表
     * @returns {Promise<Object>} 删除响应
     */
    async deleteWalletsByIds(walletIds) {
        if (!Array.isArray(walletIds) || walletIds.length === 0) {
            return this.wrapErrorResponse(new Error('钱包ID列表不能为空'));
        }

        try {
            console.log(`[WalletRepository] 批量删除钱包: ${walletIds.length} 个`);
            
            const result = await this.executeDirect(
                'db',
                'deleteWalletsByIds',
                [walletIds]
            );

            if (result.success) {
                console.log(`[WalletRepository] 批量删除成功: ${result.data?.deletedCount || walletIds.length} 个`);
                
                // 清除相关缓存
                walletIds.forEach(id => {
                    this.clearCache(`getWalletById.*${id}`);
                });
                this.clearCache('getAllWallets');
            }

            return result;

        } catch (error) {
            console.error('[WalletRepository] 批量删除钱包失败:', error);
            return this.wrapErrorResponse(error);
        }
    }

    /**
     * 处理钱包列表数据
     * @param {Array} wallets - 原始钱包列表
     * @returns {Array} 处理后的钱包列表
     */
    processWalletList(wallets) {
        console.log('[WalletRepository] processWalletList 接收到的数据:', wallets, '类型:', Array.isArray(wallets) ? 'Array' : typeof wallets);
        
        if (!Array.isArray(wallets)) {
            console.warn('[WalletRepository] 钱包数据不是数组格式:', wallets);
            return [];
        }

        return wallets
            .map(wallet => this.normalizeWalletData(wallet))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // 按创建时间降序
    }

    /**
     * 处理分组列表数据
     * @param {Array} groups - 原始分组列表
     * @returns {Array} 处理后的分组列表
     */
    processGroupList(groups) {
        console.log('[WalletRepository] processGroupList 接收到的数据:', groups, '类型:', Array.isArray(groups) ? 'Array' : typeof groups);
        
        if (!Array.isArray(groups)) {
            console.warn('[WalletRepository] 分组数据不是数组格式:', groups);
            return [];
        }

        return groups
            .map(group => this.normalizeGroupData(group))
            .sort((a, b) => a.name.localeCompare(b.name)); // 按名称排序
    }

    /**
     * 标准化钱包数据格式
     * @param {Object} wallet - 原始钱包数据
     * @returns {Object} 标准化后的钱包数据
     */
    normalizeWalletData(wallet) {
        return {
            id: wallet.id || null,
            address: wallet.address || '',
            name: wallet.name || null,
            notes: wallet.notes || null,
            groupId: wallet.groupId || null,
            groupName: wallet.groupName || null,
            // 保留加密字段（不在这里解密）
            encryptedPrivateKey: wallet.encryptedPrivateKey || null,
            encryptedMnemonic: wallet.encryptedMnemonic || null,
            derivationPath: wallet.derivationPath || null,
            // 时间字段
            createdAt: wallet.createdAt || null,
            updatedAt: wallet.updatedAt || null,
            // 添加额外的元数据
            _metadata: {
                lastAccessed: Date.now(),
                source: 'WalletRepository'
            }
        };
    }

    /**
     * 标准化分组数据格式
     * @param {Object} group - 原始分组数据
     * @returns {Object} 标准化后的分组数据
     */
    normalizeGroupData(group) {
        return {
            id: group.id || null,
            name: group.name || '未命名分组',
            createdAt: group.createdAt || null,
            updatedAt: group.updatedAt || null,
            // 添加额外的元数据
            _metadata: {
                lastAccessed: Date.now(),
                source: 'WalletRepository'
            }
        };
    }

    /**
     * 验证钱包数据完整性
     * @param {Object} wallet - 钱包数据
     * @returns {Object} 验证后的钱包数据
     */
    validateWalletData(wallet) {
        if (!this.enableWalletValidation) {
            return wallet;
        }

        // 处理null或undefined的钱包数据
        if (!wallet) {
            console.warn('[WalletRepository] 钱包数据为空，返回默认结构');
            return this.normalizeWalletData({});
        }

        const errors = [];
        
        if (!wallet.id) errors.push('缺少钱包ID');
        if (!wallet.address) errors.push('缺少钱包地址');

        if (errors.length > 0) {
            console.warn(`[WalletRepository] 钱包数据验证警告 (${wallet.id || 'unknown'}):`, errors);
        }

        return this.normalizeWalletData(wallet);
    }

    /**
     * 验证钱包输入数据
     * @param {Object} walletData - 钱包输入数据
     * @returns {Object} 验证后的数据
     */
    validateWalletInputData(walletData) {
        const validatedData = {
            address: walletData.address?.trim(),
            name: walletData.name?.trim() || null,
            notes: walletData.notes?.trim() || null,
            groupId: walletData.groupId || null,
            encryptedPrivateKey: walletData.encryptedPrivateKey || null,
            encryptedMnemonic: walletData.encryptedMnemonic || null,
            derivationPath: walletData.derivationPath || null
        };

        // 地址格式验证
        if (!validatedData.address || validatedData.address.length < 10) {
            throw new Error('钱包地址格式无效');
        }

        return validatedData;
    }

    /**
     * 验证钱包更新数据
     * @param {Object} updateData - 更新数据
     * @returns {Object} 验证后的数据
     */
    validateWalletUpdateData(updateData) {
        const validatedData = {};

        // 只验证提供的字段
        if (updateData.name !== undefined) {
            validatedData.name = updateData.name?.trim() || null;
        }
        
        if (updateData.notes !== undefined) {
            validatedData.notes = updateData.notes?.trim() || null;
        }
        
        if (updateData.groupId !== undefined) {
            validatedData.groupId = updateData.groupId || null;
        }

        return validatedData;
    }

    /**
     * 清除钱包相关缓存
     * @param {number} walletId - 特定钱包ID（可选）
     */
    clearWalletCache(walletId = null) {
        if (walletId) {
            this.clearCache(`getWalletById.*${walletId}`);
            console.log(`[WalletRepository] 已清除钱包 ${walletId} 的缓存`);
        } else {
            this.clearCache();
            console.log('[WalletRepository] 已清除所有钱包缓存');
        }
    }

    /**
     * 获取钱包仓库特定统计信息
     * @returns {Object} 扩展统计信息
     */
    getExtendedStats() {
        const baseStats = this.getStats();
        
        return {
            ...baseStats,
            walletSpecific: {
                walletCacheTTL: this.walletCacheTTL,
                groupCacheTTL: this.groupCacheTTL,
                validationEnabled: this.enableWalletValidation,
                // 可以添加更多钱包特定的统计信息
            }
        };
    }
} 