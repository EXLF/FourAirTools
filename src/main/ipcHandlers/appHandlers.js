const { ipcMain, dialog } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const db = require('../../js/db/index.js'); // Still need db for saving

// --- 移除旧的调试日志 ---

function setupApplicationIpcHandlers(mainWindow) {
    console.log('[IPC] Setting up Application IPC handlers...');

    // --- 批量生成钱包 Handler ---
    ipcMain.handle('app:generateWallets', async (event, { count, groupId }) => {
        // --- 将 require 移到 handler 内部 ---
        const walletGenerator = require('../../js/core/walletGenerator.js');
        // --- --------------------------- ---

        console.log(`[IPC] Received: app:generateWallets - Count: ${count}, GroupID: ${groupId}`);

        if (typeof count !== 'number' || count <= 0) {
            throw new Error('无效的生成数量');
        }

        let generatedCount = 0;
        let errors = [];
        const startIndex = 0; // Or potentially get last used index from DB in future

        try {
            // 调用模块生成所有钱包信息
            const generatedWalletInfos = walletGenerator.generateWallets(count, startIndex);

            for (let i = 0; i < generatedWalletInfos.length; i++) {
                const walletInfo = generatedWalletInfos[i];
                const index = startIndex + i;

                if (walletInfo) {
                    const generationTime = new Date().toLocaleString('zh-CN'); // 使用中文区域设置获取时间
                    const walletData = {
                        address: walletInfo.address,
                        name: `Account-${index}`,
                        notes: `生成于 ${generationTime}`, // 修改备注内容为中文
                        groupId: groupId || null,
                        encryptedPrivateKey: walletInfo.privateKey,
                        mnemonic: walletInfo.mnemonic,
                        derivationPath: walletInfo.path
                    };

                    try {
                        await db.addWallet(walletData); // 调用数据库添加函数
                        generatedCount++;
                    } catch (dbError) {
                        console.error(`保存生成的钱包 ${walletInfo.address} 到数据库失败:`, dbError);
                        errors.push(`无法保存钱包 ${walletInfo.address} (索引 ${index}): ${dbError.message}`);
                    }
                } else {
                    errors.push(`无法生成索引 ${index} 的钱包。`);
                }
            }

            console.log(`批量生成完成: ${generatedCount} 个成功, ${errors.length} 个失败。`);
            return { generatedCount, errors };

        } catch (error) {
             console.error('批量生成钱包过程中发生严重错误:', error);
             throw new Error(`批量生成失败: ${error.message}`);
        }
    });

    // --- 新增：处理文件保存请求 ---
    ipcMain.handle('app:saveFile', async (event, { defaultPath, content }) => {
        console.log(`[IPC] Received: app:saveFile - Default Path: ${defaultPath}`);
        if (!mainWindow) {
            console.error('Error: mainWindow not provided to appHandlers setup.');
            return { success: false, error: '主窗口不可用' };
        }
        try {
            const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
                title: '导出钱包数据',
                defaultPath: defaultPath, // 使用传入的建议路径
                filters: [
                    { name: 'JSON 文件', extensions: ['json'] },
                    { name: '所有文件', extensions: ['*'] }
                ]
            });

            if (canceled || !filePath) {
                console.log('[IPC] app:saveFile - Save dialog canceled by user.');
                return { success: false, canceled: true };
            }

            console.log(`[IPC] app:saveFile - Saving file to: ${filePath}`);
            await fs.writeFile(filePath, content, 'utf8');
            console.log('[IPC] app:saveFile - File saved successfully.');
            return { success: true, filePath: filePath };

        } catch (error) {
            console.error('[IPC] app:saveFile - Error saving file:', error);
            return { success: false, error: error.message || '保存文件时发生未知错误' };
        }
    });

    // --- 添加其他应用级 Handlers (例如: 打开外部链接, 文件操作等) ---
    // ipcMain.on('open-external-link', (event, url) => { ... });

    console.log('[IPC] Application IPC handlers ready.');
}

module.exports = {
    setupApplicationIpcHandlers,
}; 