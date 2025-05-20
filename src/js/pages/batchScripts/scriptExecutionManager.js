/**
 * 脚本执行管理器
 * 负责管理脚本执行的具体逻辑，支持多账户并行执行
 */

import { TaskLogger } from './logger.js';

/**
 * 脚本执行管理器类
 */
export class ScriptExecutionManager {
    constructor(options = {}) {
        this.maxConcurrency = options.maxConcurrency || 10; // 默认最大并行数
        this.runningTasks = new Map(); // 运行中的任务
        this.taskQueues = new Map(); // 任务队列
        this.activeWorkers = new Map(); // 活跃的工作线程
    }
    
    /**
     * 执行批量任务
     * @param {Object} task - 任务数据
     */
    async executeTask(task) {
        try {
            const { id: taskId, scriptId, accountIds, params, maxConcurrency, errorStrategy } = task;
            
            if (!scriptId || !accountIds || accountIds.length === 0) {
                throw new Error('无效的任务数据：缺少脚本ID或账户');
            }
            
            // 如果任务已在运行，先停止
            if (this.runningTasks.has(taskId)) {
                await this.stopTask(taskId);
            }
            
            // 创建任务执行状态
            const taskExecution = {
                taskId,
                scriptId,
                params: params || {},
                accountIds: [...accountIds],
                pendingAccounts: [...accountIds],
                runningAccounts: new Set(),
                completedAccounts: new Set(),
                failedAccounts: new Set(),
                maxConcurrency: maxConcurrency || this.maxConcurrency,
                errorStrategy: errorStrategy || 'continue',
                status: 'running',
                startTime: Date.now(),
                paused: false
            };
            
            // 保存任务状态
            this.runningTasks.set(taskId, taskExecution);
            
            // 初始化任务队列
            this.taskQueues.set(taskId, taskExecution.pendingAccounts);
            
            // 日志记录
            TaskLogger.logInfo(`开始执行任务 ${taskId}，共 ${accountIds.length} 个账户`);
            
            // 开始处理队列
            this._processTaskQueue(taskId);
            
            return true;
        } catch (error) {
            console.error(`执行任务失败:`, error);
            throw error;
        }
    }
    
    /**
     * 处理任务队列
     * @param {string} taskId - 任务ID
     * @private
     */
    async _processTaskQueue(taskId) {
        const taskExecution = this.runningTasks.get(taskId);
        if (!taskExecution || taskExecution.paused) return;
        
        const queue = this.taskQueues.get(taskId);
        if (!queue || queue.length === 0) {
            // 队列为空，检查是否所有账户都已处理完成
            if (taskExecution.runningAccounts.size === 0) {
                // 所有账户都已处理完毕，任务结束
                this._finalizeTask(taskId);
            }
            return;
        }
        
        // 计算可以启动的新任务数量
        const availableSlots = taskExecution.maxConcurrency - taskExecution.runningAccounts.size;
        if (availableSlots <= 0) return;
        
        // 启动新的账户任务
        for (let i = 0; i < Math.min(availableSlots, queue.length); i++) {
            const accountId = queue.shift();
            if (!accountId) continue;
            
            // 将账户标记为运行中
            taskExecution.runningAccounts.add(accountId);
            
            // 创建随机延迟，避免所有任务同时开始
            const delay = Math.floor(Math.random() * 1000);
            
            // 延迟启动账户任务
            setTimeout(() => {
                this._executeAccountTask(taskId, accountId).catch(error => {
                    console.error(`执行账户任务出错:`, error);
                });
            }, delay);
        }
    }
    
    /**
     * 执行单个账户的任务
     * @param {string} taskId - 任务ID
     * @param {string} accountId - 账户ID
     * @private
     */
    async _executeAccountTask(taskId, accountId) {
        const taskExecution = this.runningTasks.get(taskId);
        if (!taskExecution || taskExecution.paused) return;
        
        try {
            // 通知账户任务开始
            this._notifyAccountTaskStatus(taskId, accountId, 'running');
            
            // 日志记录
            TaskLogger.logInfo(`开始执行账户 ${accountId} 的脚本任务`);
            
            // 模拟脚本执行过程（替代后端API调用）
            const result = await this._simulateScriptExecution(
                taskExecution.scriptId,
                accountId,
                taskExecution.params
            );
            
            // 标记账户任务完成
            taskExecution.runningAccounts.delete(accountId);
            taskExecution.completedAccounts.add(accountId);
            
            // 通知账户任务完成
            this._notifyAccountTaskStatus(taskId, accountId, 'success', result);
            
            // 日志记录
            TaskLogger.logSuccess(`账户 ${accountId} 脚本执行成功`);
        } catch (error) {
            // 标记账户任务失败
            taskExecution.runningAccounts.delete(accountId);
            taskExecution.failedAccounts.add(accountId);
            
            // 通知账户任务失败
            this._notifyAccountTaskStatus(taskId, accountId, 'failed', { error: error.message });
            
            // 日志记录
            TaskLogger.logError(`账户 ${accountId} 脚本执行失败: ${error.message}`);
            
            // 根据错误策略处理
            if (taskExecution.errorStrategy === 'stop') {
                // 停止整个任务
                await this.stopTask(taskId);
                return;
            } else if (taskExecution.errorStrategy === 'retry') {
                // 重试逻辑（简化处理，这里只重试一次）
                if (!taskExecution.retriedAccounts) {
                    taskExecution.retriedAccounts = new Set();
                }
                
                if (!taskExecution.retriedAccounts.has(accountId)) {
                    taskExecution.retriedAccounts.add(accountId);
                    // 将账户重新加入队列
                    const queue = this.taskQueues.get(taskId);
                    if (queue) {
                        queue.push(accountId);
                        TaskLogger.logWarning(`账户 ${accountId} 将重试执行`);
                    }
                }
            }
        } finally {
            // 继续处理队列
            this._processTaskQueue(taskId);
        }
    }
    
    /**
     * 模拟脚本执行过程
     * @param {string} scriptId - 脚本ID
     * @param {string} accountId - 账户ID
     * @param {Object} params - 脚本参数
     * @returns {Promise<Object>} 执行结果
     * @private
     */
    async _simulateScriptExecution(scriptId, accountId, params) {
        return new Promise((resolve, reject) => {
            // 模拟执行时间 (2-5秒)
            const executionTime = 2000 + Math.random() * 3000;
            
            // 模拟成功率 (80%)
            const willSucceed = Math.random() < 0.8;
            
            setTimeout(() => {
                if (willSucceed) {
                    // 模拟成功结果
                    resolve({
                        success: true,
                        scriptId,
                        accountId,
                        executionTime,
                        timestamp: Date.now(),
                        result: {
                            message: '脚本执行成功',
                            // 根据不同脚本类型返回不同结果
                            data: this._generateMockResultData(scriptId, params)
                        }
                    });
                } else {
                    // 模拟失败情况
                    const errorMessages = [
                        '网络请求超时',
                        'API调用失败',
                        '账户余额不足',
                        '参数验证失败',
                        '权限不足'
                    ];
                    const errorIndex = Math.floor(Math.random() * errorMessages.length);
                    reject(new Error(errorMessages[errorIndex]));
                }
            }, executionTime);
        });
    }
    
    /**
     * 根据脚本类型生成模拟结果数据
     * @param {string} scriptId - 脚本ID
     * @param {Object} params - 脚本参数
     * @returns {Object} 模拟结果数据
     * @private
     */
    _generateMockResultData(scriptId, params) {
        // 根据脚本ID生成不同类型的结果数据
        const mockData = {
            transactionHash: '0x' + Math.random().toString(16).substring(2, 42),
            timestamp: Date.now(),
            params: params || {}
        };
        
        return mockData;
    }
    
    /**
     * 通知账户任务状态变更
     * @param {string} taskId - 任务ID
     * @param {string} accountId - 账户ID
     * @param {string} status - 状态
     * @param {Object} result - 结果数据
     * @private
     */
    _notifyAccountTaskStatus(taskId, accountId, status, result = {}) {
        try {
            // 使用自定义事件代替IPC通信
            const event = new CustomEvent('batch-task:account-status', {
                detail: { taskId, accountId, status, result }
            });
            window.batchTaskEvents.dispatchEvent(event);
        } catch (error) {
            console.error(`通知账户任务状态失败:`, error);
        }
    }
    
    /**
     * 完成任务处理
     * @param {string} taskId - 任务ID
     * @private
     */
    _finalizeTask(taskId) {
        const taskExecution = this.runningTasks.get(taskId);
        if (!taskExecution) return;
        
        // 计算任务结果
        const result = {
            totalAccounts: taskExecution.accountIds.length,
            completedAccounts: taskExecution.completedAccounts.size,
            failedAccounts: taskExecution.failedAccounts.size,
            duration: Date.now() - taskExecution.startTime
        };
        
        // 判断任务最终状态
        let finalStatus;
        if (taskExecution.failedAccounts.size === 0) {
            finalStatus = 'completed';
        } else if (taskExecution.completedAccounts.size === 0) {
            finalStatus = 'failed';
        } else {
            finalStatus = 'completed_with_errors';
        }
        
        // 通知任务完成
        try {
            // 使用自定义事件代替IPC通信
            const event = new CustomEvent('batch-task:completed', {
                detail: {
                    taskId,
                    status: finalStatus,
                    result
                }
            });
            window.batchTaskEvents.dispatchEvent(event);
        } catch (error) {
            console.error(`通知任务完成失败:`, error);
        }
        
        // 清理任务资源
        this.runningTasks.delete(taskId);
        this.taskQueues.delete(taskId);
        
        // 日志记录
        TaskLogger.logInfo(`任务 ${taskId} 已完成，成功: ${result.completedAccounts}，失败: ${result.failedAccounts}`);
    }
    
    /**
     * 暂停任务
     * @param {string} taskId - 任务ID
     */
    async pauseTask(taskId) {
        const taskExecution = this.runningTasks.get(taskId);
        if (!taskExecution) {
            throw new Error(`任务 ${taskId} 不存在或未运行`);
        }
        
        // 标记任务为暂停状态
        taskExecution.paused = true;
        
        // 日志记录
        TaskLogger.logWarning(`任务 ${taskId} 已暂停`);
        
        return true;
    }
    
    /**
     * 恢复任务
     * @param {string} taskId - 任务ID
     */
    async resumeTask(taskId) {
        const taskExecution = this.runningTasks.get(taskId);
        if (!taskExecution) {
            throw new Error(`任务 ${taskId} 不存在或未运行`);
        }
        
        // 取消暂停状态
        taskExecution.paused = false;
        
        // 日志记录
        TaskLogger.logInfo(`任务 ${taskId} 已恢复运行`);
        
        // 继续处理队列
        this._processTaskQueue(taskId);
        
        return true;
    }
    
    /**
     * 停止任务
     * @param {string} taskId - 任务ID
     */
    async stopTask(taskId) {
        const taskExecution = this.runningTasks.get(taskId);
        if (!taskExecution) {
            return false; // 任务不存在，直接返回
        }
        
        // 标记任务为停止状态
        taskExecution.status = 'stopped';
        taskExecution.paused = true; // 暂停以防止新任务启动
        
        // 清空队列
        this.taskQueues.set(taskId, []);
        
        // 获取正在运行的账户ID列表
        const runningAccountIds = Array.from(taskExecution.runningAccounts);
        
        // 尝试取消正在运行的账户任务（模拟实现）
        for (const accountId of runningAccountIds) {
            try {
                // 标记为已停止
                taskExecution.runningAccounts.delete(accountId);
                this._notifyAccountTaskStatus(taskId, accountId, 'stopped');
            } catch (error) {
                console.error(`停止账户 ${accountId} 的任务失败:`, error);
            }
        }
        
        // 完成任务
        this._finalizeTask(taskId);
        
        // 日志记录
        TaskLogger.logWarning(`任务 ${taskId} 已停止`);
        
        return true;
    }
    
    /**
     * 获取任务状态
     * @param {string} taskId - 任务ID
     * @returns {Object|null} 任务状态
     */
    getTaskStatus(taskId) {
        const taskExecution = this.runningTasks.get(taskId);
        if (!taskExecution) return null;
        
        return {
            taskId: taskExecution.taskId,
            status: taskExecution.status,
            paused: taskExecution.paused,
            startTime: taskExecution.startTime,
            totalAccounts: taskExecution.accountIds.length,
            pendingAccounts: taskExecution.pendingAccounts.length,
            runningAccounts: taskExecution.runningAccounts.size,
            completedAccounts: taskExecution.completedAccounts.size,
            failedAccounts: taskExecution.failedAccounts.size
        };
    }
} 