/**
 * 脚本执行引擎
 * 负责加载和执行用户脚本
 */
const fs = require('fs').promises;
const path = require('path');
const { ipcMain } = require('electron');

// 修正导入路径，使用从项目根目录开始的路径
const logger = require('../../user_scripts/common/logger');
const http = require('../../user_scripts/common/http');
const web3 = require('../../user_scripts/common/web3');

// 保存主窗口引用
let mainWindow = null;

class ScriptEngine {
  constructor() {
    // 修正脚本目录路径
    this.scriptsDir = path.join(__dirname, '../../user_scripts/scripts');
    this.scriptCache = new Map();
    
    // 注册IPC处理器
    this.registerIpcHandlers();
  }
  
  /**
   * 设置主窗口引用
   * @param {BrowserWindow} window - 主窗口引用
   */
  setMainWindow(window) {
    mainWindow = window;
  }
  
  /**
   * 发送日志到渲染进程
   * @param {string} level - 日志级别
   * @param {string} message - 日志消息
   */
  sendLogToRenderer(level, message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('script:log', { level, message });
    }
  }
  
  /**
   * 注册IPC处理器
   */
  registerIpcHandlers() {
    console.log('[ScriptEngine] 注册脚本引擎IPC处理器');
    ipcMain.handle('script:getAll', () => this.getAllScripts());
    ipcMain.handle('script:execute', (event, { scriptId, wallets, config, proxyId }) => 
      this.executeScript(scriptId, wallets, config, proxyId));
  }
  
  /**
   * 获取所有可用脚本
   * @returns {Promise<Object>} 脚本列表结果
   */
  async getAllScripts() {
    try {
      console.log(`[ScriptEngine] 正在扫描脚本目录: ${this.scriptsDir}`);
      const files = await fs.readdir(this.scriptsDir);
      const scriptFiles = files.filter(file => file.endsWith('.js'));
      
      console.log(`[ScriptEngine] 找到 ${scriptFiles.length} 个脚本文件`);
      
      const scripts = [];
      for (const file of scriptFiles) {
        const script = await this.loadScript(file);
        if (script && script.metadata) {
          scripts.push(script.metadata);
        }
      }
      
      return { success: true, scripts };
    } catch (error) {
      console.error('[ScriptEngine] 获取脚本列表失败:', error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * 加载单个脚本
   * @param {string} filename - 脚本文件名
   * @returns {Object} 脚本模块
   */
  async loadScript(filename) {
    const filePath = path.join(this.scriptsDir, filename);
    
    try {
      // 清除缓存以确保加载最新版本
      delete require.cache[require.resolve(filePath)];
      return require(filePath);
    } catch (error) {
      console.error(`[ScriptEngine] 加载脚本 ${filename} 失败:`, error);
      return null;
    }
  }
  
  /**
   * 执行脚本
   * @param {string} scriptId - 脚本ID
   * @param {Array} wallets - 钱包列表
   * @param {Object} config - 脚本配置
   * @param {string|null} proxyId - 代理ID
   * @returns {Promise<Object>} 执行结果
   */
  async executeScript(scriptId, wallets, config, proxyId) {
    console.log(`[ScriptEngine] 执行脚本: ${scriptId}, 代理ID: ${proxyId || 'none'}`);
    this.sendLogToRenderer('info', `开始执行脚本: ${scriptId}`);
    
    try {
      // 查找脚本
      const files = await fs.readdir(this.scriptsDir);
      const scriptFiles = files.filter(file => file.endsWith('.js'));
      
      let targetScript = null;
      let scriptModule = null;
      
      for (const file of scriptFiles) {
        const script = await this.loadScript(file);
        if (script && script.metadata && script.metadata.id === scriptId) {
          targetScript = script.metadata;
          scriptModule = script;
          break;
        }
      }
      
      if (!scriptModule || !targetScript) {
        const errorMsg = `找不到脚本: ${scriptId}`;
        console.error(`[ScriptEngine] ${errorMsg}`);
        this.sendLogToRenderer('error', errorMsg);
        return { success: false, error: errorMsg };
      }
      
      // 获取代理配置(如果需要)
      let proxyConfig = null;
      if (proxyId) {
        // 这里应该从数据库获取代理配置
        // 简化示例使用本地代理
        proxyConfig = {
          type: 'HTTP',
          host: '127.0.0.1',
          port: 7890
        };
        this.sendLogToRenderer('info', `使用代理: ${proxyConfig.host}:${proxyConfig.port}`);
      }
      
      // 准备工具库
      const scriptLogger = logger.createLogger({
        prefix: `[${targetScript.name}] `
      });
      
      // 添加日志回调，将日志发送到渲染进程
      scriptLogger.addListener((level, message) => {
        this.sendLogToRenderer(level, message);
      });
      
      const utils = {
        logger: scriptLogger,
        http,
        web3,
        proxy: proxyConfig
      };
      
      // 记录开始执行
      console.log(`[ScriptEngine] 开始执行脚本: ${targetScript.name}`);
      this.sendLogToRenderer('info', `开始执行脚本: ${targetScript.name}`);
      
      // 执行脚本
      const result = await scriptModule.execute(wallets, config, utils);
      
      console.log(`[ScriptEngine] 脚本 ${targetScript.name} 执行完成:`, result);
      this.sendLogToRenderer('success', `脚本 ${targetScript.name} 执行完成`);
      
      return result;
    } catch (error) {
      console.error(`[ScriptEngine] 执行脚本 ${scriptId} 出错:`, error);
      this.sendLogToRenderer('error', `执行脚本出错: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// 导出脚本引擎实例
module.exports = new ScriptEngine(); 