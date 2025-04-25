const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// --- 修改：导入数据库初始化和关闭函数 ---
const { initializeDatabaseConnection, closeDatabase } = require('./src/main/db/index.js');
// --- 移除旧的直接 DB 导入 ---
// const db = require('./src/js/db/index.js'); 
// const walletGenerator = require('./src/js/core/walletGenerator.js'); // No longer needed here

// --- 导入新的 Handler 设置函数 ---
const { setupDatabaseIpcHandlers } = require('./src/main/ipcHandlers/dbHandlers.js');
const { setupApplicationIpcHandlers } = require('./src/main/ipcHandlers/appHandlers.js');
const { setupProxyIpcHandlers } = require('./src/main/ipcHandlers/proxyHandlers.js'); // 导入新的 handler
// --- ----------------------- ---

// --- 移除旧依赖 ---
// const bip39 = require('bip39');
// const { hdkey } = require('ethereumjs-wallet');
// --- -------- ---

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

  // --- 修改：在加载文件前设置 IPC Handlers --- 
  // 注意：IPC Handlers 现在依赖于已初始化的数据库
  // DB 初始化移至 app.whenReady 之后
  setupDatabaseIpcHandlers();
  setupApplicationIpcHandlers(mainWindow);
  setupProxyIpcHandlers();
  // --- ------------------------------------ ---

  // 加载 index.html
  mainWindow.loadFile('index.html');

  // ---- 仅在开发模式下打开开发者工具 ----
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
  // ---- ----------------------------- ----
}

// --- 修改：在应用准备就绪后初始化数据库并创建窗口 ---
app.whenReady().then(async () => {
  try {
    // 等待数据库初始化完成
    await initializeDatabaseConnection(app);
    console.log('Database initialized successfully.');

    // 数据库准备好后创建窗口
    createWindow();

    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

  } catch (error) {
    console.error('Failed to initialize database or create window:', error);
    // 这里可以向用户显示一个错误对话框
    // dialog.showErrorBox('Initialization Error', 'Could not initialize the application.');
    app.quit(); // 初始化失败，退出应用
  }
});
// --- ------------------------------------------ ---

// 当所有窗口都关闭时退出应用程序，除 macOS 外。
// 在 macOS 上，应用程序及其菜单栏通常保持活动状态，
// 直到用户使用 Cmd + Q 显式退出。
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
      // --- 修改：使用导入的 closeDatabase --- 
      closeDatabase();
      // --- ---------------------------- ---
      app.quit();
  }
});

// 在应用程序退出前确保数据库已关闭
app.on('will-quit', () => {
  // --- 修改：使用导入的 closeDatabase --- 
  closeDatabase();
  // --- ---------------------------- ---
});

// ================== 移除旧的 setupDbHandlers 函数 ==================
// function setupDbHandlers() { ... } // REMOVED
// ==================================================================

// ================== IPC Handlers for DB Operations ==================

// ==================================================================== 