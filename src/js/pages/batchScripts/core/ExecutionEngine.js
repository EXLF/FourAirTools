/**
 * 执行引擎 - 任务执行控制和协调
 * 职责：并发控制、执行队列管理、错误处理和重试
 */

import { TaskState } from './TaskStateManager.js';

export class ExecutionEngine {
    constructor(stateManager, maxConcurrency = 5) {
        this.stateManager = stateManager;
        this.maxConcurrency = maxConcurrency;
        this.executionQueue = []; // 执行队列
        this.runningExecutions = new Map(); // 运行中的执行
        this.executionHistory = new Map(); // 执行历史
        
        console.log('[ExecutionEngine] 初始化完成，最大并发数:', maxConcurrency);
    }

    /**
     * 执行脚本任务
     * @param {Object} context - 执行上下文
     * @returns {Promise<Object>} 执行结果
     */
    async executeScript(context) {
        const { executionId, scriptId } = context;
        
        try {
            console.log(`[ExecutionEngine] 开始执行脚本任务: ${scriptId} (${executionId})`);
            
            // 设置初始状态
            this.stateManager.setState(executionId, TaskState.PENDING, {
                scriptId,
                startTime: Date.now()
            });

            // 检查并发限制
            if (this.runningExecutions.size >= this.maxConcurrency) {
                console.log(`[ExecutionEngine] 达到最大并发限制，任务加入队列: ${executionId}`);
                return this.queueExecution(context);
            }

            // 执行任务
            return await this.doExecute(context);
        } catch (error) {
            console.error(`[ExecutionEngine] 执行失败: ${executionId}`, error);
            this.stateManager.setState(executionId, TaskState.FAILED, {
                error: error.message,
                endTime: Date.now()
            });
            throw error;
        }
    }

    /**
     * 实际执行任务
     * @param {Object} context - 执行上下文
     * @returns {Promise<Object>} 执行结果
     */
    async doExecute(context) {
        const { executionId, scriptId, wallets, config, proxyConfig } = context;
        
        try {
            // 标记为运行中
            this.stateManager.setState(executionId, TaskState.RUNNING, {
                startTime: Date.now()
            });
            
            // 记录运行中的执行
            this.runningExecutions.set(executionId, {
                context,
                startTime: Date.now()
            });

            // 调用现有的脚本API执行
            if (!window.scriptAPI) {
                throw new Error('脚本API不可用');
            }

            const result = await window.scriptAPI.runScript(
                scriptId,
                wallets,
                config,
                proxyConfig
            );

            if (result.success) {
                // 执行成功
                this.stateManager.setState(executionId, TaskState.COMPLETED, {
                    endTime: Date.now(),
                    result: result.data
                });
                
                console.log(`[ExecutionEngine] 脚本执行成功: ${executionId}`);
                return result;
            } else {
                // 执行失败
                throw new Error(result.error || '脚本执行失败');
            }
        } catch (error) {
            console.error(`[ExecutionEngine] 脚本执行出错: ${executionId}`, error);
            this.stateManager.setState(executionId, TaskState.FAILED, {
                endTime: Date.now(),
                error: error.message
            });
            throw error;
        } finally {
            // 清理运行状态
            this.runningExecutions.delete(executionId);
            
            // 处理队列中的下一个任务
            this.processQueue();
        }
    }

    /**
     * 将任务加入队列
     * @param {Object} context - 执行上下文
     * @returns {Promise<Object>} 执行结果
     */
    async queueExecution(context) {
        return new Promise((resolve, reject) => {
            this.executionQueue.push({
                context,
                resolve,
                reject,
                queueTime: Date.now()
            });
            
            console.log(`[ExecutionEngine] 任务已加入队列: ${context.executionId}, 队列长度: ${this.executionQueue.length}`);
        });
    }

    /**
     * 处理执行队列
     */
    async processQueue() {
        if (this.executionQueue.length === 0) return;
        if (this.runningExecutions.size >= this.maxConcurrency) return;

        const queuedExecution = this.executionQueue.shift();
        if (!queuedExecution) return;

        const { context, resolve, reject } = queuedExecution;
        
        try {
            const result = await this.doExecute(context);
            resolve(result);
        } catch (error) {
            reject(error);
        }
    }

    /**
     * 停止脚本执行
     * @param {string} executionId - 执行ID
     * @returns {Promise<boolean>} 是否成功停止
     */
    async stopExecution(executionId) {
        try {
            console.log(`[ExecutionEngine] 停止脚本执行: ${executionId}`);
            
            // 尝试通过API停止
            if (window.scriptAPI) {
                await window.scriptAPI.stopScript(executionId);
            }
            
            // 更新状态
            this.stateManager.setState(executionId, TaskState.CANCELLED, {
                endTime: Date.now(),
                reason: 'user_cancelled'
            });
            
            // 清理运行状态
            this.runningExecutions.delete(executionId);
            
            // 从队列中移除（如果存在）
            this.removeFromQueue(executionId);
            
            return true;
        } catch (error) {
            console.error(`[ExecutionEngine] 停止执行失败: ${executionId}`, error);
            return false;
        }
    }

    /**
     * 从队列中移除任务
     * @param {string} executionId - 执行ID
     */
    removeFromQueue(executionId) {
        const index = this.executionQueue.findIndex(
            item => item.context.executionId === executionId
        );
        
        if (index >= 0) {
            const removed = this.executionQueue.splice(index, 1)[0];
            removed.reject(new Error('任务已被取消'));
            console.log(`[ExecutionEngine] 已从队列中移除任务: ${executionId}`);
        }
    }

    /**
     * 暂停执行
     * @param {string} executionId - 执行ID
     * @returns {Promise<boolean>} 是否成功暂停
     */
    async pauseExecution(executionId) {
        try {
            const currentState = this.stateManager.getCurrentState(executionId);
            if (currentState !== TaskState.RUNNING) {
                console.warn(`[ExecutionEngine] 无法暂停非运行状态的任务: ${executionId} (${currentState})`);
                return false;
            }

            this.stateManager.setState(executionId, TaskState.PAUSED, {
                pauseTime: Date.now()
            });
            
            console.log(`[ExecutionEngine] 已暂停执行: ${executionId}`);
            return true;
        } catch (error) {
            console.error(`[ExecutionEngine] 暂停执行失败: ${executionId}`, error);
            return false;
        }
    }

    /**
     * 恢复执行
     * @param {string} executionId - 执行ID
     * @returns {Promise<boolean>} 是否成功恢复
     */
    async resumeExecution(executionId) {
        try {
            const currentState = this.stateManager.getCurrentState(executionId);
            if (currentState !== TaskState.PAUSED) {
                console.warn(`[ExecutionEngine] 无法恢复非暂停状态的任务: ${executionId} (${currentState})`);
                return false;
            }

            this.stateManager.setState(executionId, TaskState.RUNNING, {
                resumeTime: Date.now()
            });
            
            console.log(`[ExecutionEngine] 已恢复执行: ${executionId}`);
            return true;
        } catch (error) {
            console.error(`[ExecutionEngine] 恢复执行失败: ${executionId}`, error);
            return false;
        }
    }

    /**
     * 获取执行状态
     * @param {string} executionId - 执行ID
     * @returns {Object|null} 执行状态
     */
    getExecutionStatus(executionId) {
        const stateData = this.stateManager.getState(executionId);
        const runningExecution = this.runningExecutions.get(executionId);
        
        return {
            state: stateData,
            isRunning: !!runningExecution,
            runtime: runningExecution ? Date.now() - runningExecution.startTime : null
        };
    }

    /**
     * 获取所有运行中的执行
     * @returns {Array} 运行中的执行列表
     */
    getRunningExecutions() {
        return Array.from(this.runningExecutions.entries()).map(([executionId, execution]) => ({
            executionId,
            ...execution,
            runtime: Date.now() - execution.startTime
        }));
    }

    /**
     * 获取队列状态
     * @returns {Object} 队列信息
     */
    getQueueStatus() {
        return {
            length: this.executionQueue.length,
            running: this.runningExecutions.size,
            maxConcurrency: this.maxConcurrency,
            items: this.executionQueue.map(item => ({
                executionId: item.context.executionId,
                scriptId: item.context.scriptId,
                queueTime: item.queueTime,
                waitTime: Date.now() - item.queueTime
            }))
        };
    }

    /**
     * 设置最大并发数
     * @param {number} maxConcurrency - 最大并发数
     */
    setMaxConcurrency(maxConcurrency) {
        this.maxConcurrency = Math.max(1, maxConcurrency);
        console.log(`[ExecutionEngine] 最大并发数已设置为: ${this.maxConcurrency}`);
        
        // 如果有队列任务且当前并发数允许，尝试处理队列
        if (this.executionQueue.length > 0 && this.runningExecutions.size < this.maxConcurrency) {
            this.processQueue();
        }
    }

    /**
     * 清理所有任务
     */
    async cleanup() {
        console.log('[ExecutionEngine] 开始清理所有任务');
        
        // 停止所有运行中的任务
        const runningIds = Array.from(this.runningExecutions.keys());
        for (const executionId of runningIds) {
            await this.stopExecution(executionId);
        }
        
        // 清理队列
        this.executionQueue.forEach(item => {
            item.reject(new Error('执行引擎已清理'));
        });
        this.executionQueue.length = 0;
        
        console.log('[ExecutionEngine] 清理完成');
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            running: this.runningExecutions.size,
            queued: this.executionQueue.length,
            maxConcurrency: this.maxConcurrency,
            queueStatus: this.getQueueStatus()
        };
    }
} 