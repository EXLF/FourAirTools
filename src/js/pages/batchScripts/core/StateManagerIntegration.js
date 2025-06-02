/**
 * 状态管理器集成模块
 * 职责：将新的TaskStateManager集成到现有代码中，提供向后兼容性
 */

import { TaskStateManager, TaskState } from './TaskStateManager.js';

/**
 * 状态管理器集成类
 * 提供向后兼容的接口，逐步迁移现有代码
 */
export class StateManagerIntegration {
    constructor() {
        this.taskStateManager = null;
        this.isInitialized = false;
        this.migrationLog = [];
        
        console.log('[StateManagerIntegration] 状态管理器集成模块初始化');
    }

    /**
     * 初始化状态管理器
     */
    initialize() {
        if (this.isInitialized) {
            console.warn('[StateManagerIntegration] 状态管理器已初始化');
            return;
        }

        try {
            this.taskStateManager = new TaskStateManager();
            this.isInitialized = true;
            
            // 设置全局状态同步
            this.setupGlobalStateSynchronization();
            
            // 迁移现有状态
            this.migrateExistingGlobalState();
            
            console.log('[StateManagerIntegration] 状态管理器初始化完成');
        } catch (error) {
            console.error('[StateManagerIntegration] 初始化失败:', error);
        }
    }

    /**
     * 设置全局状态同步
     */
    setupGlobalStateSynchronization() {
        if (!this.isInitialized) return;

        // 监听状态变更，同步到全局变量
        this.taskStateManager.subscribe((taskId, stateData) => {
            this.logMigration(`状态变更: ${taskId} -> ${stateData.state}`);
            
            // 确保全局状态同步
            this.ensureGlobalStateSynchronization();
        });
    }

    /**
     * 迁移现有的全局状态
     */
    migrateExistingGlobalState() {
        if (!this.isInitialized) return;

        try {
            // 检查现有的全局状态
            const existingTaskInstanceId = window.__currentTaskInstanceId;
            const existingExecutionId = window.__currentExecutionId;
            
            if (existingTaskInstanceId || existingExecutionId) {
                this.logMigration(`发现现有全局状态: taskInstanceId=${existingTaskInstanceId}, executionId=${existingExecutionId}`);
                
                // 迁移到新的状态管理器
                this.taskStateManager.setGlobalState({
                    currentTaskInstanceId: existingTaskInstanceId,
                    currentExecutionId: existingExecutionId,
                    activeScriptId: null
                });
                
                // 如果有活跃任务，设置其状态
                if (existingTaskInstanceId) {
                    const currentState = this.taskStateManager.getCurrentState(existingTaskInstanceId);
                    if (!currentState) {
                        // 假设是运行中状态
                        this.taskStateManager.setState(existingTaskInstanceId, TaskState.RUNNING, {
                            executionId: existingExecutionId,
                            migratedFrom: 'global_state',
                            migrationTime: Date.now()
                        });
                        this.logMigration(`为现有任务设置运行状态: ${existingTaskInstanceId}`);
                    }
                }
            }
        } catch (error) {
            console.warn('[StateManagerIntegration] 迁移现有状态失败:', error);
        }
    }

    /**
     * 确保全局状态同步
     */
    ensureGlobalStateSynchronization() {
        if (!this.isInitialized) return;

        const globalState = this.taskStateManager.getGlobalState();
        
        // 同步到window对象
        window.__currentTaskInstanceId = globalState.currentTaskInstanceId;
        window.__currentExecutionId = globalState.currentExecutionId;
        window.__activeScriptId = globalState.activeScriptId;
    }

    /**
     * 设置任务状态（向后兼容接口）
     * @param {string} taskId - 任务ID
     * @param {string} state - 状态
     * @param {Object} metadata - 元数据
     */
    setTaskState(taskId, state, metadata = {}) {
        if (!this.isInitialized) {
            console.warn('[StateManagerIntegration] 状态管理器未初始化，使用传统方式');
            return this.setTaskStateLegacy(taskId, state, metadata);
        }

        this.logMigration(`设置任务状态: ${taskId} -> ${state}`);
        return this.taskStateManager.setState(taskId, state, metadata);
    }

    /**
     * 传统方式设置任务状态（回退机制）
     */
    setTaskStateLegacy(taskId, state, metadata) {
        try {
            // 直接操作全局变量（旧方式）
            if (state === 'running') {
                window.__currentTaskInstanceId = taskId;
                window.__currentExecutionId = metadata.executionId;
            } else if (state === 'completed' || state === 'failed' || state === 'cancelled') {
                window.__currentTaskInstanceId = null;
                window.__currentExecutionId = null;
            }
            
            this.logMigration(`使用传统方式设置状态: ${taskId} -> ${state}`);
            return true;
        } catch (error) {
            console.error('[StateManagerIntegration] 传统方式设置状态失败:', error);
            return false;
        }
    }

    /**
     * 获取任务状态（向后兼容接口）
     * @param {string} taskId - 任务ID
     */
    getTaskState(taskId) {
        if (!this.isInitialized) {
            console.warn('[StateManagerIntegration] 状态管理器未初始化，返回null');
            return null;
        }

        return this.taskStateManager.getState(taskId);
    }

    /**
     * 获取当前任务信息（向后兼容接口）
     */
    getCurrentTask() {
        if (!this.isInitialized) {
            // 返回传统的全局状态
            return {
                taskInstanceId: window.__currentTaskInstanceId,
                executionId: window.__currentExecutionId,
                activeScriptId: window.__activeScriptId
            };
        }

        return this.taskStateManager.getCurrentTask();
    }

    /**
     * 检查任务是否正在运行
     * @param {string} taskId - 任务ID
     */
    isTaskRunning(taskId) {
        if (!this.isInitialized) {
            // 传统检查方式
            return window.__currentTaskInstanceId === taskId && 
                   window.__currentExecutionId != null;
        }

        return this.taskStateManager.isTaskRunning(taskId);
    }

    /**
     * 清理僵尸任务
     */
    cleanupZombieTasks() {
        if (!this.isInitialized) {
            console.warn('[StateManagerIntegration] 状态管理器未初始化，无法清理僵尸任务');
            return 0;
        }

        const count = this.taskStateManager.detectAndCleanZombieTasks();
        this.logMigration(`清理了 ${count} 个僵尸任务`);
        return count;
    }

    /**
     * 修复状态一致性
     */
    fixStateConsistency() {
        if (!this.isInitialized) {
            console.warn('[StateManagerIntegration] 状态管理器未初始化，无法修复一致性');
            return 0;
        }

        const fixedCount = this.taskStateManager.fixConsistencyIssues();
        this.logMigration(`修复了 ${fixedCount} 个状态一致性问题`);
        return fixedCount;
    }

    /**
     * 获取状态统计
     */
    getStats() {
        if (!this.isInitialized) {
            return {
                initialized: false,
                globalState: {
                    currentTaskInstanceId: window.__currentTaskInstanceId,
                    currentExecutionId: window.__currentExecutionId
                }
            };
        }

        return {
            initialized: true,
            migrationLog: this.migrationLog,
            ...this.taskStateManager.getStats()
        };
    }

    /**
     * 记录迁移日志
     * @param {string} message - 日志消息
     */
    logMigration(message) {
        const logEntry = {
            timestamp: Date.now(),
            message
        };
        this.migrationLog.push(logEntry);
        
        // 限制日志数量
        if (this.migrationLog.length > 100) {
            this.migrationLog.splice(0, this.migrationLog.length - 100);
        }
        
        console.log(`[StateManagerIntegration] ${message}`);
    }

    /**
     * 执行健康检查
     */
    performHealthCheck() {
        const healthReport = {
            timestamp: Date.now(),
            initialized: this.isInitialized,
            issues: [],
            recommendations: []
        };

        if (!this.isInitialized) {
            healthReport.issues.push('状态管理器未初始化');
            healthReport.recommendations.push('调用 initialize() 方法');
            return healthReport;
        }

        // 检查状态一致性
        const consistencyCheck = this.taskStateManager.performConsistencyCheck();
        if (!consistencyCheck.isConsistent) {
            healthReport.issues.push(`状态不一致: ${consistencyCheck.issues.length} 个问题`);
            healthReport.recommendations.push('调用 fixStateConsistency() 修复');
        }

        // 检查僵尸任务
        const zombieCount = this.taskStateManager.getTasksByState(TaskState.ZOMBIE).length;
        if (zombieCount > 0) {
            healthReport.issues.push(`发现 ${zombieCount} 个僵尸任务`);
            healthReport.recommendations.push('调用 cleanupZombieTasks() 清理');
        }

        // 检查运行中任务数量
        const runningCount = this.taskStateManager.getRunningTasks().length;
        if (runningCount > 1) {
            healthReport.issues.push(`同时运行 ${runningCount} 个任务`);
            healthReport.recommendations.push('检查任务并发控制');
        }

        return healthReport;
    }

    /**
     * 获取TaskStateManager实例（用于高级操作）
     */
    getTaskStateManager() {
        return this.taskStateManager;
    }
}

// 创建全局实例
export const stateManagerIntegration = new StateManagerIntegration();

// 自动初始化（如果在浏览器环境中）
if (typeof window !== 'undefined') {
    // 延迟初始化，确保DOM加载完成
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            stateManagerIntegration.initialize();
        });
    } else {
        // DOM已加载，立即初始化
        setTimeout(() => {
            stateManagerIntegration.initialize();
        }, 100);
    }
} 