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
}); 

// 安全地暴露部分electron功能给渲染进程
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  }
}); 

console.log('[Preload] Preload script executed successfully.');

window.addEventListener('DOMContentLoaded', () => {
    console.log('[Preload] DOMContentLoaded event fired.');
}); 