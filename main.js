const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const db = require('./src/js/db/index.js');

const { setupDatabaseIpcHandlers } = require('./src/main/ipcHandlers/dbHandlers.js');
const { setupApplicationIpcHandlers } = require('./src/main/ipcHandlers/appHandlers.js');

function createWindow() {
  // 创建浏览器窗口
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // 安全配置: 启用上下文隔离并指定 Preload 脚本
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // 在加载文件前设置 IPC Handlers 并传入 mainWindow
  setupDatabaseIpcHandlers();
  setupApplicationIpcHandlers(mainWindow);

  // 加载 index.html
  mainWindow.loadFile('index.html');

  // 仅在开发模式下打开开发者工具
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// 当 Electron 完成初始化并准备创建浏览器窗口时调用
app.whenReady().then(() => {
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