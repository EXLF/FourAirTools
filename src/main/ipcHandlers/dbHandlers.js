const { ipcMain } = require('electron');
const db = require('../../js/db/index.js'); // Adjust path relative to this file

function setupDatabaseIpcHandlers() {
    console.log('[IPC] Setting up Database IPC handlers...');

    // --- Groups --- 
    ipcMain.handle('db:addGroup', async (event, name) => {
        console.log('[IPC] Received: db:addGroup', name);
        return await db.addGroup(name);
    });
    ipcMain.handle('db:getGroups', async () => {
        console.log('[IPC] Received: db:getGroups');
        return await db.getGroups();
    });
    ipcMain.handle('db:updateGroup', async (event, id, newName) => {
        console.log('[IPC] Received: db:updateGroup', id, newName);
        return await db.updateGroup(id, newName);
    });
    ipcMain.handle('db:deleteGroup', async (event, id) => {
        console.log('[IPC] Received: db:deleteGroup', id);
        return await db.deleteGroup(id);
    });

    // --- Wallets --- 
    ipcMain.handle('db:addWallet', async (event, walletData) => {
        console.log('[IPC] Received: db:addWallet', walletData);
        // Add validation or pre-processing if needed before calling db
        return await db.addWallet(walletData);
    });
    ipcMain.handle('db:getWallets', async (event, options) => {
        console.log('[IPC] Received: db:getWallets', options);
        return await db.getWallets(options);
    });
     ipcMain.handle('db:getWalletById', async (event, id) => {
        console.log('[IPC] Received: db:getWalletById', id);
        return await db.getWalletById(id);
    });
    ipcMain.handle('db:getWalletsByIds', async (event, ids) => {
        console.log('[IPC] Received: db:getWalletsByIds', ids);
        return await db.getWalletsByIds(ids);
    });
    ipcMain.handle('db:updateWallet', async (event, id, walletData) => {
        console.log('[IPC] Received: db:updateWallet', id, walletData);
        return await db.updateWallet(id, walletData);
    });
    ipcMain.handle('db:deleteWallet', async (event, id) => {
        console.log('[IPC] Received: db:deleteWallet', id);
        return await db.deleteWallet(id);
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
            // 调用数据库模块中的批量删除函数 (假设存在)
            const deletedCount = await db.deleteWalletsByIds(ids);
            console.log(`[${Date.now()}] [IPC Main] db:deleteWalletsByIds - db module returned: ${deletedCount}`); // <-- 日志
            console.log(`[${Date.now()}] [IPC Main] db:deleteWalletsByIds - Successfully deleted ${deletedCount} wallets. Total time: ${Date.now() - startTime}ms`); // <-- 日志 + 耗时
            return { deletedCount: deletedCount, errors: [] };
        } catch (error) {
            console.error(`[${Date.now()}] [IPC Main] db:deleteWalletsByIds - Error: ${error.message}. Total time: ${Date.now() - startTime}ms`, error); // <-- 日志 + 耗时
            // 返回包含错误信息的对象，以便前端可以显示
            return { deletedCount: 0, errors: [error.message || 'An unknown error occurred during bulk deletion.'] };
        }
    });
    // --- ------------------ ---

    console.log('[IPC] Database IPC handlers ready.');
}

module.exports = {
    setupDatabaseIpcHandlers,
}; 