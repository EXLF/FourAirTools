/**
 * 批量脚本管理页面 - 主模块
 * 负责初始化页面、加载批量任务列表和基本交互
 */

import { showModal } from '../../components/modal.js';
import { setupFilteringAndSearch } from '../../components/tableHelper.js';
// import { BatchTaskManager } from './batchTaskManager.js'; // 暂时注释，新的管理器将不同
// import { renderTaskDetail } from './taskDetail.js'; // 暂时注释
// import { createBatchTask } from './createTask.js'; // 暂时注释
// import { TaskLogger } from './logger.js'; // 暂时注释

// 页面引用
let contentAreaRef = null;
// 当前视图模式：'cards'(卡片列表) 或 'manager'(管理界面)
let currentView = 'cards';
// 当前选择的批量脚本类型信息 (从卡片传递)
let currentBatchScriptType = null; // 这个变量将保存被点击卡片的完整 scriptData

// 预定义的批量脚本卡片数据 - 保持不变
const batchScriptTypes = [
    {
        id: 'multi-account-batch',
        name: '多账户批量执行',
        description: '同时在多个账户上执行相同脚本',
        imageUrl: 'https://public.rootdata.com/images/b6/1739179963586.jpg',
        category: '基础功能',
        status: 'active'
    },
    {
        id: 'scheduled-tasks',
        name: '定时任务',
        description: '设置定时执行的批量脚本任务',
        imageUrl: 'https://public.rootdata.com/images/b6/1724653592563.jpg',
        category: '高级功能',
        status: 'active'
    },
    {
        id: 'monitor-task',
        name: '监控执行',
        description: '设置条件触发的监控执行脚本',
        imageUrl: 'https://public.rootdata.com/images/b6/1706063422799.jpg',
        category: '高级功能',
        status: 'active'
    },
    {
        id: 'chain-tasks',
        name: '链式任务',
        description: '多个脚本按顺序依次执行',
        imageUrl: 'https://public.rootdata.com/images/b12/1712038428629.jpg',
        category: '高级功能',
        status: 'coming'
    },
    {
        id: 'custom-batch',
        name: '自定义批量任务',
        description: '创建自定义批量执行方案',
        imageUrl: 'https://public.rootdata.com/images/b61/1743413886455.jpg',
        category: '基础功能',
        status: 'active'
    },
    {
        id: 'parallel-batch',
        name: '并行多任务',
        description: '并行执行多个不同脚本任务',
        imageUrl: 'https://public.rootdata.com/images/b56/1740061558242.jpg', 
        category: '高级功能',
        status: 'active'
    },
    {
        id: 'wallet-group-batch',
        name: '分组批量执行',
        description: '按钱包分组执行不同任务',
        imageUrl: 'https://public.rootdata.com/images/b13/1747108298474.jpg',
        category: '高级功能',
        status: 'active'
    },
    {
        id: 'error-retry-batch',
        name: '智能错误重试',
        description: '出错自动重试的批量任务',
        imageUrl: 'https://public.rootdata.com/images/b44/1724770395787.png',
        category: '基础功能',
        status: 'active'
    }
];

// 模块定义，用于导航和内容加载
const modules = [
    { id: 'basic-info', name: '基本信息', icon: 'fas fa-info-circle' },
    { id: 'script-selection', name: '脚本选择', icon: 'fas fa-code' },
    { id: 'account-config', name: '账户配置', icon: 'fas fa-users' },
    { id: 'proxy-settings', name: '代理设置', icon: 'fas fa-network-wired' },
    { id: 'params-config', name: '参数配置', icon: 'fas fa-sliders-h' },
    { id: 'execution-settings', name: '执行设置', icon: 'fas fa-cogs' },
    { id: 'monitor-panel', name: '监控面板', icon: 'fas fa-chart-line' }
];

let currentModuleIndex = 0; // 当前激活模块的索引
const moduleOrder = [
    "basic-info",
    "script-selection",
    "account-config",
    "proxy-settings",
    "param-config",
    "execution-settings",
    "monitoring-panel"
];

// 存储每个脚本卡片(任务实例)对应的任务配置数据
// 使用 scriptData.id 作为 key
const batchTaskConfigs = {};

/**
 * 初始化批量脚本管理页面
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export function initBatchScriptsPage(contentArea) {
    console.log("初始化批量脚本管理页面...");
    contentAreaRef = contentArea;
    renderBatchScriptCardsView(contentArea); // 默认显示卡片入口
}

/**
 * 渲染批量脚本卡片视图
 * @param {HTMLElement} contentArea - 内容区域元素
 */
function renderBatchScriptCardsView(contentArea) {
    currentView = 'cards';
    // 从模板加载卡片页面的HTML结构
    const cardsPageTemplate = document.getElementById('batchScriptCardsPage'); // 这是整个卡片页的容器
    if (!cardsPageTemplate) {
        console.error('未找到批量脚本卡片页容器！');
        contentArea.innerHTML = '<p>错误：无法加载批量脚本页面。</p>';
        return;
    }
    // 将模板内容（不包括模板标签自身）插入到 contentArea
    // 注意：这里需要确保 batchScriptCardsPage ID 的元素确实是卡片页面的HTML结构，而不是模板标签
    // 如果 batchScriptCardsPage 本身就是内容区域，则不需要innerHTML赋值
    // 但通常主内容区域是动态的，所以我们会清空并填充
    
    // 安全起见，直接使用模板定义的 HTML 结构，避免依赖主 index.html 已有结构
    const cardViewHtml = `
    <div class="page-header">
        <h1>批量脚本</h1>
        <p>高效管理多账户脚本执行，批量处理多任务</p>
        <div class="header-actions">
            <button id="refresh-batch-scripts-btn" class="btn btn-secondary"><i class="fas fa-sync-alt"></i> 刷新列表</button>
        </div>
    </div>
    <div class="scripts-filter-bar">
        <div class="search-box">
            <input type="text" id="batchScriptSearchInput" placeholder="搜索批量脚本...">
            <i class="fas fa-search"></i>
        </div>
        <div class="filter-actions">
            <select id="batchScriptTypeFilter">
                <option value="">全部分类</option>
            </select>
            <select id="batchScriptStatusFilter">
                <option value="">全部状态</option>
                <option value="active">可用</option>
            </select>
        </div>
    </div>
    <div class="script-cards-grid" id="batchScriptCardsContainer"></div>`;
    
    contentArea.innerHTML = cardViewHtml;
    
    // 绑定刷新按钮事件
    const refreshBtn = contentArea.querySelector('#refresh-batch-scripts-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadAndRenderBatchScriptCards(contentArea); // 重新加载卡片数据
        });
    }
    
    loadAndRenderBatchScriptCards(contentArea); // 加载并渲染脚本卡片
    setupFilteringFunction(contentArea); // 设置搜索和筛选功能
}


/**
 * 加载并渲染批量脚本卡片
 * @param {HTMLElement} pageContentArea - 卡片页面的内容区域
 */
function loadAndRenderBatchScriptCards(pageContentArea) {
    const cardsContainer = pageContentArea.querySelector('#batchScriptCardsContainer');
    const typeFilterElement = pageContentArea.querySelector('#batchScriptTypeFilter');
    const statusFilterElement = pageContentArea.querySelector('#batchScriptStatusFilter');
    
    if (!cardsContainer) {
        console.error('卡片容器 #batchScriptCardsContainer 未在卡片视图中找到。');
        return;
    }
    
    cardsContainer.innerHTML = ''; // 清空卡片容器
    
    batchScriptTypes.forEach(scriptType => {
        const card = createBatchScriptCard(scriptType);
        cardsContainer.appendChild(card);
    });
    
    populateFilters(typeFilterElement, statusFilterElement, batchScriptTypes);
}

/**
 * 创建批量脚本卡片 - 保持不变
 * @param {Object} scriptData - 脚本数据
 * @returns {HTMLElement} 脚本卡片元素
 */
function createBatchScriptCard(scriptData) {
    const card = document.createElement('div');
    card.className = 'script-card';
    card.dataset.id = scriptData.id;
    card.dataset.category = scriptData.category || '';
    card.dataset.status = scriptData.status || 'active';
    
    let iconHTML;
    if (scriptData.imageUrl) {
        iconHTML = `<div class="card-icon"><img src="${scriptData.imageUrl}" alt="${scriptData.name}" class="script-image"></div>`;
    } else if (scriptData.icon) {
        iconHTML = `<div class="card-icon fa-icon"><i class="${scriptData.icon || 'fas fa-code'}"></i></div>`;
    } else {
        iconHTML = `<div class="card-icon code-icon"><i class="fas fa-code"></i></div>`;
    }
    
    card.innerHTML = `
        ${iconHTML}
        <div class="card-content">
            <h3 class="card-title">${scriptData.name}</h3>
            <p class="card-description">${scriptData.description || ''}</p>
        </div>
    `;
    
    card.addEventListener('click', () => {
        currentBatchScriptType = scriptData; // 保存选中的卡片类型信息
        navigateToModularTaskManager();
    });
    
    return card;
}

/**
 * 设置筛选功能 - 保持不变
 * @param {HTMLElement} contentArea - 内容区域元素
 */
function setupFilteringFunction(contentArea) {
    const searchInput = contentArea.querySelector('#batchScriptSearchInput');
    const typeFilter = contentArea.querySelector('#batchScriptTypeFilter');
    const statusFilter = contentArea.querySelector('#batchScriptStatusFilter');
    const cardsGrid = contentArea.querySelector('#batchScriptCardsContainer');
    
    if (!searchInput || !typeFilter || !statusFilter || !cardsGrid) return;
    
    setupFilteringAndSearch(
        contentArea,
        '.scripts-filter-bar',
        '.script-card',
        (card, filters) => {
            const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
            const description = card.querySelector('.card-description')?.textContent.toLowerCase() || '';
            const category = card.dataset.category?.toLowerCase() || '';
            const status = card.dataset.status?.toLowerCase() || '';
            
            const searchTerm = filters.search || '';
            if (searchTerm && !title.includes(searchTerm) && !description.includes(searchTerm)) return false;
            if (filters.batchScriptTypeFilter && filters.batchScriptTypeFilter !== '' && category !== filters.batchScriptTypeFilter) return false;
            if (filters.batchScriptStatusFilter && filters.batchScriptStatusFilter !== '' && status !== filters.batchScriptStatusFilter) return false;
            return true;
        }
    );
}

/**
 * 填充筛选器选项 - 保持不变
 * @param {HTMLSelectElement} typeFilterElement - 类型筛选下拉框
 * @param {HTMLSelectElement} statusFilterElement - 状态筛选下拉框
 * @param {Array} scriptData - 脚本数据数组
 */
function populateFilters(typeFilterElement, statusFilterElement, scriptData) {
    if (!typeFilterElement || !statusFilterElement) return;
    
    const categories = new Set();
    const statuses = new Set();
    scriptData.forEach(script => {
        if (script.category) categories.add(script.category);
        if (script.status) statuses.add(script.status);
    });
    
    typeFilterElement.innerHTML = '<option value="">全部分类</option>';
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.toLowerCase();
        option.textContent = category;
        typeFilterElement.appendChild(option);
    });
    
    statusFilterElement.innerHTML = '<option value="">全部状态</option>';
    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status.toLowerCase();
        option.textContent = status === 'active' ? '可用' : 
                             status === 'coming' ? '即将推出' : 
                             status === 'deprecated' ? '已弃用' : status;
        statusFilterElement.appendChild(option);
    });
}

/**
 * 导航到模块化任务管理器视图
 */
function navigateToModularTaskManager(taskInstanceId) {
    currentView = 'manager';
    if (!contentAreaRef || !currentBatchScriptType) return;

    const managerTemplate = document.getElementById('tpl-modular-batch-task-manager');
    if (!managerTemplate || !managerTemplate.innerHTML.trim()) {
        console.error('模块化任务管理器模板未找到或为空!');
        contentAreaRef.innerHTML = '<p>错误: 无法加载任务配置界面模板。</p>';
        return;
    }

    const managerNode = managerTemplate.content.cloneNode(true);
    contentAreaRef.innerHTML = '';
    contentAreaRef.appendChild(managerNode);
    
    const managerTitle = contentAreaRef.querySelector('#modular-manager-title');
    if (managerTitle && currentBatchScriptType) {
        managerTitle.textContent = `配置批量任务: ${currentBatchScriptType.name}`;
    }

    if (!batchTaskConfigs[taskInstanceId]) {
        batchTaskConfigs[taskInstanceId] = {
            scriptTypeId: currentBatchScriptType.id,
            basicInfo: { 
                taskName: `${currentBatchScriptType.name} - 新任务`,
                taskDescription: currentBatchScriptType.description || '',
                taskTags: currentBatchScriptType.category || '' 
            },
            scriptSelection: { selectedScriptPath: null, scriptParamsSchema: null },
            accountConfig: { accounts: [], accountType: 'privateKey' },
            proxySettings: { proxies: [], assignmentStrategy: 'round-robin' },
            paramConfig: { globalParams: {}, accountSpecificParams: {} },
            executionSettings: { concurrentTasks: 1, taskInterval: 0, retryAttempts: 0, randomDelayMin:0, randomDelayMax:0 },
        };
        console.log(`为 ${taskInstanceId} 初始化了配置: `, batchTaskConfigs[taskInstanceId]);
    }
    
    currentModuleIndex = 0; 
    bindModularManagerEvents(taskInstanceId);
    // loadModuleContent 会在 bindModularManagerEvents 内部首次调用，或者在bind之后立即调用以加载初始模块
    //确保初始模块被加载并且导航按钮被更新
    loadModuleContent(moduleOrder[currentModuleIndex], taskInstanceId); 
    updateModuleNavigationButtons(taskInstanceId); 
}

/**
 * 为模块化管理器绑定事件
 * @param {string} taskInstanceId - 当前配置的任务实例的唯一ID
 */
function bindModularManagerEvents(taskInstanceId) {
    const modularManagerPage = contentAreaRef.querySelector('.modular-manager-page');
    if (!modularManagerPage) {
        console.error("Modular manager page element not found in DOM for binding events.");
        return;
    }

    const backToCardsButton = modularManagerPage.querySelector('.back-to-cards-button');
    if (backToCardsButton) {
        backToCardsButton.addEventListener('click', (event) => {
            event.preventDefault();
            saveCurrentModuleData(taskInstanceId); 
            renderBatchScriptCardsView(); 
        });
    }

    const moduleLinks = modularManagerPage.querySelectorAll('.module-links a');
    moduleLinks.forEach(link => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            saveCurrentModuleData(taskInstanceId); 
            const moduleId = link.dataset.module;
            currentModuleIndex = moduleOrder.indexOf(moduleId);
            loadModuleContent(moduleId, taskInstanceId);
            updateModuleNavigationButtons(taskInstanceId); 
        });
    });

    const prevButton = modularManagerPage.querySelector('#prev-module-btn');
    const nextButton = modularManagerPage.querySelector('#next-module-btn');
    const startTaskButton = modularManagerPage.querySelector('#start-task-btn');

    if (prevButton) {
        prevButton.addEventListener('click', (event) => {
            event.preventDefault();
            saveCurrentModuleData(taskInstanceId); 
            if (currentModuleIndex > 0) {
                currentModuleIndex--;
                loadModuleContent(moduleOrder[currentModuleIndex], taskInstanceId);
                updateModuleNavigationButtons(taskInstanceId);
            }
        });
    }

    if (nextButton) {
        nextButton.addEventListener('click', (event) => {
            event.preventDefault();
            saveCurrentModuleData(taskInstanceId); 
            if (currentModuleIndex < moduleOrder.length - 1) {
                currentModuleIndex++;
                loadModuleContent(moduleOrder[currentModuleIndex], taskInstanceId);
                updateModuleNavigationButtons(taskInstanceId);
            }
        });
    }

    if (startTaskButton) {
        startTaskButton.addEventListener('click', (event) => {
            event.preventDefault();
            saveCurrentModuleData(taskInstanceId); 
            console.log(`尝试为 ${taskInstanceId} 启动任务，配置如下:`, batchTaskConfigs[taskInstanceId]);
            alert(`启动任务: ${taskInstanceId}\n类型: ${currentBatchScriptType.name}\n配置: ${JSON.stringify(batchTaskConfigs[taskInstanceId], null, 2)}\n(功能开发中)`);
        });
    }
    // 移除之前可能存在的初始调用，因为 navigateToModularTaskManager 末尾会调用 loadModuleContent 和 updateModuleNavigationButtons
}

/**
 * 加载指定模块的内容到显示区域
 * @param {string} moduleId - 要加载的模块ID
 */
function loadModuleContent(moduleId, taskInstanceId) {
    console.log(`加载模块内容: ${moduleId} for task ${taskInstanceId}`);
    const contentDisplay = contentAreaRef.querySelector('#module-content-display');
    if (!contentDisplay) {
        console.error('模块内容显示区域 #module-content-display 未找到!');
        return;
    }

    const currentTaskConfig = batchTaskConfigs[taskInstanceId] || {};
    let htmlContent = '';

    // HTML模板字符串，确保所有内部的反引号和 ${} 都被正确转义以适应 edit_file
    switch (moduleId) {
        case 'basic-info':
            const basicInfo = currentTaskConfig.basicInfo || { taskName: '', taskDescription: '', taskTags: '' };
            htmlContent = `
                <div id="module-basic-info" class="module-content-panel active-module">
                    <h3>1. 基本信息</h3>
                    <p>为您的批量任务设置一个清晰的名称、详细的描述和相关的标签，方便后续查找和管理。</p>
                    <form id="basic-info-form" class="module-form">
                        <div class="form-group">
                            <label for="task-name-${taskInstanceId}">任务名称:</label>
                            <input type="text" id="task-name-${taskInstanceId}" name="task-name" value="${basicInfo.taskName}" required placeholder="例如：每日签到任务-${taskInstanceId.substring(0,4)}">
                        </div>
                        <div class="form-group">
                            <label for="task-description-${taskInstanceId}">任务描述:</label>
                            <textarea id="task-description-${taskInstanceId}" name="task-description" rows="4" placeholder="例如：执行所有账户的XX平台每日签到脚本，领取积分。">${basicInfo.taskDescription}</textarea>
                        </div>
                        <div class="form-group">
                            <label for="task-tags-${taskInstanceId}">标签 (逗号分隔):</label>
                            <input type="text" id="task-tags-${taskInstanceId}" name="task-tags" value="${basicInfo.taskTags}" placeholder="例如：签到, 日常, XX平台">
                        </div>
                    </form>
                </div>
            `;
            break;
        case 'script-selection':
             const scriptSelection = currentTaskConfig.scriptSelection || { selectedScriptPath: '', scriptParamsSchema: null };
            htmlContent = `
                <div id="module-script-selection" class="module-content-panel active-module">
                    <h3>2. 脚本选择</h3>
                    <p>选择您希望在此批量任务中执行的脚本。系统会自动检测并提示所需参数。</p>
                    <div class="form-group">
                        <label for="script-path-${taskInstanceId}">脚本文件路径:</label>
                        <input type="text" id="script-path-${taskInstanceId}" name="script-path" value="${scriptSelection.selectedScriptPath || ''}" placeholder="例如：user_scripts/scripts/my_awesome_script.js">
                        <button id="browse-script-${taskInstanceId}" class="btn btn-secondary btn-sm">浏览...</button>
                    </div>
                    <div id="script-params-info-${taskInstanceId}">
                        ${scriptSelection.scriptParamsSchema ? `<pre>${JSON.stringify(scriptSelection.scriptParamsSchema, null, 2)}</pre>` : '<p>选择脚本后将显示所需参数信息。</p>'}
                    </div>
                    <p><em>脚本选择和参数解析功能正在开发中...</em></p>
                </div>
            `;
            break;
        case 'account-config':
            const accountConfig = currentTaskConfig.accountConfig || { accounts: [], accountType: 'privateKey' };
            htmlContent = `
                <div id="module-account-config" class="module-content-panel active-module">
                    <h3>3. 账户配置</h3>
                    <p>配置执行脚本所需的账户信息。您可以导入多种类型的账户。</p>
                     <div class="form-group">
                        <label for="account-type-${taskInstanceId}">账户类型:</label>
                        <select id="account-type-${taskInstanceId}" name="account-type">
                            <option value="privateKey" ${accountConfig.accountType === 'privateKey' ? 'selected' : ''}>钱包私钥</option>
                            <option value="mnemonic" ${accountConfig.accountType === 'mnemonic' ? 'selected' : ''}>助记词</option>
                            <option value="apiKeys" ${accountConfig.accountType === 'apiKeys' ? 'selected' : ''}>API密钥对</option>
                            <option value="usernamePassword" ${accountConfig.accountType === 'usernamePassword' ? 'selected' : ''}>用户名/密码</option>
                            <option value="cookies" ${accountConfig.accountType === 'cookies' ? 'selected' : ''}>Cookies</option>
                            <option value="custom" ${accountConfig.accountType === 'custom' ? 'selected' : ''}>自定义文本</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="accounts-input-${taskInstanceId}">账户列表 (每行一个):</label>
                        <textarea id="accounts-input-${taskInstanceId}" name="accounts-input" rows="5" placeholder="在此处输入账户信息，每行一个账户。\n例如私钥：\n0xabcdef12345... \n0x12345abcdef...">${accountConfig.accounts.join('\n')}</textarea>
                    </div>
                    <button id="import-accounts-${taskInstanceId}" class="btn btn-secondary btn-sm">从文件导入</button>
                    <p>已配置账户数量: <span id="account-count-${taskInstanceId}">${accountConfig.accounts.length}</span></p>
                    <p><em>账户导入和验证功能正在开发中...</em></p>
                </div>
            `;
            break;
        case 'proxy-settings':
            const proxySettings = currentTaskConfig.proxySettings || { proxies: [], assignmentStrategy: 'round-robin' };
            htmlContent = `
                <div id="module-proxy-settings" class="module-content-panel active-module">
                    <h3>4. 代理设置</h3>
                    <p>为您的任务配置代理服务器。支持多种格式，并可以为每个账户或任务分配独立代理。</p>
                    <div class="form-group">
                        <label for="proxy-input-${taskInstanceId}">代理列表 (每行一个):</label>
                        <textarea id="proxy-input-${taskInstanceId}" name="proxy-input" rows="5" placeholder="例如: http://user:pass@host:port 或 socks5://host:port">${proxySettings.proxies.join('\n')}</textarea>
                    </div>
                     <div class="form-group">
                        <label for="proxy-assignment-${taskInstanceId}">代理分配策略:</label>
                        <select id="proxy-assignment-${taskInstanceId}" name="proxy-assignment">
                            <option value="round-robin" ${proxySettings.assignmentStrategy === 'round-robin' ? 'selected' : ''}>轮询分配给账户</option>
                            <option value="sticky" ${proxySettings.assignmentStrategy === 'sticky' ? 'selected' : ''}>固定分配 (账户对应代理)</option>
                            <option value="global" ${proxySettings.assignmentStrategy === 'global' ? 'selected' : ''}>全局轮询 (所有请求)</option>
                        </select>
                    </div>
                    <button id="import-proxies-${taskInstanceId}" class="btn btn-secondary btn-sm">从文件导入</button>
                     <p>已配置代理数量: <span id="proxy-count-${taskInstanceId}">${proxySettings.proxies.length}</span></p>
                    <p><em>代理格式验证和分配逻辑正在开发中...</em></p>
                </div>
            `;
            break;
        case 'param-config':
            const paramConfig = currentTaskConfig.paramConfig || { globalParams: {}, accountSpecificParams: {} };
            htmlContent = `
                <div id="module-param-config" class="module-content-panel active-module">
                    <h3>5. 参数配置</h3>
                    <p>根据所选脚本的要求，配置必要的运行参数。此处参数将应用于所有账户，特定账户的参数可在高级设置中调整。</p>
                    <div id="global-params-container-${taskInstanceId}">
                        <p><em>根据 "脚本选择" 模块动态生成参数表单...</em></p>
                        <!-- 示例: -->
                        <!-- <div class="form-group">
                            <label for="param-example-${taskInstanceId}">示例参数:</label>
                            <input type="text" id="param-example-${taskInstanceId}" name="param-example" value="${paramConfig.globalParams?.example || ''}">
                        </div> -->
                    </div>
                     <p><em>动态参数表单及账户特定参数配置正在开发中...</em></p>
                </div>
            `;
            break;
        case 'execution-settings':
            const execSettings = currentTaskConfig.executionSettings || { concurrentTasks: 1, taskInterval: 0, retryAttempts: 0, randomDelayMin:0, randomDelayMax:0 };
            htmlContent = `
                <div id="module-execution-settings" class="module-content-panel active-module">
                    <h3>6. 执行设置</h3>
                    <p>设置任务的执行方式，如并发数、执行间隔、失败重试策略等。</p>
                    <form id="execution-settings-form-${taskInstanceId}" class="module-form">
                        <div class="form-group">
                            <label for="concurrent-tasks-${taskInstanceId}">并发账户数:</label>
                            <input type="number" id="concurrent-tasks-${taskInstanceId}" name="concurrent-tasks" min="1" value="${execSettings.concurrentTasks}">
                        </div>
                        <div class="form-group">
                            <label for="task-interval-${taskInstanceId}">任务执行间隔 (毫秒):</label>
                            <input type="number" id="task-interval-${taskInstanceId}" name="task-interval" min="0" value="${execSettings.taskInterval}" placeholder="每个账户执行完毕后的等待时间">
                        </div>
                         <div class="form-group">
                            <label for="random-delay-min-${taskInstanceId}">随机延迟范围 (最小毫秒):</label>
                            <input type="number" id="random-delay-min-${taskInstanceId}" name="random-delay-min" min="0" value="${execSettings.randomDelayMin || 0}" placeholder="例如 1000">
                        </div>
                        <div class="form-group">
                            <label for="random-delay-max-${taskInstanceId}">随机延迟范围 (最大毫秒):</label>
                            <input type="number" id="random-delay-max-${taskInstanceId}" name="random-delay-max" min="0" value="${execSettings.randomDelayMax || 0}" placeholder="例如 5000">
                        </div>
                        <div class="form-group">
                            <label for="retry-attempts-${taskInstanceId}">失败重试次数:</label>
                            <input type="number" id="retry-attempts-${taskInstanceId}" name="retry-attempts" min="0" value="${execSettings.retryAttempts}">
                        </div>
                    </form>
                    <p><em>更多高级执行设置 (如 IP 绑定策略、错误处理回调) 正在开发中...</em></p>
                </div>
            `;
            break;
        case 'monitoring-panel':
             // 在监控面板加载时，确保配置是最新的
            const latestConfigForMonitoring = batchTaskConfigs[taskInstanceId] || {};
            htmlContent = `
                <div id="module-monitoring-panel" class="module-content-panel active-module">
                    <h3>7. 监控与执行</h3>
                    <p>任务配置完成后，您可以在此启动任务，并实时监控执行状态、查看日志、进行必要的操作（如暂停、停止）。</p>
                    <div id="task-summary-${taskInstanceId}">
                        <h4>任务配置总览:</h4>
                        <pre id="config-summary-display-${taskInstanceId}">${JSON.stringify(latestConfigForMonitoring, null, 2)}</pre>
                    </div>
                    <div id="task-controls-${taskInstanceId}" style="margin-top: 20px;">
                         <!-- 启动按钮已在底部栏提供 -->
                    </div>
                    <div id="task-logs-${taskInstanceId}" style="margin-top: 20px; max-height: 300px; overflow-y: auto; border: 1px solid #ccc; padding:10px; background:#f9f9f9;">
                        <p><em>任务日志将在此显示... (开发中)</em></p>
                    </div>
                </div>
            `;
            break;
        default:
            htmlContent = '<p>未知模块或模块正在建设中。</p>';
            console.warn(`Unknown module ID: ${moduleId}`);
    }
    contentDisplay.innerHTML = htmlContent;
    bindModuleSpecificInputEvents(moduleId, taskInstanceId);
}

/**
 * 处理模块间的导航（上一步/下一步）
 * @param {number} direction - 1表示下一步, -1表示上一步
 */
function navigateModules(direction) {
    const currentIndex = modules.findIndex(m => m.id === currentModule);
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < modules.length) {
        const nextModuleId = modules[nextIndex].id;
        // 更新导航栏的激活状态
        const navLinks = contentAreaRef.querySelectorAll('.module-navigation li');
        navLinks.forEach(li => {
            li.classList.toggle('active', li.dataset.module === nextModuleId);
        });
        loadModuleContent(nextModuleId);
    }
}

/**
 * 更新模块导航按钮（上一步/下一步/开始执行）的启用/禁用状态和可见性
 */
function updateModuleNavigationButtons(taskInstanceId) {
    const modularManagerPage = contentAreaRef.querySelector('.modular-manager-page');
    if (!modularManagerPage) return;

    const prevButton = modularManagerPage.querySelector('#prev-module-btn');
    const nextButton = modularManagerPage.querySelector('#next-module-btn');
    const startTaskButton = modularManagerPage.querySelector('#start-task-btn');
    const moduleLinks = modularManagerPage.querySelectorAll('.module-links a');

    moduleLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.module === moduleOrder[currentModuleIndex]) {
            link.classList.add('active');
        }
    });

    if (prevButton) {
        prevButton.disabled = currentModuleIndex === 0;
    }
    if (nextButton) {
        nextButton.style.display = (currentModuleIndex === moduleOrder.length - 1) ? 'none' : 'inline-block';
    }
    if (startTaskButton) {
        startTaskButton.style.display = (currentModuleIndex === moduleOrder.length - 1) ? 'inline-block' : 'none';
        if (moduleOrder[currentModuleIndex] === 'monitoring-panel' && taskInstanceId && batchTaskConfigs[taskInstanceId]) {
             const summaryDisplay = document.getElementById(`config-summary-display-${taskInstanceId}`);
             if (summaryDisplay) {
                summaryDisplay.textContent = JSON.stringify(batchTaskConfigs[taskInstanceId], null, 2);
            }
        }
    }
}

/**
 * 为特定模块内的输入元素绑定事件，以便实时更新配置对象
 * @param {string} moduleId - 当前模块的ID
 * @param {string} taskInstanceId - 当前任务实例的ID
 */
function bindModuleSpecificInputEvents(moduleId, taskInstanceId) {
    const currentTaskConfig = batchTaskConfigs[taskInstanceId];
    if (!currentTaskConfig) {
        console.warn(`bindModuleSpecificInputEvents: 未找到任务配置 for ${taskInstanceId}`);
        return;
    }

    switch (moduleId) {
        case 'basic-info':
            const basicInfoForm = document.getElementById('basic-info-form');
            if (basicInfoForm) {
                basicInfoForm.addEventListener('input', (event) => {
                    const target = event.target;
                    if (target.name === 'task-name') currentTaskConfig.basicInfo.taskName = target.value;
                    else if (target.name === 'task-description') currentTaskConfig.basicInfo.taskDescription = target.value;
                    else if (target.name === 'task-tags') currentTaskConfig.basicInfo.taskTags = target.value;
                });
            }
            break;
        case 'script-selection':
            const scriptPathInput = document.getElementById(`script-path-${taskInstanceId}`);
            if (scriptPathInput) {
                scriptPathInput.addEventListener('input', (event) => {
                    currentTaskConfig.scriptSelection.selectedScriptPath = event.target.value;
                });
            }
            break;
        case 'account-config':
            const accountTypeSelect = document.getElementById(`account-type-${taskInstanceId}`);
            const accountsInputArea = document.getElementById(`accounts-input-${taskInstanceId}`);
            const accountCountDisplay = document.getElementById(`account-count-${taskInstanceId}`);
            if (accountTypeSelect) {
                accountTypeSelect.addEventListener('change', (event) => {
                    currentTaskConfig.accountConfig.accountType = event.target.value;
                });
            }
            if (accountsInputArea && accountCountDisplay) {
                 accountsInputArea.addEventListener('input', (event) => {
                    const lines = event.target.value.split('\n').map(line => line.trim()).filter(line => line);
                    currentTaskConfig.accountConfig.accounts = lines;
                    accountCountDisplay.textContent = lines.length;
                });
            }
            break;
        case 'proxy-settings':
            const proxyInputArea = document.getElementById(`proxy-input-${taskInstanceId}`);
            const proxyAssignmentSelect = document.getElementById(`proxy-assignment-${taskInstanceId}`);
            const proxyCountDisplay = document.getElementById(`proxy-count-${taskInstanceId}`);

            if (proxyInputArea && proxyCountDisplay) {
                proxyInputArea.addEventListener('input', (event) => {
                    const lines = event.target.value.split('\n').map(line => line.trim()).filter(line => line);
                    currentTaskConfig.proxySettings.proxies = lines;
                    proxyCountDisplay.textContent = lines.length;
                });
            }
            if (proxyAssignmentSelect) {
                proxyAssignmentSelect.addEventListener('change', (event) => {
                    currentTaskConfig.proxySettings.assignmentStrategy = event.target.value;
                });
            }
            break;
        case 'execution-settings':
            const execForm = document.getElementById(`execution-settings-form-${taskInstanceId}`);
            if (execForm) {
                execForm.addEventListener('input', (event) => {
                    const target = event.target;
                    let value = target.type === 'number' ? parseFloat(target.value) : target.value;
                    if (target.type === 'number' && isNaN(value) && target.value !== '') return; 
                    if (target.type === 'number' && target.value === '') value = 0; 

                    const settings = currentTaskConfig.executionSettings;
                    if (target.name === 'concurrent-tasks') settings.concurrentTasks = Math.max(1, parseInt(value, 10) || 1);
                    else if (target.name === 'task-interval') settings.taskInterval = Math.max(0, parseInt(value, 10) || 0);
                    else if (target.name === 'retry-attempts') settings.retryAttempts = Math.max(0, parseInt(value, 10) || 0);
                    else if (target.name === 'random-delay-min') settings.randomDelayMin = Math.max(0, parseInt(value, 10) || 0);
                    else if (target.name === 'random-delay-max') settings.randomDelayMax = Math.max(0, parseInt(value, 10) || 0);

                    if (settings.randomDelayMin > settings.randomDelayMax) {
                        if (target.name === 'random-delay-min') {
                             settings.randomDelayMax = settings.randomDelayMin;
                             const maxInput = document.getElementById(`random-delay-max-${taskInstanceId}`);
                             if(maxInput) maxInput.value = settings.randomDelayMax;
                        } else if (target.name === 'random-delay-max' && settings.randomDelayMax < settings.randomDelayMin) {
                            settings.randomDelayMin = settings.randomDelayMax; // Correction: if max is pulled below min, min should follow max
                            const minInput = document.getElementById(`random-delay-min-${taskInstanceId}`);
                            if(minInput) minInput.value = settings.randomDelayMin;
                        }
                    }
                     // Update the other field if one is changed to make min > max
                    if (target.name === 'random-delay-min' && settings.randomDelayMin > settings.randomDelayMax) {
                        settings.randomDelayMax = settings.randomDelayMin;
                        const maxInput = document.getElementById(`random-delay-max-${taskInstanceId}`);
                        if (maxInput) maxInput.value = settings.randomDelayMax;
                    } else if (target.name === 'random-delay-max' && settings.randomDelayMax < settings.randomDelayMin) {
                         settings.randomDelayMin = settings.randomDelayMax;
                         const minInput = document.getElementById(`random-delay-min-${taskInstanceId}`);
                         if (minInput) minInput.value = settings.randomDelayMin;
                    }
                });
            }
            break;
        default:
            break;
    }
}

/**
 * 保存当前激活模块的数据到 batchTaskConfigs
 * @param {string} taskInstanceId - 当前配置的任务实例的ID
 */
function saveCurrentModuleData(taskInstanceId) {
    if (!taskInstanceId || !batchTaskConfigs[taskInstanceId]) {
        return;
    }

    const currentConfig = batchTaskConfigs[taskInstanceId];
    const moduleId = moduleOrder[currentModuleIndex]; 

    switch (moduleId) {
        case 'basic-info':
            const taskNameInput = document.getElementById(`task-name-${taskInstanceId}`);
            const taskDescInput = document.getElementById(`task-description-${taskInstanceId}`);
            const taskTagsInput = document.getElementById(`task-tags-${taskInstanceId}`);
            if (taskNameInput) currentConfig.basicInfo.taskName = taskNameInput.value;
            if (taskDescInput) currentConfig.basicInfo.taskDescription = taskDescInput.value;
            if (taskTagsInput) currentConfig.basicInfo.taskTags = taskTagsInput.value;
            break;
        case 'script-selection':
            const scriptPathInput = document.getElementById(`script-path-${taskInstanceId}`);
            if (scriptPathInput) currentConfig.scriptSelection.selectedScriptPath = scriptPathInput.value;
            break;
        case 'account-config':
            const accountTypeSelect = document.getElementById(`account-type-${taskInstanceId}`);
            const accountsInputArea = document.getElementById(`accounts-input-${taskInstanceId}`);
            if (accountTypeSelect) currentConfig.accountConfig.accountType = accountTypeSelect.value;
            if (accountsInputArea) {
                currentConfig.accountConfig.accounts = accountsInputArea.value.split('\n').map(l => l.trim()).filter(l => l);
                const accountCountDisplay = document.getElementById(`account-count-${taskInstanceId}`);
                if(accountCountDisplay) accountCountDisplay.textContent = currentConfig.accountConfig.accounts.length;
            }
            break;
        case 'proxy-settings':
            const proxyInputArea = document.getElementById(`proxy-input-${taskInstanceId}`);
            const proxyAssignmentSelect = document.getElementById(`proxy-assignment-${taskInstanceId}`);
            if (proxyInputArea) {
                 currentConfig.proxySettings.proxies = proxyInputArea.value.split('\n').map(l => l.trim()).filter(l => l);
                 const proxyCountDisplay = document.getElementById(`proxy-count-${taskInstanceId}`);
                 if(proxyCountDisplay) proxyCountDisplay.textContent = currentConfig.proxySettings.proxies.length;
            }
            if (proxyAssignmentSelect) currentConfig.proxySettings.assignmentStrategy = proxyAssignmentSelect.value;
            break;
        case 'execution-settings':
            const execForm = document.getElementById(`execution-settings-form-${taskInstanceId}`);
            if (execForm) { 
                const concurrentInput = execForm.querySelector(`#concurrent-tasks-${taskInstanceId}`);
                const intervalInput = execForm.querySelector(`#task-interval-${taskInstanceId}`);
                const retryInput = execForm.querySelector(`#retry-attempts-${taskInstanceId}`);
                const delayMinInput = execForm.querySelector(`#random-delay-min-${taskInstanceId}`);
                const delayMaxInput = execForm.querySelector(`#random-delay-max-${taskInstanceId}`);
                const settings = currentConfig.executionSettings;

                if (concurrentInput) settings.concurrentTasks = Math.max(1, parseInt(concurrentInput.value, 10) || 1);
                if (intervalInput) settings.taskInterval = Math.max(0, parseInt(intervalInput.value, 10) || 0);
                if (retryInput) settings.retryAttempts = Math.max(0, parseInt(retryInput.value, 10) || 0);
                if (delayMinInput) settings.randomDelayMin = Math.max(0, parseInt(delayMinInput.value, 10) || 0);
                if (delayMaxInput) settings.randomDelayMax = Math.max(0, parseInt(delayMaxInput.value, 10) || 0);
                
                if (settings.randomDelayMin > settings.randomDelayMax) {
                     settings.randomDelayMax = settings.randomDelayMin;
                     if(delayMaxInput) delayMaxInput.value = settings.randomDelayMax;
                } else if (settings.randomDelayMax < settings.randomDelayMin) { // Should not happen if min pushes max, but as a safeguard
                    settings.randomDelayMin = settings.randomDelayMax;
                    if(delayMinInput) delayMinInput.value = settings.randomDelayMin;
                }
            }
            break;
        case 'monitoring-panel':
            const summaryDisplay = document.getElementById(`config-summary-display-${taskInstanceId}`);
            if (summaryDisplay && batchTaskConfigs[taskInstanceId]) { // ensure config exists
                summaryDisplay.textContent = JSON.stringify(batchTaskConfigs[taskInstanceId], null, 2);
            }
            break;
        default:
            break;
    }
}

// 移除旧的函数，因为它们的功能将被模块化系统取代或重构
/*
async function loadTaskList() { ... }
function renderTaskList(tasks, container) { ... }
function selectTask(taskId) { ... }
function filterTaskList() { ... }
async function updateStatistics() { ... }
function getStatusClass(status) { ... }
function getStatusText(status) { ... }
*/

// 注意：在文件第118行已经导出了initBatchScriptsPage，这里不需要重复导出
// export { initBatchScriptsPage }; 