const { ipcMain, dialog, BrowserWindow } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const db = require('../../js/db/index.js'); // Still need db for saving
const { ethers } = require('ethers'); // 导入 ethers
const cryptoService = require('../../js/core/cryptoService.js'); // 导入加密服务

// *** TODO: Make this configurable in settings ***
const DEFAULT_RPC_URL = 'https://eth-mainnet.g.alchemy.com/v2/eOvLOWiFwLA0k3YIYnfJzmKrfUUO_dgo'; // Replace with a real key or use a public one carefully
// const DEFAULT_RPC_URL = 'https://rpc.ankr.com/eth'; // Example public RPC

let jsonRpcProvider = null; // Cache the provider
function getProvider() {
    // Basic caching to avoid reconnecting constantly
    // TODO: Add logic to handle changes in configured RPC URL
    if (!jsonRpcProvider) {
        try {
            // Replace with actual configured URL later
            const rpcUrl = DEFAULT_RPC_URL; 
            if (!rpcUrl || !rpcUrl.startsWith('http')) {
                console.warn('[Wallet Balance] Invalid or missing RPC URL.');
                return null;
            }
            jsonRpcProvider = new ethers.JsonRpcProvider(rpcUrl);
            console.log(`[Wallet Balance] Connected to RPC: ${rpcUrl}`);
        } catch (error) {
            console.error('[Wallet Balance] Failed to create JsonRpcProvider:', error);
            return null;
        }
    }
    return jsonRpcProvider;
}

function setupApplicationIpcHandlers(mainWindow) {
    console.log('[IPC] Setting up Application IPC handlers...');

    // --- 批量生成钱包 Handler ---
    ipcMain.handle('app:generateWallets', async (event, { count, groupId }) => {
        const walletGenerator = require('../../js/core/walletGenerator.js');
        console.log(`[IPC] Received: app:generateWallets - Count: ${count}, GroupID: ${groupId}`);
        if (typeof count !== 'number' || count <= 0) {
            throw new Error('无效的生成数量');
        }
        let generatedCount = 0;
        let errors = [];
        const startIndex = 0;
        try {
            const generatedWalletInfos = walletGenerator.generateWallets(count, startIndex);
            for (let i = 0; i < generatedWalletInfos.length; i++) {
                const walletInfo = generatedWalletInfos[i];
                const index = startIndex + i;
                if (walletInfo) {
                    const generationTime = new Date().toLocaleString('zh-CN');
                    let encryptedPrivateKey = null;
                    let encryptedMnemonic = null;
                    try {
                        // --- 加密私钥和助记词 --- 
                        if (walletInfo.privateKey) {
                            encryptedPrivateKey = cryptoService.encryptWithSessionKey(walletInfo.privateKey);
                        }
                        if (walletInfo.mnemonic) {
                            encryptedMnemonic = cryptoService.encryptWithSessionKey(walletInfo.mnemonic);
                        }
                         // -----------------------
                    } catch (encError) {
                         console.error(`加密钱包 ${index} (${walletInfo.address}) 的密钥/助记词失败:`, encError);
                         errors.push(`加密钱包 ${walletInfo.address} (索引 ${index}) 失败: ${encError.message}`);
                         continue; // 跳过这个钱包的保存
                    }

                    const walletData = {
                        address: walletInfo.address,
                        name: `Account-${index}`,
                        notes: `生成于 ${generationTime}`,
                        groupId: groupId || null,
                        encryptedPrivateKey: encryptedPrivateKey, // 保存加密后的私钥
                        mnemonic: encryptedMnemonic, // 保存加密后的助记词
                        derivationPath: walletInfo.path
                    };
                    try {
                        await db.addWallet(db.db, walletData);
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

    // --- 处理地址派生请求 ---
    ipcMain.handle('app:deriveAddressFromSeed', async (event, { seedType, seed }) => {
        console.log(`[IPC] Received: app:deriveAddressFromSeed - Type: ${seedType}`);
        if (!seed || typeof seed !== 'string' || seed.trim() === '') {
            return { address: null, error: '请输入有效的私钥或助记词' };
        }

        try {
            let wallet;
            const trimmedSeed = seed.trim();

            if (seedType === 'privateKey') {
                 // 简单的私钥格式验证 (0x + 64 hex chars)
                 if (!/^0x[a-fA-F0-9]{64}$/.test(trimmedSeed)) {
                     return { address: null, error: '私钥格式无效，应为 0x 开头的 64 位十六进制字符' };
                 }
                wallet = new ethers.Wallet(trimmedSeed);
            } else if (seedType === 'mnemonic') {
                 // 简单的助记词格式验证 (至少 12 个单词, 用空格分隔)
                 const words = trimmedSeed.split(/\s+/);
                 if (words.length < 12 || words.length > 24) {
                     return { address: null, error: '助记词格式无效，应为 12 到 24 个单词，用空格分隔' };
                 }
                wallet = ethers.Wallet.fromPhrase(trimmedSeed);
            } else {
                 return { address: null, error: '无效的种子类型' };
            }

            const address = await wallet.getAddress();
            console.log(`[IPC] Address derived: ${address}`);
            return { address: address, error: null };
        } catch (error) {
            console.error(`[IPC] Error deriving address from ${seedType}:`, error);
            let friendlyError = '派生地址时发生错误';
            if (error.message.includes('invalid hexlify value') || error.message.includes('invalid private key')) {
                friendlyError = '私钥无效或格式错误';
            } else if (error.message.includes('invalid mnemonic')) {
                 friendlyError = '助记词无效或校验和错误';
            }
            return { address: null, error: friendlyError };
        }
    });

    // --- 处理加密数据请求 ---
    ipcMain.handle('app:encryptData', async (event, plainText) => {
        console.log('[IPC] Received: app:encryptData');
        if (typeof plainText !== 'string') {
            throw new Error('无效的加密输入数据类型');
        }
        if (plainText === '') {
             return ''; // Allow encrypting empty string if needed, returns empty
        }
        try {
            // 使用 cryptoService 中已经设置好的会话密钥进行加密
            const encryptedText = cryptoService.encryptWithSessionKey(plainText);
            return encryptedText;
        } catch (error) {
             console.error('[IPC] Error encrypting data:', error);
             // 向渲染进程抛出更具体的错误
             throw new Error(`加密失败: ${error.message}`);
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

    // --- 处理导出钱包请求 (第一步：检查解锁并请求确认) ---
    ipcMain.handle('app:exportWallets', async (event, walletIds) => {
        console.log(`[IPC] Received export request (step 1) for IDs:`, walletIds);
        if (!Array.isArray(walletIds) || walletIds.length === 0) {
            throw new Error('没有选择要导出的钱包。');
        }
        // 只检查是否解锁
        if (!cryptoService.isUnlocked()) {
            throw new Error('应用已锁定，无法导出钱包数据。请先解锁。');
        }
        // 返回需要前端确认的信号
        console.log('[IPC] App is unlocked. Requesting frontend confirmation for export.');
        return { needsConfirmation: true }; 
    });

    // --- 新增：处理执行明文导出的请求 (第二步：在用户确认后调用) ---
    ipcMain.handle('app:performPlaintextExport', async (event, walletIds) => {
         console.log(`[IPC] Received perform plaintext export request (step 2) for IDs:`, walletIds);
         if (!Array.isArray(walletIds) || walletIds.length === 0) {
            throw new Error('内部错误：缺少要导出的钱包 ID。'); // 这不应该发生
        }
        // 再次检查解锁状态 (以防万一)
        if (!cryptoService.isUnlocked()) {
            throw new Error('应用已锁定，无法执行导出。');
        }

        const focusedWindow = BrowserWindow.getFocusedWindow() || mainWindow;

        try {
            // 获取包含加密数据的钱包信息
            const walletsToExport = await db.getWalletsByIds(db.db, walletIds);
            if (!walletsToExport || walletsToExport.length === 0) {
                throw new Error('找不到选定的钱包数据。');
            }

            // 解密数据并构建最终导出对象
            const decryptedWallets = [];
            for (const wallet of walletsToExport) {
                let decryptedPrivateKey = null;
                let decryptedMnemonic = null;
                try {
                    if (wallet.encryptedPrivateKey) {
                        decryptedPrivateKey = cryptoService.decryptWithSessionKey(wallet.encryptedPrivateKey);
                    }
                    if (wallet.mnemonic) {
                        decryptedMnemonic = cryptoService.decryptWithSessionKey(wallet.mnemonic);
                    }
                } catch (decryptError) {
                    console.error(`[IPC] Failed to decrypt data for wallet ${wallet.address} (ID: ${wallet.id}):`, decryptError);
                    throw new Error(`解密钱包 ${wallet.address} 数据失败: ${decryptError.message}。导出已中止。`);
                }
                decryptedWallets.push({
                    address: wallet.address,
                    name: wallet.name,
                    notes: wallet.notes,
                    groupId: wallet.groupId,
                    groupName: wallet.groupName,
                    privateKey: decryptedPrivateKey, // 明文
                    mnemonic: decryptedMnemonic,   // 明文
                    derivationPath: wallet.derivationPath
                });
            }

            const fileContent = JSON.stringify(decryptedWallets, null, 2);

            // 弹出保存文件对话框
            const defaultFileName = `wallets_export_plaintext_${Date.now()}.json`;
            const saveResult = await dialog.showSaveDialog(focusedWindow, {
                title: '导出明文钱包数据',
                defaultPath: defaultFileName,
                filters: [{ name: 'JSON 文件', extensions: ['json'] }]
            });

            if (saveResult.canceled || !saveResult.filePath) {
                console.log('[IPC] Save dialog canceled by user.');
                return { success: false, canceled: true };
            }

            // 写入文件
            await fs.writeFile(saveResult.filePath, fileContent, 'utf8');
            console.log(`[IPC] Plaintext wallets exported successfully to: ${saveResult.filePath}`);
            return { success: true, filePath: saveResult.filePath };

        } catch (error) {
            console.error('[IPC] Error performing plaintext export:', error);
            throw new Error(`执行导出时出错: ${error.message}`);
        }
    });

    // --- 新增：获取钱包余额 Handler ---
    ipcMain.handle('wallet:getBalance', async (event, address) => {
        // console.log(`[IPC] Received: wallet:getBalance for ${address}`);
        if (!ethers.isAddress(address)) {
            // console.warn(`[Wallet Balance] Invalid address format: ${address}`);
            return { balance: null, error: '无效的钱包地址格式' };
        }

        const provider = getProvider();
        if (!provider) {
            return { balance: null, error: '无法连接到 RPC 服务，请检查配置' };
        }

        try {
            const balanceBigInt = await provider.getBalance(address);
            const balanceEther = ethers.formatEther(balanceBigInt);
            // console.log(`[Wallet Balance] Balance for ${address}: ${balanceEther} ETH`);
            // 返回格式化后的余额和原始 BigInt 值 (可选)
            return { 
                balanceFormatted: parseFloat(balanceEther).toFixed(6), // 保留6位小数 
                // balanceRaw: balanceBigInt.toString(), // 原始 wei 值
                error: null 
            };
        } catch (error) {
            console.error(`[Wallet Balance] Error fetching balance for ${address}:`, error);
            let errorMsg = '获取余额失败';
            if (error.message?.includes('NETWORK_ERROR')) {
                errorMsg = '网络错误，无法连接 RPC';
            } else if (error.message?.includes('SERVER_ERROR')) {
                 errorMsg = 'RPC 服务端错误';
            }
            // TODO: Handle rate limits specifically if possible
            return { balance: null, error: errorMsg };
        }
    });

    // --- 添加其他应用级 Handlers (例如: 打开外部链接, 文件操作等) ---
    // ipcMain.on('open-external-link', (event, url) => { ... });

    console.log('[IPC] Application IPC handlers ready.');
}

module.exports = {
    setupApplicationIpcHandlers,
}; 