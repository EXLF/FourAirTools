const { ipcMain } = require('electron');
const db = require('../db/index.js'); // Adjust path relative to this file
const cryptoService = require('../core/cryptoService.js'); // **新增：导入加密服务**

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
        // 确保将渲染进程传来的 (可能仍是) walletData.mnemonic (加密值)
        // 映射到 walletData.encryptedMnemonic 以匹配 wallet.js 中的期望
        const dataToSave = { ...walletData };
        if (dataToSave.hasOwnProperty('mnemonic') && !dataToSave.hasOwnProperty('encryptedMnemonic')) {
            dataToSave.encryptedMnemonic = dataToSave.mnemonic;
            delete dataToSave.mnemonic; 
        }
        // 私钥字段名 encryptedPrivateKey 通常在渲染端已经正确设置
        return await db.addWallet(db.db, dataToSave);
    });
    ipcMain.handle('db:getWallets', async (event, options) => {
        console.log('[IPC] Received: db:getWallets', options);
        const result = await db.getWallets(db.db, options);

        if (result && result.wallets && result.wallets.length > 0) {
            if (!cryptoService.isUnlocked()) {
                console.warn('[IPC] db:getWallets - App not unlocked. Sensitive wallet data will be nulled or marked.');
                result.wallets.forEach(wallet => {
                    wallet.encryptedPrivateKey = '[LOCKED]';
                    wallet.encryptedMnemonic = '[LOCKED]'; // 使用新的字段名
                    // 为了向后兼容或避免前端错误，如果前端仍在使用 mnemonic，则也设置它
                    wallet.mnemonic = '[LOCKED]'; 
                });
            } else {
                result.wallets.forEach(wallet => {
                    try {
                        if (wallet.encryptedPrivateKey) {
                            wallet.privateKey = cryptoService.decryptWithSessionKey(wallet.encryptedPrivateKey);
                        }
                        // delete wallet.encryptedPrivateKey; // 可选择删除加密值，或保留
                    } catch (e) {
                        console.error(`Failed to decrypt privateKey for wallet ${wallet.address}:`, e.message);
                        wallet.privateKey = '[DECRYPTION_ERROR]';
                    }
                    try {
                        if (wallet.encryptedMnemonic) {
                            wallet.mnemonic = cryptoService.decryptWithSessionKey(wallet.encryptedMnemonic);
                        }
                        // delete wallet.encryptedMnemonic; // 可选择删除加密值
                    } catch (e) {
                        console.error(`Failed to decrypt mnemonic for wallet ${wallet.address}:`, e.message);
                        wallet.mnemonic = '[DECRYPTION_ERROR]';
                    }
                });
            }
        }
        return result;
    });
     ipcMain.handle('db:getWalletById', async (event, id) => {
        console.log('[IPC] Received: db:getWalletById', id);
        const wallet = await db.getWalletById(db.db, id);
        if (wallet) {
            if (!cryptoService.isUnlocked()) {
                console.warn(`[IPC] db:getWalletById (ID: ${id}) - App not unlocked. Sensitive data will be nulled or marked.`);
                wallet.encryptedPrivateKey = '[LOCKED]';
                wallet.encryptedMnemonic = '[LOCKED]';
                wallet.mnemonic = '[LOCKED]'; // 兼容旧字段名
            } else {
                try {
                    if (wallet.encryptedPrivateKey) {
                        wallet.privateKey = cryptoService.decryptWithSessionKey(wallet.encryptedPrivateKey);
                    }
                } catch (e) {
                    console.error(`Failed to decrypt privateKey for wallet ID ${id}:`, e.message);
                    wallet.privateKey = '[DECRYPTION_ERROR]';
                }
                try {
                    if (wallet.encryptedMnemonic) {
                        wallet.mnemonic = cryptoService.decryptWithSessionKey(wallet.encryptedMnemonic);
                    }
                } catch (e) {
                    console.error(`Failed to decrypt mnemonic for wallet ID ${id}:`, e.message);
                    wallet.mnemonic = '[DECRYPTION_ERROR]';
                }
            }
        }
        return wallet;
    });
    ipcMain.handle('db:getWalletsByIds', async (event, ids) => {
        console.log('[IPC] Received: db:getWalletsByIds', ids);
        // 此函数通常用于列表或选择，可能不需要立即解密所有敏感数据
        // 暂时保持原样，返回加密数据。如果特定场景需要解密，可以再调整或新增一个IPC。
        return await db.getWalletsByIds(db.db, ids);
    });
    ipcMain.handle('db:updateWallet', async (event, id, walletData) => {
        console.log('[IPC] Received: db:updateWallet', id, walletData);
        // 确保将渲染进程传来的 (可能仍是) walletData.mnemonic (加密值)
        // 映射到 walletData.encryptedMnemonic 以匹配 wallet.js 中的期望
        const dataToUpdate = { ...walletData };
        if (dataToUpdate.hasOwnProperty('mnemonic') && !dataToUpdate.hasOwnProperty('encryptedMnemonic')) {
            dataToUpdate.encryptedMnemonic = dataToUpdate.mnemonic;
            delete dataToUpdate.mnemonic;
        }
         // 如果 walletData 中包含明文的 privateKey 或 mnemonic，需要在这里加密
        // 但根据之前的分析，渲染进程在调用此接口前，应已将它们加密并分别放入
        // walletData.encryptedPrivateKey 和 walletData.mnemonic (现在是 encryptedMnemonic)
        // 因此，这里假设它们已经是加密的。
        return await db.updateWallet(db.db, id, dataToUpdate);
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
            const walletDetails = await db.getWalletById(db.db, id); // getWalletById 内部已包含解密逻辑
             if (!walletDetails) {
                console.warn(`[IPC Handler] Wallet details not found for ID: ${id}`);
                 return null; 
             }
            // 在 getWalletById 中已处理了解密逻辑，这里直接返回
            // 如果需要确保返回解密后的 privateKey 和 mnemonic 字段，而删除加密字段，可以在 getWalletById 中调整
            console.log(`[IPC Handler] Returning wallet details for ID: ${id}`, walletDetails); 
            return walletDetails;
        } catch (error) {
            console.error(`[IPC Handler] Error fetching wallet details for ID ${id}:`, error);
            throw error; 
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
        // 加密逻辑已移至 db/proxy.js 中的 addProxy 函数
        return await db.addProxy(db.db, proxyData);
    });
    ipcMain.handle('db:getProxies', async (event, options) => {
        console.log('[IPC] Received: db:getProxies', options);
        try {
            const result = await db.getProxies(db.db, options);
            if (result && result.proxies && result.proxies.length > 0) {
                if (cryptoService.isUnlocked()) {
                    result.proxies.forEach(proxy => {
                        if (proxy.password) {
                            try {
                                proxy.decryptedPassword = cryptoService.decryptWithSessionKey(proxy.password);
                                // 可选: delete proxy.password; 
                            } catch (e) {
                                console.error(`Failed to decrypt password for proxy host ${proxy.host}:`, e.message);
                                proxy.decryptedPassword = '[DECRYPTION_ERROR]';
                            }
                        }
                    });
                } else {
                    result.proxies.forEach(proxy => {
                        if (proxy.password) { // 即使锁定了，也指明有密码但无法查看
                            proxy.decryptedPassword = '[LOCKED]';
                        }
                    });
                }
            }
            return result;
        } catch (error) {
            console.error('Error in db:getProxies handler:', error);
            throw error;
        }
    });
    ipcMain.handle('db:getProxyById', async (event, id) => {
        console.log('[IPC] Received: db:getProxyById', id);
        try {
            const proxy = await db.getProxyById(db.db, id);
            if (proxy && proxy.password) {
                if (cryptoService.isUnlocked()) {
                    try {
                        proxy.decryptedPassword = cryptoService.decryptWithSessionKey(proxy.password);
                        // 可选: delete proxy.password; // 从返回给渲染器的数据中移除加密的密码
                    } catch (e) {
                        console.error(`Failed to decrypt password for proxy ID ${id}:`, e.message);
                        proxy.decryptedPassword = '[DECRYPTION_ERROR]';
                    }
                } else {
                    proxy.decryptedPassword = '[LOCKED]';
                }
            }
            return proxy;
        } catch (error) {
            console.error(`Error in db:getProxyById handler for ID ${id}:`, error);
            throw error;
        }
    });
    ipcMain.handle('db:updateProxy', async (event, id, proxyData) => {
        console.log('[IPC] Received: db:updateProxy', id, proxyData);
        // 加密逻辑已移至 db/proxy.js 中的 updateProxy 函数
        return await db.updateProxy(db.db, id, proxyData);
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