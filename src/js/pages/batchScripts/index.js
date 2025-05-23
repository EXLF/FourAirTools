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
    <div class="page-container modular-manager-page simple-config-page">
        <div class="page-header">
            <h1 id="modular-manager-title">配置批量任务: ${pageState.currentBatchScriptType.name}</h1>
            <div class="header-actions">
                <button id="back-to-cards-btn" class="btn btn-secondary">
                    <i class="fas fa-arrow-left"></i> 返回卡片
                </button>
            </div>
        </div>
        <main class="module-content-display" id="moduleContentDisplay">
            <!-- 配置内容将在此处动态加载 -->
        </main>
        <div class="task-logs-panel" id="taskLogsPanel" style="display: none;">
            <div class="logs-header">
                <h3><i class="fas fa-terminal"></i> 脚本执行日志</h3>
                <div class="logs-actions">
                    <button id="clear-logs-btn" class="btn btn-sm" title="清空日志">
                        <i class="fas fa-eraser"></i>
                    </button>
                    <button id="collapse-logs-btn" class="btn btn-sm" title="折叠/展开">
                        <i class="fas fa-chevron-up"></i>
                    </button>
                </div>
            </div>
            <div id="taskLogContainer" class="logs-content"></div>
        </div>
        <div class="simple-config-footer-actions">
            <button id="start-execution-btn" class="btn btn-success">
                <i class="fas fa-play"></i> 开始执行
            </button>
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
    addTaskLogStyles();
}

/**
 * 为模块化管理器绑定事件
 * @param {string} taskInstanceId - 当前配置的任务实例的唯一ID
 */
function bindModularManagerEvents(taskInstanceId) {
    const managerPage = pageState.contentAreaRef.querySelector('.simple-config-page');
    if (!managerPage) {
        console.error("Simple config page element not found");
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
        startTaskButton.addEventListener('click', async (event) => {
            event.preventDefault();
            await handleStartExecution(taskInstanceId, startTaskButton);
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
    
    // 清理旧的监听器和日志
    cleanupResources();
    
    // 显示日志面板
    setupLogPanel();
    
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
            await window.scriptAPI.executeScript(
                pageState.currentBatchScriptType.id,
                taskConfig.accounts,
                scriptConfig,
                actualProxyConfigToPass
            );
        } catch (err) {
            console.error('[批量脚本] 执行失败:', err);
            TaskLogger.logError(`执行失败: ${err.message || err}`);
            startTaskButton.disabled = false;
            startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        }
    } else {
        alert('脚本执行接口未定义');
        startTaskButton.disabled = false;
        startTaskButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
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
        }
        
        // 重置按钮状态
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
 * 设置日志面板
 */
function setupLogPanel() {
    const logsPanel = document.getElementById('taskLogsPanel');
    if (!logsPanel) return;
    
    logsPanel.style.display = 'block';
    
    const clearLogsBtn = document.getElementById('clear-logs-btn');
    const collapseLogsBtn = document.getElementById('collapse-logs-btn');
    const logContainer = document.getElementById('taskLogContainer');
    
    if (clearLogsBtn) {
        clearLogsBtn.onclick = () => {
            if (logContainer) {
                TaskLogger.clearLogContainer(logContainer);
                TaskLogger.logInfo('日志已清空');
            }
        };
    }
    
    if (collapseLogsBtn) {
        collapseLogsBtn.onclick = () => {
            const logsContent = logsPanel.querySelector('.logs-content');
            const icon = collapseLogsBtn.querySelector('i');
            if (logsContent.style.display === 'none') {
                logsContent.style.display = 'block';
                icon.className = 'fas fa-chevron-up';
            } else {
                logsContent.style.display = 'none';
                icon.className = 'fas fa-chevron-down';
            }
        };
    }
}

/**
 * 清理资源
 */
function cleanupResources() {
    // 清理日志渲染器
    if (window.__currentLogCleanup) {
        try {
            window.__currentLogCleanup();
            window.__currentLogCleanup = null;
        } catch (e) {
            console.warn('清理日志渲染器失败:', e);
        }
    }
    
    // 清理日志监听器
    if (window.__currentLogUnsubscribers) {
        try {
            window.__currentLogUnsubscribers.forEach(unsubscribe => {
                if (typeof unsubscribe === 'function') {
                    unsubscribe();
                }
            });
            window.__currentLogUnsubscribers = null;
        } catch (e) {
            console.warn('清理日志监听器失败:', e);
        }
    }
    
    // 移除所有IPC监听器
    if (window.electron && window.electron.ipcRenderer) {
        window.electron.ipcRenderer.removeAllListeners('script-log');
        window.electron.ipcRenderer.removeAllListeners('script-completed');
    }
    
    // 清理管理器
    pageState.walletGroupManager.destroy();
}

/**
 * 添加任务日志样式
 */
function addTaskLogStyles() {
    if (document.getElementById('task-log-styles')) return;
    
    const styleElement = document.createElement('style');
    styleElement.id = 'task-log-styles';
    styleElement.textContent = `
        .task-logs-panel {
            margin-top: 20px;
            border: 1px solid #ddd;
            border-radius: 4px;
            overflow: hidden;
            background: #f8f9fa;
        }
        
        .logs-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 15px;
            background: #f1f1f1;
            border-bottom: 1px solid #ddd;
        }
        
        .logs-header h3 {
            margin: 0;
            font-size: 16px;
            display: flex;
            align-items: center;
        }
        
        .logs-header h3 i {
            margin-right: 8px;
        }
        
        .logs-actions {
            display: flex;
            gap: 5px;
        }
        
        .logs-content {
            max-height: 300px;
            overflow-y: auto;
            padding: 10px;
            font-family: monospace;
            background: #222;
            color: #eee;
        }
        
        .log-entry {
            padding: 3px 0;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            word-break: break-word;
        }
        
        .log-time {
            color: #888;
            margin-right: 8px;
        }
        
        .log-type-info .log-message { color: #eee; }
        .log-type-success .log-message { color: #4caf50; }
        .log-type-warning .log-message { color: #ff9800; }
        .log-type-error .log-message { color: #f44336; }
        
        /* 钱包分组样式 */
        .wallet-group {
            margin-bottom: 10px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
        }
        
        .wallet-group-header {
            padding: 10px;
            background: #f5f5f5;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .wallet-group-header i {
            transition: transform 0.3s;
        }
        
        .wallet-group-header i.rotated {
            transform: rotate(90deg);
        }
        
        .wallet-group-content {
            padding: 10px;
            display: none;
        }
        
        .wallet-item {
            padding: 5px 0;
        }
        
        /* 代理配置样式 */
        .proxy-config-section {
            margin-top: 20px;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
        }
        
        .config-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        /* 开关样式 */
        .switch {
            position: relative;
            display: inline-block;
            width: 50px;
            height: 24px;
        }
        
        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        
        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 24px;
        }
        
        .slider:before {
            position: absolute;
            content: "";
            height: 18px;
            width: 18px;
            left: 3px;
            bottom: 3px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
        }
        
        input:checked + .slider {
            background-color: #2196F3;
        }
        
        input:checked + .slider:before {
            transform: translateX(26px);
        }
        
        .proxy-list {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            padding: 10px;
        }
        
        .proxy-item {
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .proxy-item:last-child {
            border-bottom: none;
        }
        
        .strategy-info {
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        
        .strategy-info.valid {
            background: #e8f5e9;
            color: #2e7d32;
        }
        
        .strategy-info.invalid {
            background: #ffebee;
            color: #c62828;
        }
        
        /* 代理表格样式 */
        .proxy-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 14px;
        }
        
        .proxy-table th {
            background: #f5f5f5;
            padding: 8px 10px;
            text-align: left;
            font-weight: 500;
            border-bottom: 2px solid #e0e0e0;
        }
        
        .proxy-table td {
            padding: 8px 10px;
            border-bottom: 1px solid #f0f0f0;
        }
        
        .proxy-table tbody tr:hover {
            background: #f8f9fa;
            cursor: pointer;
        }
        
        .proxy-table tbody tr.selected {
            background: #e3f2fd;
        }
        
        .proxy-type-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: 500;
            background: #e0e0e0;
            color: #333;
        }
        
        .proxy-type-badge.http {
            background: #bbdefb;
            color: #1565c0;
        }
        
        .proxy-type-badge.socks5 {
            background: #c5e1a5;
            color: #558b2f;
        }
        
        .proxy-type-badge.https {
            background: #b2dfdb;
            color: #00695c;
        }
        
        .proxy-status {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 12px;
            font-weight: 500;
        }
        
        .proxy-status.active {
            background: #c8e6c9;
            color: #2e7d32;
        }
        
        .proxy-status.inactive {
            background: #ffcdd2;
            color: #c62828;
        }
        
        .proxy-status.unknown {
            background: #e0e0e0;
            color: #616161;
        }
        
        .proxy-location {
            color: #666;
            font-size: 13px;
        }
        
        .no-data-message {
            text-align: center;
            padding: 40px;
            color: #999;
        }
    `;
    document.head.appendChild(styleElement);
} 