/**
 * 脚本执行引擎
 * 负责加载和执行用户脚本
 */
const fs = require('fs');
const path = require('path');
const { ipcMain } = require('electron');
const { VM } = require('vm2');

// 日志记录
function log(level, message) {
  const timestamp = new Date().toISOString();
  console[level](`[${timestamp}][ScriptEngine][${level.toUpperCase()}] ${message}`);
}

// 保存主窗口引用
let mainWindow = null;

class ScriptEngine {
  constructor() {
    this.scriptsDir = path.join(__dirname, '../../user_scripts/scripts');
    this.runningScripts = new Map();
    
    // 初始化IPC监听器
    this.initializeIpcHandlers();
    
    log('info', `初始化完成，脚本目录: ${this.scriptsDir}`);
  }
  
  setMainWindow(window) {
    mainWindow = window;
    log('info', '主窗口引用已设置');
  }
  
  // 发送日志到渲染进程
  sendLogToRenderer(level, message) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('script:log', { level, message });
      log(level === 'error' ? 'error' : 'info', message);
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
    ipcMain.handle('run-script', async (event, scriptId) => {
      try {
        log('info', `运行脚本: ${scriptId}`);
        const result = await this.runScript(scriptId);
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
  
  async runScript(scriptId) {
    try {
      const scripts = await this.getAvailableScripts();
      const script = scripts.find(s => s.id === scriptId);
      
      if (!script) {
        throw new Error(`找不到脚本: ${scriptId}`);
      }
      
      // 创建执行环境
      const sandbox = {
        console: {
          log: (...args) => {
            const message = args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            this.sendLogToRenderer('info', message);
          },
          info: (...args) => {
            const message = args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            this.sendLogToRenderer('info', message);
          },
          warn: (...args) => {
            const message = args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            this.sendLogToRenderer('warn', message);
          },
          error: (...args) => {
            const message = args.map(arg => 
              typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
            ).join(' ');
            this.sendLogToRenderer('error', message);
          }
        },
        require: require,
        process: {
          env: process.env
        },
        __dirname: path.dirname(script.filePath),
        __filename: script.filePath,
        module: { exports: {} },
        exports: {},
        context: {
          wallets: [],
          params: {},
          api: {
            logger: {
              info: (...args) => this.sendLogToRenderer('info', args.join(' ')),
              warn: (...args) => this.sendLogToRenderer('warn', args.join(' ')),
              error: (...args) => this.sendLogToRenderer('error', args.join(' ')),
              success: (...args) => this.sendLogToRenderer('success', args.join(' '))
            },
            http: require('axios'),
            // 仅提供非敏感API
            delay: ms => new Promise(resolve => setTimeout(resolve, ms))
          }
        }
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
        
        // 加载并执行脚本
        const scriptContent = fs.readFileSync(script.filePath, { encoding: 'utf8' });
        const wrappedScript = `
          (function(module, exports, require, __dirname, __filename, context) {
            ${scriptContent}
          })(module, exports, require, __dirname, __filename, context);
          module.exports;
        `;
        
        const scriptModule = vm2Instance.run(wrappedScript, script.filePath);
        const executionId = Date.now().toString();
        
        // 记录运行中的脚本
        this.runningScripts.set(executionId, {
          id: scriptId,
          name: script.name,
          instance: vm2Instance,
          status: 'running'
        });
        
        log('info', `脚本 ${scriptId} 已加载并准备执行, executionId=${executionId}`);
        
        if (typeof scriptModule.main === 'function') {
          this.sendLogToRenderer('info', `开始执行脚本: ${script.name}`);
          
          // 异步执行main，不阻塞IPC响应
          scriptModule.main(sandbox.context)
            .then(result => {
              this.sendLogToRenderer('success', `脚本执行完成: ${script.name}`);
              // 更新状态
              if (this.runningScripts.has(executionId)) {
                const scriptInfo = this.runningScripts.get(executionId);
                scriptInfo.status = 'completed';
                this.runningScripts.set(executionId, scriptInfo);
              }
              
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('script-completed', { 
                  executionId, 
                  result 
                });
              }
            })
            .catch(error => {
              this.sendLogToRenderer('error', `脚本执行出错: ${error.message}`);
              // 更新状态
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
        throw new Error(`脚本执行环境创建失败: ${vmError.message}`);
      }
    } catch (error) {
      log('error', `执行脚本失败: ${error.message}`);
      throw error;
    }
  }
  
  async stopScript(executionId) {
    try {
      const script = this.runningScripts.get(executionId);
      if (!script) {
        throw new Error(`找不到运行中的脚本: ${executionId}`);
      }
      
      // 停止脚本执行
      if (script.instance) {
        try {
          script.instance.freeze();
          log('info', `脚本 ${executionId} 已冻结`);
        } catch (freezeError) {
          log('error', `冻结脚本失败: ${freezeError.message}`);
        }
      }
      
      // 更新状态
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

// 创建单例实例
const scriptEngine = new ScriptEngine();

module.exports = scriptEngine; 