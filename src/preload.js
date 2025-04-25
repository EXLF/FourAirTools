const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded.');

// 向渲染进程暴露数据库操作API
contextBridge.exposeInMainWorld('dbAPI', {
    // 分组管理
    addGroup: (name) => ipcRenderer.invoke('db:addGroup', name),
    getGroups: () => ipcRenderer.invoke('db:getGroups'),
    updateGroup: (id, newName) => ipcRenderer.invoke('db:updateGroup', id, newName),
    deleteGroup: (id) => ipcRenderer.invoke('db:deleteGroup', id),

    // 钱包管理
    addWallet: (walletData) => ipcRenderer.invoke('db:addWallet', walletData),
    getWallets: (options) => ipcRenderer.invoke('db:getWallets', options),
    getWalletById: (id) => ipcRenderer.invoke('db:getWalletById', id),
    getWalletsByIds: (ids) => ipcRenderer.invoke('db:getWalletsByIds', ids),
    updateWallet: (id, walletData) => ipcRenderer.invoke('db:updateWallet', id, walletData),
    deleteWallet: (id) => ipcRenderer.invoke('db:deleteWallet', id),
    deleteWalletsByIds: (ids) => ipcRenderer.invoke('db:deleteWalletsByIds', ids),
    getWalletDetails: (id) => ipcRenderer.invoke('db:getWalletDetails', id),

    // 社交账户管理
    addSocialAccount: (accountData) => ipcRenderer.invoke('db:addSocialAccount', accountData),
    getSocialAccounts: (options) => ipcRenderer.invoke('db:getSocialAccounts', options),
    getSocialAccountById: (id) => ipcRenderer.invoke('db:getSocialAccountById', id),
    updateSocialAccount: (id, accountData) => ipcRenderer.invoke('db:updateSocialAccount', id, accountData),
    deleteSocialAccount: (id) => ipcRenderer.invoke('db:deleteSocialAccount', id),
    deleteSocialAccountsByIds: (ids) => ipcRenderer.invoke('db:deleteSocialAccountsByIds', ids),

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
    'app:lock' // 添加手动锁定通道
];
const validReceiveChannels = [
    'show-setup-password',
    'show-unlock-screen',
    'app-unlocked-status' // 添加解锁状态通道
];
const validInvokeChannels = [
    'auth:setupPassword', 
    'auth:unlockApp', 
    'db:getGroups', 'db:addGroup', 'db:renameGroup', 'db:deleteGroup', 
    'db:getWallets', 'db:addWallet', 'db:updateWallet', 'db:deleteWallet', 'db:deleteWallets', 'db:getWalletDetails', 
    'db:getSocialAccounts', 'db:addSocialAccount', 'db:updateSocialAccount', 'db:deleteSocialAccount', 'db:deleteSocialAccounts',
    'app:generateWallets',
    'app:exportWallets',
    'app:importWallets',
    'app:encryptData', 
    'app:decryptData', // *** 新增：添加解密通道 ***
    'app:lock'
];

contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
        send: (channel, data) => {
            if (validSendChannels.includes(channel)) {
                ipcRenderer.send(channel, data);
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

console.log('[Preload] Preload script executed successfully.');

window.addEventListener('DOMContentLoaded', () => {
    console.log('[Preload] DOMContentLoaded event fired.');
}); 