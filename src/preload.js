contextBridge.exposeInMainWorld('dbAPI', {
    initializeDatabase: () => ipcRenderer.invoke('db:initializeDatabase'),
    // Groups
    addGroup: (groupName) => ipcRenderer.invoke('db:addGroup', groupName),
    getGroups: () => ipcRenderer.invoke('db:getGroups'),
    updateGroup: (id, groupName) => ipcRenderer.invoke('db:updateGroup', id, groupName),
    deleteGroup: (id) => ipcRenderer.invoke('db:deleteGroup', id),
    getGroupUsage: (id) => ipcRenderer.invoke('db:getGroupUsage', id),
    // Wallets
    addWallet: (walletData) => ipcRenderer.invoke('db:addWallet', walletData),
    getWallets: (options) => ipcRenderer.invoke('db:getWallets', options),
    getWalletById: (id) => ipcRenderer.invoke('db:getWalletById', id),
    getWalletsByIds: (ids) => ipcRenderer.invoke('db:getWalletsByIds', ids),
    updateWallet: (id, walletData) => ipcRenderer.invoke('db:updateWallet', id, walletData),
    deleteWallet: (id) => ipcRenderer.invoke('db:deleteWallet', id),
    deleteWalletsByIds: (ids) => ipcRenderer.invoke('db:deleteWalletsByIds', ids),
    // Social Accounts
    addSocialAccount: (accountData) => ipcRenderer.invoke('db:addSocialAccount', accountData),
    getSocialAccounts: (options) => ipcRenderer.invoke('db:getSocialAccounts', options),
    updateSocialAccount: (id, accountData) => ipcRenderer.invoke('db:updateSocialAccount', id, accountData),
    deleteSocialAccount: (id) => ipcRenderer.invoke('db:deleteSocialAccount', id),
    deleteSocialAccountsByIds: (ids) => ipcRenderer.invoke('db:deleteSocialAccountsByIds', ids)
}); 