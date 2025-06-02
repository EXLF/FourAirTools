/**
 * 任务状态管理器 v2.0 - 统一状态管理重构版本
 * 职责：任务状态机实现、状态持久化、状态变更通知、僵尸任务清理
 * 重构重点：状态一致性、僵尸任务清理、全局状态统一管理
 */

// 任务状态枚举
export const TaskState = {
    PENDING: 'pending',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    ZOMBIE: 'zombie' // 新增：僵尸状态，用于标记异常终止的任务
};

// 有效的状态转换
const STATE_TRANSITIONS = {
    [TaskState.PENDING]: [TaskState.RUNNING, TaskState.CANCELLED, TaskState.ZOMBIE],
    [TaskState.RUNNING]: [TaskState.PAUSED, TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED, TaskState.ZOMBIE],
    [TaskState.PAUSED]: [TaskState.RUNNING, TaskState.CANCELLED, TaskState.ZOMBIE],
    [TaskState.COMPLETED]: [], // 终态
    [TaskState.FAILED]: [TaskState.RUNNING, TaskState.ZOMBIE], // 可以重新运行
    [TaskState.CANCELLED]: [], // 终态
    [TaskState.ZOMBIE]: [TaskState.RUNNING] // 僵尸任务可以重新启动
};

// 状态配置常量
const STATE_CONFIG = {
    // 僵尸任务检测间隔（5分钟）
    ZOMBIE_CHECK_INTERVAL: 5 * 60 * 1000,
    // 任务超时时间（30分钟）
    TASK_TIMEOUT: 30 * 60 * 1000,
    // 已完成任务保留时间（24小时）
    COMPLETED_TASK_RETENTION: 24 * 60 * 60 * 1000,
    // 最大状态历史记录数
    MAX_STATE_HISTORY: 10
};

export class TaskStateManager {
    constructor() {
        this.states = new Map(); // 任务状态存储
        this.stateHistory = new Map(); // 状态变更历史
        this.observers = new Set(); // 状态变更观察者
        this.persistenceKey = 'fa_task_states_v2'; // localStorage键（版本2）
        this.globalState = { // 全局状态管理
            currentTaskInstanceId: null,
            currentExecutionId: null,
            activeScriptId: null,
            lastActivity: Date.now()
        };
        
        // 僵尸任务检测定时器
        this.zombieCheckTimer = null;
        
        // 初始化
        this.loadPersistedStates();
        this.startZombieTaskDetection();
        this.migrateFromOldVersion();
        
        console.log('[TaskStateManager v2.0] 统一状态管理器初始化完成');
    }

    /**
     * 设置任务状态（增强版）
     * @param {string} taskId - 任务ID
     * @param {string} newState - 新状态
     * @param {Object} metadata - 状态元数据
     * @param {boolean} force - 是否强制设置（跳过转换验证）
     * @returns {boolean} 是否设置成功
     */
    setState(taskId, newState, metadata = {}, force = false) {
        try {
            const currentState = this.getState(taskId);
            
            // 验证状态转换是否有效（除非强制设置）
            if (!force && currentState && !this.isValidTransition(currentState.state, newState)) {
                console.warn(`[TaskStateManager] 无效的状态转换: ${currentState.state} -> ${newState} (任务: ${taskId})`);
                return false;
            }

            const stateData = {
                state: newState,
                timestamp: Date.now(),
                previousState: currentState?.state || null,
                executionId: metadata.executionId || this.globalState.currentExecutionId,
                taskInstanceId: metadata.taskInstanceId || this.globalState.currentTaskInstanceId,
                metadata: {
                    ...metadata,
                    transitionTime: Date.now(),
                    forced: force
                }
            };

            // 设置状态
            this.states.set(taskId, stateData);
            
            // 记录状态历史
            this.recordStateHistory(taskId, stateData);
            
            // 更新全局状态
            this.updateGlobalState(taskId, newState, metadata);
            
            // 持久化状态
            this.persistStates();
            
            // 通知观察者
            this.notifyObservers(taskId, stateData);
            
            console.log(`[TaskStateManager] 任务 ${taskId} 状态变更: ${currentState?.state || 'null'} -> ${newState}${force ? ' (强制)' : ''}`);
            return true;
        } catch (error) {
            console.error('[TaskStateManager] 设置状态失败:', error);
            return false;
        }
    }

    /**
     * 记录状态变更历史
     * @param {string} taskId - 任务ID
     * @param {Object} stateData - 状态数据
     */
    recordStateHistory(taskId, stateData) {
        if (!this.stateHistory.has(taskId)) {
            this.stateHistory.set(taskId, []);
        }
        
        const history = this.stateHistory.get(taskId);
        history.push({
            state: stateData.state,
            timestamp: stateData.timestamp,
            metadata: stateData.metadata
        });
        
        // 限制历史记录数量
        if (history.length > STATE_CONFIG.MAX_STATE_HISTORY) {
            history.splice(0, history.length - STATE_CONFIG.MAX_STATE_HISTORY);
        }
    }

    /**
     * 更新全局状态
     * @param {string} taskId - 任务ID
     * @param {string} newState - 新状态
     * @param {Object} metadata - 元数据
     */
    updateGlobalState(taskId, newState, metadata) {
        this.globalState.lastActivity = Date.now();
        
        // 更新当前任务信息
        if (newState === TaskState.RUNNING) {
            this.globalState.currentTaskInstanceId = metadata.taskInstanceId || taskId;
            this.globalState.currentExecutionId = metadata.executionId;
            this.globalState.activeScriptId = metadata.scriptId;
        } else if (this.isTaskCompleted(taskId) || newState === TaskState.CANCELLED) {
            // 任务完成时清理全局状态
            if (this.globalState.currentTaskInstanceId === taskId || 
                this.globalState.currentTaskInstanceId === metadata.taskInstanceId) {
                this.globalState.currentTaskInstanceId = null;
                this.globalState.currentExecutionId = null;
                this.globalState.activeScriptId = null;
            }
        }
        
        // 同步到全局window对象（向后兼容）
        this.syncToGlobalWindow();
    }

    /**
     * 同步状态到全局window对象（向后兼容）
     */
    syncToGlobalWindow() {
        try {
            window.__currentTaskInstanceId = this.globalState.currentTaskInstanceId;
            window.__currentExecutionId = this.globalState.currentExecutionId;
            window.__activeScriptId = this.globalState.activeScriptId;
        } catch (error) {
            console.warn('[TaskStateManager] 同步到全局window失败:', error);
        }
    }

    /**
     * 获取任务状态历史
     * @param {string} taskId - 任务ID
     * @returns {Array} 状态历史
     */
    getStateHistory(taskId) {
        return this.stateHistory.get(taskId) || [];
    }

    /**
     * 检查并清理僵尸任务
     */
    detectAndCleanZombieTasks() {
        const now = Date.now();
        let zombieCount = 0;
        
        for (const [taskId, stateData] of this.states.entries()) {
            // 检查运行中的任务是否超时
            if (stateData.state === TaskState.RUNNING) {
                const runningTime = now - stateData.timestamp;
                
                if (runningTime > STATE_CONFIG.TASK_TIMEOUT) {
                    console.warn(`[TaskStateManager] 检测到僵尸任务: ${taskId} (运行时间: ${runningTime}ms)`);
                    this.setState(taskId, TaskState.ZOMBIE, {
                        reason: 'timeout',
                        detectedAt: now,
                        originalRunningTime: runningTime
                    }, true);
                    zombieCount++;
                }
            }
        }
        
        if (zombieCount > 0) {
            console.log(`[TaskStateManager] 僵尸任务清理完成，发现 ${zombieCount} 个僵尸任务`);
        }
        
        return zombieCount;
    }

    /**
     * 启动僵尸任务检测
     */
    startZombieTaskDetection() {
        this.zombieCheckTimer = setInterval(() => {
            this.detectAndCleanZombieTasks();
        }, STATE_CONFIG.ZOMBIE_CHECK_INTERVAL);
        
        console.log('[TaskStateManager] 僵尸任务检测已启动');
    }

    /**
     * 停止僵尸任务检测
     */
    stopZombieTaskDetection() {
        if (this.zombieCheckTimer) {
            clearInterval(this.zombieCheckTimer);
            this.zombieCheckTimer = null;
            console.log('[TaskStateManager] 僵尸任务检测已停止');
        }
    }

    /**
     * 强制清理僵尸任务
     * @param {string} taskId - 任务ID
     * @returns {boolean} 是否成功清理
     */
    forceCleanZombieTask(taskId) {
        const stateData = this.getState(taskId);
        if (stateData && stateData.state === TaskState.ZOMBIE) {
            this.setState(taskId, TaskState.CANCELLED, {
                reason: 'force_cleanup',
                cleanedAt: Date.now()
            }, true);
            
            // 清理相关的全局状态
            if (this.globalState.currentTaskInstanceId === taskId) {
                this.globalState.currentTaskInstanceId = null;
                this.globalState.currentExecutionId = null;
                this.globalState.activeScriptId = null;
                this.syncToGlobalWindow();
            }
            
            console.log(`[TaskStateManager] 强制清理僵尸任务: ${taskId}`);
            return true;
        }
        return false;
    }

    /**
     * 状态一致性检查
     * @returns {Object} 检查结果
     */
    performConsistencyCheck() {
        const issues = [];
        const runningTasks = this.getRunningTasks();
        
        // 检查是否有多个运行中的任务
        if (runningTasks.length > 1) {
            issues.push({
                type: 'multiple_running_tasks',
                count: runningTasks.length,
                tasks: runningTasks.map(t => t.taskId)
            });
        }
        
        // 检查全局状态一致性
        if (this.globalState.currentTaskInstanceId) {
            const currentTaskState = this.getCurrentState(this.globalState.currentTaskInstanceId);
            if (currentTaskState && currentTaskState !== TaskState.RUNNING) {
                issues.push({
                    type: 'global_state_inconsistency',
                    currentTaskId: this.globalState.currentTaskInstanceId,
                    expectedState: TaskState.RUNNING,
                    actualState: currentTaskState
                });
            }
        }
        
        // 检查window对象同步状态
        try {
            if (window.__currentTaskInstanceId !== this.globalState.currentTaskInstanceId ||
                window.__currentExecutionId !== this.globalState.currentExecutionId) {
                issues.push({
                    type: 'window_sync_mismatch',
                    manager: {
                        taskInstanceId: this.globalState.currentTaskInstanceId,
                        executionId: this.globalState.currentExecutionId
                    },
                    window: {
                        taskInstanceId: window.__currentTaskInstanceId,
                        executionId: window.__currentExecutionId
                    }
                });
            }
        } catch (error) {
            issues.push({
                type: 'window_access_error',
                error: error.message
            });
        }
        
        return {
            isConsistent: issues.length === 0,
            issues,
            timestamp: Date.now()
        };
    }

    /**
     * 修复状态一致性问题
     * @returns {number} 修复的问题数量
     */
    fixConsistencyIssues() {
        const checkResult = this.performConsistencyCheck();
        let fixedCount = 0;
        
        for (const issue of checkResult.issues) {
            switch (issue.type) {
                case 'multiple_running_tasks':
                    // 保留最新的任务，其他标记为僵尸
                    const sortedTasks = issue.tasks.sort((a, b) => {
                        const stateA = this.getState(a);
                        const stateB = this.getState(b);
                        return stateB.timestamp - stateA.timestamp;
                    });
                    
                    for (let i = 1; i < sortedTasks.length; i++) {
                        this.setState(sortedTasks[i], TaskState.ZOMBIE, {
                            reason: 'multiple_running_fix',
                            fixedAt: Date.now()
                        }, true);
                        fixedCount++;
                    }
                    break;
                    
                case 'global_state_inconsistency':
                    // 修正全局状态
                    if (issue.actualState === TaskState.COMPLETED || 
                        issue.actualState === TaskState.FAILED || 
                        issue.actualState === TaskState.CANCELLED) {
                        this.globalState.currentTaskInstanceId = null;
                        this.globalState.currentExecutionId = null;
                        this.globalState.activeScriptId = null;
                        this.syncToGlobalWindow();
                        fixedCount++;
                    }
                    break;
                    
                case 'window_sync_mismatch':
                    // 重新同步到window对象
                    this.syncToGlobalWindow();
                    fixedCount++;
                    break;
            }
        }
        
        if (fixedCount > 0) {
            console.log(`[TaskStateManager] 状态一致性修复完成，修复了 ${fixedCount} 个问题`);
        }
        
        return fixedCount;
    }

    /**
     * 从旧版本迁移数据
     */
    migrateFromOldVersion() {
        try {
            const oldData = localStorage.getItem('fa_task_states');
            if (oldData) {
                const oldStates = JSON.parse(oldData);
                console.log('[TaskStateManager] 检测到旧版本数据，开始迁移...');
                
                for (const [taskId, stateData] of Object.entries(oldStates)) {
                    if (!this.states.has(taskId)) {
                        // 为旧数据添加新字段
                        this.states.set(taskId, {
                            ...stateData,
                            executionId: null,
                            taskInstanceId: null
                        });
                    }
                }
                
                // 保存迁移后的数据
                this.persistStates();
                
                // 清理旧数据
                localStorage.removeItem('fa_task_states');
                console.log('[TaskStateManager] 数据迁移完成');
            }
        } catch (error) {
            console.warn('[TaskStateManager] 数据迁移失败:', error);
        }
    }

    /**
     * 获取全局状态
     * @returns {Object} 全局状态
     */
    getGlobalState() {
        return { ...this.globalState };
    }

    /**
     * 设置全局状态
     * @param {Object} newGlobalState - 新的全局状态
     */
    setGlobalState(newGlobalState) {
        this.globalState = {
            ...this.globalState,
            ...newGlobalState,
            lastActivity: Date.now()
        };
        this.syncToGlobalWindow();
    }

    /**
     * 获取当前活跃任务
     * @returns {Object|null} 当前任务信息
     */
    getCurrentTask() {
        if (this.globalState.currentTaskInstanceId) {
            const stateData = this.getState(this.globalState.currentTaskInstanceId);
            return stateData ? {
                taskId: this.globalState.currentTaskInstanceId,
                executionId: this.globalState.currentExecutionId,
                scriptId: this.globalState.activeScriptId,
                ...stateData
            } : null;
        }
        return null;
    }

    /**
     * 获取任务状态
     * @param {string} taskId - 任务ID
     * @returns {Object|null} 状态信息
     */
    getState(taskId) {
        return this.states.get(taskId) || null;
    }

    /**
     * 获取任务当前状态值
     * @param {string} taskId - 任务ID
     * @returns {string|null} 状态值
     */
    getCurrentState(taskId) {
        const stateData = this.getState(taskId);
        return stateData ? stateData.state : null;
    }

    /**
     * 检查状态转换是否有效
     * @param {string} fromState - 源状态
     * @param {string} toState - 目标状态
     * @returns {boolean} 是否有效
     */
    isValidTransition(fromState, toState) {
        if (!fromState) return true; // 初始状态可以转换到任何状态
        
        const allowedTransitions = STATE_TRANSITIONS[fromState] || [];
        return allowedTransitions.includes(toState);
    }

    /**
     * 获取所有指定状态的任务
     * @param {string} state - 状态值
     * @returns {Array} 任务列表
     */
    getTasksByState(state) {
        const tasks = [];
        for (const [taskId, stateData] of this.states.entries()) {
            if (stateData.state === state) {
                tasks.push({ taskId, ...stateData });
            }
        }
        return tasks;
    }

    /**
     * 获取运行中的任务
     * @returns {Array} 运行中的任务列表
     */
    getRunningTasks() {
        return this.getTasksByState(TaskState.RUNNING);
    }

    /**
     * 检查任务是否在运行
     * @param {string} taskId - 任务ID
     * @returns {boolean} 是否在运行
     */
    isTaskRunning(taskId) {
        return this.getCurrentState(taskId) === TaskState.RUNNING;
    }

    /**
     * 检查任务是否已完成（成功或失败）
     * @param {string} taskId - 任务ID
     * @returns {boolean} 是否已完成
     */
    isTaskCompleted(taskId) {
        const state = this.getCurrentState(taskId);
        return state === TaskState.COMPLETED || state === TaskState.FAILED || state === TaskState.CANCELLED;
    }

    /**
     * 更新任务元数据
     * @param {string} taskId - 任务ID
     * @param {Object} metadata - 元数据
     */
    updateMetadata(taskId, metadata) {
        const stateData = this.getState(taskId);
        if (stateData) {
            stateData.metadata = {
                ...stateData.metadata,
                ...metadata,
                lastUpdate: Date.now()
            };
            this.states.set(taskId, stateData);
            this.persistStates();
            this.notifyObservers(taskId, stateData);
        }
    }

    /**
     * 删除任务状态
     * @param {string} taskId - 任务ID
     */
    removeTask(taskId) {
        if (this.states.has(taskId)) {
            this.states.delete(taskId);
            this.persistStates();
            console.log(`[TaskStateManager] 已删除任务状态: ${taskId}`);
        }
    }

    /**
     * 清理已完成的任务（增强版）
     * @param {number} olderThan - 清理多久之前的任务（毫秒）
     * @param {boolean} includeZombie - 是否包括僵尸任务
     * @returns {number} 清理的任务数量
     */
    cleanupCompletedTasks(olderThan = STATE_CONFIG.COMPLETED_TASK_RETENTION, includeZombie = true) {
        const now = Date.now();
        let cleanedCount = 0;
        const tasksToRemove = [];

        for (const [taskId, stateData] of this.states.entries()) {
            const shouldClean = (
                this.isTaskCompleted(taskId) || 
                (includeZombie && stateData.state === TaskState.ZOMBIE)
            ) && (now - stateData.timestamp) > olderThan;
            
            if (shouldClean) {
                tasksToRemove.push(taskId);
            }
        }
        
        // 执行清理
        for (const taskId of tasksToRemove) {
            this.removeTask(taskId);
            cleanedCount++;
        }
        
        if (cleanedCount > 0) {
            console.log(`[TaskStateManager] 清理了 ${cleanedCount} 个已完成的任务`);
            
            // 如果清理了当前任务，重置全局状态
            if (tasksToRemove.includes(this.globalState.currentTaskInstanceId)) {
                this.globalState.currentTaskInstanceId = null;
                this.globalState.currentExecutionId = null;
                this.globalState.activeScriptId = null;
                this.syncToGlobalWindow();
            }
        }
        
        return cleanedCount;
    }

    /**
     * 订阅状态变更
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    subscribe(callback) {
        this.observers.add(callback);
        return () => {
            this.observers.delete(callback);
        };
    }

    /**
     * 通知观察者
     * @param {string} taskId - 任务ID
     * @param {Object} stateData - 状态数据
     */
    notifyObservers(taskId, stateData) {
        this.observers.forEach(callback => {
            try {
                callback(taskId, stateData);
            } catch (error) {
                console.error('[TaskStateManager] 通知观察者失败:', error);
            }
        });
    }

    /**
     * 加载持久化状态（增强版）
     */
    loadPersistedStates() {
        try {
            const stored = localStorage.getItem(this.persistenceKey);
            if (stored) {
                const persistedData = JSON.parse(stored);
                
                // 加载任务状态
                if (persistedData.states) {
                    for (const { taskId, stateData } of persistedData.states) {
                        this.states.set(taskId, stateData);
                    }
                }
                
                // 加载状态历史
                if (persistedData.stateHistory) {
                    for (const { taskId, history } of persistedData.stateHistory) {
                        this.stateHistory.set(taskId, history);
                    }
                }
                
                // 加载全局状态
                if (persistedData.globalState) {
                    this.globalState = {
                        ...this.globalState,
                        ...persistedData.globalState
                    };
                    this.syncToGlobalWindow();
                }
                
                console.log(`[TaskStateManager] 加载了 ${this.states.size} 个持久化状态和全局状态`);
            }
        } catch (error) {
            console.error('[TaskStateManager] 加载持久化状态失败:', error);
        }
    }

    /**
     * 持久化状态（增强版）
     */
    persistStates() {
        try {
            const persistData = {
                version: '2.0',
                timestamp: Date.now(),
                states: Array.from(this.states.entries()).map(([taskId, stateData]) => ({
                    taskId,
                    stateData
                })),
                stateHistory: Array.from(this.stateHistory.entries()).map(([taskId, history]) => ({
                    taskId,
                    history
                })),
                globalState: this.globalState
            };
            
            localStorage.setItem(this.persistenceKey, JSON.stringify(persistData));
        } catch (error) {
            console.error('[TaskStateManager] 持久化状态失败:', error);
        }
    }

    /**
     * 获取详细状态统计（增强版）
     * @returns {Object} 统计信息
     */
    getStats() {
        const runningTasks = this.getRunningTasks();
        const zombieTasks = this.getTasksByState(TaskState.ZOMBIE);
        
        const stats = {
            total: this.states.size,
            byState: {},
            globalState: this.getGlobalState(),
            currentTask: this.getCurrentTask(),
            runningCount: runningTasks.length,
            zombieCount: zombieTasks.length,
            historySize: this.stateHistory.size,
            consistencyCheck: this.performConsistencyCheck(),
            lastActivity: this.globalState.lastActivity
        };

        // 按状态统计
        for (const state of Object.values(TaskState)) {
            const tasks = this.getTasksByState(state);
            stats.byState[state] = {
                count: tasks.length,
                tasks: tasks.map(t => ({
                    taskId: t.taskId,
                    timestamp: t.timestamp,
                    duration: Date.now() - t.timestamp
                }))
            };
        }

        return stats;
    }

    /**
     * 重置所有状态（增强版）
     * @param {boolean} includeGlobalState - 是否重置全局状态
     */
    reset(includeGlobalState = true) {
        // 停止僵尸任务检测
        this.stopZombieTaskDetection();
        
        // 清理状态
        this.states.clear();
        this.stateHistory.clear();
        this.observers.clear();
        
        if (includeGlobalState) {
            this.globalState = {
                currentTaskInstanceId: null,
                currentExecutionId: null,
                activeScriptId: null,
                lastActivity: Date.now()
            };
            this.syncToGlobalWindow();
        }
        
        // 持久化重置状态
        this.persistStates();
        
        // 重新启动僵尸任务检测
        this.startZombieTaskDetection();
        
        console.log('[TaskStateManager] 所有状态已重置');
    }

    /**
     * 销毁管理器
     */
    destroy() {
        this.stopZombieTaskDetection();
        this.reset(true);
        console.log('[TaskStateManager] 管理器已销毁');
    }
} 