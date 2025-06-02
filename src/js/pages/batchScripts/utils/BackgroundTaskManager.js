/**
 * 后台任务管理器
 * 负责管理后台运行的脚本任务，包括任务保存、恢复、停止等功能
 */

// 全局对象和常量
const BACKGROUND_TASKS_STORAGE_KEY = 'fa_background_tasks';
const DEBUG_BACKGROUND_TASKS = false; // 调试模式开关

/**
 * 后台任务管理器类
 * 提供完整的后台任务生命周期管理
 */
export class BackgroundTaskManager {
    constructor() {
        // 使用全局对象确保不会被重新初始化
        if (!window.__FABackgroundTasks) {
            window.__FABackgroundTasks = new Map();
        }
        this.backgroundTasks = window.__FABackgroundTasks;
        
        // 初始化时立即加载后台任务
        this.loadBackgroundTasksFromStorage();
    }

    /**
     * 保存后台任务到localStorage
     */
    saveBackgroundTasksToStorage() {
        try {
            const tasksArray = Array.from(this.backgroundTasks.entries()).map(([taskId, task]) => ({
                taskId,
                taskInstanceId: task.taskInstanceId,
                executionId: task.executionId,
                scriptType: task.scriptType,
                startTime: task.startTime,
                status: task.status,
                // 保存日志历史（限制大小以避免超出localStorage限制）
                logHistory: task.logHistory ? task.logHistory.slice(-100) : [] // 只保存最近100条
            }));
            localStorage.setItem(BACKGROUND_TASKS_STORAGE_KEY, JSON.stringify(tasksArray));
            console.log('[后台任务] 已保存到localStorage:', tasksArray.length, '个任务');
        } catch (error) {
            console.error('[后台任务] 保存到localStorage失败:', error);
        }
    }

    /**
     * 从localStorage恢复后台任务
     * 注意：应用重启后，所有脚本执行都已停止，因此应该清理所有"僵尸"任务
     */
    loadBackgroundTasksFromStorage() {
        try {
            const stored = localStorage.getItem(BACKGROUND_TASKS_STORAGE_KEY);
            if (stored) {
                const tasksArray = JSON.parse(stored);
                
                // 检查是否是应用重启（通过sessionStorage检测）
                // sessionStorage在应用关闭时会被清理，所以可以用来检测应用重启
                const sessionKey = 'fa_app_session_active';
                const isAppRestart = !sessionStorage.getItem(sessionKey);
                
                console.log('[后台任务] 会话检测:', {
                    sessionExists: !!sessionStorage.getItem(sessionKey),
                    isAppRestart,
                    tasksFound: tasksArray.length
                });
                
                if (isAppRestart) {
                    console.log('[后台任务] 检测到应用重启，清理所有僵尸任务');
                    console.log('[后台任务] 发现', tasksArray.length, '个僵尸任务，将被清理');
                    
                    // 清理localStorage中的僵尸任务
                    localStorage.removeItem(BACKGROUND_TASKS_STORAGE_KEY);
                    
                    // 显示清理信息
                    if (tasksArray.length > 0) {
                        console.log('[后台任务] 已清理以下僵尸任务:');
                        tasksArray.forEach(task => {
                            console.log(`  - ${task.scriptType?.name || '未知脚本'} (${task.taskId})`);
                        });
                    }
                    
                    // 设置会话标志（只在确认是新会话时设置）
                    sessionStorage.setItem(sessionKey, 'true');
                    console.log('[后台任务] 已设置新会话标志');
                    
                    return; // 不恢复任何任务
                }
                
                // 如果不是应用重启，正常恢复任务（这种情况很少见）
                tasksArray.forEach(taskData => {
                    // 创建简化的任务对象（不包含函数引用）
                    const task = {
                        taskInstanceId: taskData.taskInstanceId,
                        executionId: taskData.executionId,
                        scriptType: taskData.scriptType,
                        logUnsubscribers: [], // 将在需要时重新创建
                        logCleanup: null,
                        timer: null,
                        startTime: taskData.startTime,
                        status: taskData.status,
                        // 恢复日志历史
                        logHistory: taskData.logHistory || []
                    };
                    this.backgroundTasks.set(taskData.taskId, task);
                });
                console.log('[后台任务] 从localStorage恢复:', tasksArray.length, '个任务');
            } else {
                // 没有存储的任务，但仍需要设置会话标志
                const sessionKey = 'fa_app_session_active';
                if (!sessionStorage.getItem(sessionKey)) {
                    sessionStorage.setItem(sessionKey, 'true');
                    console.log('[后台任务] 新会话开始，无后台任务需要清理');
                }
            }
        } catch (error) {
            console.error('[后台任务] 从localStorage恢复失败:', error);
            // 如果解析失败，清理localStorage
            localStorage.removeItem(BACKGROUND_TASKS_STORAGE_KEY);
            
            // 设置会话标志
            const sessionKey = 'fa_app_session_active';
            if (!sessionStorage.getItem(sessionKey)) {
                sessionStorage.setItem(sessionKey, 'true');
            }
        }
    }

    /**
     * 将当前任务移至后台运行
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} pageState - 页面状态对象
     */
    moveTaskToBackground(taskInstanceId, pageState) {
        // 确保pageState存在
        if (!pageState) {
            console.error('[后台任务] pageState 未定义，无法移至后台');
            return;
        }
        
        const currentExecutionId = window.__currentExecutionId;
        const hasExecutionTimer = !!window.__executionTimer;
        
        console.log('[后台任务] 尝试移至后台:', { 
            taskInstanceId, 
            currentExecutionId, 
            hasExecutionTimer,
            startTime: window.__startTime,
            pageState: pageState ? 'defined' : 'undefined'
        });
        
        // 如果没有执行ID但有计时器和任务ID，说明任务可能在运行
        if (!currentExecutionId && !hasExecutionTimer) {
            console.warn('[后台任务] 没有执行ID且没有计时器，任务可能已完成');
            return;
        }
        
        // 如果没有执行ID但有计时器，生成一个临时执行ID
        let executionId = currentExecutionId;
        if (!executionId && hasExecutionTimer) {
            executionId = 'restored_exec_' + Date.now();
            window.__currentExecutionId = executionId;
            console.log('[后台任务] 生成临时执行ID:', executionId);
        }
        
        // 收集当前日志历史 - 优化版本
        const logContainer = document.getElementById('taskLogContainer');
        let logHistory = [];
        if (logContainer) {
            const logEntries = logContainer.querySelectorAll('.log-entry');
            logEntries.forEach((entry, index) => {
                try {
                    const timeElement = entry.querySelector('.log-time');
                    const messageElement = entry.querySelector('.log-message');
                    
                    if (timeElement && messageElement) {
                        // 从class中提取日志类型
                        const classList = Array.from(entry.classList);
                        const logTypeClass = classList.find(cls => cls.startsWith('log-type-'));
                        const logType = logTypeClass ? logTypeClass.replace('log-type-', '') : 'info';
                        
                        // 保存完整的日志条目信息
                        const logData = {
                            type: logType,
                            time: timeElement.textContent,
                            message: messageElement.textContent,
                            html: entry.outerHTML,
                            timestamp: Date.now(),
                            index: index,
                            // 提取日志内容用于搜索和过滤
                            content: entry.textContent || ''
                        };
                        logHistory.push(logData);
                    }
                } catch (error) {
                    console.warn('[后台任务] 保存日志条目失败:', error);
                }
            });
            console.log('[后台任务] 保存了', logHistory.length, '条日志记录');
        }
        
        // 保存当前任务的运行状态 - 增强版本
        const backgroundTask = {
            taskInstanceId,
            executionId: executionId,
            scriptType: pageState.currentBatchScriptType,
            logUnsubscribers: window.__currentLogUnsubscribers,
            logCleanup: window.__currentLogCleanup,
            timer: window.__executionTimer,
            startTime: window.__startTime || Date.now(),
            status: 'running',
            // 保存模拟任务函数引用（如果存在）
            mockTaskFunction: window[`__mockTask_${taskInstanceId}`] || null,
            // 保存日志历史 - 增强版本
            logHistory: logHistory,
            // 添加任务元数据
            metadata: {
                backgroundTime: Date.now(), // 移至后台的时间
                logCount: logHistory.length,
                scriptName: pageState.currentBatchScriptType?.name || '未知脚本',
                version: '2.0', // 标记为新版本的后台任务数据
                // 保存当前UI状态
                uiState: {
                    currentView: pageState.currentView,
                    taskConfig: window.batchTaskConfigs?.[taskInstanceId] || null
                }
            }
        };
        
        console.log('[后台任务] 保存的任务数据:', {
            ...backgroundTask,
            logHistory: `${backgroundTask.logHistory.length} 条日志`,
            logUnsubscribers: `${backgroundTask.logUnsubscribers?.length || 0} 个监听器`,
            metadata: backgroundTask.metadata
        });
        
        // 保存到后台任务列表
        this.backgroundTasks.set(taskInstanceId, backgroundTask);
        console.log('[后台任务] 保存成功，当前后台任务数量:', this.backgroundTasks.size);
        
        // 持久化到localStorage
        this.saveBackgroundTasksToStorage();
        
        // 更新后台任务指示器
        this.updateBackgroundTaskIndicator();
        
        // 清理前台引用，但后台任务仍持有这些资源的引用
        // 这样可以避免新任务覆盖正在运行的任务资源
        window.__currentExecutionId = null;
        window.__currentLogUnsubscribers = null;
        window.__currentLogCleanup = null;
        window.__executionTimer = null;
        window.__currentTaskInstanceId = null;
        // 不清理模拟任务函数，让它继续运行
        // window[`__mockTask_${taskInstanceId}`] = null;
        
        console.log(`[后台任务] 任务 ${taskInstanceId} 已移至后台运行`);
        
        // 显示通知
        if (window.showNotification) {
            window.showNotification('任务已移至后台运行', 'success');
        }
    }

    /**
     * 从后台恢复任务
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} pageState - 页面状态对象
     */
    restoreTaskFromBackground(taskInstanceId, pageState) {
        const backgroundTask = this.backgroundTasks.get(taskInstanceId);
        if (!backgroundTask) return false;
        
        // 恢复全局状态
        window.__currentExecutionId = backgroundTask.executionId;
        window.__currentLogUnsubscribers = backgroundTask.logUnsubscribers;
        window.__currentLogCleanup = backgroundTask.logCleanup;
        window.__executionTimer = backgroundTask.timer;
        window.__startTime = backgroundTask.startTime;
        
        // 恢复模拟任务函数引用（如果存在）
        if (backgroundTask.mockTaskFunction) {
            window[`__mockTask_${taskInstanceId}`] = backgroundTask.mockTaskFunction;
        }
        
        // 设置当前脚本类型
        pageState.currentBatchScriptType = backgroundTask.scriptType;
        
        // 保存日志历史到全局变量，供后续使用
        window.__restoredLogHistory = backgroundTask.logHistory || [];
        
        // 从后台任务列表中移除
        this.backgroundTasks.delete(taskInstanceId);
        
        // 更新localStorage
        this.saveBackgroundTasksToStorage();
        
        this.updateBackgroundTaskIndicator();
        
        console.log(`[后台任务] 任务 ${taskInstanceId} 已从后台恢复`);
        return true;
    }

    /**
     * 停止后台任务
     * @param {string} taskInstanceId - 任务实例ID
     */
    async stopBackgroundTask(taskInstanceId) {
        const backgroundTask = this.backgroundTasks.get(taskInstanceId);
        if (!backgroundTask) return false;
        
        try {
            // 停止脚本执行
            if (backgroundTask.executionId) {
                console.log('[后台任务] 尝试停止脚本，执行ID:', backgroundTask.executionId);
                
                if (window.scriptAPI && window.scriptAPI.stopScript && !backgroundTask.executionId.startsWith('mock_exec_')) {
                    // 真实脚本执行
                    console.log('[后台任务] 调用scriptAPI停止脚本');
                    const stopResult = await window.scriptAPI.stopScript(backgroundTask.executionId);
                    console.log('[后台任务] 停止结果:', stopResult);
                } else if (backgroundTask.executionId.startsWith('mock_exec_')) {
                    // 模拟执行 - 清理模拟任务函数
                    console.log('[后台任务] 停止模拟执行:', backgroundTask.executionId);
                    if (window[`__mockTask_${taskInstanceId}`]) {
                        delete window[`__mockTask_${taskInstanceId}`];
                    }
                } else {
                    console.warn('[后台任务] 无法停止脚本: scriptAPI不可用或执行ID无效');
                }
            } else {
                console.warn('[后台任务] 没有执行ID，无法停止脚本');
            }
            
            // 清理资源
            if (backgroundTask.timer) {
                clearInterval(backgroundTask.timer);
            }
            
            if (backgroundTask.logUnsubscribers) {
                backgroundTask.logUnsubscribers.forEach(unsubscribe => {
                    if (typeof unsubscribe === 'function') {
                        unsubscribe();
                    }
                });
            }
            
            if (backgroundTask.logCleanup && typeof backgroundTask.logCleanup === 'function') {
                backgroundTask.logCleanup();
            }
            
            // 从后台任务列表中移除
            this.backgroundTasks.delete(taskInstanceId);
            
            // 更新localStorage
            this.saveBackgroundTasksToStorage();
            
            this.updateBackgroundTaskIndicator();
            
            console.log(`[后台任务] 任务 ${taskInstanceId} 已停止`);
            return true;
        } catch (error) {
            console.error(`[后台任务] 停止任务 ${taskInstanceId} 失败:`, error);
            return false;
        }
    }

    /**
     * 获取所有后台任务
     * @returns {Array} 后台任务列表
     */
    getBackgroundTasks() {
        return Array.from(this.backgroundTasks.entries()).map(([taskId, task]) => ({
            taskId,
            scriptName: task.scriptType?.name || '未知脚本',
            status: task.status,
            startTime: task.startTime
        }));
    }

    /**
     * 更新后台任务指示器
     */
    updateBackgroundTaskIndicator() {
        console.log('[后台任务] 更新指示器，当前后台任务数量:', this.backgroundTasks.size);
        console.log('[后台任务] 后台任务列表:', Array.from(this.backgroundTasks.keys()));
        
        const backgroundTasksBtn = document.getElementById('background-tasks-btn');
        const backgroundTaskCount = document.getElementById('background-task-count');
        
        console.log('[后台任务] 按钮元素:', backgroundTasksBtn);
        console.log('[后台任务] 计数元素:', backgroundTaskCount);
        
        if (!backgroundTasksBtn || !backgroundTaskCount) {
            console.warn('[后台任务] 找不到后台任务按钮或计数元素');
            return;
        }
        
        const taskCount = this.backgroundTasks.size;
        
        // 调试模式：强制显示按钮和面板，方便测试
        if (DEBUG_BACKGROUND_TASKS) {
            console.log('[后台任务] DEBUG模式：强制显示后台任务按钮');
            backgroundTasksBtn.style.display = 'inline-flex';
            backgroundTaskCount.textContent = taskCount;
            
            if (taskCount > 0) {
                backgroundTasksBtn.classList.add('has-background-tasks');
                console.log(`[后台任务] 有 ${taskCount} 个后台任务，显示绿色指示器`);
            } else {
                backgroundTasksBtn.classList.remove('has-background-tasks');
                console.log('[后台任务] 无后台任务，显示普通按钮');
            }
            return;
        }
        
        if (taskCount > 0) {
            backgroundTasksBtn.style.display = 'inline-flex';
            backgroundTaskCount.textContent = taskCount;
            backgroundTasksBtn.classList.add('has-background-tasks');
            console.log(`[后台任务] 显示按钮，任务数量: ${taskCount}`);
        } else {
            backgroundTasksBtn.style.display = 'none';
            backgroundTasksBtn.classList.remove('has-background-tasks');
            console.log('[后台任务] 隐藏按钮，没有后台任务');
        }
    }

    /**
     * 切换后台任务面板显示
     * @param {boolean} show - 是否显示，不传则切换
     */
    toggleBackgroundTasksPanel(show) {
        const panel = document.getElementById('backgroundTasksPanel');
        if (!panel) return;
        
        const isVisible = panel.style.display !== 'none';
        const shouldShow = show !== undefined ? show : !isVisible;
        
        if (shouldShow) {
            panel.style.display = 'block';
            this.renderBackgroundTasksList();
        } else {
            panel.style.display = 'none';
        }
    }

    /**
     * 渲染后台任务列表
     */
    renderBackgroundTasksList() {
        const container = document.getElementById('backgroundTasksList');
        if (!container) return;
        
        const backgroundTasksList = this.getBackgroundTasks();
        
        if (backgroundTasksList.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <p>当前没有后台运行的任务</p>
                </div>
            `;
            return;
        }
        
        const tasksHtml = backgroundTasksList.map(task => {
            const duration = this.formatDuration(Date.now() - task.startTime);
            return `
                <div class="background-task-item" data-task-id="${task.taskId}">
                    <div class="task-info">
                        <div class="task-name">
                            <i class="fas fa-play-circle text-success"></i>
                            ${task.scriptName}
                        </div>
                        <div class="task-details">
                            <span class="task-status running">运行中</span>
                            <span class="task-duration">运行时长: ${duration}</span>
                        </div>
                    </div>
                    <div class="task-actions">
                        <button class="action-btn resume-btn" onclick="resumeBackgroundTask('${task.taskId}')" title="查看任务">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="action-btn stop-btn" onclick="stopBackgroundTaskFromPanel('${task.taskId}')" title="停止任务">
                            <i class="fas fa-stop"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = tasksHtml;
    }

    /**
     * 格式化持续时间
     * @param {number} ms - 毫秒数
     * @returns {string} 格式化的时间字符串
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}小时${minutes % 60}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟${seconds % 60}秒`;
        } else {
            return `${seconds}秒`;
        }
    }

    /**
     * 从面板恢复后台任务
     * @param {string} taskInstanceId - 任务实例ID
     */
    async resumeBackgroundTask(taskInstanceId) {
        // 获取后台任务数据
        const backgroundTask = this.backgroundTasks.get(taskInstanceId);
        if (!backgroundTask) {
            console.error(`[任务恢复] 未找到后台任务: ${taskInstanceId}`);
            return;
        }

        // 隐藏后台任务面板
        this.toggleBackgroundTasksPanel(false);

        // 设置当前脚本类型（确保页面状态正确）
        if (window.pageState) {
            window.pageState.currentBatchScriptType = backgroundTask.scriptType;
        }

        // 使用新的任务恢复管理器
        try {
            const { taskRestoreManager } = await import('../taskRestoreManager.js');
            
            // 执行任务恢复
            const success = await taskRestoreManager.restoreTask(taskInstanceId, backgroundTask);
            
            if (success) {
                console.log(`[任务恢复] 任务 ${taskInstanceId} 恢复成功，任务继续在前台运行`);
                
                // 确保执行ID正确设置（从后台任务数据中恢复）
                if (backgroundTask.executionId && !window.__currentExecutionId) {
                    window.__currentExecutionId = backgroundTask.executionId;
                    console.log(`[任务恢复] 恢复执行ID: ${backgroundTask.executionId}`);
                }
                
                // 从后台任务列表中移除（因为现在在前台运行）
                this.backgroundTasks.delete(taskInstanceId);
                this.saveBackgroundTasksToStorage();
                this.updateBackgroundTaskIndicator();
                
                // 确保UI正确显示执行状态
                setTimeout(() => {
                    // 更新状态显示
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
                    
                    // 显示停止按钮
                    const stopBtn = document.getElementById('stop-btn');
                    if (stopBtn) {
                        stopBtn.style.display = 'inline-flex';
                    }
                    
                    // 确保日志容器可见并滚动到底部
                    const logContainer = document.getElementById('taskLogContainer');
                    if (logContainer) {
                        logContainer.scrollTop = logContainer.scrollHeight;
                    }
                }, 500);
                
            } else {
                console.error(`[任务恢复] 任务 ${taskInstanceId} 恢复失败`);
            }
        } catch (error) {
            console.error(`[任务恢复] 恢复任务时发生错误:`, error);
        }
    }

    /**
     * 从面板停止后台任务
     * @param {string} taskInstanceId - 任务实例ID
     */
    async stopBackgroundTaskFromPanel(taskInstanceId) {
        if (confirm('确定要停止这个后台任务吗？')) {
            const success = await this.stopBackgroundTask(taskInstanceId);
            if (success) {
                // 重新渲染后台任务列表
                this.renderBackgroundTasksList();
                this.updateBackgroundTaskIndicator();
            }
        }
    }

    /**
     * 初始化全局后台任务管理器
     * 将管理器功能绑定到全局对象，确保向后兼容
     */
    initGlobalBackgroundTaskManager() {
        // 确保全局任务集合可用
        if (!window.__FABackgroundTasks) {
            window.__FABackgroundTasks = this.backgroundTasks;
        }
        
        // 将后台任务管理器绑定到全局
        if (!window.FABackgroundTaskManager) {
            window.FABackgroundTaskManager = {
                tasks: this.backgroundTasks,
                saveToStorage: this.saveBackgroundTasksToStorage.bind(this),
                loadFromStorage: this.loadBackgroundTasksFromStorage.bind(this),
                updateIndicator: this.updateBackgroundTaskIndicator.bind(this),
                moveToBackground: this.moveTaskToBackground.bind(this),
                restore: this.restoreTaskFromBackground.bind(this),
                stop: this.stopBackgroundTask.bind(this),
                getAll: this.getBackgroundTasks.bind(this),
                // 调试和测试函数将通过DebugTools模块提供
                debug: null, // 将在DebugTools模块中设置
                createTest: null, // 将在DebugTools模块中设置
                clearTests: null, // 将在DebugTools模块中设置
                forceUpdate: this.updateBackgroundTaskIndicator.bind(this),
                clearZombies: null // 将在DebugTools模块中设置
            };
            
            console.log('[全局后台任务] 管理器已初始化，恢复任务数量:', this.backgroundTasks.size);
        }
    }
}

/**
 * 设置全局后台任务管理器函数
 * 为了向后兼容，将一些函数直接绑定到全局作用域
 */
export function setupGlobalBackgroundTaskManager() {
    const manager = new BackgroundTaskManager();
    
    // 初始化全局管理器
    manager.initGlobalBackgroundTaskManager();
    
    // 将关键函数绑定到全局作用域
    window.moveTaskToBackground = (taskInstanceId) => {
        // 确保pageState存在，提供默认值
        const pageState = window.pageState || {
            currentBatchScriptType: null,
            currentView: 'cards'
        };
        manager.moveTaskToBackground(taskInstanceId, pageState);
    };
    
    window.restoreTaskFromBackground = (taskInstanceId) => {
        // 确保pageState存在，提供默认值
        const pageState = window.pageState || {
            currentBatchScriptType: null,
            currentView: 'cards'
        };
        return manager.restoreTaskFromBackground(taskInstanceId, pageState);
    };
    
    window.stopBackgroundTask = (taskInstanceId) => {
        return manager.stopBackgroundTask(taskInstanceId);
    };
    
    window.getBackgroundTasks = () => {
        return manager.getBackgroundTasks();
    };
    
    window.updateBackgroundTaskIndicator = () => {
        manager.updateBackgroundTaskIndicator();
    };
    
    window.toggleBackgroundTasksPanel = (show) => {
        manager.toggleBackgroundTasksPanel(show);
    };
    
    window.renderBackgroundTasksList = () => {
        manager.renderBackgroundTasksList();
    };
    
    window.resumeBackgroundTask = (taskInstanceId) => {
        return manager.resumeBackgroundTask(taskInstanceId);
    };
    
    window.stopBackgroundTaskFromPanel = (taskInstanceId) => {
        return manager.stopBackgroundTaskFromPanel(taskInstanceId);
    };
    
    window.formatDuration = (ms) => {
        return manager.formatDuration(ms);
    };
    
    // 返回管理器实例，供其他模块使用
    return manager;
}

// 默认导出
export default BackgroundTaskManager; 