/**
 * 脚本执行管理器
 * 负责脚本的启动、停止、状态管理、日志监听器管理、执行计时器管理等
 */

import { BatchTaskManager } from '../batchTaskManager.js';
import { TaskLogger } from '../logger.js';
import { batchTaskConfigs, VIEW_MODES } from '../config/constants.js';

/**
 * 脚本执行管理器类
 */
export class ScriptExecutionManager {
    constructor(pageState, backgroundTasks, backgroundTaskHelpers) {
        this.pageState = pageState;
        this.backgroundTasks = backgroundTasks;
        this.backgroundTaskHelpers = backgroundTaskHelpers;
        this.activeExecutions = new Map(); // 存储活动执行的信息
    }

    /**
     * 处理开始执行任务
     * @param {string} taskInstanceId - 任务实例ID
     * @param {HTMLElement} startTaskButton - 开始按钮元素
     * @param {Object} taskConfigManager - 任务配置管理器
     * @returns {Promise<boolean>} 执行是否成功启动
     */
    async handleStartExecution(taskInstanceId, startTaskButton, taskConfigManager) {
        // 防止重复点击
        if (startTaskButton.disabled) {
            console.log('[脚本执行] 任务正在执行中，请勿重复点击');
            return false;
        }
        
        console.log('[脚本执行] 开始执行任务，任务实例ID:', taskInstanceId);
        
        // 记录开始时间（立即记录，不等待计时器）
        window.__startTime = Date.now();
        
        // 检查是否已有相同脚本的后台任务在运行
        const scriptId = this.pageState.currentBatchScriptType?.id;
        const existingBackgroundTask = Array.from(this.backgroundTasks.values()).find(task => 
            task.scriptType?.id === scriptId
        );
        
        if (existingBackgroundTask) {
            const userChoice = confirm(
                `检测到该脚本已有任务在后台运行中！\n\n` +
                `脚本名称: ${existingBackgroundTask.scriptType.name}\n` +
                `运行时长: ${this.backgroundTaskHelpers.formatDuration(Date.now() - existingBackgroundTask.startTime)}\n\n` +
                `点击"确定"查看现有任务\n` +
                `点击"取消"停止现有任务并创建新任务`
            );
            
            if (userChoice) {
                // 用户选择查看现有任务
                if (this.backgroundTaskHelpers.restoreTaskFromBackground(existingBackgroundTask.taskInstanceId)) {
                    // 切换到执行阶段
                    setTimeout(() => {
                        const taskConfig = batchTaskConfigs[existingBackgroundTask.taskInstanceId];
                        if (taskConfig) {
                            this.switchToExecutionStage(taskConfig);
                        }
                    }, 100);
                }
                return false;
            } else {
                // 用户选择停止现有任务
                await this.backgroundTaskHelpers.stopBackgroundTask(existingBackgroundTask.taskInstanceId);
                console.log('[脚本执行] 已停止现有后台任务，准备创建新任务');
            }
        }
        
        // 立即禁用按钮
        startTaskButton.disabled = true;
        startTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 准备中...';
        
        // 保存当前配置数据
        const taskConfig = taskConfigManager.saveCurrentModuleData(taskInstanceId);
        if (!taskConfig) {
            alert('无法保存任务配置，请重试');
            this._resetStartButton(startTaskButton);
            return false;
        }
        
        // 验证配置
        const validation = taskConfigManager.validateTaskConfig(taskInstanceId);
        if (!validation.valid) {
            alert(validation.errors.join('\n'));
            this._resetStartButton(startTaskButton);
            return false;
        }
        
        try {
            // 切换到执行阶段界面
            this.switchToExecutionStage(taskConfig);
            
            // 清理旧的监听器和日志，但保留任务实例ID
            this.cleanupResources(true);
            
            // 初始化执行环境
            const success = await this._initializeExecution(taskInstanceId, taskConfig, startTaskButton);
            return success;
            
        } catch (error) {
            console.error('[脚本执行] 启动执行失败:', error);
            TaskLogger.logError(`启动执行失败: ${error.message || error}`);
            this.switchToConfigStage();
            this._resetStartButton(startTaskButton);
            return false;
        }
    }

    /**
     * 初始化执行环境
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     * @param {HTMLElement} startTaskButton - 开始按钮元素
     * @returns {Promise<boolean>} 初始化是否成功
     * @private
     */
    async _initializeExecution(taskInstanceId, taskConfig, startTaskButton) {
        // 检查当前脚本是否需要钱包
        const scriptRequires = this.pageState.currentBatchScriptType?.requires;
        const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true;
        
        // 初始化日志
        const logContainer = document.getElementById('taskLogContainer');
        if (logContainer) {
            TaskLogger.clearLogContainer(logContainer);
            const cleanupLogRender = TaskLogger.renderLogsToContainer(logContainer, true);
            window.__currentLogCleanup = cleanupLogRender;
            
            TaskLogger.logInfo('🚀 脚本插件执行系统已初始化');
            TaskLogger.logInfo(`📋 任务名称: ${this.pageState.currentBatchScriptType.name}`);
            
            if (requiresWallets) {
                TaskLogger.logInfo(`👥 选择的钱包数量: ${taskConfig.accounts.length}`);
            } else {
                TaskLogger.logInfo(`🔧 脚本类型: 通用工具脚本（无需钱包）`);
            }
            
            if (taskConfig.proxyConfig.enabled) {
                TaskLogger.logInfo(`🌐 代理配置: ${taskConfig.proxyConfig.strategy} 策略，共 ${taskConfig.proxyConfig.proxies.length} 个代理`);
            }
        }
        
        // 创建任务实例
        const batchTaskManager = new BatchTaskManager();
        const taskData = {
            id: taskInstanceId,
            name: `${this.pageState.currentBatchScriptType.name} 批量任务`,
            scriptId: this.pageState.currentBatchScriptType.id,
            scriptName: this.pageState.currentBatchScriptType.name,
            accountIds: taskConfig.accounts,
            proxyConfig: taskConfig.proxyConfig,
            status: 'running',
            startTime: Date.now()
        };
        
        try {
            await batchTaskManager.addTask(taskData);
            TaskLogger.logInfo(`任务 ${taskInstanceId} 已创建并保存到任务管理器`);
        } catch (err) {
            console.warn('[脚本执行] 添加到批量任务管理器失败:', err);
            TaskLogger.logWarning('无法保存任务状态，但脚本执行不受影响');
        }
        
        // 执行脚本
        return await this._executeScript(taskInstanceId, taskConfig, startTaskButton, requiresWallets);
    }

    /**
     * 执行脚本
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     * @param {HTMLElement} startTaskButton - 开始按钮元素
     * @param {boolean} requiresWallets - 是否需要钱包
     * @returns {Promise<boolean>} 执行是否成功启动
     * @private
     */
    async _executeScript(taskInstanceId, taskConfig, startTaskButton, requiresWallets) {
        if (window.scriptAPI && typeof window.scriptAPI.executeScript === 'function') {
            return await this._executeRealScript(taskInstanceId, taskConfig, startTaskButton);
        } else {
            return await this._executeMockScript(taskInstanceId, taskConfig, startTaskButton, requiresWallets);
        }
    }

    /**
     * 执行真实脚本
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     * @param {HTMLElement} startTaskButton - 开始按钮元素
     * @returns {Promise<boolean>} 执行是否成功启动
     * @private
     */
    async _executeRealScript(taskInstanceId, taskConfig, startTaskButton) {
        startTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中...';
        
        const scriptConfig = {
            batchMode: true,
            timestamp: Date.now(),
            taskId: taskInstanceId
        };
        
        // 准备代理配置
        let actualProxyConfigToPass = null;
        if (taskConfig.proxyConfig.enabled && taskConfig.proxyConfig.proxies.length > 0) {
            actualProxyConfigToPass = {
                strategy: taskConfig.proxyConfig.strategy,
                proxies: taskConfig.proxyConfig.proxies
            };
        }
        
        // 注册日志监听（确保只注册一次）
        this.setupScriptLogListeners(taskInstanceId, startTaskButton);
        
        try {
            console.log('[脚本执行] 开始执行脚本...');
            const result = await window.scriptAPI.executeScript(
                this.pageState.currentBatchScriptType.id,
                taskConfig.accounts,
                scriptConfig,
                actualProxyConfigToPass
            );
            
            if (result && result.success && result.data && result.data.executionId) {
                // 设置执行ID并准备UI
                this.setupScriptLogListeners(taskInstanceId, startTaskButton, result.data.executionId);
                
                console.log('[脚本执行] 成功启动，执行ID:', result.data.executionId);
                TaskLogger.logInfo(`✅ 脚本启动成功，执行ID: ${result.data.executionId}`);

                // 显示停止按钮
                const stopBtn = document.getElementById('stop-btn');
                if (stopBtn) {
                    stopBtn.style.display = 'inline-flex';
                }
                
                // 记录活动执行
                this.activeExecutions.set(taskInstanceId, {
                    executionId: result.data.executionId,
                    startTime: Date.now(),
                    scriptType: this.pageState.currentBatchScriptType
                });
                
                return true;
            } else {
                // 处理执行失败
                TaskLogger.logError(`启动脚本失败: ${result?.error || '未获得执行ID'}`);
                this.switchToConfigStage();
                this._resetStartButton(startTaskButton);
                return false;
            }
        } catch (err) {
            console.error('[脚本执行] 执行失败:', err);
            TaskLogger.logError(`执行失败: ${err.message || err}`);
            this.switchToConfigStage();
            this._resetStartButton(startTaskButton);
            return false;
        }
    }

    /**
     * 执行模拟脚本
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     * @param {HTMLElement} startTaskButton - 开始按钮元素
     * @param {boolean} requiresWallets - 是否需要钱包
     * @returns {Promise<boolean>} 执行是否成功启动
     * @private
     */
    async _executeMockScript(taskInstanceId, taskConfig, startTaskButton, requiresWallets) {
        console.warn('[脚本执行] 脚本执行接口未定义，使用模拟执行');
        TaskLogger.logWarning('脚本执行接口未定义，将模拟执行过程');
        
        // 在模拟模式下也生成执行ID
        const mockExecutionId = 'mock_exec_' + taskInstanceId.split('_').pop();
        window.__currentExecutionId = mockExecutionId;
        console.log('[脚本执行] 模拟执行ID已生成:', mockExecutionId);
        
        // 显示停止按钮
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) {
            stopBtn.style.display = 'inline-flex';
        }
        
        // 记录活动执行
        this.activeExecutions.set(taskInstanceId, {
            executionId: mockExecutionId,
            startTime: Date.now(),
            scriptType: this.pageState.currentBatchScriptType,
            isMock: true
        });
        
        // 模拟执行过程
        setTimeout(() => {
            this._runMockExecution(taskInstanceId, taskConfig, requiresWallets);
        }, 1000);
        
        return true;
    }

    /**
     * 运行模拟执行
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     * @param {boolean} requiresWallets - 是否需要钱包
     * @private
     */
    _runMockExecution(taskInstanceId, taskConfig, requiresWallets) {
        TaskLogger.logInfo('开始模拟执行...');
        
        let completed = 0;
        const total = requiresWallets ? taskConfig.accounts.length : 1;
        
        // 创建独立的模拟执行函数
        const simulateTask = () => {
            // 检查任务是否还在运行
            const isInBackground = this.backgroundTasks.has(taskInstanceId);
            const isInForeground = window.__currentExecutionId === 'mock_exec_' + taskInstanceId.split('_').pop();
            
            if (!isInBackground && !isInForeground) {
                console.log('[脚本执行] 模拟执行被停止');
                return;
            }
            
            if (completed < total) {
                completed++;
                const logMsg = requiresWallets 
                    ? `账户 ${completed}/${total} 执行成功`
                    : `脚本执行成功`;
                
                // 如果在前台，使用TaskLogger
                if (isInForeground && typeof TaskLogger !== 'undefined' && TaskLogger.logSuccess) {
                    TaskLogger.logSuccess(logMsg);
                } else {
                    // 在后台，只记录日志
                    console.log('[后台执行]', logMsg);
                }
                
                // 只有在前台执行时才更新UI
                if (isInForeground) {
                    const successCountElement = document.getElementById('successCount');
                    if (successCountElement) {
                        successCountElement.textContent = completed;
                    }
                }
                
                // 继续下一次执行
                setTimeout(simulateTask, 1000);
            } else {
                // 执行完成
                this._handleMockExecutionComplete(taskInstanceId, completed, total, requiresWallets, isInBackground, isInForeground);
            }
        };
        
        // 保存模拟任务引用，以便后台运行
        window[`__mockTask_${taskInstanceId}`] = simulateTask;
        
        // 开始执行
        simulateTask();
    }

    /**
     * 处理模拟执行完成
     * @param {string} taskInstanceId - 任务实例ID
     * @param {number} completed - 完成数量
     * @param {number} total - 总数量
     * @param {boolean} requiresWallets - 是否需要钱包
     * @param {boolean} isInBackground - 是否在后台
     * @param {boolean} isInForeground - 是否在前台
     * @private
     */
    _handleMockExecutionComplete(taskInstanceId, completed, total, requiresWallets, isInBackground, isInForeground) {
        console.log('[脚本执行] 模拟执行完成');
        
        // 如果在前台，显示完成信息
        if (isInForeground && typeof TaskLogger !== 'undefined') {
            TaskLogger.logSuccess('✅ 脚本插件执行完成！');
            TaskLogger.logInfo(`📊 执行总结:`);
            if (requiresWallets) {
                TaskLogger.logInfo(`   - 总账户数: ${total}`);
            } else {
                TaskLogger.logInfo(`   - 脚本类型: 通用工具脚本`);
            }
            TaskLogger.logInfo(`   - 成功: ${completed}`);
            TaskLogger.logInfo(`   - 失败: 0`);
            TaskLogger.logInfo(`   - 耗时: 模拟执行`);
        }
        
        // 清理后台任务
        if (isInBackground) {
            this.backgroundTasks.delete(taskInstanceId);
            this.backgroundTaskHelpers.saveBackgroundTasksToStorage();
            this.backgroundTaskHelpers.updateBackgroundTaskIndicator();
        }
        
        // 清理前台资源
        if (isInForeground) {
            this._handleExecutionComplete(taskInstanceId);
        }
        
        // 清理活动执行记录
        this.activeExecutions.delete(taskInstanceId);
    }

    /**
     * 处理执行完成
     * @param {string} taskInstanceId - 任务实例ID
     * @private
     */
    _handleExecutionComplete(taskInstanceId) {
        // 停止计时器
        if (window.__executionTimer) {
            clearInterval(window.__executionTimer);
            window.__executionTimer = null;
        }
        
        // 更新状态
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = '已完成';
            statusText.style.color = '#27ae60';
        }
        
        // 隐藏停止按钮
        const stopBtnElement = document.getElementById('stop-btn');
        if (stopBtnElement) {
            stopBtnElement.style.display = 'none';
        }
        
        // 重置开始按钮状态
        const startButton = document.getElementById('start-execution-btn');
        if (startButton) {
            startButton.disabled = false;
            startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        }
        
        // 清理监听器
        if (window.__currentLogUnsubscribers) {
            window.__currentLogUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            window.__currentLogUnsubscribers = null;
        }
    }

    /**
     * 停止脚本执行
     * @param {string} taskInstanceId - 任务实例ID
     * @param {boolean} force - 是否强制停止
     * @returns {Promise<boolean>} 停止是否成功
     */
    async stopExecution(taskInstanceId, force = false) {
        const execution = this.activeExecutions.get(taskInstanceId);
        if (!execution) {
            console.warn('[脚本执行] 未找到活动执行:', taskInstanceId);
            return false;
        }
        
        console.log('[脚本执行] 停止执行:', taskInstanceId, '执行ID:', execution.executionId);
        
        try {
            if (execution.isMock) {
                // 处理模拟执行停止
                return await this._stopMockExecution(taskInstanceId, execution);
            } else {
                // 处理真实脚本停止
                return await this._stopRealExecution(taskInstanceId, execution, force);
            }
        } catch (error) {
            console.error('[脚本执行] 停止执行失败:', error);
            return false;
        }
    }

    /**
     * 停止模拟执行
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} execution - 执行信息
     * @returns {Promise<boolean>} 停止是否成功
     * @private
     */
    async _stopMockExecution(taskInstanceId, execution) {
        TaskLogger.logWarning('正在停止模拟执行...');
        
        // 清理模拟任务函数
        if (window[`__mockTask_${taskInstanceId}`]) {
            delete window[`__mockTask_${taskInstanceId}`];
        }
        
        // 清空执行ID
        window.__currentExecutionId = null;
        
        TaskLogger.logWarning('✋ 模拟执行已被用户停止');
        
        // 清理活动执行记录
        this.activeExecutions.delete(taskInstanceId);
        
        return true;
    }

    /**
     * 停止真实脚本执行
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} execution - 执行信息
     * @param {boolean} force - 是否强制停止
     * @returns {Promise<boolean>} 停止是否成功
     * @private
     */
    async _stopRealExecution(taskInstanceId, execution, force) {
        if (!window.scriptAPI || !window.scriptAPI.stopScript) {
            TaskLogger.logError('无法停止脚本：停止接口不可用');
            return false;
        }
        
        TaskLogger.logWarning('正在停止脚本执行...');
        TaskLogger.logInfo(`执行ID: ${execution.executionId}`);
        
        const result = await window.scriptAPI.stopScript(execution.executionId);
        console.log('[脚本执行] 停止结果:', result);
        
        if (result.success) {
            TaskLogger.logWarning('✋ 脚本执行已被用户停止');
            
            // 清理当前执行状态
            window.__currentExecutionId = null;
            
            // 清理活动执行记录
            this.activeExecutions.delete(taskInstanceId);
            
            return true;
        } else {
            TaskLogger.logError(`停止脚本失败: ${result.error || '未知错误'}`);
            
            if (force) {
                TaskLogger.logWarning('⚠️  强制停止，清理前端状态');
                window.__currentExecutionId = null;
                this.activeExecutions.delete(taskInstanceId);
                return true;
            }
            
            return false;
        }
    }

    /**
     * 切换到执行阶段
     * @param {Object} taskConfig - 任务配置
     */
    switchToExecutionStage(taskConfig) {
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
        const scriptRequires = this.pageState.currentBatchScriptType?.requires;
        const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true;
        const totalCount = requiresWallets ? taskConfig.accounts.length : 1;
        
        document.getElementById('totalCount').textContent = totalCount;
        document.getElementById('successCount').textContent = '0';
        document.getElementById('failCount').textContent = '0';
        
        // 开始计时
        this.startExecutionTimer();
    }

    /**
     * 切换回配置阶段
     */
    switchToConfigStage() {
        // 显示配置区域，隐藏日志区域
        const configSection = document.getElementById('configSection');
        const logSection = document.getElementById('logSection');
        
        if (configSection) {
            configSection.style.display = 'flex';
            configSection.style.flexDirection = 'column';
            configSection.style.height = '100%';
        }
        
        if (logSection) {
            logSection.style.display = 'none';
        }
        
        // 隐藏头部控制按钮
        const headerControls = document.getElementById('headerControls');
        if (headerControls) {
            headerControls.style.display = 'none';
        }
        
        // 更新状态
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = '配置中';
            statusText.style.color = '#666';
        }
        
        // 隐藏计时器
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.style.display = 'none';
        }
        
        // 只有在没有后台任务时才停止计时器
        const hasBackgroundTasks = this.backgroundTasks.size > 0;
        if (!hasBackgroundTasks && window.__executionTimer) {
            clearInterval(window.__executionTimer);
            window.__executionTimer = null;
            console.log('[脚本执行] 没有后台任务，停止计时器');
        } else if (hasBackgroundTasks) {
            console.log('[脚本执行] 存在后台任务，保持计时器运行');
        }
        
        // 确保配置内容区域恢复正确的样式
        const configContent = document.getElementById('moduleContentDisplay');
        if (configContent) {
            configContent.style.flex = '1';
            configContent.style.overflowY = 'auto';
            configContent.style.padding = '20px';
        }
        
        // 确保操作栏恢复正确的样式
        const actionBar = document.querySelector('.action-bar');
        if (actionBar) {
            actionBar.style.display = 'block';
            actionBar.style.padding = '16px 20px';
            actionBar.style.background = '#fff';
            actionBar.style.borderTop = '1px solid #e9ecef';
            actionBar.style.textAlign = 'center';
        }
        
        // 强制重新渲染，确保布局正确
        setTimeout(() => {
            if (configSection) {
                configSection.offsetHeight;
            }
        }, 10);
    }

    /**
     * 设置脚本日志监听器
     * @param {string} taskInstanceId - 任务实例ID
     * @param {HTMLElement} startTaskButton - 开始按钮元素
     * @param {string} executionIdToSet - 要设置的执行ID
     */
    setupScriptLogListeners(taskInstanceId, startTaskButton, executionIdToSet) {
        // 确保执行ID正确设置
        window.__currentTaskInstanceId = taskInstanceId;
        if (executionIdToSet) {
            window.__currentExecutionId = executionIdToSet;
            console.log('[脚本执行] 设置执行ID:', executionIdToSet);
        }

        if (window.__currentLogCleanup) {
            try {
                window.__currentLogCleanup();
            } catch(e) { 
                console.warn('[脚本执行] 清理旧日志渲染器失败', e); 
            }
            window.__currentLogCleanup = null;
        }

        const logContainer = document.getElementById('taskLogContainer');
        if (logContainer && (this.pageState.currentView === VIEW_MODES.MANAGER || this.pageState.currentView === 'manager')) {
            TaskLogger.clearLogContainer(logContainer);
            const cleanupLogRender = TaskLogger.renderLogsToContainer(logContainer, true);
            window.__currentLogCleanup = cleanupLogRender;
            
            if (executionIdToSet) {
                TaskLogger.logInfo(`🎯 开始监听任务 ${taskInstanceId} (执行ID: ${executionIdToSet}) 的日志...`);
            } else {
                TaskLogger.logInfo(`📝 开始记录任务 ${taskInstanceId} 的日志...`);
            }
        }
        
        console.log(`[脚本执行] 已设置当前活动任务: taskInstanceId=${taskInstanceId}, executionId=${executionIdToSet || 'none'}`);
        
        // 验证执行ID设置
        setTimeout(() => {
            if (window.__currentExecutionId !== executionIdToSet && executionIdToSet) {
                console.warn('[脚本执行] 执行ID设置验证失败，重新设置');
                window.__currentExecutionId = executionIdToSet;
            }
        }, 100);
    }

    /**
     * 开始执行计时器
     */
    startExecutionTimer() {
        let seconds = 0;
        const timerElement = document.getElementById('timer');
        
        // 记录开始时间（用于后台任务管理）
        window.__startTime = Date.now();
        
        if (window.__executionTimer) {
            clearInterval(window.__executionTimer);
        }
        
        window.__executionTimer = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const secs = seconds % 60;
            
            if (timerElement) {
                timerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
        }, 1000);
        
        // 绑定日志控制按钮
        this._bindLogControlButtons();
    }

    /**
     * 绑定日志控制按钮
     * @private
     */
    _bindLogControlButtons() {
        const clearLogsBtn = document.getElementById('clearBtn');
        const downloadLogsBtn = document.getElementById('downloadBtn');
        const toggleAutoScrollBtn = document.getElementById('autoScrollBtn');
        
        if (clearLogsBtn) {
            clearLogsBtn.onclick = () => {
                const logContainer = document.getElementById('taskLogContainer');
                if (logContainer) {
                    TaskLogger.clearLogContainer(logContainer);
                    TaskLogger.logInfo('日志已清空');
                }
            };
        }
        
        if (downloadLogsBtn) {
            downloadLogsBtn.onclick = this._downloadLogs;
        }
        
        if (toggleAutoScrollBtn) {
            let autoScroll = true;
            toggleAutoScrollBtn.classList.add('active');
            
            toggleAutoScrollBtn.onclick = () => {
                autoScroll = !autoScroll;
                toggleAutoScrollBtn.classList.toggle('active', autoScroll);
                
                if (autoScroll) {
                    const logContainer = document.getElementById('taskLogContainer');
                    if (logContainer) {
                        logContainer.scrollTop = logContainer.scrollHeight;
                    }
                }
            };
            
            // 自动滚动逻辑
            const logContainer = document.getElementById('taskLogContainer');
            if (logContainer) {
                const observer = new MutationObserver(() => {
                    if (autoScroll) {
                        logContainer.scrollTop = logContainer.scrollHeight;
                    }
                });
                
                observer.observe(logContainer, { childList: true, subtree: true });
                window.__logObserver = observer;
            }
        }
    }

    /**
     * 下载日志
     * @private
     */
    _downloadLogs() {
        const logContainer = document.getElementById('taskLogContainer');
        if (!logContainer) return;
        
        // 获取所有日志文本
        const logEntries = logContainer.querySelectorAll('.log-entry');
        let logText = '';
        
        logEntries.forEach(entry => {
            const time = entry.querySelector('.log-time')?.textContent || '';
            const message = entry.querySelector('.log-message')?.textContent || '';
            logText += `${time} ${message}\n`;
        });
        
        // 创建Blob并下载
        const blob = new Blob([logText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const now = new Date();
        const timestamp = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}${now.getSeconds().toString().padStart(2,'0')}`;
        
        a.href = url;
        a.download = `batch_script_log_${timestamp}.txt`;
        a.click();
        
        URL.revokeObjectURL(url);
    }

    /**
     * 清理资源
     * @param {boolean} preserveTaskInstanceId - 是否保留任务实例ID
     */
    cleanupResources(preserveTaskInstanceId) {
        // 清理定时器
        if (window.__executionTimer) {
            clearInterval(window.__executionTimer);
            window.__executionTimer = null;
        }
        
        // 清理日志监听器
        if (window.__currentLogUnsubscribers) {
            window.__currentLogUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            window.__currentLogUnsubscribers = null;
        }
        
        // 清理日志渲染器
        if (window.__currentLogCleanup && typeof window.__currentLogCleanup === 'function') {
            window.__currentLogCleanup();
            window.__currentLogCleanup = null;
        }
        
        // 清理日志观察器
        if (window.__logObserver) {
            window.__logObserver.disconnect();
            window.__logObserver = null;
        }
        
        // 清理执行ID
        if (window.__currentExecutionId) {
            window.__currentExecutionId = null;
        }
        
        // 清理批量任务日志
        if (window.batchTaskLogs) {
            window.batchTaskLogs = {};
        }
        
        // 根据参数决定是否清理任务实例ID
        if (!preserveTaskInstanceId && window.__currentTaskInstanceId) {
            console.log('[脚本执行] 清理任务实例ID:', window.__currentTaskInstanceId);
            window.__currentTaskInstanceId = null;
        } else if (preserveTaskInstanceId && window.__currentTaskInstanceId) {
            console.log('[脚本执行] 保留任务实例ID:', window.__currentTaskInstanceId);
        }
        
        console.log('[脚本执行] 资源清理完成');
    }

    /**
     * 重置开始按钮状态
     * @param {HTMLElement} startTaskButton - 开始按钮元素
     * @private
     */
    _resetStartButton(startTaskButton) {
        startTaskButton.disabled = false;
        startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
    }

    /**
     * 获取活动执行信息
     * @param {string} taskInstanceId - 任务实例ID（可选）
     * @returns {Object|Map} 执行信息
     */
    getActiveExecutions(taskInstanceId) {
        if (taskInstanceId) {
            return this.activeExecutions.get(taskInstanceId);
        }
        return this.activeExecutions;
    }

    /**
     * 清理所有资源
     */
    cleanup() {
        // 停止所有活动执行
        for (const [taskInstanceId] of this.activeExecutions) {
            this.stopExecution(taskInstanceId, true);
        }
        
        // 清理资源
        this.cleanupResources();
        
        // 清空活动执行
        this.activeExecutions.clear();
        
        console.log('[脚本执行] ScriptExecutionManager 已清理');
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            activeExecutions: this.activeExecutions.size,
            executions: Array.from(this.activeExecutions.entries()).map(([taskId, execution]) => ({
                taskId,
                executionId: execution.executionId,
                isMock: execution.isMock || false,
                startTime: execution.startTime,
                duration: Date.now() - execution.startTime
            }))
        };
    }
}

/**
 * 创建脚本执行管理器实例并暴露全局函数
 * @param {Object} pageState - 页面状态对象
 * @param {Map} backgroundTasks - 后台任务列表
 * @param {Object} backgroundTaskHelpers - 后台任务辅助函数
 * @param {Object} taskConfigManager - 任务配置管理器
 * @returns {ScriptExecutionManager} 脚本执行管理器实例
 */
export function setupGlobalScriptExecutionManager(pageState, backgroundTasks, backgroundTaskHelpers, taskConfigManager) {
    const scriptExecutionManager = new ScriptExecutionManager(pageState, backgroundTasks, backgroundTaskHelpers);
    
    // 暴露核心功能到全局
    window.FAScriptExecutionManager = scriptExecutionManager;
    
    // 暴露向后兼容的全局函数
    window.handleStartExecution = (taskInstanceId, startTaskButton) => {
        return scriptExecutionManager.handleStartExecution(taskInstanceId, startTaskButton, taskConfigManager);
    };
    
    window.switchToExecutionStage = (taskConfig) => {
        return scriptExecutionManager.switchToExecutionStage(taskConfig);
    };
    
    window.switchToConfigStage = () => {
        return scriptExecutionManager.switchToConfigStage();
    };
    
    window.setupScriptLogListeners = (taskInstanceId, startTaskButton, executionIdToSet) => {
        return scriptExecutionManager.setupScriptLogListeners(taskInstanceId, startTaskButton, executionIdToSet);
    };
    
    window.startExecutionTimer = () => {
        return scriptExecutionManager.startExecutionTimer();
    };
    
    window.cleanupResources = (preserveTaskInstanceId) => {
        return scriptExecutionManager.cleanupResources(preserveTaskInstanceId);
    };
    
    window.downloadLogs = () => {
        return scriptExecutionManager._downloadLogs();
    };
    
    // 调试功能
    window.__debugScriptExecution = () => {
        console.log('=== 脚本执行管理器调试信息 ===');
        console.log('统计信息:', scriptExecutionManager.getStats());
        console.log('活动执行:', scriptExecutionManager.activeExecutions);
        console.log('页面状态:', pageState);
    };
    
    console.log('[脚本执行] ScriptExecutionManager 全局函数已设置');
    return scriptExecutionManager;
} 