// 添加清除Discord会话的处理器
ipcMain.on('clear-discord-session', (event) => {
    try {
        // 尝试清除Discord会话存储的数据
        const session = electron.session.fromPartition('persist:discord');
        session.clearStorageData()
            .then(() => {
                console.log('Discord session data cleared');
                event.reply('clear-discord-session-reply', { success: true });
            })
            .catch((error) => {
                console.error('Error clearing Discord session data:', error);
                event.reply('clear-discord-session-reply', { 
                    success: false,
                    error: error.message
                });
            });
    } catch (error) {
        console.error('Error in clear-discord-session handler:', error);
        event.reply('clear-discord-session-reply', { 
            success: false,
            error: error.message
        });
    }
});

// 清除X（推特）会话数据
ipcMain.on('clear-x-session', (event) => {
    try {
        // 尝试清除X平台会话存储的数据
        const session = electron.session.fromPartition('persist:x-twitter');
        session.clearStorageData()
            .then(() => {
                console.log('X platform session data cleared');
                event.reply('clear-x-session-reply', { success: true });
            })
            .catch((error) => {
                console.error('Error clearing X platform session data:', error);
                event.reply('clear-x-session-reply', { 
                    success: false,
                    error: error.message
                });
            });
    } catch (error) {
        console.error('Error in clear-x-session handler:', error);
        event.reply('clear-x-session-reply', { 
            success: false,
            error: error.message
        });
    }
});

// 添加打开外部URL的处理器
ipcMain.on('open-external-url', (event, url) => {
    try {
        const { shell } = require('electron');
        console.log(`Opening external URL: ${url}`);
        shell.openExternal(url);
    } catch (error) {
        console.error('Error opening external URL:', error);
    }
}); 

// 导入脚本引擎
const scriptEngine = require('../scriptEngine');

// 添加脚本更新服务导入
const scriptUpdaterService = require('../services/scriptUpdaterService');

// 脚本相关IPC事件处理
function setupScriptHandlers(ipcMain) {
  // 获取所有可用脚本
  ipcMain.handle('get-available-scripts', async () => {
    try {
      const scripts = await scriptEngine.listAvailableScripts();
      return { success: true, data: scripts };
    } catch (error) {
      console.error('获取可用脚本失败:', error);
      return { success: false, error: error.message };
    }
  });

  // 获取单个脚本元数据
  ipcMain.handle('get-script-metadata', async (event, scriptFileName) => {
    try {
      const metadata = await scriptEngine.getScriptMetadata(scriptFileName);
      return { success: true, data: metadata };
    } catch (error) {
      console.error(`获取脚本 ${scriptFileName} 元数据失败:`, error);
      return { success: false, error: error.message };
    }
  });

  // 运行脚本
  ipcMain.handle('run-script', async (event, { scriptFileName, params, walletIds }) => {
    try {
      // 创建一个Map来存储所有活跃的脚本执行
      if (!global.runningScripts) {
        global.runningScripts = new Map();
      }
      
      // 生成唯一的执行ID
      const executionId = Date.now().toString(36) + Math.random().toString(36).substring(2);
      
      // 设置脚本执行选项
      const options = {
        onProgress: (progress) => {
          // 向渲染进程发送进度更新
          if (!event.sender.isDestroyed()) {
            event.sender.send('script-progress', { executionId, progress });
          }
        },
        onComplete: (result) => {
          // 从活跃脚本列表中移除
          if (global.runningScripts) {
            global.runningScripts.delete(executionId);
          }
          // 通知渲染进程脚本完成
          if (!event.sender.isDestroyed()) {
            event.sender.send('script-completed', { executionId, result });
          }
        },
        onError: (error) => {
          // 从活跃脚本列表中移除
          if (global.runningScripts) {
            global.runningScripts.delete(executionId);
          }
          // 通知渲染进程脚本错误
          if (!event.sender.isDestroyed()) {
            event.sender.send('script-error', {
              executionId,
              error: error.message,
              stack: error.stack
            });
          }
        }
      };

      // 开始异步执行脚本
      const executePromise = scriptEngine.runScript(scriptFileName, params, walletIds, options);
      
      // 将执行Promise保存到全局Map
      global.runningScripts.set(executionId, {
        fileName: scriptFileName,
        startTime: new Date(),
        promise: executePromise
      });
      
      // 立即返回执行ID，不等待脚本完成
      return {
        success: true,
        data: {
          executionId: executionId,
          message: `脚本 ${scriptFileName} 开始执行`
        }
      };
    } catch (error) {
      console.error(`启动脚本 ${scriptFileName} 失败:`, error);
      return { success: false, error: error.message };
    }
  });

  // 停止正在运行的脚本
  ipcMain.handle('stop-script', async (event, executionId) => {
    try {
      if (!global.runningScripts || !global.runningScripts.has(executionId)) {
        return { success: false, error: '找不到指定的脚本执行实例' };
      }
      
      // 实际上VM2没有很好的方式直接停止脚本，但我们可以：
      // 1. 从活跃列表中移除它
      // 2. 让超时机制最终终止它
      // 3. 在后续版本中，可以考虑使用Worker线程替代VM2，这样可以直接终止Worker
      
      global.runningScripts.delete(executionId);
      
      return {
        success: true,
        data: { message: `已请求停止脚本执行: ${executionId}` }
      };
    } catch (error) {
      console.error(`停止脚本执行 ${executionId} 失败:`, error);
      return { success: false, error: error.message };
    }
  });

  // 获取所有正在运行的脚本
  ipcMain.handle('get-running-scripts', async () => {
    try {
      if (!global.runningScripts) {
        return { success: true, data: [] };
      }
      
      const runningScriptsList = Array.from(global.runningScripts.entries()).map(([id, info]) => ({
        executionId: id,
        fileName: info.fileName,
        startTime: info.startTime
      }));
      
      return { success: true, data: runningScriptsList };
    } catch (error) {
      console.error('获取正在运行的脚本列表失败:', error);
      return { success: false, error: error.message };
    }
  });
}

// 在setupHandlers函数中添加脚本处理器
function setupHandlers(ipcMain) {
  // ... existing handlers ...
  
  // 添加脚本相关处理器
  setupScriptHandlers(ipcMain);
  
  // 添加脚本同步的 IPC 处理程序
  ipcMain.handle('sync-scripts', async () => {
    console.log('[IPC] Received sync-scripts request');
    try {
      const result = await scriptUpdaterService.syncScripts();
      return {
        success: true,
        message: '脚本同步完成',
        result
      };
    } catch (error) {
      console.error('[IPC] Error syncing scripts:', error);
      return {
        success: false,
        error: error.message || '脚本同步失败'
      };
    }
  });
  
  // ... existing code ...
} 