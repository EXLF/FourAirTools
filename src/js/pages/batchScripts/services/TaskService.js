/**
 * TaskService - 任务业务逻辑层
 * 职责：封装任务管理的高级业务逻辑，提供统一的任务操作接口
 * 
 * 功能包括：
 * - 任务创建和配置验证
 * - 任务生命周期管理
 * - 任务状态统一管理
 * - 任务执行策略
 * - 任务监控和统计
 * - 后台任务管理
 */

import { TaskState } from '../core/TaskStateManager.js';
import { isFeatureEnabled } from '../infrastructure/types.js';

export class TaskService {
    constructor(options = {}) {
        // 依赖注入
        this.taskStateManager = options.taskStateManager || null;
        this.batchTaskManager = options.batchTaskManager || null;
        this.scriptService = options.scriptService || null;
        
        // 配置选项
        this.config = {
            maxConcurrentTasks: options.maxConcurrentTasks || 3,
            taskTimeout: options.taskTimeout || 30 * 60 * 1000, // 30分钟
            autoCleanup: options.autoCleanup !== false,
            enableBackgroundTasks: options.enableBackgroundTasks !== false,
            enableTaskPriority: options.enableTaskPriority !== false,
            ...options.config
        };
        
        // 内部状态
        this.activeTasks = new Map();
        this.taskQueue = [];
        this.taskPriorities = new Map();
        this.taskMetrics = {
            totalCreated: 0,
            totalCompleted: 0,
            totalFailed: 0,
            totalCancelled: 0,
            averageExecutionTime: 0
        };
        
        // 事件系统
        this.eventListeners = new Map();
        
        console.log('[TaskService] 任务服务初始化完成');
    }

    /**
     * 创建新任务
     * @param {Object} taskConfig - 任务配置
     * @returns {Promise<Object>} 创建结果
     */
    async createTask(taskConfig) {
        try {
            console.log('[TaskService] 创建新任务:', taskConfig);
            
            // 验证任务配置
            const validationResult = this.validateTaskConfig(taskConfig);
            if (!validationResult.isValid) {
                throw new Error(`任务配置无效: ${validationResult.errors.join(', ')}`);
            }
            
            // 生成任务ID
            const taskId = this.generateTaskId(taskConfig);
            
            // 构建完整的任务数据
            const taskData = {
                id: taskId,
                name: taskConfig.name || `任务_${taskId}`,
                scriptType: taskConfig.scriptType,
                scriptId: taskConfig.scriptId,
                
                // 执行配置
                accounts: taskConfig.accounts || [],
                proxyConfig: taskConfig.proxyConfig || null,
                scriptParams: taskConfig.scriptParams || {},
                
                // 任务设置
                priority: taskConfig.priority || 'normal',
                timeout: taskConfig.timeout || this.config.taskTimeout,
                retryCount: taskConfig.retryCount || 0,
                maxRetries: taskConfig.maxRetries || 3,
                
                // 状态信息
                status: TaskState.PENDING,
                progress: 0,
                
                // 时间戳
                createdAt: Date.now(),
                updatedAt: Date.now(),
                
                // 元数据
                metadata: {
                    ...taskConfig.metadata,
                    source: 'TaskService',
                    version: '2.0'
                }
            };
            
            // 业务逻辑：任务配置增强
            await this.enhanceTaskConfig(taskData);
            
            // 使用BatchTaskManager创建任务（如果可用）
            if (this.batchTaskManager) {
                try {
                    const result = await this.batchTaskManager.addTask(taskData);
                    if (result.success) {
                        taskData.id = result.taskId || taskData.id;
                    }
                } catch (error) {
                    console.warn('[TaskService] BatchTaskManager创建失败，使用内部管理:', error);
                }
            }
            
            // 注册到内部管理
            this.activeTasks.set(taskId, taskData);
            
            // 设置任务状态
            if (this.taskStateManager) {
                this.taskStateManager.setState(taskId, TaskState.PENDING, {
                    taskInstanceId: taskId,
                    scriptId: taskConfig.scriptId,
                    createdBy: 'TaskService'
                });
            }
            
            // 更新统计
            this.taskMetrics.totalCreated++;
            
            // 触发事件
            this.emitEvent('taskCreated', { taskId, taskData });
            
            console.log(`[TaskService] 任务创建成功: ${taskId}`);
            
            return {
                success: true,
                taskId,
                taskData,
                message: '任务创建成功'
            };
            
        } catch (error) {
            console.error('[TaskService] 创建任务失败:', error);
            return {
                success: false,
                error: {
                    type: 'TASK_CREATION_FAILED',
                    message: error.message,
                    details: error
                }
            };
        }
    }

    /**
     * 验证任务配置
     * @param {Object} taskConfig - 任务配置
     * @returns {Object} 验证结果
     */
    validateTaskConfig(taskConfig) {
        const errors = [];
        
        // 必须字段验证
        if (!taskConfig) {
            errors.push('任务配置不能为空');
            return { isValid: false, errors };
        }
        
        if (!taskConfig.scriptType && !taskConfig.scriptId) {
            errors.push('必须指定脚本类型或脚本ID');
        }
        
        // 账户配置验证
        if (taskConfig.accounts) {
            if (!Array.isArray(taskConfig.accounts)) {
                errors.push('账户列表必须是数组');
            } else if (taskConfig.accounts.length === 0) {
                errors.push('至少需要一个账户');
            } else {
                // 验证账户数据格式
                const invalidAccounts = taskConfig.accounts.filter(account => {
                    return !account || typeof account !== 'object' || !account.id;
                });
                
                if (invalidAccounts.length > 0) {
                    errors.push(`发现 ${invalidAccounts.length} 个无效账户配置`);
                }
            }
        }
        
        // 代理配置验证
        if (taskConfig.proxyConfig && typeof taskConfig.proxyConfig !== 'object') {
            errors.push('代理配置必须是对象');
        }
        
        // 脚本参数验证
        if (taskConfig.scriptParams && typeof taskConfig.scriptParams !== 'object') {
            errors.push('脚本参数必须是对象');
        }
        
        // 优先级验证
        if (taskConfig.priority && !['low', 'normal', 'high', 'critical'].includes(taskConfig.priority)) {
            errors.push('任务优先级必须是: low, normal, high, critical 之一');
        }
        
        // 超时时间验证
        if (taskConfig.timeout && (typeof taskConfig.timeout !== 'number' || taskConfig.timeout <= 0)) {
            errors.push('超时时间必须是正数');
        }
        
        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * 增强任务配置（添加业务逻辑）
     * @param {Object} taskData - 任务数据
     */
    async enhanceTaskConfig(taskData) {
        try {
            // 脚本兼容性检查
            if (this.scriptService) {
                const compatibilityResult = await this.scriptService.checkScriptCompatibility(
                    taskData.scriptId,
                    {
                        accounts: taskData.accounts,
                        proxyConfig: taskData.proxyConfig
                    }
                );
                
                if (!compatibilityResult.isCompatible) {
                    console.warn('[TaskService] 脚本兼容性警告:', compatibilityResult.warnings);
                    taskData.metadata.compatibilityWarnings = compatibilityResult.warnings;
                }
            }
            
            // 添加预估执行时间
            taskData.estimatedDuration = this.estimateTaskDuration(taskData);
            
            // 设置任务优先级权重
            if (this.config.enableTaskPriority) {
                taskData.priorityWeight = this.calculatePriorityWeight(taskData.priority);
            }
            
            // 添加资源需求评估
            taskData.resourceRequirements = {
                memory: this.estimateMemoryUsage(taskData),
                network: this.estimateNetworkUsage(taskData),
                concurrency: taskData.accounts.length
            };
            
        } catch (error) {
            console.warn('[TaskService] 任务配置增强失败:', error);
        }
    }

    /**
     * 启动任务执行
     * @param {string} taskId - 任务ID
     * @param {Object} options - 执行选项
     * @returns {Promise<Object>} 执行结果
     */
    async startTask(taskId, options = {}) {
        try {
            console.log(`[TaskService] 启动任务: ${taskId}`);
            
            const taskData = this.activeTasks.get(taskId);
            if (!taskData) {
                throw new Error(`任务未找到: ${taskId}`);
            }
            
            // 检查任务状态
            const currentState = this.taskStateManager?.getState(taskId);
            if (currentState && currentState.state === TaskState.RUNNING) {
                throw new Error('任务已在运行中');
            }
            
            // 检查并发限制
            if (this.getRunningTasksCount() >= this.config.maxConcurrentTasks) {
                if (options.force) {
                    console.warn('[TaskService] 强制执行，忽略并发限制');
                } else {
                    // 加入队列等待执行
                    return this.queueTask(taskId, options);
                }
            }
            
            // 更新任务状态
            taskData.status = TaskState.RUNNING;
            taskData.startedAt = Date.now();
            taskData.updatedAt = Date.now();
            
            // 设置状态管理器状态
            if (this.taskStateManager) {
                this.taskStateManager.setState(taskId, TaskState.RUNNING, {
                    taskInstanceId: taskId,
                    scriptId: taskData.scriptId,
                    startedBy: 'TaskService'
                });
            }
            
            // 使用BatchTaskManager执行（如果可用）
            let executionResult = null;
            if (this.batchTaskManager) {
                try {
                    executionResult = await this.batchTaskManager.startTask(taskId);
                } catch (error) {
                    console.warn('[TaskService] BatchTaskManager执行失败，使用内部执行:', error);
                }
            }
            
            // 如果BatchTaskManager不可用或失败，使用脚本服务执行
            if (!executionResult && this.scriptService) {
                try {
                    const executionConfig = {
                        wallets: taskData.accounts,
                        proxyConfig: taskData.proxyConfig,
                        scriptParams: taskData.scriptParams
                    };
                    
                    executionResult = await this.scriptService.executeScript(
                        taskData.scriptId,
                        executionConfig
                    );
                } catch (error) {
                    console.error('[TaskService] ScriptService执行失败:', error);
                    throw error;
                }
            }
            
            // 处理执行结果
            if (executionResult && executionResult.success) {
                taskData.executionId = executionResult.executionId;
                taskData.metadata.executionMethod = executionResult.executionMethod || 'unknown';
                
                this.emitEvent('taskStarted', { taskId, taskData, executionResult });
                
                return {
                    success: true,
                    taskId,
                    executionId: executionResult.executionId,
                    message: '任务启动成功'
                };
            } else {
                throw new Error(executionResult?.error?.message || '任务启动失败');
            }
            
        } catch (error) {
            console.error(`[TaskService] 启动任务失败: ${taskId}`, error);
            
            // 更新任务状态为失败
            await this.updateTaskStatus(taskId, TaskState.FAILED, {
                error: error.message,
                failedAt: Date.now()
            });
            
            return {
                success: false,
                error: {
                    type: 'TASK_START_FAILED',
                    message: error.message,
                    taskId
                }
            };
        }
    }

    /**
     * 停止任务执行
     * @param {string} taskId - 任务ID
     * @param {Object} options - 停止选项
     * @returns {Promise<Object>} 停止结果
     */
    async stopTask(taskId, options = {}) {
        try {
            console.log(`[TaskService] 停止任务: ${taskId}`);
            
            const taskData = this.activeTasks.get(taskId);
            if (!taskData) {
                throw new Error(`任务未找到: ${taskId}`);
            }
            
            // 使用BatchTaskManager停止（如果可用）
            if (this.batchTaskManager) {
                try {
                    await this.batchTaskManager.stopTask(taskId);
                } catch (error) {
                    console.warn('[TaskService] BatchTaskManager停止失败:', error);
                }
            }
            
            // 使用ScriptService停止脚本执行
            if (this.scriptService && taskData.executionId) {
                try {
                    await this.scriptService.stopScript(taskData.executionId);
                } catch (error) {
                    console.warn('[TaskService] ScriptService停止失败:', error);
                }
            }
            
            // 更新任务状态
            const newState = options.force ? TaskState.CANCELLED : TaskState.CANCELLED;
            await this.updateTaskStatus(taskId, newState, {
                stoppedAt: Date.now(),
                stoppedBy: 'TaskService',
                reason: options.reason || 'Manual stop'
            });
            
            this.emitEvent('taskStopped', { taskId, taskData, options });
            
            return {
                success: true,
                taskId,
                message: '任务停止成功'
            };
            
        } catch (error) {
            console.error(`[TaskService] 停止任务失败: ${taskId}`, error);
            return {
                success: false,
                error: {
                    type: 'TASK_STOP_FAILED',
                    message: error.message,
                    taskId
                }
            };
        }
    }

    /**
     * 更新任务状态
     * @param {string} taskId - 任务ID
     * @param {string} newState - 新状态
     * @param {Object} metadata - 状态元数据
     * @returns {Promise<boolean>} 更新是否成功
     */
    async updateTaskStatus(taskId, newState, metadata = {}) {
        try {
            const taskData = this.activeTasks.get(taskId);
            if (taskData) {
                taskData.status = newState;
                taskData.updatedAt = Date.now();
                
                // 合并元数据
                Object.assign(taskData.metadata, metadata);
            }
            
            // 更新状态管理器
            if (this.taskStateManager) {
                this.taskStateManager.setState(taskId, newState, {
                    taskInstanceId: taskId,
                    ...metadata
                });
            }
            
            // 更新统计
            this.updateTaskMetrics(newState);
            
            // 触发事件
            this.emitEvent('taskStatusUpdated', { taskId, newState, metadata });
            
            return true;
        } catch (error) {
            console.error('[TaskService] 更新任务状态失败:', error);
            return false;
        }
    }

    /**
     * 获取任务详情
     * @param {string} taskId - 任务ID
     * @returns {Object|null} 任务详情
     */
    getTask(taskId) {
        const taskData = this.activeTasks.get(taskId);
        if (!taskData) {
            return null;
        }
        
        // 从状态管理器获取最新状态
        const stateData = this.taskStateManager?.getState(taskId);
        
        return {
            ...taskData,
            currentState: stateData?.state || taskData.status,
            stateHistory: this.taskStateManager?.getStateHistory(taskId) || [],
            runtime: this.calculateTaskRuntime(taskData)
        };
    }

    /**
     * 获取所有任务列表
     * @param {Object} filter - 过滤条件
     * @returns {Array} 任务列表
     */
    getAllTasks(filter = {}) {
        const tasks = Array.from(this.activeTasks.values());
        
        return tasks.filter(task => {
            if (filter.status && task.status !== filter.status) {
                return false;
            }
            if (filter.scriptId && task.scriptId !== filter.scriptId) {
                return false;
            }
            if (filter.priority && task.priority !== filter.priority) {
                return false;
            }
            return true;
        }).map(task => this.getTask(task.id));
    }

    /**
     * 获取运行中的任务数量
     * @returns {number} 运行中任务数量
     */
    getRunningTasksCount() {
        return Array.from(this.activeTasks.values()).filter(
            task => task.status === TaskState.RUNNING
        ).length;
    }

    /**
     * 将任务加入队列
     * @param {string} taskId - 任务ID
     * @param {Object} options - 队列选项
     * @returns {Promise<Object>} 队列结果
     */
    async queueTask(taskId, options = {}) {
        const taskData = this.activeTasks.get(taskId);
        if (!taskData) {
            throw new Error(`任务未找到: ${taskId}`);
        }
        
        // 添加到队列
        this.taskQueue.push({
            taskId,
            priority: taskData.priorityWeight || 0,
            queuedAt: Date.now(),
            options
        });
        
        // 按优先级排序队列
        if (this.config.enableTaskPriority) {
            this.taskQueue.sort((a, b) => b.priority - a.priority);
        }
        
        console.log(`[TaskService] 任务已加入队列: ${taskId}, 队列长度: ${this.taskQueue.length}`);
        
        return {
            success: true,
            queued: true,
            position: this.taskQueue.findIndex(item => item.taskId === taskId) + 1,
            message: '任务已加入执行队列'
        };
    }

    /**
     * 处理任务队列
     */
    async processTaskQueue() {
        while (this.taskQueue.length > 0 && this.getRunningTasksCount() < this.config.maxConcurrentTasks) {
            const queueItem = this.taskQueue.shift();
            try {
                await this.startTask(queueItem.taskId, queueItem.options);
            } catch (error) {
                console.error('[TaskService] 队列任务执行失败:', error);
            }
        }
    }

    /**
     * 计算任务运行时间
     * @param {Object} taskData - 任务数据
     * @returns {Object} 运行时间信息
     */
    calculateTaskRuntime(taskData) {
        const now = Date.now();
        const result = {
            created: taskData.createdAt ? now - taskData.createdAt : 0,
            running: 0,
            total: 0
        };
        
        if (taskData.startedAt) {
            result.running = now - taskData.startedAt;
        }
        
        if (taskData.status === TaskState.COMPLETED || taskData.status === TaskState.FAILED) {
            result.total = (taskData.completedAt || taskData.failedAt || now) - taskData.startedAt;
        }
        
        return result;
    }

    /**
     * 预估任务执行时间
     * @param {Object} taskData - 任务数据
     * @returns {number} 预估时间（毫秒）
     */
    estimateTaskDuration(taskData) {
        // 基础时间：每个账户 30 秒
        const baseTimePerAccount = 30 * 1000;
        const accountCount = taskData.accounts?.length || 1;
        
        // 脚本复杂度权重
        const complexityMultiplier = this.getScriptComplexityMultiplier(taskData.scriptId);
        
        return accountCount * baseTimePerAccount * complexityMultiplier;
    }

    /**
     * 获取脚本复杂度权重
     * @param {string} scriptId - 脚本ID
     * @returns {number} 复杂度权重
     */
    getScriptComplexityMultiplier(scriptId) {
        // 这里可以根据脚本类型返回不同的复杂度权重
        const complexityMap = {
            'simple': 1.0,
            'medium': 1.5,
            'complex': 2.0,
            'very_complex': 3.0
        };
        
        // 默认为中等复杂度
        return complexityMap['medium'];
    }

    /**
     * 计算优先级权重
     * @param {string} priority - 优先级
     * @returns {number} 权重值
     */
    calculatePriorityWeight(priority) {
        const weights = {
            'low': 1,
            'normal': 2,
            'high': 3,
            'critical': 4
        };
        return weights[priority] || weights['normal'];
    }

    /**
     * 预估内存使用量
     * @param {Object} taskData - 任务数据
     * @returns {number} 预估内存（MB）
     */
    estimateMemoryUsage(taskData) {
        const baseMemory = 50; // 50MB 基础内存
        const memoryPerAccount = 10; // 每个账户 10MB
        return baseMemory + (taskData.accounts?.length || 1) * memoryPerAccount;
    }

    /**
     * 预估网络使用量
     * @param {Object} taskData - 任务数据
     * @returns {number} 预估网络使用（KB/s）
     */
    estimateNetworkUsage(taskData) {
        const baseNetwork = 100; // 100KB/s 基础网络
        const networkPerAccount = 50; // 每个账户 50KB/s
        return baseNetwork + (taskData.accounts?.length || 1) * networkPerAccount;
    }

    /**
     * 更新任务统计
     * @param {string} newState - 新状态
     */
    updateTaskMetrics(newState) {
        switch (newState) {
            case TaskState.COMPLETED:
                this.taskMetrics.totalCompleted++;
                break;
            case TaskState.FAILED:
                this.taskMetrics.totalFailed++;
                break;
            case TaskState.CANCELLED:
                this.taskMetrics.totalCancelled++;
                break;
        }
    }

    /**
     * 生成任务ID
     * @param {Object} taskConfig - 任务配置
     * @returns {string} 任务ID
     */
    generateTaskId(taskConfig) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        const scriptPrefix = taskConfig.scriptId ? taskConfig.scriptId.substr(0, 8) : 'task';
        return `${scriptPrefix}_${timestamp}_${random}`;
    }

    /**
     * 事件发射器
     * @param {string} eventName - 事件名称
     * @param {Object} data - 事件数据
     */
    emitEvent(eventName, data) {
        const listeners = this.eventListeners.get(eventName) || [];
        listeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`[TaskService] 事件监听器错误 (${eventName}):`, error);
            }
        });
    }

    /**
     * 添加事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} listener - 监听器函数
     */
    addEventListener(eventName, listener) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        this.eventListeners.get(eventName).push(listener);
    }

    /**
     * 移除事件监听器
     * @param {string} eventName - 事件名称
     * @param {Function} listener - 监听器函数
     */
    removeEventListener(eventName, listener) {
        const listeners = this.eventListeners.get(eventName);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
    }

    /**
     * 获取服务统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            ...this.taskMetrics,
            activeTasks: this.activeTasks.size,
            queuedTasks: this.taskQueue.length,
            runningTasks: this.getRunningTasksCount(),
            config: this.config,
            uptime: Date.now() - (this.startTime || Date.now())
        };
    }

    /**
     * 清理资源
     */
    cleanup() {
        // 清空任务队列
        this.taskQueue = [];
        
        // 清空事件监听器
        this.eventListeners.clear();
        
        // 记录清理日志
        console.log('[TaskService] 资源清理完成');
    }
}

// 导出任务状态枚举以供外部使用
export { TaskState }; 