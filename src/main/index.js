const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const keytar = require('keytar');
const db = require('./db/index.js');
const cryptoService = require('./core/cryptoService.js');
const { autoUpdater } = require("electron-updater");
const log = require('electron-log');

const { setupDatabaseIpcHandlers } = require('./ipcHandlers/dbHandlers.js');
const { setupApplicationIpcHandlers } = require('./ipcHandlers/appHandlers.js');
const { setupProxyIpcHandlers } = require('./ipcHandlers/proxyHandlers.js');
const scriptEngine = require('./scriptEngine.js');

let mainWindow = null;

const KEYTAR_SERVICE = 'FourAirToolbox';
const KEYTAR_ACCOUNT = 'MasterKey';

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // 安全配置: 启用上下文隔离并指定 Preload 脚本
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
      webviewTag: true // 启用 webview 标签支持
    }
  });

  // 移除默认菜单栏
  Menu.setApplicationMenu(null);

  // *** 新增：设置窗口打开处理程序 ***
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 检查 URL 是否是 http 或 https
    if (url.startsWith('http:') || url.startsWith('https:')) {
      // 使用 shell 在默认浏览器中打开链接
      console.log(`[Main][WindowOpenHandler] Intercepted window.open for ${url}. Opening externally.`);
      shell.openExternal(url);
      // 拒绝 Electron 创建新窗口
      return { action: 'deny' };
    }
    // 对于其他情况 (e.g., about:blank or other protocols)，允许默认行为
    // 注意：根据安全需求，您可能希望默认拒绝所有非明确允许的窗口打开
    console.log(`[Main][WindowOpenHandler] Allowing window.open for non-http(s) URL: ${url}`);
    return { action: 'allow' }; 
  });
  // *** 结束新增 ***

  // 在加载文件前设置 IPC Handlers 并传入 mainWindow
  setupDatabaseIpcHandlers();
  setupApplicationIpcHandlers(mainWindow);
  setupProxyIpcHandlers(mainWindow);
  // 设置脚本引擎的主窗口引用
  scriptEngine.setMainWindow(mainWindow);
  console.log('[Main] 脚本引擎已初始化');

  // --- 新增：处理设置主密码请求 --- 
  ipcMain.handle('auth:setupPassword', async (event, password) => {
      console.log('[IPC] Received: auth:setupPassword');
      if (!password || typeof password !== 'string' || password.length < 8) {
          return { success: false, error: '密码无效或太短' };
      }
      try {
          // 1. 检查是否已配置，防止重复设置
          if (await cryptoService.isConfigured()) {
               return { success: false, error: '加密已配置，不能重复设置' };
          }
          // 2. 生成盐
          const salt = cryptoService.generateSalt();
          // 3. 使用新密码和盐派生密钥 (保存配置前需要)
          const key = await cryptoService.deriveKey(password, salt);
          // 4. 使用派生的密钥加密验证字符串
          const encryptedVerification = cryptoService.encrypt(cryptoService.VERIFICATION_STRING, key);
          // 5. 保存配置（盐、迭代次数 和 加密的验证字符串）
          await cryptoService.saveConfig(salt, cryptoService.PBKDF2_ITERATIONS, encryptedVerification);
          
          // *** 新增：设置密码成功后，也将密钥存入 keytar ***
          try {
              await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, key.toString('base64'));
              console.log('[Main][Keytar] Master key stored in keychain after setup.');
          } catch (keytarError) {
              console.error('[Main][Keytar] Failed to store key in keychain after setup:', keytarError);
              // 即使存储失败，设置过程也算成功，但下次启动需要密码
              // 可以考虑给用户一个提示
              showErrorDialog('凭据存储警告', '主密码已设置成功，但无法将其安全保存到系统凭据中。下次启动应用时可能需要重新输入密码。');
          }

          cryptoService.setSessionKey(key);
          console.log('[IPC] Master password setup successful.');
          return { success: true };
      } catch (error) {
           console.error('[IPC] Error setting up master password:', error);
           return { success: false, error: `设置主密码时出错: ${error.message}` };
      }
  });
  // --------------------------------

  // --- 新增：处理应用解锁的 IPC 请求 ---
  ipcMain.handle('auth:unlockApp', async (event, password) => {
      console.log('[Main] Received auth:unlockApp request.');
      try {
          const key = await cryptoService.unlockWithPassword(password);
          if (key) {
              console.log('[Main] Application unlocked successfully via password.');
              // *** 新增：解锁成功后，将密钥存入 keytar ***
              try {
                  await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, key.toString('base64'));
                  console.log('[Main][Keytar] Master key stored in keychain after unlock.');
              } catch (keytarError) {
                  console.error('[Main][Keytar] Failed to store key in keychain after unlock:', keytarError);
                  // 存储失败不影响本次解锁成功，但下次可能需要密码
                   showErrorDialog('凭据存储警告', '应用已成功解锁，但无法将凭据安全保存到系统。下次启动应用时可能需要重新输入密码。');
              }

              mainWindow.webContents.send('app-unlocked-status', { unlocked: true }); // Notify renderer (optional)
              return { success: true };
          } else {
               // unlockWithPassword should ideally throw an error on failure, but handle null just in case
               console.warn('[Main] unlockWithPassword returned null, treating as failure.');
              return { success: false, error: '密码不正确或解锁失败。' };
          }
      } catch (error) {
          console.error('[Main] Error during unlock:', error);
          mainWindow.webContents.send('app-unlocked-status', { unlocked: false }); // Notify renderer (optional)
          // Don't send detailed error messages back to renderer for security
          return { success: false, error: '密码不正确或解锁时发生错误。' }; 
      }
  });
  // --------------------------------

  // --- 新增：处理检查应用是否解锁的请求 ---
  ipcMain.handle('auth:isUnlocked', async (event) => {
      console.log('[Main] Checking if app is unlocked');
      return cryptoService.isUnlocked();
  });
  // --------------------------------

  // --- 新增：处理数据解密的 IPC 请求 ---
  ipcMain.handle('app:decryptData', async (event, encryptedData) => {
      // console.log('[Main] Received app:decryptData request.'); // 调试时取消注释
      if (!cryptoService.isUnlocked()) {
          console.error('[Main][Decrypt] 尝试在应用锁定时解密数据。');
          throw new Error('应用程序已锁定，无法解密数据。'); 
      }
      if (!encryptedData) {
          return encryptedData; // 直接返回空值
      }
      try {
          const decryptedData = cryptoService.decryptWithSessionKey(encryptedData);
          return decryptedData;
      } catch (error) {
          console.error('[Main][Decrypt] 解密数据时出错:', error);
          throw new Error('解密数据失败。数据可能已损坏或密钥不匹配。');
      }
  });
  // ----------------------------------

  // --- 新增：处理在外部浏览器打开链接的请求 ---
  ipcMain.on('open-external-link', (event, url) => {
    console.log(`[Main] Received request to open external link: ${url}`);
    // 安全检查：确保 URL 是 http 或 https 协议
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
    } else {
      console.warn(`[Main] Blocked attempt to open non-http(s) URL externally: ${url}`);
    }
  });
  // ----------------------------------------

  // 加载 index.html
  mainWindow.loadFile('index.html');

  // 始终打开开发者工具 (根据用户要求，为打包后的应用保留控制台)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 清理 mainWindow 引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 当 Electron 完成初始化并准备创建浏览器窗口时调用
app.whenReady().then(async () => {
  let needsSetup = false;
  let needsUnlock = true; // *** 默认需要解锁 ***

  try {
    const configured = await cryptoService.isConfigured();
    if (!configured) {
      needsSetup = true;
      needsUnlock = false; // 不需要解锁，因为需要先设置
      console.log('[Main] 需要首次设置主密码。');
    } else {
      // *** 新增：尝试从 keytar 获取密钥 ***
      try {
          const storedKeyBase64 = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
          if (storedKeyBase64) {
              const storedKey = Buffer.from(storedKeyBase64, 'base64');
              // *** 新增：使用存储的密钥尝试解密验证字符串，确保密钥有效 ***
              //      (防止 keytar 中的数据损坏或与当前配置不匹配)
              const config = await cryptoService.loadConfig(); // 需要加载配置中的验证字符串
              let decryptedVerification = '';
              try {
                   decryptedVerification = cryptoService.decrypt(config.encryptedVerification, storedKey);
              } catch (decryptError) {
                  console.warn('[Main][Keytar] Failed to decrypt verification string using stored key:', decryptError.message);
                  // 密钥无效，需要用户输入密码
                  await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT); // 删除无效密钥
                  console.log('[Main][Keytar] Removed invalid key from keychain.');
                  needsUnlock = true;
              }

              if (decryptedVerification === cryptoService.VERIFICATION_STRING) {
                    // 密钥有效！设置会话并跳过解锁界面
                    cryptoService.setSessionKey(storedKey);
                    needsUnlock = false; // *** 不需要解锁界面了 ***
                    console.log('[Main][Keytar] Application unlocked automatically using stored key.');
                    
                    // 添加额外检查，确保密钥被正确设置
                    if (!cryptoService.isUnlocked()) {
                        console.error('[Main][Keytar] 会话密钥设置失败，需要手动解锁！');
                        needsUnlock = true;
                        // 尝试再次设置会话密钥
                        cryptoService.setSessionKey(storedKey);
                        // 再次检查
                        if (cryptoService.isUnlocked()) {
                            console.log('[Main][Keytar] 第二次尝试设置会话密钥成功。');
                            needsUnlock = false;
                        }
                    } else {
                        // 尝试解密一个简单字符串，确保解密功能正常工作
                        try {
                            const testEncrypted = cryptoService.encryptWithSessionKey('测试字符串');
                            const testDecrypted = cryptoService.decryptWithSessionKey(testEncrypted);
                            if (testDecrypted === '测试字符串') {
                                console.log('[Main][Keytar] 加密/解密功能工作正常。');
                            } else {
                                console.error('[Main][Keytar] 加密/解密测试失败！');
                                needsUnlock = true;
                            }
                        } catch (testError) {
                            console.error('[Main][Keytar] 加密/解密测试出错:', testError.message);
                            needsUnlock = true;
                        }
                    }
              } else if (decryptedVerification !== '') { // 解密成功但内容不对
                    console.error('[Main][Keytar] Verification string mismatch using stored key! Removing invalid key.');
                    await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
                    needsUnlock = true;
              } else { // 解密失败，上面 catch 块已处理
                  needsUnlock = true;
              }
          } else {
            // keytar 中没有找到密钥，需要用户输入密码
            console.log('[Main][Keytar] No key found in keychain, manual unlock required.');
            needsUnlock = true;
          }
      } catch (keytarError) {
          console.error('[Main][Keytar] Error accessing keychain:', keytarError);
          // 访问 keytar 出错，也需要用户输入密码
          needsUnlock = true;
      }
    }
  } catch (error) {
    console.error('[Main] 检查加密配置时出错:', error);
    showErrorDialog('加密检查失败', `无法检查加密配置，应用功能受限。\n错误: ${error.message}`);
    // 出错时，保守起见，也需要解锁（如果已配置）
    // needsUnlock 保持默认 true (或根据 configured 判断)
    if(!(await cryptoService.isConfigured())) needsUnlock = false;
  }

  createWindow();

  // 应用启动后，根据状态发送消息
  if (mainWindow && mainWindow.webContents) {
    // 在窗口内容加载完成后发送状态
    mainWindow.webContents.once('did-finish-load', () => {
      console.log('[Main] MainWindow content finished loading.');
      if (needsSetup) {
        console.log('[Main] Sending auth:needs-setup to renderer.');
        mainWindow.webContents.send('auth:needs-setup');
      } else if (needsUnlock) {
        console.log('[Main] Sending auth:needs-unlock to renderer.');
        mainWindow.webContents.send('auth:needs-unlock');
      } else {
        // 如果既不需要设置也不需要解锁 (例如通过 keytar 自动解锁)
        console.log('[Main] App is configured and unlocked. Sending app-unlocked-status.');
        mainWindow.webContents.send('app-unlocked-status', { unlocked: true });
      }
    });
  }

  // 新增：配置和启动自动更新
  log.transports.file.level = "info"; // 配置 electron-log 记录更新信息
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false; // 我们将手动触发下载
  // autoUpdater.autoInstallOnAppQuit = true; // 下载完成后退出时自动安装 (如果用户同意)

  autoUpdater.on('checking-for-update', () => {
    log.info('正在检查更新...');
    if (mainWindow) mainWindow.webContents.send('update-checking');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('检测到新版本:', info);
    if (mainWindow) mainWindow.webContents.send('update-available', info);
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('当前已是最新版本:', info);
    if (mainWindow) mainWindow.webContents.send('update-not-available', info);
  });

  autoUpdater.on('error', (err) => {
    log.error('更新发生错误:', err);
    if (mainWindow) mainWindow.webContents.send('update-error', err.message);
  });

  autoUpdater.on('download-progress', (progressObj) => {
    let log_message = "下载速度: " + progressObj.bytesPerSecond;
    log_message = log_message + ' - 已下载 ' + progressObj.percent + '%';
    log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
    log.info(log_message);
    if (mainWindow) mainWindow.webContents.send('update-download-progress', progressObj);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('更新包下载完成:', info);
    // 通知渲染进程，询问用户是否立即更新
    if (mainWindow) mainWindow.webContents.send('update-downloaded', info);
    // 可以在这里直接提示，或者让渲染进程来处理
    // 例如: dialog.showMessageBox... 然后 autoUpdater.quitAndInstall();
  });
  
  // 应用程序启动后，检查更新 (可以根据你的偏好调整检查时机)
  // 例如，你可以只在用户明确点击"检查更新"按钮时才调用
  autoUpdater.checkForUpdates(); 
  // 如果你想更积极地检查，也可以使用 autoUpdater.checkForUpdatesAndNotify();
  // 它会在有可用更新时显示一个系统通知 (macOS & Windows)

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
    cryptoService.clearSessionKey(); // 清除会话密钥
    db.closeDatabase();
    app.quit();
  }
});

// 在应用程序退出前确保数据库已关闭
app.on('will-quit', () => {
  cryptoService.clearSessionKey(); // 再次确保清除
  db.closeDatabase();
});

// Helper function to show error dialogs
function showErrorDialog(title, content) {
    const { dialog } = require('electron');
    dialog.showErrorBox(title, content);
}

// *** 新增：添加一个手动锁定应用的 IPC Handler (示例) ***
ipcMain.handle('app:lock', async () => {
    console.log('[Main] Received app:lock request.');
    try {
        cryptoService.clearSessionKey(); // 清除内存中的密钥
        await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT); // 从 keytar 删除密钥
        console.log('[Main][Keytar] Key removed from keychain due to manual lock.');
        // 可以通知渲染进程已锁定，例如重新显示解锁界面或禁用功能
        if (mainWindow) {
            mainWindow.webContents.send('app-unlocked-status', { unlocked: false });
            // 根据 needsSetup 状态决定是显示 setup 还是 unlock，但通常是 unlock
             mainWindow.webContents.send('show-unlock-screen'); // 直接显示解锁
        }
        return { success: true };
    } catch (error) {
        console.error('[Main] Error locking application:', error);
        return { success: false, error: '锁定应用时出错。', details: error.message };
    }
});

// 新增：处理从渲染进程触发的下载更新请求
ipcMain.on('updater-start-download', () => {
  log.info('[IPC] Received updater-start-download. Starting download...');
  autoUpdater.downloadUpdate();
});

// 新增：处理从渲染进程触发的立即安装更新请求
ipcMain.on('updater-quit-and-install', () => {
  log.info('[IPC] Received updater-quit-and-install. Quitting and installing...');
  autoUpdater.quitAndInstall();
}); 