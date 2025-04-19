const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// 导入数据库模块，因为主进程需要访问它（如果使用 IPC）
// 即使现在渲染进程直接访问，主进程预加载它也没坏处
const db = require('./src/js/db'); // 确保路径正确

function createWindow () {
  // 创建浏览器窗口。
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // --- 安全配置: 启用上下文隔离并指定 Preload 脚本 --- 
      contextIsolation: true, // 推荐启用
      preload: path.join(__dirname, 'preload.js') // 指定 Preload 脚本路径
      // nodeIntegration: false, // nodeIntegration 默认为 false，无需显式设置
      // --- ----------------------------------------- --- 
    }
  });

  // 加载 index.html
  mainWindow.loadFile('index.html');

  // ---- 仅在开发模式下打开开发者工具 ----
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  // ---- ----------------------------- ----
}

// 当 Electron 完成初始化并准备创建浏览器窗口时调用
app.whenReady().then(() => {
  // --- 设置 IPC Handlers --- 
  setupDbHandlers();
  // --- ---------------- --- 

  createWindow();

  // 在 macOS 上，当单击 dock 图标并且没有其他窗口打开时，
  // 通常在应用程序中重新创建一个窗口。
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    });

// 当所有窗口都关闭时退出应用程序，除 macOS 外。
// 在 macOS 上，应用程序及其菜单栏通常保持活动状态，
// 直到用户使用 Cmd + Q 显式退出。
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
      // 在退出前关闭数据库连接
      db.closeDatabase();
      app.quit();
  }
});

// 在应用程序退出前确保数据库已关闭
app.on('will-quit', () => {
  db.closeDatabase();
});

// ================== IPC Handlers for DB Operations ==================

function setupDbHandlers() {
    console.log('Setting up DB IPC handlers...');

    // --- Groups --- 
    ipcMain.handle('db:addGroup', async (event, name) => {
        console.log('IPC received: db:addGroup', name);
        return await db.addGroup(name);
    });
    ipcMain.handle('db:getGroups', async () => {
        console.log('IPC received: db:getGroups');
        return await db.getGroups();
    });
    ipcMain.handle('db:updateGroup', async (event, id, newName) => {
        console.log('IPC received: db:updateGroup', id, newName);
        return await db.updateGroup(id, newName);
    });
    ipcMain.handle('db:deleteGroup', async (event, id) => {
        console.log('IPC received: db:deleteGroup', id);
        return await db.deleteGroup(id);
    });

    // --- Wallets --- 
    ipcMain.handle('db:addWallet', async (event, walletData) => {
        console.log('IPC received: db:addWallet', walletData);
        return await db.addWallet(walletData);
    });
    ipcMain.handle('db:getWallets', async (event, options) => {
        console.log('IPC received: db:getWallets', options);
        return await db.getWallets(options);
    });
     ipcMain.handle('db:getWalletById', async (event, id) => {
        console.log('IPC received: db:getWalletById', id);
        return await db.getWalletById(id);
    });
    ipcMain.handle('db:getWalletsByIds', async (event, ids) => {
        console.log('IPC received: db:getWalletsByIds', ids);
        return await db.getWalletsByIds(ids);
    });
    ipcMain.handle('db:updateWallet', async (event, id, walletData) => {
        console.log('IPC received: db:updateWallet', id, walletData);
        return await db.updateWallet(id, walletData);
    });
    ipcMain.handle('db:deleteWallet', async (event, id) => {
        console.log('IPC received: db:deleteWallet', id);
        return await db.deleteWallet(id);
    });

    console.log('DB IPC handlers ready.');
}

// ==================================================================== 