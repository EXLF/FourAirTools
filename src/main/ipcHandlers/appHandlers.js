const { ipcMain, dialog, BrowserWindow, app } = require('electron');
const fs = require('fs'); // 使用标准fs模块
const fsPromises = require('fs').promises; // 单独引入promises API
const path = require('path');
const db = require('../db/index.js'); // Updated path
const { ethers } = require('ethers'); // 导入 ethers
const cryptoService = require('../core/cryptoService.js'); // Updated path
const os = require('os'); // 导入 os 模块

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

const BACKUP_DIR_NAME = 'backups'; // 确保在文件顶部或可访问的作用域定义

// 新的命名函数，包含原 data:backup 的逻辑
async function performDataBackup() {
    if (!cryptoService.isUnlocked()) {
        return {
            success: false,
            message: '应用已锁定，无法执行备份。请先解锁。'
        };
    }

    try {
        console.log('[BackupService] 开始备份数据...'); // 修改日志前缀以区分直接调用和IPC调用
        const userDataPath = app.getPath('userData');
        const backupDirPath = path.join(userDataPath, BACKUP_DIR_NAME);

        try {
            await fsPromises.mkdir(backupDirPath, { recursive: true });
        } catch (mkdirError) {
            console.error('[BackupService] 创建备份目录失败:', mkdirError);
            return {
                success: false,
                message: `创建备份目录失败: ${mkdirError.message}`
            };
        }

        const wallets = await db.getAllWallets(db.db);
        const decryptedWallets = [];
        for (const wallet of wallets) {
            let privateKey = null;
            let mnemonic = null;
            try {
                if (wallet.encryptedPrivateKey) {
                    privateKey = cryptoService.decryptWithSessionKey(wallet.encryptedPrivateKey);
                }
                if (wallet.encryptedMnemonic) {
                    mnemonic = cryptoService.decryptWithSessionKey(wallet.encryptedMnemonic);
                }
            } catch (e) {
                console.warn(`[BackupService] 解密钱包 ${wallet.address} 数据失败:`, e.message);
                privateKey = wallet.encryptedPrivateKey ? '[解密失败]' : null;
                mnemonic = wallet.encryptedMnemonic ? '[解密失败]' : null;
            }
            decryptedWallets.push({
                ...wallet,
                privateKey,
                mnemonic,
                encryptedPrivateKey: undefined, 
                encryptedMnemonic: undefined    
            });
        }

        const socialAccounts = await db.getAllSocialAccounts(db.db);
        const decryptedSocialAccounts = [];
        for (const account of socialAccounts) {
            let password = null;
            let twitter_2fa = null;
            let discord_password = null;
            let discord_token = null;
            let telegram_password = null;
            try {
                if (account.password) password = cryptoService.decryptWithSessionKey(account.password);
                if (account.twitter_2fa) twitter_2fa = cryptoService.decryptWithSessionKey(account.twitter_2fa);
                if (account.discord_password) discord_password = cryptoService.decryptWithSessionKey(account.discord_password);
                if (account.discord_token) discord_token = cryptoService.decryptWithSessionKey(account.discord_token);
                if (account.telegram_password) telegram_password = cryptoService.decryptWithSessionKey(account.telegram_password);
            } catch (e) {
                console.warn(`[BackupService] 解密社交账户 ${account.platform} - ${account.identifier} 数据失败:`, e.message);
                if (account.password) password = '[解密失败]';
                if (account.twitter_2fa) twitter_2fa = '[解密失败]';
                if (account.discord_password) discord_password = '[解密失败]';
                if (account.discord_token) discord_token = '[解密失败]';
                if (account.telegram_password) telegram_password = '[解密失败]';
            }
            const decryptedAccount = { ...account }; 
            decryptedAccount.password = password;
            decryptedAccount.twitter_2fa = twitter_2fa;
            decryptedAccount.discord_password = discord_password;
            decryptedAccount.discord_token = discord_token;
            decryptedAccount.telegram_password = telegram_password;
            decryptedSocialAccounts.push(decryptedAccount);
        }

        const backupData = {
            backupSchemaVersion: '1.0',
            timestamp: new Date().toISOString(),
            appVersion: app.getVersion(),
            wallets: decryptedWallets,
            socialAccounts: decryptedSocialAccounts,
        };

        const timestampSuffix = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFileName = `fouair_backup_${timestampSuffix}.json`;
        const backupFilePath = path.join(backupDirPath, backupFileName);

        await fsPromises.writeFile(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
        
        console.log(`[BackupService] 数据成功备份至: ${backupFilePath}`);
        return {
            success: true,
            message: `数据成功备份至 ${backupFileName}`,
            path: backupFilePath
        };

    } catch (error) {
        console.error('[BackupService] 备份数据失败:', error);
        return {
            success: false,
            message: `备份数据失败: ${error.message}`
        };
    }
}

// --- 添加设置处理函数 ---
const settings = {
    // 默认设置对象，与前端保持一致
    defaultSettings: {
        // 通用设置
        language: 'zh-CN',
        theme: 'auto',
        notifications: true,
        autoStart: true,
        startMinimized: true,
        
        // 安全与隐私
        autoLockTimeout: 60,
        collectUsageData: true,
        autoCheckUpdate: true,
        
        // 网络设置
        rpcUrl: '',
        defaultProxyGroup: 'none',
        connectionTimeout: 30,
        
        // 数据与备份
        dataLocation: '',
        autoBackup: 'daily',
        
        // 开发者选项
        devMode: false,
        logLevel: 'info'
    },
    
    // 当前设置
    currentSettings: null,
    
    // 初始化设置
    init: async function() {
        try {
            // 获取设置文件路径
            const settingsPath = path.join(app.getPath('userData'), 'settings.json');
            let appSettingsJson = { ...this.defaultSettings }; // 用于传递给 triggerAutoBackupIfNeeded

            if (fs.existsSync(settingsPath)) {
                // 读取设置文件
                const data = await fsPromises.readFile(settingsPath, 'utf-8');
                const loadedSettings = JSON.parse(data);
                // 合并默认设置和用户设置
                this.currentSettings = { ...this.defaultSettings, ...loadedSettings };
                appSettingsJson = loadedSettings; // 保存从文件加载的原始结构
                console.log('[Settings] 已加载用户设置');
            } else {
                // 使用默认设置
                this.currentSettings = { ...this.defaultSettings };
                // 保存默认设置到文件 - saveSettingsToFile 会使用 this.currentSettings
                await this.saveSettingsToFile();
                // 此时 appSettingsJson 应该与 this.currentSettings 一致
                appSettingsJson = { ...this.currentSettings }; 
                console.log('[Settings] 已初始化默认设置');
            }
            
            // 应用设置
            this.applySettings(this.currentSettings);

            // --- 新增：调用自动备份检查 --- 
            if (this.currentSettings) {
                // 确保在 cryptoService 初始化并可能已解锁后调用
                // 如果 cryptoService 的初始化依赖于某些设置，确保顺序正确
                // 简单的假设：此时 cryptoService 状态是确定的 (已解锁或未解锁)
                await triggerAutoBackupIfNeeded(this.currentSettings, appSettingsJson, settingsPath);
            }
            // --- 结束新增 ---
            
            return true;
        } catch (error) {
            console.error('[Settings] 初始化设置失败:', error);
            // 使用默认设置
            this.currentSettings = { ...this.defaultSettings };
            return false;
        }
    },
    
    // 保存设置到文件
    saveSettingsToFile: async function() {
        try {
            // 获取设置文件路径
            const settingsPath = path.join(app.getPath('userData'), 'settings.json');
            
            // 保存设置到文件
            await fsPromises.writeFile(settingsPath, JSON.stringify(this.currentSettings, null, 2), 'utf-8');
            
            console.log('[Settings] 设置已保存到文件');
            
            return true;
        } catch (error) {
            console.error('[Settings] 保存设置到文件失败:', error);
            
            return false;
        }
    },
    
    // 应用设置
    applySettings: function(settings) {
        try {
            // 应用设置
            
            // 1. 应用语言设置（移除不支持的API调用）
            // 注释掉不支持的API调用
            // app.setLocale(settings.language);
            console.log(`[Settings] 语言设置已保存: ${settings.language}，但应用程序不支持动态更改语言`);
            
            // 2. 应用自启动设置
            this.setAutoStart(settings.autoStart);
            
            // 3. 处理开机自启动时的最小化设置
            // 如果开启自启动，传递最小化参数，否则不传参
            if (settings.autoStart && settings.startMinimized) {
                this.setAutoStart(true); // 重新设置，确保带有正确的参数
            }
            
            console.log('[Settings] 已应用设置');
            
            return true;
        } catch (error) {
            console.error('[Settings] 应用设置失败:', error);
            
            return false;
        }
    },
    
    // 设置自启动
    setAutoStart: function(enable) {
        // 如果不是打包版本，直接返回
        if (!app.isPackaged) return;
        
        // 根据操作系统设置自启动
        if (process.platform === 'win32') {
            try {
                app.setLoginItemSettings({
                    openAtLogin: enable,
                    path: process.execPath,
                    args: enable ? ['--startup'] : []
                });
                console.log(`[Settings] 已${enable ? '启用' : '禁用'}开机自启动功能`);
                return true;
            } catch (error) {
                console.error('[Settings] 设置开机自启动失败:', error);
                return false;
            }
        } else if (process.platform === 'darwin') {
            // macOS的登录项设置
            try {
                app.setLoginItemSettings({
                    openAtLogin: enable,
                    openAsHidden: true // macOS特有，启动时隐藏窗口
                });
                console.log(`[Settings] macOS: 已${enable ? '启用' : '禁用'}开机自启动功能`);
                return true;
            } catch (error) {
                console.error('[Settings] macOS: 设置开机自启动失败:', error);
                return false;
            }
        } else {
            // Linux需要其他方式实现（通常是创建.desktop文件）
            console.log(`[Settings] ${process.platform}平台暂不支持自动设置开机自启动`);
            return false;
        }
    }
};

function setupSettingsIpcHandlers() {
    // 获取设置
    ipcMain.handle('settings:getSettings', async () => {
        try {
            // 如果未初始化，先初始化
            if (!settings.currentSettings) {
                await settings.init();
            }
            
            // 返回当前设置
            return settings.currentSettings;
        } catch (error) {
            console.error('[IPC] 获取设置失败:', error);
            
            throw new Error('获取设置失败: ' + error.message);
        }
    });
    
    // 保存设置
    ipcMain.handle('settings:saveSettings', async (event, newSettings) => {
        try {
            // 更新当前设置
            settings.currentSettings = { ...settings.currentSettings, ...newSettings };
            
            // 保存设置到文件
            await settings.saveSettingsToFile();
            
            // 应用设置
            settings.applySettings(settings.currentSettings);
            
            // 新增：如果"关闭时最小化到托盘"(startMinimized)设置已更改，则通知主进程重新应用窗口关闭行为
            if (newSettings.hasOwnProperty('startMinimized')) {
                // 使用新的IPC通道通知主进程更新窗口关闭行为
                const mainWindow = BrowserWindow.fromWebContents(event.sender);
                if (mainWindow) {
                    mainWindow.webContents.send('settings:trayOptionChanged', newSettings.startMinimized);
                }
            }
            
            return true;
        } catch (error) {
            console.error('[IPC] 保存设置失败:', error);
            
            throw new Error('保存设置失败: ' + error.message);
        }
    });
    
    // 重置设置
    ipcMain.handle('settings:resetSettings', async () => {
        try {
            // 重置设置
            settings.currentSettings = { ...settings.defaultSettings };
            
            // 保存设置到文件
            await settings.saveSettingsToFile();
            
            // 应用设置
            settings.applySettings(settings.currentSettings);
            
            return true;
        } catch (error) {
            console.error('[IPC] 重置设置失败:', error);
            
            throw new Error('重置设置失败: ' + error.message);
        }
    });
    
    // 应用设置
    ipcMain.handle('settings:applySettings', async (event, newSettings) => {
        try {
            // 应用设置
            settings.applySettings(newSettings);
            
            return true;
        } catch (error) {
            console.error('[IPC] 应用设置失败:', error);
            
            throw new Error('应用设置失败: ' + error.message);
        }
    });
    
    // 清除缓存
    ipcMain.handle('app:clearCache', async () => {
        try {
            // 获取主窗口
            const mainWindow = BrowserWindow.getFocusedWindow();
            
            if (mainWindow) {
                // 清除缓存
                await mainWindow.webContents.session.clearCache();
                await mainWindow.webContents.session.clearStorageData({
                    storages: ['appcache', 'cookies', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers']
                });
                
                console.log('[IPC] 已清除缓存');
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('[IPC] 清除缓存失败:', error);
            
            throw new Error('清除缓存失败: ' + error.message);
        }
    });
    
    // 检查更新
    ipcMain.handle('app:checkForUpdates', async () => {
        try {
            console.log('[IPC] 检查更新');
            
            // TODO: 实现更新检查逻辑
            
            return {
                hasUpdate: false,
                version: app.getVersion(),
                releaseNotes: ''
            };
        } catch (error) {
            console.error('[IPC] 检查更新失败:', error);
            
            throw new Error('检查更新失败: ' + error.message);
        }
    });
    
    // 下载更新
    ipcMain.handle('app:downloadUpdate', async () => {
        try {
            console.log('[IPC] 下载更新');
            
            // TODO: 实现更新下载逻辑
            
            return {
                success: false,
                message: '更新下载功能尚未实现'
            };
        } catch (error) {
            console.error('[IPC] 下载更新失败:', error);
            
            throw new Error('下载更新失败: ' + error.message);
        }
    });
    
    // 重启应用
    ipcMain.handle('app:restart', () => {
        console.log('[IPC] 重启应用');
        
        app.relaunch();
        app.exit(0);
        
        return true;
    });
    
    // 打开开发者工具
    ipcMain.handle('app:openDevTools', (event) => {
        console.log('[IPC] 打开开发者工具');
        
        const window = BrowserWindow.fromWebContents(event.sender);
        
        if (window) {
            window.webContents.openDevTools();
            return true;
        }
        
        return false;
    });
    
    // 生成调试报告
    ipcMain.handle('app:generateDebugReport', async () => {
        try {
            console.log('[IPC] 生成调试报告');
            
            // 收集系统信息
            const systemInfo = {
                platform: process.platform,
                arch: process.arch,
                nodeVersion: process.versions.node,
                electronVersion: process.versions.electron,
                chromeVersion: process.versions.chrome,
                v8Version: process.versions.v8,
                appVersion: app.getVersion(),
                osInfo: {
                    platform: os.platform(),
                    release: os.release(),
                    arch: os.arch(),
                    cpus: os.cpus().length,
                    totalMem: os.totalmem(),
                    freeMem: os.freemem()
                }
            };
            
            // 返回调试报告
            return {
                timestamp: new Date().toISOString(),
                systemInfo,
                // 可以添加更多信息，如日志、错误记录等
            };
        } catch (error) {
            console.error('[IPC] 生成调试报告失败:', error);
            
            throw new Error('生成调试报告失败: ' + error.message);
        }
    });
    
    // 数据操作 - IPC Handler 现在只调用 performDataBackup
    ipcMain.handle('data:backup', async () => {
        console.log('[IPC] Received data:backup request');
        return await performDataBackup();
    });
}

function setupApplicationIpcHandlers(mainWindow) {
    console.log('[IPC] Setting up Application IPC handlers...');

    // --- 批量生成钱包 Handler ---
    ipcMain.handle('app:generateWallets', async (event, { count, groupId }) => {
        const walletGenerator = require('../core/walletGenerator.js'); // Corrected path
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
                        encryptedMnemonic: encryptedMnemonic, // 正确的行，使用 encryptedMnemonic 字段
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
            await fsPromises.writeFile(filePath, content, 'utf8');
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

            // 写入文件 - 使用 fs.promises.writeFile
            await fsPromises.writeFile(saveResult.filePath, fileContent, { encoding: 'utf8' });
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

    // --- 新增：处理加载教程数据请求 ---
    ipcMain.handle('app:loadTutorials', async () => {
        console.log('[IPC] Received: app:loadTutorials');
        let filePath;
        // 区分开发环境和生产环境的路径
        if (app.isPackaged) {
            // 生产环境：假设 data 文件夹在 resources/app/ 目录下
            filePath = path.join(process.resourcesPath, 'app', 'src', 'data', 'tutorials.json');
        } else {
            // 开发环境：相对于项目根目录
            filePath = path.join(app.getAppPath(), 'src', 'data', 'tutorials.json');
        }

        console.log(`[IPC] Attempting to load tutorials from: ${filePath}`);

        try {
            // 使用异步读取文件
            const data = await fsPromises.readFile(filePath, 'utf-8');
            try {
                const jsonData = JSON.parse(data);
                console.log('[IPC] Tutorials loaded successfully.');
                return jsonData;
            } catch (parseError) {
                console.error('[IPC] Error parsing tutorials.json:', parseError);
                return null;
            }
        } catch (error) {
            console.error(`[IPC] Tutorials file not found or could not be read: ${error.message}`);
            return []; // 返回空数组，而不是null
        }
    });

    // 执行简单脚本的处理器
    ipcMain.handle('execute-simple-script', async (event) => {
        try {
            console.log('123'); // 简单打印123
            return { success: true, message: '脚本执行成功' };
        } catch (error) {
            console.error('执行脚本时出错:', error);
            return { success: false, message: error.message };
        }
    });

    // --- 添加其他应用级 Handlers (例如: 打开外部链接, 文件操作等) ---
    // ipcMain.on('open-external-link', (event, url) => { ... });

    // 检查应用程序锁定状态
    ipcMain.handle('app:check-locked-status', async () => {
        const cryptoService = require('../core/cryptoService');
        const isUnlocked = cryptoService.isUnlocked();
        console.log(`[IPC] Checking app lock status: ${isUnlocked ? '已解锁' : '已锁定'}`);
        return { unlocked: isUnlocked };
    });

    // 显示解锁界面
    ipcMain.on('app:show-unlock', () => {
        console.log('[IPC] 请求显示解锁界面');
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('auth:needs-unlock');
        }
    });

    // --- 设置相关处理函数 ---
    setupSettingsIpcHandlers();

    console.log('[IPC] Application IPC handlers ready.');
}

/**
 * 检查并根据需要触发自动备份 (简化版：每日备份)
 * @param {object} currentSettings - 当前应用设置
 * @param {object} appSettingsFromFile - 从 settings.json 读取的原始设置对象，用于更新
 * @param {string} settingsFilePath - settings.json 的完整路径
 */
async function triggerAutoBackupIfNeeded(currentSettings, appSettingsFromFile, settingsFilePath) {
    if (!currentSettings || currentSettings.autoBackup !== 'daily') {
        return;
    }
    if (!cryptoService.isUnlocked()) {
        console.log('[AutoBackup] 应用已锁定，跳过此次自动备份。');
        return;
    }
    console.log('[AutoBackup] 检查每日自动备份...');
    const lastBackupDate = appSettingsFromFile.lastDailyBackupDate;
    const todayDate = new Date().toISOString().split('T')[0];

    if (lastBackupDate === todayDate) {
        console.log(`[AutoBackup] 今日 (${todayDate}) 已备份，跳过。`);
        return;
    }
    console.log(`[AutoBackup] 执行每日自动备份 (上次备份: ${lastBackupDate || '无'}, 今日: ${todayDate})...`);
    try {
        // 直接调用 performDataBackup 函数
        const backupResult = await performDataBackup(); 
        if (backupResult.success) {
            console.log('[AutoBackup] 每日自动备份成功完成。');
            const updatedAppSettings = { ...appSettingsFromFile, lastDailyBackupDate: todayDate };
            await fsPromises.writeFile(settingsFilePath, JSON.stringify(updatedAppSettings, null, 2), 'utf-8');
            if (settings && settings.currentSettings) {
                 settings.currentSettings.lastDailyBackupDate = todayDate;
            }
        } else {
            console.error('[AutoBackup] 每日自动备份失败:', backupResult.message);
        }
    } catch (e) {
        console.error('[AutoBackup] 执行自动备份时出错:', e);
    }
}

module.exports = {
    setupApplicationIpcHandlers,
}; 