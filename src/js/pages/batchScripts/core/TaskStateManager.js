/**
 * 任务状态管理器 - 集中管理所有任务状态
 * 职责：任务状态机实现、状态持久化、状态变更通知
 */

// 任务状态枚举
export const TaskState = {
    PENDING: 'pending',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
};

// 有效的状态转换
const STATE_TRANSITIONS = {
    [TaskState.PENDING]: [TaskState.RUNNING, TaskState.CANCELLED],
    [TaskState.RUNNING]: [TaskState.PAUSED, TaskState.COMPLETED, TaskState.FAILED, TaskState.CANCELLED],
    [TaskState.PAUSED]: [TaskState.RUNNING, TaskState.CANCELLED],
    [TaskState.COMPLETED]: [], // 终态
    [TaskState.FAILED]: [TaskState.RUNNING], // 可以重新运行
    [TaskState.CANCELLED]: [] // 终态
};

export class TaskStateManager {
    constructor() {
        this.states = new Map(); // 任务状态存储
        this.observers = new Set(); // 状态变更观察者
        this.persistenceKey = 'fa_task_states'; // localStorage键
        
        // 加载持久化状态
        this.loadPersistedStates();
        
        console.log('[TaskStateManager] 初始化完成');
    }

    /**
     * 设置任务状态
     * @param {string} taskId - 任务ID
     * @param {string} newState - 新状态
     * @param {Object} metadata - 状态元数据
     * @returns {boolean} 是否设置成功
     */
    setState(taskId, newState, metadata = {}) {
        try {
            const currentState = this.getState(taskId);
            
            // 验证状态转换是否有效
            if (currentState && !this.isValidTransition(currentState.state, newState)) {
                console.warn(`[TaskStateManager] 无效的状态转换: ${currentState.state} -> ${newState} (任务: ${taskId})`);
                return false;
            }

            const stateData = {
                state: newState,
                timestamp: Date.now(),
                previousState: currentState?.state || null,
                metadata: {
                    ...metadata,
                    transitionTime: Date.now()
                }
            };

            // 设置状态
            this.states.set(taskId, stateData);
            
            // 持久化状态
            this.persistStates();
            
            // 通知观察者
            this.notifyObservers(taskId, stateData);
            
            console.log(`[TaskStateManager] 任务 ${taskId} 状态变更: ${currentState?.state || 'null'} -> ${newState}`);
            return true;
        } catch (error) {
            console.error('[TaskStateManager] 设置状态失败:', error);
            return false;
        }
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
     * 清理已完成的任务
     * @param {number} olderThan - 清理多久之前的任务（毫秒）
     */
    cleanupCompletedTasks(olderThan = 24 * 60 * 60 * 1000) { // 默认24小时
        const now = Date.now();
        let cleanedCount = 0;

        for (const [taskId, stateData] of this.states.entries()) {
            if (this.isTaskCompleted(taskId) && (now - stateData.timestamp) > olderThan) {
                this.states.delete(taskId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.persistStates();
            console.log(`[TaskStateManager] 清理了 ${cleanedCount} 个过期任务`);
        }
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
     * 加载持久化状态
     */
    loadPersistedStates() {
        try {
            const stored = localStorage.getItem(this.persistenceKey);
            if (stored) {
                const statesArray = JSON.parse(stored);
                for (const { taskId, stateData } of statesArray) {
                    this.states.set(taskId, stateData);
                }
                console.log(`[TaskStateManager] 加载了 ${statesArray.length} 个持久化状态`);
            }
        } catch (error) {
            console.error('[TaskStateManager] 加载持久化状态失败:', error);
        }
    }

    /**
     * 持久化状态
     */
    persistStates() {
        try {
            const statesArray = Array.from(this.states.entries()).map(([taskId, stateData]) => ({
                taskId,
                stateData
            }));
            localStorage.setItem(this.persistenceKey, JSON.stringify(statesArray));
        } catch (error) {
            console.error('[TaskStateManager] 持久化状态失败:', error);
        }
    }

    /**
     * 获取状态统计
     * @returns {Object} 统计信息
     */
    getStats() {
        const stats = {
            total: this.states.size,
            byState: {}
        };

        // 按状态统计
        for (const state of Object.values(TaskState)) {
            stats.byState[state] = this.getTasksByState(state).length;
        }

        return stats;
    }

    /**
     * 重置所有状态
     */
    reset() {
        this.states.clear();
        this.persistStates();
        console.log('[TaskStateManager] 所有状态已重置');
    }
} 