/**
 * 脚本停止管理器
 * 负责脚本停止执行的完整流程管理，包括真实脚本停止、模拟脚本停止、UI状态重置等
 */

import { TaskLogger } from '../logger.js';

/**
 * 脚本停止管理器类
 */
export class ScriptStopManager {
    constructor() {
        // 内部状态管理
        this.isStoppingScript = false;
    }

    /**
     * 绑定停止按钮事件
     * @param {string} taskInstanceId - 任务实例ID
     * @param {HTMLElement} managerPage - 管理页面元素
     */
    bindStopButtonEvent(taskInstanceId, managerPage) {
        const stopTaskButton = managerPage.querySelector('#stop-btn');
        if (!stopTaskButton) {
            console.warn('[脚本停止] 停止按钮未找到');
            return;
        }

        stopTaskButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await this.handleStopExecution(taskInstanceId, stopTaskButton, managerPage);
        });

        console.log('[脚本停止] 停止按钮事件已绑定');
    }

    /**
     * 处理停止执行请求
     * @param {string} taskInstanceId - 任务实例ID
     * @param {HTMLElement} stopTaskButton - 停止按钮元素
     * @param {HTMLElement} managerPage - 管理页面元素
     */
    async handleStopExecution(taskInstanceId, stopTaskButton, managerPage) {
        // 防止重复点击
        if (this.isStoppingScript) {
            console.log('[脚本停止] 正在停止中，忽略重复点击');
            return;
        }

        // 确认停止
        if (!confirm('确定要停止当前正在执行的任务吗？')) {
            return;
        }

        try {
            this.isStoppingScript = true;
            
            // 更新按钮状态
            this._updateStopButtonState(stopTaskButton, 'stopping');
            
            // 停止执行计时器
            this._stopExecutionTimer();
            
            // 获取当前执行ID
            const currentExecutionId = window.__currentExecutionId;
            
            console.log('[脚本停止] 开始停止流程');
            console.log('[脚本停止] 当前执行ID:', currentExecutionId);
            console.log('[脚本停止] scriptAPI可用:', !!window.scriptAPI);
            
            // 根据执行类型选择停止策略
            const stopResult = await this._executeStopStrategy(currentExecutionId, taskInstanceId);
            
            if (stopResult.success) {
                // 停止成功，执行清理
                await this._handleStopSuccess(stopResult, managerPage);
            } else {
                // 停止失败，处理错误
                await this._handleStopFailure(stopResult, stopTaskButton, managerPage);
            }
            
        } catch (error) {
            console.error('[脚本停止] 停止脚本执行失败:', error);
            TaskLogger.logError(`停止脚本失败: ${error.message}`);
            
            // 恢复按钮状态
            this._updateStopButtonState(stopTaskButton, 'normal');
        } finally {
            this.isStoppingScript = false;
        }
    }

    /**
     * 执行停止策略
     * @param {string} currentExecutionId - 当前执行ID
     * @param {string} taskInstanceId - 任务实例ID
     * @returns {Promise<Object>} 停止结果
     * @private
     */
    async _executeStopStrategy(currentExecutionId, taskInstanceId) {
        if (currentExecutionId && window.scriptAPI && window.scriptAPI.stopScript) {
            // 真实脚本停止
            return await this._stopRealScript(currentExecutionId);
        } else if (currentExecutionId && currentExecutionId.startsWith('mock_exec_')) {
            // 模拟脚本停止
            return await this._stopMockScript(currentExecutionId, taskInstanceId);
        } else {
            // 无有效执行ID
            return await this._handleNoValidExecution(currentExecutionId);
        }
    }

    /**
     * 停止真实脚本
     * @param {string} currentExecutionId - 当前执行ID
     * @returns {Promise<Object>} 停止结果
     * @private
     */
    async _stopRealScript(currentExecutionId) {
        TaskLogger.logWarning('正在停止脚本执行...');
        TaskLogger.logInfo(`执行ID: ${currentExecutionId}`);
        
        try {
            const result = await window.scriptAPI.stopScript(currentExecutionId);
            console.log('[脚本停止] 真实脚本停止结果:', result);
            
            if (result.success) {
                TaskLogger.logWarning('✋ 脚本执行已被用户停止');
                return {
                    success: true,
                    type: 'real',
                    message: '脚本已成功停止'
                };
            } else {
                TaskLogger.logError(`停止脚本失败: ${result.error || '未知错误'}`);
                return {
                    success: false,
                    type: 'real',
                    error: result.error || '未知错误',
                    allowForceStop: true
                };
            }
        } catch (error) {
            console.error('[脚本停止] 调用停止API失败:', error);
            return {
                success: false,
                type: 'real',
                error: error.message,
                allowForceStop: true
            };
        }
    }

    /**
     * 停止模拟脚本
     * @param {string} currentExecutionId - 当前执行ID
     * @param {string} taskInstanceId - 任务实例ID
     * @returns {Promise<Object>} 停止结果
     * @private
     */
    async _stopMockScript(currentExecutionId, taskInstanceId) {
        TaskLogger.logWarning('正在停止模拟执行...');
        
        try {
            // 清理模拟任务函数
            if (window[`__mockTask_${taskInstanceId}`]) {
                delete window[`__mockTask_${taskInstanceId}`];
            }
            
            // 清空执行ID（这会触发模拟执行检查并停止）
            window.__currentExecutionId = null;
            
            TaskLogger.logWarning('✋ 模拟执行已被用户停止');
            
            return {
                success: true,
                type: 'mock',
                message: '模拟执行已停止'
            };
        } catch (error) {
            console.error('[脚本停止] 停止模拟脚本失败:', error);
            return {
                success: false,
                type: 'mock',
                error: error.message
            };
        }
    }

    /**
     * 处理无有效执行ID的情况
     * @param {string} currentExecutionId - 当前执行ID
     * @returns {Promise<Object>} 停止结果
     * @private
     */
    async _handleNoValidExecution(currentExecutionId) {
        TaskLogger.logError('无法停止脚本：执行ID不存在或停止接口不可用');
        TaskLogger.logWarning(`调试信息: executionId=${currentExecutionId}, scriptAPI=${!!window.scriptAPI}`);
        
        return {
            success: false,
            type: 'invalid',
            error: '执行ID不存在或停止接口不可用',
            allowForceCleanup: true
        };
    }

    /**
     * 处理停止成功
     * @param {Object} stopResult - 停止结果
     * @param {HTMLElement} managerPage - 管理页面元素
     * @private
     */
    async _handleStopSuccess(stopResult, managerPage) {
        // 清理当前执行状态
        window.__currentExecutionId = null;
        
        // 更新UI状态
        this._updateUIAfterStop('已停止', '#e74c3c');
        
        // 清理监听器
        this._cleanupListeners();
        
        // 隐藏停止按钮
        this._hideStopButton();
        
        // 重置开始按钮
        this._resetStartButton(managerPage);
        
        console.log('[脚本停止] 停止成功，UI已更新');
    }

    /**
     * 处理停止失败
     * @param {Object} stopResult - 停止结果
     * @param {HTMLElement} stopTaskButton - 停止按钮元素
     * @param {HTMLElement} managerPage - 管理页面元素
     * @private
     */
    async _handleStopFailure(stopResult, stopTaskButton, managerPage) {
        if (stopResult.allowForceStop) {
            // 允许强制停止
            const forceStop = confirm('后端停止脚本失败，是否强制清理前端状态？\n' +
                '注意：这可能导致后端脚本继续运行，但前端将停止显示。');
            
            if (forceStop) {
                await this._executeForceStop(managerPage);
            } else {
                // 恢复按钮状态
                this._updateStopButtonState(stopTaskButton, 'normal');
            }
        } else if (stopResult.allowForceCleanup) {
            // 允许强制清理UI状态
            const forceCleanup = confirm('未找到有效的执行ID，是否清理UI状态？\n' +
                '这将重置界面，但不会影响可能正在运行的后端脚本。');
            
            if (forceCleanup) {
                await this._executeForceCleanup(managerPage);
            } else {
                // 恢复按钮状态
                this._updateStopButtonState(stopTaskButton, 'normal');
            }
        } else {
            // 恢复按钮状态
            this._updateStopButtonState(stopTaskButton, 'normal');
        }
    }

    /**
     * 执行强制停止
     * @param {HTMLElement} managerPage - 管理页面元素
     * @private
     */
    async _executeForceStop(managerPage) {
        TaskLogger.logWarning('⚠️  用户选择强制停止，清理前端状态');
        
        // 强制清理当前执行状态
        window.__currentExecutionId = null;
        
        // 更新UI状态
        this._updateUIAfterStop('已强制停止', '#e74c3c');
        
        // 清理监听器
        this._cleanupListeners();
        
        // 隐藏停止按钮
        this._hideStopButton();
        
        // 重置开始按钮
        this._resetStartButton(managerPage);
        
        console.log('[脚本停止] 强制停止完成');
    }

    /**
     * 执行强制清理
     * @param {HTMLElement} managerPage - 管理页面元素
     * @private
     */
    async _executeForceCleanup(managerPage) {
        TaskLogger.logWarning('⚠️  强制清理UI状态');
        
        // 强制清理所有状态
        window.__currentExecutionId = null;
        
        // 停止计时器
        this._stopExecutionTimer();
        
        // 更新UI状态
        this._updateUIAfterStop('已清理', '#e74c3c');
        
        // 清理监听器
        this._cleanupListeners();
        
        // 隐藏停止按钮
        this._hideStopButton();
        
        // 重置开始按钮
        this._resetStartButton(managerPage);
        
        console.log('[脚本停止] 强制清理完成');
    }

    /**
     * 停止执行计时器
     * @private
     */
    _stopExecutionTimer() {
        if (window.__executionTimer) {
            clearInterval(window.__executionTimer);
            window.__executionTimer = null;
            console.log('[脚本停止] 执行计时器已停止');
        }
    }

    /**
     * 更新停止按钮状态
     * @param {HTMLElement} stopTaskButton - 停止按钮元素
     * @param {string} state - 状态：'stopping' | 'normal'
     * @private
     */
    _updateStopButtonState(stopTaskButton, state) {
        if (!stopTaskButton) return;
        
        switch (state) {
            case 'stopping':
                stopTaskButton.disabled = true;
                stopTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>停止中</span>';
                break;
            case 'normal':
                stopTaskButton.disabled = false;
                stopTaskButton.innerHTML = '<i class="fas fa-stop"></i><span>停止</span>';
                break;
        }
    }

    /**
     * 更新UI状态
     * @param {string} statusText - 状态文本
     * @param {string} statusColor - 状态颜色
     * @private
     */
    _updateUIAfterStop(statusText, statusColor) {
        const statusElement = document.getElementById('statusText');
        if (statusElement) {
            statusElement.textContent = statusText;
            statusElement.style.color = statusColor;
        }
    }

    /**
     * 清理监听器
     * @private
     */
    _cleanupListeners() {
        if (window.__currentLogUnsubscribers) {
            window.__currentLogUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    try {
                        unsubscribe();
                    } catch (e) {
                        console.warn('[脚本停止] 清理监听器失败:', e);
                    }
                }
            });
            window.__currentLogUnsubscribers = null;
        }
    }

    /**
     * 隐藏停止按钮
     * @private
     */
    _hideStopButton() {
        const stopButton = document.getElementById('stop-btn');
        if (stopButton) {
            stopButton.style.display = 'none';
        }
    }

    /**
     * 重置开始按钮
     * @param {HTMLElement} managerPage - 管理页面元素
     * @private
     */
    _resetStartButton(managerPage) {
        const startButton = managerPage.querySelector('#start-execution-btn');
        if (startButton) {
            startButton.disabled = false;
            startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        }
    }

    /**
     * 清理资源
     */
    cleanup() {
        this.isStoppingScript = false;
        console.log('[脚本停止] ScriptStopManager 已清理');
    }

    /**
     * 获取停止状态
     * @returns {boolean} 是否正在停止
     */
    isStoppingInProgress() {
        return this.isStoppingScript;
    }
}

/**
 * 创建脚本停止管理器实例并暴露全局函数
 * @returns {ScriptStopManager} 脚本停止管理器实例
 */
export function setupGlobalScriptStopManager() {
    const scriptStopManager = new ScriptStopManager();
    
    // 暴露核心功能到全局
    window.FAScriptStopManager = scriptStopManager;
    
    // 暴露向后兼容的全局函数
    window.bindStopButtonEvent = (taskInstanceId, managerPage) => {
        return scriptStopManager.bindStopButtonEvent(taskInstanceId, managerPage);
    };
    
    window.handleStopExecution = (taskInstanceId, stopTaskButton, managerPage) => {
        return scriptStopManager.handleStopExecution(taskInstanceId, stopTaskButton, managerPage);
    };
    
    // 调试功能
    window.__debugScriptStop = () => {
        console.log('=== 脚本停止管理器调试信息 ===');
        console.log('正在停止:', scriptStopManager.isStoppingInProgress());
        console.log('当前执行ID:', window.__currentExecutionId);
        console.log('计时器状态:', !!window.__executionTimer);
    };
    
    console.log('[脚本停止] ScriptStopManager 全局函数已设置');
    return scriptStopManager;
} 