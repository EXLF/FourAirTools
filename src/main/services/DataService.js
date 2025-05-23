/**
 * @fileoverview 数据访问服务 - 统一管理应用的数据访问逻辑
 * @module services/DataService
 */

/**
 * 数据访问服务类
 * 提供统一的数据访问接口，封装数据库操作和加密/解密逻辑
 */
class DataService {
    /**
     * 创建数据访问服务实例
     * @param {Object} db - 数据库服务实例
     * @param {Object} cryptoService - 加密服务实例
     */
    constructor(db, cryptoService) {
        this.db = db;
        this.crypto = cryptoService;
    }

    // ==================== 钱包相关方法 ====================

    /**
     * 获取钱包列表
     * @param {Object} [filters] - 筛选条件
     * @param {number} [filters.groupId] - 分组ID
     * @param {string} [filters.search] - 搜索关键词
     * @param {number} [filters.limit] - 限制返回数量
     * @param {number} [filters.offset] - 偏移量
     * @returns {Promise<Array>} 钱包列表
     */
    async getWallets(filters = {}) {
        try {
            // 从数据库获取钱包数据
            let wallets = await this.db.getAllWallets(this.db.db);
            
            // 应用筛选条件
            if (filters.groupId !== undefined) {
                wallets = wallets.filter(w => w.groupId === filters.groupId);
            }
            
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                wallets = wallets.filter(w => 
                    w.address.toLowerCase().includes(searchLower) ||
                    (w.name && w.name.toLowerCase().includes(searchLower)) ||
                    (w.notes && w.notes.toLowerCase().includes(searchLower))
                );
            }
            
            // 分页
            if (filters.offset !== undefined) {
                wallets = wallets.slice(filters.offset);
            }
            
            if (filters.limit !== undefined) {
                wallets = wallets.slice(0, filters.limit);
            }
            
            return wallets;
        } catch (error) {
            console.error('[DataService] 获取钱包列表失败:', error);
            throw error;
        }
    }

    /**
     * 获取单个钱包详情（包括解密的敏感数据）
     * @param {number} walletId - 钱包ID
     * @param {boolean} [includeSensitive=false] - 是否包含敏感数据
     * @returns {Promise<Object|null>} 钱包详情
     */
    async getWalletById(walletId, includeSensitive = false) {
        try {
            const wallet = await this.db.getWalletById(this.db.db, walletId);
            
            if (!wallet) {
                return null;
            }
            
            if (includeSensitive && this.crypto.isUnlocked()) {
                // 解密敏感数据
                if (wallet.encryptedPrivateKey) {
                    wallet.privateKey = this.crypto.decryptWithSessionKey(wallet.encryptedPrivateKey);
                }
                if (wallet.encryptedMnemonic) {
                    wallet.mnemonic = this.crypto.decryptWithSessionKey(wallet.encryptedMnemonic);
                }
            }
            
            // 移除加密字段
            delete wallet.encryptedPrivateKey;
            delete wallet.encryptedMnemonic;
            
            return wallet;
        } catch (error) {
            console.error('[DataService] 获取钱包详情失败:', error);
            throw error;
        }
    }

    /**
     * 添加新钱包
     * @param {Object} walletData - 钱包数据
     * @param {string} walletData.address - 钱包地址
     * @param {string} [walletData.name] - 钱包名称
     * @param {string} [walletData.privateKey] - 私钥（将被加密）
     * @param {string} [walletData.mnemonic] - 助记词（将被加密）
     * @param {number} [walletData.groupId] - 分组ID
     * @param {string} [walletData.notes] - 备注
     * @returns {Promise<number>} 新钱包的ID
     */
    async addWallet(walletData) {
        try {
            if (!this.crypto.isUnlocked()) {
                throw new Error('应用已锁定，无法添加钱包');
            }
            
            // 准备要保存的数据
            const dataToSave = {
                address: walletData.address,
                name: walletData.name,
                groupId: walletData.groupId,
                notes: walletData.notes,
                derivationPath: walletData.derivationPath
            };
            
            // 加密敏感数据
            if (walletData.privateKey) {
                dataToSave.encryptedPrivateKey = this.crypto.encryptWithSessionKey(walletData.privateKey);
            }
            
            if (walletData.mnemonic) {
                dataToSave.encryptedMnemonic = this.crypto.encryptWithSessionKey(walletData.mnemonic);
            }
            
            // 保存到数据库
            const walletId = await this.db.addWallet(this.db.db, dataToSave);
            
            return walletId;
        } catch (error) {
            console.error('[DataService] 添加钱包失败:', error);
            throw error;
        }
    }

    /**
     * 更新钱包信息
     * @param {number} walletId - 钱包ID
     * @param {Object} updates - 要更新的数据
     * @returns {Promise<boolean>} 是否更新成功
     */
    async updateWallet(walletId, updates) {
        try {
            // 准备更新数据
            const updateData = {};
            
            // 非敏感字段直接复制
            const nonSensitiveFields = ['name', 'groupId', 'notes'];
            nonSensitiveFields.forEach(field => {
                if (updates.hasOwnProperty(field)) {
                    updateData[field] = updates[field];
                }
            });
            
            // 处理敏感字段
            if (updates.privateKey !== undefined) {
                if (!this.crypto.isUnlocked()) {
                    throw new Error('应用已锁定，无法更新敏感数据');
                }
                updateData.encryptedPrivateKey = updates.privateKey ? 
                    this.crypto.encryptWithSessionKey(updates.privateKey) : null;
            }
            
            if (updates.mnemonic !== undefined) {
                if (!this.crypto.isUnlocked()) {
                    throw new Error('应用已锁定，无法更新敏感数据');
                }
                updateData.encryptedMnemonic = updates.mnemonic ? 
                    this.crypto.encryptWithSessionKey(updates.mnemonic) : null;
            }
            
            // 更新数据库
            await this.db.updateWallet(this.db.db, walletId, updateData);
            
            return true;
        } catch (error) {
            console.error('[DataService] 更新钱包失败:', error);
            throw error;
        }
    }

    /**
     * 批量删除钱包
     * @param {Array<number>} walletIds - 要删除的钱包ID数组
     * @returns {Promise<number>} 删除的数量
     */
    async deleteWallets(walletIds) {
        try {
            if (!Array.isArray(walletIds) || walletIds.length === 0) {
                return 0;
            }
            
            const results = await Promise.all(
                walletIds.map(id => this.db.deleteWallet(this.db.db, id))
            );
            
            return results.filter(result => result).length;
        } catch (error) {
            console.error('[DataService] 删除钱包失败:', error);
            throw error;
        }
    }

    /**
     * 获取钱包分组列表
     * @returns {Promise<Array>} 分组列表
     */
    async getWalletGroups() {
        try {
            return await this.db.getAllWalletGroups(this.db.db);
        } catch (error) {
            console.error('[DataService] 获取钱包分组失败:', error);
            throw error;
        }
    }

    /**
     * 添加钱包分组
     * @param {string} groupName - 分组名称
     * @returns {Promise<number>} 新分组的ID
     */
    async addWalletGroup(groupName) {
        try {
            return await this.db.addWalletGroup(this.db.db, groupName);
        } catch (error) {
            console.error('[DataService] 添加钱包分组失败:', error);
            throw error;
        }
    }

    // ==================== 社交账户相关方法 ====================

    /**
     * 获取社交账户列表
     * @param {Object} [filters] - 筛选条件
     * @returns {Promise<Array>} 社交账户列表
     */
    async getSocialAccounts(filters = {}) {
        try {
            let accounts = await this.db.getAllSocialAccounts(this.db.db);
            
            // 应用筛选
            if (filters.platform) {
                accounts = accounts.filter(a => a.platform === filters.platform);
            }
            
            if (filters.groupId !== undefined) {
                accounts = accounts.filter(a => a.groupId === filters.groupId);
            }
            
            if (filters.search) {
                const searchLower = filters.search.toLowerCase();
                accounts = accounts.filter(a => 
                    a.identifier.toLowerCase().includes(searchLower) ||
                    (a.notes && a.notes.toLowerCase().includes(searchLower))
                );
            }
            
            return accounts;
        } catch (error) {
            console.error('[DataService] 获取社交账户失败:', error);
            throw error;
        }
    }

    /**
     * 添加社交账户
     * @param {Object} accountData - 账户数据
     * @returns {Promise<number>} 新账户的ID
     */
    async addSocialAccount(accountData) {
        try {
            if (!this.crypto.isUnlocked()) {
                throw new Error('应用已锁定，无法添加社交账户');
            }
            
            // 准备数据
            const dataToSave = {
                platform: accountData.platform,
                identifier: accountData.identifier,
                groupId: accountData.groupId,
                notes: accountData.notes
            };
            
            // 加密敏感字段
            const sensitiveFields = [
                'password', 'twitter_2fa', 'twitter_email',
                'discord_password', 'discord_token',
                'telegram_password', 'telegram_login_api',
                'email_recovery_email'
            ];
            
            sensitiveFields.forEach(field => {
                if (accountData[field]) {
                    dataToSave[field] = this.crypto.encryptWithSessionKey(accountData[field]);
                }
            });
            
            return await this.db.addSocialAccount(this.db.db, dataToSave);
        } catch (error) {
            console.error('[DataService] 添加社交账户失败:', error);
            throw error;
        }
    }

    // ==================== 通用方法 ====================

    /**
     * 加密敏感数据
     * @param {any} data - 要加密的数据
     * @returns {string} 加密后的字符串
     */
    encryptSensitiveData(data) {
        if (!this.crypto.isUnlocked()) {
            throw new Error('应用已锁定，无法加密数据');
        }
        
        // 如果是对象，先转换为JSON字符串
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        return this.crypto.encryptWithSessionKey(dataStr);
    }

    /**
     * 解密敏感数据
     * @param {string} encryptedData - 加密的数据
     * @param {boolean} [parseJson=false] - 是否解析为JSON
     * @returns {any} 解密后的数据
     */
    decryptSensitiveData(encryptedData, parseJson = false) {
        if (!this.crypto.isUnlocked()) {
            throw new Error('应用已锁定，无法解密数据');
        }
        
        const decrypted = this.crypto.decryptWithSessionKey(encryptedData);
        
        if (parseJson) {
            try {
                return JSON.parse(decrypted);
            } catch (e) {
                console.warn('[DataService] 解密数据不是有效的JSON:', e);
                return decrypted;
            }
        }
        
        return decrypted;
    }

    /**
     * 批量操作事务
     * @param {Function} operation - 要在事务中执行的操作
     * @returns {Promise<any>} 操作结果
     */
    async transaction(operation) {
        // TODO: 实现数据库事务支持
        return await operation();
    }
}

module.exports = DataService; 