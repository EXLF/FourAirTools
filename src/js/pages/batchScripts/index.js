/**
 * 脚本插件管理页面 - 主模块
 * 负责页面初始化、脚本列表管理和核心交互逻辑
 * 
 * 架构说明：
 * - 本文件为主入口，负责协调各个功能模块
 * - 具体功能已拆分到专门的管理器模块中
 * - 保持向后兼容性，支持旧版本代码调用
 */

// ============================================================================
// 模块导入
// ============================================================================

// 基础设施模块（服务层重构）
import { ApiClient } from './infrastructure/ApiClient.js';
import { ErrorHandler } from './infrastructure/ErrorHandler.js';
import { CacheManager } from './infrastructure/CacheManager.js';
import { FeatureFlags, isFeatureEnabled, safeExecuteAsyncWithFallback } from './infrastructure/types.js';

// Repository模块（服务层重构）
import { BaseRepository, RepositoryFactory } from './repositories/BaseRepository.js';
import { ScriptRepository } from './repositories/ScriptRepository.js';
import { WalletRepository } from './repositories/WalletRepository.js';

// Service模块（服务层重构）
import { ScriptService } from './services/ScriptService.js';
import { TaskService, TaskState } from './services/TaskService.js';

// 基础组件导入
import { showModal } from '../../components/modal.js';
import { translateLocation } from '../../utils/locationTranslator.js';
import { BatchTaskManager } from './batchTaskManager.js';
import { TaskLogger } from './logger.js';

// 配置和工具模块
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

// 功能管理器模块
import { setupGlobalChineseTextFix } from './utils/ChineseTextFixer.js';
import { setupGlobalBackgroundTaskManager } from './utils/BackgroundTaskManager.js';
import { setupGlobalTaskConfigManager } from './utils/TaskConfigManager.js';
import { setupGlobalScriptExecutionManager } from './utils/ScriptExecutionManager.js';
import { setupGlobalScriptStopManager } from './utils/ScriptStopManager.js';
import { setupGlobalUIEventManager } from './utils/UIEventManager.js';
import { setupGlobalStyleManager } from './utils/StyleManager.js';
import { OptimizationUtils } from './utils/OptimizationUtils.js';

// ============================================================================
// 全局状态和变量
// ============================================================================

// 页面状态管理
const pageState = {
    contentAreaRef: null,
    currentView: VIEW_MODES.CARDS,
    currentBatchScriptType: null,
    walletGroupManager: new WalletGroupManager(),
    proxyManager: new ProxyManager()
};

// 基础设施实例（服务层重构）
let infrastructureServices = null;
let repositoryFactory = null;

// 核心管理器实例
let coreManagers = null;
let ScriptManager, TaskStateManager, ExecutionEngine, LogManager;

// 功能管理器实例
let backgroundTaskManager = null;
let taskConfigManager = null;
let scriptExecutionManager = null;
let scriptStopManager = null;
let uiEventManager = null;
let styleManager = null;

// 后台任务兼容性变量
let backgroundTasks = null;
let saveBackgroundTasksToStorage = null;
let updateBackgroundTaskIndicator = null;
let toggleBackgroundTasksPanel = null;
let renderBackgroundTasksList = null;

// 全局事件监听器
let globalLogUnsubscriber = null;
let globalCompletedUnsubscriber = null;

// ============================================================================
// 功能管理器初始化
// ============================================================================

/**
 * 初始化基础设施服务（服务层重构 - 第1步）
 */
async function initInfrastructureServices() {
    if (infrastructureServices) {
        console.log('[基础设施] 已初始化，跳过重复初始化');
        return infrastructureServices;
    }

    try {
        console.log('[基础设施] 开始初始化核心服务...');
        
        // 创建基础设施实例但不立即使用
        const apiClient = new ApiClient();
        const errorHandler = new ErrorHandler();
        const cacheManager = new CacheManager();
        
        infrastructureServices = {
            apiClient,
            errorHandler,
            cacheManager
        };
        
        // 初始化Repository工厂
        repositoryFactory = new RepositoryFactory();
        
        // 创建ScriptRepository实例
        const scriptRepository = repositoryFactory.createRepository(
            'ScriptRepository',
            ScriptRepository,
            {
                apiClient,
                errorHandler,
                cacheManager
            }
        );
        
        // 创建WalletRepository实例
        const walletRepository = repositoryFactory.createRepository(
            'WalletRepository',
            WalletRepository,
            {
                apiClient,
                errorHandler,
                cacheManager
            }
        );
        
        // 创建ScriptService实例
        const scriptService = new ScriptService({
            scriptRepository
        });
        
        // 创建TaskService实例 (服务层重构 - 第8步)
        const taskService = new TaskService({
            scriptService,
            maxConcurrentTasks: 3,
            enableTaskPriority: true,
            enableBackgroundTasks: true
        });
        
        // 集成TaskService到BatchTaskManager (服务层重构 - 第8步)
        try {
            // 获取或创建BatchTaskManager实例
            let batchTaskManager = window.__FA_BatchTaskManager;
            if (!batchTaskManager && window.BatchTaskManager) {
                batchTaskManager = new window.BatchTaskManager();
            }
            
            if (batchTaskManager && batchTaskManager.setTaskService) {
                batchTaskManager.setTaskService(taskService);
                taskService.batchTaskManager = batchTaskManager; // 双向绑定
                console.log('[基础设施] TaskService与BatchTaskManager集成完成');
            } else {
                console.warn('[基础设施] BatchTaskManager未找到，TaskService将独立运行');
            }
        } catch (error) {
            console.warn('[基础设施] TaskService集成失败:', error);
        }
        
        // 将Service添加到基础设施中
        infrastructureServices.scriptService = scriptService;
        infrastructureServices.taskService = taskService;
        
        // 演示功能已移除，重构完成
        
        // 暴露到全局用于调试和统计
        if (typeof window !== 'undefined') {
            window.__FA_Infrastructure = infrastructureServices;
            window.__FA_RepositoryFactory = repositoryFactory;
            window.__FA_FeatureFlags = FeatureFlags;
            
            // 调试方法已在全局初始化时定义，这里只做覆盖检查
            if (!window.FA_enableAllNewFeatures) {
                console.warn('[基础设施] 全局调试函数未正确初始化');
            }
            
            window.FA_getInfraStats = () => {
                return {
                    apiClient: apiClient.getStats(),
                    errorHandler: errorHandler.getStats(),
                    cacheManager: cacheManager.getStats(),
                    repositories: repositoryFactory ? repositoryFactory.getAllStats() : {},
                    featureFlags: Object.fromEntries(
                        Object.entries(FeatureFlags).map(([key, flag]) => [
                            key, 
                            isFeatureEnabled(flag)
                        ])
                    )
                };
            };
            
            // 测试基础设施功能
            window.FA_testInfrastructure = async () => {
                console.log('🧪 开始测试基础设施功能...');
                
                try {
                    // 测试缓存
                    cacheManager.set('test_key', 'test_value', 1000);
                    const cached = cacheManager.get('test_key');
                    console.log('✅ 缓存测试:', cached === 'test_value' ? '通过' : '失败');
                    
                    // 测试错误处理
                    const testError = new Error('测试错误');
                    const handledError = errorHandler.handleApiError(testError, 'test', 'testMethod', []);
                    console.log('✅ 错误处理测试:', handledError.type ? '通过' : '失败');
                    
                    // 测试ApiClient（如果可用）
                    if (window.scriptAPI) {
                        console.log('📡 测试 ApiClient...');
                        // 这里不实际调用，只是验证方法存在
                        console.log('✅ ApiClient 方法检查:', typeof apiClient.getAllScripts === 'function' ? '通过' : '失败');
                    }
                    
                    console.log('🎉 基础设施测试完成！');
                    return true;
                } catch (error) {
                    console.error('❌ 基础设施测试失败:', error);
                    return false;
                }
            };
        }
        
        console.log('[基础设施] 初始化完成 ✅');
        return infrastructureServices;
        
    } catch (error) {
        console.error('[基础设施] 初始化失败:', error);
        infrastructureServices = null;
        return null;
    }
}



/**
 * 初始化中文乱码修复功能
 */
function setupChineseTextFix() {
    setupGlobalChineseTextFix();
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
        // 动态导入核心模块
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
        
        // 创建核心管理器实例
        const taskStateManager = new TaskStateManager();
        const logManager = new LogManager();
        const executionEngine = new ExecutionEngine(taskStateManager);
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
        
        // 暴露到全局
        if (typeof window !== 'undefined') {
            window.__FA_CoreManagers = coreManagers;
            window.__FA_ActiveLogManager = logManager;
            console.log('✨ 脚本插件模块重构完成!');
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

// ============================================================================
// 核心管理器初始化
// ============================================================================

/**
 * 初始化后台任务管理器
 */
function initGlobalBackgroundTaskManager() {
    if (!backgroundTaskManager) {
        backgroundTaskManager = setupGlobalBackgroundTaskManager();
        console.log('[后台任务] BackgroundTaskManager模块已初始化');
        
        // 设置兼容性变量
        backgroundTasks = window.__FABackgroundTasks;
        saveBackgroundTasksToStorage = window.FABackgroundTaskManager?.saveToStorage;
        updateBackgroundTaskIndicator = window.FABackgroundTaskManager?.updateIndicator;
        toggleBackgroundTasksPanel = window.toggleBackgroundTasksPanel;
        renderBackgroundTasksList = window.renderBackgroundTasksList;
    }
}

/**
 * 初始化任务配置管理器
 */
function initGlobalTaskConfigManager() {
    if (!taskConfigManager) {
        taskConfigManager = setupGlobalTaskConfigManager(pageState);
        console.log('[任务配置] TaskConfigManager模块已初始化');
    }
}

/**
 * 初始化脚本执行管理器
 */
/**
 * 初始化脚本执行管理器（服务层重构 - 第9步）
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
        
        // 获取Service层实例（服务层重构 - 第9步）
        const serviceOptions = {};
        if (window.FA_ScriptService) {
            serviceOptions.scriptService = window.FA_ScriptService;
            console.log('[脚本执行] 🔗 集成 ScriptService');
        }
        if (window.FA_TaskService) {
            serviceOptions.taskService = window.FA_TaskService;
            console.log('[脚本执行] 🔗 集成 TaskService');
        }
        
        scriptExecutionManager = setupGlobalScriptExecutionManager(
            pageState, 
            backgroundTasks, 
            backgroundTaskHelpers, 
            taskConfigManager,
            serviceOptions
        );
        
        console.log('[脚本执行] ScriptExecutionManager模块已初始化 (Service层集成)');
        
        // 如果Service还没初始化，设置延迟集成
        if (!serviceOptions.scriptService || !serviceOptions.taskService) {
            setTimeout(() => {
                const delayedServices = {};
                if (!serviceOptions.scriptService && window.FA_ScriptService) {
                    delayedServices.scriptService = window.FA_ScriptService;
                }
                if (!serviceOptions.taskService && window.FA_TaskService) {
                    delayedServices.taskService = window.FA_TaskService;
                }
                
                if (Object.keys(delayedServices).length > 0) {
                    if (window.__setScriptExecutionServices) {
                        window.__setScriptExecutionServices(
                            delayedServices.scriptService || serviceOptions.scriptService,
                            delayedServices.taskService || serviceOptions.taskService
                        );
                        console.log('[脚本执行] ⏰ 延迟Service层集成完成:', Object.keys(delayedServices));
                    }
                }
            }, 2000);
        }
    }
}

/**
 * 初始化脚本停止管理器
 */
function initGlobalScriptStopManager() {
    if (!scriptStopManager) {
        scriptStopManager = setupGlobalScriptStopManager();
        console.log('[脚本停止] ScriptStopManager模块已初始化');
    }
}

/**
 * 初始化UI事件管理器
 */
function initGlobalUIEventManager() {
    if (!uiEventManager) {
        uiEventManager = setupGlobalUIEventManager(pageState);
        console.log('[UI事件] UIEventManager模块已初始化');
    }
}

/**
 * 初始化样式管理器
 */
function initGlobalStyleManager() {
    if (!styleManager) {
        styleManager = setupGlobalStyleManager();
        console.log('[样式管理] StyleManager模块已初始化');
    }
}

/**
 * 初始化调试工具
 */
async function initDebugTools() {
    try {
        const { default: DebugTools } = await import('./utils/DebugTools.js');
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
    }
}

/**
 * 初始化优化工具
 */
function initOptimizationTools() {
    try {
        // 优化工具已在模块导入时自动注册到全局
        console.log('[优化工具] OptimizationUtils模块已初始化');
        
        // 设置定期自动优化（可选）
        if (isFeatureEnabled('fa_auto_optimization')) {
            setInterval(() => {
                OptimizationUtils.performFullOptimization();
            }, 30 * 60 * 1000); // 30分钟自动优化一次
            
            console.log('[优化工具] 自动优化已启用（30分钟间隔）');
        }
        
        // 暴露快捷优化函数
        window.FA_quickOptimize = async () => {
            console.log('🚀 执行快速优化...');
            const results = await OptimizationUtils.performFullOptimization();
            console.log('✅ 快速优化完成:', results);
            return results;
        };
        
    } catch (error) {
        console.error('[优化工具] OptimizationUtils模块初始化失败:', error);
    }
}



// ============================================================================
// 主要功能函数
// ============================================================================

// 页面加载时立即初始化后台任务管理器和基础设施
if (typeof window !== 'undefined') {
    initGlobalBackgroundTaskManager();
    
    // 立即暴露全局调试函数（不依赖基础设施初始化）
    window.FA_enableAllNewFeatures = () => {
        const flags = [
            'fa_use_script_repository',
            'fa_use_script_service', 
            'fa_use_api_cache',
            'fa_enable_api_retry',
            'fa_use_task_service',
            'fa_use_wallet_repo',
            'fa_debug_services'
        ];
        
        flags.forEach(flag => {
            localStorage.setItem(flag, 'true');
        });
        
        console.log('✅ 所有新特性已启用，刷新页面生效');
        console.log('🔄 请刷新页面查看效果：location.reload()');
    };
    
    window.FA_disableAllNewFeatures = () => {
        const flags = [
            'fa_use_script_repository',
            'fa_use_script_service', 
            'fa_use_api_cache',
            'fa_enable_api_retry',
            'fa_use_task_service',
            'fa_use_wallet_repo',
            'fa_debug_services'
        ];
        
        flags.forEach(flag => {
            localStorage.setItem(flag, 'false');
        });
        
        console.log('❌ 所有新特性已禁用，刷新页面生效');
        console.log('🔄 请刷新页面查看效果：location.reload()');
    };
    
    window.FA_enableRepository = () => {
        localStorage.setItem('fa_use_script_repository', 'true');
        console.log('✅ Repository层已启用，刷新页面生效');
        console.log('🔄 请刷新页面并进入脚本插件页面查看效果');
    };
    
    window.FA_getFeatureStatus = () => {
        const flags = [
            'fa_use_script_repository',
            'fa_use_script_service', 
            'fa_use_api_cache',
            'fa_enable_api_retry'
        ];
        
        const status = {};
        flags.forEach(flag => {
            status[flag] = localStorage.getItem(flag) === 'true';
        });
        
        console.table(status);
        return status;
    };
    
    // 立即初始化基础设施并暴露全局调试函数
    (async () => {
        try {
            const infraServices = await initInfrastructureServices();
            console.log('[全局初始化] 基础设施服务已就绪');
        } catch (error) {
            console.error('[全局初始化] 基础设施初始化失败:', error);
        }
    })();
}

/**
 * 初始化脚本插件管理页面
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export async function initBatchScriptsPage(contentArea) {
    console.log("初始化脚本插件管理页面...");
    
    // 设置页面状态
    pageState.contentAreaRef = contentArea;
    window.__isBatchScriptsPageActive = true;
    window.pageState = pageState;
    
    // 初始化基础设施服务（服务层重构）
    console.log('[脚本插件] 开始初始化基础设施...');
    const infraResult = await initInfrastructureServices();
    console.log('[脚本插件] 基础设施初始化结果:', infraResult ? '成功' : '失败');
    
    // 立即启用中文乱码修复功能
    setupChineseTextFix();
    
    // 初始化核心管理器
    console.log('[脚本插件] 开始初始化核心管理器...');
    const initSuccess = await initCoreManagers();
    console.log('[脚本插件] 核心管理器初始化结果:', initSuccess);
    
    // 初始化所有功能管理器
    initGlobalBackgroundTaskManager();
    initGlobalTaskConfigManager();
    initGlobalScriptExecutionManager();
    initGlobalScriptStopManager();
    initGlobalUIEventManager();
    initGlobalStyleManager();
    initDebugTools();
    initOptimizationTools();
    
    // 立即加载样式
    if (styleManager) {
        styleManager.addCompactTaskStyles();
    } else if (typeof window.addCompactTaskStyles === 'function') {
        window.addCompactTaskStyles();
    }
    
    // 恢复后台任务状态
    if (window.FABackgroundTaskManager) {
        window.FABackgroundTaskManager.loadFromStorage();
        console.log('[后台任务] 从全局管理器恢复任务状态');
    }
    
    // 渲染主界面
    renderBatchScriptCardsView(contentArea);
    
    // 初始化时检查后台任务指示器
    setTimeout(() => {
        updateBackgroundTaskIndicator();
        if (window.forceUpdateIndicator) {
            window.forceUpdateIndicator();
        }
    }, 100);

    // 注册全局IPC监听器
    if (globalLogUnsubscriber) globalLogUnsubscriber();
    if (globalCompletedUnsubscriber) globalCompletedUnsubscriber();

    // 暴露全局日志处理器
    window.globalLogEventHandler = globalLogEventHandler;
    window.globalScriptCompletedHandler = globalScriptCompletedHandler;

    if (window.scriptAPI) {
        console.log('[脚本插件] 使用 scriptAPI 注册全局监听器');
        globalLogUnsubscriber = window.scriptAPI.onLog(globalLogEventHandler);
        globalCompletedUnsubscriber = window.scriptAPI.onScriptCompleted(globalScriptCompletedHandler);
    } else if (window.electron && window.electron.ipcRenderer) {
        console.log('[脚本插件] 使用 ipcRenderer 注册全局监听器');
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
                // 优先使用ScriptService处理同步
                let syncHandled = false;
                if (isFeatureEnabled('fa_use_script_service') && infrastructureServices && infrastructureServices.scriptService) {
                    try {
                        console.log('[脚本插件] 🚀 使用 ScriptService 处理同步...');
                        const result = await infrastructureServices.scriptService.syncScripts();
                        
                        if (result.success) {
                            console.log('[脚本插件] ✅ ScriptService 同步成功');
                            const syncData = result.data;
                            
                            // 显示友好的用户反馈
                            if (syncData.deletedCount > 0) {
                                console.log(`已清理 ${syncData.deletedCount} 个无效脚本`);
                            } else {
                                console.log('脚本列表已是最新状态');
                            }
                            
                            syncHandled = true;
                        } else {
                            console.warn('[脚本插件] ⚠️ ScriptService 同步失败，回退到原始方式:', result.error);
                        }
                    } catch (serviceError) {
                        console.warn('[脚本插件] ⚠️ ScriptService 处理失败，回退到原始方式:', serviceError);
                    }
                }
                
                // 回退方案：使用原始API
                if (!syncHandled && window.scriptAPI && typeof window.scriptAPI.syncScripts === 'function') {
                    console.log('[脚本插件] 🔄 使用原始 API 处理同步...');
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
 * 加载并渲染脚本插件卡片 (新版本 - 使用ScriptService)
 * @param {HTMLElement} pageContentArea - 卡片页面的内容区域
 * @param {Object} options - 加载选项
 */
async function loadAndRenderBatchScriptCardsV2(pageContentArea, options = {}) {
    const cardsContainer = pageContentArea.querySelector('#batchScriptCardsContainer');
    const statusFilterElement = pageContentArea.querySelector('#batchScriptStatusFilter');
    
    if (!cardsContainer) {
        console.error('[脚本加载V2] 卡片容器 #batchScriptCardsContainer 未找到');
        return;
    }
    
    cardsContainer.innerHTML = '';
    
    try {
        console.log('[脚本加载V2] 🚀 使用 ScriptService 加载脚本列表...');
        
        // 使用ScriptService获取脚本列表
        const scriptService = infrastructureServices?.scriptService || new (await import('./services/ScriptService.js')).ScriptService();
        const result = await scriptService.getAvailableScripts({
            sortBy: options.sortBy || 'name',
            includeDisabled: options.includeDisabled || false,
            filterCategory: options.filterCategory,
            searchQuery: options.searchQuery,
            forceRefresh: options.forceRefresh || false
        });
        
        if (!result.success) {
            throw new Error(`ScriptService 返回错误: ${result.error?.message || '未知错误'}`);
        }
        
        const scriptsList = result.data.scripts || [];
        const metadata = {
            totalCount: result.data.totalCount || scriptsList.length,
            availableCount: result.data.availableCount || scriptsList.length,
            categories: result.data.categories || [],
            loadTime: Date.now(),
            source: 'ScriptService'
        };
        
        console.log(`[脚本加载V2] ✅ 通过 ScriptService 加载成功: ${scriptsList.length} 个脚本`);
        console.log(`[脚本加载V2] 📊 元数据:`, metadata);
        
        // 渲染脚本卡片
        renderScriptCards(cardsContainer, scriptsList, (scriptData) => {
            pageState.currentBatchScriptType = scriptData;
            const taskInstanceId = `task_${scriptData.id}_${Date.now()}`;
            navigateToModularTaskManager(taskInstanceId);
        });
        
        // 更新筛选器选项
        populateFilters(statusFilterElement, scriptsList);
        
        // 显示加载统计信息
        showLoadingStats(metadata);
        
        return {
            success: true,
            scripts: scriptsList,
            metadata
        };
        
    } catch (error) {
        console.error('[脚本加载V2] ❌ ScriptService 加载失败:', error);
        
        // 回退到原始版本
        console.log('[脚本加载V2] 🔄 回退到原始加载方式...');
        return loadAndRenderBatchScriptCardsV1(pageContentArea, options);
    }
}

/**
 * 加载并渲染脚本插件卡片 (回退版本 - 当Service层不可用时使用)
 * @param {HTMLElement} pageContentArea - 卡片页面的内容区域
 * @param {Object} options - 加载选项
 */
async function loadAndRenderBatchScriptCardsFallback(pageContentArea, options = {}) {
    const cardsContainer = pageContentArea.querySelector('#batchScriptCardsContainer');
    const statusFilterElement = pageContentArea.querySelector('#batchScriptStatusFilter');
    
    if (!cardsContainer) {
        console.error('[脚本加载回退] 卡片容器 #batchScriptCardsContainer 未找到');
        return;
    }
    
    cardsContainer.innerHTML = '';
    console.log('[脚本加载回退] Service层不可用，使用基础API');
    
    let scriptsList = [];
    
    // 尝试使用原有的直接API调用
    if (window.scriptAPI && typeof window.scriptAPI.getAllScripts === 'function') {
        try {
            const result = await window.scriptAPI.getAllScripts();
            if (result.success && Array.isArray(result.data)) {
                scriptsList = result.data.map(s => ({
                    ...s,
                    status: s.status || 'active',
                    category: s.category || ''
                }));
                console.log('[脚本加载回退] 通过原有API加载的脚本数据:', scriptsList);
            } else {
                console.error('[脚本加载回退] 获取脚本列表失败:', result.error);
            }
        } catch (error) {
            console.error('[脚本加载回退] 调用 getAllScripts 时出错:', error);
        }
    } else {
        console.warn('[脚本加载回退] scriptAPI 未定义，使用静态脚本类型列表');
        scriptsList = batchScriptTypes;
    }

    // 渲染脚本卡片
    renderScriptCards(cardsContainer, scriptsList, (scriptData) => {
        pageState.currentBatchScriptType = scriptData;
        const taskInstanceId = `task_${scriptData.id}_${Date.now()}`;
        navigateToModularTaskManager(taskInstanceId);
    });
    
    // 更新筛选器选项
    populateFilters(statusFilterElement, scriptsList);
    
    return {
        success: true,
        scripts: scriptsList,
        metadata: {
            totalCount: scriptsList.length,
            source: 'Fallback API'
        }
    };
}

/**
 * 加载并渲染脚本插件卡片 (主入口函数)
 * 重构完成后默认使用Service层，仅在不可用时回退
 * @param {HTMLElement} pageContentArea - 卡片页面的内容区域
 * @param {Object} options - 加载选项
 */
async function loadAndRenderBatchScriptCards(pageContentArea, options = {}) {
    // 优先使用Service层 (重构完成后的默认选择)
    if (infrastructureServices?.scriptService) {
        console.log('[脚本加载] 🚀 使用 ScriptService (重构版本)');
        return loadAndRenderBatchScriptCardsV2(pageContentArea, options);
    } else {
        console.warn('[脚本加载] ⚠️ ScriptService 不可用，使用回退方案');
        return loadAndRenderBatchScriptCardsFallback(pageContentArea, options);
    }
}

/**
 * 显示加载统计信息
 * @param {Object} metadata - 加载元数据
 */
function showLoadingStats(metadata) {
    if (!metadata) return;
    
    console.log(`📊 [脚本加载统计] 来源: ${metadata.source}`);
    console.log(`📊 [脚本加载统计] 总脚本: ${metadata.totalCount}`);
    console.log(`📊 [脚本加载统计] 可用脚本: ${metadata.availableCount}`);
    console.log(`📊 [脚本加载统计] 类别数: ${metadata.categories?.length || 0}`);
    console.log(`📊 [脚本加载统计] 加载时间: ${new Date(metadata.loadTime).toLocaleTimeString()}`);
    
    // 可以在这里添加UI通知
    if (typeof window.showToast === 'function') {
        window.showToast(`已加载 ${metadata.totalCount} 个脚本 (来源: ${metadata.source})`, 'success');
    }
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
    
    // 添加必要的样式（使用新的样式管理器）
    if (styleManager) {
        styleManager.addCompactTaskStyles();
    } else {
        // 备用方案：直接调用全局函数（向后兼容）
        if (typeof window.addCompactTaskStyles === 'function') {
            window.addCompactTaskStyles();
        }
    }
}

/**
 * 为模块化管理器绑定事件
 * @param {string} taskInstanceId - 当前配置的任务实例的唯一ID
 */
function bindModularManagerEvents(taskInstanceId) {
    const managerPage = pageState.contentAreaRef.querySelector('.batch-task-container');
    if (!managerPage) {
        console.error("[脚本插件] Batch task container not found");
        return;
    }

    // 使用新的UIEventManager模块绑定UI事件
    if (uiEventManager) {
        const dependencies = {
            saveCurrentModuleData: (taskId) => {
                if (taskConfigManager) {
                    return taskConfigManager.saveCurrentModuleData(taskId);
                } else {
                    console.warn('[脚本插件] TaskConfigManager 未初始化');
                    return null;
                }
            },
            moveTaskToBackground: window.moveTaskToBackground,
            cleanupResources: window.cleanupResources,
            renderBatchScriptCardsView: renderBatchScriptCardsView,
            handleStartExecution: window.handleStartExecution,
            switchToConfigStage: window.switchToConfigStage
        };
        
        uiEventManager.bindAllUIEvents(taskInstanceId, managerPage, dependencies);
    } else {
        console.warn('[脚本插件] UIEventManager 未初始化，UI事件绑定不可用');
    }

    // 停止执行按钮 - 使用新的ScriptStopManager模块
    if (scriptStopManager) {
        scriptStopManager.bindStopButtonEvent(taskInstanceId, managerPage);
    } else {
        console.warn('[脚本插件] ScriptStopManager 未初始化，停止功能不可用');
    }
}

// ============================================================================
// 后台任务相关功能
// ============================================================================

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

// ============================================================================
// 全局函数绑定
// ============================================================================

// 将函数绑定到全局作用域，供HTML使用
window.resumeBackgroundTask = resumeBackgroundTask;
window.stopBackgroundTaskFromPanel = stopBackgroundTaskFromPanel;
window.navigateToModularTaskManager = navigateToModularTaskManager;

// ============================================================================
// 页面卸载和清理
// ============================================================================

/**
 * 页面卸载处理（第10步优化）
 */
export function onBatchScriptsPageUnload() {
    console.log('🧹 脚本插件页面卸载，开始清理资源...');
    
    // 使用优化工具进行系统级清理
    const cleanupResults = {
        managers: 0,
        listeners: 0,
        timers: 0,
        memory: 0
    };
    
    try {
        // 1. 标记页面为非活动状态
        window.__isBatchScriptsPageActive = false;
        
        // 2. 清理管理器实例
        const managers = [
            { name: '任务配置', instance: taskConfigManager, cleanup: () => taskConfigManager?.cleanup() },
            { name: '脚本执行', instance: scriptExecutionManager, cleanup: () => scriptExecutionManager?.cleanup() },
            { name: '脚本停止', instance: scriptStopManager, cleanup: () => scriptStopManager?.cleanup() },
            { name: 'UI事件', instance: uiEventManager, cleanup: () => uiEventManager?.cleanup() },
            { name: '样式管理', instance: styleManager, cleanup: () => styleManager?.cleanup() }
        ];
        
        managers.forEach(({ name, instance, cleanup }) => {
            if (instance) {
                try {
                    cleanup();
                    cleanupResults.managers++;
                    console.log(`✅ [${name}] 管理器已清理`);
                } catch (error) {
                    console.warn(`⚠️ [${name}] 管理器清理失败:`, error);
                }
            }
        });
        
        // 3. 清理全局监听器
        const listeners = [
            { name: '日志监听器', unsubscriber: globalLogUnsubscriber },
            { name: '完成监听器', unsubscriber: globalCompletedUnsubscriber }
        ];
        
        listeners.forEach(({ name, unsubscriber }) => {
            if (unsubscriber) {
                try {
                    unsubscriber();
                    cleanupResults.listeners++;
                    console.log(`✅ [${name}] 已卸载`);
                } catch (e) {
                    console.warn(`⚠️ [${name}] 卸载失败:`, e);
                }
            }
        });
        
        // 4. 清理计时器和资源
        const timers = ['__executionTimer', '__zombieCheckTimer', '__optimizationTimer'];
        timers.forEach(timerName => {
            if (window[timerName]) {
                try {
                    clearInterval(window[timerName]);
                    window[timerName] = null;
                    cleanupResults.timers++;
                } catch (e) {
                    console.warn(`⚠️ 清理计时器失败: ${timerName}`, e);
                }
            }
        });
        
        // 5. 使用优化工具进行深度清理
        if (window.FA_OptimizationUtils) {
            try {
                const memoryResults = OptimizationUtils.MemoryManager.cleanupGlobalVariables();
                OptimizationUtils.MemoryManager.cleanupEventListeners();
                cleanupResults.memory = memoryResults;
                console.log('✅ 优化工具清理完成');
            } catch (error) {
                console.warn('⚠️ 优化工具清理失败:', error);
            }
        }
        
        // 6. 重置状态变量
        globalLogUnsubscriber = null;
        globalCompletedUnsubscriber = null;
        taskConfigManager = null;
        scriptExecutionManager = null;
        scriptStopManager = null;
        uiEventManager = null;
        styleManager = null;
        
        // 7. 清理页面状态
        if (pageState) {
            pageState.currentBatchScriptType = null;
            pageState.currentView = VIEW_MODES.CARDS;
        }
        window.pageState = null;
        window.globalLogEventHandler = null;
        window.globalScriptCompletedHandler = null;
        
        // 8. 清理资源
        if (typeof cleanupResources === 'function') {
            cleanupResources();
        }
        
        // 9. 特殊清理
        if (window.__currentLogCleanup) {
            try {
                window.__currentLogCleanup();
                window.__currentLogCleanup = null;
            } catch (e) {
                console.warn('⚠️ 日志渲染器清理失败:', e);
            }
        }
        
        console.log('✅ 页面卸载完成，清理统计:', cleanupResults);
        
    } catch (error) {
        console.error('❌ 页面卸载过程中出现错误:', error);
    }
}

// ============================================================================
// 全局事件处理器
// ============================================================================

function globalLogEventHandler(data) {
    if (!data) return;

    const activeTaskInstanceId = window.__currentTaskInstanceId;
    const activeExecutionId = window.__currentExecutionId;

    // 中文乱码修复
    let originalMessage = data.message;
    let fixedMessage = originalMessage;
    
    if (typeof originalMessage === 'string' && /鑴氭湰|鎵ц|閰嶇疆|鍒濆鍖|姝ｅ湪|瀹屾垚|閽卞寘|鑾峰彇|鎴愬姛|澶辫触/.test(originalMessage)) {
        if (typeof window.__fixChineseText === 'function') {
            fixedMessage = window.__fixChineseText(originalMessage);
        }
    }

    // 处理前台日志
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
        // 处理后台日志
        const task = Array.from(backgroundTasks.values()).find(t => t.executionId === data.executionId);
        if (task) {
            if (!task.logHistory) {
                task.logHistory = [];
            }
            task.logHistory.push({
                level: data.level || 'info',
                message: fixedMessage,
                originalMessage: originalMessage,
                timestamp: data.timestamp || new Date().toISOString(),
                executionId: data.executionId
            });
            if (task.logHistory.length > 200) {
                task.logHistory.shift();
            }
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
    const startButton = document.getElementById('start-execution-btn');

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
        
        window.__currentExecutionId = null;
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

    // 处理后台任务完成
    const taskToRemoveEntry = Array.from(backgroundTasks.entries()).find(([taskId, task]) => task.executionId === data.executionId);
    if (taskToRemoveEntry) {
        backgroundTasks.delete(taskToRemoveEntry[0]);
        saveBackgroundTasksToStorage();
        updateBackgroundTaskIndicator();
        console.log(`[后台任务] 任务 ${taskToRemoveEntry[0]} (ExecID: ${data.executionId}) 执行完成，已从后台列表移除`);
    }
    
    // 重置按钮状态
    if (pageState.currentBatchScriptType && 
        batchTaskConfigs[window.__currentTaskInstanceId]?.scriptTypeId === pageState.currentBatchScriptType.id &&
        window.__currentTaskInstanceId?.includes(data.executionId) &&
        startButton && isManagerView) {
        
        if (window.__currentExecutionId_completed_check === data.executionId) {
             if (startButton) {
                startButton.disabled = false;
                startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
             }
             window.__currentExecutionId_completed_check = null;
        }
    }
    window.__currentExecutionId_completed_check = activeExecutionId;
}