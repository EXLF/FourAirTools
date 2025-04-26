const { contextBridge, ipcRenderer } = require('electron');

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
    'wallet:getBalance'
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

// --- 修改：也暴露 wallet 相关的 API 到 window 对象下，方便调用 --- 
// (或者你可以选择继续通过 electron.ipcRenderer.invoke 调用)
contextBridge.exposeInMainWorld('walletAPI', {
    getBalance: (address) => ipcRenderer.invoke('wallet:getBalance', address)
});

console.log('[Preload] Preload script executed successfully.');

window.addEventListener('DOMContentLoaded', () => {
    console.log('[Preload] DOMContentLoaded event fired.');
}); 