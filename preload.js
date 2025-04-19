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

    // 你可以在这里暴露其他需要的 IPC 功能
    // 例如：文件操作、打开外部链接等
    // openExternalLink: (url) => ipcRenderer.send('open-external-link', url) // send 用于单向通信
}); 