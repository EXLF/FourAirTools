const { app, BrowserWindow, ipcMain, shell, Menu, Tray, globalShortcut } = require('electron');
const path = require('path');
const keytar = require('keytar');
const db = require('./db/index.js');
const cryptoService = require('./core/cryptoService.js');
const { autoUpdater } = require("electron-updater");
const log = require('electron-log');
const fs = require('fs');
const os = require('os');
const squirrelStartup = require('electron-squirrel-startup');

const { setupDatabaseIpcHandlers } = require('./ipcHandlers/dbHandlers.js');
const { setupApplicationIpcHandlers } = require('./ipcHandlers/appHandlers.js');
const { setupProxyIpcHandlers } = require('./ipcHandlers/proxyHandlers.js');
const scriptEngine = require('./scriptEngine.js');
const scriptUpdaterService = require('./services/scriptUpdaterService.js');

let mainWindow = null;
let tray = null; // 系统托盘
// 添加属性以跟踪应用是否正在退出
app.isQuitting = false;

const KEYTAR_SERVICE = 'FourAir-Wallet-Master';
const KEYTAR_ACCOUNT = 'FourAir-App';

// 创建系统托盘
function createTray() {
  if (tray) return; // 如果已经存在托盘则不再创建
  
  try {
    // 尝试使用不同的图标路径
    let iconPath;
    const iconPaths = [
      path.join(__dirname, '../assets/icons/logo16.ico'), // 托盘图标使用16x16尺寸
      path.join(__dirname, '../../assets/icons/logo16.ico'),
      path.join(app.getAppPath(), 'assets/icons/logo16.ico')
    ];
    
    // 查找第一个存在的图标路径
    for (const testPath of iconPaths) {
      if (fs.existsSync(testPath)) {
        iconPath = testPath;
        console.log(`[Main] 找到托盘图标: ${iconPath}`);
        break;
      }
    }
    
    // 如果没有找到图标，使用空图标（或者可以提前准备一个默认图标）
    if (!iconPath) {
      console.warn('[Main] 未找到托盘图标，使用默认空图标');
      iconPath = path.join(__dirname, '../assets/icons/logo16.ico'); // 使用16x16尺寸的图标
    }
    
    // 创建托盘
    tray = new Tray(iconPath);
    tray.setToolTip('FourAir撸毛工具箱');
    
    // 托盘上下文菜单
    const contextMenu = Menu.buildFromTemplate([
      { 
        label: '显示主窗口', 
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      { type: 'separator' },
      { 
        label: '退出', 
        click: () => {
          // 标记为正在退出，这样关闭窗口时不会触发最小化到托盘
          app.isQuitting = true;
          app.quit();
        }
      }
    ]);
    
    tray.setContextMenu(contextMenu);
    
    // 点击托盘图标显示主窗口
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    
    console.log('[Main] 系统托盘创建成功');
    return true;
  } catch (error) {
    console.error('[Main] 创建系统托盘失败:', error);
    // 托盘创建失败不阻止应用继续运行
    return false;
  }
}

function createWindow(startMinimized = false) {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '../assets/icons/logo32.ico'), // 设置窗口图标
    webPreferences: {
      // 安全配置: 启用上下文隔离并指定 Preload 脚本
      contextIsolation: true,
      preload: path.join(__dirname, '../preload.js'),
      webviewTag: true // 启用 webview 标签支持
    },
    // 自动隐藏菜单栏，按Alt键显示
    autoHideMenuBar: true,
    // 如果startMinimized为true，则不显示窗口
    show: !startMinimized,
    // 移除窗口框架和标题栏
    // frame: false, // 保留窗口框架
    // titleBarStyle: 'hidden' // 只隐藏标题栏
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

              // 新增：删除锁定状态文件
              const lockFilePath = path.join(app.getPath('userData'), 'app.locked');
              if (fs.existsSync(lockFilePath)) {
                  try {
                      fs.unlinkSync(lockFilePath);
                      console.log('[Main] 已删除锁定状态文件');
                  } catch (e) {
                      console.error('[Main] 删除锁定状态文件失败:', e.message);
                  }
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

  // 如果是最小化启动，处理窗口显示
  if (startMinimized) {
    // 尝试创建托盘，但不依赖它的成功
    try {
      createTray();
    } catch (e) {
      console.warn('[Main] 创建托盘失败，应用将仍然最小化启动:', e.message);
      // 如果托盘创建失败，仍确保窗口最小化
    }
    
    // 最小化窗口而不是完全隐藏，确保在任务栏可见
    mainWindow.minimize();
  }

  // 始终打开开发者工具 (根据用户要求，为打包后的应用保留控制台)
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  // 清理 mainWindow 引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // 处理窗口关闭行为（最小化到托盘）
  handleWindowClose();
  
  // 设置窗口关闭事件监听，用于动态更新关闭行为
  setupWindowCloseListener();
}

// 当 Electron 完成初始化并准备创建浏览器窗口时调用
app.whenReady().then(async () => {
  // 处理命令行参数
  const startMinimized = process.argv.includes('--startup') || process.argv.includes('--minimized');
  
  let needsSetup = false;
  let needsUnlock = true; // *** 默认需要解锁 ***

  // 新增：检查锁定状态文件
  const lockFilePath = path.join(app.getPath('userData'), 'app.locked');
  const appWasLocked = fs.existsSync(lockFilePath);
  if (appWasLocked) {
    console.log('[Main] 检测到应用之前被锁定，强制进入解锁状态');
    // 确保先删除keytar中可能存在的密钥，防止自动解锁
    try {
      await keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
      console.log('[Main] 删除了可能存在的keytar密钥');
    } catch (e) {
      console.log('[Main] 清除keytar密钥时出错:', e.message);
    }
    needsUnlock = true;
  } else {
    console.log('[Main] 未检测到锁定状态文件，进行正常解锁检查');
  }

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

  // 初始化数据库并创建窗口
  try {
    // 检查db模块是否存在init方法，如果没有则使用替代方案
    if (typeof db.init === 'function') {
      await db.init();
    } else if (db.db) {
      // 可能已经初始化，直接使用
      console.log('[Main] 数据库已初始化');
    } else {
      console.warn('[Main] 数据库初始化方法不可用，尝试默认连接');
      // 不阻止窗口创建
    }
    console.log('[Main] 数据库初始化检查完成');
    
    // 创建主窗口并传入startMinimized参数
    createWindow(startMinimized);

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
  } catch (error) {
    console.error('[Main] 创建窗口时出错:', error);
    showErrorDialog('窗口创建失败', `无法创建窗口，应用功能受限。\n错误: ${error.message}`);
  }

  // 新增：配置和启动自动更新
  log.transports.file.level = "info"; // 配置 electron-log 记录更新信息
  autoUpdater.logger = log;
  autoUpdater.autoDownload = false; // 我们将手动触发下载
  // autoUpdater.autoInstallOnAppQuit = true; // 下载完成后退出时自动安装 (如果用户同意)
  
  // 注册快捷键来锁定应用
  // Windows/Linux 上为 Ctrl+L，macOS 上为 Cmd+L
  const lockShortcut = process.platform === 'darwin' ? 'Command+L' : 'Ctrl+L';
  globalShortcut.register(lockShortcut, () => {
    console.log(`[Main] 通过快捷键 ${lockShortcut} 锁定应用`);
    if (cryptoService.isUnlocked()) {
      // 调用已注册的锁定处理程序
      try {
        cryptoService.clearSessionKey(); // 清除内存中的密钥
        keytar.deletePassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT) // 从 keytar 删除密钥
          .then(() => {
            console.log('[Main][Keytar] 通过快捷键删除密钥成功');
          })
          .catch((err) => {
            console.error('[Main][Keytar] 通过快捷键删除密钥错误:', err);
          });
        
        // 通知渲染进程已锁定
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('app-unlocked-status', { unlocked: false });
          mainWindow.webContents.send('show-unlock-screen');
          
          // 显示通知
          if (mainWindow.isFocused()) {
            mainWindow.webContents.executeJavaScript(
              `if(window.showToast) window.showToast('应用已锁定', 'info');`
            ).catch(() => {});
          }
        }
      } catch (error) {
        console.error('[Main] 通过快捷键锁定应用出错:', error);
      }
    } else {
      console.log('[Main] 应用已处于锁定状态，快捷键无效');
    }
  });
  console.log(`[Main] 已注册应用锁定快捷键: ${lockShortcut}`);

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
  
  // 应用程序启动后，检查更新
  // 读取设置，确定是否自动检查更新
  let autoCheckUpdate = true; // 默认为true
  try {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsData);
      autoCheckUpdate = settings.autoCheckUpdate !== false; // 如果设置存在且为false，则不自动检查
    }
  } catch (error) {
    console.error('[Update] 读取自动更新设置失败:', error);
    // 出错时保持默认值true
  }

  if (autoCheckUpdate) {
    console.log('[Update] 根据设置自动检查更新');
    // 在开发环境中也强制检查更新，方便测试
    if (process.env.NODE_ENV === 'development') {
      // 开发环境中强制检查更新
      console.log('[Update] 在开发环境中强制检查更新');
      try {
        // 设置开发环境的更新源
        autoUpdater.updateConfigPath = path.join(__dirname, '../../dev-app-update.yml');
        autoUpdater.forceDevUpdateConfig = true;
        autoUpdater.checkForUpdates();
      } catch (error) {
        console.error('[Update] 开发环境检查更新失败:', error);
      }
    } else {
      // 生产环境正常检查更新
      console.log('[Update] 在生产环境中检查更新');
      autoUpdater.checkForUpdates();
    }
  } else {
    console.log('[Update] 根据用户设置，跳过自动检查更新');
  }

  // 在应用准备好并且窗口等设置完毕后，检查脚本更新
  // 你可以根据需要调整调用时机，例如在 createWindow() 之后，或者特定事件触发后
  try {
    console.log('[Main] Application ready. Checking for script updates...');
    const updateResult = await scriptUpdaterService.checkForUpdates();
    console.log('[Main] Script update check completed.', updateResult);
    // 这里可以根据 updateResult 向渲染进程发送消息，通知更新状态
    // if (mainWindow && updateResult.updatesFound) {
    //   mainWindow.webContents.send('scripts-updated', updateResult.processedScripts);
    // }
  } catch (error) {
    console.error('[Main] Error during initial script update check:', error);
  }

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
  // 在非macOS平台，当所有窗口关闭时退出应用
  if (process.platform !== 'darwin') {
    cryptoService.clearSessionKey(); // 清除会话密钥
    db.closeDatabase();
    app.quit();
  }
});

// 在应用程序退出前确保数据库已关闭
app.on('will-quit', () => {
  app.isQuitting = true; // 确保设置退出标志
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
        
        // 新增：保存锁定状态到文件
        const lockFilePath = path.join(app.getPath('userData'), 'app.locked');
        fs.writeFileSync(lockFilePath, new Date().toISOString());
        console.log('[Main] 已保存锁定状态到文件:', lockFilePath);
        
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

// 修改窗口关闭行为，实现关闭时最小化到托盘
function handleWindowClose() {
  // 清除之前的close事件处理程序(如果存在)，防止重复添加
  if (mainWindow) {
    // 移除所有现有的close事件监听器，完全重新设置
    mainWindow.removeAllListeners('close');
    
    // 创建新的处理函数
    const closeHandler = (event) => {
      // 每次都重新读取设置，确保获取最新值
      let minimizeToTray = false;
      
      try {
        // 从设置中读取
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        if (fs.existsSync(settingsPath)) {
          const settingsData = fs.readFileSync(settingsPath, 'utf-8');
          const settings = JSON.parse(settingsData);
          // 使用"关闭时最小化到托盘"设置
          minimizeToTray = settings.startMinimized; 
        }
      } catch (error) {
        console.error('[Main] 读取设置失败:', error);
        minimizeToTray = false; // 读取失败时默认为false，允许完全关闭
      }
      
      console.log('[Main] 捕获到窗口关闭事件, minimizeToTray =', minimizeToTray, ', app.isQuitting =', app.isQuitting);
      
      // 如果应该最小化到托盘，并且不是通过quit()方法退出
      if (minimizeToTray && !app.isQuitting) {
        // 阻止默认关闭行为
        event.preventDefault();
        
        // 确保托盘已创建
        if (!tray) {
          try {
            createTray();
          } catch (error) {
            console.error('[Main] 创建托盘失败，窗口将直接关闭:', error);
            return; // 如果无法创建托盘，允许窗口关闭
          }
        }
        
        // 隐藏窗口而不是关闭
        mainWindow.hide();
        
        // 可选：显示提示消息
        if (tray) {
          tray.displayBalloon({
            title: 'FourAir社区撸毛工具箱',
            content: '应用已最小化到托盘，单击图标可重新打开。',
            icon: path.join(__dirname, '../assets/icons/logo.png')
          });
        }
      }
      // 注意：我们移除了else分支中的app.isQuitting = true，防止它被错误设置
    };
    
    // 添加新的close事件处理程序
    mainWindow.on('close', closeHandler);
    
    // 读取当前设置值，只用于日志
    let currentMinimizeToTray = false;
    try {
      const settingsPath = path.join(app.getPath('userData'), 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const settingsData = fs.readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(settingsData);
        currentMinimizeToTray = settings.startMinimized;
      }
    } catch (e) {}
    
    console.log('[Main] 已添加新的窗口关闭处理程序，minimizeToTray =', currentMinimizeToTray);
  }
}

// 添加一个监听函数，用于接收设置更改的通知
function setupWindowCloseListener() {
  if (mainWindow) {
    // 监听"关闭时最小化到托盘"选项的更改
    ipcMain.on('settings:updateTrayOption', (event, minimizeToTray) => {
      console.log('[Main] 收到设置更新通知，minimizeToTray =', minimizeToTray);
      // 重新设置窗口关闭行为
      handleWindowClose();
    });
    
    // 也监听从渲染进程发来的更新请求
    mainWindow.webContents.on('ipc-message', (event, channel, ...args) => {
      if (channel === 'settings:trayOptionChanged') {
        console.log('[Main] 收到设置更改事件，minimizeToTray =', args[0]);
        // 重新设置窗口关闭行为
        handleWindowClose();
      }
    });
  }
}

// 添加直接监听设置更新的IPC处理函数
ipcMain.on('direct:updateCloseHandler', (event, minimizeToTray) => {
  console.log('[Main] 收到直接更新窗口关闭行为请求，minimizeToTray =', minimizeToTray);
  // 立即重新应用窗口关闭行为
  if (mainWindow) {
    // 立即重新设置窗口关闭行为
    handleWindowClose();
  }
});

// 也处理settings:updateTrayOption通道的消息
ipcMain.on('settings:updateTrayOption', (event, minimizeToTray) => {
  console.log('[Main] 收到更新托盘选项请求，minimizeToTray =', minimizeToTray);
  // 立即重新应用窗口关闭行为
  if (mainWindow) {
    // 立即重新设置窗口关闭行为
    handleWindowClose();
  }
}); 