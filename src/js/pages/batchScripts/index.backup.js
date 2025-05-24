/**
 * 脚本插件管理页面 - 主模块（重构版）
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

// 后台任务管理 - 重构版
class BackgroundTaskManager {
    constructor() {
        this.tasks = new Map();
        this.storageKey = 'fa_background_tasks';
        this.indicator = null;
        this.isInitialized = false;
    }

    // 初始化管理器
    init() {
        if (this.isInitialized) return;
        
        console.log('[后台任务] 初始化后台任务管理器...');
        
        // 等待DOM就绪后创建指示器
        this.ensureDOMReady(() => {
            this.createGlobalIndicator();
            this.loadFromStorage();
            this.setupPeriodicCheck();
            this.bindToGlobal();
            this.isInitialized = true;
            console.log('[后台任务] 后台任务管理器初始化完成');
        });
    }

    // 确保DOM就绪
    ensureDOMReady(callback) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', callback);
        } else {
            // DOM已就绪，但可能body还没有，稍等一下
            setTimeout(callback, 100);
        }
    }

    // 创建全局指示器
    createGlobalIndicator() {
        // 移除可能存在的旧指示器
        const oldIndicator = document.getElementById('global-background-indicator');
        if (oldIndicator) {
            oldIndicator.remove();
        }

        this.indicator = document.createElement('div');
        this.indicator.id = 'global-background-indicator';
        this.indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: #27ae60;
            color: white;
            padding: 10px 16px;
            border-radius: 25px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            display: none;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            animation: pulse 2s infinite;
            user-select: none;
        `;

        this.indicator.innerHTML = `
            <i class="fas fa-tasks"></i>
            <span id="global-task-count">0</span> 个后台任务运行中
        `;

        // 点击事件：跳转到脚本插件页面
        this.indicator.addEventListener('click', () => {
            console.log('[后台任务] 用户点击指示器，尝试跳转到脚本插件页面');
            
            // 尝试多种跳转方式
            if (window.navigateTo) {
                window.navigateTo('batchScripts');
            } else if (window.router && window.router.navigate) {
                window.router.navigate('batchScripts');
            } else {
                // 备用方案：触发hash变化
                window.location.hash = '#batchScripts';
            }
        });

        // 悬停效果
        this.indicator.addEventListener('mouseenter', () => {
            this.indicator.style.transform = 'scale(1.05)';
            this.indicator.style.boxShadow = '0 6px 25px rgba(0,0,0,0.3)';
        });

        this.indicator.addEventListener('mouseleave', () => {
            this.indicator.style.transform = 'scale(1)';
            this.indicator.style.boxShadow = '0 4px 20px rgba(0,0,0,0.2)';
        });

        document.body.appendChild(this.indicator);
        console.log('[后台任务] 全局指示器已创建');
    }

    // 添加后台任务
    addTask(taskInstanceId, executionId, scriptType, resources = {}) {
        const task = {
            taskInstanceId,
            executionId,
            scriptType,
            startTime: Date.now(),
            status: 'running',
            // 保持资源引用，确保后台任务真的在运行
            logUnsubscribers: resources.logUnsubscribers || [],
            logCleanup: resources.logCleanup || null,
            timer: resources.timer || null,
            // 标记为真实运行的任务
            isReallyRunning: true
        };

        this.tasks.set(taskInstanceId, task);
        this.saveToStorage();
        this.updateIndicator();

        console.log(`[后台任务] 已添加任务: ${scriptType?.name || '未知'} (${taskInstanceId})`);
        return task;
    }

    // 移除后台任务
    removeTask(taskInstanceId) {
        const task = this.tasks.get(taskInstanceId);
        if (!task) return false;

        // 清理资源
        this.cleanupTaskResources(task);
        this.tasks.delete(taskInstanceId);
        this.saveToStorage();
        this.updateIndicator();

        console.log(`[后台任务] 已移除任务: ${taskInstanceId}`);
        return true;
    }

    // 获取任务
    getTask(taskInstanceId) {
        return this.tasks.get(taskInstanceId);
    }

    // 获取所有任务
    getAllTasks() {
        return Array.from(this.tasks.entries()).map(([taskId, task]) => ({
            taskId,
            scriptName: task.scriptType?.name || '未知脚本',
            status: task.status,
            startTime: task.startTime,
            duration: Date.now() - task.startTime,
            isReallyRunning: task.isReallyRunning
        }));
    }

    // 恢复任务到前台
    restoreTask(taskInstanceId) {
        const task = this.tasks.get(taskInstanceId);
        if (!task) return false;

        // 恢复全局状态
        window.__currentExecutionId = task.executionId;
        window.__currentTaskInstanceId = taskInstanceId;
        window.__currentLogUnsubscribers = task.logUnsubscribers;
        window.__currentLogCleanup = task.logCleanup;
        window.__executionTimer = task.timer;
        window.__startTime = task.startTime;

        // 设置当前脚本类型
        pageState.currentBatchScriptType = task.scriptType;

        // 从后台任务列表中移除（现在在前台运行）
        this.tasks.delete(taskInstanceId);
        this.saveToStorage();
        this.updateIndicator();

        console.log(`[后台任务] 任务 ${taskInstanceId} 已恢复到前台`);
        return true;
    }

    // 停止后台任务
    async stopTask(taskInstanceId) {
        const task = this.tasks.get(taskInstanceId);
        if (!task) return false;

        try {
            // 尝试停止脚本执行
            if (task.executionId && window.scriptAPI && window.scriptAPI.stopScript) {
                if (!task.executionId.startsWith('mock_exec_')) {
                    await window.scriptAPI.stopScript(task.executionId);
                }
            }

            // 清理并移除任务
            this.removeTask(taskInstanceId);
            console.log(`[后台任务] 任务 ${taskInstanceId} 已停止`);
            return true;
        } catch (error) {
            console.error(`[后台任务] 停止任务失败:`, error);
            return false;
        }
    }

    // 清理任务资源
    cleanupTaskResources(task) {
        if (task.timer) {
            clearInterval(task.timer);
        }

        if (task.logUnsubscribers) {
            task.logUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    try {
                        unsubscribe();
                    } catch (e) {
                        console.warn('[后台任务] 清理监听器失败:', e);
                    }
                }
            });
        }

        if (task.logCleanup && typeof task.logCleanup === 'function') {
            try {
                task.logCleanup();
            } catch (e) {
                console.warn('[后台任务] 清理日志渲染器失败:', e);
            }
        }
    }

    // 更新指示器
    updateIndicator() {
        if (!this.indicator) return;

        const taskCount = this.tasks.size;
        const countElement = this.indicator.querySelector('#global-task-count');

        if (taskCount > 0) {
            this.indicator.style.display = 'flex';
            if (countElement) {
                countElement.textContent = taskCount;
            }
            console.log(`[后台任务] 显示指示器，任务数量: ${taskCount}`);
        } else {
            this.indicator.style.display = 'none';
            console.log('[后台任务] 隐藏指示器，无后台任务');
        }
    }

    // 保存到localStorage
    saveToStorage() {
        try {
            const tasksData = Array.from(this.tasks.entries()).map(([taskId, task]) => ({
                taskId,
                taskInstanceId: task.taskInstanceId,
                executionId: task.executionId,
                scriptType: task.scriptType,
                startTime: task.startTime,
                status: task.status,
                isReallyRunning: task.isReallyRunning
            }));

            localStorage.setItem(this.storageKey, JSON.stringify(tasksData));
            console.log(`[后台任务] 已保存 ${tasksData.length} 个任务到localStorage`);
        } catch (error) {
            console.error('[后台任务] 保存到localStorage失败:', error);
        }
    }

    // 从localStorage加载
    loadFromStorage() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (!stored) return;

            const tasksData = JSON.parse(stored);
            console.log(`[后台任务] 从localStorage加载 ${tasksData.length} 个任务`);

            // 只恢复标记为真实运行的任务，其他的认为已经失效
            tasksData.forEach(taskData => {
                if (taskData.isReallyRunning) {
                    // 创建简化的任务对象（不恢复资源引用，因为它们在页面刷新后已经失效）
                    const task = {
                        taskInstanceId: taskData.taskInstanceId,
                        executionId: taskData.executionId,
                        scriptType: taskData.scriptType,
                        startTime: taskData.startTime,
                        status: 'unknown', // 页面刷新后状态未知
                        logUnsubscribers: [],
                        logCleanup: null,
                        timer: null,
                        isReallyRunning: false // 标记为非真实运行，需要用户确认
                    };

                    this.tasks.set(taskData.taskId, task);
                }
            });

            this.updateIndicator();
        } catch (error) {
            console.error('[后台任务] 从localStorage加载失败:', error);
        }
    }

    // 设置定期检查
    setupPeriodicCheck() {
        setInterval(() => {
            this.updateIndicator();
            // 可以在这里添加任务健康检查逻辑
        }, 5000);
    }

    // 绑定到全局
    bindToGlobal() {
        window.FABackgroundTaskManager = this;
        console.log('[后台任务] 已绑定到全局作用域');
    }

    // 调试方法
    debug() {
        console.log('=== 后台任务调试信息 ===');
        console.log('任务数量:', this.tasks.size);
        console.log('任务列表:', Array.from(this.tasks.entries()));
        console.log('指示器元素:', this.indicator);
        console.log('指示器显示状态:', this.indicator?.style.display);
        console.log('localStorage数据:', localStorage.getItem(this.storageKey));
        console.log('========================');
    }
}

// 创建全局后台任务管理器实例
const backgroundTaskManager = new BackgroundTaskManager();

// 页面切换保护系统
class PageSwitchProtection {
    constructor() {
        this.isActive = false;
        this.currentTaskId = null;
    }

    // 激活保护
    activate(taskInstanceId) {
        this.currentTaskId = taskInstanceId;
        this.isActive = true;
        console.log(`[页面保护] 已激活，保护任务: ${taskInstanceId}`);
    }

    // 停用保护
    deactivate() {
        this.currentTaskId = null;
        this.isActive = false;
        console.log('[页面保护] 已停用');
    }

    // 处理页面切换
    handlePageSwitch() {
        if (!this.isActive || !this.currentTaskId) return;

        const currentExecutionId = window.__currentExecutionId;
        if (currentExecutionId && window.__currentTaskInstanceId) {
            console.log('[页面保护] 检测到页面切换，保护运行中的任务');
            
            // 收集当前资源
            const resources = {
                logUnsubscribers: window.__currentLogUnsubscribers,
                logCleanup: window.__currentLogCleanup,
                timer: window.__executionTimer
            };

            // 添加到后台任务
            backgroundTaskManager.addTask(
                this.currentTaskId,
                currentExecutionId,
                pageState.currentBatchScriptType,
                resources
            );

            // 清理前台引用
            window.__currentExecutionId = null;
            window.__currentLogUnsubscribers = null;
            window.__currentLogCleanup = null;
            window.__executionTimer = null;

            console.log('[页面保护] 任务已安全保存到后台');
        }

        this.deactivate();
    }
}

const pageSwitchProtection = new PageSwitchProtection();

// 确保在模块加载时就初始化后台任务管理器
console.log('[后台任务] 模块加载，开始初始化...');
backgroundTaskManager.init();

/**
 * 初始化脚本插件管理页面
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export function initBatchScriptsPage(contentArea) {
    console.log("初始化脚本插件管理页面...");
    pageState.contentAreaRef = contentArea;
    
    // 设置页面标志
    window.__isBatchScriptsPageActive = true;
    
    // 确保后台任务管理器已初始化
    if (!backgroundTaskManager.isInitialized) {
        backgroundTaskManager.init();
    }

    renderBatchScriptCardsView(contentArea);
    
    // 绑定调试工具
    bindDebugTools();
    
    console.log('[脚本插件] 页面初始化完成');
}

/**
 * 页面卸载处理（供路由系统调用）
 */
export function onBatchScriptsPageUnload() {
    console.log('[脚本插件] 页面即将卸载，检查运行中的任务...');
    
    // 设置页面标志
    window.__isBatchScriptsPageActive = false;
    
    // 触发页面切换保护
    pageSwitchProtection.handlePageSwitch();
}

/**
 * 渲染脚本插件卡片视图
 * @param {HTMLElement} contentArea - 内容区域元素
 */
function renderBatchScriptCardsView(contentArea) {
    pageState.currentView = VIEW_MODES.CARDS;
    
    const cardViewHtml = `
    <div class="page-header">
        <h1>脚本插件</h1>
        <p>高效管理多账户脚本执行，批量处理多任务</p>
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
    
    // 绑定事件
    bindCardViewEvents(contentArea);
    
    // 加载内容
    loadAndRenderBatchScriptCards(contentArea);
    setupFilteringFunction(contentArea);
    
    // 更新页面内的后台任务按钮
    updatePageBackgroundTaskButton();
}

/**
 * 绑定卡片视图事件
 */
function bindCardViewEvents(contentArea) {
    // 刷新按钮
    const refreshBtn = contentArea.querySelector('#refresh-batch-scripts-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAndRenderBatchScriptCards(contentArea);
        });
    }
    
    // 后台任务按钮
    const backgroundTasksBtn = contentArea.querySelector('#background-tasks-btn');
    if (backgroundTasksBtn) {
        backgroundTasksBtn.addEventListener('click', () => {
            toggleBackgroundTasksPanel();
        });
    }
    
    // 关闭后台任务面板按钮
    const closeBackgroundPanel = contentArea.querySelector('#closeBackgroundPanel');
    if (closeBackgroundPanel) {
        closeBackgroundPanel.addEventListener('click', () => {
            toggleBackgroundTasksPanel(false);
        });
    }
}

/**
 * 更新页面内后台任务按钮
 */
function updatePageBackgroundTaskButton() {
    const backgroundTasksBtn = document.getElementById('background-tasks-btn');
    const backgroundTaskCount = document.getElementById('background-task-count');
    
    if (!backgroundTasksBtn || !backgroundTaskCount) return;
    
    const taskCount = backgroundTaskManager.tasks.size;
    
    if (taskCount > 0) {
        backgroundTasksBtn.style.display = 'inline-flex';
        backgroundTaskCount.textContent = taskCount;
        backgroundTasksBtn.classList.add('has-background-tasks');
    } else {
        backgroundTasksBtn.style.display = 'none';
        backgroundTasksBtn.classList.remove('has-background-tasks');
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
    
    // 保存任务实例ID
    window.__currentTaskInstanceId = taskInstanceId;
    console.log('[脚本插件] 开始执行任务:', taskInstanceId);
    
    // 激活页面切换保护
    pageSwitchProtection.activate(taskInstanceId);
    
    // 检查是否已有相同脚本的后台任务在运行
    const scriptId = pageState.currentBatchScriptType?.id;
    const existingTask = Array.from(backgroundTaskManager.tasks.values()).find(task => 
        task.scriptType?.id === scriptId
    );
    
    if (existingTask) {
        const userChoice = confirm(
            `检测到该脚本已有任务在后台运行中！\n\n` +
            `脚本名称: ${existingTask.scriptType.name}\n` +
            `运行时长: ${formatDuration(Date.now() - existingTask.startTime)}\n\n` +
            `点击"确定"查看现有任务\n` +
            `点击"取消"停止现有任务并创建新任务`
        );
        
        if (userChoice) {
            // 恢复现有任务
            if (backgroundTaskManager.restoreTask(existingTask.taskInstanceId)) {
                setTimeout(() => {
                    const taskConfig = batchTaskConfigs[existingTask.taskInstanceId];
                    if (taskConfig) {
                        switchToExecutionStage(taskConfig);
                    }
                }, 100);
            }
            return;
        } else {
            // 停止现有任务
            await backgroundTaskManager.stopTask(existingTask.taskInstanceId);
        }
    }
    
    // 继续执行新任务...
    // [保持原有的执行逻辑]
    
    // 立即禁用按钮
    startTaskButton.disabled = true;
    startTaskButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 准备中...';
    
    saveCurrentModuleData(taskInstanceId);
    
    const taskConfig = batchTaskConfigs[taskInstanceId];
    
    // 检查当前脚本是否需要钱包
    const scriptRequires = pageState.currentBatchScriptType?.requires;
    const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true;
    
    // 验证配置
    if (requiresWallets && taskConfig.accounts.length === 0) {
        alert('请至少选择一个钱包账户');
        startTaskButton.disabled = false;
        startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        pageSwitchProtection.deactivate();
        return;
    }
    
    if (taskConfig.proxyConfig.enabled) {
        if (taskConfig.proxyConfig.proxies.length === 0) {
            alert('已启用代理，但代理列表为空。请添加代理或禁用代理功能。');
            startTaskButton.disabled = false;
            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
            pageSwitchProtection.deactivate();
            return;
        }
        
        if (taskConfig.proxyConfig.strategy === 'one-to-one' && 
            taskConfig.proxyConfig.proxies.length < taskConfig.accounts.length) {
            alert(`一对一代理策略需要至少与钱包数量相同的代理IP。\n当前钱包数量: ${taskConfig.accounts.length}\n当前代理数量: ${taskConfig.proxyConfig.proxies.length}`);
            startTaskButton.disabled = false;
            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
            pageSwitchProtection.deactivate();
            return;
        }
    }
    
    // 切换到执行阶段界面
    switchToExecutionStage(taskConfig);
    
    // 清理旧的监听器和日志，但保留任务实例ID
    cleanupResources(true);
    
    // 重新确认任务实例ID
    window.__currentTaskInstanceId = taskInstanceId;
    
    // 初始化日志
    const logContainer = document.getElementById('taskLogContainer');
    if (logContainer) {
        TaskLogger.clearLogContainer(logContainer);
        const cleanupLogRender = TaskLogger.renderLogsToContainer(logContainer, true);
        window.__currentLogCleanup = cleanupLogRender;
        
        TaskLogger.logInfo('🚀 脚本插件执行系统已初始化');
        TaskLogger.logInfo(`📋 任务名称: ${pageState.currentBatchScriptType.name}`);
        
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
        
        // 注册日志监听
        setupScriptLogListeners(taskInstanceId, startTaskButton);
        
        try {
            console.log('[脚本插件] 开始执行脚本...');
            const result = await window.scriptAPI.executeScript(
                pageState.currentBatchScriptType.id,
                taskConfig.accounts,
                scriptConfig,
                actualProxyConfigToPass
            );
            
            // 保存执行ID
            if (result && result.success && result.data && result.data.executionId) {
                window.__currentExecutionId = result.data.executionId;
                console.log('[脚本插件] 执行ID已保存:', window.__currentExecutionId);
                
                // 显示停止按钮
                const stopBtn = document.getElementById('stop-btn');
                if (stopBtn) {
                    stopBtn.style.display = 'inline-flex';
                }
            } else {
                console.error('[脚本插件] 执行结果异常:', result);
            }
        } catch (err) {
            console.error('[脚本插件] 执行失败:', err);
            TaskLogger.logError(`执行失败: ${err.message || err}`);
            switchToConfigStage();
            startTaskButton.disabled = false;
            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
            pageSwitchProtection.deactivate();
        }
    } else {
        console.warn('脚本执行接口未定义，使用模拟执行');
        TaskLogger.logWarning('脚本执行接口未定义，将模拟执行过程');
        
        // 模拟执行
        window.__currentExecutionId = 'mock_exec_' + Date.now();
        console.log('[脚本插件] 模拟执行ID已生成:', window.__currentExecutionId);
        
        // 显示停止按钮
        const stopBtn = document.getElementById('stop-btn');
        if (stopBtn) {
            stopBtn.style.display = 'inline-flex';
        }
        
        // 模拟执行过程
        startMockExecution(taskConfig, startTaskButton, taskInstanceId);
    }
}

/**
 * 模拟执行过程
 */
function startMockExecution(taskConfig, startTaskButton, taskInstanceId) {
    setTimeout(() => {
        TaskLogger.logInfo('开始模拟执行...');
        
        const scriptRequires = pageState.currentBatchScriptType?.requires;
        const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true;
        
        let completed = 0;
        const total = requiresWallets ? taskConfig.accounts.length : 1;
        
        const simulateInterval = setInterval(() => {
            // 检查是否被停止
            if (!window.__currentExecutionId) {
                clearInterval(simulateInterval);
                console.log('[脚本插件] 模拟执行被停止');
                return;
            }
            
            if (completed < total) {
                completed++;
                if (requiresWallets) {
                    TaskLogger.logSuccess(`账户 ${completed}/${total} 执行成功`);
                } else {
                    TaskLogger.logSuccess(`脚本执行成功`);
                }
                
                const successCountElement = document.getElementById('successCount');
                if (successCountElement) {
                    successCountElement.textContent = completed;
                }
            } else {
                clearInterval(simulateInterval);
                
                // 触发完成处理
                handleScriptCompletion(startTaskButton, {
                    totalAccounts: total,
                    successCount: completed,
                    failedCount: 0,
                    duration: '模拟执行'
                });
            }
        }, 1000);
    }, 1000);
}

/**
 * 处理脚本完成
 */
function handleScriptCompletion(startTaskButton, summary) {
    TaskLogger.logSuccess('✅ 脚本插件执行完成！');
    TaskLogger.logInfo(`📊 执行总结:`);
    if (summary.totalAccounts > 1) {
        TaskLogger.logInfo(`   - 总账户数: ${summary.totalAccounts}`);
    } else {
        TaskLogger.logInfo(`   - 脚本类型: 通用工具脚本`);
    }
    TaskLogger.logInfo(`   - 成功: ${summary.successCount}`);
    TaskLogger.logInfo(`   - 失败: ${summary.failedCount}`);
    TaskLogger.logInfo(`   - 耗时: ${summary.duration}`);
    
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
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
        stopBtn.style.display = 'none';
    }
    
    // 重置开始按钮状态
    if (startTaskButton) {
        startTaskButton.disabled = false;
        startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
    }
    
    // 停用页面保护
    pageSwitchProtection.deactivate();
    
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
 * 切换到执行阶段
 * @param {Object} taskConfig - 任务配置
 */
function switchToExecutionStage(taskConfig) {
    // 隐藏配置区域，显示日志区域
    const configSection = document.getElementById('configSection');
    const logSection = document.getElementById('logSection');
    
    if (configSection) {
        configSection.style.display = 'none';
    }
    
    if (logSection) {
        logSection.style.display = 'flex'; // 日志区域也使用flex布局
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
    const scriptRequires = pageState.currentBatchScriptType?.requires;
    const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
    const totalCount = requiresWallets ? taskConfig.accounts.length : 1; // 不需要钱包的脚本显示1个任务
    
    document.getElementById('totalCount').textContent = totalCount;
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
    const configSection = document.getElementById('configSection');
    const logSection = document.getElementById('logSection');
    
    if (configSection) {
        // 确保配置区域使用正确的flex布局
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
    
    // 只有在没有后台任务时才停止计时器（避免停止后台脚本）
    const hasBackgroundTasks = backgroundTaskManager.tasks.size > 0;
    if (!hasBackgroundTasks && window.__executionTimer) {
        clearInterval(window.__executionTimer);
        window.__executionTimer = null;
        console.log('[脚本插件] 没有后台任务，停止计时器');
    } else if (hasBackgroundTasks) {
        console.log('[脚本插件] 存在后台任务，保持计时器运行');
    }
    
    // 确保配置内容区域恢复正确的样式
    const configContent = document.getElementById('moduleContentDisplay');
    if (configContent) {
        // 确保内容区域有正确的flex属性
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
            // 触发重新布局
            configSection.offsetHeight;
        }
    }, 10);
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
            console.error('[脚本插件日志] 处理日志失败:', e);
        }
    };
    
    // 脚本完成事件处理
    const scriptCompletedHandler = (data) => {
        console.log('[脚本插件] 收到脚本完成事件:', data);
        
        let summary = {
            totalAccounts: 0,
            successCount: 0,
            failedCount: 0,
            duration: '未知'
        };
        
        if (data && data.summary) {
            summary = data.summary;
        }
        
        handleScriptCompletion(startTaskButton, summary);
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
        
        // 检查当前脚本是否需要钱包
        const scriptRequires = pageState.currentBatchScriptType?.requires;
        const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
        
        // 生成模块内容HTML
        let moduleHtml = '';
        
        if (requiresWallets) {
            // 需要钱包的脚本显示完整配置
            const walletGroups = pageState.walletGroupManager.groupWallets(availableWallets);
            const walletGroupsHtml = pageState.walletGroupManager.generateWalletGroupsHTML(walletGroups, taskInstanceId);
            const proxyConfigHtml = pageState.proxyManager.generateProxyConfigHTML(taskInstanceId, taskConfig.proxyConfig);
            
            moduleHtml = `
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
        } else {
            // 不需要钱包的脚本显示简化配置
            const proxyConfigHtml = pageState.proxyManager.generateProxyConfigHTML(taskInstanceId, taskConfig.proxyConfig);
            
            moduleHtml = `
                <div class="module-section">
                    <h2><i class="fas fa-cog"></i> 脚本配置</h2>
                    <div class="script-info-section">
                        <div class="info-card">
                            <div class="info-header">
                                <i class="fas fa-info-circle"></i>
                                <span>脚本信息</span>
                            </div>
                            <div class="info-content">
                                <p><strong>脚本名称：</strong>${pageState.currentBatchScriptType.name}</p>
                                <p><strong>脚本类型：</strong>通用工具脚本</p>
                                <p><strong>说明：</strong>此脚本不需要钱包账户，可直接执行</p>
                            </div>
                        </div>
                    </div>
                    
                    ${proxyConfigHtml}
                </div>
            `;
        }
        
        moduleContentDisplay.innerHTML = moduleHtml;
        
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
        
        // 对于不需要钱包的脚本，手动触发按钮状态更新
        if (!requiresWallets) {
            setTimeout(() => {
                const startTaskButton = document.getElementById('start-execution-btn');
                if (startTaskButton) {
                    startTaskButton.disabled = false;
                    console.log('[脚本插件] 不需要钱包的脚本，已启用执行按钮');
                }
            }, 100);
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
    const scriptRequires = pageState.currentBatchScriptType?.requires;
    const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
    
    // 钱包选择相关事件（仅对需要钱包的脚本）
    if (requiresWallets) {
        const walletsListDiv = document.getElementById(`wallet-list-${taskInstanceId}`);
        
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
 * @param {boolean} keepTaskInstanceId - 是否保留任务实例ID
 */
function cleanupResources(keepTaskInstanceId = false) {
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
    
    // 根据参数决定是否清理任务实例ID
    if (!keepTaskInstanceId && window.__currentTaskInstanceId) {
        console.log('[脚本插件] 清理任务实例ID:', window.__currentTaskInstanceId);
        window.__currentTaskInstanceId = null;
    } else if (keepTaskInstanceId) {
        console.log('[脚本插件] 保留任务实例ID:', window.__currentTaskInstanceId);
    }
    
    // 清理预准备的后台任务信息
    if (window.__currentBackgroundTask) {
        window.__currentBackgroundTask = null;
    }
    
    // 清理批量任务日志
    if (window.batchTaskLogs) {
        window.batchTaskLogs = {};
    }
    
    console.log('[脚本插件] 资源清理完成');
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
        
        /* 全局后台任务指示器样式 */
        @keyframes pulse {
            0% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.7; transform: scale(1.05); }
            100% { opacity: 1; transform: scale(1); }
        }
        
        #global-background-indicator {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: #27ae60;
            color: white;
            padding: 10px 16px;
            border-radius: 25px;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            display: none;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
            animation: pulse 2s infinite;
            user-select: none;
        }
        
        #global-background-indicator:hover {
            background: #2c3e50;
            transform: scale(1.05);
            box-shadow: 0 6px 25px rgba(0,0,0,0.3);
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

// 修复缺失的函数
function restoreTaskFromBackground(taskInstanceId) {
    return backgroundTaskManager.restoreTask(taskInstanceId);
}

async function stopBackgroundTask(taskInstanceId) {
    return backgroundTaskManager.stopTask(taskInstanceId);
}

function getBackgroundTasks() {
    return backgroundTaskManager.getAllTasks();
}

function updateBackgroundTaskIndicator() {
    updatePageBackgroundTaskButton();
}

function updateGlobalBackgroundTaskStatus() {
    backgroundTaskManager.updateIndicator();
}

// 绑定调试工具
function bindDebugTools() {
    window.debugBackgroundTasks = () => backgroundTaskManager.debug();
    window.clearAllBackgroundTasks = () => {
        backgroundTaskManager.tasks.clear();
        backgroundTaskManager.saveToStorage();
        backgroundTaskManager.updateIndicator();
        updatePageBackgroundTaskButton();
        console.log('[调试] 已清理所有后台任务');
    };
    
    console.log('[调试工具] 已绑定调试函数:');
    console.log('  - debugBackgroundTasks() : 显示调试信息');
    console.log('  - clearAllBackgroundTasks() : 清理所有后台任务');
}

/**
 * 加载并渲染脚本插件卡片
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
                    ...s,  // 保留所有原始字段，包括requires
                    status: s.status || 'active',
                    category: s.category || ''
                }));
                
                console.log('[脚本插件] 加载的脚本数据:', scriptsList);
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
    console.log("任务实例ID:", taskInstanceId);
    console.log("当前脚本数据:", pageState.currentBatchScriptType);
    pageState.currentView = VIEW_MODES.MANAGER;
    
    // 清理可能存在的旧资源，但保留任务实例ID
    cleanupResources(true);
    
    // 立即设置当前任务实例ID，确保在整个流程中都可用
    window.__currentTaskInstanceId = taskInstanceId;
    
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
            
            // 检查是否有正在运行的任务
            const currentExecutionId = window.__currentExecutionId;
            const isTaskRunning = currentExecutionId && window.__executionTimer;
            
            if (isTaskRunning) {
                // 如果有正在运行的任务，保存到后台
                const resources = {
                    logUnsubscribers: window.__currentLogUnsubscribers,
                    logCleanup: window.__currentLogCleanup,
                    timer: window.__executionTimer
                };
                
                backgroundTaskManager.addTask(
                    taskInstanceId,
                    currentExecutionId,
                    pageState.currentBatchScriptType,
                    resources
                );
                
                // 清理前台引用
                window.__currentExecutionId = null;
                window.__currentLogUnsubscribers = null;
                window.__currentLogCleanup = null;
                window.__executionTimer = null;
                
                console.log('[脚本插件] 任务已移至后台运行');
            } else {
                // 没有运行中的任务，正常清理
                cleanupResources();
            }
            
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
            
            // 检查当前脚本是否需要钱包
            const scriptRequires = pageState.currentBatchScriptType?.requires;
            const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
            
            if (requiresWallets) {
                // 需要钱包的脚本，必须选择至少一个钱包
                if (walletCount > 0) {
                    startTaskButton.disabled = false;
                } else {
                    startTaskButton.disabled = true;
                }
            } else {
                // 不需要钱包的脚本，直接启用按钮
                startTaskButton.disabled = false;
            }
        };
        
        // 初始检查
        setTimeout(() => {
            updateStartButtonState();
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
                // 如果有正在运行的任务，保存到后台
                const resources = {
                    logUnsubscribers: window.__currentLogUnsubscribers,
                    logCleanup: window.__currentLogCleanup,
                    timer: window.__executionTimer
                };
                
                backgroundTaskManager.addTask(
                    taskInstanceId,
                    currentExecutionId,
                    pageState.currentBatchScriptType,
                    resources
                );
                
                // 清理前台引用
                window.__currentExecutionId = null;
                window.__currentLogUnsubscribers = null;
                window.__currentLogCleanup = null;
                window.__executionTimer = null;
                
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
                        const startButton = managerPage.querySelector('#start-execution-btn');
                        if (startButton) {
                            startButton.disabled = false;
                            startButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                        }
                    } else {
                        TaskLogger.logError(`停止脚本失败: ${result.error || '未知错误'}`);
                        // 恢复按钮状态
                        stopTaskButton.disabled = false;
                        stopTaskButton.innerHTML = '<i class="fas fa-stop"></i><span>停止</span>';
                    }
                } else if (currentExecutionId && currentExecutionId.startsWith('mock_exec_')) {
                    // 处理模拟执行的停止
                    TaskLogger.logWarning('正在停止模拟执行...');
                    
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
                    // 恢复按钮状态
                    stopTaskButton.disabled = false;
                    stopTaskButton.innerHTML = '<i class="fas fa-stop"></i><span>停止</span>';
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

// 简化的切换后台任务面板
function toggleBackgroundTasksPanel(show) {
    const panel = document.getElementById('backgroundTasksPanel');
    if (!panel) return;
    
    const isVisible = panel.style.display !== 'none';
    const shouldShow = show !== undefined ? show : !isVisible;
    
    if (shouldShow) {
        panel.style.display = 'block';
        renderBackgroundTasksList();
    } else {
        panel.style.display = 'none';
    }
}

// 渲染后台任务列表
function renderBackgroundTasksList() {
    const container = document.getElementById('backgroundTasksList');
    if (!container) return;
    
    const tasks = backgroundTaskManager.getAllTasks();
    
    if (tasks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>当前没有后台运行的任务</p>
            </div>
        `;
        return;
    }
    
    const tasksHtml = tasks.map(task => {
        const duration = formatDuration(task.duration);
        const statusColor = task.isReallyRunning ? '#27ae60' : '#f39c12';
        const statusText = task.isReallyRunning ? '运行中' : '状态未知';
        
        return `
            <div class="background-task-item" data-task-id="${task.taskId}">
                <div class="task-info">
                    <div class="task-name">
                        <i class="fas fa-play-circle" style="color: ${statusColor}"></i>
                        ${task.scriptName}
                    </div>
                    <div class="task-details">
                        <span class="task-status" style="color: ${statusColor}">${statusText}</span>
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

// 格式化持续时间
function formatDuration(ms) {
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

// 全局函数供HTML调用
window.resumeBackgroundTask = function(taskInstanceId) {
    if (backgroundTaskManager.restoreTask(taskInstanceId)) {
        toggleBackgroundTasksPanel(false);
        navigateToModularTaskManager(taskInstanceId);
        
        setTimeout(() => {
            const taskConfig = batchTaskConfigs[taskInstanceId];
            if (taskConfig) {
                switchToExecutionStage(taskConfig);
            }
        }, 100);
    }
};

window.stopBackgroundTaskFromPanel = async function(taskInstanceId) {
    if (confirm('确定要停止这个后台任务吗？')) {
        const success = await backgroundTaskManager.stopTask(taskInstanceId);
        if (success) {
            renderBackgroundTasksList();
            updatePageBackgroundTaskButton();
        }
    }
};

// 修复缺失的函数
function restoreTaskFromBackground(taskInstanceId) {
    return backgroundTaskManager.restoreTask(taskInstanceId);
}

async function stopBackgroundTask(taskInstanceId) {
    return backgroundTaskManager.stopTask(taskInstanceId);
}

function getBackgroundTasks() {
    return backgroundTaskManager.getAllTasks();
}

function updateBackgroundTaskIndicator() {
    updatePageBackgroundTaskButton();
}

function updateGlobalBackgroundTaskStatus() {
    backgroundTaskManager.updateIndicator();
}