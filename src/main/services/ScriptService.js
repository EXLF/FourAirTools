/**
 * @fileoverview 脚本执行服务 - 统一管理脚本的执行和控制
 * @module services/ScriptService
 */

const { fork } = require('child_process');
const path = require('path');
const EventEmitter = require('events');

/**
 * 脚本执行任务类
 */
class ScriptTask {
    constructor(id, scriptPath, params, wallets) {
        this.id = id;
        this.scriptPath = scriptPath;
        this.params = params;
        this.wallets = wallets;
        this.status = 'pending'; // pending, running, completed, failed, stopped
        this.progress = 0;
        this.results = [];
        this.errors = [];
        this.startTime = null;
        this.endTime = null;
        this.childProcess = null;
    }

    getDuration() {
        if (!this.startTime) return 0;
        const end = this.endTime || Date.now();
        return end - this.startTime;
    }

    toJSON() {
        return {
            id: this.id,
            scriptPath: this.scriptPath,
            status: this.status,
            progress: this.progress,
            resultCount: this.results.length,
            errorCount: this.errors.length,
            duration: this.getDuration(),
            walletCount: this.wallets.length
        };
    }
}

/**
 * 脚本执行服务类
 * 管理脚本的执行队列、并发控制、进度跟踪等
 */
class ScriptService extends EventEmitter {
    constructor() {
        super();
        this.tasks = new Map(); // 任务队列
        this.runningTasks = new Map(); // 正在运行的任务
        this.concurrencyLimit = 3; // 默认并发限制
        this.taskIdCounter = 0;
    }

    /**
     * 设置并发限制
     * @param {number} limit - 并发数限制
     */
    setConcurrencyLimit(limit) {
        this.concurrencyLimit = Math.max(1, limit);
        this.processQueue(); // 处理队列中的任务
    }

    /**
     * 执行脚本
     * @param {string} scriptPath - 脚本路径
     * @param {Object} params - 脚本参数
     * @param {Array} wallets - 要处理的钱包列表
     * @returns {Promise<string>} 执行任务ID
     */
    async executeScript(scriptPath, params = {}, wallets = []) {
        // 生成任务ID
        const taskId = `task_${++this.taskIdCounter}_${Date.now()}`;
        
        // 创建任务
        const task = new ScriptTask(taskId, scriptPath, params, wallets);
        this.tasks.set(taskId, task);
        
        // 触发任务创建事件
        this.emit('taskCreated', task.toJSON());
        
        // 尝试执行任务
        this.processQueue();
        
        return taskId;
    }

    /**
     * 停止执行
     * @param {string} taskId - 任务ID
     * @returns {Promise<boolean>} 是否成功停止
     */
    async stopExecution(taskId) {
        const task = this.tasks.get(taskId);
        
        if (!task) {
            throw new Error(`任务 ${taskId} 不存在`);
        }
        
        if (task.status === 'completed' || task.status === 'failed') {
            return false; // 任务已结束
        }
        
        if (task.status === 'pending') {
            // 任务还未开始，直接标记为停止
            task.status = 'stopped';
            this.emit('taskStopped', task.toJSON());
            return true;
        }
        
        if (task.status === 'running' && task.childProcess) {
            // 终止子进程
            return new Promise((resolve) => {
                task.childProcess.once('exit', () => {
                    task.status = 'stopped';
                    task.endTime = Date.now();
                    this.runningTasks.delete(taskId);
                    this.emit('taskStopped', task.toJSON());
                    this.processQueue(); // 处理下一个任务
                    resolve(true);
                });
                
                // 发送停止信号
                task.childProcess.send({ type: 'stop' });
                
                // 如果5秒后还没退出，强制终止
                setTimeout(() => {
                    if (task.childProcess && !task.childProcess.killed) {
                        task.childProcess.kill('SIGKILL');
                    }
                }, 5000);
            });
        }
        
        return false;
    }

    /**
     * 获取执行状态
     * @param {string} taskId - 任务ID
     * @returns {Object|null} 任务状态
     */
    getExecutionStatus(taskId) {
        const task = this.tasks.get(taskId);
        return task ? task.toJSON() : null;
    }

    /**
     * 获取所有任务状态
     * @returns {Array} 所有任务的状态列表
     */
    getAllTasks() {
        return Array.from(this.tasks.values()).map(task => task.toJSON());
    }

    /**
     * 清理已完成的任务
     * @param {number} [olderThanMs=3600000] - 清理多久之前的任务（默认1小时）
     */
    cleanupCompletedTasks(olderThanMs = 3600000) {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [taskId, task] of this.tasks) {
            if ((task.status === 'completed' || task.status === 'failed' || task.status === 'stopped') &&
                task.endTime && (now - task.endTime > olderThanMs)) {
                this.tasks.delete(taskId);
                cleaned++;
            }
        }
        
        return cleaned;
    }

    /**
     * 处理任务队列
     * @private
     */
    processQueue() {
        // 检查是否可以启动新任务
        if (this.runningTasks.size >= this.concurrencyLimit) {
            return;
        }
        
        // 查找下一个待执行的任务
        for (const [taskId, task] of this.tasks) {
            if (task.status === 'pending') {
                this.runTask(taskId);
                break; // 一次只启动一个
            }
        }
    }

    /**
     * 运行单个任务
     * @param {string} taskId - 任务ID
     * @private
     */
    runTask(taskId) {
        const task = this.tasks.get(taskId);
        if (!task || task.status !== 'pending') {
            return;
        }
        
        // 更新任务状态
        task.status = 'running';
        task.startTime = Date.now();
        this.runningTasks.set(taskId, task);
        
        // 触发任务开始事件
        this.emit('taskStarted', task.toJSON());
        
        try {
            // 创建子进程执行脚本
            const scriptPath = path.resolve(task.scriptPath);
            const child = fork(path.join(__dirname, 'scriptRunner.js'), [], {
                silent: true // 捕获子进程的输出
            });
            
            task.childProcess = child;
            
            // 发送执行参数
            child.send({
                type: 'execute',
                scriptPath: scriptPath,
                params: task.params,
                wallets: task.wallets
            });
            
            // 处理子进程消息
            child.on('message', (message) => {
                this.handleChildMessage(taskId, message);
            });
            
            // 处理子进程错误
            child.on('error', (error) => {
                console.error(`[ScriptService] 子进程错误:`, error);
                task.errors.push({
                    type: 'process_error',
                    message: error.message,
                    timestamp: Date.now()
                });
                this.finishTask(taskId, 'failed');
            });
            
            // 处理子进程退出
            child.on('exit', (code, signal) => {
                if (task.status === 'running') {
                    // 非正常退出
                    if (code !== 0) {
                        task.errors.push({
                            type: 'exit_error',
                            message: `进程退出，代码: ${code}, 信号: ${signal}`,
                            timestamp: Date.now()
                        });
                        this.finishTask(taskId, 'failed');
                    } else {
                        this.finishTask(taskId, 'completed');
                    }
                }
            });
            
            // 捕获子进程输出（用于调试）
            child.stdout.on('data', (data) => {
                console.log(`[Script ${taskId}] ${data}`);
            });
            
            child.stderr.on('data', (data) => {
                console.error(`[Script ${taskId} Error] ${data}`);
            });
            
        } catch (error) {
            console.error(`[ScriptService] 启动任务失败:`, error);
            task.errors.push({
                type: 'start_error',
                message: error.message,
                timestamp: Date.now()
            });
            this.finishTask(taskId, 'failed');
        }
    }

    /**
     * 处理子进程消息
     * @param {string} taskId - 任务ID
     * @param {Object} message - 消息内容
     * @private
     */
    handleChildMessage(taskId, message) {
        const task = this.tasks.get(taskId);
        if (!task) return;
        
        switch (message.type) {
            case 'progress':
                task.progress = message.data.percent || 0;
                this.emit('taskProgress', {
                    taskId,
                    progress: task.progress,
                    current: message.data.current,
                    total: message.data.total,
                    message: message.data.message
                });
                break;
                
            case 'result':
                task.results.push(message.data);
                this.emit('taskResult', {
                    taskId,
                    result: message.data
                });
                break;
                
            case 'error':
                task.errors.push(message.data);
                this.emit('taskError', {
                    taskId,
                    error: message.data
                });
                break;
                
            case 'log':
                this.emit('taskLog', {
                    taskId,
                    level: message.data.level || 'info',
                    message: message.data.message,
                    timestamp: message.data.timestamp || Date.now()
                });
                break;
                
            case 'completed':
                this.finishTask(taskId, 'completed');
                break;
                
            case 'failed':
                this.finishTask(taskId, 'failed');
                break;
        }
    }

    /**
     * 完成任务
     * @param {string} taskId - 任务ID
     * @param {string} status - 最终状态
     * @private
     */
    finishTask(taskId, status) {
        const task = this.tasks.get(taskId);
        if (!task) return;
        
        // 更新任务状态
        task.status = status;
        task.endTime = Date.now();
        task.progress = status === 'completed' ? 100 : task.progress;
        
        // 清理子进程
        if (task.childProcess) {
            task.childProcess.removeAllListeners();
            if (!task.childProcess.killed) {
                task.childProcess.kill();
            }
            task.childProcess = null;
        }
        
        // 从运行队列中移除
        this.runningTasks.delete(taskId);
        
        // 触发完成事件
        this.emit('taskFinished', {
            ...task.toJSON(),
            results: task.results,
            errors: task.errors
        });
        
        // 处理下一个任务
        this.processQueue();
    }
}

// 创建单例实例
const scriptService = new ScriptService();

module.exports = scriptService; 