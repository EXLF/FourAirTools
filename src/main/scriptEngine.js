/**
 * 脚本执行引擎
 * 负责加载和执行用户脚本
 */
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');
const { VM } = require('vm2');
const util = require('util');
const cryptoService = require('./core/cryptoService.js');
const db = require('./db/index.js');
const loggerModule = require(path.join(__dirname, '..', '..', 'user_scripts', 'common', 'logger.js')); // 正确的相对路径

// 设置正确的输出编码（Windows平台）
if (process.platform === 'win32') {
  const { execSync } = require('child_process');
  try {
    execSync('chcp 65001', { stdio: 'ignore' }); // 设置为UTF-8编码
  } catch (e) {
    // 忽略错误
  }
}

// 日志记录
function log(level, message) {
  const timestamp = new Date().toISOString();
  // 确保消息是UTF-8编码的字符串
  const utf8Message = Buffer.from(message, 'utf8').toString('utf8');
  console[level](`[${timestamp}][ScriptEngine][${level.toUpperCase()}] ${utf8Message}`);
}

// 保存主窗口引用
let mainWindow = null;

class ScriptEngine {
  constructor() {
    this.scriptsDir = path.join(app.getPath('userData'), 'user_scripts', 'scripts');
    this.runningScripts = new Map();
    
    // 初始化IPC监听器
    this.initializeIpcHandlers();
    
    log('info', `初始化完成，脚本目录: ${this.scriptsDir}`);
  }
  
  setMainWindow(window) {
    mainWindow = window;
    log('info', '主窗口引用已设置');
  }
  
  /**
   * 向渲染进程发送日志信息
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {string} executionId - 执行ID（可选）
   */
  sendLogToRenderer(level, message, executionId = null) {
    // 使用全局 console.log 进行 scriptEngine 内部调试
    // console.log(`[ScriptEngine DEBUG] sendLogToRenderer CALLED. Level: ${level}, ExecutionId: ${executionId}, Message (first 100 chars): ${String(message).substring(0,100)}`);

    if (!mainWindow) {
      // console.log('[ScriptEngine DEBUG] sendLogToRenderer: mainWindow is NULL. Aborting.');
      return;
    }
    if (mainWindow.isDestroyed()) {
      // console.log('[ScriptEngine DEBUG] sendLogToRenderer: mainWindow is DESTROYED. Aborting.');
      return;
    }
    if (!mainWindow.webContents) {
      // console.log('[ScriptEngine DEBUG] sendLogToRenderer: mainWindow.webContents is NULL. Aborting.');
      return;
    } 
    if (mainWindow.webContents.isDestroyed()) {
        // console.log('[ScriptEngine DEBUG] sendLogToRenderer: mainWindow.webContents is DESTROYED. Aborting.');
        return;
    }

    try {
      const safeMessage = typeof message === 'string' ? 
        message :
        (typeof message === 'object' ? 
          JSON.stringify(message, (key, value) => {
            if (key === 'parent' || key === 'children' || key === '_events' || key === '_eventsCount') {
              return '[循环引用]';
            }
            return value;
          }) : 
          String(message));
      
      // console.log(`[ScriptEngine DEBUG] Attempting to send to renderer via webContents.send: script-log`);
      mainWindow.webContents.send('script-log', { 
        level, 
        message: safeMessage,
        timestamp: new Date().toISOString(),
        executionId: executionId
      });
      // console.log(`[ScriptEngine DEBUG] webContents.send called successfully for script-log.`);
    } catch (error) {
      // 使用全局 console.error 打印错误
      console.error('[ScriptEngine] 向渲染进程发送日志失败 (Caught in sendLogToRenderer):', error); // 保留这个错误，但移除 DEBUG 标记
    }
  }
  
  initializeIpcHandlers() {
    // 获取可用脚本列表
    ipcMain.handle('get-available-scripts', async () => {
      try {
        log('info', '接收到获取脚本列表请求');
        const scripts = await this.getAvailableScripts();
        log('info', `获取到${scripts.length}个脚本`);
        
        // 添加详细日志以便调试
        const scriptNames = scripts.map(s => s.name).join(', ');
        log('info', `脚本列表: ${scriptNames}`);

        // 确保返回的对象格式正确且可序列化
        const response = { 
          success: true, 
          data: scripts 
        };
        
        // 记录返回结果
        log('info', `返回响应: success=${response.success}, 数据条数=${response.data.length}`);
        
        return response;
      } catch (error) {
        log('error', `获取脚本列表失败: ${error.message}`);
        return { success: false, error: error.message };
      }
    });
    
    // 运行脚本
    ipcMain.handle('run-script', async (event, scriptId, selectedWallets, config, proxyConfig) => {
      try {
        log('info', `运行脚本: ${scriptId}，钱包数: ${selectedWallets?.length}, 配置: ${JSON.stringify(config)}, 代理: ${proxyConfig}`);
        const result = await this.runScript(scriptId, { selectedWallets, config, proxyConfig });
        return { success: true, data: result };
      } catch (error) {
        log('error', `运行脚本失败: ${scriptId} - ${error.message}`);
        return { success: false, error: error.message };
      }
    });
    
    // 停止脚本
    ipcMain.handle('stop-script', async (event, executionId) => {
      try {
        log('info', `停止脚本: ${executionId}`);
        await this.stopScript(executionId);
        return { success: true };
      } catch (error) {
        log('error', `停止脚本失败: ${executionId} - ${error.message}`);
        return { success: false, error: error.message };
      }
    });
    
    // 获取运行中的脚本
    ipcMain.handle('get-running-scripts', () => {
      try {
        log('info', '获取运行中的脚本');
        const runningScripts = Array.from(this.runningScripts.entries()).map(([id, script]) => ({
          id,
          name: script.name,
          status: script.status
        }));
        return { success: true, data: runningScripts };
      } catch (error) {
        log('error', `获取运行中脚本失败: ${error.message}`);
        return { success: false, error: error.message };
      }
    });
  }
  
  async getAvailableScripts() {
    try {
      // 确保脚本目录存在
      if (!fs.existsSync(this.scriptsDir)) {
        log('error', `脚本目录不存在: ${this.scriptsDir}`);
        return [];
      }
      
      // 读取脚本目录
      const files = fs.readdirSync(this.scriptsDir);
      const scripts = [];
      
      for (const file of files) {
        if (file.endsWith('.js')) {
          try {
            const filePath = path.join(this.scriptsDir, file);
            const scriptContent = fs.readFileSync(filePath, { encoding: 'utf8' });
            
            // 尝试获取脚本配置
            try {
              delete require.cache[require.resolve(filePath)];
              const scriptModule = require(filePath);
              let metadata = null;
              
              if (typeof scriptModule.getConfig === 'function') {
                try {
                  metadata = scriptModule.getConfig();
                  log('info', `成功加载脚本配置: ${file}`);
                } catch (configError) {
                  log('error', `获取脚本配置失败: ${file} - ${configError.message}`);
                }
              }
              
              if (metadata) {
                // 确保metadata是可序列化的
                const safeMetadata = JSON.parse(JSON.stringify(metadata));
                
                scripts.push({
                  id: safeMetadata.id || path.basename(file, '.js'),
                  name: safeMetadata.name || path.basename(file, '.js'),
                  description: safeMetadata.description || '暂无描述',
                  fileName: file,
                  filePath: filePath,
                  category: safeMetadata.category || '未分类',
                  icon: safeMetadata.icon || 'code',
                  imageUrl: safeMetadata.imageUrl || null,
                  // 将重要字段提升到根级别
                  requires: safeMetadata.requires || { wallets: true }, // 默认需要钱包
                  requiredModules: safeMetadata.requiredModules || [],
                  metadata: safeMetadata
                });
              } else {
                scripts.push({
                  id: path.basename(file, '.js'),
                  name: path.basename(file, '.js'),
                  description: '暂无描述',
                  fileName: file,
                  filePath: filePath,
                  category: '未分类',
                  icon: 'code',
                  metadata: null
                });
              }
            } catch (requireError) {
              log('error', `加载脚本失败 (require): ${file} - ${requireError.message}`);
              
              // 即使require失败，我们仍然添加基本信息
              scripts.push({
                id: path.basename(file, '.js'),
                name: path.basename(file, '.js'),
                description: '加载脚本失败，请检查语法',
                fileName: file,
                filePath: filePath,
                category: '未分类',
                icon: 'exclamation-triangle',
                error: requireError.message
              });
            }
          } catch (error) {
            log('error', `读取脚本失败: ${file} - ${error.message}`);
          }
        }
      }
      
      return scripts;
    } catch (error) {
      log('error', `获取可用脚本列表失败: ${error.message}`);
      throw error;
    }
  }
  
  async runScript(scriptId, executionParams = {}) {
    const { selectedWallets: originalSelectedWallets, config, proxyConfig } = executionParams;
    let processedWallets = [];
    let executionId = null;

    try {
      const scripts = await this.getAvailableScripts();
      const script = scripts.find(s => s.id === scriptId);
      
      if (!script) {
        throw new Error(`找不到脚本: ${scriptId}`);
      }

      executionId = Date.now().toString() + '_' + Math.random().toString(36).substring(2, 7);
      this.sendLogToRenderer('info', `开始为脚本 ${scriptId} (执行ID: ${executionId}) 处理参数和环境...`, executionId);

      // 处理钱包数据
      if (originalSelectedWallets && originalSelectedWallets.length > 0) {
        const walletIds = originalSelectedWallets.map(w => {
          if (typeof w === 'object' && w !== null && w.id) {
            return w.id;
          } else if (typeof w === 'string' || typeof w === 'number') { 
            return w;
          }
          this.sendLogToRenderer('warning', `脚本 ${scriptId} 收到的 selectedWallets 包含无效条目: ${JSON.stringify(w)}`, executionId);
          return null;
        }).filter(id => id !== null);

        if (walletIds.length > 0) {
          this.sendLogToRenderer('info', `脚本 ${scriptId} 正在为钱包ID列表 [${walletIds.join(', ')}] 获取详细信息并解密私钥...`, executionId);
          const walletsFromDb = await db.getWalletsByIds(db.db, walletIds);
          if (walletsFromDb && walletsFromDb.length > 0) {
            for (const wallet of walletsFromDb) {
              let decryptedPrivateKey = null;
              if (wallet.encryptedPrivateKey) {
                if (cryptoService.isUnlocked()) {
                  try {
                    decryptedPrivateKey = cryptoService.decryptWithSessionKey(wallet.encryptedPrivateKey);
                    this.sendLogToRenderer('info', `钱包 ${wallet.address} (ID: ${wallet.id}) 的私钥已解密。`, executionId);
                  } catch (decryptError) {
                    this.sendLogToRenderer('error', `解密钱包 ${wallet.address} (ID: ${wallet.id}) 的私钥失败: ${decryptError.message}`, executionId);
                  }
                } else {
                  this.sendLogToRenderer('warning', `应用未解锁，无法解密钱包 ${wallet.address} (ID: ${wallet.id}) 的私钥。`, executionId);
                }
              } else {
                this.sendLogToRenderer('info', `钱包 ${wallet.address} (ID: ${wallet.id}) 没有存储加密私钥。`, executionId);
              }
              processedWallets.push({
                id: wallet.id,
                address: wallet.address,
                name: wallet.name,
                privateKey: decryptedPrivateKey 
              });
            }
            this.sendLogToRenderer('info', `将为脚本 ${scriptId} 执行的钱包账户列表: ${JSON.stringify(processedWallets.map(w => {
              const safeWallet = { ...w };
              if (safeWallet.privateKey) {
                safeWallet.privateKey = safeWallet.privateKey.substring(0, 8) + '...[隐藏]';
              }
              return safeWallet;
            }))}`, executionId);
          } else {
            this.sendLogToRenderer('warning', `未能从数据库为ID列表 [${walletIds.join(', ')}] 获取到任何钱包信息。`, executionId);
          }
        } else {
          this.sendLogToRenderer('warning', `脚本 ${scriptId} 的 selectedWallets 处理后得到空的ID列表。`, executionId);
        }
      } else {
        this.sendLogToRenderer('info', `脚本 ${scriptId} 执行时未选择任何钱包，或者 selectedWallets 为空。`, executionId);
      }
      
      let fullProxyInfo = null;
      if (proxyConfig) {
        if (typeof proxyConfig === 'object' && proxyConfig.strategy && proxyConfig.proxies) {
          fullProxyInfo = {
            strategy: proxyConfig.strategy,
            proxies: proxyConfig.proxies
          };
          this.sendLogToRenderer('info', `脚本 ${scriptId} 使用批量代理配置: ${proxyConfig.strategy} 策略，${proxyConfig.proxies.length} 个代理`, executionId);
        } else if (typeof proxyConfig === 'string' || typeof proxyConfig === 'number') {
          try {
            const proxyDetails = await db.getProxyById(db.db, parseInt(proxyConfig, 10));
            if (proxyDetails) {
              const protocol = proxyDetails.type ? proxyDetails.type.toLowerCase() : 'http';
              const host = proxyDetails.host;
              const port = parseInt(proxyDetails.port, 10);
              let constructedUrl = `${protocol}://`;
              if (proxyDetails.username && proxyDetails.password) {
                let decryptedPassword = proxyDetails.password; 
                if (cryptoService.isUnlocked()) {
                  try {
                    decryptedPassword = cryptoService.decryptWithSessionKey(proxyDetails.password);
                    this.sendLogToRenderer('info', `代理 ${proxyDetails.host}:${proxyDetails.port} 的密码已解密。`);
                  } catch (decryptErr) {
                    this.sendLogToRenderer('error', `解密代理 ${proxyDetails.host}:${proxyDetails.port} 的密码失败: ${decryptErr.message}. 脚本将收到原始(加密)密码。`);
                  }
                } else {
                  this.sendLogToRenderer('warning', `应用未解锁，无法解密代理 ${proxyDetails.host}:${proxyDetails.port} 的密码。脚本将收到原始(加密)密码。`);
                }
                constructedUrl += `${encodeURIComponent(proxyDetails.username)}:${encodeURIComponent(decryptedPassword)}@`;
              }
              constructedUrl += `${host}:${port}`;
              fullProxyInfo = {
                host: host,
                port: port,
                protocol: protocol,
                url: constructedUrl, 
              };
              if (proxyDetails.username && proxyDetails.password) {
                let authPassword = proxyDetails.password; 
                if (cryptoService.isUnlocked()) {
                  try {
                    authPassword = cryptoService.decryptWithSessionKey(proxyDetails.password);
                  } catch (e) { /*之前已记录*/ }
                }
                fullProxyInfo.auth = {
                  username: proxyDetails.username,
                  password: authPassword 
                };
                if (authPassword !== proxyDetails.password) {
                  this.sendLogToRenderer('info', `脚本 ${scriptId} 使用的代理 ${proxyDetails.host}:${proxyDetails.port} 的认证密码已提供(解密)。`);
                } else {
                  this.sendLogToRenderer('warning', `脚本 ${scriptId} 使用的代理 ${proxyDetails.host}:${proxyDetails.port} 的认证密码为原始(加密)值。`);
                }
              } else if (proxyDetails.username) {
                this.sendLogToRenderer('warning', `代理 ${proxyDetails.host}:${proxyDetails.port} 有用户名但密码为空。将不使用认证信息。`);
              }
              this.sendLogToRenderer('info', `脚本 ${scriptId} 将使用代理配置: ${JSON.stringify(fullProxyInfo)}`);
            } else {
              this.sendLogToRenderer('warning', `未能从数据库找到 ID 为 ${proxyConfig} 的代理详情。脚本将不使用代理。`);
            }
          } catch (dbError) {
            this.sendLogToRenderer('error', `查询代理 ID ${proxyConfig} 详情时出错: ${dbError.message}。脚本将不使用代理。`);
          }
        }
      }

      const scriptMetadata = script.metadata || {};
      const declaredModules = scriptMetadata.requiredModules || [];
      const coreAllowedModules = ['crypto', 'path', 'url', 'util', 'ethers'];
      const allowedModulesForThisScript = [...new Set([...coreAllowedModules, ...declaredModules])];
      
      // DEBUG: Log allowed modules for this script
      console.log(`[ScriptEngine DEBUG] Allowed modules for script ${scriptId} (ExecutionID: ${executionId}):`, allowedModulesForThisScript);
      this.sendLogToRenderer('info', `脚本 ${scriptId} 允许加载的模块: ${allowedModulesForThisScript.join(', ')}`, executionId);

      const engineSendLog = this.sendLogToRenderer.bind(this);
      const scriptLoggerInstance = loggerModule.createLogger({
        prefix: `[${script.name}(${executionId})] `,
        sendFunction: (level, messageWithIcon) => {
          engineSendLog(level, messageWithIcon, executionId);
        }
      });

      const boundScriptLogger = {
        info: scriptLoggerInstance.info.bind(scriptLoggerInstance),
        success: scriptLoggerInstance.success.bind(scriptLoggerInstance),
        warn: scriptLoggerInstance.warn.bind(scriptLoggerInstance),
        error: scriptLoggerInstance.error.bind(scriptLoggerInstance),
      };

      const sandbox = {
        console: { 
          log: (...args) => boundScriptLogger.info(util.format(...args)), 
          info: (...args) => boundScriptLogger.info(util.format(...args)),
          warn: (...args) => boundScriptLogger.warn(util.format(...args)),
          error: (...args) => boundScriptLogger.error(util.format(...args)),
          success: (...args) => boundScriptLogger.success(util.format(...args)), 
          debug: (...args) => boundScriptLogger.info(util.format(...args)), 
        },
        require: (moduleName) => {
          // DEBUG: Log every require attempt from sandbox
          console.log(`[ScriptEngine SANDBOX REQUIRE] Script ${scriptId} (ExecutionID: ${executionId}) is attempting to require: '${moduleName}'`);

          if (moduleName === 'ethers') {
            console.log(`[ScriptEngine REQUIRE DEBUG] Attempting to require 'ethers' for ExecutionID: ${executionId}. It IS in allowedModulesForThisScript (verified by check below).`);
            // Double check allowance (should be redundant if outer check is correct)
            if (!allowedModulesForThisScript.includes(moduleName)) {
                const notAllowedMsg = `[ScriptEngine REQUIRE CRITICAL] 'ethers' is NOT in allowedModulesForThisScript for ${scriptId}, though it should be! Investigate getConfig or coreAllowedModules.`;
                console.error(notAllowedMsg);
                this.sendLogToRenderer('error', notAllowedMsg, executionId);
                throw new Error(notAllowedMsg);
            }
            try {
              const ethersModule = require('ethers'); // Main process require
              console.log(`[ScriptEngine REQUIRE DEBUG] Main process require('ethers') result type: ${typeof ethersModule}, Keys: ${typeof ethersModule === 'object' && ethersModule !== null ? Object.keys(ethersModule).join(', ') : 'N/A'}. ExecutionID: ${executionId}`);
              if (typeof ethersModule === 'undefined') {
                  const undefinedMsg = `[ScriptEngine REQUIRE CRITICAL] Main process require('ethers') returned undefined! ExecutionID: ${executionId}`;
                  console.error(undefinedMsg);
                  this.sendLogToRenderer('error', undefinedMsg, executionId);
                  // It's better to throw an error here so the script knows something is wrong
                  throw new Error("Failed to load 'ethers' module properly in ScriptEngine."); 
              }
              return ethersModule;
            } catch (e) {
              const loadFailedMsg = `[ScriptEngine REQUIRE DEBUG] Main process require('ethers') FAILED for ExecutionID: ${executionId}. Error: ${e.message}`;
              console.error(loadFailedMsg, e);
              this.sendLogToRenderer('error', loadFailedMsg, executionId);
              throw e; // Re-throw to be caught by script's try-catch or engine's outer try-catch
            }
          }
          // Original require logic for other modules
          if (allowedModulesForThisScript.includes(moduleName)) {
            try {
              return require(moduleName);
            } catch (e) {
              if (e.code === 'MODULE_NOT_FOUND' && !coreAllowedModules.includes(moduleName)) {
                const errorMessage = `脚本 ${scriptId} 尝试加载模块 '${moduleName}'，但该模块未安装或未在项目 package.json 中正确声明依赖。请运行 'npm install ${moduleName}' 或将其添加到 package.json。`;
                this.sendLogToRenderer('error', errorMessage, executionId);
                throw new Error(errorMessage);
              } else if (e.code === 'MODULE_NOT_FOUND') {
                const errorMessage = `脚本 ${scriptId} 尝试加载核心模块 '${moduleName}' 失败，这通常不应发生。错误: ${e.message}`;
                this.sendLogToRenderer('error', errorMessage, executionId);
                throw new Error(errorMessage);
              }
              const errorMessage = `脚本 ${scriptId} 加载模块 '${moduleName}' 时发生内部错误: ${e.message}`;
              this.sendLogToRenderer('error', errorMessage, executionId);
              throw new Error(errorMessage);
            }
          }
          const errorMessage = `模块 '${moduleName}' 未在脚本元数据中声明或不被允许在此脚本 (${scriptId}) 中使用。`;
          this.sendLogToRenderer('error', errorMessage, executionId);
          throw new Error(errorMessage);
        },
        process: {
            env: {}
        },
        __dirname: path.dirname(script.filePath),
        __filename: script.filePath,
        module: { exports: {} },
        exports: {},
        context: {
          scriptId: scriptId,
          executionId: executionId,
          wallets: processedWallets,
          config: config || {},
          proxy: fullProxyInfo,
          storage: {
            _data: {},
            setItem: (key, value) => { sandbox.context.storage._data[key] = value; },
            getItem: (key) => sandbox.context.storage._data[key],
            removeItem: (key) => { delete sandbox.context.storage._data[key]; },
            clear: () => { sandbox.context.storage._data = {}; }
          },
          secrets: {
            get: async (key) => {
              this.sendLogToRenderer('info', `脚本 ${scriptId} 请求密钥: ${key}`, executionId);
              return `secret_for_${key}`;
            }
          },
          utils: {
            delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
            logger: boundScriptLogger,
          },
          http: require('axios'), 
          onStop: null, 
        },
        __script_result__: null,
      };
      
      this.sendLogToRenderer('info', `为脚本 ${script.name} (执行ID: ${executionId}) 创建沙箱环境并准备执行...`, executionId);

      const vm = new VM({
        timeout: scriptMetadata.timeout || 600000, 
        sandbox: sandbox,
        require: {
          external: true,
          builtin: allowedModulesForThisScript,
          root: path.dirname(script.filePath), 
        }
      });

      this.runningScripts.set(executionId, { 
        id: scriptId, 
        name: script.name, 
        vm, 
        status: 'running',
        stop: () => { 
          try {
            if (typeof sandbox.context.onStop === 'function') {
              sandbox.context.onStop(); 
            }
            this.sendLogToRenderer('info', `脚本 ${script.name} (执行ID: ${executionId}) 被请求停止。`, executionId);
            this.runningScripts.delete(executionId);
          } catch (e) {
            this.sendLogToRenderer('error', `停止脚本 ${script.name} (执行ID: ${executionId}) 时出错: ${e.message}`, executionId);
          }
        } 
      });

      this.sendLogToRenderer('info', `即将执行脚本: ${script.name} (路径: ${script.filePath})`, executionId);
      
      // 在 vm.run 之前添加调试日志
      console.log(`[ScriptEngine RUN DEBUG] >>> BEFORE vm.run for ${script.name}. ExecutionID: ${executionId}. ScriptPath: ${script.filePath}. Timestamp: ${new Date().toISOString()}`);

      // Introduce a delay before running the script in the VM
      console.log(`[ScriptEngine DELAY] Introducing 200ms delay before vm.runInContext for ${scriptId}, ExecutionID: ${executionId}. Timestamp: ${new Date().toISOString()}`);
      await new Promise(resolve => setTimeout(resolve, 200)); // 200ms delay
      console.log(`[ScriptEngine DELAY] Delay finished, proceeding with vm.runInContext for ${scriptId}, ExecutionID: ${executionId}. Timestamp: ${new Date().toISOString()}`);

      // Corrected: Use vm.run with the script content. The sandbox is already part of the vm instance.
      const scriptContent = fs.readFileSync(script.filePath, 'utf-8');
      const scriptResult = await vm.run(scriptContent, script.filePath);

      // 在 vm.run 之后添加调试日志
      console.log(`[ScriptEngine RUN DEBUG] <<< AFTER vm.run for ${script.name}. ExecutionID: ${executionId}. Timestamp: ${new Date().toISOString()}`);
      
      log('info', `脚本 ${scriptId} 导出的内容: ${Object.keys(scriptResult || {}).join(', ')}`);
      if (scriptResult && typeof scriptResult.main === 'function') {
          log('info', `脚本 ${scriptId} 找到 main 函数`);
      } else {
          log('error', `脚本 ${scriptId} 没有找到 main 函数，导出的内容类型: ${typeof scriptResult}`);
      }
      
      if (typeof scriptResult.main === 'function') {
        this.sendLogToRenderer('info', `开始执行脚本 ${script.name} (ID: ${executionId})`, executionId);
        
        scriptResult.main(sandbox.context)
          .then(result => {
            this.sendLogToRenderer('success', `脚本 ${script.name} (ID: ${executionId}) 执行完成`, executionId);
            if (this.runningScripts.has(executionId)) {
              const scriptInfo = this.runningScripts.get(executionId);
              scriptInfo.status = 'completed';
              this.runningScripts.set(executionId, scriptInfo);
            }
            
            let safeResult;
            try {
              safeResult = JSON.parse(JSON.stringify(result, (key, value) => {
                if (key === 'parent' || key === 'children' || key === '_events' || key === '_eventsCount') {
                  return '[循环引用]';
                }
                if (typeof value === 'bigint') {
                  return value.toString() + 'n';
                }
                return value;
              }));
            } catch (serializeError) {
              console.error('序列化脚本结果失败:', serializeError);
              safeResult = { 
                success: true, 
                message: '脚本执行完成，但结果无法完全序列化', 
                partial: String(result).substring(0, 500) + '...'
              };
            }
            
            if (mainWindow && !mainWindow.isDestroyed()) {
              try {
                mainWindow.webContents.send('script-completed', { 
                  executionId, 
                  result: safeResult 
                });
              } catch (sendError) {
                console.error('发送脚本完成事件失败:', sendError);
                this.sendLogToRenderer('warning', `脚本 ${script.name} (ID: ${executionId}) 执行完成，但结果传递失败`, executionId);
              }
            }
          })
          .catch(error => {
            this.sendLogToRenderer('error', `脚本 ${script.name} (ID: ${executionId}) 执行出错: ${error.message}`, executionId);
            if (this.runningScripts.has(executionId)) {
              const scriptInfo = this.runningScripts.get(executionId);
              scriptInfo.status = 'failed';
              this.runningScripts.set(executionId, scriptInfo);
            }
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('script-error', { 
                executionId, 
                error: error.message,
                stack: error.stack
              });
            }
          });
        
        return { executionId, status: 'running' };
      } else {
        const noMainFuncError = `脚本 ${script.id} (路径: ${script.filePath}) 没有找到可执行的 main 函数。`;
        this.sendLogToRenderer('error', noMainFuncError, executionId);
        throw new Error(noMainFuncError);
      }
    } catch (error) {
      log('error', `执行脚本 ${scriptId || '未知脚本'} (执行ID: ${executionId || '未知'}) 失败: ${error.message}`);
      this.sendLogToRenderer('error', `执行脚本 ${scriptId || '未知脚本'} (执行ID: ${executionId || '未知'}) 失败: ${error.message}`, executionId); 
      throw error;
    }
  }
  
  async stopScript(executionId) {
    try {
      const script = this.runningScripts.get(executionId);
      if (!script) {
        throw new Error(`找不到运行中的脚本: ${executionId}`);
      }
      
      // 之前这里有 freeze 调用，但 vm2 的 VM 实例没有 freeze 方法。
      // 调用脚本内部注册的 onStop (如果存在)
      if (script.vm && script.vm.sandbox && script.vm.sandbox.context && typeof script.vm.sandbox.context.onStop === 'function') {
        try {
            script.vm.sandbox.context.onStop();
            this.sendLogToRenderer('info', `脚本 ${script.name} (ID: ${executionId}) 的 onStop 清理函数已调用。`, executionId);
        } catch (onStopError) {
            this.sendLogToRenderer('error', `脚本 ${script.name} (ID: ${executionId}) 的 onStop 函数执行出错: ${onStopError.message}`, executionId);
        }
      }

      script.status = 'stopped'; // 更新状态
      this.runningScripts.delete(executionId); // 从运行列表中移除
      
      this.sendLogToRenderer('warn', `脚本 ${script.name} (ID: ${executionId}) 已停止。`, executionId);
      return true;
    } catch (error) {
      log('error', `停止脚本 ${executionId} 失败: ${error.message}`);
      this.sendLogToRenderer('error', `停止脚本 ${executionId} 失败: ${error.message}`, executionId);
      throw error;
    }
  }
}

const scriptEngine = new ScriptEngine();
module.exports = scriptEngine;