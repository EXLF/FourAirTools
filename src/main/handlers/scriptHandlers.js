/**
 * @fileoverview 脚本IPC处理器 - 使用ScriptService处理脚本执行相关请求
 * @module handlers/scriptHandlers
 */

const { ipcMain } = require('electron');
const scriptService = require('../services/ScriptService');
const { AppError, ErrorCodes } = require('../../shared/errors/AppError');

/**
 * 设置脚本相关的IPC处理器
 * @param {Object} dependencies - 依赖项
 * @param {BrowserWindow} dependencies.mainWindow - 主窗口
 */
function setupScriptHandlers({ mainWindow }) {
    
    // 监听脚本服务事件，转发到渲染进程
    scriptService.on('taskCreated', (task) => {
        mainWindow.webContents.send('script:taskCreated', task);
    });
    
    scriptService.on('taskStarted', (task) => {
        mainWindow.webContents.send('script:taskStarted', task);
    });
    
    scriptService.on('taskProgress', (data) => {
        mainWindow.webContents.send('script:taskProgress', data);
    });
    
    scriptService.on('taskResult', (data) => {
        mainWindow.webContents.send('script:taskResult', data);
    });
    
    scriptService.on('taskError', (data) => {
        mainWindow.webContents.send('script:taskError', data);
    });
    
    scriptService.on('taskLog', (data) => {
        mainWindow.webContents.send('script:taskLog', data);
    });
    
    scriptService.on('taskFinished', (data) => {
        mainWindow.webContents.send('script:taskFinished', data);
    });
    
    scriptService.on('taskStopped', (task) => {
        mainWindow.webContents.send('script:taskStopped', task);
    });
    
    /**
     * 执行脚本
     */
    ipcMain.handle('script:execute', async (event, { scriptPath, params, wallets }) => {
        try {
            console.log('[ScriptHandler] 执行脚本请求', {
                scriptPath,
                walletCount: wallets?.length || 0
            });
            
            // 验证参数
            if (!scriptPath) {
                throw new AppError(
                    '脚本路径不能为空',
                    ErrorCodes.VALIDATION_ERROR,
                    { field: 'scriptPath' }
                );
            }
            
            if (!wallets || wallets.length === 0) {
                throw new AppError(
                    '请选择要处理的钱包',
                    ErrorCodes.VALIDATION_ERROR,
                    { field: 'wallets' }
                );
            }
            
            // 执行脚本
            const taskId = await scriptService.executeScript(scriptPath, params, wallets);
            
            return {
                success: true,
                data: { taskId }
            };
        } catch (error) {
            console.error('[ScriptHandler] 执行脚本失败:', error);
            
            if (error instanceof AppError) throw error;
            
            throw new AppError(
                '执行脚本失败',
                ErrorCodes.SCRIPT_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 停止脚本执行
     */
    ipcMain.handle('script:stop', async (event, taskId) => {
        try {
            console.log('[ScriptHandler] 停止脚本执行', taskId);
            
            if (!taskId) {
                throw new AppError(
                    '任务ID不能为空',
                    ErrorCodes.VALIDATION_ERROR,
                    { field: 'taskId' }
                );
            }
            
            const success = await scriptService.stopExecution(taskId);
            
            return {
                success,
                message: success ? '任务已停止' : '任务无法停止'
            };
        } catch (error) {
            console.error('[ScriptHandler] 停止脚本失败:', error);
            
            if (error instanceof AppError) throw error;
            
            throw new AppError(
                '停止脚本失败',
                ErrorCodes.SCRIPT_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 获取任务状态
     */
    ipcMain.handle('script:getTaskStatus', async (event, taskId) => {
        try {
            console.log('[ScriptHandler] 获取任务状态', taskId);
            
            const status = scriptService.getExecutionStatus(taskId);
            
            if (!status) {
                throw AppError.notFound('任务', taskId);
            }
            
            return {
                success: true,
                data: status
            };
        } catch (error) {
            console.error('[ScriptHandler] 获取任务状态失败:', error);
            
            if (error instanceof AppError) throw error;
            
            throw new AppError(
                '获取任务状态失败',
                ErrorCodes.SYSTEM_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 获取所有任务
     */
    ipcMain.handle('script:getAllTasks', async () => {
        try {
            console.log('[ScriptHandler] 获取所有任务');
            
            const tasks = scriptService.getAllTasks();
            
            return {
                success: true,
                data: tasks
            };
        } catch (error) {
            console.error('[ScriptHandler] 获取所有任务失败:', error);
            
            throw new AppError(
                '获取任务列表失败',
                ErrorCodes.SYSTEM_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 设置并发限制
     */
    ipcMain.handle('script:setConcurrencyLimit', async (event, limit) => {
        try {
            console.log('[ScriptHandler] 设置并发限制', limit);
            
            if (typeof limit !== 'number' || limit < 1 || limit > 10) {
                throw new AppError(
                    '并发限制必须在1-10之间',
                    ErrorCodes.VALIDATION_ERROR,
                    { field: 'limit', value: limit }
                );
            }
            
            scriptService.setConcurrencyLimit(limit);
            
            return {
                success: true,
                message: `并发限制已设置为 ${limit}`
            };
        } catch (error) {
            console.error('[ScriptHandler] 设置并发限制失败:', error);
            
            if (error instanceof AppError) throw error;
            
            throw new AppError(
                '设置并发限制失败',
                ErrorCodes.SYSTEM_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 清理已完成的任务
     */
    ipcMain.handle('script:cleanupTasks', async (event, olderThanMs) => {
        try {
            console.log('[ScriptHandler] 清理已完成任务');
            
            const cleaned = scriptService.cleanupCompletedTasks(olderThanMs);
            
            return {
                success: true,
                data: { cleanedCount: cleaned }
            };
        } catch (error) {
            console.error('[ScriptHandler] 清理任务失败:', error);
            
            throw new AppError(
                '清理任务失败',
                ErrorCodes.SYSTEM_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    /**
     * 获取可用脚本列表
     */
    ipcMain.handle('script:getAvailableScripts', async () => {
        try {
            console.log('[ScriptHandler] 获取可用脚本列表');
            
            // TODO: 实现从文件系统读取脚本列表
            // 暂时返回模拟数据
            const scripts = [
                {
                    id: 'mira_chat_bot',
                    name: 'Mira Chat Bot',
                    description: '自动与Mira聊天机器人交互',
                    category: 'social',
                    version: '1.0.0',
                    author: 'FourAir',
                    path: 'user_scripts/scripts/mira_chat_bot.js'
                },
                {
                    id: 'uniswap_swap',
                    name: 'Uniswap自动交易',
                    description: '在Uniswap上执行自动交易',
                    category: 'defi',
                    version: '1.0.0',
                    author: 'FourAir',
                    path: 'user_scripts/scripts/uniswap_swap.js'
                }
            ];
            
            return {
                success: true,
                data: scripts
            };
        } catch (error) {
            console.error('[ScriptHandler] 获取脚本列表失败:', error);
            
            throw new AppError(
                '获取脚本列表失败',
                ErrorCodes.SYSTEM_ERROR,
                { originalError: error.message }
            );
        }
    });
    
    console.log('[ScriptHandler] 脚本处理器已设置');
}

module.exports = setupScriptHandlers; 