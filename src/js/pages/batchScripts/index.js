/**
 * 脚本插件管理页面 - 主模块（重构版）
 * 负责初始化页面、加载批量任务列表和基本交互
 */

import { showModal } from '../../components/modal.js';
import { translateLocation } from '../../utils/locationTranslator.js';
import { BatchTaskManager } from './batchTaskManager.js';
import { TaskLogger } from './logger.js';

// 导入新的核心管理器（渐进式集成）
// 注意：由于模块系统兼容性问题，暂时使用动态导入
let ScriptManager, TaskStateManager, ExecutionEngine, LogManager;

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
import { setupGlobalChineseTextFix } from './utils/ChineseTextFixer.js';
import { setupGlobalBackgroundTaskManager } from './utils/BackgroundTaskManager.js';
import { setupGlobalTaskConfigManager } from './utils/TaskConfigManager.js';
import { setupGlobalScriptExecutionManager } from './utils/ScriptExecutionManager.js';

// 页面状态管理
const pageState = {
    contentAreaRef: null,
    currentView: VIEW_MODES.CARDS,
    currentBatchScriptType: null,
    walletGroupManager: new WalletGroupManager(),
    proxyManager: new ProxyManager()
};

// 新的核心管理器实例（渐进式集成）
let coreManagers = null;

/**
 * 立即设置中文乱码修复功能
 * 使用拆分后的专用模块
 */
function setupChineseTextFix() {
    // 调用拆分后的中文修复模块
    setupGlobalChineseTextFix();
}

/**
 * 显示脚本模块重构状态
 */
function showRefactorStatus() {
    // 减少初始化阶段的日志输出，避免控制台混乱
    console.log('✨ 脚本插件模块重构完成!');
}

/**
 * 初始化核心管理器（使用动态导入）
 */
async function initCoreManagers() {
    if (coreManagers) {
        console.log('[核心管理器] 已初始化，跳过重复初始化');
        return true;
    }

    try {
        // console.log('[核心管理器] 开始动态加载新的架构模块...');
        
        // 动态导入模块
        const [
            { ScriptManager: SM },
            { TaskStateManager: TSM },
            { ExecutionEngine: EE },
            { LogManager: LM },
            { stateManagerIntegration: SMI }
        ] = await Promise.all([
            import('./core/ScriptManager.js'),
            import('./core/TaskStateManager.js'),
            import('./core/ExecutionEngine.js'),
            import('./core/LogManager.js'),
            import('./core/StateManagerIntegration.js')
        ]);
        
        // 设置全局引用
        ScriptManager = SM;
        TaskStateManager = TSM;
        ExecutionEngine = EE;
        LogManager = LM;
        
        // 初始化状态管理器集成
        console.log('[核心管理器] 初始化统一状态管理器...');
        if (!SMI.isInitialized) {
            SMI.initialize();
        }
        
        // console.log('[核心管理器] 模块动态加载成功');
        // console.log('[核心管理器] 检查模块可用性:');
        // console.log('- ScriptManager:', typeof ScriptManager);
        // console.log('- TaskStateManager:', typeof TaskStateManager);  
        // console.log('- ExecutionEngine:', typeof ExecutionEngine);
        // console.log('- LogManager:', typeof LogManager);
        
        // 创建核心管理器实例
        // console.log('[核心管理器] 创建 TaskStateManager...');
        const taskStateManager = new TaskStateManager();
        
        // console.log('[核心管理器] 创建 LogManager...');
        const logManager = new LogManager();
        
        // console.log('[核心管理器] 创建 ExecutionEngine...');
        const executionEngine = new ExecutionEngine(taskStateManager);
        
        // console.log('[核心管理器] 创建 ScriptManager...');
        const scriptManager = new ScriptManager();
        
        // 存储管理器实例
        coreManagers = {
            scriptManager,
            taskStateManager,
            executionEngine,
            logManager,
            stateManagerIntegration: SMI
        };
        
        // 设置跨模块通信
        setupCoreManagersIntegration();
        
        // console.log('[核心管理器] 新架构模块初始化完成');
        // console.log('[核心管理器] 管理器实例:', Object.keys(coreManagers));
        
        // 将核心管理器暴露到全局（便于调试和其他模块访问）
        if (typeof window !== 'undefined') {
            window.__FA_CoreManagers = coreManagers;
            // console.log('[核心管理器] 已暴露到全局变量 window.__FA_CoreManagers');
            // console.log('[核心管理器] 验证全局变量:', !!window.__FA_CoreManagers);
            
            // 立即启用新的日志管理器来处理中文乱码
            window.__FA_ActiveLogManager = logManager;
            // console.log('[核心管理器] 已激活新的日志管理器，开始处理中文乱码修复');
            
            // 显示重构状态
            showRefactorStatus();
        }
        
        return true;
    } catch (error) {
        console.error('[核心管理器] 初始化失败:', error);
        console.error('[核心管理器] 错误堆栈:', error.stack);
        coreManagers = null;
        return false;
    }
}

/**
 * 设置核心管理器间的集成
 */
function setupCoreManagersIntegration() {
    if (!coreManagers) return;
    
    const { taskStateManager, logManager, executionEngine } = coreManagers;
    
    // 设置状态变更监听，自动记录日志
    taskStateManager.subscribe((taskId, stateData) => {
        const { state, previousState } = stateData;
        
        if (previousState && previousState !== state) {
            logManager.addLog(taskId, 'info', `任务状态变更: ${previousState} -> ${state}`, {
                source: 'state_manager',
                stateTransition: true
            });
        }
    });
    
    console.log('[核心管理器] 跨模块集成设置完成');
}

/**
 * 获取核心管理器实例
 * @returns {Object|null} 核心管理器实例
 */
function getCoreManagers() {
    return coreManagers;
}

// 后台任务管理 - 使用新的BackgroundTaskManager模块
let backgroundTaskManager = null;

// 后台任务兼容性变量（指向全局管理器的tasks）
let backgroundTasks = null;

// 兼容性函数（指向全局管理器的方法）
let saveBackgroundTasksToStorage = null;
let updateBackgroundTaskIndicator = null;
let toggleBackgroundTasksPanel = null;
let renderBackgroundTasksList = null;

// 任务配置管理 - 使用新的TaskConfigManager模块
let taskConfigManager = null;

// 脚本执行管理 - 使用新的ScriptExecutionManager模块
let scriptExecutionManager = null;

/**
 * 初始化后台任务管理器 (使用新的模块化架构)
 */
function initGlobalBackgroundTaskManager() {
    if (!backgroundTaskManager) {
        backgroundTaskManager = setupGlobalBackgroundTaskManager();
        console.log('[后台任务] 新的BackgroundTaskManager模块已初始化');
        
        // 设置兼容性变量，指向新管理器
        backgroundTasks = window.__FABackgroundTasks;
        saveBackgroundTasksToStorage = window.FABackgroundTaskManager?.saveToStorage;
        updateBackgroundTaskIndicator = window.FABackgroundTaskManager?.updateIndicator;
        toggleBackgroundTasksPanel = window.toggleBackgroundTasksPanel;
        renderBackgroundTasksList = window.renderBackgroundTasksList;
        
        console.log('[后台任务] 兼容性变量已设置，backgroundTasks:', backgroundTasks?.size || 0);
    }
}

/**
 * 初始化任务配置管理器 (使用新的TaskConfigManager模块)
 */
function initGlobalTaskConfigManager() {
    if (!taskConfigManager) {
        taskConfigManager = setupGlobalTaskConfigManager(pageState);
        console.log('[任务配置] 新的TaskConfigManager模块已初始化');
    }
}

/**
 * 初始化脚本执行管理器 (使用新的ScriptExecutionManager模块)
 */
function initGlobalScriptExecutionManager() {
    if (!scriptExecutionManager) {
        const backgroundTaskHelpers = {
            formatDuration: window.formatDuration,
            restoreTaskFromBackground: window.restoreTaskFromBackground,
            stopBackgroundTask: window.stopBackgroundTask,
            saveBackgroundTasksToStorage: window.FABackgroundTaskManager?.saveToStorage,
            updateBackgroundTaskIndicator: window.FABackgroundTaskManager?.updateIndicator
        };
        
        scriptExecutionManager = setupGlobalScriptExecutionManager(
            pageState, 
            backgroundTasks, 
            backgroundTaskHelpers, 
            taskConfigManager
        );
        console.log('[脚本执行] 新的ScriptExecutionManager模块已初始化');
    }
}



// 页面加载时立即初始化全局管理器
if (typeof window !== 'undefined') {
    // 立即执行，不等待页面加载
    console.log('[全局后台任务] 开始初始化...');
    initGlobalBackgroundTaskManager();
}

/**
 * 初始化脚本插件管理页面
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export async function initBatchScriptsPage(contentArea) {
    console.log("初始化脚本插件管理页面...");
    
    // 初始化后台任务管理器
    initGlobalBackgroundTaskManager();
    console.log("[后台任务] 初始化时的后台任务数量:", window.__FABackgroundTasks?.size || 0);
    pageState.contentAreaRef = contentArea;
    
    // 立即启用中文乱码修复功能
    setupChineseTextFix();
    
    // 初始化新的核心管理器（渐进式集成）
    console.log('[脚本插件] 开始初始化核心管理器...');
    const initSuccess = await initCoreManagers();
    console.log('[脚本插件] 核心管理器初始化结果:', initSuccess);
    
    // 设置页面标志
    window.__isBatchScriptsPageActive = true;
    
    // 将pageState暴露到全局，供BackgroundTaskManager使用
    window.pageState = pageState;
    
    // 立即加载样式，确保后台任务面板样式可用
    addCompactTaskStyles();
    
    // 确保全局后台任务管理器已初始化
    initGlobalBackgroundTaskManager();
    
    // 初始化任务配置管理器
    initGlobalTaskConfigManager();
    
    // 初始化脚本执行管理器
    initGlobalScriptExecutionManager();
    
    // 初始化调试工具
    initDebugTools();
    
    // 恢复后台任务状态（从全局管理器）
    if (window.FABackgroundTaskManager) {
        window.FABackgroundTaskManager.loadFromStorage();
        console.log('[后台任务] 从全局管理器恢复任务状态');
        console.log('[后台任务] 恢复后的任务数量:', backgroundTasks.size);
    }
    
    renderBatchScriptCardsView(contentArea);
    
    // 初始化时也检查后台任务指示器
    setTimeout(() => {
        updateBackgroundTaskIndicator();
        console.log('[后台任务] 页面初始化完成，更新指示器');
        console.log('[后台任务] 最终的后台任务数量:', backgroundTasks.size);
    }, 100);
    
    // 额外的延迟确保DOM完全加载
    setTimeout(() => {
        if (window.forceUpdateIndicator) {
            window.forceUpdateIndicator();
        }
        if (window.debugBackgroundTasks) {
            window.debugBackgroundTasks();
        }
    }, 1000);

    // 注册全局IPC监听器
    if (globalLogUnsubscriber) globalLogUnsubscriber(); // 清理旧的（如果有）
    if (globalCompletedUnsubscriber) globalCompletedUnsubscriber(); // 清理旧的（如果有）

    // 暴露全局日志处理器到window对象，供其他模块使用
    window.globalLogEventHandler = globalLogEventHandler;
    window.globalScriptCompletedHandler = globalScriptCompletedHandler;

    if (window.scriptAPI) {
        console.log('[脚本插件] 使用 scriptAPI 注册全局日志和完成监听器');
        globalLogUnsubscriber = window.scriptAPI.onLog(globalLogEventHandler);
        globalCompletedUnsubscriber = window.scriptAPI.onScriptCompleted(globalScriptCompletedHandler);
    } else if (window.electron && window.electron.ipcRenderer) {
        console.log('[脚本插件] 使用 ipcRenderer 注册全局日志和完成监听器');
        window.electron.ipcRenderer.on('script-log', globalLogEventHandler);
        window.electron.ipcRenderer.on('script-completed', globalScriptCompletedHandler);
        globalLogUnsubscriber = () => window.electron.ipcRenderer.removeListener('script-log', globalLogEventHandler);
        globalCompletedUnsubscriber = () => window.electron.ipcRenderer.removeListener('script-completed', globalScriptCompletedHandler);
    } else {
        console.error('[脚本插件] 无法注册全局日志监听器：scriptAPI 和 ipcRenderer都不可用。');
    }
}

/**
 * 渲染脚本插件卡片视图
 * @param {HTMLElement} contentArea - 内容区域元素
 */
function renderBatchScriptCardsView(contentArea) {
    // console.log('[调试] renderBatchScriptCardsView 开始，当前后台任务数量:', backgroundTasks.size);
    // console.log('[调试] 后台任务详情:', Array.from(backgroundTasks.entries()));
    
    pageState.currentView = VIEW_MODES.CARDS;
    
    const cardViewHtml = `
    <div class="page-header">
        <h1>脚本插件</h1>
        <div class="header-actions">
            <button id="background-tasks-btn" class="btn btn-secondary" style="display: none;">
                <i class="fas fa-tasks"></i> 后台任务 (<span id="background-task-count">0</span>)
            </button>
            <button id="refresh-batch-scripts-btn" class="btn btn-secondary">
                <i class="fas fa-sync-alt"></i> 刷新列表
            </button>
        </div>
    </div>
    ${createFilterPanelHTML()}
    
    <!-- 后台任务面板 -->
    <div class="background-tasks-panel" id="backgroundTasksPanel" style="display: none;">
        <div class="panel-header">
            <h3><i class="fas fa-tasks"></i> 后台运行的任务</h3>
            <button class="close-btn" id="closeBackgroundPanel">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="panel-content" id="backgroundTasksList">
            <!-- 后台任务列表将在此处动态加载 -->
        </div>
    </div>
    
    <div class="script-cards-grid" id="batchScriptCardsContainer"></div>`;
    
    contentArea.innerHTML = cardViewHtml;
    
    // 绑定刷新按钮事件
    const refreshBtn = contentArea.querySelector('#refresh-batch-scripts-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async () => {
            // 更改按钮状态以指示正在同步
            refreshBtn.disabled = true;
            const originalText = refreshBtn.innerHTML;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 同步中...';
            
            try {
                // 先执行脚本同步（如果可用）
                if (window.scriptAPI && typeof window.scriptAPI.syncScripts === 'function') {
                    const syncResult = await window.scriptAPI.syncScripts();
                    console.log('[脚本插件] 脚本同步结果:', syncResult);
                    
                    // 如果同步了删除的脚本，显示提示
                    if (syncResult.success && syncResult.result && syncResult.result.processedScripts) {
                        const deletedScripts = syncResult.result.processedScripts.filter(s => s.status === 'deleted');
                        if (deletedScripts.length > 0) {
                            console.log('[脚本插件] 已删除的脚本:', deletedScripts);
                            // 可以在这里添加用户通知
                        }
                    }
                }
            } catch (syncError) {
                console.error('[脚本插件] 同步脚本时出错:', syncError);
            } finally {
                // 然后加载脚本列表
                loadAndRenderBatchScriptCards(contentArea);
                
                // 恢复按钮状态
                setTimeout(() => {
                    refreshBtn.innerHTML = originalText;
                    refreshBtn.disabled = false;
                }, 500);
            }
        });
    }
    
    // 绑定后台任务按钮事件
    const backgroundTasksBtn = contentArea.querySelector('#background-tasks-btn');
    if (backgroundTasksBtn) {
        backgroundTasksBtn.addEventListener('click', () => {
            toggleBackgroundTasksPanel();
        });
    }
    
    // 绑定关闭后台任务面板按钮
    const closeBackgroundPanel = contentArea.querySelector('#closeBackgroundPanel');
    if (closeBackgroundPanel) {
        closeBackgroundPanel.addEventListener('click', () => {
            toggleBackgroundTasksPanel(false);
        });
    }
    
    loadAndRenderBatchScriptCards(contentArea);
    setupFilteringFunction(contentArea);
    
    // 确保DOM渲染完成后再更新后台任务指示器
    setTimeout(() => {
        // console.log('[后台任务] DOM渲染完成，更新指示器');
        // console.log('[后台任务] 当前后台任务数量:', backgroundTasks.size);
        // console.log('[后台任务] 后台任务详情:', Array.from(backgroundTasks.entries()));
        updateBackgroundTaskIndicator();
        
        // 如果有后台任务但按钮没显示，强制更新
        if (backgroundTasks.size > 0) {
            const btn = document.getElementById('background-tasks-btn');
            const count = document.getElementById('background-task-count');
            if (btn && count) {
                btn.style.display = 'inline-flex';
                btn.classList.add('has-background-tasks');
                count.textContent = backgroundTasks.size;
                console.log('[后台任务] 强制显示后台任务按钮');
            }
        }
    }, 500);
}

/**
 * 加载并渲染脚本插件卡片
 * @param {HTMLElement} pageContentArea - 卡片页面的内容区域
 */
async function loadAndRenderBatchScriptCards(pageContentArea) {
    const cardsContainer = pageContentArea.querySelector('#batchScriptCardsContainer');
    const statusFilterElement = pageContentArea.querySelector('#batchScriptStatusFilter');
    
    if (!cardsContainer) {
        console.error('卡片容器 #batchScriptCardsContainer 未找到');
        return;
    }
    
    cardsContainer.innerHTML = '';
    
    // 加载脚本列表 - 优先使用新的 ScriptManager
    let scriptsList = [];
    const managers = getCoreManagers();
    
    if (managers && managers.scriptManager) {
        try {
            console.log('[脚本插件] 使用新的 ScriptManager 加载脚本');
            const scripts = await managers.scriptManager.getAvailableScripts();
            scriptsList = scripts.map(s => ({
                ...s,  // 保留所有原始字段，包括requires
                status: s.status || 'active',
                category: s.category || ''
            }));
            
            console.log('[脚本插件] 通过 ScriptManager 加载的脚本数据:', scriptsList);
        } catch (managerError) {
            console.warn('[脚本插件] ScriptManager 加载失败，回退到原有方式:', managerError);
        }
    }
    
    // 回退方案：使用原有的加载方式
    if (scriptsList.length === 0) {
        console.log('[脚本插件] 使用原有 API 方式加载脚本');
    if (window.scriptAPI && typeof window.scriptAPI.getAllScripts === 'function') {
        try {
            const result = await window.scriptAPI.getAllScripts();
            if (result.success && Array.isArray(result.data)) {
                scriptsList = result.data.map(s => ({
                    ...s,  // 保留所有原始字段，包括requires
                    status: s.status || 'active',
                    category: s.category || ''
                }));
                
                // 添加调试日志
                    console.log('[脚本插件] 通过原有API加载的脚本数据:', scriptsList);
                const httpScript = scriptsList.find(script => script.id === 'http_request_test');
                if (httpScript) {
                    console.log('[脚本插件] HTTP请求测试脚本数据:', httpScript);
                    console.log('[脚本插件] HTTP脚本requires字段:', httpScript.requires);
                }
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
    }

    // 渲染脚本卡片
    renderScriptCards(cardsContainer, scriptsList, (scriptData) => {
        pageState.currentBatchScriptType = scriptData;
        const taskInstanceId = `task_${scriptData.id}_${Date.now()}`;
        navigateToModularTaskManager(taskInstanceId);
    });
    
    // 更新筛选器选项
    populateFilters(statusFilterElement, scriptsList);
}

/**
 * 导航到模块化任务管理器视图
 */
function navigateToModularTaskManager(taskInstanceId) {
    console.log("导航到模块化任务管理器...");
    console.log("当前脚本数据:", pageState.currentBatchScriptType);
    console.log("脚本requires字段:", pageState.currentBatchScriptType?.requires);
    console.log("脚本requires.wallets:", pageState.currentBatchScriptType?.requires?.wallets);
    pageState.currentView = VIEW_MODES.MANAGER;
    
    // 保存任务实例ID到全局变量
    window.__currentTaskInstanceId = taskInstanceId;
    
    // 清理可能存在的旧资源，但保留任务实例ID
    cleanupResources(true);
    
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
                <div class="status-info">
                    <span class="status-text" id="statusText">配置中</span>
                    <span class="timer" id="timer" style="display: none;">00:00</span>
                </div>
                <div class="header-controls" id="headerControls" style="display: none;">
                    <button id="back-to-config-btn" class="control-btn btn-secondary" title="返回配置">
                        <i class="fas fa-cog"></i>
                        <span>配置</span>
                    </button>
                    <button id="stop-btn" class="control-btn btn-danger" style="display: none;" title="停止执行">
                        <i class="fas fa-stop"></i>
                        <span>停止</span>
                    </button>
                </div>
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
            </div>
        </div>
    </div>
    `;

    pageState.contentAreaRef.innerHTML = templateHtml;
    
    // 初始化任务配置 (使用新的TaskConfigManager)
    taskConfigManager.initializeTaskConfig(taskInstanceId, pageState.currentBatchScriptType);
    
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
            
            // 检查是否有正在运行的任务
            const currentExecutionId = window.__currentExecutionId;
            const hasExecutionTimer = !!window.__executionTimer;
            const hasStartTime = !!window.__startTime;
            
            // 智能检测任务运行状态：
            // 1. 有执行ID且有计时器 - 明确运行中
            // 2. 有执行ID且有开始时间但没计时器 - 可能刚开始执行，计时器还没启动
            // 3. 只有执行ID但没有开始时间 - 可能是已完成的任务，不应移至后台
            const isTaskRunning = currentExecutionId && (hasExecutionTimer || hasStartTime);
            
            console.log('[脚本插件] 返回按钮点击，任务状态检查:', {
                currentExecutionId,
                hasExecutionTimer,
                hasStartTime,
                isTaskRunning,
                taskInstanceId
            });
            
            if (isTaskRunning) {
                // 如果有正在运行的任务，保存到后台而不是清理
                moveTaskToBackground(taskInstanceId);
                console.log('[脚本插件] 任务已移至后台运行');
                
                // 添加小延迟，确保后台任务保存完成
                setTimeout(() => {
                    renderBatchScriptCardsView(pageState.contentAreaRef);
                }, 100);
            } else {
                // 没有运行中的任务，正常清理
                cleanupResources();
                renderBatchScriptCardsView(pageState.contentAreaRef);
            }
        });
    }

    // 开始执行按钮
    const startTaskButton = managerPage.querySelector('#start-execution-btn');
    if (startTaskButton) {
        // 监听钱包选择变化，更新按钮状态
        const updateStartButtonState = () => {
            const selectedWallets = document.querySelectorAll('input[name="selected-wallets"]:checked');
            const walletCount = selectedWallets.length;
            
            // 检查当前脚本是否需要钱包
            const scriptRequires = pageState.currentBatchScriptType?.requires;
            const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
            
            // console.log('[脚本插件] 按钮状态检查:', {
            //     requiresWallets,
            //     walletCount,
            //     scriptName: pageState.currentBatchScriptType?.name,
            //     scriptRequires: pageState.currentBatchScriptType?.requires,
            //     scriptRequiresWallets: scriptRequires?.wallets,
            //     buttonElement: startTaskButton
            // });
            
            if (requiresWallets) {
                // 需要钱包的脚本，必须选择至少一个钱包
                if (walletCount > 0) {
                    startTaskButton.disabled = false;
                    // console.log('[脚本插件] 已选择钱包，启用执行按钮');
                } else {
                    startTaskButton.disabled = true;
                    // console.log('[脚本插件] 未选择钱包，禁用执行按钮');
                }
            } else {
                // 不需要钱包的脚本，直接启用按钮
                startTaskButton.disabled = false;
                // console.log('[脚本插件] 不需要钱包，启用执行按钮');
            }
        };
        
        // 初始检查
        setTimeout(() => {
            updateStartButtonState();
            // console.log('[脚本插件] 执行按钮状态初始检查完成');
        }, 200);
        
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
            
            // 检查是否有正在运行的任务
            const currentExecutionId = window.__currentExecutionId;
            const isTaskRunning = currentExecutionId && window.__executionTimer;
            
            if (isTaskRunning) {
                // 如果有正在运行的任务，保存到后台而不是停止
                moveTaskToBackground(taskInstanceId);
                console.log('[脚本插件] 任务已移至后台运行（从执行页面返回配置）');
            }
            
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
                stopTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>停止中</span>';
                
                // 停止执行计时器
                if (window.__executionTimer) {
                    clearInterval(window.__executionTimer);
                    window.__executionTimer = null;
                }
                
                // 获取当前执行的任务ID
                const currentExecutionId = window.__currentExecutionId;
                
                console.log('[停止脚本] 当前执行ID:', currentExecutionId);
                console.log('[停止脚本] scriptAPI可用:', !!window.scriptAPI);
                
                if (currentExecutionId && window.scriptAPI && window.scriptAPI.stopScript) {
                    TaskLogger.logWarning('正在停止脚本执行...');
                    TaskLogger.logInfo(`执行ID: ${currentExecutionId}`);
                    
                    const result = await window.scriptAPI.stopScript(currentExecutionId);
                    console.log('[停止脚本] 停止结果:', result);
                    if (result.success) {
                        TaskLogger.logWarning('✋ 脚本执行已被用户停止');
                        
                        // 清理当前执行状态
                        window.__currentExecutionId = null;
                        
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
                        const startButton = managerPage.querySelector('#start-execution-btn');
                        if (startButton) {
                            startButton.disabled = false;
                            startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                        }
                    } else {
                        TaskLogger.logError(`停止脚本失败: ${result.error || '未知错误'}`);
                        
                        // 即使停止失败，也询问用户是否强制停止
                        const forceStop = confirm('后端停止脚本失败，是否强制清理前端状态？\n' +
                            '注意：这可能导致后端脚本继续运行，但前端将停止显示。');
                        
                        if (forceStop) {
                            TaskLogger.logWarning('⚠️  用户选择强制停止，清理前端状态');
                            
                            // 强制清理当前执行状态
                            window.__currentExecutionId = null;
                            
                            // 更新状态
                            const statusText = document.getElementById('statusText');
                            if (statusText) {
                                statusText.textContent = '已强制停止';
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
                            const startButton = managerPage.querySelector('#start-execution-btn');
                            if (startButton) {
                                startButton.disabled = false;
                                startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                            }
                        } else {
                        // 恢复按钮状态
                        stopTaskButton.disabled = false;
                        stopTaskButton.innerHTML = '<i class="fas fa-stop"></i><span>停止</span>';
                        }
                    }
                } else if (currentExecutionId && currentExecutionId.startsWith('mock_exec_')) {
                    // 处理模拟执行的停止
                    TaskLogger.logWarning('正在停止模拟执行...');
                    
                    // 清理模拟任务函数
                    if (window[`__mockTask_${taskInstanceId}`]) {
                        delete window[`__mockTask_${taskInstanceId}`];
                    }
                    
                    // 清空执行ID（这会触发模拟执行检查并停止）
                    window.__currentExecutionId = null;
                    
                    TaskLogger.logWarning('✋ 模拟执行已被用户停止');
                    
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
                    const startButton = managerPage.querySelector('#start-execution-btn');
                    if (startButton) {
                        startButton.disabled = false;
                        startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                    }
                } else {
                    TaskLogger.logError('无法停止脚本：执行ID不存在或停止接口不可用');
                    TaskLogger.logWarning(`调试信息: executionId=${currentExecutionId}, scriptAPI=${!!window.scriptAPI}`);
                    
                    // 询问是否强制清理UI状态
                    const forceCleanup = confirm('未找到有效的执行ID，是否清理UI状态？\n' +
                        '这将重置界面，但不会影响可能正在运行的后端脚本。');
                    
                    if (forceCleanup) {
                        TaskLogger.logWarning('⚠️  强制清理UI状态');
                        
                        // 强制清理所有状态
                        window.__currentExecutionId = null;
                        
                        // 停止计时器
                        if (window.__executionTimer) {
                            clearInterval(window.__executionTimer);
                            window.__executionTimer = null;
                        }
                        
                        // 更新状态
                        const statusText = document.getElementById('statusText');
                        if (statusText) {
                            statusText.textContent = '已清理';
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
                        const startButton = managerPage.querySelector('#start-execution-btn');
                        if (startButton) {
                            startButton.disabled = false;
                            startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                        }
                    } else {
                    // 恢复按钮状态
                    stopTaskButton.disabled = false;
                    stopTaskButton.innerHTML = '<i class="fas fa-stop"></i><span>停止</span>';
                    }
                }
            } catch (error) {
                console.error('停止脚本执行失败:', error);
                TaskLogger.logError(`停止脚本失败: ${error.message}`);
                
                // 恢复按钮状态
                stopTaskButton.disabled = false;
                stopTaskButton.innerHTML = '<i class="fas fa-stop"></i><span>停止</span>';
            }
        });
    }
}

// handleStartExecution 函数已移至 ScriptExecutionManager 模块

// switchToExecutionStage 函数已移至 ScriptExecutionManager 模块

// switchToConfigStage 函数已移至 ScriptExecutionManager 模块

// setupScriptLogListeners 函数已移至 ScriptExecutionManager 模块

// loadModuleContent 函数已移至 TaskConfigManager 模块

// bindModuleSpecificInputEvents 函数已移至 TaskConfigManager 模块

// saveCurrentModuleData 函数已移至 TaskConfigManager 模块

// startExecutionTimer 函数已移至 ScriptExecutionManager 模块

// cleanupResources 函数已移至 ScriptExecutionManager 模块

/**
 * 添加紧凑任务管理器样式
 */
function addCompactTaskStyles() {
    if (document.getElementById('compact-task-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'compact-task-styles';
    styleElement.textContent = `
        /* 基础样式重置 - 限定在脚本插件页面 */
        .plugin-page * {
            box-sizing: border-box;
        }
        
        /* 页面基础样式 - 限定在脚本插件页面 */
        .plugin-page .page-header {
            margin-bottom: 20px;
        }
        
        .plugin-page .header-actions {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        
        /* 以下为 .batch-task-container 内部的样式，它们已经有较好的作用域，保持不变 */
        .batch-task-container .btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            background: #fff;
            color: #495057;
            text-decoration: none;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .batch-task-container .btn:hover {
            border-color: #6c5ce7;
            color: #6c5ce7;
        }
        
        .batch-task-container .btn.btn-secondary {
            border-color: #6c757d;
            color: #6c757d;
        }
        
        .batch-task-container .btn.btn-secondary:hover {
            background: #6c757d;
            color: #fff;
        }
        
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
        
        .status-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .status-text {
            color: #666;
        }
        
        .timer {
            font-family: monospace;
            color: #666;
        }
        
        /* 头部控制按钮 */
        .header-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .control-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fff;
            color: #666;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
        }
        
        .control-btn:hover {
            border-color: #bbb;
            color: #333;
            background: #f8f9fa;
        }
        
        .control-btn.btn-secondary {
            border-color: #6c757d;
            color: #6c757d;
        }
        
        .control-btn.btn-secondary:hover {
            background: #6c757d;
            color: #fff;
        }
        
        .control-btn.btn-danger {
            border-color: #dc3545;
            color: #dc3545;
        }
        
        .control-btn.btn-danger:hover {
            background: #dc3545;
            color: #fff;
        }
        
        .control-btn i {
            font-size: 12px;
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
        
        /* 脚本信息卡片 */
        .script-info-section {
            margin-bottom: 20px;
        }
        
        .info-card {
            border: 1px solid #e9ecef;
            border-radius: 6px;
            overflow: hidden;
            background: #fff;
        }
        
        .info-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            font-size: 14px;
            font-weight: 500;
            color: #495057;
        }
        
        .info-header i {
            color: #6c757d;
        }
        
        .info-content {
            padding: 16px;
        }
        
        .info-content p {
            margin: 0 0 8px 0;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .info-content p:last-child {
            margin-bottom: 0;
        }
        
        .info-content strong {
            color: #495057;
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
        .batch-task-container .btn.btn-primary,
        .background-tasks-panel .btn.btn-primary {
            background: #6c5ce7;
            color: #fff;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .batch-task-container .btn.btn-primary:hover:not(:disabled),
        .background-tasks-panel .btn.btn-primary:hover:not(:disabled) {
            background: #5a4cdb;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(108, 92, 231, 0.3);
        }
        
        .batch-task-container .btn.btn-primary:disabled,
        .background-tasks-panel .btn.btn-primary:disabled {
            background: #e9ecef;
            color: #adb5bd;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .batch-task-container .btn.btn-secondary,
        .background-tasks-panel .btn.btn-secondary {
            background: transparent;
            color: #666;
            border: 1px solid #dee2e6;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .batch-task-container .btn.btn-secondary:hover,
        .background-tasks-panel .btn.btn-secondary:hover {
            border-color: #6c5ce7;
            color: #6c5ce7;
        }
        
        .batch-task-container .btn.btn-danger,
        .background-tasks-panel .btn.btn-danger {
            background: #dc3545;
            color: #fff;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .batch-task-container .btn.btn-danger:hover,
        .background-tasks-panel .btn.btn-danger:hover {
            background: #c82333;
        }
        
        .btn-sm {
            padding: 4px 10px;
            font-size: 12px;
        }
        
        /* 后台任务相关样式 */
        .has-background-tasks {
            background: #27ae60 !important;
            color: #fff !important;
            border-color: #27ae60 !important;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .background-tasks-panel {
            position: fixed;
            top: 80px;
            right: 20px;
            width: 400px;
            max-height: 500px;
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 1000;
            overflow: hidden;
        }
        
        .background-tasks-panel .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        
        .background-tasks-panel .panel-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 500;
            color: #1a1a1a;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .background-tasks-panel .close-btn {
            width: 28px;
            height: 28px;
            border: none;
            background: transparent;
            border-radius: 4px;
            cursor: pointer;
            color: #666;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .background-tasks-panel .close-btn:hover {
            background: #e9ecef;
            color: #333;
        }
        
        .background-tasks-panel .panel-content {
            max-height: 400px;
            overflow-y: auto;
            padding: 12px;
        }
        
        .background-task-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            margin-bottom: 8px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            transition: all 0.2s;
        }
        
        .background-task-item:hover {
            border-color: #6c5ce7;
            background: #fff;
        }
        
        .background-task-item:last-child {
            margin-bottom: 0;
        }
        
        .task-info {
            flex: 1;
        }
        
        .task-name {
            font-size: 14px;
            font-weight: 500;
            color: #1a1a1a;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .task-details {
            font-size: 12px;
            color: #666;
            display: flex;
            gap: 12px;
        }
        
        .task-status.running {
            color: #27ae60;
            font-weight: 500;
        }
        
        .task-duration {
            color: #666;
        }
        
        .task-actions {
            display: flex;
            gap: 6px;
        }
        
        .action-btn {
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }
        
        .action-btn.resume-btn {
            background: #6c5ce7;
            color: #fff;
        }
        
        .action-btn.resume-btn:hover {
            background: #5a4cdb;
        }
        
        .action-btn.stop-btn {
            background: #dc3545;
            color: #fff;
        }
        
        .action-btn.stop-btn:hover {
            background: #c82333;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }
        
        .empty-state i {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.3;
        }
        
        .empty-state p {
            margin: 0;
            font-size: 14px;
        }
        
        .text-success {
            color: #27ae60 !important;
        }
        

    `;
    document.head.appendChild(styleElement);
}

// downloadLogs 函数已移至 ScriptExecutionManager 模块

// moveTaskToBackground 函数已移至 BackgroundTaskManager 模块

// restoreTaskFromBackground 和 getBackgroundTasks 函数已移至 BackgroundTaskManager 模块

// stopBackgroundTask 函数已移至 BackgroundTaskManager 模块

// updateBackgroundTaskIndicator 和 toggleBackgroundTasksPanel 函数已移至 BackgroundTaskManager 模块

// renderBackgroundTasksList 和 formatDuration 函数已移至 BackgroundTaskManager 模块

/**
 * 从面板恢复后台任务
 * @param {string} taskInstanceId - 任务实例ID
 */
async function resumeBackgroundTask(taskInstanceId) {
    // 获取后台任务数据
    const backgroundTask = backgroundTasks.get(taskInstanceId);
    if (!backgroundTask) {
        console.error(`[任务恢复] 未找到后台任务: ${taskInstanceId}`);
        return;
    }

    // 隐藏后台任务面板
    toggleBackgroundTasksPanel(false);

    // 设置当前脚本类型（确保页面状态正确）
    pageState.currentBatchScriptType = backgroundTask.scriptType;

    // 使用新的任务恢复管理器
    const { taskRestoreManager } = await import('./taskRestoreManager.js');
    
    try {
        // 执行任务恢复
        const success = await taskRestoreManager.restoreTask(taskInstanceId, backgroundTask);
        
        if (success) {
            // 恢复成功后，不要立即删除后台任务
            // 任务应该继续在前台运行，只有在任务完成或被停止时才删除
            console.log(`[任务恢复] 任务 ${taskInstanceId} 恢复成功，任务继续在前台运行`);
            
            // 确保执行ID正确设置（从后台任务数据中恢复）
            if (backgroundTask.executionId && !window.__currentExecutionId) {
                window.__currentExecutionId = backgroundTask.executionId;
                console.log(`[任务恢复] 恢复执行ID: ${backgroundTask.executionId}`);
            }
            
            // 从后台任务列表中移除（因为现在在前台运行）
            backgroundTasks.delete(taskInstanceId);
            saveBackgroundTasksToStorage();
            updateBackgroundTaskIndicator();
            
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
async function stopBackgroundTaskFromPanel(taskInstanceId) {
    if (confirm('确定要停止这个后台任务吗？')) {
        const success = await stopBackgroundTask(taskInstanceId);
        if (success) {
            // 重新渲染后台任务列表
            renderBackgroundTasksList();
            updateBackgroundTaskIndicator();
        }
    }
}

// 将函数绑定到全局作用域，供HTML使用
window.resumeBackgroundTask = resumeBackgroundTask;
window.stopBackgroundTaskFromPanel = stopBackgroundTaskFromPanel;
window.navigateToModularTaskManager = navigateToModularTaskManager;

// 调试工具函数已移至 DebugTools 模块

/**
 * 初始化调试工具 (使用新的DebugTools模块)
 */
async function initDebugTools() {
    try {
        // 动态导入DebugTools模块
        const { default: DebugTools } = await import('./utils/DebugTools.js');
        
        // 调用静态初始化方法
        DebugTools.initDebugTools();
        console.log('[调试工具] DebugTools模块已初始化');
        
        // 设置兼容性函数
        window.debugBackgroundTasks = window.__debugBackgroundTasks;
        window.createTestBackgroundTask = window.__createTestBackgroundTask;
        window.clearAllTestTasks = window.__clearAllTestTasks;
        window.forceUpdateIndicator = window.__forceUpdateIndicator;
        window.testBackgroundTaskFlow = window.__testBackgroundTaskFlow;
        window.clearZombieTasks = window.__clearZombieTasks;
        window.forceCleanZombies = window.__forceCleanZombies;
        
        } catch (error) {
        console.error('[调试工具] DebugTools模块初始化失败:', error);
        console.log('[调试工具] 调试功能将不可用');
    }
}

// 测试函数已移至 DebugTools 模块

/**
 * 页面卸载处理（供导航系统调用）
 * 在页面切换时自动保存运行中的任务到后台
 */
export function onBatchScriptsPageUnload() {
    console.log('脚本插件页面卸载，清理资源...');
    window.__isBatchScriptsPageActive = false;
    
    // 清理全局pageState引用
    window.pageState = null;
    
    // 清理暴露的全局日志处理器
    window.globalLogEventHandler = null;
    window.globalScriptCompletedHandler = null;
    
    // 清理任务配置管理器
    if (taskConfigManager) {
        taskConfigManager.cleanup();
        taskConfigManager = null;
    }
    
    // 清理脚本执行管理器
    if (scriptExecutionManager) {
        scriptExecutionManager.cleanup();
        scriptExecutionManager = null;
    }

    // 移除由 addCompactTaskStyles 添加的特定样式
    const compactTaskStyles = document.getElementById('compact-task-styles');
    if (compactTaskStyles) {
        compactTaskStyles.remove();
        console.log('[BatchScripts] Compact task styles (ID: compact-task-styles) removed.');
    }

    // 清理全局监听器
    if (globalLogUnsubscriber) {
        try {
            globalLogUnsubscriber();
            globalLogUnsubscriber = null;
            console.log('[脚本插件] 全局日志监听器已卸载');
        } catch (e) {
            console.warn('[脚本插件] 卸载全局日志监听器失败:', e);
        }
    }
    if (globalCompletedUnsubscriber) {
        try {
            globalCompletedUnsubscriber();
            globalCompletedUnsubscriber = null;
            console.log('[脚本插件] 全局完成监听器已卸载');
        } catch (e) {
            console.warn('[脚本插件] 卸载全局完成监听器失败:', e);
        }
    }

    // 其他清理逻辑...
    cleanupResources(); 
    pageState.currentBatchScriptType = null;
    pageState.currentView = VIEW_MODES.CARDS;

    // 清理可能存在的计时器
    if (window.__executionTimer) {
        clearInterval(window.__executionTimer);
        window.__executionTimer = null;
    }
    if (window.__currentLogCleanup) {
        try {
            window.__currentLogCleanup();
            window.__currentLogCleanup = null;
        } catch (e) {
            console.warn('卸载页面时清理日志渲染器失败:', e);
        }
    }
    
    // 保存后台任务（如果需要）
    // saveBackgroundTasksToStorage(); // 取决于是否希望在页面切换时也保存
}

// 模块级别变量
let globalLogUnsubscriber = null;
let globalCompletedUnsubscriber = null;

function globalLogEventHandler(data) {
    if (!data) return;

    const activeTaskInstanceId = window.__currentTaskInstanceId;
    const activeExecutionId = window.__currentExecutionId;

    // 只在真正需要时修复中文乱码，避免破坏正常文本
    let originalMessage = data.message;
    let fixedMessage = originalMessage;
    
    // 只对包含特定中文乱码模式的消息进行修复
    if (typeof originalMessage === 'string' && /鑴氭湰|鎵ц|閰嶇疆|鍒濆鍖|姝ｅ湪|瀹屾垚|閽卞寘|鑾峰彇|鎴愬姛|澶辫触/.test(originalMessage)) {
        if (typeof window.__fixChineseText === 'function') {
            fixedMessage = window.__fixChineseText(originalMessage);
        }
    }

    // 日志是否属于当前在前台活动并显示UI的任务？
    // 检查视图模式时同时支持常量和字符串形式
    const isManagerView = pageState.currentView === VIEW_MODES.MANAGER || pageState.currentView === 'manager';
    if (data.executionId && activeExecutionId && data.executionId === activeExecutionId && 
        document.getElementById('taskLogContainer') && isManagerView) {
        try {
            const message = typeof fixedMessage === 'string' ? fixedMessage : JSON.stringify(fixedMessage);
            const level = data.level?.toLowerCase() || 'info';
            switch (level) {
                case 'success': TaskLogger.logSuccess(message); break;
                case 'warning': case 'warn': TaskLogger.logWarning(message); break;
                case 'error': TaskLogger.logError(message); break;
                default: TaskLogger.logInfo(message);
            }
        } catch (e) {
            console.error('[脚本插件日志] 处理前台日志失败:', e);
        }
    } else if (data.executionId) {
        // 日志属于其他执行ID，检查是否是后台任务
        const task = Array.from(backgroundTasks.values()).find(t => t.executionId === data.executionId);
        if (task) {
            if (!task.logHistory) {
                task.logHistory = [];
            }
            task.logHistory.push({
                level: data.level || 'info',
                message: fixedMessage, // 使用修复后的消息
                originalMessage: originalMessage, // 保留原始消息用于调试
                timestamp: data.timestamp || new Date().toISOString(),
                executionId: data.executionId
            });
            if (task.logHistory.length > 200) {
                task.logHistory.shift();
            }
            // 仅在调试模式或特殊情况下打印后台日志，避免控制台输出过多
            // console.log(`[后台日志] 记录到任务 ${task.taskInstanceId} (ExecID: ${data.executionId}): ${String(fixedMessage).substring(0,50)}...`);
        } else {
             console.log(`[脚本插件] 收到孤立日志 (ExecID: ${data.executionId}), 忽略.`);
        }
    }
}

function globalScriptCompletedHandler(data) {
    if (!data || !data.executionId) return;

    console.log('[全局脚本完成事件]', data);

    const activeTaskInstanceId = window.__currentTaskInstanceId;
    const activeExecutionId = window.__currentExecutionId;
    const startButton = document.getElementById('start-execution-btn'); // 尝试获取开始按钮

    const isManagerView = pageState.currentView === VIEW_MODES.MANAGER || pageState.currentView === 'manager';
    if (activeExecutionId && data.executionId === activeExecutionId && isManagerView) {
        TaskLogger.logSuccess('✅ 脚本插件执行完成！');
        if (data.summary) {
            TaskLogger.logInfo(`📊 执行总结:`);
            TaskLogger.logInfo(`   - 总账户数: ${data.summary.totalAccounts || 0}`);
            TaskLogger.logInfo(`   - 成功: ${data.summary.successCount || 0}`);
            TaskLogger.logInfo(`   - 失败: ${data.summary.failedCount || 0}`);
            TaskLogger.logInfo(`   - 耗时: ${data.summary.duration || '未知'}`);
            const successCountEl = document.getElementById('successCount');
            if (successCountEl) successCountEl.textContent = data.summary.successCount || 0;
            const failCountEl = document.getElementById('failCount');
            if (failCountEl) failCountEl.textContent = data.summary.failedCount || 0;
        }

        if (window.__executionTimer) {
            clearInterval(window.__executionTimer);
            window.__executionTimer = null;
        }
        
        window.__currentExecutionId = null; // 清理当前执行ID
        // window.__currentTaskInstanceId 通常在返回卡片页时清理，或在任务完全结束时
        window.__startTime = null;

        const statusText = document.getElementById('statusText');
        if (statusText) {
            statusText.textContent = '已完成';
            statusText.style.color = '#27ae60';
        }
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) stopBtn.style.display = 'none';
        
        if (startButton) {
            startButton.disabled = false;
            startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        }
    }

    const taskToRemoveEntry = Array.from(backgroundTasks.entries()).find(([taskId, task]) => task.executionId === data.executionId);
    if (taskToRemoveEntry) {
        backgroundTasks.delete(taskToRemoveEntry[0]);
        saveBackgroundTasksToStorage();
        updateBackgroundTaskIndicator();
        console.log(`[后台任务] 任务 ${taskToRemoveEntry[0]} (ExecID: ${data.executionId}) 执行完成，已从后台列表移除`);
    }
    
    // 如果完成的脚本是当前UI正在显示的脚本，确保开始按钮被重置
    // (即使它不是后台任务，但在前台完成了)
    if (pageState.currentBatchScriptType && 
        batchTaskConfigs[window.__currentTaskInstanceId]?.scriptTypeId === pageState.currentBatchScriptType.id &&
        window.__currentTaskInstanceId?.includes(data.executionId) && // 这是一个不太可靠的检查，最好是直接比较 taskInstanceId
        startButton && isManagerView) {
        
        // 再次检查 executionId，因为上面可能已置null
        if (window.__currentExecutionId_completed_check === data.executionId) { // 使用一个临时变量来避免覆盖
             if (startButton) {
                startButton.disabled = false;
                startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
             }
             window.__currentExecutionId_completed_check = null; // 清理临时变量
        }
    }
    // 保存当前执行ID用于检查，以防它在回调中被修改
    window.__currentExecutionId_completed_check = activeExecutionId;
}