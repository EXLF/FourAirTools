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
    if (!mainWindow || mainWindow.isDestroyed()) return;
    
    try {
      // 确保message是字符串类型，防止序列化错误
      const safeMessage = typeof message === 'string' ? 
        message : 
        (typeof message === 'object' ? 
          JSON.stringify(message, (key, value) => {
            // 处理可能导致循环引用的属性
            if (key === 'parent' || key === 'children' || key === '_events' || key === '_eventsCount') {
              return '[循环引用]';
            }
            return value;
          }) : 
          String(message));
      
      // 日志信息需要安全序列化后发送，包含执行ID
      mainWindow.webContents.send('script-log', { 
        level, 
        message: safeMessage,
        timestamp: new Date().toISOString(),
        executionId: executionId // 添加执行ID
      });
    } catch (error) {
      console.error('向渲染进程发送日志失败:', error);
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
    let executionId = null; // 声明executionId变量

    try {
      const scripts = await this.getAvailableScripts();
      const script = scripts.find(s => s.id === scriptId);
      
      if (!script) {
        throw new Error(`找不到脚本: ${scriptId}`);
      }

      // 处理钱包数据
      if (originalSelectedWallets && originalSelectedWallets.length > 0) {
        // 假设 originalSelectedWallets 是一个对象数组，每个对象至少有 id 字段
        // 或者它本身就是一个 ID 数组。我们需要能兼容处理。
        // 为了统一，我们先提取所有钱包的 ID。
        const walletIds = originalSelectedWallets.map(w => {
          if (typeof w === 'object' && w !== null && w.id) {
            return w.id;
          } else if (typeof w === 'string' || typeof w === 'number') { // 如果直接是ID数组
            return w;
          }
          this.sendLogToRenderer('warning', `脚本 ${scriptId} 收到的 selectedWallets 包含无效条目: ${JSON.stringify(w)}`);
          return null;
        }).filter(id => id !== null);

        if (walletIds.length > 0) {
          // 先生成执行ID，这样后续的日志都能包含执行ID
          executionId = Date.now().toString();
          
          this.sendLogToRenderer('info', `脚本 ${scriptId} 正在为钱包ID列表 [${walletIds.join(', ')}] 获取详细信息并解密私钥...`, executionId);
          // 从数据库获取完整的钱包信息
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
              // 构建传递给脚本的钱包对象
              processedWallets.push({
                id: wallet.id,
                address: wallet.address,
                name: wallet.name,
                // ... 其他需要传递给脚本的钱包属性
                privateKey: decryptedPrivateKey // 添加解密后的私钥
              });
            }
            
            // 在这里添加我们的显式日志，循环结束但if块尚未结束的位置
            this.sendLogToRenderer('info', `将为脚本 ${scriptId} 执行的钱包账户列表: ${JSON.stringify(processedWallets.map(w => {
              // 创建安全版本，隐藏私钥
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
            // 如果没有有效的钱包ID，生成执行ID
            if (!executionId) {
              executionId = Date.now().toString();
            }
            this.sendLogToRenderer('warning', `脚本 ${scriptId} 的 selectedWallets 处理后得到空的ID列表。`, executionId);
        }
      } else {
        // 如果没有选择钱包，生成执行ID
        executionId = Date.now().toString();
        this.sendLogToRenderer('info', `脚本 ${scriptId} 执行时未选择任何钱包，或者 selectedWallets 为空。`, executionId);
      }
      
      // 确保executionId存在
      if (!executionId) {
        executionId = Date.now().toString();
      }

      // --- 新增：获取完整的代理信息 ---
      let fullProxyInfo = null;
      if (proxyConfig) {
        // 检查是否是批量代理配置对象
        if (typeof proxyConfig === 'object' && proxyConfig.strategy && proxyConfig.proxies) {
          // 批量代理配置
          fullProxyInfo = {
            strategy: proxyConfig.strategy,
            proxies: proxyConfig.proxies
          };
          this.sendLogToRenderer('info', `脚本 ${scriptId} 使用批量代理配置: ${proxyConfig.strategy} 策略，${proxyConfig.proxies.length} 个代理`, executionId);
        } else if (typeof proxyConfig === 'string' || typeof proxyConfig === 'number') {
          // 单个代理ID
          try {
            const proxyDetails = await db.getProxyById(db.db, parseInt(proxyConfig, 10)); // 确保ID是数字
            if (proxyDetails) {
            const protocol = proxyDetails.type ? proxyDetails.type.toLowerCase() : 'http';
            const host = proxyDetails.host;
            const port = parseInt(proxyDetails.port, 10);
            let constructedUrl = `${protocol}://`;
            if (proxyDetails.username && proxyDetails.password) {
              // 确保用户名和密码进行URL编码，以防包含特殊字符
              // 同时，解密密码（如果应用已解锁）
              let decryptedPassword = proxyDetails.password; // 默认为数据库中的值（加密的）
              if (cryptoService.isUnlocked()) {
                try {
                  decryptedPassword = cryptoService.decryptWithSessionKey(proxyDetails.password);
                  this.sendLogToRenderer('info', `代理 ${proxyDetails.host}:${proxyDetails.port} 的密码已解密。`);
                } catch (decryptErr) {
                  this.sendLogToRenderer('error', `解密代理 ${proxyDetails.host}:${proxyDetails.port} 的密码失败: ${decryptErr.message}. 脚本将收到原始(加密)密码。`);
                  // decryptedPassword 保持为加密状态
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
            // 处理认证信息, 提供解密后的密码给脚本 (如果成功解密)
            if (proxyDetails.username && proxyDetails.password) {
                let authPassword = proxyDetails.password; // 默认为加密值
                // 再次尝试解密，确保 auth.password 是明文（如果可能）
                if (cryptoService.isUnlocked()) {
                    try {
                        authPassword = cryptoService.decryptWithSessionKey(proxyDetails.password);
                    } catch (e) { /* 之前已记录错误，这里保持 authPassword 为加密值 */ }
                }

              fullProxyInfo.auth = {
                username: proxyDetails.username,
                password: authPassword // 提供解密后的密码（如果成功）或原始加密密码
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
      // --- 结束新增 ---

      // 方案一：脚本声明其依赖
      const scriptMetadata = script.metadata || {}; // getConfig() 的结果应存在 script.metadata 中
      const declaredModules = scriptMetadata.requiredModules || [];
      
      // 核心允许的模块 (Node.js 内置模块等)
      const coreAllowedModules = ['crypto', 'path', 'url', 'util']; 

      // 本次执行允许的模块 = 核心模块 + 脚本声明的模块
      const allowedModulesForThisScript = [...new Set([...coreAllowedModules, ...declaredModules])];
      
      this.sendLogToRenderer('info', `脚本 ${scriptId} 允许加载的模块: ${allowedModulesForThisScript.join(', ')}`, executionId);

      const sandbox = {
        console: {
          log: (...args) => this.sendLogToRenderer('info', util.format(...args), executionId),
          info: (...args) => this.sendLogToRenderer('info', util.format(...args), executionId),
          warn: (...args) => this.sendLogToRenderer('warning', util.format(...args), executionId),
          error: (...args) => this.sendLogToRenderer('error', util.format(...args), executionId),
          success: (...args) => this.sendLogToRenderer('success', util.format(...args), executionId),
        },
        require: (moduleName) => {
          if (allowedModulesForThisScript.includes(moduleName)) {
            try {
              return require(moduleName);
            } catch (e) {
              if (e.code === 'MODULE_NOT_FOUND' && !coreAllowedModules.includes(moduleName)) {
                const errorMessage = `脚本 ${scriptId} 尝试加载模块 '${moduleName}'，但该模块未安装或未在项目 package.json 中正确声明依赖。请运行 'npm install ${moduleName}' 或将其添加到 package.json。`;
                this.sendLogToRenderer('error', errorMessage);
                throw new Error(errorMessage);
              } else if (e.code === 'MODULE_NOT_FOUND') {
                const errorMessage = `脚本 ${scriptId} 尝试加载核心模块 '${moduleName}' 失败，这通常不应发生。错误: ${e.message}`;
                this.sendLogToRenderer('error', errorMessage);
                throw new Error(errorMessage);
              }
              const errorMessage = `脚本 ${scriptId} 加载模块 '${moduleName}' 时发生内部错误: ${e.message}`;
              this.sendLogToRenderer('error', errorMessage);
              throw new Error(errorMessage);
            }
          }
          const errorMessage = `模块 '${moduleName}' 未在脚本元数据中声明或不被允许在此脚本 (${scriptId}) 中使用。`;
          this.sendLogToRenderer('error', errorMessage);
          throw new Error(errorMessage);
        },
        process: {
            env: {
                // NODE_ENV: process.env.NODE_ENV, // 示例：只暴露 NODE_ENV
                // API_KEY_FOR_SCRIPT: process.env.SOME_SPECIFIC_API_KEY // 示例：暴露特定的API密钥
                // 或者通过 context.config 传入
            }
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
              this.sendLogToRenderer('info', `脚本 ${scriptId} 请求密钥: ${key}`);
              return `secret_for_${key}`;
            }
          },
          utils: {
            delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
            logToUI: (message, level = 'info') => {
              const validLevels = ['info', 'success', 'warning', 'error'];
              const normalizedLevel = validLevels.includes(String(level).toLowerCase()) ? String(level).toLowerCase() : 'info';
              this.sendLogToRenderer(normalizedLevel, message, sandbox.context.executionId);
            },
          },
          http: require('axios'),
          onStop: null,
        },
        __script_result__: null,
      };
      
      try {
        const vm2Instance = new VM({
          console: 'inherit',
          sandbox: sandbox,
          require: {
            external: true,
            builtin: ['*'],
            root: './'
          }
        });
        
        const scriptContent = fs.readFileSync(script.filePath, { encoding: 'utf8' });
        
        // 调试：打印脚本内容的前100个字符
        log('info', `脚本 ${scriptId} 内容预览: ${scriptContent.substring(0, 100)}...`);
        
        const wrappedScript = `
          (function(module, exports, require, __dirname, __filename, context) {
            ${scriptContent}
            return module.exports;
          })(module, exports, require, __dirname, __filename, context);
        `;
        
        const scriptModule = vm2Instance.run(wrappedScript, script.filePath);
        
        // 调试：检查导出的内容
        log('info', `脚本 ${scriptId} 导出的内容: ${Object.keys(scriptModule || {}).join(', ')}`);
        if (scriptModule && typeof scriptModule.main === 'function') {
            log('info', `脚本 ${scriptId} 找到 main 函数`);
        } else {
            log('error', `脚本 ${scriptId} 没有找到 main 函数，导出的内容类型: ${typeof scriptModule}`);
        }
        
        this.runningScripts.set(executionId, {
          id: scriptId,
          name: script.name,
          instance: vm2Instance,
          status: 'running'
        });
        
        log('info', `脚本 ${scriptId} 已加载并准备执行, executionId=${executionId}`);
        
        if (typeof scriptModule.main === 'function') {
          this.sendLogToRenderer('info', `开始执行脚本: ${script.name}`);
          
          scriptModule.main(sandbox.context)
            .then(result => {
              this.sendLogToRenderer('success', `脚本执行完成: ${script.name}`);
              if (this.runningScripts.has(executionId)) {
                const scriptInfo = this.runningScripts.get(executionId);
                scriptInfo.status = 'completed';
                this.runningScripts.set(executionId, scriptInfo);
              }
              
              // 安全处理结果，避免序列化错误
              let safeResult;
              try {
                // 尝试序列化结果，移除可能导致循环引用的属性
                safeResult = JSON.parse(JSON.stringify(result, (key, value) => {
                  // 忽略可能导致循环引用的属性
                  if (key === 'parent' || key === 'children' || key === '_events' || key === '_eventsCount') {
                    return '[循环引用]';
                  }
                  // 处理可能导致序列化问题的大数字
                  if (typeof value === 'bigint') {
                    return value.toString() + 'n';
                  }
                  return value;
                }));
              } catch (serializeError) {
                console.error('序列化脚本结果失败:', serializeError);
                // 如果序列化失败，返回简化的结果
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
                  this.sendLogToRenderer('warning', '脚本执行完成，但结果传递失败');
                }
              }
            })
            .catch(error => {
              this.sendLogToRenderer('error', `脚本执行出错: ${error.message}`);
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
          throw new Error('脚本没有main函数');
        }
      } catch (vmError) {
        log('error', `脚本执行环境创建失败: ${vmError.message}`);
        // 发送错误日志到渲染器
        this.sendLogToRenderer('error', `脚本执行环境创建失败: ${vmError.message}`);
        throw new Error(`脚本执行环境创建失败: ${vmError.message}`);
      }
    } catch (error) {
      log('error', `执行脚本失败: ${error.message}`);
      // 发送错误日志到渲染器
      this.sendLogToRenderer('error', `执行脚本失败: ${error.message}`);
      throw error;
    }
  }
  
  async stopScript(executionId) {
    try {
      const script = this.runningScripts.get(executionId);
      if (!script) {
        throw new Error(`找不到运行中的脚本: ${executionId}`);
      }
      
      if (script.instance) {
        try {
          script.instance.freeze();
          log('info', `脚本 ${executionId} 已冻结`);
        } catch (freezeError) {
          log('error', `冻结脚本失败: ${freezeError.message}`);
        }
      }
      
      script.status = 'stopped';
      this.runningScripts.set(executionId, script);
      
      this.sendLogToRenderer('warn', `脚本 ${script.name} 已停止`);
      return true;
    } catch (error) {
      log('error', `停止脚本失败: ${error.message}`);
      throw error;
    }
  }
}

const scriptEngine = new ScriptEngine();

module.exports = scriptEngine; 