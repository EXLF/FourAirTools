const { contextBridge, ipcRenderer } = require('electron');

console.log('Preload script loaded.');

// 在 window 对象上暴露一个名为 dbAPI 的对象
contextBridge.exposeInMainWorld('dbAPI', {
    // Groups
    addGroup: (name) => ipcRenderer.invoke('db:addGroup', name),
    getGroups: () => ipcRenderer.invoke('db:getGroups'),
    updateGroup: (id, newName) => ipcRenderer.invoke('db:updateGroup', id, newName),
    deleteGroup: (id) => ipcRenderer.invoke('db:deleteGroup', id),

    // Wallets
    addWallet: (walletData) => ipcRenderer.invoke('db:addWallet', walletData),
    getWallets: (options) => ipcRenderer.invoke('db:getWallets', options),
    getWalletById: (id) => ipcRenderer.invoke('db:getWalletById', id),
    getWalletsByIds: (ids) => ipcRenderer.invoke('db:getWalletsByIds', ids),
    updateWallet: (id, walletData) => ipcRenderer.invoke('db:updateWallet', id, walletData),
    deleteWallet: (id) => ipcRenderer.invoke('db:deleteWallet', id),
    deleteWalletsByIds: (ids) => ipcRenderer.invoke('db:deleteWalletsByIds', ids),
    countWallets: () => ipcRenderer.invoke('db:countWallets'),

    // Social Accounts
    addSocialAccount: (accountData) => ipcRenderer.invoke('db:addSocialAccount', accountData),
    getSocialAccounts: (options) => ipcRenderer.invoke('db:getSocialAccounts', options),
    getSocialAccountById: (id) => ipcRenderer.invoke('db:getSocialAccountById', id),
    updateSocialAccount: (id, accountData) => ipcRenderer.invoke('db:updateSocialAccount', id, accountData),
    deleteSocialAccount: (id) => ipcRenderer.invoke('db:deleteSocialAccount', id),
    deleteSocialAccountsByIds: (ids) => ipcRenderer.invoke('db:deleteSocialAccountsByIds', ids),
    countSocialAccounts: () => ipcRenderer.invoke('db:countSocialAccounts'),

    // --- 新增：应用级功能 ---
    generateWallets: (options) => ipcRenderer.invoke('app:generateWallets', options), // { count, groupId? }
    // 新增：保存文件功能 (用于导出)
    saveFile: (options) => ipcRenderer.invoke('app:saveFile', options), // { defaultPath, content }

    // 你可以在这里暴露其他需要的 IPC 功能
    // 例如：文件操作、打开外部链接等
    // openExternalLink: (url) => ipcRenderer.send('open-external-link', url) // send 用于单向通信
}); 

// 如果你需要暴露 electron 对象给渲染进程 (例如 handleBulkDelete 中使用了)
// 注意安全性风险，仅暴露必要的功能
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
    // 如果还需要其他方法，如 send, on, removeListener, 也可在此暴露
  }
}); 

console.log('[Preload] Preload script executed successfully.');

window.addEventListener('DOMContentLoaded', () => {
    // 可以进行一些 DOMContentLoaded 相关的预加载操作
    console.log('[Preload] DOMContentLoaded event fired.');
}); 