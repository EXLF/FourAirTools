/**
 * 脚本执行引擎 v2.0 - 安全性重构版本
 * 负责在安全沙箱环境中加载和执行用户脚本
 * 重构重点：VM2沙箱安全性、模块白名单、错误处理、日志稳定性
 */
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');
const { VM } = require('vm2');
const util = require('util');
const cryptoService = require('./core/cryptoService.js');
const db = require('./db/index.js');
const loggerModule = require(path.join(__dirname, '..', '..', 'user_scripts', 'common', 'logger.js'));

// 设置正确的输出编码（Windows平台）
if (process.platform === 'win32') {
  const { execSync } = require('child_process');
  try {
    execSync('chcp 65001', { stdio: 'ignore' });
  } catch (e) {
    // 忽略错误，继续执行
  }
}

// ==================== 安全配置常量 ====================
const SECURITY_CONFIG = {
  // VM2沙箱超时时间（默认10分钟）
  DEFAULT_TIMEOUT: 10 * 60 * 1000,
  // 最大超时时间（30分钟）
  MAX_TIMEOUT: 30 * 60 * 1000,
  // 核心允许的安全模块列表
  CORE_SAFE_MODULES: [
    // Node.js核心模块
    'crypto', 'path', 'url', 'util',
    
    // 区块链开发核心库
    'ethers', 'web3', 'web3-utils', 'bip39', 'ethereumjs-wallet',
    
    // 以太坊生态
    '@ethersproject/contracts', '@ethersproject/providers', 
    '@ethersproject/wallet', '@ethersproject/units',
    
    // Solana生态
    '@solana/web3.js',
    
    // Polkadot生态
    '@polkadot/api', '@polkadot/util', '@polkadot/util-crypto',
    
    // 数学和工具库
    'bn.js', 'big.js', 'decimal.js', 'moment', 'uuid', 'lodash',
    
    // 数据验证
    'joi', 'jsonschema', 'semver',
    
    // 异步控制
    'retry', 'p-limit', 'p-queue',
    
    // 网络请求
    'axios'
  ],
  // 绝对禁止的危险模块
  FORBIDDEN_MODULES: ['fs', 'child_process', 'os', 'cluster', 'dgram', 'dns', 'net', 'tls', 'http', 'https'],
  // 日志消息最大长度
  MAX_LOG_MESSAGE_LENGTH: 10000,
  // 脚本结果最大序列化长度
  MAX_RESULT_SIZE: 50000
};

// 安全的日志记录函数
function secureLog(level, message, executionId = null) {
  const timestamp = new Date().toISOString();
  // 限制消息长度，防止日志过载
  let safeMessage = String(message).substring(0, SECURITY_CONFIG.MAX_LOG_MESSAGE_LENGTH);
  if (message.length > SECURITY_CONFIG.MAX_LOG_MESSAGE_LENGTH) {
    safeMessage += '...[截断]';
  }
  
  // 简单的UTF-8处理
  const utf8Message = Buffer.from(safeMessage, 'utf8').toString('utf8');
  const prefix = executionId ? `[${executionId}]` : '';
  console[level](`[${timestamp}][ScriptEngine]${prefix}[${level.toUpperCase()}] ${utf8Message}`);
}

// 保存主窗口引用
let mainWindow = null;

/**
 * 安全的脚本执行引擎
 */
class SecureScriptEngine {
  constructor() {
    this.scriptsDir = path.join(app.getPath('userData'), 'user_scripts', 'scripts');
    this.runningScripts = new Map();
    this.scriptTimeouts = new Map(); // 用于跟踪脚本超时
    
    // 初始化IPC监听器
    this.initializeIpcHandlers();
    
    secureLog('info', `安全脚本引擎初始化完成，脚本目录: ${this.scriptsDir}`);
  }
  
  setMainWindow(window) {
    mainWindow = window;
    secureLog('info', '主窗口引用已设置');
  }
  
  /**
   * 安全的中文修复函数 - 只在确实需要时使用
   * @param {string} text - 待修复的文本
   * @returns {string} 修复后的文本
   */
  fixChineseText(text) {
    if (typeof text !== 'string') return text;
    
    // 只对包含特定中文乱码模式的文本进行修复
    const hasSpecificGarbledChinese = /鑴氭湰|鎵ц|閰嶇疆|鍒濆鍖|姝ｅ湪|瀹屾垚|閽卞寘|鑾峰彇|鎴愬姛|澶辫触/.test(text);
    
    if (!hasSpecificGarbledChinese) {
      return text;
    }
    
    // 使用全局映射表
    const chineseFixMap = global.chineseFixMap || {};
    let fixed = text;
    
    for (const [garbled, correct] of Object.entries(chineseFixMap)) {
        if (fixed.includes(garbled)) {
            fixed = fixed.replace(new RegExp(garbled, 'g'), correct);
        }
    }
    return fixed;
  }
  
  /**
   * 安全的日志发送到渲染进程
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   * @param {string} executionId - 执行ID
   */
  sendLogToRenderer(level, message, executionId = null) {
    if (!mainWindow || mainWindow.isDestroyed() || !mainWindow.webContents || mainWindow.webContents.isDestroyed()) {
      return;
    }

    try {
      // 安全的消息处理
      let safeMessage = this.sanitizeLogMessage(message);
      
      // 只在明确检测到中文乱码时才应用修复
      if (/鑴氭湰|鎵ц|閰嶇疆|鍒濆鍖|姝ｅ湪|瀹屾垚|閽卞寘|鑾峰彇|鎴愬姛|澶辫触/.test(safeMessage)) {
        safeMessage = this.fixChineseText(safeMessage);
      }
      
      const logData = { 
        level, 
        message: safeMessage,
        timestamp: new Date().toISOString(),
        executionId: executionId
      };
      
      mainWindow.webContents.send('script-log', logData);
    } catch (error) {
      secureLog('error', `向渲染进程发送日志失败: ${error.message}`, executionId);
    }
  }
  
  /**
   * 安全的消息净化函数
   * @param {*} message - 原始消息
   * @returns {string} 净化后的安全消息
   */
  sanitizeLogMessage(message) {
    if (typeof message === 'string') {
      // 限制长度并移除潜在危险字符
      return message.substring(0, SECURITY_CONFIG.MAX_LOG_MESSAGE_LENGTH)
                   .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ''); // 移除控制字符
    } else if (typeof message === 'object' && message !== null) {
      try {
        return JSON.stringify(message, (key, value) => {
          // 防止循环引用和敏感信息泄露
          if (key === 'parent' || key === 'children' || key === '_events' || key === '_eventsCount') {
            return '[循环引用]';
          }
          if (key.toLowerCase().includes('password') || key.toLowerCase().includes('private') || key.toLowerCase().includes('secret')) {
            return '[隐藏]';
          }
          return value;
        }).substring(0, SECURITY_CONFIG.MAX_LOG_MESSAGE_LENGTH);
      } catch (e) {
        return '[对象序列化失败]';
      }
    }
    return String(message).substring(0, SECURITY_CONFIG.MAX_LOG_MESSAGE_LENGTH);
  }
  
  /**
   * 验证和净化模块名称
   * @param {string} moduleName - 模块名称
   * @param {Array} allowedModules - 允许的模块列表
   * @returns {boolean} 是否安全
   */
  validateModuleName(moduleName, allowedModules) {
    // 基本格式检查
    if (typeof moduleName !== 'string' || moduleName.length === 0) {
      return false;
    }
    
    // 检查是否在禁止列表中
    if (SECURITY_CONFIG.FORBIDDEN_MODULES.includes(moduleName)) {
      return false;
    }
    
    // 检查路径遍历攻击
    if (moduleName.includes('..') || moduleName.includes('/') || moduleName.includes('\\')) {
      return false;
    }
    
    // 检查是否在允许列表中
    return allowedModules.includes(moduleName);
  }
  
  /**
   * 创建安全的require函数
   * @param {Array} allowedModules - 允许的模块列表
   * @param {string} scriptId - 脚本ID
   * @param {string} executionId - 执行ID
   * @returns {Function} 安全的require函数
   */
  createSecureRequire(allowedModules, scriptId, executionId) {
    return (moduleName) => {
      secureLog('debug', `脚本 ${scriptId} 尝试加载模块: ${moduleName}`, executionId);
      
      // 安全验证
      if (!this.validateModuleName(moduleName, allowedModules)) {
        const errorMsg = `模块 '${moduleName}' 未在白名单中或被安全策略禁止`;
        this.sendLogToRenderer('error', errorMsg, executionId);
        throw new Error(errorMsg);
      }
      
      try {
        const module = require(moduleName);
        secureLog('debug', `模块 ${moduleName} 加载成功`, executionId);
        return module;
      } catch (error) {
        const errorMsg = `加载模块 '${moduleName}' 失败: ${error.message}`;
        this.sendLogToRenderer('error', errorMsg, executionId);
        throw new Error(errorMsg);
      }
    };
  }
  
  initializeIpcHandlers() {
    // 获取可用脚本列表
    ipcMain.handle('get-available-scripts', async () => {
      try {
        secureLog('info', '接收到获取脚本列表请求');
        const scripts = await this.getAvailableScripts();
        secureLog('info', `获取到${scripts.length}个脚本`);
        
        // 添加详细日志以便调试
        const scriptNames = scripts.map(s => s.name).join(', ');
        secureLog('info', `脚本列表: ${scriptNames}`);

        // 确保返回的对象格式正确且可序列化
        const response = { 
          success: true, 
          data: scripts 
        };
        
        // 记录返回结果
        secureLog('info', `返回响应: success=${response.success}, 数据条数=${response.data.length}`);
        
        return response;
      } catch (error) {
        secureLog('error', `获取脚本列表失败: ${error.message}`);
        return { success: false, error: error.message };
      }
    });
    
    // 运行脚本
    ipcMain.handle('run-script', async (event, scriptId, selectedWallets, config, proxyConfig) => {
      try {
        secureLog('info', `运行脚本: ${scriptId}，钱包数: ${selectedWallets?.length}, 配置: ${JSON.stringify(config)}, 代理: ${proxyConfig}`);
        const result = await this.runScript(scriptId, { selectedWallets, config, proxyConfig });
        return { success: true, data: result };
      } catch (error) {
        secureLog('error', `运行脚本失败: ${scriptId} - ${error.message}`);
        return { success: false, error: error.message };
      }
    });
    
    // 停止脚本
    ipcMain.handle('stop-script', async (event, executionId) => {
      try {
        secureLog('info', `停止脚本: ${executionId}`);
        await this.stopScript(executionId);
        return { success: true };
      } catch (error) {
        secureLog('error', `停止脚本失败: ${executionId} - ${error.message}`);
        return { success: false, error: error.message };
      }
    });
    
    // 获取运行中的脚本
    ipcMain.handle('get-running-scripts', () => {
      try {
        secureLog('info', '获取运行中的脚本');
        const runningScripts = Array.from(this.runningScripts.entries()).map(([id, script]) => ({
          id,
          name: script.name,
          status: script.status
        }));
        return { success: true, data: runningScripts };
      } catch (error) {
        secureLog('error', `获取运行中脚本失败: ${error.message}`);
        return { success: false, error: error.message };
      }
    });

    // 同步脚本
    ipcMain.handle('sync-scripts', async (event, options = {}) => {
      try {
        const { forceRefresh = false, clearCache = false } = options;
        secureLog('info', `接收到同步脚本请求 - forceRefresh: ${forceRefresh}, clearCache: ${clearCache}`);
        
        // 导入脚本更新服务
        const scriptUpdaterService = require('./services/scriptUpdaterService');
        
        // 调用同步服务，传递选项
        const result = await scriptUpdaterService.syncScripts({
          forceRefresh,
          clearCache
        });
        
        // 构建详细的响应消息
        let message = '脚本同步完成';
        if (clearCache && result.cacheCleanup) {
          if (result.cacheCleanup.success) {
            message += ` (已清理 ${result.cacheCleanup.data.totalCleaned} 个缓存文件)`;
          } else {
            message += ' (缓存清理失败)';
          }
        }
        
        if (result.processedScripts && result.processedScripts.length > 0) {
          const deletedCount = result.processedScripts.filter(s => s.status === 'deleted').length;
          const updatedCount = result.processedScripts.filter(s => s.status === 'updated' || s.status === 'force_updated').length;
          const newCount = result.processedScripts.filter(s => s.status === 'new').length;
          
          const details = [];
          if (deletedCount > 0) details.push(`删除 ${deletedCount} 个`);
          if (updatedCount > 0) details.push(`更新 ${updatedCount} 个`);
          if (newCount > 0) details.push(`新增 ${newCount} 个`);
          
          if (details.length > 0) {
            message += ` (${details.join(', ')} 脚本)`;
          }
        }
        
        secureLog('info', message);
        return {
          success: true,
          message,
          result
        };
      } catch (error) {
        secureLog('error', `脚本同步失败: ${error.message}`);
        return {
          success: false,
          error: error.message || '脚本同步失败'
        };
      }
    });
  }
  
  async getAvailableScripts() {
    try {
      // 确保脚本目录存在
      if (!fs.existsSync(this.scriptsDir)) {
        secureLog('error', `脚本目录不存在: ${this.scriptsDir}`);
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
                  secureLog('info', `成功加载脚本配置: ${file}`);
                } catch (configError) {
                  secureLog('error', `获取脚本配置失败: ${file} - ${configError.message}`);
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
                  config: safeMetadata.config || {}, // 将配置参数提升到根级别
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
              secureLog('error', `加载脚本失败 (require): ${file} - ${requireError.message}`);
              
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
            secureLog('error', `读取脚本失败: ${file} - ${error.message}`);
          }
        }
      }
      
      return scripts;
    } catch (error) {
      secureLog('error', `获取可用脚本列表失败: ${error.message}`);
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

      // ==================== 获取全局设置 ====================
      let globalSettings = {};
      try {
        // 在主进程中，直接读取设置文件
        const { app } = require('electron');
        const fs = require('fs');
        const path = require('path');
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        
        if (fs.existsSync(settingsPath)) {
          const settingsData = fs.readFileSync(settingsPath, 'utf-8');
          globalSettings = JSON.parse(settingsData);
          this.sendLogToRenderer('info', `脚本 ${scriptId} 已获取全局设置`, executionId);
        } else {
          this.sendLogToRenderer('info', `全局设置文件不存在，将使用默认值`, executionId);
        }
      } catch (settingsError) {
        this.sendLogToRenderer('warning', `获取全局设置失败: ${settingsError.message}，将使用默认值`, executionId);
      }

      // ==================== 安全模块配置 ====================
      const scriptMetadata = script.metadata || {};
      const declaredModules = scriptMetadata.requiredModules || [];
      
      // 验证声明的模块是否安全
      const unsafeModules = declaredModules.filter(mod => 
        SECURITY_CONFIG.FORBIDDEN_MODULES.includes(mod)
      );
      if (unsafeModules.length > 0) {
        const errorMsg = `脚本 ${scriptId} 声明了危险模块: ${unsafeModules.join(', ')}`;
        this.sendLogToRenderer('error', errorMsg, executionId);
        throw new Error(errorMsg);
      }
      
      const allowedModulesForThisScript = [...new Set([...SECURITY_CONFIG.CORE_SAFE_MODULES, ...declaredModules])];
      secureLog('info', `脚本 ${scriptId} 允许的模块: ${allowedModulesForThisScript.join(', ')}`, executionId);
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
        require: this.createSecureRequire(allowedModulesForThisScript, scriptId, executionId),
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
          // 全局验证码配置和工具 - 脚本可以通过 context.globalCaptcha 访问
          globalCaptcha: {
            defaultService: globalSettings.defaultCaptchaService || '2captcha',
            twoCaptchaApiKey: globalSettings.twoCaptchaApiKey || '',
            yescaptchaApiKey: globalSettings.yescaptchaApiKey || '',
            enableFallback: globalSettings.enableCaptchaFallback !== false,
            
            // 辅助方法：获取当前激活的API Key
            getApiKey: function(service) {
              const targetService = service || this.defaultService;
              if (targetService === 'yescaptcha') {
                return this.yescaptchaApiKey;
              } else {
                return this.twoCaptchaApiKey;
              }
            },
            
            // 辅助方法：检查是否配置了验证码服务
            isConfigured: function(service) {
              const targetService = service || this.defaultService;
              const apiKey = this.getApiKey(targetService);
              return apiKey && apiKey.trim() !== '';
            },
            
            // 通用验证码解决方法
            solveTurnstile: async function(siteUrl, siteKey, userAgent, proxy, utils) {
              // 优先使用全局配置的默认服务
              const service = this.defaultService;
              const apiKey = this.getApiKey(service);
              
              if (!apiKey) {
                boundScriptLogger.warn('全局验证码服务未配置API Key，跳过验证码解决');
                return null;
              }
              
              boundScriptLogger.info(`使用全局验证码服务: ${service}`);
              
              if (service === 'yescaptcha') {
                return await this._solveWithYesCaptcha(apiKey, siteUrl, siteKey, utils);
              } else {
                return await this._solveWith2Captcha(apiKey, siteUrl, siteKey, userAgent, proxy, utils);
              }
            },
            
            // YesCaptcha解决方法
            _solveWithYesCaptcha: async function(apiKey, siteUrl, siteKey, utils) {
              try {
                boundScriptLogger.info('开始使用YesCaptcha解决Turnstile验证码...');
                
                const axios = require('axios');
                
                // 创建验证码任务
                const createResponse = await axios.post('https://api.yescaptcha.com/createTask', {
                  clientKey: apiKey,
                  task: {
                    type: 'TurnstileTaskProxyless',
                    websiteURL: siteUrl,
                    websiteKey: siteKey
                  }
                });
                
                if (!createResponse.data.taskId) {
                  boundScriptLogger.error(`YesCaptcha创建任务失败: ${createResponse.data.errorDescription || '未知错误'}`);
                  return null;
                }
                
                const taskId = createResponse.data.taskId;
                boundScriptLogger.info(`YesCaptcha任务ID: ${taskId}`);
                
                // 轮询获取结果
                const maxAttempts = 60; // 最多等待5分钟
                let attempts = 0;
                
                while (attempts < maxAttempts) {
                  await utils.delay(5000); // 等待5秒
                  attempts++;
                  
                  const resultResponse = await axios.post('https://api.yescaptcha.com/getTaskResult', {
                    clientKey: apiKey,
                    taskId: taskId
                  });
                  
                  if (resultResponse.data.status === 'ready') {
                    const token = resultResponse.data.solution.token;
                    boundScriptLogger.success('YesCaptcha验证码解决成功');
                    return token;
                  } else if (resultResponse.data.status === 'processing') {
                    boundScriptLogger.info(`YesCaptcha验证码解决中... (${attempts}/${maxAttempts})`);
                  } else {
                    throw new Error(`YesCaptcha验证码任务状态异常: ${resultResponse.data.status}`);
                  }
                }
                
                throw new Error('YesCaptcha验证码获取超时');
                
              } catch (error) {
                boundScriptLogger.error(`YesCaptcha验证码解决异常: ${error.message}`);
                return null;
              }
            },
            
            // 2Captcha解决方法
            _solveWith2Captcha: async function(apiKey, siteUrl, siteKey, userAgent, proxy, utils) {
              try {
                boundScriptLogger.info('开始使用2Captcha解决Turnstile验证码...');
                
                const axios = require('axios');
                
                // 创建验证码任务
                const createTaskPayload = {
                  clientKey: apiKey,
                  task: {
                    type: "TurnstileTask",
                    websiteURL: siteUrl,
                    websiteKey: siteKey,
                    userAgent: userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                  }
                };
                
                // 如果有代理，添加代理配置
                if (proxy && proxy.host && proxy.port) {
                  createTaskPayload.task.proxyType = proxy.protocol === 'socks5' ? 'socks5' : 'http';
                  createTaskPayload.task.proxyAddress = proxy.host;
                  createTaskPayload.task.proxyPort = proxy.port;
                  if (proxy.auth && proxy.auth.username) {
                    createTaskPayload.task.proxyLogin = proxy.auth.username;
                    createTaskPayload.task.proxyPassword = proxy.auth.password;
                  }
                }
                
                const createResponse = await axios.post('https://api.2captcha.com/createTask', createTaskPayload);
                
                if (createResponse.data.errorId !== 0) {
                  throw new Error(`2Captcha创建验证码任务失败: ${createResponse.data.errorDescription || '未知错误'}`);
                }
                
                const taskId = createResponse.data.taskId;
                boundScriptLogger.info(`2Captcha验证码任务ID: ${taskId}`);
                
                // 轮询获取结果
                const resultPayload = {
                  clientKey: apiKey,
                  taskId: taskId
                };
                
                const timeout = 360; // 6分钟超时
                let totalTime = 0;
                
                while (totalTime < timeout) {
                  await utils.delay(5000); // 等待5秒
                  totalTime += 5;
                  
                  const resultResponse = await axios.post('https://api.2captcha.com/getTaskResult', resultPayload);
                  
                  if (resultResponse.data.status === 'ready') {
                    const token = resultResponse.data.solution.token;
                    boundScriptLogger.success('2Captcha验证码解决成功');
                    return token;
                  } else if (resultResponse.data.status === 'processing') {
                    boundScriptLogger.info(`2Captcha验证码解决中... (${totalTime}/${timeout}秒)`);
                  } else {
                    throw new Error(`2Captcha验证码解决失败: ${resultResponse.data.errorDescription || '未知状态'}`);
                  }
                }
                
                throw new Error('2Captcha验证码解决超时');
                
              } catch (error) {
                boundScriptLogger.error(`2Captcha验证码解决异常: ${error.message}`);
                return null;
              }
            }
          }, 
        },
        __script_result__: null,
      };
      
      // ==================== 创建安全的VM2沙箱 ====================
      this.sendLogToRenderer('info', `为脚本 ${script.name} (执行ID: ${executionId}) 创建安全沙箱环境...`, executionId);

      // 安全的超时配置
      const requestedTimeout = scriptMetadata.timeout || SECURITY_CONFIG.DEFAULT_TIMEOUT;
      const safeTimeout = Math.min(requestedTimeout, SECURITY_CONFIG.MAX_TIMEOUT);
      
      if (requestedTimeout > SECURITY_CONFIG.MAX_TIMEOUT) {
        this.sendLogToRenderer('warning', 
          `脚本 ${scriptId} 请求的超时时间 ${requestedTimeout}ms 超过最大限制，已调整为 ${safeTimeout}ms`, 
          executionId
        );
      }

      const vm = new VM({
        timeout: safeTimeout,
        sandbox: sandbox,
        require: {
          external: {
            modules: allowedModulesForThisScript, // 允许指定的外部模块
            transitive: false // 不允许传递依赖
          },
          builtin: ['crypto', 'path', 'url', 'util'], // 只允许安全的内置模块
          root: path.dirname(script.filePath),
          resolve: (moduleName, parent) => {
            // 额外的模块解析安全检查
            if (!this.validateModuleName(moduleName, allowedModulesForThisScript)) {
              throw new Error(`模块 '${moduleName}' 不在安全白名单中`);
            }
            return moduleName;
          }
        },
        eval: false, // 禁用eval，增强安全性
        wasm: false  // 禁用WebAssembly，增强安全性
      });

      // 设置脚本超时监控
      const timeoutHandle = setTimeout(() => {
        this.sendLogToRenderer('error', `脚本 ${script.name} (执行ID: ${executionId}) 执行超时`, executionId);
        this.forceStopScript(executionId);
      }, safeTimeout);

      // 存储运行中的脚本信息
      this.runningScripts.set(executionId, { 
        id: scriptId, 
        name: script.name, 
        vm, 
        status: 'running',
        startTime: Date.now(),
        timeoutHandle,
        stop: () => this.gracefulStopScript(executionId)
      });
      
      // 存储超时句柄以便清理
      this.scriptTimeouts.set(executionId, timeoutHandle);

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
      
      secureLog('info', `脚本 ${scriptId} 导出的内容: ${Object.keys(scriptResult || {}).join(', ')}`);
      if (scriptResult && typeof scriptResult.main === 'function') {
          secureLog('info', `脚本 ${scriptId} 找到 main 函数`);
      } else {
          secureLog('error', `脚本 ${scriptId} 没有找到 main 函数，导出的内容类型: ${typeof scriptResult}`);
      }
      
      if (typeof scriptResult.main === 'function') {
        this.sendLogToRenderer('info', `开始执行脚本 ${script.name} (ID: ${executionId})`, executionId);
        
        scriptResult.main(sandbox.context)
          .then(result => {
            this.sendLogToRenderer('success', `脚本 ${script.name} (ID: ${executionId}) 执行完成`, executionId);
            this.cleanupScript(executionId, 'completed');
            
            // 安全的结果序列化
            const safeResult = this.sanitizeScriptResult(result);
            
            this.sendScriptCompleted(executionId, safeResult);
          })
          .catch(error => {
            this.sendLogToRenderer('error', `脚本 ${script.name} (ID: ${executionId}) 执行出错: ${error.message}`, executionId);
            this.cleanupScript(executionId, 'failed');
            
            this.sendScriptError(executionId, error);
          });
        
        return { executionId, status: 'running' };
      } else {
        const noMainFuncError = `脚本 ${script.id} (路径: ${script.filePath}) 没有找到可执行的 main 函数。`;
        this.sendLogToRenderer('error', noMainFuncError, executionId);
        throw new Error(noMainFuncError);
      }
    } catch (error) {
      secureLog('error', `执行脚本 ${scriptId || '未知脚本'} (执行ID: ${executionId || '未知'}) 失败: ${error.message}`);
      this.sendLogToRenderer('error', `执行脚本 ${scriptId || '未知脚本'} (执行ID: ${executionId || '未知'}) 失败: ${error.message}`, executionId); 
      throw error;
    }
  }
  
  /**
   * 安全的脚本结果序列化
   * @param {*} result - 脚本执行结果
   * @returns {Object} 安全的序列化结果
   */
  sanitizeScriptResult(result) {
    try {
      const safeResult = JSON.parse(JSON.stringify(result, (key, value) => {
        // 防止循环引用
        if (key === 'parent' || key === 'children' || key === '_events' || key === '_eventsCount') {
          return '[循环引用]';
        }
        // 处理BigInt
        if (typeof value === 'bigint') {
          return value.toString() + 'n';
        }
        // 隐藏敏感信息
        if (key.toLowerCase().includes('password') || key.toLowerCase().includes('private') || key.toLowerCase().includes('secret')) {
          return '[隐藏]';
        }
        return value;
      }));
      
      // 检查序列化结果大小
      const serialized = JSON.stringify(safeResult);
      if (serialized.length > SECURITY_CONFIG.MAX_RESULT_SIZE) {
        return { 
          success: true, 
          message: '脚本执行完成，但结果过大被截断', 
          partial: serialized.substring(0, SECURITY_CONFIG.MAX_RESULT_SIZE) + '...[截断]'
        };
      }
      
      return safeResult;
    } catch (serializeError) {
      secureLog('error', `序列化脚本结果失败: ${serializeError.message}`);
      return { 
        success: true, 
        message: '脚本执行完成，但结果无法序列化', 
        error: serializeError.message
      };
    }
  }
  
  /**
   * 发送脚本完成事件到渲染进程
   * @param {string} executionId - 执行ID
   * @param {Object} result - 脚本结果
   */
  sendScriptCompleted(executionId, result) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    
    try {
      mainWindow.webContents.send('script-completed', { 
        executionId, 
        result 
      });
    } catch (sendError) {
      secureLog('error', `发送脚本完成事件失败: ${sendError.message}`, executionId);
      this.sendLogToRenderer('warning', `脚本执行完成，但结果传递失败: ${sendError.message}`, executionId);
    }
  }
  
  /**
   * 发送脚本错误事件到渲染进程
   * @param {string} executionId - 执行ID
   * @param {Error} error - 错误对象
   */
  sendScriptError(executionId, error) {
    if (!mainWindow || mainWindow.isDestroyed()) {
      return;
    }
    
    try {
      mainWindow.webContents.send('script-error', { 
        executionId, 
        error: error.message,
        stack: error.stack?.substring(0, 1000) // 限制堆栈信息长度
      });
    } catch (sendError) {
      secureLog('error', `发送脚本错误事件失败: ${sendError.message}`, executionId);
    }
  }
  
  /**
   * 清理脚本执行环境
   * @param {string} executionId - 执行ID
   * @param {string} status - 最终状态
   */
  cleanupScript(executionId, status = 'stopped') {
    try {
      // 清理超时句柄
      if (this.scriptTimeouts.has(executionId)) {
        clearTimeout(this.scriptTimeouts.get(executionId));
        this.scriptTimeouts.delete(executionId);
      }
      
      // 更新脚本状态
      if (this.runningScripts.has(executionId)) {
        const scriptInfo = this.runningScripts.get(executionId);
        scriptInfo.status = status;
        scriptInfo.endTime = Date.now();
        
        // 如果脚本有onStop清理函数，尝试调用
        if (scriptInfo.vm && scriptInfo.vm.sandbox && 
            scriptInfo.vm.sandbox.context && 
            typeof scriptInfo.vm.sandbox.context.onStop === 'function') {
          try {
            scriptInfo.vm.sandbox.context.onStop();
            secureLog('info', `脚本 ${scriptInfo.name} 的清理函数已执行`, executionId);
          } catch (cleanupError) {
            secureLog('warning', `脚本 ${scriptInfo.name} 清理函数执行失败: ${cleanupError.message}`, executionId);
          }
        }
        
        // 延迟删除，给其他组件时间处理状态变更
        setTimeout(() => {
          this.runningScripts.delete(executionId);
        }, 5000);
      }
    } catch (error) {
      secureLog('error', `清理脚本 ${executionId} 时出错: ${error.message}`, executionId);
    }
  }
  
  /**
   * 优雅停止脚本
   * @param {string} executionId - 执行ID
   */
  gracefulStopScript(executionId) {
    try {
      const script = this.runningScripts.get(executionId);
      if (!script) {
        throw new Error(`找不到运行中的脚本: ${executionId}`);
      }
      
      this.sendLogToRenderer('info', `正在优雅停止脚本 ${script.name} (ID: ${executionId})`, executionId);
      this.cleanupScript(executionId, 'stopped');
      
      return true;
    } catch (error) {
      secureLog('error', `优雅停止脚本 ${executionId} 失败: ${error.message}`, executionId);
      return false;
    }
  }
  
  /**
   * 强制停止脚本（用于超时）
   * @param {string} executionId - 执行ID
   */
  forceStopScript(executionId) {
    try {
      const script = this.runningScripts.get(executionId);
      if (!script) {
        return false;
      }
      
      this.sendLogToRenderer('warning', `强制停止脚本 ${script.name} (ID: ${executionId})`, executionId);
      this.cleanupScript(executionId, 'timeout');
      
      return true;
    } catch (error) {
      secureLog('error', `强制停止脚本 ${executionId} 失败: ${error.message}`, executionId);
      return false;
    }
  }
  
  /**
   * 停止脚本（公共接口）
   * @param {string} executionId - 执行ID
   * @returns {boolean} 是否成功停止
   */
  async stopScript(executionId) {
    try {
      const success = this.gracefulStopScript(executionId);
      if (!success) {
        throw new Error(`找不到运行中的脚本: ${executionId}`);
      }
      return true;
    } catch (error) {
      secureLog('error', `停止脚本 ${executionId} 失败: ${error.message}`);
      this.sendLogToRenderer('error', `停止脚本 ${executionId} 失败: ${error.message}`, executionId);
      throw error;
    }
  }
}

const scriptEngine = new SecureScriptEngine();
module.exports = scriptEngine;