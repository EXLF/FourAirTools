/**
 * 批量任务管理器
 * 管理批量脚本任务的创建、执行、状态跟踪等功能
 */

import { ScriptExecutionManager } from './scriptExecutionManager.js';
import { TaskLogger } from './logger.js';

// 批量任务执行管理器
const scriptExecutionManager = new ScriptExecutionManager();

// 本地存储键
const STORAGE_KEY = 'batch_tasks_data';

/**
 * 批量任务管理器类
 */
export class BatchTaskManager {
    constructor() {
        this.tasks = new Map(); // 任务映射表，键为任务ID，值为任务数据
        this.taskEventListeners = new Map(); // 任务事件监听器
        
        // 初始化时加载保存的任务
        this._loadSavedTasks();
        
        // 注册脚本执行事件监听
        this._setupEventListeners();
    }
    
    /**
     * 加载保存的任务数据
     * @private
     */
    async _loadSavedTasks() {
        try {
            // 从localStorage获取任务数据（替代IPC调用）
            const savedTasksJson = localStorage.getItem(STORAGE_KEY);
            const savedTasksData = savedTasksJson ? JSON.parse(savedTasksJson) : [];
            
            if (Array.isArray(savedTasksData)) {
                savedTasksData.forEach(taskData => {
                    this.tasks.set(taskData.id, taskData);
                });
                console.log(`已加载 ${savedTasksData.length} 个批量任务`);
            }
        } catch (error) {
            console.error('加载保存的任务失败:', error);
        }
    }
    
    /**
     * 设置事件监听器
     * @private
     */
    _setupEventListeners() {
        // 模拟事件监听 - 实际项目中这里应连接到后端IPC事件
        // 当前实现为前端模拟，后续可替换为真实IPC通道

        // 创建自定义事件处理通道
        if (!window.batchTaskEvents) {
            window.batchTaskEvents = new EventTarget();
        }
        
        // 监听任务进度更新
        window.batchTaskEvents.addEventListener('batch-task:progress', (event) => {
            this._handleTaskProgress(event.detail);
        });
        
        // 监听任务完成
        window.batchTaskEvents.addEventListener('batch-task:completed', (event) => {
            this._handleTaskCompleted(event.detail);
        });
        
        // 监听任务错误
        window.batchTaskEvents.addEventListener('batch-task:error', (event) => {
            this._handleTaskError(event.detail);
        });
        
        // 监听账户任务状态更新
        window.batchTaskEvents.addEventListener('batch-task:account-status', (event) => {
            this._handleAccountStatusUpdate(event.detail);
        });
    }
    
    /**
     * 处理任务进度更新
     * @param {Object} data - 进度数据
     * @private
     */
    _handleTaskProgress(data) {
        const { taskId, progress, message } = data;
        const task = this.tasks.get(taskId);
        
        if (task) {
            // 更新任务进度
            task.progress = progress;
            
            // 记录进度消息
            TaskLogger.logInfo(`任务 ${task.name} 进度: ${progress}% - ${message}`);
            
            // 通知任务状态变化
            this._notifyTaskUpdate(taskId, { progress, message });
        }
    }
    
    /**
     * 处理任务完成
     * @param {Object} data - 完成数据
     * @private
     */
    _handleTaskCompleted(data) {
        const { taskId, result } = data;
        const task = this.tasks.get(taskId);
        
        if (task) {
            // 更新任务状态
            task.status = 'completed';
            task.endTime = Date.now();
            task.result = result;
            task.progress = 100;
            
            // 记录完成信息
            TaskLogger.logSuccess(`任务 ${task.name} 已完成`);
            
            // 保存更新的任务状态
            this._saveTaskState(taskId);
            
            // 通知任务状态变化
            this._notifyTaskUpdate(taskId, { status: 'completed', result });
        }
    }
    
    /**
     * 处理任务错误
     * @param {Object} data - 错误数据
     * @private
     */
    _handleTaskError(data) {
        const { taskId, error } = data;
        const task = this.tasks.get(taskId);
        
        if (task) {
            // 更新任务状态
            task.status = 'failed';
            task.endTime = Date.now();
            task.error = error;
            
            // 记录错误信息
            TaskLogger.logError(`任务 ${task.name} 失败: ${error}`);
            
            // 保存更新的任务状态
            this._saveTaskState(taskId);
            
            // 通知任务状态变化
            this._notifyTaskUpdate(taskId, { status: 'failed', error });
        }
    }
    
    /**
     * 处理账户任务状态更新
     * @param {Object} data - 账户状态数据
     * @private
     */
    _handleAccountStatusUpdate(data) {
        const { taskId, accountId, status, result } = data;
        const task = this.tasks.get(taskId);
        
        if (task) {
            // 初始化账户状态数组（如果不存在）
            if (!task.accountStatus) {
                task.accountStatus = {};
            }
            
            // 更新特定账户的状态
            task.accountStatus[accountId] = {
                status,
                result,
                timestamp: Date.now()
            };
            
            // 计算任务整体进度
            this._calculateTaskProgress(task);
            
            // 记录账户状态变更
            const statusText = this._getAccountStatusText(status);
            TaskLogger.logInfo(`账户 ${accountId} ${statusText}`);
            
            // 通知账户状态变化
            this._notifyTaskUpdate(taskId, { 
                accountStatus: task.accountStatus,
                accountId,
                accountState: status
            });
        }
    }
    
    /**
     * 获取账户状态文本
     * @param {string} status - 状态代码
     * @returns {string} 状态文本
     * @private
     */
    _getAccountStatusText(status) {
        switch (status) {
            case 'pending': return '等待执行';
            case 'running': return '正在执行';
            case 'success': return '执行成功';
            case 'failed': return '执行失败';
            default: return status;
        }
    }
    
    /**
     * 计算任务整体进度
     * @param {Object} task - 任务对象
     * @private
     */
    _calculateTaskProgress(task) {
        if (!task.accountStatus || !task.accountIds?.length) return;
        
        const totalAccounts = task.accountIds.length;
        const completedAccounts = Object.values(task.accountStatus).filter(
            status => ['success', 'failed'].includes(status.status)
        ).length;
        
        // 计算进度百分比
        task.progress = Math.round((completedAccounts / totalAccounts) * 100);
        
        // 如果所有账户都完成了，更新任务状态
        if (completedAccounts === totalAccounts) {
            const failedAccounts = Object.values(task.accountStatus).filter(
                status => status.status === 'failed'
            ).length;
            
            // 根据失败账户数决定任务最终状态
            if (failedAccounts === totalAccounts) {
                task.status = 'failed';
            } else if (failedAccounts > 0) {
                task.status = 'completed_with_errors';
            } else {
                task.status = 'completed';
            }
            
            task.endTime = Date.now();
            this._saveTaskState(task.id);
        }
    }
    
    /**
     * 保存任务状态到存储
     * @param {string} taskId - 任务ID
     * @private
     */
    async _saveTaskState(taskId) {
        try {
            const task = this.tasks.get(taskId);
            if (task) {
                // 保存所有任务到localStorage（替代IPC调用）
                this._saveAllTasks();
                console.log(`已保存任务 ${taskId} 的状态`);
            }
        } catch (error) {
            console.error(`保存任务 ${taskId} 状态失败:`, error);
        }
    }
    
    /**
     * 保存所有任务到本地存储
     * @private
     */
    _saveAllTasks() {
        try {
            const allTasks = Array.from(this.tasks.values());
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allTasks));
        } catch (error) {
            console.error('保存所有任务失败:', error);
        }
    }
    
    /**
     * 通知任务更新
     * @param {string} taskId - 任务ID
     * @param {Object} updateData - 更新数据
     * @private
     */
    _notifyTaskUpdate(taskId, updateData) {
        const listeners = this.taskEventListeners.get(taskId);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(taskId, updateData);
                } catch (error) {
                    console.error('执行任务监听器出错:', error);
                }
            });
        }
    }
    
    /**
     * 获取所有批量任务
     * @returns {Promise<Array>} 任务数组
     */
    async getAllTasks() {
        // 如果已加载任务，则直接返回
        if (this.tasks.size > 0) {
            return Array.from(this.tasks.values());
        }
        
        // 否则从本地存储获取
        try {
            const savedTasksJson = localStorage.getItem(STORAGE_KEY);
            const tasksData = savedTasksJson ? JSON.parse(savedTasksJson) : [];
            
            if (Array.isArray(tasksData)) {
                // 更新本地缓存
                tasksData.forEach(task => {
                    this.tasks.set(task.id, task);
                });
                return tasksData;
            }
            return [];
        } catch (error) {
            console.error('获取批量任务列表失败:', error);
            return [];
        }
    }
    
    /**
     * 根据ID获取任务
     * @param {string} taskId - 任务ID
     * @returns {Promise<Object|null>} 任务对象
     */
    async getTaskById(taskId) {
        // 先检查本地缓存
        if (this.tasks.has(taskId)) {
            return this.tasks.get(taskId);
        }
        
        // 从本地存储获取
        try {
            const savedTasksJson = localStorage.getItem(STORAGE_KEY);
            const tasksData = savedTasksJson ? JSON.parse(savedTasksJson) : [];
            
            const task = tasksData.find(t => t.id === taskId);
            if (task) {
                this.tasks.set(taskId, task);
                return task;
            }
            return null;
        } catch (error) {
            console.error(`获取任务 ${taskId} 失败:`, error);
            return null;
        }
    }
    
    /**
     * 添加新任务
     * @param {Object} taskData - 任务数据
     * @returns {Promise<Object>} 添加的任务
     */
    async addTask(taskData) {
        try {
            // 确保任务有唯一ID
            if (!taskData.id) {
                taskData.id = 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
            }
            
            // 设置创建时间和默认状态
            taskData.createTime = Date.now();
            taskData.status = 'idle';
            taskData.progress = 0;
            
            // 保存到本地（替代IPC调用）
            this.tasks.set(taskData.id, taskData);
            this._saveAllTasks();
            
            console.log(`已添加新任务: ${taskData.name} (${taskData.id})`);
            
            return taskData;
        } catch (error) {
            console.error('添加批量任务失败:', error);
            throw error;
        }
    }
    
    /**
     * 更新任务
     * @param {string} taskId - 任务ID
     * @param {Object} updateData - 更新数据
     * @returns {Promise<Object>} 更新后的任务
     */
    async updateTask(taskId, updateData) {
        try {
            // 检查任务是否存在
            if (!this.tasks.has(taskId)) {
                throw new Error(`任务 ${taskId} 不存在`);
            }
            
            // 获取现有任务数据并合并更新
            const existingTask = this.tasks.get(taskId);
            const updatedTask = { ...existingTask, ...updateData };
            
            // 保存到本地（替代IPC调用）
            this.tasks.set(taskId, updatedTask);
            this._saveAllTasks();
            
            console.log(`已更新任务: ${updatedTask.name} (${taskId})`);
            
            return updatedTask;
        } catch (error) {
            console.error(`更新任务 ${taskId} 失败:`, error);
            throw error;
        }
    }
    
    /**
     * 删除任务
     * @param {string} taskId - 任务ID
     * @returns {Promise<boolean>} 是否成功
     */
    async deleteTask(taskId) {
        try {
            // 检查任务是否存在
            if (!this.tasks.has(taskId)) {
                throw new Error(`任务 ${taskId} 不存在`);
            }
            
            // 如果任务正在运行，先停止
            const task = this.tasks.get(taskId);
            if (task.status === 'running') {
                await this.stopTask(taskId);
            }
            
            // 从本地删除（替代IPC调用）
            this.tasks.delete(taskId);
            this._saveAllTasks();
            
            // 清理任务监听器
            this.taskEventListeners.delete(taskId);
            
            console.log(`已删除任务: ${taskId}`);
            return true;
        } catch (error) {
            console.error(`删除任务 ${taskId} 失败:`, error);
            throw error;
        }
    }
    
    /**
     * 启动任务
     * @param {string} taskId - 任务ID
     * @returns {Promise<Object>} 启动后的任务
     */
    async startTask(taskId) {
        try {
            // 检查任务是否存在
            if (!this.tasks.has(taskId)) {
                throw new Error(`任务 ${taskId} 不存在`);
            }
            
            const task = this.tasks.get(taskId);
            
            // 检查任务是否可以启动
            if (task.status === 'running') {
                throw new Error('任务已在运行中');
            }
            
            // 更新任务状态
            task.status = 'running';
            task.startTime = Date.now();
            task.progress = 0;
            task.error = null;
            
            // 初始化账户状态
            task.accountStatus = {};
            task.accountIds.forEach(accountId => {
                task.accountStatus[accountId] = {
                    status: 'pending',
                    timestamp: Date.now()
                };
            });
            
            // 保存更新
            await this._saveTaskState(taskId);
            
            // 通知任务开始
            this._notifyTaskUpdate(taskId, { status: 'running' });
            
            // 通过脚本执行管理器启动任务
            await scriptExecutionManager.executeTask(task);
            
            TaskLogger.logInfo(`任务 ${task.name} 已启动`);
            
            return task;
        } catch (error) {
            console.error(`启动任务 ${taskId} 失败:`, error);
            
            // 更新任务状态为失败
            if (this.tasks.has(taskId)) {
                const task = this.tasks.get(taskId);
                task.status = 'failed';
                task.error = error.message;
                await this._saveTaskState(taskId);
                
                // 通知任务失败
                this._notifyTaskUpdate(taskId, { status: 'failed', error: error.message });
            }
            
            throw error;
        }
    }
    
    /**
     * 暂停任务
     * @param {string} taskId - 任务ID
     * @returns {Promise<Object>} 暂停后的任务
     */
    async pauseTask(taskId) {
        try {
            // 检查任务是否存在
            if (!this.tasks.has(taskId)) {
                throw new Error(`任务 ${taskId} 不存在`);
            }
            
            const task = this.tasks.get(taskId);
            
            // 检查任务是否可以暂停
            if (task.status !== 'running') {
                throw new Error('只有运行中的任务才能暂停');
            }
            
            // 暂停执行
            await scriptExecutionManager.pauseTask(taskId);
            
            // 更新任务状态
            task.status = 'paused';
            await this._saveTaskState(taskId);
            
            // 通知任务暂停
            this._notifyTaskUpdate(taskId, { status: 'paused' });
            
            TaskLogger.logInfo(`任务 ${task.name} 已暂停`);
            
            return task;
        } catch (error) {
            console.error(`暂停任务 ${taskId} 失败:`, error);
            throw error;
        }
    }
    
    /**
     * 停止任务
     * @param {string} taskId - 任务ID
     * @returns {Promise<Object>} 停止后的任务
     */
    async stopTask(taskId) {
        try {
            // 检查任务是否存在
            if (!this.tasks.has(taskId)) {
                throw new Error(`任务 ${taskId} 不存在`);
            }
            
            const task = this.tasks.get(taskId);
            
            // 检查任务是否可以停止
            if (task.status !== 'running' && task.status !== 'paused') {
                throw new Error('只有运行中或已暂停的任务才能停止');
            }
            
            // 停止执行
            await scriptExecutionManager.stopTask(taskId);
            
            // 更新任务状态
            task.status = 'stopped';
            task.endTime = Date.now();
            await this._saveTaskState(taskId);
            
            // 通知任务停止
            this._notifyTaskUpdate(taskId, { status: 'stopped' });
            
            TaskLogger.logWarning(`任务 ${task.name} 已停止`);
            
            return task;
        } catch (error) {
            console.error(`停止任务 ${taskId} 失败:`, error);
            throw error;
        }
    }
    
    /**
     * 获取任务统计数据
     * @returns {Promise<Object>} 统计数据
     */
    async getTaskStatistics() {
        try {
            let tasks = Array.from(this.tasks.values());
            
            // 如果本地没有任务，从本地存储获取
            if (tasks.length === 0) {
                await this.getAllTasks();
                tasks = Array.from(this.tasks.values());
            }
            
            // 计算统计数据
            const totalTasks = tasks.length;
            const runningTasks = tasks.filter(t => t.status === 'running').length;
            const completedTasks = tasks.filter(t => t.status === 'completed').length;
            const failedTasks = tasks.filter(t => t.status === 'failed').length;
            
            // 计算总账户数
            let totalAccounts = 0;
            tasks.forEach(task => {
                totalAccounts += task.accountIds?.length || 0;
            });
            
            return {
                totalTasks,
                runningTasks,
                completedTasks,
                failedTasks,
                totalAccounts
            };
        } catch (error) {
            console.error('获取任务统计数据失败:', error);
            return {
                totalTasks: 0,
                runningTasks: 0,
                completedTasks: 0,
                failedTasks: 0,
                totalAccounts: 0
            };
        }
    }
    
    /**
     * 添加任务事件监听器
     * @param {string} taskId - 任务ID
     * @param {Function} listener - 监听器函数
     * @returns {Function} 移除监听器的函数
     */
    addTaskEventListener(taskId, listener) {
        if (!this.taskEventListeners.has(taskId)) {
            this.taskEventListeners.set(taskId, new Set());
        }
        
        const listeners = this.taskEventListeners.get(taskId);
        listeners.add(listener);
        
        // 返回移除监听器的函数
        return () => {
            if (this.taskEventListeners.has(taskId)) {
                const listeners = this.taskEventListeners.get(taskId);
                listeners.delete(listener);
                
                if (listeners.size === 0) {
                    this.taskEventListeners.delete(taskId);
                }
            }
        };
    }
} 