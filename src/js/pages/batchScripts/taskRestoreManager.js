/**
 * 任务恢复管理器
 * 专门处理后台任务的恢复逻辑，简化恢复流程，确保日志实时查看功能正常
 */

import { TaskLogger } from './logger.js';

/**
 * 任务恢复状态
 */
const RESTORE_STATES = {
    IDLE: 'idle',
    RESTORING: 'restoring',
    CONNECTING: 'connecting',
    COMPLETED: 'completed',
    FAILED: 'failed'
};

/**
 * 任务恢复管理器类
 */
export class TaskRestoreManager {
    constructor() {
        this.restoreState = RESTORE_STATES.IDLE;
        this.currentTaskId = null;
        this.logReconnectAttempts = 0;
        this.maxReconnectAttempts = 3;
        this.reconnectDelay = 1000; // 1秒
        
        // 日志缓冲区，用于存储恢复过程中的日志
        this.logBuffer = [];
        this.logListeners = new Set();
    }

    /**
     * 恢复后台任务到前台
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} backgroundTask - 后台任务数据
     * @returns {Promise<boolean>} 恢复是否成功
     */
    async restoreTask(taskInstanceId, backgroundTask) {
        if (this.restoreState === RESTORE_STATES.RESTORING) {
            console.warn('[任务恢复] 正在恢复其他任务，请稍候');
            return false;
        }

        this.restoreState = RESTORE_STATES.RESTORING;
        this.currentTaskId = taskInstanceId;
        this.logReconnectAttempts = 0;

        try {
            console.log(`[任务恢复] 开始温和恢复任务: ${taskInstanceId} (不中断脚本执行)`);
            
            // 步骤1: 恢复全局状态
            this._restoreGlobalState(backgroundTask);
            
            // 步骤2: 恢复UI状态
            await this._restoreUIState(taskInstanceId, backgroundTask);
            
            // 步骤3: 恢复日志系统
            await this._restoreLogSystem(backgroundTask);
            
            // 步骤4: 温和地重新连接脚本执行（不发送中断请求）
            await this._gentlyReconnectToScript(backgroundTask);
            
            this.restoreState = RESTORE_STATES.COMPLETED;
            console.log(`[任务恢复] 任务 ${taskInstanceId} 恢复完成，脚本继续运行`);
            return true;
            
        } catch (error) {
            console.error(`[任务恢复] 恢复任务 ${taskInstanceId} 失败:`, error);
            this.restoreState = RESTORE_STATES.FAILED;
            
            // 显示错误提示
            this._showRestoreError(error);
            return false;
        }
    }

    /**
     * 恢复全局状态
     * @param {Object} backgroundTask - 后台任务数据
     * @private
     */
    _restoreGlobalState(backgroundTask) {
        console.log('[任务恢复] 恢复全局状态...');
        
        // 恢复执行相关的全局变量
        window.__currentExecutionId = backgroundTask.executionId;
        window.__currentTaskInstanceId = backgroundTask.taskInstanceId;
        window.__startTime = backgroundTask.startTime;
        
        // 确保监听器数组存在（但不清理现有的）
        if (!window.__currentLogUnsubscribers) {
            window.__currentLogUnsubscribers = [];
        }
        
        // 恢复脚本类型
        if (window.pageState) {
            window.pageState.currentBatchScriptType = backgroundTask.scriptType;
            // 确保视图模式设置为MANAGER，这样全局日志处理器就知道要显示日志到UI
            // 使用字符串常量，避免模块导入问题
            window.pageState.currentView = 'manager';
        }
        
        console.log('[任务恢复] 全局状态已恢复:', {
            executionId: window.__currentExecutionId,
            taskInstanceId: window.__currentTaskInstanceId,
            scriptType: backgroundTask.scriptType?.name,
            pageView: window.pageState?.currentView
        });
    }

    /**
     * 恢复UI状态
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} backgroundTask - 后台任务数据
     * @private
     */
    async _restoreUIState(taskInstanceId, backgroundTask) {
        console.log('[任务恢复] 恢复UI状态...');
        
        return new Promise((resolve) => {
            // 首先确保页面状态正确
            if (window.pageState) {
                window.pageState.currentBatchScriptType = backgroundTask.scriptType;
                console.log('[任务恢复] 已设置当前脚本类型:', backgroundTask.scriptType?.name);
            }
            
            // 导航到任务管理器
            if (window.navigateToModularTaskManager) {
                console.log('[任务恢复] 调用导航函数...');
                window.navigateToModularTaskManager(taskInstanceId);
            } else {
                console.warn('[任务恢复] navigateToModularTaskManager 函数不存在');
            }
            
            // 等待UI渲染完成后切换到执行阶段
            setTimeout(() => {
                console.log('[任务恢复] 检查UI元素是否存在...');
                
                // 检查关键元素是否存在
                const logSection = document.getElementById('logSection');
                const configSection = document.getElementById('configSection');
                
                console.log('[任务恢复] logSection:', logSection ? '存在' : '不存在');
                console.log('[任务恢复] configSection:', configSection ? '存在' : '不存在');
                
                if (!logSection && !configSection) {
                    console.error('[任务恢复] 关键UI元素不存在，导航可能失败');
                    // 尝试强制重新导航
                    if (window.navigateToModularTaskManager) {
                        console.log('[任务恢复] 重新尝试导航...');
                        window.navigateToModularTaskManager(taskInstanceId);
                        
                        // 再等待一段时间
                        setTimeout(() => {
                            this._completeUIRestore(taskInstanceId, backgroundTask, resolve);
                        }, 500);
                    } else {
                        console.error('[任务恢复] 无法重新导航，UI恢复失败');
                        resolve();
                    }
                } else {
                    this._completeUIRestore(taskInstanceId, backgroundTask, resolve);
                }
            }, 300);
        });
    }

    /**
     * 完成UI恢复
     * @private
     */
    _completeUIRestore(taskInstanceId, backgroundTask, resolve) {
        // 恢复或创建任务配置
        if (!window.batchTaskConfigs) {
            window.batchTaskConfigs = {};
        }
        
        if (!window.batchTaskConfigs[taskInstanceId]) {
            // 从后台任务元数据恢复任务配置
            const uiState = backgroundTask.metadata?.uiState;
            if (uiState && uiState.taskConfig) {
                window.batchTaskConfigs[taskInstanceId] = uiState.taskConfig;
            } else {
                // 创建基本配置
                window.batchTaskConfigs[taskInstanceId] = {
                    scriptTypeId: backgroundTask.scriptType?.id,
                    scriptName: backgroundTask.scriptType?.name,
                    accounts: [],
                    proxyConfig: {
                        enabled: false,
                        strategy: 'one-to-one',
                        proxies: []
                    }
                };
            }
        }
        
        const taskConfig = window.batchTaskConfigs[taskInstanceId];
        
        // 切换到执行阶段
        this._switchToExecutionStage(taskConfig);
        console.log('[任务恢复] 已切换到执行阶段');
        
        console.log('[任务恢复] UI状态已恢复');
        resolve();
    }

    /**
     * 恢复日志系统
     * @param {Object} backgroundTask - 后台任务数据
     * @private
     */
    async _restoreLogSystem(backgroundTask) {
        console.log('[任务恢复] 恢复日志系统...');
        
        return new Promise((resolve) => {
            // 使用重试机制等待日志容器出现
            let retryCount = 0;
            const maxRetries = 10;
            const retryInterval = 300;
            
            const tryRestoreLog = () => {
                const logContainer = document.getElementById('taskLogContainer');
                
                if (logContainer) {
                    console.log('[任务恢复] 找到日志容器，开始恢复日志系统');
                    
                    // 清理旧的日志清理函数
                    if (window.__currentLogCleanup && typeof window.__currentLogCleanup === 'function') {
                        window.__currentLogCleanup();
                    }

                    // 初始化新的日志渲染器
                    const cleanupLogRender = TaskLogger.renderLogsToContainer(logContainer, true);
                    window.__currentLogCleanup = cleanupLogRender;

                    // 恢复历史日志
                    this._restoreLogHistory(logContainer, backgroundTask.logHistory || []);
                    
                    // 验证全局日志处理器是否能正确工作
                    console.log('[任务恢复] 验证日志系统状态:', {
                        currentExecutionId: window.__currentExecutionId,
                        pageView: window.pageState?.currentView,
                        logContainerExists: !!document.getElementById('taskLogContainer')
                    });
                    
                    // 添加一条测试日志，验证系统是否正常工作
                    setTimeout(() => {
                        console.log('[任务恢复] 系统验证：模拟日志事件测试全局处理器');
                        // 模拟一个日志事件来测试全局处理器
                        if (typeof window.globalLogEventHandler === 'function') {
                            window.globalLogEventHandler({
                                executionId: window.__currentExecutionId,
                                level: 'info',
                                message: '📡 日志系统已恢复，等待脚本日志...',
                                timestamp: new Date().toISOString()
                            });
                        } else {
                            // 直接使用TaskLogger
                            TaskLogger.logInfo('📡 日志系统已恢复，等待脚本日志...');
                        }
                    }, 500);

                    console.log('[任务恢复] 日志系统已恢复');
                    resolve();
                } else {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        console.log(`[任务恢复] 日志容器未找到，重试 ${retryCount}/${maxRetries}`);
                        setTimeout(tryRestoreLog, retryInterval);
                    } else {
                        console.warn('[任务恢复] 达到最大重试次数，日志容器仍未找到');
                        // 即使没有找到日志容器，也要继续恢复流程
                        resolve();
                    }
                }
            };
            
            // 开始尝试
            tryRestoreLog();
        });
    }

    /**
     * 恢复日志历史
     * @param {HTMLElement} logContainer - 日志容器
     * @param {Array} logHistory - 历史日志数据
     * @private
     */
    _restoreLogHistory(logContainer, logHistory) {
        if (!logHistory || logHistory.length === 0) {
            TaskLogger.logInfo('📋 已恢复后台任务，暂无历史日志');
            return;
        }

        console.log(`[任务恢复] 恢复 ${logHistory.length} 条历史日志`);

        // 移除初始化消息
        const initMessage = logContainer.querySelector('.log-entry');
        if (initMessage && initMessage.textContent.includes('日志系统已初始化')) {
            logContainer.removeChild(initMessage);
        }

        // 添加历史日志
        logHistory.forEach(log => {
            try {
                const logElement = document.createElement('div');
                logElement.innerHTML = log.html;
                const restoredElement = logElement.firstChild;
                if (restoredElement) {
                    logContainer.appendChild(restoredElement);
                }
            } catch (error) {
                console.error('[任务恢复] 恢复日志条目失败:', error);
            }
        });

        // 滚动到底部
        logContainer.scrollTop = logContainer.scrollHeight;
        
        // 添加恢复提示
        TaskLogger.logInfo(`📋 已恢复后台任务，包含 ${logHistory.length} 条历史日志`);
    }

    /**
     * 温和地重新连接到脚本执行（不中断现有连接）
     * @param {Object} backgroundTask - 后台任务数据
     * @private
     */
    async _gentlyReconnectToScript(backgroundTask) {
        if (!backgroundTask.executionId) {
            console.log('[任务恢复] 无执行ID，跳过脚本重连');
            return;
        }

        console.log('[任务恢复] 温和地重新连接到脚本执行（依赖全局监听器）...');
        this.restoreState = RESTORE_STATES.CONNECTING;

        // 不清理全局监听器，因为全局监听器会处理所有日志
        // 只需要确保执行ID正确设置，全局监听器会自动处理日志路由
        console.log('[任务恢复] 依赖现有的全局日志监听器，无需重新注册');

        // 检查主进程连接状态（不发送重连请求）
        await this._reconnectToMainProcess(backgroundTask);
        
        // 记录调试信息
        console.log('[任务恢复] 当前执行ID:', window.__currentExecutionId);
        console.log('[任务恢复] 后台任务执行ID:', backgroundTask.executionId);
        console.log('[任务恢复] 页面视图模式:', window.pageState?.currentView);
    }

    /**
     * 重新连接到脚本执行（原方法，保留用于其他场景）
     * @param {Object} backgroundTask - 后台任务数据
     * @private
     */
    async _reconnectToScript(backgroundTask) {
        if (!backgroundTask.executionId) {
            console.log('[任务恢复] 无执行ID，跳过脚本重连');
            return;
        }

        console.log('[任务恢复] 重新连接到脚本执行...');
        this.restoreState = RESTORE_STATES.CONNECTING;

        // 清理旧的监听器
        this._cleanupOldListeners();

        // 设置新的日志监听器
        await this._setupLogListeners(backgroundTask.executionId);

        // 尝试重新连接到主进程
        await this._reconnectToMainProcess(backgroundTask);
    }

    /**
     * 清理旧的监听器
     * @private
     */
    _cleanupOldListeners() {
        console.log('[任务恢复] 开始清理旧的日志监听器...');
        
        // 清理前端日志监听器
        if (window.__currentLogUnsubscribers && Array.isArray(window.__currentLogUnsubscribers)) {
            console.log(`[任务恢复] 清理 ${window.__currentLogUnsubscribers.length} 个前端监听器`);
            window.__currentLogUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    try {
                        unsubscribe();
                    } catch (error) {
                        console.warn('[任务恢复] 清理监听器失败:', error);
                    }
                }
            });
        }
        
        // 清理IPC日志监听器（只清理script-log，保留其他监听器）
        if (window.electron && window.electron.ipcRenderer) {
            try {
                // 获取当前监听器数量
                const beforeCount = window.electron.ipcRenderer.listenerCount?.('script-log') || 0;
                console.log(`[任务恢复] 清理前script-log监听器数量: ${beforeCount}`);
                
                // 移除所有script-log监听器
                window.electron.ipcRenderer.removeAllListeners('script-log');
                
                const afterCount = window.electron.ipcRenderer.listenerCount?.('script-log') || 0;
                console.log(`[任务恢复] 清理后script-log监听器数量: ${afterCount}`);
            } catch (error) {
                console.warn('[任务恢复] 清理IPC监听器失败:', error);
            }
        }
        
        // 重新初始化监听器数组
        window.__currentLogUnsubscribers = [];
        
        console.log('[任务恢复] 已清理旧的日志监听器（保留脚本执行相关监听器）');
    }

    /**
     * 设置日志监听器
     * @param {string} executionId - 执行ID
     * @private
     */
    async _setupLogListeners(executionId) {
        console.log('[任务恢复] 设置日志监听器...');

        // 确保 __currentLogUnsubscribers 数组存在
        if (!window.__currentLogUnsubscribers) {
            window.__currentLogUnsubscribers = [];
            console.log('[任务恢复] 初始化日志监听器数组');
        }

        // 创建日志事件处理器
        const logEventHandler = (event, data) => {
            // 检查是否是当前任务的日志
            if (data && data.executionId === executionId) {
                this._handleLogData(data);
            }
        };

        // 注册IPC监听器（确保只有一个监听器）
        if (window.electron && window.electron.ipcRenderer) {
            // 检查监听器数量
            const beforeCount = window.electron.ipcRenderer.listenerCount?.('script-log') || 0;
            console.log(`[任务恢复] 注册前script-log监听器数量: ${beforeCount}`);
            
            // 注册新的监听器
            window.electron.ipcRenderer.on('script-log', logEventHandler);
            
            const afterCount = window.electron.ipcRenderer.listenerCount?.('script-log') || 0;
            console.log(`[任务恢复] 注册后script-log监听器数量: ${afterCount}`);
            
            // 保存清理函数
            window.__currentLogUnsubscribers.push(() => {
                try {
                    if (window.electron && window.electron.ipcRenderer) {
                        if (typeof window.electron.ipcRenderer.off === 'function') {
                            window.electron.ipcRenderer.off('script-log', logEventHandler);
                            console.log('[任务恢复] 已移除恢复添加的日志监听器');
                        }
                    }
                } catch (error) {
                    console.warn('[任务恢复] 移除IPC监听器失败:', error);
                }
            });
            
            console.log('[任务恢复] IPC日志监听器已注册');
        }

        // 注册scriptAPI监听器（如果可用）
        if (window.scriptAPI && window.scriptAPI.onLog) {
            const unsubscribe = window.scriptAPI.onLog((data) => {
                logEventHandler(null, data);
            });
            window.__currentLogUnsubscribers.push(unsubscribe);
            
            console.log('[任务恢复] scriptAPI日志监听器已注册');
        }
    }

    /**
     * 处理日志数据
     * @param {Object} data - 日志数据
     * @private
     */
    _handleLogData(data) {
        if (!data) return;

        try {
            const message = typeof data.message === 'string' ? data.message : 
                          (typeof data === 'string' ? data : JSON.stringify(data));
            const level = data.level?.toLowerCase() || 'info';

            // 根据日志级别调用相应的方法
            switch (level) {
                case 'success':
                    TaskLogger.logSuccess(message);
                    break;
                case 'warning':
                case 'warn':
                    TaskLogger.logWarning(message);
                    break;
                case 'error':
                    TaskLogger.logError(message);
                    break;
                default:
                    TaskLogger.logInfo(message);
            }
        } catch (error) {
            console.error('[任务恢复] 处理日志数据失败:', error);
        }
    }

    /**
     * 重新连接到主进程
     * @param {Object} backgroundTask - 后台任务数据
     * @private
     */
    async _reconnectToMainProcess(backgroundTask) {
        console.log('[任务恢复] 检查主进程连接状态...');
        
        // 不发送重连请求，避免中断正在运行的脚本
        // 只是确认连接状态并记录日志
        if (window.electron && window.electron.ipcRenderer) {
            TaskLogger.logInfo('🔄 已连接到主进程，脚本继续运行...');
            console.log('[任务恢复] 主进程连接确认完成');
        } else {
            TaskLogger.logWarning('⚠️ 无法连接到主进程，但脚本可能仍在运行');
            console.warn('[任务恢复] 主进程连接不可用');
        }
        
        // 等待一小段时间让日志显示
        await this._delay(500);
    }

    /**
     * 等待连接建立
     * @private
     */
    async _waitForConnection() {
        return new Promise((resolve) => {
            setTimeout(resolve, 1000); // 等待1秒
        });
    }

    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @private
     */
    async _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 切换到执行阶段 - 内部实现
     * @param {Object} taskConfig - 任务配置
     * @private
     */
    _switchToExecutionStage(taskConfig) {
        // 隐藏配置区域，显示日志区域
        const configSection = document.getElementById('configSection');
        const logSection = document.getElementById('logSection');
        
        if (configSection) {
            configSection.style.display = 'none';
        }
        
        if (logSection) {
            logSection.style.display = 'flex';
        }
        
        // 显示头部控制按钮
        const headerControls = document.getElementById('headerControls');
        if (headerControls) {
            headerControls.style.display = 'flex';
        }
        
        // 显示停止按钮
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) {
            stopBtn.style.display = 'inline-flex';
        }
        
        // 更新状态
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = '执行中';
            statusText.style.color = '#f39c12';
        }
        
        // 显示计时器
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.style.display = 'inline';
        }
        
        // 更新统计信息
        if (taskConfig) {
            const scriptRequires = window.pageState?.currentBatchScriptType?.requires;
            const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true;
            const totalCount = requiresWallets ? (taskConfig.accounts?.length || 0) : 1;
            
            const totalCountElement = document.getElementById('totalCount');
            if (totalCountElement) {
                totalCountElement.textContent = totalCount;
            }
        }
        
        // 启动计时器（如果还没有启动）
        this._startExecutionTimer();
        
        console.log('[任务恢复] 执行阶段UI已设置');
    }

    /**
     * 启动执行计时器
     * @private
     */
    _startExecutionTimer() {
        // 如果计时器已经在运行，不要重复启动
        if (window.__executionTimer) {
            console.log('[任务恢复] 计时器已在运行，跳过启动');
            return;
        }

        const timerElement = document.getElementById('timer');
        if (!timerElement) {
            console.warn('[任务恢复] 计时器元素未找到');
            return;
        }

        // 计算已经运行的时间
        const startTime = window.__startTime || Date.now();
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        
        let seconds = elapsedSeconds;
        
        // 立即更新一次显示
        const updateTimer = () => {
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        };
        
        updateTimer(); // 立即显示当前时间
        
        // 启动定时器
        window.__executionTimer = setInterval(() => {
            seconds++;
            updateTimer();
        }, 1000);
        
        console.log(`[任务恢复] 计时器已启动，从 ${Math.floor(elapsedSeconds/60)}:${(elapsedSeconds%60).toString().padStart(2,'0')} 开始`);
    }

    /**
     * 显示恢复错误
     * @param {Error} error - 错误对象
     * @private
     */
    _showRestoreError(error) {
        TaskLogger.logError(`❌ 任务恢复失败: ${error.message}`);
        
        // 可以在这里添加更友好的错误提示UI
        if (window.showNotification) {
            window.showNotification('任务恢复失败，请重试', 'error');
        }
    }

    /**
     * 获取当前恢复状态
     * @returns {string} 恢复状态
     */
    getRestoreState() {
        return this.restoreState;
    }

    /**
     * 重置恢复状态
     */
    reset() {
        this.restoreState = RESTORE_STATES.IDLE;
        this.currentTaskId = null;
        this.logReconnectAttempts = 0;
        this.logBuffer = [];
    }
}

// 创建全局实例
export const taskRestoreManager = new TaskRestoreManager(); 