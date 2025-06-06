const { ipcMain, dialog, BrowserWindow, app } = require('electron');
const fs = require('fs'); // 使用标准fs模块
const fsPromises = require('fs').promises; // 单独引入promises API
const path = require('path');
const db = require('../db/index.js'); // Updated path
const { ethers } = require('ethers'); // 导入 ethers
const cryptoService = require('../core/cryptoService.js'); // Updated path
const os = require('os'); // 导入 os 模块

// RPC URL配置 - 从设置中读取
const DEFAULT_RPC_URL = 'https://eth-mainnet.g.alchemy.com/v2/eOvLOWiFwLA0k3YIYnfJzmKrfUUO_dgo'; // 默认RPC URL

/**
 * 比较两个版本号
 * @param {string} v1 - 版本号1
 * @param {string} v2 - 版本号2
 * @returns {number} 如果v1 > v2返回1，v1 < v2返回-1，相等返回0
 */
function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        
        if (part1 > part2) return 1;
        if (part1 < part2) return -1;
    }
    
    return 0;
}

let jsonRpcProvider = null; // Cache the provider
let currentRpcUrl = null; // 记录当前使用的RPC URL

function getProvider() {
    try {
        // 从设置中获取RPC URL，如果没有设置则使用默认值
        const rpcUrl = (settings.currentSettings && settings.currentSettings.rpcUrl) || DEFAULT_RPC_URL;
        
        // 如果RPC URL发生变化，需要创建新的provider
        if (currentRpcUrl !== rpcUrl || !jsonRpcProvider) {
            if (!rpcUrl || !rpcUrl.startsWith('http')) {
                console.warn('[Wallet Balance] Invalid or missing RPC URL.');
                return null;
            }
            
            jsonRpcProvider = new ethers.JsonRpcProvider(rpcUrl);
            currentRpcUrl = rpcUrl;
            console.log(`[Wallet Balance] Connected to RPC: ${rpcUrl}`);
        }
        
        return jsonRpcProvider;
    } catch (error) {
        console.error('[Wallet Balance] Failed to create JsonRpcProvider:', error);
        return null;
    }
}

// 清除provider缓存（当RPC设置改变时调用）
function clearProviderCache() {
    jsonRpcProvider = null;
    currentRpcUrl = null;
    console.log('[Wallet Balance] Provider cache cleared');
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
            // 记录旧的RPC URL
            const oldRpcUrl = settings.currentSettings?.rpcUrl;
            
            // 更新当前设置
            settings.currentSettings = { ...settings.currentSettings, ...newSettings };
            
            // 保存设置到文件
            await settings.saveSettingsToFile();
            
            // 应用设置
            settings.applySettings(settings.currentSettings);
            
            // 如果RPC URL发生变化，清除provider缓存
            if (newSettings.hasOwnProperty('rpcUrl') && oldRpcUrl !== newSettings.rpcUrl) {
                clearProviderCache();
                console.log('[Settings] RPC URL已更改，provider缓存已清除');
            }
            
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
            // 记录旧的RPC URL
            const oldRpcUrl = settings.currentSettings?.rpcUrl;
            
            // 重置设置
            settings.currentSettings = { ...settings.defaultSettings };
            
            // 保存设置到文件
            await settings.saveSettingsToFile();
            
            // 应用设置
            settings.applySettings(settings.currentSettings);
            
            // 如果RPC URL发生变化，清除provider缓存
            if (oldRpcUrl !== settings.currentSettings.rpcUrl) {
                clearProviderCache();
                console.log('[Settings] RPC URL已重置，provider缓存已清除');
            }
            
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
            
            // 获取当前版本
            const currentVersion = app.getVersion();
            console.log(`[Update] 当前版本: ${currentVersion}`);
            
            // 从GitHub Release API获取最新版本信息
            const { net } = require('electron');
            const request = net.request({
                method: 'GET',
                protocol: 'https:',
                hostname: 'api.github.com',
                path: '/repos/EXLF/uploadPackage/releases/latest',
                headers: {
                    'User-Agent': 'FourAir-Toolbox-Updater',
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            return new Promise((resolve, reject) => {
                let responseData = '';
                
                request.on('response', (response) => {
                    if (response.statusCode !== 200) {
                        console.error(`[Update] GitHub API响应错误: ${response.statusCode}`);
                        resolve({
                            hasUpdate: false,
                            version: currentVersion,
                            error: `检查更新失败: HTTP ${response.statusCode}`
                        });
                        return;
                    }
                    
                    response.on('data', (chunk) => {
                        responseData += chunk;
                    });
                    
                    response.on('end', () => {
                        try {
                            const releaseInfo = JSON.parse(responseData);
                            const latestVersion = releaseInfo.tag_name.replace(/^v/, ''); // 移除v前缀
                            
                            // 比较版本号
                            const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;
                            
                            console.log(`[Update] 最新版本: ${latestVersion}, 需要更新: ${hasUpdate}`);
                            
                            // 获取下载链接
                            let downloadUrl = null;
                            if (releaseInfo.assets && releaseInfo.assets.length > 0) {
                                // 根据平台选择合适的安装包
                                const platform = process.platform;
                                const arch = process.arch;
                                
                                for (const asset of releaseInfo.assets) {
                                    const name = asset.name.toLowerCase();
                                    if (platform === 'win32' && name.includes('.exe')) {
                                        downloadUrl = asset.browser_download_url;
                                        break;
                                    } else if (platform === 'darwin' && name.includes('.dmg')) {
                                        downloadUrl = asset.browser_download_url;
                                        break;
                                    } else if (platform === 'linux' && (name.includes('.appimage') || name.includes('.deb'))) {
                                        downloadUrl = asset.browser_download_url;
                                        break;
                                    }
                                }
                            }
                            
                            resolve({
                                hasUpdate,
                                currentVersion,
                                latestVersion,
                                releaseNotes: releaseInfo.body || '暂无更新说明',
                                downloadUrl,
                                publishedAt: releaseInfo.published_at
                            });
                        } catch (parseError) {
                            console.error('[Update] 解析版本信息失败:', parseError);
                            resolve({
                                hasUpdate: false,
                                version: currentVersion,
                                error: '解析版本信息失败'
                            });
                        }
                    });
                });
                
                request.on('error', (error) => {
                    console.error('[Update] 网络请求失败:', error);
                    resolve({
                        hasUpdate: false,
                        version: currentVersion,
                        error: '网络连接失败'
                    });
                });
                
                request.end();
            });
        } catch (error) {
            console.error('[IPC] 检查更新失败:', error);
            return {
                hasUpdate: false,
                version: app.getVersion(),
                error: error.message
            };
        }
    });
    
    // 下载更新
    ipcMain.handle('app:downloadUpdate', async (event, downloadUrl) => {
        try {
            console.log('[IPC] 下载更新');
            
            if (!downloadUrl) {
                return {
                    success: false,
                    message: '下载链接不可用'
                };
            }
            
            const { net, shell } = require('electron');
            const url = require('url');
            const urlParts = url.parse(downloadUrl);
            
            // 获取文件名
            const fileName = path.basename(urlParts.pathname);
            const downloadsPath = app.getPath('downloads');
            const filePath = path.join(downloadsPath, fileName);
            
            console.log(`[Update] 开始下载: ${downloadUrl}`);
            console.log(`[Update] 保存路径: ${filePath}`);
            
            // 创建下载请求
            const request = net.request({
                method: 'GET',
                url: downloadUrl,
                redirect: 'follow'
            });
            
            return new Promise((resolve, reject) => {
                const writeStream = fs.createWriteStream(filePath);
                let receivedBytes = 0;
                let totalBytes = 0;
                
                request.on('response', (response) => {
                    if (response.statusCode !== 200) {
                        console.error(`[Update] 下载失败: HTTP ${response.statusCode}`);
                        writeStream.close();
                        fs.unlinkSync(filePath);
                        resolve({
                            success: false,
                            message: `下载失败: HTTP ${response.statusCode}`
                        });
                        return;
                    }
                    
                    // 获取文件总大小
                    totalBytes = parseInt(response.headers['content-length'], 10) || 0;
                    console.log(`[Update] 文件大小: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
                    
                    response.on('data', (chunk) => {
                        writeStream.write(chunk);
                        receivedBytes += chunk.length;
                        
                        // 计算下载进度
                        if (totalBytes > 0) {
                            const progress = Math.round((receivedBytes / totalBytes) * 100);
                            // 发送下载进度到渲染进程
                            event.sender.send('update-download-progress', { 
                                progress, 
                                receivedBytes, 
                                totalBytes 
                            });
                        }
                    });
                    
                    response.on('end', () => {
                        writeStream.end();
                        console.log(`[Update] 下载完成: ${filePath}`);
                        
                        // 下载完成后，打开文件所在目录并选中文件
                        shell.showItemInFolder(filePath);
                        
                        resolve({
                            success: true,
                            message: '更新包下载成功',
                            filePath
                        });
                    });
                });
                
                request.on('error', (error) => {
                    console.error('[Update] 下载错误:', error);
                    writeStream.close();
                    
                    // 删除未完成的文件
                    try {
                        fs.unlinkSync(filePath);
                    } catch (e) {
                        // 忽略删除错误
                    }
                    
                    resolve({
                        success: false,
                        message: `下载失败: ${error.message}`
                    });
                });
                
                writeStream.on('error', (error) => {
                    console.error('[Update] 写入文件错误:', error);
                    request.abort();
                    
                    resolve({
                        success: false,
                        message: `保存文件失败: ${error.message}`
                    });
                });
                
                request.end();
            });
        } catch (error) {
            console.error('[IPC] 下载更新失败:', error);
            return {
                success: false,
                message: `下载更新失败: ${error.message}`
            };
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

    // --- 修改：处理加载教程数据请求 ---
    ipcMain.handle('app:loadTutorials', async () => {
        console.log('[IPC] Received: app:loadTutorials. This handler is deprecated for tutorial data fetching. Tutorials should be fetched via API by the renderer.');
        // 不再尝试从本地文件加载，因为渲染器会通过 API 获取
        // 返回空数组以兼容旧的调用，但理想情况下渲染器不应再依赖此IPC获取教程主体内容
        return [];
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

    // --- 新增：从私钥派生地址 ---
    ipcMain.handle('crypto:deriveAddressFromPrivateKey', async (event, privateKey) => {
        console.log('[IPC] Received: crypto:deriveAddressFromPrivateKey');
        try {
            if (!privateKey || typeof privateKey !== 'string') {
                throw new Error('无效的私钥格式');
            }

            // 确保私钥以0x开头
            const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
            
            // 验证私钥格式
            if (!/^0x[a-fA-F0-9]{64}$/.test(normalizedPrivateKey)) {
                throw new Error('私钥格式无效，应为64位十六进制字符串');
            }

            // 使用ethers.js创建钱包实例并获取地址
            const wallet = new ethers.Wallet(normalizedPrivateKey);
            const address = wallet.address.toLowerCase(); // 统一转换为小写
            
            console.log(`[IPC] Derived address: ${address} from private key`);
            return address;
        } catch (error) {
            console.error('[IPC] Error deriving address from private key:', error);
            throw new Error(`从私钥派生地址失败: ${error.message}`);
        }
    });

    // --- 新增：从助记词派生地址 ---
    ipcMain.handle('crypto:deriveAddressFromMnemonic', async (event, mnemonic, derivationPath = "m/44'/60'/0'/0/0") => {
        console.log('[IPC] Received: crypto:deriveAddressFromMnemonic');
        try {
            if (!mnemonic || typeof mnemonic !== 'string') {
                throw new Error('无效的助记词格式');
            }

            // 验证助记词格式
            const words = mnemonic.trim().split(/\s+/);
            if (words.length !== 12 && words.length !== 24) {
                throw new Error('助记词应包含12或24个单词');
            }

            // 使用ethers.js从助记词创建钱包
            const wallet = ethers.Wallet.fromPhrase(mnemonic, null, derivationPath);
            const address = wallet.address.toLowerCase(); // 统一转换为小写
            
            console.log(`[IPC] Derived address: ${address} from mnemonic with path: ${derivationPath}`);
            return address;
        } catch (error) {
            console.error('[IPC] Error deriving address from mnemonic:', error);
            throw new Error(`从助记词派生地址失败: ${error.message}`);
        }
    });

    // --- 新增：验证以太坊地址格式 ---
    ipcMain.handle('crypto:validateAddress', async (event, address) => {
        console.log('[IPC] Received: crypto:validateAddress');
        try {
            if (!address || typeof address !== 'string') {
                return { isValid: false, error: '地址不能为空' };
            }

            const isValid = ethers.isAddress(address);
            return { isValid, error: isValid ? null : '无效的以太坊地址格式' };
        } catch (error) {
            console.error('[IPC] Error validating address:', error);
            return { isValid: false, error: `验证地址失败: ${error.message}` };
        }
    });

    // --- 新增：验证私钥格式 ---
    ipcMain.handle('crypto:validatePrivateKey', async (event, privateKey) => {
        console.log('[IPC] Received: crypto:validatePrivateKey');
        try {
            if (!privateKey || typeof privateKey !== 'string') {
                return { isValid: false, error: '私钥不能为空' };
            }

            const normalizedPrivateKey = privateKey.startsWith('0x') ? privateKey : '0x' + privateKey;
            const isValid = /^0x[a-fA-F0-9]{64}$/.test(normalizedPrivateKey);
            
            if (isValid) {
                // 进一步验证私钥是否能创建有效的钱包
                try {
                    new ethers.Wallet(normalizedPrivateKey);
                    return { isValid: true, error: null };
                } catch (walletError) {
                    return { isValid: false, error: '私钥无效，无法创建钱包' };
                }
            } else {
                return { isValid: false, error: '私钥格式无效，应为64位十六进制字符串' };
            }
        } catch (error) {
            console.error('[IPC] Error validating private key:', error);
            return { isValid: false, error: `验证私钥失败: ${error.message}` };
        }
    });

    // --- 新增：验证助记词格式 ---
    ipcMain.handle('crypto:validateMnemonic', async (event, mnemonic) => {
        console.log('[IPC] Received: crypto:validateMnemonic');
        try {
            if (!mnemonic || typeof mnemonic !== 'string') {
                return { isValid: false, error: '助记词不能为空' };
            }

            const words = mnemonic.trim().split(/\s+/);
            if (words.length !== 12 && words.length !== 24) {
                return { isValid: false, error: '助记词应包含12或24个单词' };
            }

            // 尝试从助记词创建钱包来验证
            try {
                ethers.Wallet.fromPhrase(mnemonic);
                return { isValid: true, error: null };
            } catch (mnemonicError) {
                return { isValid: false, error: '助记词无效或不在词典中' };
            }
        } catch (error) {
            console.error('[IPC] Error validating mnemonic:', error);
            return { isValid: false, error: `验证助记词失败: ${error.message}` };
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

    // 添加加载本地教程数据的处理程序
    ipcMain.handle('load-local-tutorials', async () => {
        // 直接返回空数组，不加载本地数据
        console.log('[Tutorials] 根据用户要求，不加载本地教程数据');
        return [];
    });

    // 重置应用数据
    ipcMain.handle('app:resetApplication', async () => {
        try {
            console.log('[IPC] 重置应用数据');
            
            // 获取应用数据目录
            const userDataPath = app.getPath('userData');
            console.log('[Reset] 用户数据路径:', userDataPath);
            
            // 关闭数据库连接
            if (db && db.db) {
                try {
                    await db.closeDatabase(db.db);
                    console.log('[Reset] 数据库连接已关闭');
                } catch (error) {
                    console.error('[Reset] 关闭数据库失败:', error);
                }
            }
            
            // 清除加密服务的会话密钥
            if (cryptoService) {
                cryptoService.clearSessionKey();
                console.log('[Reset] 会话密钥已清除');
            }
            
            // 删除应用数据文件
            const filesToDelete = [
                'fourair.db',          // 数据库文件
                'settings.json',       // 设置文件
                'app.salt',           // 盐值文件
                'backup'              // 备份目录
            ];
            
            for (const file of filesToDelete) {
                const filePath = path.join(userDataPath, file);
                try {
                    const stats = await fsPromises.stat(filePath);
                    if (stats.isDirectory()) {
                        // 递归删除目录
                        await fsPromises.rm(filePath, { recursive: true, force: true });
                        console.log(`[Reset] 已删除目录: ${file}`);
                    } else {
                        // 删除文件
                        await fsPromises.unlink(filePath);
                        console.log(`[Reset] 已删除文件: ${file}`);
                    }
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        console.error(`[Reset] 删除 ${file} 失败:`, error);
                    }
                }
            }
            
            console.log('[Reset] 应用数据重置完成');
            
            return {
                success: true,
                message: '应用数据已成功重置'
            };
            
        } catch (error) {
            console.error('[IPC] 重置应用失败:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

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