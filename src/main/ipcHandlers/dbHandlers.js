const { ipcMain } = require('electron');
const db = require('../../js/db/index.js'); // Adjust path relative to this file
const cryptoService = require('../../js/core/cryptoService.js'); // **新增：导入加密服务**

/**
 * 辅助函数：加密社交账户数据中的敏感字段
 * @param {object} data - 账户数据对象
 * @returns {object} - 包含加密后字段的数据对象
 */
function encryptSocialData(data) {
    const encryptedData = { ...data }; // 创建副本以避免修改原始对象
    const fieldsToEncrypt = [
        'password', 'twitter_2fa', 'discord_password', 'discord_token',
        'telegram_password', 'telegram_login_api'
    ];

    if (!cryptoService.isUnlocked()) {
        // 如果应用未解锁，不能加密，抛出错误或返回未加密数据？
        // 最好是抛出错误，强制要求在解锁状态下操作
        throw new Error('应用未解锁，无法加密敏感数据。');
    }

    for (const field of fieldsToEncrypt) {
        if (encryptedData[field]) { // 只加密非空字段
            try {
                encryptedData[field] = cryptoService.encryptWithSessionKey(encryptedData[field]);
            } catch (err) {
                console.error(`Error encrypting ${field}:`, err);
            }
        }
    }
    return encryptedData;
}

function setupDatabaseIpcHandlers() {
    console.log('[IPC] Setting up Database IPC handlers...');

    // --- Groups --- 
    ipcMain.handle('db:addGroup', async (event, name) => {
        console.log('[IPC] Received: db:addGroup', name);
        return await db.addGroup(db.db, name);
    });
    ipcMain.handle('db:getGroups', async () => {
        console.log('[IPC] Received: db:getGroups');
        return await db.getGroups(db.db);
    });
    ipcMain.handle('db:updateGroup', async (event, id, newName) => {
        console.log('[IPC] Received: db:updateGroup', id, newName);
        return await db.updateGroup(db.db, id, newName);
    });
    ipcMain.handle('db:deleteGroup', async (event, id) => {
        console.log('[IPC] Received: db:deleteGroup', id);
        return await db.deleteGroup(db.db, id);
    });

    // --- Wallets --- 
    ipcMain.handle('db:addWallet', async (event, walletData) => {
        console.log('[IPC] Received: db:addWallet', walletData);
        return await db.addWallet(db.db, walletData);
    });
    ipcMain.handle('db:getWallets', async (event, options) => {
        console.log('[IPC] Received: db:getWallets', options);
        return await db.getWallets(db.db, options);
    });
     ipcMain.handle('db:getWalletById', async (event, id) => {
        console.log('[IPC] Received: db:getWalletById', id);
        return await db.getWalletById(db.db, id);
    });
    ipcMain.handle('db:getWalletsByIds', async (event, ids) => {
        console.log('[IPC] Received: db:getWalletsByIds', ids);
        return await db.getWalletsByIds(db.db, ids);
    });
    ipcMain.handle('db:updateWallet', async (event, id, walletData) => {
        console.log('[IPC] Received: db:updateWallet', id, walletData);
        return await db.updateWallet(db.db, id, walletData);
    });
    ipcMain.handle('db:deleteWallet', async (event, id) => {
        console.log('[IPC] Received: db:deleteWallet', id);
        return await db.deleteWallet(db.db, id);
    });

    // --- 新增：批量删除钱包 ---
    ipcMain.handle('db:deleteWalletsByIds', async (event, ids) => {
        const startTime = Date.now(); // <-- 记录开始时间
        console.log(`[${startTime}] [IPC Main] Received: db:deleteWalletsByIds`, ids); // <-- 日志
        if (!Array.isArray(ids) || ids.length === 0) {
            console.warn(`[${Date.now()}] [IPC Main] db:deleteWalletsByIds - Invalid input`); // <-- 日志
            return { deletedCount: 0, errors: ['Invalid input: IDs array is required.'] };
        }
        try {
            console.log(`[${Date.now()}] [IPC Main] db:deleteWalletsByIds - Calling db module...`); // <-- 日志
            const deletedCount = await db.deleteWalletsByIds(db.db, ids);
            console.log(`[${Date.now()}] [IPC Main] db:deleteWalletsByIds - db module returned: ${deletedCount}`); // <-- 日志
            console.log(`[${Date.now()}] [IPC Main] db:deleteWalletsByIds - Successfully deleted ${deletedCount} wallets. Total time: ${Date.now() - startTime}ms`); // <-- 日志 + 耗时
            return { deletedCount: deletedCount, errors: [] };
        } catch (error) {
            console.error(`[${Date.now()}] [IPC Main] db:deleteWalletsByIds - Error: ${error.message}. Total time: ${Date.now() - startTime}ms`, error); // <-- 日志 + 耗时
            return { deletedCount: 0, errors: [error.message || 'An unknown error occurred during bulk deletion.'] };
        }
    });
    // --- ------------------ ---

    // --- Social Accounts ---
    ipcMain.handle('db:addSocialAccount', async (event, accountData) => {
        console.log('[IPC] Received: db:addSocialAccount', accountData);
        try {
            const updatedData = {...accountData};
            if ('username' in updatedData) {
                updatedData.identifier = updatedData.username;
                delete updatedData.username;
            }
            if ('groupId' in updatedData) {
                updatedData.group_id = updatedData.groupId;
                delete updatedData.groupId;
            }
            const encryptedData = encryptSocialData(updatedData);
            return await db.addSocialAccount(db.db, encryptedData);
        } catch (error) {
            console.error("Error in db:addSocialAccount handler:", error);
            throw error;
        }
    });
    ipcMain.handle('db:getSocialAccounts', async (event, options) => {
        console.log('[IPC] Received: db:getSocialAccounts', options);
        try {
            const updatedOptions = { ...options };
            if (updatedOptions.groupId !== undefined) {
                updatedOptions.group_id = updatedOptions.groupId;
                delete updatedOptions.groupId;
            }

            // Fetch accounts from DB
            const result = await db.getSocialAccounts(db.db, updatedOptions);

            // **解密敏感字段**
            if (result && result.accounts && result.accounts.length > 0) {
                if (!cryptoService.isUnlocked()) {
                     console.warn('[IPC] db:getSocialAccounts - App not unlocked, returning encrypted data with error flag.');
                    result.accounts.forEach(account => {
                        account.decryptionError = '应用未解锁';
                    });
                 } else {
                    const sensitiveFields = [
                        'password', 'twitter_2fa', 'discord_password', 'discord_token',
                        'telegram_password', 'telegram_login_api'
                    ];
                    console.log(`[IPC] Decrypting sensitive fields for ${result.accounts.length} accounts...`); // 添加日志
                    result.accounts.forEach(account => {
                        for (const field of sensitiveFields) {
                            if (account[field]) {
                                const encryptedValue = account[field]; // Store for logging
                                try {
                                    account[field] = cryptoService.decryptWithSessionKey(encryptedValue);
                                    // console.log(`[IPC] Decrypted ${field} for account ${account.id}`); // 详细日志（可选）
                                } catch (decryptError) {
                                    console.error(`[IPC] Failed to decrypt field ${field} for account ${account.id}. Value: ${encryptedValue}`, decryptError);
                                    account[field] = '[解密失败]'; // Mark decryption failure
                                    account.decryptionError = '部分字段解密失败';
                                }
                            }
                        }
                    });
                    console.log('[IPC] Finished decrypting fields.'); // 添加日志
                 }
            }

            return result; // Return the result possibly containing decrypted data
        } catch (error) {
            console.error('Error occurred in handler for \'db:getSocialAccounts\':', error);
            throw error;
        }
    });
    ipcMain.handle('db:getSocialAccountById', async (event, id) => {
        console.log('[IPC] Received: db:getSocialAccountById', id);
        try {
            return await db.getSocialAccountById(db.db, id);
        } catch (error) {
            console.error(`Error in db:getSocialAccountById handler for ID ${id}:`, error);
            throw error;
        }
    });
    ipcMain.handle('db:updateSocialAccount', async (event, id, accountData) => {
        console.log('[IPC] Received: db:updateSocialAccount', id, accountData);
        try {
            const updatedData = {...accountData};
            if ('username' in updatedData) {
                updatedData.identifier = updatedData.username;
                delete updatedData.username;
            }
            if ('groupId' in updatedData) {
                updatedData.group_id = updatedData.groupId;
                delete updatedData.groupId;
            }
            const encryptedData = encryptSocialData(updatedData);
            return await db.updateSocialAccount(db.db, id, encryptedData);
        } catch (error) {
            console.error(`Error in db:updateSocialAccount handler for ID ${id}:`, error);
            throw error;
        }
    });
    ipcMain.handle('db:deleteSocialAccount', async (event, id) => {
        console.log('[IPC] Received: db:deleteSocialAccount', id);
        return await db.deleteSocialAccount(db.db, id);
    });
    ipcMain.handle('db:deleteSocialAccountsByIds', async (event, ids) => {
        console.log('[IPC] Received: db:deleteSocialAccountsByIds', ids);
        if (!Array.isArray(ids) || ids.length === 0) {
            console.warn('[IPC Main] db:deleteSocialAccountsByIds - Invalid input');
            return { deletedCount: 0, errors: ['Invalid input: IDs array is required.'] };
        }
        try {
            const deletedCount = await db.deleteSocialAccountsByIds(db.db, ids);
            return { deletedCount: deletedCount, errors: [] };
        } catch (error) {
            console.error(`[IPC Main] db:deleteSocialAccountsByIds - Error: ${error.message}`, error);
            return { deletedCount: 0, errors: [error.message || 'An unknown error occurred during bulk deletion.'] };
        }
    });
    // --- ----------------- ---

    // *** 新增：添加获取钱包详情的 Handler ***
    //    假设我们需要一个能获取所有字段（包括加密字段）的函数，
    //    如果 db.getWalletById 满足要求就用它，否则需要 db 模块提供新函数。
    //    暂时假设 db.getWalletById 能获取所有字段。
    ipcMain.handle('db:getWalletDetails', async (event, id) => {
        console.log(`[IPC Handler] Received db:getWalletDetails for ID: ${id}`);
        try {
            // 注意：这里调用 getWalletById，确保它返回包括 privateKeyEncrypted 和 mnemonicEncrypted 的完整数据
            const walletDetails = await db.getWalletById(db.db, id);
             if (!walletDetails) {
                console.warn(`[IPC Handler] Wallet details not found for ID: ${id}`);
                // 可以返回 null 或抛出错误，取决于前端如何处理
                 return null; // 或者 throw new Error(`Wallet not found: ${id}`);
             }
            // 确保返回的字段名与前端期望的一致
            // 例如，如果数据库字段是 private_key_encrypted，但前端期望 privateKeyEncrypted，则需要转换
             console.log(`[IPC Handler] Returning wallet details for ID: ${id}`, walletDetails); // Log returned data
            return walletDetails;
        } catch (error) {
            console.error(`[IPC Handler] Error fetching wallet details for ID ${id}:`, error);
            throw error; // 将错误传递给调用者 (invoke)
        }
    });

    // --- *** 新增：钱包-社交账户关联 Links *** ---

    /**
     * 获取指定钱包关联的所有社交账户信息
     */
    ipcMain.handle('db:getLinkedSocialsForWallet', async (event, walletId) => {
        if (!walletId) {
            throw new Error('查询关联社交账户需要提供 walletId。');
        }
        return db.getLinkedSocialsForWallet(db.db, walletId);
    });

    /**
     * 更新指定钱包的社交账户关联
     * @param {number} walletId - 钱包 ID
     * @param {Array<number>} socialIds - 要关联的社交账户 ID 数组
     */
    ipcMain.handle('db:linkSocialsToWallet', async (event, walletId, socialIds) => {
        if (!walletId) {
            throw new Error('关联社交账户需要提供 walletId。');
        }
        // socialIds 可以是空数组，表示清除所有关联
        if (!Array.isArray(socialIds)) {
            throw new Error('socialIds 必须是一个数组。');
        }
        return db.linkSocialsToWallet(db.db, walletId, socialIds);
    });

    /**
     * 获取所有社交账户列表，并标记哪些已与指定钱包关联
     */
    ipcMain.handle('db:getAllSocialsWithLinkStatus', async (event, walletId) => {
        if (!walletId) {
            throw new Error('查询社交账户关联状态需要提供 walletId。');
        }
        return db.getAllSocialsWithLinkStatus(db.db, walletId);
    });

    // --- 新增：处理更新钱包社交链接的请求 --- 
    ipcMain.handle('db:updateWalletSocialLinks', async (event, walletId, linkedSocialIds) => {
        console.log(`[IPC Handler] Received db:updateWalletSocialLinks for Wallet ${walletId} with IDs:`, linkedSocialIds);
        if (typeof walletId !== 'number' || walletId <= 0) {
             throw new Error('无效的 walletId。');
        }
        if (!Array.isArray(linkedSocialIds)) {
            throw new Error('linkedSocialIds 必须是一个数组。');
        }
        // 对 ID 进行基本验证，确保它们是正整数
        const validIds = linkedSocialIds.filter(id => typeof id === 'number' && id > 0);
        if (validIds.length !== linkedSocialIds.length) {
            console.warn('[IPC Handler] updateWalletSocialLinks: 移除了无效的 social ID。');
        }

        try {
            // 假设 db.linkSocialsToWallet 处理事务：先删除旧的，再插入新的
            const result = await db.linkSocialsToWallet(db.db, walletId, validIds);
            console.log(`[IPC Handler] Successfully updated social links for Wallet ${walletId}. Result:`, result);
            return result; // 或者返回一个成功状态
        } catch (error) {
            console.error(`[IPC Handler] Error updating social links for Wallet ${walletId}:`, error);
            throw error; // 将错误传递给调用者
        }
    });
    // --- ------------------------------------ --- 

    // --- Proxies --- 
    ipcMain.handle('db:addProxy', async (event, proxyData) => {
        console.log('[IPC] Received: db:addProxy', proxyData);
        // 密码应该已经在渲染进程处理或不包含在此处，
        // 但 db.addProxy 会处理加密（如果提供了 password 且加密服务解锁）
        return await db.addProxy(db.db, proxyData);
    });
    ipcMain.handle('db:getProxies', async (event, options) => {
        console.log('[IPC] Received: db:getProxies', options);
        return await db.getProxies(db.db, options);
    });
    ipcMain.handle('db:getProxyById', async (event, id) => {
        console.log('[IPC] Received: db:getProxyById', id);
        // 这个函数会尝试解密密码
        return await db.getProxyById(db.db, id);
    });
    ipcMain.handle('db:updateProxy', async (event, id, updates) => {
        console.log('[IPC] Received: db:updateProxy', id, updates);
        // db.updateProxy 会处理密码加密（如果提供了 password）
        return await db.updateProxy(db.db, id, updates);
    });
    ipcMain.handle('db:deleteProxy', async (event, id) => {
        console.log('[IPC] Received: db:deleteProxy', id);
        return await db.deleteProxy(db.db, id);
    });
    ipcMain.handle('db:deleteProxiesByIds', async (event, ids) => {
        console.log('[IPC] Received: db:deleteProxiesByIds', ids);
        if (!Array.isArray(ids) || ids.length === 0) {
            console.warn('[IPC Main] db:deleteProxiesByIds - Invalid input');
            return { deletedCount: 0, errors: ['Invalid input: IDs array is required.'] };
        }
        try {
            const deletedCount = await db.deleteProxiesByIds(db.db, ids);
            return { deletedCount: deletedCount, errors: [] };
        } catch (error) {
            console.error(`[IPC Main] db:deleteProxiesByIds - Error: ${error.message}`, error);
            return { deletedCount: 0, errors: [error.message || 'An unknown error occurred during bulk deletion.'] };
        }
    });
    // --- --------- ---

    console.log('[IPC] Database IPC handlers ready.');
}

module.exports = {
    setupDatabaseIpcHandlers,
}; 