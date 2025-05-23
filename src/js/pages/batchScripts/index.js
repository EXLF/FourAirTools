/**
 * 批量脚本管理页面 - 主模块（重构版）
 * 负责初始化页面、加载批量任务列表和基本交互
 */

import { showModal } from '../../components/modal.js';
import { translateLocation } from '../../utils/locationTranslator.js';
import { BatchTaskManager } from './batchTaskManager.js';
import { TaskLogger } from './logger.js';

// 导入重构后的模块
import { 
    batchScriptTypes, 
    modules, 
    moduleOrder, 
    batchTaskConfigs,
    VIEW_MODES 
} from './config/constants.js';
import { formatAddress, formatProxy } from './utils/formatters.js';
import { createBatchScriptCard, renderScriptCards } from './components/ScriptCard.js';
import { createFilterPanelHTML, setupFilteringFunction, populateFilters } from './components/FilterPanel.js';
import { WalletGroupManager } from './modules/WalletGroupManager.js';
import { ProxyManager } from './modules/ProxyManager.js';
import { detectIPC, getWallets, getProxies } from './utils/ipcHelper.js';

// 页面状态管理
const pageState = {
    contentAreaRef: null,
    currentView: VIEW_MODES.CARDS,
    currentBatchScriptType: null,
    walletGroupManager: new WalletGroupManager(),
    proxyManager: new ProxyManager()
};

/**
 * 初始化批量脚本管理页面
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export function initBatchScriptsPage(contentArea) {
    console.log("初始化批量脚本管理页面...");
    pageState.contentAreaRef = contentArea;
    renderBatchScriptCardsView(contentArea);
}

/**
 * 渲染批量脚本卡片视图
 * @param {HTMLElement} contentArea - 内容区域元素
 */
function renderBatchScriptCardsView(contentArea) {
    pageState.currentView = VIEW_MODES.CARDS;
    
    const cardViewHtml = `
    <div class="page-header">
        <h1>批量脚本</h1>
        <p>高效管理多账户脚本执行，批量处理多任务</p>
        <div class="header-actions">
            <button id="refresh-batch-scripts-btn" class="btn btn-secondary">
                <i class="fas fa-sync-alt"></i> 刷新列表
            </button>
        </div>
    </div>
    ${createFilterPanelHTML()}
    <div class="script-cards-grid" id="batchScriptCardsContainer"></div>`;
    
    contentArea.innerHTML = cardViewHtml;
    
    // 绑定刷新按钮事件
    const refreshBtn = contentArea.querySelector('#refresh-batch-scripts-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAndRenderBatchScriptCards(contentArea);
        });
    }
    
    loadAndRenderBatchScriptCards(contentArea);
    setupFilteringFunction(contentArea);
}

/**
 * 加载并渲染批量脚本卡片
 * @param {HTMLElement} pageContentArea - 卡片页面的内容区域
 */
async function loadAndRenderBatchScriptCards(pageContentArea) {
    const cardsContainer = pageContentArea.querySelector('#batchScriptCardsContainer');
    const typeFilterElement = pageContentArea.querySelector('#batchScriptTypeFilter');
    const statusFilterElement = pageContentArea.querySelector('#batchScriptStatusFilter');
    
    if (!cardsContainer) {
        console.error('卡片容器 #batchScriptCardsContainer 未找到');
        return;
    }
    
    cardsContainer.innerHTML = '';
    
    // 加载脚本列表
    let scriptsList = [];
    if (window.scriptAPI && typeof window.scriptAPI.getAllScripts === 'function') {
        try {
            const result = await window.scriptAPI.getAllScripts();
            if (result.success && Array.isArray(result.data)) {
                scriptsList = result.data.map(s => ({
                    ...s,
                    status: s.status || 'active',
                    category: s.category || ''
                }));
            } else {
                console.error('获取脚本列表失败:', result.error);
            }
        } catch (error) {
            console.error('调用 getAllScripts 时出错:', error);
        }
    } else {
        console.warn('scriptAPI 未定义，使用静态脚本类型列表');
        scriptsList = batchScriptTypes;
    }

    // 渲染脚本卡片
    renderScriptCards(cardsContainer, scriptsList, (scriptData) => {
        pageState.currentBatchScriptType = scriptData;
        const taskInstanceId = `task_${scriptData.id}_${Date.now()}`;
        navigateToModularTaskManager(taskInstanceId);
    });
    
    // 更新筛选器选项
    populateFilters(typeFilterElement, statusFilterElement, scriptsList);
}

/**
 * 导航到模块化任务管理器视图
 */
function navigateToModularTaskManager(taskInstanceId) {
    console.log("导航到模块化任务管理器...");
    pageState.currentView = VIEW_MODES.MANAGER;
    
    // 清理可能存在的旧资源
    cleanupResources();
    
    if (!pageState.contentAreaRef || !pageState.currentBatchScriptType) {
        console.error("contentAreaRef或currentBatchScriptType未定义");
        return;
    }

    const templateHtml = `
    <div class="batch-task-container">
        <div class="task-header">
            <div class="header-nav">
                <button id="back-to-cards-btn" class="back-btn" title="返回">
                    <i class="fas fa-arrow-left"></i>
                </button>
                <h3>${pageState.currentBatchScriptType.name}</h3>
            </div>
            <div class="header-status">
                <span class="status-text" id="statusText">配置中</span>
                <span class="timer" id="timer" style="display: none;">00:00</span>
            </div>
        </div>
        
        <div class="task-body">
            <!-- 配置区域 -->
            <div class="config-section" id="configSection">
                <div class="config-content" id="moduleContentDisplay">
                    <!-- 配置内容将在此处动态加载 -->
                </div>
                <div class="action-bar">
                    <button id="start-execution-btn" class="btn btn-primary">
                        <i class="fas fa-play"></i> 开始执行
                    </button>
                </div>
            </div>
            
            <!-- 执行日志区域 -->
            <div class="log-section" id="logSection" style="display: none;">
                <div class="log-toolbar">
                    <div class="log-info">
                        <span class="log-title">执行日志</span>
                        <span class="log-stats">
                            <span id="totalCount">0</span> 个任务 | 
                            成功 <span id="successCount">0</span> | 
                            失败 <span id="failCount">0</span>
                        </span>
                    </div>
                    <div class="log-actions">
                        <button class="tool-btn" id="autoScrollBtn" title="自动滚动">
                            <i class="fas fa-angle-double-down"></i>
                        </button>
                        <button class="tool-btn" id="downloadBtn" title="下载日志">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="tool-btn" id="clearBtn" title="清空日志">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="log-container" id="taskLogContainer">
                    <!-- 日志内容 -->
                </div>
                <div class="log-footer">
                    <button id="back-to-config-btn" class="btn btn-secondary">
                        <i class="fas fa-chevron-left"></i> 返回配置
                    </button>
                    <button id="stop-btn" class="btn btn-danger" style="display: none;">
                        <i class="fas fa-stop"></i> 停止执行
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;

    pageState.contentAreaRef.innerHTML = templateHtml;
    
    // 初始化任务配置
    if (!batchTaskConfigs[taskInstanceId]) {
        batchTaskConfigs[taskInstanceId] = {
            scriptTypeId: pageState.currentBatchScriptType.id,
            scriptName: pageState.currentBatchScriptType.name,
            accounts: [],
            proxyConfig: {
                enabled: false,
                strategy: 'one-to-one',
                proxies: []
            }
        };
    }
    
    bindModularManagerEvents(taskInstanceId);
    loadModuleContent('simple-config', taskInstanceId);
    
    // 添加必要的样式
    addCompactTaskStyles();
}

/**
 * 为模块化管理器绑定事件
 * @param {string} taskInstanceId - 当前配置的任务实例的唯一ID
 */
function bindModularManagerEvents(taskInstanceId) {
    const managerPage = pageState.contentAreaRef.querySelector('.batch-task-container');
    if (!managerPage) {
        console.error("Batch task container not found");
        return;
    }

    // 返回按钮
    const backToCardsButton = managerPage.querySelector('#back-to-cards-btn');
    if (backToCardsButton) {
        backToCardsButton.addEventListener('click', (event) => {
            event.preventDefault();
            saveCurrentModuleData(taskInstanceId);
            cleanupResources();
            renderBatchScriptCardsView(pageState.contentAreaRef);
        });
    }

    // 开始执行按钮
    const startTaskButton = managerPage.querySelector('#start-execution-btn');
    if (startTaskButton) {
        // 监听钱包选择变化，更新按钮状态
        const updateStartButtonState = () => {
            const selectedWallets = document.querySelectorAll('input[name="selected-wallets"]:checked');
            const walletCount = selectedWallets.length;
            
            if (walletCount > 0) {
                startTaskButton.disabled = false;
            } else {
                startTaskButton.disabled = true;
            }
        };
        
        // 初始检查
        setTimeout(updateStartButtonState, 100);
        
        // 监听钱包选择变化
        document.addEventListener('change', (e) => {
            if (e.target.name === 'selected-wallets') {
                updateStartButtonState();
            }
        });
        
        startTaskButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await handleStartExecution(taskInstanceId, startTaskButton);
        });
    }

    // 返回配置按钮
    const backToConfigBtn = managerPage.querySelector('#back-to-config-btn');
    if (backToConfigBtn) {
        backToConfigBtn.addEventListener('click', (event) => {
            event.preventDefault();
            switchToConfigStage();
        });
    }

    // 停止执行按钮
    const stopTaskButton = managerPage.querySelector('#stop-btn');
    if (stopTaskButton) {
        stopTaskButton.addEventListener('click', async (event) => {
            event.preventDefault();
            
            // 确认停止
            if (!confirm('确定要停止当前正在执行的任务吗？')) {
                return;
            }
            
            try {
                // 禁用按钮防止重复点击
                stopTaskButton.disabled = true;
                stopTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 停止中...';
                
                // 停止执行计时器
                if (window.__executionTimer) {
                    clearInterval(window.__executionTimer);
                    window.__executionTimer = null;
                }
                
                // 获取当前执行的任务ID
                const currentExecutionId = window.__currentExecutionId;
                if (currentExecutionId && window.scriptAPI && window.scriptAPI.stopScript) {
                    TaskLogger.logWarning('正在停止脚本执行...');
                    
                    const result = await window.scriptAPI.stopScript(currentExecutionId);
                    if (result.success) {
                        TaskLogger.logWarning('✋ 脚本执行已被用户停止');
                        
                        // 更新状态
                        const statusText = document.getElementById('statusText');
                        if (statusText) {
                            statusText.textContent = '已停止';
                            statusText.style.color = '#e74c3c';
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
                        
                        // 隐藏停止按钮
                        stopTaskButton.style.display = 'none';
                        
                        // 重置开始按钮
                        const startButton = managerPage.querySelector('.start-task-button');
                        if (startButton) {
                            startButton.disabled = false;
                            startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                        }
                    } else {
                        TaskLogger.logError(`停止脚本失败: ${result.error || '未知错误'}`);
                        // 恢复按钮状态
                        stopTaskButton.disabled = false;
                        stopTaskButton.innerHTML = '<i class="fas fa-stop"></i> 停止执行';
                    }
                } else {
                    TaskLogger.logError('无法停止脚本：执行ID不存在或停止接口不可用');
                    // 恢复按钮状态
                    stopTaskButton.disabled = false;
                    stopTaskButton.innerHTML = '<i class="fas fa-stop"></i> 停止执行';
                }
            } catch (error) {
                console.error('停止脚本执行失败:', error);
                TaskLogger.logError(`停止脚本失败: ${error.message}`);
                
                // 恢复按钮状态
                stopTaskButton.disabled = false;
                stopTaskButton.innerHTML = '<i class="fas fa-stop"></i> 停止执行';
            }
        });
    }
}

/**
 * 处理开始执行任务
 * @param {string} taskInstanceId - 任务实例ID
 * @param {HTMLElement} startTaskButton - 开始按钮元素
 */
async function handleStartExecution(taskInstanceId, startTaskButton) {
    // 防止重复点击
    if (startTaskButton.disabled) {
        console.log('任务正在执行中，请勿重复点击');
        return;
    }
    
    // 立即禁用按钮
    startTaskButton.disabled = true;
    startTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 准备中...';
    
    saveCurrentModuleData(taskInstanceId);
    
    const taskConfig = batchTaskConfigs[taskInstanceId];
    
    // 验证配置
    if (taskConfig.accounts.length === 0) {
        alert('请至少选择一个钱包账户');
        startTaskButton.disabled = false;
        startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        return;
    }
    
    if (taskConfig.proxyConfig.enabled) {
        if (taskConfig.proxyConfig.proxies.length === 0) {
            alert('已启用代理，但代理列表为空。请添加代理或禁用代理功能。');
            startTaskButton.disabled = false;
            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
            return;
        }
        
        if (taskConfig.proxyConfig.strategy === 'one-to-one' && 
            taskConfig.proxyConfig.proxies.length < taskConfig.accounts.length) {
            alert(`一对一代理策略需要至少与钱包数量相同的代理IP。\n当前钱包数量: ${taskConfig.accounts.length}\n当前代理数量: ${taskConfig.proxyConfig.proxies.length}`);
            startTaskButton.disabled = false;
            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
            return;
        }
    }
    
    // 切换到执行阶段界面
    switchToExecutionStage(taskConfig);
    
    // 清理旧的监听器和日志
    cleanupResources();
    
    // 初始化日志
    const logContainer = document.getElementById('taskLogContainer');
    if (logContainer) {
        TaskLogger.clearLogContainer(logContainer);
        const cleanupLogRender = TaskLogger.renderLogsToContainer(logContainer, true);
        window.__currentLogCleanup = cleanupLogRender;
        
        TaskLogger.logInfo('🚀 批量脚本执行系统已初始化');
        TaskLogger.logInfo(`📋 任务名称: ${pageState.currentBatchScriptType.name}`);
        TaskLogger.logInfo(`👥 选择的钱包数量: ${taskConfig.accounts.length}`);
        
        if (taskConfig.proxyConfig.enabled) {
            TaskLogger.logInfo(`🌐 代理配置: ${taskConfig.proxyConfig.strategy} 策略，共 ${taskConfig.proxyConfig.proxies.length} 个代理`);
        }
    }
    
    // 创建任务实例
    const batchTaskManager = new BatchTaskManager();
    const taskData = {
        id: taskInstanceId,
        name: `${pageState.currentBatchScriptType.name} 批量任务`,
        scriptId: pageState.currentBatchScriptType.id,
        scriptName: pageState.currentBatchScriptType.name,
        accountIds: taskConfig.accounts,
        proxyConfig: taskConfig.proxyConfig,
        status: 'running',
        startTime: Date.now()
    };
    
    try {
        await batchTaskManager.addTask(taskData);
        TaskLogger.logInfo(`任务 ${taskInstanceId} 已创建并保存到任务管理器`);
    } catch (err) {
        console.warn('添加到批量任务管理器失败:', err);
        TaskLogger.logWarning('无法保存任务状态，但脚本执行不受影响');
    }
    
    // 执行脚本
    if (window.scriptAPI && typeof window.scriptAPI.executeScript === 'function') {
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
        setupScriptLogListeners(taskInstanceId, startTaskButton);
        
        try {
            console.log('[批量脚本] 开始执行脚本...');
            const result = await window.scriptAPI.executeScript(
                pageState.currentBatchScriptType.id,
                taskConfig.accounts,
                scriptConfig,
                actualProxyConfigToPass
            );
            
            // 保存执行ID，用于停止功能
            if (result && result.success && result.data && result.data.executionId) {
                window.__currentExecutionId = result.data.executionId;
                console.log('[批量脚本] 执行ID已保存:', window.__currentExecutionId);
                
                // 显示停止按钮
                const stopBtn = document.getElementById('stop-btn');
                if (stopBtn) {
                    stopBtn.style.display = 'inline-block';
                }
            }
        } catch (err) {
            console.error('[批量脚本] 执行失败:', err);
            TaskLogger.logError(`执行失败: ${err.message || err}`);
            switchToConfigStage();
            startTaskButton.disabled = false;
            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        }
    } else {
        console.warn('脚本执行接口未定义，使用模拟执行');
        TaskLogger.logWarning('脚本执行接口未定义，将模拟执行过程');
        
        // 模拟执行过程
        setTimeout(() => {
            TaskLogger.logInfo('开始模拟执行...');
            let completed = 0;
            const total = taskConfig.accounts.length;
            
            const simulateInterval = setInterval(() => {
                if (completed < total) {
                    completed++;
                    TaskLogger.logSuccess(`账户 ${completed}/${total} 执行成功`);
                    document.getElementById('successCount').textContent = completed;
                } else {
                    clearInterval(simulateInterval);
                    
                    // 手动触发完成处理
                    TaskLogger.logSuccess('✅ 批量脚本执行完成！');
                    TaskLogger.logInfo(`📊 执行总结:`);
                    TaskLogger.logInfo(`   - 总账户数: ${total}`);
                    TaskLogger.logInfo(`   - 成功: ${completed}`);
                    TaskLogger.logInfo(`   - 失败: 0`);
                    TaskLogger.logInfo(`   - 耗时: 模拟执行`);
                    
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
                    
                    // 重置按钮状态
                    startTaskButton.disabled = false;
                    startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                }
            }, 1000);
        }, 1000);
    }
}

/**
 * 切换到执行阶段
 * @param {Object} taskConfig - 任务配置
 */
function switchToExecutionStage(taskConfig) {
    // 隐藏配置区域，显示日志区域
    document.getElementById('configSection').style.display = 'none';
    document.getElementById('logSection').style.display = 'block';
    
    // 更新状态
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = '执行中';
        statusText.style.color = '#f39c12';
    }
    
    // 显示计时器
    document.getElementById('timer').style.display = 'inline';
    
    // 更新统计信息
    document.getElementById('totalCount').textContent = taskConfig.accounts.length;
    document.getElementById('successCount').textContent = '0';
    document.getElementById('failCount').textContent = '0';
    
    // 开始计时
    startExecutionTimer();
}

/**
 * 切换回配置阶段
 */
function switchToConfigStage() {
    // 显示配置区域，隐藏日志区域
    document.getElementById('configSection').style.display = 'block';
    document.getElementById('logSection').style.display = 'none';
    
    // 更新状态
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = '配置中';
        statusText.style.color = '#666';
    }
    
    // 隐藏计时器
    document.getElementById('timer').style.display = 'none';
    
    // 停止计时器
    if (window.__executionTimer) {
        clearInterval(window.__executionTimer);
        window.__executionTimer = null;
    }
}

/**
 * 设置脚本日志监听器
 * @param {string} taskInstanceId - 任务实例ID
 * @param {HTMLElement} startTaskButton - 开始按钮元素
 */
function setupScriptLogListeners(taskInstanceId, startTaskButton) {
    // 先移除可能存在的旧监听器
    if (window.__currentLogUnsubscribers) {
        try {
            window.__currentLogUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            window.__currentLogUnsubscribers = null;
        } catch (e) {
            console.warn('移除旧日志监听器失败:', e);
        }
    }
    
    // 创建新的取消订阅函数数组
    window.__currentLogUnsubscribers = [];
    
    // 日志事件处理
    const logEventHandler = (data) => {
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
        } catch (e) {
            console.error('[批量脚本日志] 处理日志失败:', e);
        }
    };
    
    // 脚本完成事件处理
    const scriptCompletedHandler = (data) => {
        console.log('[批量脚本] 收到脚本完成事件:', data);
        TaskLogger.logSuccess('✅ 批量脚本执行完成！');
        
        if (data && data.summary) {
            TaskLogger.logInfo(`📊 执行总结:`);
            TaskLogger.logInfo(`   - 总账户数: ${data.summary.totalAccounts || 0}`);
            TaskLogger.logInfo(`   - 成功: ${data.summary.successCount || 0}`);
            TaskLogger.logInfo(`   - 失败: ${data.summary.failedCount || 0}`);
            TaskLogger.logInfo(`   - 耗时: ${data.summary.duration || '未知'}`);
            
            // 更新统计信息
            document.getElementById('successCount').textContent = data.summary.successCount || 0;
            document.getElementById('failCount').textContent = data.summary.failedCount || 0;
        }
        
        // 停止计时器
        if (window.__executionTimer) {
            clearInterval(window.__executionTimer);
            window.__executionTimer = null;
        }
        
        // 停止日志观察器
        if (window.__logObserver) {
            window.__logObserver.disconnect();
            window.__logObserver = null;
        }
        
        // 更新状态
        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = '已完成';
            statusText.style.color = '#27ae60';
        }
        
        // 显示停止按钮
        document.getElementById('stop-btn').style.display = 'none';
        
        // 重置开始按钮状态
        startTaskButton.disabled = false;
        startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        
        // 执行完成后自动移除监听器
        if (window.__currentLogUnsubscribers) {
            window.__currentLogUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            window.__currentLogUnsubscribers = null;
        }
    };
    
    // 注册监听器
    if (window.scriptAPI) {
        // 使用 scriptAPI 提供的监听方法
        const logUnsubscribe = window.scriptAPI.onLog(logEventHandler);
        const completedUnsubscribe = window.scriptAPI.onScriptCompleted(scriptCompletedHandler);
        
        // 保存取消订阅函数
        window.__currentLogUnsubscribers.push(logUnsubscribe);
        window.__currentLogUnsubscribers.push(completedUnsubscribe);
    } else if (window.electron && window.electron.ipcRenderer) {
        // 备用方案：直接使用 ipcRenderer
        // 移除所有现有的同类监听器
        window.electron.ipcRenderer.removeAllListeners('script-log');
        window.electron.ipcRenderer.removeAllListeners('script-completed');
        
        // 注册新的监听器
        const logUnsubscribe = window.electron.ipcRenderer.on('script-log', logEventHandler);
        const completedUnsubscribe = window.electron.ipcRenderer.on('script-completed', scriptCompletedHandler);
        
        // 保存取消订阅函数
        window.__currentLogUnsubscribers.push(logUnsubscribe);
        window.__currentLogUnsubscribers.push(completedUnsubscribe);
    }
}

/**
 * 加载模块内容
 * @param {string} moduleId - 模块ID
 * @param {string} taskInstanceId - 任务实例ID
 */
async function loadModuleContent(moduleId, taskInstanceId) {
    const moduleContentDisplay = document.getElementById('moduleContentDisplay');
    if (!moduleContentDisplay) return;
    
    const taskConfig = batchTaskConfigs[taskInstanceId];
    
    try {
        // 获取钱包和代理数据
        const [availableWallets, availableProxies] = await Promise.all([
            getWallets(),
            getProxies()
        ]);
        
        pageState.proxyManager.setAvailableProxies(availableProxies);
        
        // 如果当前没有选择代理但有可用代理，则预填充所有代理
        if (taskConfig.proxyConfig.proxies.length === 0 && availableProxies.length > 0) {
            taskConfig.proxyConfig.proxies = availableProxies.map(proxy => pageState.proxyManager.formatProxy(proxy));
            console.log('预填充代理列表:', taskConfig.proxyConfig.proxies);
        }
        
        // 生成模块内容HTML
        const walletGroups = pageState.walletGroupManager.groupWallets(availableWallets);
        const walletGroupsHtml = pageState.walletGroupManager.generateWalletGroupsHTML(walletGroups, taskInstanceId);
        const proxyConfigHtml = pageState.proxyManager.generateProxyConfigHTML(taskInstanceId, taskConfig.proxyConfig);
        
        moduleContentDisplay.innerHTML = `
            <div class="module-section">
                <h2><i class="fas fa-wallet"></i> 选择钱包账户</h2>
                <div class="wallet-selection-section">
                    <div class="section-header">
                        <span id="selected-wallet-count-${taskInstanceId}">已选择 0 个钱包</span>
                        <div class="wallet-actions">
                            <button class="btn btn-sm" id="select-all-wallets-${taskInstanceId}">全选</button>
                            <button class="btn btn-sm" id="deselect-all-wallets-${taskInstanceId}">取消全选</button>
                        </div>
                    </div>
                    <div class="wallet-search-box">
                        <input type="text" id="wallet-search-${taskInstanceId}" placeholder="搜索钱包...">
                        <i class="fas fa-search"></i>
                    </div>
                    <div id="wallet-list-${taskInstanceId}" class="wallet-list">
                        ${walletGroupsHtml}
                    </div>
                </div>
                
                ${proxyConfigHtml}
            </div>
        `;
        
        // 初始化钱包分组折叠功能
        pageState.walletGroupManager.initWalletGroupCollapse();
        
        // 绑定事件
        bindModuleSpecificInputEvents(moduleId, taskInstanceId, availableProxies);
        
        // 修复：确保在DOM更新后再次初始化折叠功能
        setTimeout(() => {
            pageState.walletGroupManager.initWalletGroupCollapse();
        }, 100);
        
        // 如果IPC不可用，显示警告
        if (!detectIPC()) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'warning-banner';
            warningDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 注意：当前使用的是模拟数据，因为IPC通信未配置。真实数据不可用。';
            moduleContentDisplay.insertBefore(warningDiv, moduleContentDisplay.firstChild);
        }
        
    } catch (error) {
        console.error('加载模块内容失败:', error);
        moduleContentDisplay.innerHTML = '<div class="error-message">加载配置失败，请刷新页面重试</div>';
    }
}

/**
 * 绑定模块特定的输入事件
 * @param {string} moduleId - 模块ID
 * @param {string} taskInstanceId - 任务实例ID
 * @param {Array} availableProxies - 可用代理列表
 */
function bindModuleSpecificInputEvents(moduleId, taskInstanceId, availableProxies) {
    const taskConfig = batchTaskConfigs[taskInstanceId];
    const walletsListDiv = document.getElementById(`wallet-list-${taskInstanceId}`);
    
    // 钱包选择相关事件
    if (walletsListDiv) {
        // 更新选中计数的函数
        const updateSelectedCount = () => {
            const selectedWallets = walletsListDiv.querySelectorAll('input[name="selected-wallets"]:checked');
            const countElement = document.getElementById(`selected-wallet-count-${taskInstanceId}`);
            if (countElement) {
                countElement.textContent = `已选择 ${selectedWallets.length} 个钱包`;
            }
            
            // 更新任务配置
            taskConfig.accounts = Array.from(selectedWallets).map(cb => cb.value);
            
            // 更新代理策略详情
            pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
        };
        
        // 钱包复选框变化事件
        walletsListDiv.addEventListener('change', (e) => {
            if (e.target.name === 'selected-wallets') {
                updateSelectedCount();
                
                // 更新分组复选框状态
                const group = e.target.dataset.group;
                if (group) {
                    pageState.walletGroupManager.updateGroupCheckboxState(group, walletsListDiv);
                }
            }
            
            // 分组复选框
            if (e.target.classList.contains('group-checkbox')) {
                const group = e.target.dataset.group;
                pageState.walletGroupManager.handleGroupCheckboxChange(group, e.target.checked, walletsListDiv);
                updateSelectedCount(); // 更新总计数
            }
        });
        
        // 全选/取消全选按钮
        const selectAllBtn = document.getElementById(`select-all-wallets-${taskInstanceId}`);
        const deselectAllBtn = document.getElementById(`deselect-all-wallets-${taskInstanceId}`);
        
        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                walletsListDiv.querySelectorAll('input[name="selected-wallets"]').forEach(cb => {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
        }
        
        if (deselectAllBtn) {
            deselectAllBtn.addEventListener('click', () => {
                walletsListDiv.querySelectorAll('input[name="selected-wallets"]').forEach(cb => {
                    cb.checked = false;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                });
            });
        }
        
        // 钱包搜索功能
        const walletSearchInput = document.getElementById(`wallet-search-${taskInstanceId}`);
        if (walletSearchInput) {
            walletSearchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const walletItems = walletsListDiv.querySelectorAll('.wallet-item');
                
                walletItems.forEach(item => {
                    const label = item.querySelector('label').textContent.toLowerCase();
                    item.style.display = label.includes(searchTerm) ? '' : 'none';
                });
                
                // 更新分组显示
                const walletGroups = walletsListDiv.querySelectorAll('.wallet-group');
                walletGroups.forEach(group => {
                    const visibleItems = group.querySelectorAll('.wallet-item:not([style*="display: none"])');
                    group.style.display = visibleItems.length > 0 ? '' : 'none';
                });
            });
        }
    }
    
    // 代理配置相关事件
    const proxyEnabledCheckbox = document.getElementById(`proxy-enabled-${taskInstanceId}`);
    const proxyConfigContent = document.getElementById(`proxy-config-content-${taskInstanceId}`);
    const proxyStrategySelect = document.getElementById(`proxy-strategy-${taskInstanceId}`);
    const refreshProxyBtn = document.getElementById(`refresh-proxy-list-${taskInstanceId}`);
    
    if (proxyEnabledCheckbox) {
        proxyEnabledCheckbox.addEventListener('change', (e) => {
            taskConfig.proxyConfig.enabled = e.target.checked;
            if (proxyConfigContent) {
                proxyConfigContent.style.display = e.target.checked ? '' : 'none';
            }
            if (e.target.checked) {
                pageState.proxyManager.reloadProxyList(taskInstanceId, taskConfig);
                pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
            }
        });
    }
    
    if (proxyStrategySelect) {
        proxyStrategySelect.addEventListener('change', (e) => {
            taskConfig.proxyConfig.strategy = e.target.value;
            pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
        });
    }
    
    if (refreshProxyBtn) {
        refreshProxyBtn.addEventListener('click', async () => {
            try {
                const proxies = await getProxies();
                pageState.proxyManager.setAvailableProxies(proxies);
                pageState.proxyManager.reloadProxyList(taskInstanceId, taskConfig);
            } catch (error) {
                console.error('刷新代理列表失败:', error);
            }
        });
    }
    
    // 初始化代理列表
    if (taskConfig.proxyConfig.enabled) {
        pageState.proxyManager.reloadProxyList(taskInstanceId, taskConfig);
        pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
    }
}

/**
 * 保存当前模块数据
 * @param {string} taskInstanceId - 任务实例ID
 */
function saveCurrentModuleData(taskInstanceId) {
    const taskConfig = batchTaskConfigs[taskInstanceId];
    if (!taskConfig) return;
    
    // 保存钱包选择
    const selectedWallets = document.querySelectorAll(`input[name="selected-wallets"]:checked`);
    taskConfig.accounts = Array.from(selectedWallets).map(cb => cb.value);
    
    // 保存代理配置
    const proxyEnabledCheckbox = document.getElementById(`proxy-enabled-${taskInstanceId}`);
    if (proxyEnabledCheckbox) {
        taskConfig.proxyConfig.enabled = proxyEnabledCheckbox.checked;
    }
    
    const proxyStrategySelect = document.getElementById(`proxy-strategy-${taskInstanceId}`);
    if (proxyStrategySelect) {
        taskConfig.proxyConfig.strategy = proxyStrategySelect.value;
    }
    
    console.log(`保存任务配置 ${taskInstanceId}:`, taskConfig);
}

/**
 * 开始执行计时器
 */
function startExecutionTimer() {
    let seconds = 0;
    const timerElement = document.getElementById('timer');
    
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
        downloadLogsBtn.onclick = downloadLogs;
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
 * 清理资源
 */
function cleanupResources() {
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
    
    console.log('[批量脚本] 资源清理完成');
}

/**
 * 添加紧凑任务管理器样式
 */
function addCompactTaskStyles() {
    if (document.getElementById('compact-task-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'compact-task-styles';
    styleElement.textContent = `
        /* 主容器 */
        .batch-task-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: #f8f9fa;
        }
        
        /* 顶部栏 */
        .task-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            background: #fff;
            border-bottom: 1px solid #e9ecef;
        }
        
        .header-nav {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .back-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            color: #666;
            transition: all 0.2s;
        }
        
        .back-btn:hover {
            background: #f0f0f0;
            color: #333;
        }
        
        .header-nav h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 500;
            color: #1a1a1a;
        }
        
        .header-status {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 14px;
        }
        
        .status-text {
            color: #666;
        }
        
        .timer {
            font-family: monospace;
            color: #666;
        }
        
        /* 主体区域 */
        .task-body {
            flex: 1;
            overflow: hidden;
        }
        
        /* 配置区域 */
        .config-section {
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        
        .config-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }
        
        .action-bar {
            padding: 16px 20px;
            background: #fff;
            border-top: 1px solid #e9ecef;
            text-align: center;
        }
        
        /* 日志区域 */
        .log-section {
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #fff;
        }
        
        .log-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .log-info {
            font-size: 14px;
        }
        
        .log-title {
            font-weight: 500;
            color: #1a1a1a;
            margin-right: 16px;
        }
        
        .log-stats {
            color: #666;
        }
        
        .log-stats span {
            font-weight: 500;
            color: #1a1a1a;
        }
        
        .log-actions {
            display: flex;
            gap: 8px;
        }
        
        .tool-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            color: #666;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .tool-btn:hover {
            background: #f0f0f0;
            color: #333;
        }
        
        .tool-btn.active {
            background: #6c5ce7;
            color: #fff;
        }
        
        .log-container {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 13px;
            line-height: 1.6;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        
        .log-entry {
            margin-bottom: 4px;
            display: flex;
            align-items: flex-start;
        }
        
        .log-time {
            color: #858585;
            margin-right: 12px;
            flex-shrink: 0;
        }
        
        .log-message {
            flex: 1;
            word-break: break-word;
        }
        
        .log-type-info .log-message { color: #d4d4d4; }
        .log-type-success .log-message { color: #4ec9b0; }
        .log-type-warning .log-message { color: #dcdcaa; }
        .log-type-error .log-message { color: #f48771; }
        
        .log-footer {
            padding: 16px 20px;
            background: #fff;
            border-top: 1px solid #e9ecef;
            text-align: center;
        }
        
        /* 模块内容样式 */
        .module-section {
            background: #fff;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
        }
        
        .module-section h2 {
            margin: 0 0 16px;
            font-size: 16px;
            font-weight: 500;
            color: #1a1a1a;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* 钱包选择 */
        .wallet-selection-section {
            border: 1px solid #e9ecef;
            border-radius: 6px;
            overflow: hidden;
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            font-size: 13px;
        }
        
        .wallet-actions {
            display: flex;
            gap: 6px;
        }
        
        .wallet-actions .btn {
            padding: 3px 8px;
            font-size: 12px;
        }
        
        .wallet-search-box {
            padding: 8px 12px;
            border-bottom: 1px solid #e9ecef;
            position: relative;
        }
        
        .wallet-search-box input {
            width: 100%;
            padding: 5px 8px;
            padding-right: 28px;
            font-size: 12px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
        }
        
        .wallet-search-box i {
            position: absolute;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            color: #999;
            font-size: 12px;
        }
        
        .wallet-list {
            max-height: 250px;
            overflow-y: auto;
        }
        
        /* 钱包分组样式 */
        .wallet-group {
            border-bottom: 1px solid #f0f0f0;
        }
        
        .wallet-group:last-child {
            border-bottom: none;
        }
        
        .wallet-group-header {
            display: flex;
            align-items: center;
            padding: 6px 12px;
            background: #fafafa;
            cursor: pointer;
            font-size: 13px;
            user-select: none;
        }
        
        .wallet-group-header:hover {
            background: #f5f5f5;
        }
        
        .group-toggle {
            margin-right: 6px;
            color: #666;
            font-size: 10px;
            transition: transform 0.2s;
        }
        
        .group-toggle.collapsed {
            transform: rotate(-90deg);
        }
        
        .group-checkbox {
            margin-right: 8px;
        }
        
        .group-name {
            flex: 1;
            font-weight: 500;
            color: #333;
        }
        
        .group-count {
            font-size: 12px;
            color: #666;
        }
        
        .wallet-group-content {
            display: block;
        }
        
        .wallet-group-content.collapsed {
            display: none;
        }
        
        .wallet-item {
            display: flex;
            align-items: center;
            padding: 6px 12px 6px 32px;
            font-size: 12px;
            transition: background 0.2s;
        }
        
        .wallet-item:hover {
            background: #f8f9fa;
        }
        
        .wallet-item input[type="checkbox"] {
            margin-right: 8px;
        }
        
        .wallet-item label {
            flex: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            margin: 0;
        }
        
        .wallet-address {
            font-family: monospace;
            font-size: 11px;
            color: #666;
            margin-left: 8px;
        }
        
        /* 代理配置样式优化 */
        .proxy-section {
            margin-top: 20px;
        }
        
        .proxy-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }
        
        .proxy-header label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            cursor: pointer;
        }
        
        .proxy-config-content {
            padding: 16px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        .proxy-strategy {
            margin-bottom: 16px;
        }
        
        .proxy-strategy label {
            font-size: 13px;
            color: #666;
            margin-bottom: 6px;
            display: block;
        }
        
        .proxy-strategy select {
            padding: 6px 10px;
            font-size: 13px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background: #fff;
        }
        
        .proxy-list-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .proxy-list-title {
            font-size: 13px;
            color: #666;
        }
        
        .refresh-proxy-btn {
            padding: 4px 10px;
            font-size: 12px;
            background: transparent;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .refresh-proxy-btn:hover {
            border-color: #6c5ce7;
            color: #6c5ce7;
        }
        
        /* 代理列表样式 */
        .proxy-list-container {
            border: 1px solid #e9ecef;
            border-radius: 6px;
            background: #fff;
            max-height: 200px;
            overflow-y: auto;
        }
        
        .proxy-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            border-bottom: 1px solid #f0f0f0;
            font-size: 13px;
            transition: background 0.2s;
        }
        
        .proxy-item:last-child {
            border-bottom: none;
        }
        
        .proxy-item:hover {
            background: #f8f9fa;
        }
        
        .proxy-item input[type="checkbox"] {
            margin-right: 10px;
        }
        
        .proxy-item label {
            flex: 1;
            display: flex;
            align-items: center;
            cursor: pointer;
        }
        
        .proxy-info {
            flex: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .proxy-address {
            color: #1a1a1a;
            font-family: monospace;
        }
        
        .proxy-location {
            color: #666;
            font-size: 12px;
        }
        
        .proxy-strategy-details {
            margin-top: 12px;
            padding: 12px;
            background: #e9ecef;
            border-radius: 4px;
            font-size: 13px;
            color: #666;
        }
        
        /* 按钮样式 */
        .btn.btn-primary {
            background: #6c5ce7;
            color: #fff;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn.btn-primary:hover:not(:disabled) {
            background: #5a4cdb;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(108, 92, 231, 0.3);
        }
        
        .btn.btn-primary:disabled {
            background: #e9ecef;
            color: #adb5bd;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .btn.btn-secondary {
            background: transparent;
            color: #666;
            border: 1px solid #dee2e6;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn.btn-secondary:hover {
            border-color: #6c5ce7;
            color: #6c5ce7;
        }
        
        .btn.btn-danger {
            background: #dc3545;
            color: #fff;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .btn.btn-danger:hover {
            background: #c82333;
        }
        
        .btn-sm {
            padding: 4px 10px;
            font-size: 12px;
        }
    `;
    document.head.appendChild(styleElement);
}

/**
 * 下载日志
 */
function downloadLogs() {
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