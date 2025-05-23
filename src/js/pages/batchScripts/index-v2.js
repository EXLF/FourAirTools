/**
 * @fileoverview 批量脚本页面初始化 V2 - 使用scriptStore进行状态管理
 * @module pages/batchScripts/index-v2
 */

import { scriptManager } from './scriptManager.js';
import { scriptStore } from '../../stores/scriptStore.js';
import { walletStore } from '../../stores/walletStore.js';
import { showToast } from '../../components/toast.js';
import { TaskLogger } from './logger.js';

/**
 * 初始化批量脚本页面（使用Store版本）
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export async function initBatchScriptsPageV2(contentArea) {
    console.log('[BatchScriptsV2] 开始初始化批量脚本页面...');

    // 渲染初始UI
    renderPageStructure(contentArea);

    // 缓存DOM元素
    const elements = {
        contentArea: contentArea,
        scriptCardsContainer: contentArea.querySelector('#scriptCardsContainer'),
        categoryFilter: contentArea.querySelector('#categoryFilter'),
        tasksContainer: contentArea.querySelector('#tasksContainer'),
        activeTasksCount: contentArea.querySelector('#activeTasksCount'),
        refreshBtn: contentArea.querySelector('#refreshScriptsBtn'),
        viewMode: contentArea.querySelector('#viewMode')
    };

    // 检查必要元素
    if (!validateElements(elements)) {
        return;
    }

    // 初始化脚本管理器
    await scriptManager.initialize(elements);

    // 设置事件监听
    setupEventListeners(contentArea, elements);

    // 设置筛选器
    setupFilters(elements);

    console.log('[BatchScriptsV2] 批量脚本页面初始化完成');
}

/**
 * 渲染页面结构
 */
function renderPageStructure(contentArea) {
    contentArea.innerHTML = `
        <div class="batch-scripts-page">
            <div class="page-header">
                <h1>批量脚本</h1>
                <p>高效管理多账户脚本执行，批量处理多任务</p>
                <div class="header-actions">
                    <span class="active-tasks-indicator" style="display: none;">
                        <i class="fas fa-spinner fa-spin"></i>
                        <span id="activeTasksCount">0</span> 个任务执行中
                    </span>
                    <button id="refreshScriptsBtn" class="btn btn-secondary">
                        <i class="fas fa-sync-alt"></i> 刷新列表
                    </button>
                </div>
            </div>

            <div class="filter-panel">
                <div class="filter-group">
                    <label>分类筛选：</label>
                    <select id="categoryFilter">
                        <option value="all">全部分类</option>
                        <option value="defi">DeFi</option>
                        <option value="nft">NFT</option>
                        <option value="airdrop">空投</option>
                        <option value="social">社交</option>
                        <option value="tools">工具</option>
                        <option value="custom">自定义</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>视图模式：</label>
                    <div class="view-mode-toggle" id="viewMode">
                        <button class="mode-btn active" data-mode="cards">
                            <i class="fas fa-th-large"></i> 卡片
                        </button>
                        <button class="mode-btn" data-mode="list">
                            <i class="fas fa-list"></i> 列表
                        </button>
                    </div>
                </div>
            </div>

            <div class="content-container">
                <!-- 脚本卡片区域 -->
                <div class="scripts-section">
                    <div class="script-cards-grid" id="scriptCardsContainer">
                        <!-- 脚本卡片将在这里渲染 -->
                    </div>
                </div>

                <!-- 任务列表侧边栏 -->
                <div class="tasks-sidebar">
                    <h3>最近任务</h3>
                    <div id="tasksContainer">
                        <!-- 任务列表将在这里渲染 -->
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 验证必要的DOM元素
 */
function validateElements(elements) {
    const required = ['scriptCardsContainer', 'categoryFilter', 'tasksContainer'];
    
    for (const key of required) {
        if (!elements[key]) {
            console.error(`[BatchScriptsV2] 缺少必要元素: ${key}`);
            elements.contentArea.innerHTML = `
                <div style="color: red; padding: 20px; text-align: center;">
                    页面加载错误：缺少关键元素
                </div>
            `;
            return false;
        }
    }

    return true;
}

/**
 * 设置事件监听器
 */
function setupEventListeners(contentArea, elements) {
    // 刷新按钮
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', async () => {
            elements.refreshBtn.disabled = true;
            elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 刷新中...';
            
            await scriptManager.loadInitialData();
            
            elements.refreshBtn.disabled = false;
            elements.refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新列表';
            showToast('脚本列表已刷新', 'success');
        });
    }

    // 视图模式切换
    if (elements.viewMode) {
        elements.viewMode.addEventListener('click', (e) => {
            const btn = e.target.closest('.mode-btn');
            if (!btn) return;

            // 更新按钮状态
            elements.viewMode.querySelectorAll('.mode-btn').forEach(b => {
                b.classList.remove('active');
            });
            btn.classList.add('active');

            // 切换视图模式
            const mode = btn.dataset.mode;
            const container = elements.scriptCardsContainer;
            
            if (mode === 'list') {
                container.classList.add('list-view');
            } else {
                container.classList.remove('list-view');
            }
        });
    }

    // 监听自定义事件
    contentArea.addEventListener('script:configure', (e) => {
        const script = e.detail.script;
        showScriptConfiguration(contentArea, script);
    });

    contentArea.addEventListener('task:viewLogs', (e) => {
        const task = e.detail.task;
        showTaskLogs(contentArea, task);
    });

    contentArea.addEventListener('script:viewTasks', (e) => {
        const scriptId = e.detail.scriptId;
        showScriptTasks(contentArea, scriptId);
    });
}

/**
 * 设置筛选器
 */
function setupFilters(elements) {
    // 分类筛选
    elements.categoryFilter.addEventListener('change', (e) => {
        scriptStore.set('ui.selectedCategory', e.target.value);
    });
}

/**
 * 显示脚本配置界面
 */
function showScriptConfiguration(contentArea, script) {
    console.log('[BatchScriptsV2] 显示脚本配置:', script);

    // 确保钱包数据已加载
    if (walletStore.get('wallets').length === 0) {
        showToast('正在加载钱包数据...', 'info');
        loadWalletData();
    }

    // 渲染配置界面
    contentArea.innerHTML = `
        <div class="script-configuration">
            <div class="config-header">
                <button class="back-btn" id="backToScripts">
                    <i class="fas fa-arrow-left"></i> 返回
                </button>
                <h2>${script.name}</h2>
            </div>

            <div class="config-body">
                <div class="config-section">
                    <h3>选择钱包</h3>
                    <div class="wallet-selection">
                        <div class="selection-toolbar">
                            <button class="btn btn-sm" id="selectAllWallets">全选</button>
                            <button class="btn btn-sm" id="selectNoneWallets">取消全选</button>
                            <span class="selection-count">
                                已选择 <span id="selectedCount">0</span> 个钱包
                            </span>
                        </div>
                        <div class="wallet-list" id="walletList">
                            <!-- 钱包列表将在这里渲染 -->
                        </div>
                    </div>
                </div>

                <div class="config-section">
                    <h3>执行参数</h3>
                    <div class="params-form" id="paramsForm">
                        <div class="form-group">
                            <label>执行间隔（秒）</label>
                            <div class="range-input">
                                <input type="number" id="intervalMin" value="30" min="1" max="300" />
                                <span>-</span>
                                <input type="number" id="intervalMax" value="60" min="1" max="300" />
                            </div>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" id="randomInterval" checked />
                                随机间隔
                            </label>
                        </div>
                    </div>
                </div>

                <div class="config-actions">
                    <button class="btn btn-primary" id="startExecution" disabled>
                        <i class="fas fa-play"></i> 开始执行
                    </button>
                </div>
            </div>
        </div>
    `;

    // 设置配置界面事件
    setupConfigurationEvents(contentArea, script);
    
    // 渲染钱包列表
    renderWalletSelection();
}

/**
 * 设置配置界面事件
 */
function setupConfigurationEvents(contentArea, script) {
    // 返回按钮
    const backBtn = contentArea.querySelector('#backToScripts');
    backBtn.addEventListener('click', () => {
        initBatchScriptsPageV2(contentArea);
    });

    // 全选/取消全选
    const selectAllBtn = contentArea.querySelector('#selectAllWallets');
    const selectNoneBtn = contentArea.querySelector('#selectNoneWallets');
    
    selectAllBtn.addEventListener('click', () => {
        contentArea.querySelectorAll('.wallet-checkbox').forEach(cb => {
            cb.checked = true;
        });
        updateSelectedCount();
    });

    selectNoneBtn.addEventListener('click', () => {
        contentArea.querySelectorAll('.wallet-checkbox').forEach(cb => {
            cb.checked = false;
        });
        updateSelectedCount();
    });

    // 更新选中数量
    const updateSelectedCount = () => {
        const checked = contentArea.querySelectorAll('.wallet-checkbox:checked');
        contentArea.querySelector('#selectedCount').textContent = checked.length;
        contentArea.querySelector('#startExecution').disabled = checked.length === 0;
    };

    // 开始执行
    const startBtn = contentArea.querySelector('#startExecution');
    startBtn.addEventListener('click', async () => {
        const selectedWallets = Array.from(contentArea.querySelectorAll('.wallet-checkbox:checked'))
            .map(cb => {
                const walletId = parseInt(cb.value);
                return walletStore.get('wallets').find(w => w.id === walletId);
            })
            .filter(Boolean);

        if (selectedWallets.length === 0) {
            showToast('请至少选择一个钱包', 'warning');
            return;
        }

        // 获取参数
        const params = {
            intervalMin: parseInt(contentArea.querySelector('#intervalMin').value),
            intervalMax: parseInt(contentArea.querySelector('#intervalMax').value),
            randomInterval: contentArea.querySelector('#randomInterval').checked
        };

        // 执行脚本
        startBtn.disabled = true;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中...';

        const result = await scriptManager.executeScript(script.id, selectedWallets, params);
        
        if (result.success) {
            // 显示执行日志界面
            showExecutionLogs(contentArea, result.taskId);
        } else {
            startBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        }
    });
}

/**
 * 渲染钱包选择列表
 */
function renderWalletSelection() {
    const container = document.querySelector('#walletList');
    if (!container) return;

    const wallets = walletStore.get('wallets');
    
    if (wallets.length === 0) {
        container.innerHTML = '<p>暂无可用钱包</p>';
        return;
    }

    container.innerHTML = wallets.map(wallet => `
        <label class="wallet-item">
            <input type="checkbox" class="wallet-checkbox" value="${wallet.id}" />
            <div class="wallet-info">
                <span class="wallet-address">${wallet.address}</span>
                ${wallet.name ? `<span class="wallet-name">${wallet.name}</span>` : ''}
            </div>
        </label>
    `).join('');

    // 监听选择变化
    container.addEventListener('change', () => {
        const checked = container.querySelectorAll('.wallet-checkbox:checked');
        document.querySelector('#selectedCount').textContent = checked.length;
        document.querySelector('#startExecution').disabled = checked.length === 0;
    });
}

/**
 * 显示执行日志
 */
function showExecutionLogs(contentArea, taskId) {
    const task = scriptStore.get(`tasks.${taskId}`);
    if (!task) return;

    contentArea.innerHTML = `
        <div class="execution-logs">
            <div class="logs-header">
                <button class="back-btn" id="backToScripts">
                    <i class="fas fa-arrow-left"></i> 返回
                </button>
                <h2>${task.scriptName} - 执行日志</h2>
                <div class="task-status">
                    <span class="status ${task.status}">
                        ${scriptManager.getStatusIcon(task.status)} 
                        ${scriptManager.getStatusText(task.status)}
                    </span>
                    ${task.status === 'running' ? `
                        <button class="btn btn-danger btn-sm" id="stopTask">
                            <i class="fas fa-stop"></i> 停止
                        </button>
                    ` : ''}
                </div>
            </div>

            <div class="logs-toolbar">
                <div class="log-stats">
                    <span>进度: ${task.progress}%</span>
                    <span>成功: ${task.results.length}</span>
                    <span>失败: ${task.errors.length}</span>
                </div>
                <div class="log-actions">
                    <button class="tool-btn" id="autoScrollBtn" title="自动滚动">
                        <i class="fas fa-angle-double-down"></i>
                    </button>
                    <button class="tool-btn" id="downloadLogsBtn" title="下载日志">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="tool-btn" id="clearLogsBtn" title="清空日志">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>

            <div class="log-container" id="logContainer">
                <!-- 日志内容 -->
            </div>
        </div>
    `;

    // 设置日志界面事件
    setupLogEvents(contentArea, taskId);
    
    // 渲染日志
    renderTaskLogs(taskId);

    // 订阅任务更新
    const unsubscribe = scriptStore.subscribe((state) => {
        const updatedTask = state.tasks[taskId];
        if (updatedTask) {
            updateTaskStatusUI(updatedTask);
            renderTaskLogs(taskId);
        }
    }, [`tasks.${taskId}`]);

    // 保存取消订阅函数
    contentArea.dataset.unsubscribe = unsubscribe;
}

/**
 * 渲染任务日志
 */
function renderTaskLogs(taskId) {
    const container = document.querySelector('#logContainer');
    if (!container) return;

    const task = scriptStore.get(`tasks.${taskId}`);
    if (!task) return;

    // 使用TaskLogger渲染日志
    TaskLogger.clearLogContainer(container);
    
    // 渲染历史日志
    task.logs.forEach(log => {
        TaskLogger.logMessage(log.message, log.level);
    });

    // 设置自动滚动
    if (container.dataset.autoScroll !== 'false') {
        container.scrollTop = container.scrollHeight;
    }
}

/**
 * 更新任务状态UI
 */
function updateTaskStatusUI(task) {
    // 更新状态
    const statusElement = document.querySelector('.task-status .status');
    if (statusElement) {
        statusElement.className = `status ${task.status}`;
        statusElement.innerHTML = `
            ${scriptManager.getStatusIcon(task.status)} 
            ${scriptManager.getStatusText(task.status)}
        `;
    }

    // 更新统计
    const stats = document.querySelector('.log-stats');
    if (stats) {
        stats.innerHTML = `
            <span>进度: ${task.progress}%</span>
            <span>成功: ${task.results.length}</span>
            <span>失败: ${task.errors.length}</span>
        `;
    }

    // 更新停止按钮
    const stopBtn = document.querySelector('#stopTask');
    if (stopBtn && task.status !== 'running') {
        stopBtn.remove();
    }
}

/**
 * 设置日志界面事件
 */
function setupLogEvents(contentArea, taskId) {
    // 返回按钮
    const backBtn = contentArea.querySelector('#backToScripts');
    backBtn.addEventListener('click', () => {
        // 清理订阅
        if (contentArea.dataset.unsubscribe) {
            contentArea.dataset.unsubscribe();
        }
        initBatchScriptsPageV2(contentArea);
    });

    // 停止任务
    const stopBtn = contentArea.querySelector('#stopTask');
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            scriptManager.stopTask(taskId);
        });
    }

    // 自动滚动
    const autoScrollBtn = contentArea.querySelector('#autoScrollBtn');
    const logContainer = contentArea.querySelector('#logContainer');
    
    autoScrollBtn.addEventListener('click', () => {
        const isEnabled = logContainer.dataset.autoScroll !== 'false';
        logContainer.dataset.autoScroll = isEnabled ? 'false' : 'true';
        autoScrollBtn.classList.toggle('active', !isEnabled);
    });

    // 下载日志
    const downloadBtn = contentArea.querySelector('#downloadLogsBtn');
    downloadBtn.addEventListener('click', () => {
        downloadTaskLogs(taskId);
    });

    // 清空日志（仅清空显示）
    const clearBtn = contentArea.querySelector('#clearLogsBtn');
    clearBtn.addEventListener('click', () => {
        if (confirm('确定要清空日志显示吗？')) {
            logContainer.innerHTML = '';
        }
    });
}

/**
 * 下载任务日志
 */
function downloadTaskLogs(taskId) {
    const task = scriptStore.get(`tasks.${taskId}`);
    if (!task) return;

    const logs = task.logs.map(log => 
        `[${new Date(log.timestamp).toLocaleString()}] [${log.level.toUpperCase()}] ${log.message}`
    ).join('\n');

    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task_${taskId}_logs_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * 加载钱包数据
 */
async function loadWalletData() {
    try {
        const result = await window.electronAPI.wallets.getAll();
        if (result.success) {
            walletStore.setWallets(result.data);
        }
    } catch (error) {
        console.error('[BatchScriptsV2] 加载钱包数据失败:', error);
    }
}

/**
 * 显示任务日志（从任务列表点击）
 */
function showTaskLogs(contentArea, task) {
    showExecutionLogs(contentArea, task.id);
}

/**
 * 显示脚本的所有任务
 */
function showScriptTasks(contentArea, scriptId) {
    // TODO: 实现显示特定脚本的所有任务
    showToast('功能开发中...', 'info');
} 