const { contextBridge, ipcRenderer } = require('electron');
const url = require('url'); // 导入 url 模块

console.log('Preload script loaded.');

// 向渲染进程暴露数据库操作API
contextBridge.exposeInMainWorld('dbAPI', {
    // Groups
    getGroups: () => ipcRenderer.invoke('db:getGroups'),
    addGroup: (name) => ipcRenderer.invoke('db:addGroup', name),
    updateGroup: (id, name) => ipcRenderer.invoke('db:updateGroup', id, name),
    deleteGroup: (id) => ipcRenderer.invoke('db:deleteGroup', id),
    // Wallets
    addWallet: (walletData) => ipcRenderer.invoke('db:addWallet', walletData),
    getWallets: (options) => ipcRenderer.invoke('db:getWallets', options),
    getWalletDetails: (id) => ipcRenderer.invoke('db:getWalletDetails', id),
    getWalletById: (id) => ipcRenderer.invoke('db:getWalletById', id),
    updateWallet: (id, updates) => ipcRenderer.invoke('db:updateWallet', id, updates),
    deleteWallet: (id) => ipcRenderer.invoke('db:deleteWallet', id),
    deleteWalletsByIds: (ids) => ipcRenderer.invoke('db:deleteWalletsByIds', ids),
    // Social Accounts
    addSocialAccount: (accountData) => ipcRenderer.invoke('db:addSocialAccount', accountData),
    getSocialAccounts: (options) => ipcRenderer.invoke('db:getSocialAccounts', options),
    getSocialAccountById: (id) => ipcRenderer.invoke('db:getSocialAccountById', id),
    updateSocialAccount: (id, updates) => ipcRenderer.invoke('db:updateSocialAccount', id, updates),
    deleteSocialAccount: (id) => ipcRenderer.invoke('db:deleteSocialAccount', id),
    deleteSocialAccountsByIds: (ids) => ipcRenderer.invoke('db:deleteSocialAccountsByIds', ids),
    // *** Wallet-Social Links (New) ***
    getLinkedSocialsForWallet: (walletId) => ipcRenderer.invoke('db:getLinkedSocialsForWallet', walletId),
    linkSocialsToWallet: (walletId, socialIds) => ipcRenderer.invoke('db:linkSocialsToWallet', walletId, socialIds),
    getAllSocialsWithLinkStatus: (walletId) => ipcRenderer.invoke('db:getAllSocialsWithLinkStatus', walletId),
    updateWalletSocialLinks: (walletId, linkedSocialIds) => ipcRenderer.invoke('db:updateWalletSocialLinks', walletId, linkedSocialIds),

    // --- Proxies (新增) ---
    addProxy: (proxyData) => ipcRenderer.invoke('db:addProxy', proxyData),
    getProxies: (options) => ipcRenderer.invoke('db:getProxies', options),
    getProxyById: (id) => ipcRenderer.invoke('db:getProxyById', id),
    updateProxy: (id, updates) => ipcRenderer.invoke('db:updateProxy', id, updates),
    deleteProxy: (id) => ipcRenderer.invoke('db:deleteProxy', id),
    deleteProxiesByIds: (ids) => ipcRenderer.invoke('db:deleteProxiesByIds', ids),
    // --- -------- ---

    // 应用级功能
    // 批量生成钱包: {count: 生成数量, groupId?: 分组ID}
    generateWallets: (options) => ipcRenderer.invoke('app:generateWallets', options),
    // 保存文件: {defaultPath: 默认路径, content: 文件内容}
    saveFile: (options) => ipcRenderer.invoke('app:saveFile', options),
    // 从种子派生地址: {seedType: 'privateKey' | 'mnemonic', seed: string}
    deriveAddressFromSeed: (options) => ipcRenderer.invoke('app:deriveAddressFromSeed', options),
    // 加密数据: (plainText: string)
    encryptData: (plainText) => ipcRenderer.invoke('app:encryptData', plainText),
}); 

// --- 修改：教程加载 API 调用主进程 --- 
contextBridge.exposeInMainWorld('tutorialAPI', {
  loadTutorials: () => ipcRenderer.invoke('app:loadTutorials')
});

// 白名单通道：明确列出允许渲染进程使用的 IPC 通道
const validSendChannels = [
    'auth:setupPassword', 
    'auth:unlockApp',
    // 数据库相关 (从 dbHandlers.js 导入或手动添加)
    'db:getGroups', 'db:addGroup', 'db:renameGroup', 'db:deleteGroup', 
    'db:getWallets', 'db:addWallet', 'db:updateWallet', 'db:deleteWallet', 'db:deleteWallets', 'db:getWalletDetails', // 假设有 getWalletDetails
    'db:getSocialAccounts', 'db:addSocialAccount', 'db:updateSocialAccount', 'db:deleteSocialAccount', 'db:deleteSocialAccounts',
    'app:generateWallets', 
    'app:exportWallets', 
    'app:importWallets', // 新增
    'app:encryptData', // 添加加密通道
    'app:lock', // 添加手动锁定通道
    'open-external-link',
    // 更新器相关
    'updater-start-download',
    'updater-quit-and-install',
    // 设置更改通知通道
    'settings:updateTrayOption',
    'direct:updateCloseHandler',
    'settings:trayOptionChanged'
];
const validReceiveChannels = [
    'show-setup-password',
    'show-unlock-screen',
    'auth:needs-setup', // 添加首次设置密码的消息通道
    'auth:needs-unlock', // 添加需要解锁的消息通道
    'app-unlocked-status', // 添加解锁状态通道
    // *** 新增：代理测试结果通知通道 ***
    'proxy:testResult',
    // *** 新增：脚本日志通道 ***
    'script:log',
    'script-log', // 修改为实际使用的通道名
    // *** 新增：脚本执行进度和结果通道 ***
    'script-progress',
    'script-completed',
    'script-error',
    // 更新器相关
    'update-checking',
    'update-available',
    'update-not-available',
    'update-error',
    'update-download-progress',
    'update-downloaded'
];
const validInvokeChannels = [
    'auth:setupPassword', 
    'auth:unlockApp', 
    'auth:isUnlocked',
    'execute-simple-script',
    // *** 脚本相关通道 ***
    'script:getAll',
    'script:execute',
    'get-available-scripts',
    'get-script-metadata',
    'run-script',
    'stop-script',
    'get-running-scripts',
    'test-script-loading',
    // 数据库相关 (从 dbHandlers.js 导入或手动添加)
    'db:getGroups', 'db:addGroup', 'db:renameGroup', 'db:deleteGroup', 
    'db:getWallets', 'db:addWallet', 'db:updateWallet', 'db:deleteWallet', 'db:deleteWalletsByIds', 'db:getWalletDetails', 
    'db:getWalletById',
    'db:getSocialAccounts', 'db:addSocialAccount', 'db:getSocialAccountById',
    'db:updateSocialAccount',
    'db:deleteSocialAccount',
    'db:deleteSocialAccountsByIds',
    'db:getLinkedSocialsForWallet', 
    'db:linkSocialsToWallet', 
    'db:getAllSocialsWithLinkStatus',
    'db:updateWalletSocialLinks',
    'app:generateWallets',
    'app:exportWallets',
    'app:performPlaintextExport',
    'app:importWallets',
    'app:encryptData', 
    'app:decryptData',
    'app:lock',
    'wallet:getBalance',
    'app:loadTutorials',
    // --- Proxies (新增) ---
    'db:addProxy', 
    'db:getProxies', 
    'db:getProxyById', 
    'db:updateProxy', 
    'db:deleteProxy', 
    'db:deleteProxiesByIds',
    // *** 新增：代理测试与设置通道 ***
    'proxy:test', 
    'proxy:set',
    // *** 新增：设置相关通道 ***
    'settings:getSettings',
    'settings:saveSettings',
    'settings:resetSettings',
    'settings:applySettings',
    'app:clearCache',
    'app:checkForUpdates',
    'app:downloadUpdate',
    'app:restart',
    'app:openDevTools',
    'app:generateDebugReport'
];

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, data) => {
            if (validSendChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
            }
        },
        // *** 新增：专门用于打开外部链接的函数 ***
        sendOpenExternalLink: (link) => {
            const channel = 'open-external-link';
            if (validSendChannels.includes(channel)) {
                 ipcRenderer.send(channel, link);
            } else {
                 console.warn(`[Preload] Attempted to send on invalid channel: ${channel}`);
            }
        },
        invoke: async (channel, ...args) => {
            if (validInvokeChannels.includes(channel)) {
                return await ipcRenderer.invoke(channel, ...args);
            }
            throw new Error(`无效的 invoke 通道: ${channel}`);
        },
        on: (channel, func) => {
            if (validReceiveChannels.includes(channel)) {
                // 为了安全，移除 event 参数，只传递数据
                // const subscription = (event, ...args) => func(...args);
                // 或者，如果你确实需要 event，确保 func 能正确处理
                 const subscription = (event, ...args) => func(args[0]); // 假设只传递第一个数据参数
                ipcRenderer.on(channel, subscription);
                // 返回取消订阅的函数
                return () => {
                    ipcRenderer.removeListener(channel, subscription);
                };
            } else {
                console.warn(`尝试监听无效的通道: ${channel}`);
                return () => {}; // 返回一个空函数
            }
        },
        removeAllListeners: (channel) => {
            if (validReceiveChannels.includes(channel)) {
                 ipcRenderer.removeAllListeners(channel);
             } else {
                 console.warn(`尝试移除无效通道的监听器: ${channel}`);
             }
        }
    }
}); 

// --- 修改：也暴露 wallet 相关的 API 到 window 对象下，方便调用 --- 
// (或者你可以选择继续通过 electron.ipcRenderer.invoke 调用)
contextBridge.exposeInMainWorld('walletAPI', {
    getBalance: (address) => ipcRenderer.invoke('wallet:getBalance', address)
});

// *** 新增：暴露 URL 解析功能 ***
contextBridge.exposeInMainWorld('urlUtils', {
    parse: (urlString) => {
        try {
            return url.parse(urlString);
        } catch (e) {
            console.error(`[Preload] Error parsing URL: ${urlString}`, e);
            return null; // 返回 null 或抛出错误，根据你的错误处理策略
        }
    }
});

// *** 新增：暴露代理操作API ***
contextBridge.exposeInMainWorld('proxyAPI', {
    testProxies: (proxyIds) => ipcRenderer.invoke('proxy:test', proxyIds),
    setProxy: (proxyId) => ipcRenderer.invoke('proxy:set', proxyId), // proxyId 为 null 表示禁用
    onTestResult: (callback) => {
        const channel = 'proxy:testResult';
        if (validReceiveChannels.includes(channel)) {
             // 注意：这里的回调会接收到包含 { proxyId, success, data } 的对象
            const subscription = (event, result) => callback(result);
            ipcRenderer.on(channel, subscription);
            // 返回取消订阅函数
            return () => {
                 ipcRenderer.removeListener(channel, subscription);
             };
        } else {
            console.warn(`尝试监听无效通道: ${channel}`);
            return () => {};
        }
    }
});

// 暴露脚本API
contextBridge.exposeInMainWorld('scriptAPI', {
    getAllScripts: async () => {
        console.log('[Preload] 调用 getAllScripts');
        try {
            console.log('[Preload] 发送IPC请求: get-available-scripts');
            const result = await ipcRenderer.invoke('get-available-scripts');
            console.log('[Preload] 获取脚本列表结果:', result);
            
            if (!result || !result.success) {
                throw new Error(result?.error || '获取脚本列表失败');
            }
            
            return result;
        } catch (error) {
            console.error('[Preload] 获取脚本列表失败:', error);
            return {
                success: false,
                error: error.message || '未知错误',
                data: []
            };
        }
    },
    executeScript: async (scriptId, selectedWallets, config, proxyConfig) => {
        return await ipcRenderer.invoke('run-script', scriptId, selectedWallets, config, proxyConfig);
    },
    stopScript: async (executionId) => {
        return await ipcRenderer.invoke('stop-script', executionId);
    },
    getRunningScripts: async () => {
        return await ipcRenderer.invoke('get-running-scripts');
    },
    // 添加onLog事件监听函数
    onLog: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('script-log', subscription);
        return () => {
            ipcRenderer.removeListener('script-log', subscription);
        };
    },
    // 添加脚本完成事件监听
    onScriptCompleted: (callback) => {
        const subscription = (event, data) => callback(data);
        ipcRenderer.on('script-completed', subscription);
        return () => {
            ipcRenderer.removeListener('script-completed', subscription);
        };
    }
});

// 应用程序API
contextBridge.exposeInMainWorld('appAPI', {
    // 现有函数...
    
    // 检查应用是否已解锁
    isAppLocked: () => {
      return new Promise((resolve) => {
        // 先尝试直接读取内存中的锁定状态
        if (typeof window._appUnlocked !== 'undefined') {
          resolve(!window._appUnlocked);
          return;
        }
        
        // 如果内存中没有，通过向主进程发送请求来检查
        ipcRenderer.invoke('app:check-locked-status')
          .then(result => {
            // 缓存结果
            window._appUnlocked = result.unlocked;
            resolve(!result.unlocked);
          })
          .catch(err => {
            console.error('检查应用锁定状态失败:', err);
            // 出错时，保守起见当作已锁定
            resolve(true);
          });
      });
    },
    
    // 请求解锁应用
    requestUnlock: () => {
      ipcRenderer.send('app:show-unlock');
    },
    // 清除缓存
    clearCache: () => ipcRenderer.invoke('app:clearCache'),
    // 检查更新
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    // 下载更新
    downloadUpdate: () => ipcRenderer.invoke('app:downloadUpdate'),
    // 重启应用
    restart: () => ipcRenderer.invoke('app:restart'),
    // 打开开发者工具
    openDevTools: () => ipcRenderer.invoke('app:openDevTools'),
    // 生成调试报告
    generateDebugReport: () => ipcRenderer.invoke('app:generateDebugReport')
});

// *** 新增：暴露设置API ***
contextBridge.exposeInMainWorld('settingsAPI', {
    // 获取设置
    getSettings: () => {
        try {
            return ipcRenderer.invoke('settings:getSettings');
        } catch (error) {
            console.error('[Preload] 获取设置失败:', error);
            return null;
        }
    },
    // 保存设置
    saveSettings: (settings) => {
        try {
            return ipcRenderer.invoke('settings:saveSettings', settings);
        } catch (error) {
            console.error('[Preload] 保存设置失败:', error);
            return false;
        }
    },
    // 重置设置
    resetSettings: () => {
        try {
            return ipcRenderer.invoke('settings:resetSettings');
        } catch (error) {
            console.error('[Preload] 重置设置失败:', error);
            return false;
        }
    },
    // 应用设置
    applySettings: (settings) => {
        try {
            return ipcRenderer.invoke('settings:applySettings', settings);
        } catch (error) {
            console.error('[Preload] 应用设置失败:', error);
            return false;
        }
    }
});

// *** 新增：暴露数据API ***
contextBridge.exposeInMainWorld('dataAPI', {
    // 备份数据
    backup: () => ipcRenderer.invoke('data:backup'),
    // 导出数据
    exportData: () => ipcRenderer.invoke('data:export'),
    // 导入数据
    importData: () => ipcRenderer.invoke('data:import'),
    // 更改数据存储位置
    changeDataLocation: () => ipcRenderer.invoke('data:changeLocation')
});

console.log('[Preload] Preload script executed successfully.');

window.addEventListener('DOMContentLoaded', () => {
    console.log('[Preload] DOMContentLoaded event fired.');
}); 