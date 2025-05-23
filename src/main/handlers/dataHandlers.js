/**
 * @fileoverview 数据IPC处理器 - 使用DataService处理数据相关请求
 * @module handlers/dataHandlers
 */

const { ipcMain } = require('electron');
const DataService = require('../services/DataService');
const { AppError, ErrorCodes } = require('../../shared/errors/AppError');

/**
 * 设置数据相关的IPC处理器
 * @param {Object} dependencies - 依赖项
 * @param {Object} dependencies.db - 数据库实例
 * @param {Object} dependencies.cryptoService - 加密服务
 */
function setupDataHandlers({ db, cryptoService }) {
    // 创建数据服务实例
    const dataService = new DataService(db, cryptoService);
    
    // ==================== 钱包相关处理器 ====================
    
    /**
     * 获取钱包列表
     */
    ipcMain.handle('wallets:getAll', async (event, filters) => {
        try {
            console.log('[DataHandler] 获取钱包列表', filters);
            
            const wallets = await dataService.getWallets(filters);
            
            return {
                success: true,
                data: wallets
            };
        } catch (error) {
            console.error('[DataHandler] 获取钱包列表失败:', error);
            throw AppError.database('获取钱包列表', error);
        }
    });
    
    /**
     * 获取单个钱包详情
     */
    ipcMain.handle('wallets:getById', async (event, { walletId, includeSensitive }) => {
        try {
            console.log('[DataHandler] 获取钱包详情', walletId);
            
            const wallet = await dataService.getWalletById(walletId, includeSensitive);
            
            if (!wallet) {
                throw AppError.notFound('钱包', walletId);
            }
            
            return {
                success: true,
                data: wallet
            };
        } catch (error) {
            console.error('[DataHandler] 获取钱包详情失败:', error);
            if (error instanceof AppError) throw error;
            throw AppError.database('获取钱包详情', error);
        }
    });
    
    /**
     * 添加钱包
     */
    ipcMain.handle('wallets:add', async (event, walletData) => {
        try {
            console.log('[DataHandler] 添加钱包');
            
            const walletId = await dataService.addWallet(walletData);
            
            return {
                success: true,
                data: { id: walletId }
            };
        } catch (error) {
            console.error('[DataHandler] 添加钱包失败:', error);
            
            // 检查是否是重复地址
            if (error.message && error.message.includes('UNIQUE constraint')) {
                throw new AppError(
                    '钱包地址已存在',
                    ErrorCodes.DUPLICATE_ENTRY,
                    { address: walletData.address }
                );
            }
            
            throw AppError.database('添加钱包', error);
        }
    });
    
    /**
     * 更新钱包
     */
    ipcMain.handle('wallets:update', async (event, { walletId, updates }) => {
        try {
            console.log('[DataHandler] 更新钱包', walletId);
            
            await dataService.updateWallet(walletId, updates);
            
            return {
                success: true,
                message: '钱包更新成功'
            };
        } catch (error) {
            console.error('[DataHandler] 更新钱包失败:', error);
            throw AppError.database('更新钱包', error);
        }
    });
    
    /**
     * 删除钱包
     */
    ipcMain.handle('wallets:delete', async (event, walletIds) => {
        try {
            console.log('[DataHandler] 删除钱包', walletIds);
            
            const count = await dataService.deleteWallets(walletIds);
            
            return {
                success: true,
                data: { deletedCount: count }
            };
        } catch (error) {
            console.error('[DataHandler] 删除钱包失败:', error);
            throw AppError.database('删除钱包', error);
        }
    });
    
    /**
     * 获取钱包分组
     */
    ipcMain.handle('wallets:getGroups', async () => {
        try {
            console.log('[DataHandler] 获取钱包分组');
            
            const groups = await dataService.getWalletGroups();
            
            return {
                success: true,
                data: groups
            };
        } catch (error) {
            console.error('[DataHandler] 获取钱包分组失败:', error);
            throw AppError.database('获取钱包分组', error);
        }
    });
    
    /**
     * 添加钱包分组
     */
    ipcMain.handle('wallets:addGroup', async (event, groupName) => {
        try {
            console.log('[DataHandler] 添加钱包分组', groupName);
            
            const groupId = await dataService.addWalletGroup(groupName);
            
            return {
                success: true,
                data: { id: groupId }
            };
        } catch (error) {
            console.error('[DataHandler] 添加钱包分组失败:', error);
            
            if (error.message && error.message.includes('UNIQUE constraint')) {
                throw new AppError(
                    '分组名称已存在',
                    ErrorCodes.DUPLICATE_ENTRY,
                    { groupName }
                );
            }
            
            throw AppError.database('添加钱包分组', error);
        }
    });
    
    // ==================== 社交账户相关处理器 ====================
    
    /**
     * 获取社交账户列表
     */
    ipcMain.handle('social:getAll', async (event, filters) => {
        try {
            console.log('[DataHandler] 获取社交账户列表', filters);
            
            const accounts = await dataService.getSocialAccounts(filters);
            
            return {
                success: true,
                data: accounts
            };
        } catch (error) {
            console.error('[DataHandler] 获取社交账户列表失败:', error);
            throw AppError.database('获取社交账户列表', error);
        }
    });
    
    /**
     * 添加社交账户
     */
    ipcMain.handle('social:add', async (event, accountData) => {
        try {
            console.log('[DataHandler] 添加社交账户');
            
            const accountId = await dataService.addSocialAccount(accountData);
            
            return {
                success: true,
                data: { id: accountId }
            };
        } catch (error) {
            console.error('[DataHandler] 添加社交账户失败:', error);
            
            if (error.message && error.message.includes('UNIQUE constraint')) {
                throw new AppError(
                    '账户已存在',
                    ErrorCodes.DUPLICATE_ENTRY,
                    { 
                        platform: accountData.platform,
                        identifier: accountData.identifier
                    }
                );
            }
            
            throw AppError.database('添加社交账户', error);
        }
    });
    
    // ==================== 通用数据处理器 ====================
    
    /**
     * 加密数据
     */
    ipcMain.handle('data:encrypt', async (event, data) => {
        try {
            const encrypted = dataService.encryptSensitiveData(data);
            
            return {
                success: true,
                data: encrypted
            };
        } catch (error) {
            console.error('[DataHandler] 加密数据失败:', error);
            
            if (error.message && error.message.includes('应用已锁定')) {
                throw AppError.authentication('应用已锁定，请先解锁');
            }
            
            throw new AppError(
                '加密数据失败',
                ErrorCodes.SYSTEM_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 解密数据
     */
    ipcMain.handle('data:decrypt', async (event, { encryptedData, parseJson }) => {
        try {
            const decrypted = dataService.decryptSensitiveData(encryptedData, parseJson);
            
            return {
                success: true,
                data: decrypted
            };
        } catch (error) {
            console.error('[DataHandler] 解密数据失败:', error);
            
            if (error.message && error.message.includes('应用已锁定')) {
                throw AppError.authentication('应用已锁定，请先解锁');
            }
            
            throw new AppError(
                '解密数据失败',
                ErrorCodes.SYSTEM_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 批量导入钱包
     */
    ipcMain.handle('wallets:batchImport', async (event, walletsData) => {
        try {
            console.log('[DataHandler] 批量导入钱包', walletsData.length);
            
            const results = {
                success: [],
                failed: []
            };
            
            // 使用事务处理批量导入
            for (const walletData of walletsData) {
                try {
                    const walletId = await dataService.addWallet(walletData);
                    results.success.push({
                        address: walletData.address,
                        id: walletId
                    });
                } catch (error) {
                    results.failed.push({
                        address: walletData.address,
                        error: error.message
                    });
                }
            }
            
            return {
                success: true,
                data: results
            };
        } catch (error) {
            console.error('[DataHandler] 批量导入钱包失败:', error);
            throw AppError.database('批量导入钱包', error);
        }
    });
    
    console.log('[DataHandler] 数据处理器已设置');
}

module.exports = setupDataHandlers; 