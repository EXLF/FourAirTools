/**
 * 批量脚本管理页面 - 主模块
 * 负责初始化页面、加载批量任务列表和基本交互
 */

import { showModal } from '../../components/modal.js';
import { setupFilteringAndSearch } from '../../components/tableHelper.js';
import { translateLocation } from '../../utils/locationTranslator.js';
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

// 预定义的批量脚本卡片数据(将被动态数据替换)
let batchScriptTypes = []; 

// 模块定义，用于导航和内容加载 - 简化配置，不再需要多模块导航
const modules = [
    { id: 'simple-config', name: '任务配置', icon: 'fas fa-cogs' }
];

let currentModuleIndex = 0; // 当前激活模块的索引 - 实际上只有一个模块了
const moduleOrder = [
    "simple-config" 
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
async function loadAndRenderBatchScriptCards(pageContentArea) {
    const cardsContainer = pageContentArea.querySelector('#batchScriptCardsContainer');
    const typeFilterElement = pageContentArea.querySelector('#batchScriptTypeFilter');
    const statusFilterElement = pageContentArea.querySelector('#batchScriptStatusFilter');
    
    if (!cardsContainer) {
        console.error('卡片容器 #batchScriptCardsContainer 未在卡片视图中找到。');
        return;
    }
    
    cardsContainer.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> 正在加载脚本...</div>'; 
    
    try {
        // 检测可用的IPC接口
        let ipc = null;
        const ipcOptions = [
            window.ipcRenderer,
            window.electron?.ipcRenderer,
            window.api?.invoke ? { invoke: window.api.invoke } : null,
            window.bridge?.invoke ? { invoke: window.bridge.invoke } : null,
            window.ipc
        ];
        
        for (const option of ipcOptions) {
            if (option && typeof option.invoke === 'function') {
                ipc = option;
                break;
            }
        }
        
        if (!ipc) {
            throw new Error('IPC通信未配置');
        }
        
        // 从主进程获取脚本列表
        const result = await ipc.invoke('script:getBatchScripts');
        
        if (!result.success) {
            throw new Error(result.error || '获取脚本失败');
        }
        
        batchScriptTypes = result.scripts || [];
        
        // 清空加载提示
        cardsContainer.innerHTML = '';
        
        if (batchScriptTypes.length === 0) {
            cardsContainer.innerHTML = '<div class="no-scripts-message">未找到支持批量执行的脚本。<br>请确保在user_scripts/scripts目录中添加了带有supportsBatchExecution:true配置的脚本。</div>';
            return;
        }
        
        // 渲染脚本卡片
    batchScriptTypes.forEach(scriptType => {
        const card = createBatchScriptCard(scriptType);
        cardsContainer.appendChild(card);
    });
    
    populateFilters(typeFilterElement, statusFilterElement, batchScriptTypes);
        
    } catch (error) {
        console.error('加载脚本失败:', error);
        cardsContainer.innerHTML = `<div class="error-message">加载脚本失败: ${error.message}</div>`;
    }
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
        // 生成一个唯一的任务实例ID
        const taskInstanceId = `task_${scriptData.id}_${Date.now()}`;
        navigateToModularTaskManager(taskInstanceId);
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
    console.log("尝试导航到模块化任务管理器...");
    currentView = 'manager';
    if (!contentAreaRef || !currentBatchScriptType) {
        console.error("contentAreaRef或currentBatchScriptType未定义");
        return;
    }

    // 更新模板以反映简化的单页配置
    const templateHtml = `
    <div class="page-container modular-manager-page simple-config-page">
        <div class="page-header">
            <h1 id="modular-manager-title">配置批量任务</h1>
            <div class="header-actions">
                <button id="back-to-cards-btn" class="btn btn-secondary"><i class="fas fa-arrow-left"></i> 返回卡片</button>
            </div>
        </div>
        <main class="module-content-display" id="moduleContentDisplay">
            <!-- 简化的配置内容将在此处动态加载 -->
        </main>
        <div class="simple-config-footer-actions">
             <button id="start-execution-btn" class="btn btn-success"><i class="fas fa-play"></i> 开始执行</button>
        </div>
    </div>
    `;

    contentAreaRef.innerHTML = templateHtml;
    console.log("已直接加载简化模板HTML到内容区域");
    
    const managerTitle = contentAreaRef.querySelector('#modular-manager-title');
    if (managerTitle && currentBatchScriptType) {
        managerTitle.textContent = `配置批量任务: ${currentBatchScriptType.name}`;
    }

    if (!taskInstanceId) {
        taskInstanceId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        console.log(`生成新的任务实例ID: ${taskInstanceId}`);
    }

    // 简化 batchTaskConfigs 初始化
    if (!batchTaskConfigs[taskInstanceId]) {
        batchTaskConfigs[taskInstanceId] = {
            scriptTypeId: currentBatchScriptType.id, // 保留脚本类型ID
            scriptName: currentBatchScriptType.name, // 保留脚本名称，方便传递
            accounts: [], // 选择的账户列表
            proxyConfig: {
                enabled: false,
                strategy: 'one-to-one', // 'one-to-one' 或 'one-to-many'
                proxies: [] // 代理IP列表，如果启用了代理并且需要用户输入
            }
        };
        console.log(`为 ${taskInstanceId} 初始化了简化配置: `, batchTaskConfigs[taskInstanceId]);
    }
    
    currentModuleIndex = 0; 
    bindModularManagerEvents(taskInstanceId); // 事件绑定也需要调整
    loadModuleContent(moduleOrder[currentModuleIndex], taskInstanceId); 
    // updateModuleNavigationButtons 不再需要，因为没有多模块导航了
}

/**
 * 为模块化管理器绑定事件
 * @param {string} taskInstanceId - 当前配置的任务实例的唯一ID
 */
function bindModularManagerEvents(taskInstanceId) {
    const managerPage = contentAreaRef.querySelector('.simple-config-page');
    if (!managerPage) {
        console.error("Simple config page element not found for binding events.");
        return;
    }

    const backToCardsButton = managerPage.querySelector('#back-to-cards-btn');
    if (backToCardsButton) {
        backToCardsButton.addEventListener('click', (event) => {
            event.preventDefault();
            saveCurrentModuleData(taskInstanceId); 
            renderBatchScriptCardsView(contentAreaRef); // 确保传递 contentAreaRef
        });
    }

    const startTaskButton = managerPage.querySelector('#start-execution-btn');
    if (startTaskButton) {
        startTaskButton.addEventListener('click', (event) => {
            event.preventDefault();
            saveCurrentModuleData(taskInstanceId); 
            
            // 检查选择的账户是否为空
            if (batchTaskConfigs[taskInstanceId].accounts.length === 0) {
                alert('请至少选择一个钱包账户');
                return;
            }
            
            // 检查代理配置
            const proxyConfig = batchTaskConfigs[taskInstanceId].proxyConfig;
            if (proxyConfig.enabled && proxyConfig.proxies.length === 0) {
                alert('已启用代理，但代理列表为空。请添加代理或禁用代理功能。');
                return;
            }
            
            // 检查一对一代理策略时的代理数量是否足够
            if (proxyConfig.enabled && proxyConfig.strategy === 'one-to-one' && 
                proxyConfig.proxies.length < batchTaskConfigs[taskInstanceId].accounts.length) {
                alert(`一对一代理策略需要至少与钱包数量相同的代理IP。\n当前钱包数量: ${batchTaskConfigs[taskInstanceId].accounts.length}\n当前代理数量: ${proxyConfig.proxies.length}`);
                return;
            }
            
            console.log(`尝试为 ${taskInstanceId} 启动任务，配置如下:`, batchTaskConfigs[taskInstanceId]);
            
            // 使用相同的IPC检测逻辑，避免重复代码
            let ipc = null;
            // 尝试检测IPC接口的不同可能位置和命名
            const ipcOptions = [
                window.ipcRenderer,
                window.electron?.ipcRenderer,
                window.api?.invoke ? { invoke: window.api.invoke } : null,
                window.bridge?.invoke ? { invoke: window.bridge.invoke } : null,
                window.ipc
            ];
            
            for (const option of ipcOptions) {
                if (option && typeof option.invoke === 'function') {
                    ipc = option;
                    break;
                }
            }
            
            if (!ipc) {
                alert('无法执行脚本：IPC通信未配置。这可能是开发环境或预览模式引起的。请联系开发者配置preload.js文件。');
                return;
            }
            
            // 在这里，调用实际的脚本执行逻辑
            try {
                // @ts-ignore
                ipc.invoke('script:execute', {
                    scriptType: currentBatchScriptType.id,
                    scriptName: currentBatchScriptType.name,
                    taskId: taskInstanceId,
                    accounts: batchTaskConfigs[taskInstanceId].accounts,
                    proxyConfig: batchTaskConfigs[taskInstanceId].proxyConfig
                }).then(result => {
                    console.log('脚本执行结果:', result);
                    alert(`脚本已启动执行\n类型: ${currentBatchScriptType.name}\n账户数量: ${batchTaskConfigs[taskInstanceId].accounts.length}`);
                }).catch(err => {
                    console.error('脚本执行失败:', err);
                    alert(`脚本执行失败: ${err.message || '未知错误'}`);
                });
            } catch (error) {
                console.error('调用脚本执行时发生错误:', error);
                alert(`启动执行时出错: ${error.message || '未知错误'}`);
            }
        });
    }
}

/**
 * 格式化钱包地址，显示前6位和后4位
 * @param {string} address - 完整的钱包地址
 * @returns {string} 格式化后的地址，如 0x1234...5678
 */
function formatAddress(address) {
    if (!address || typeof address !== 'string' || address.length < 12) {
        return address;
    }
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

/**
 * 加载指定模块的内容到显示区域
 * @param {string} moduleId - 要加载的模块ID (现在只有一个 'simple-config')
 * @param {string} taskInstanceId
 */
async function loadModuleContent(moduleId, taskInstanceId) {
    console.log(`加载模块内容: ${moduleId} for task ${taskInstanceId}`);
    const contentDisplay = contentAreaRef.querySelector('#moduleContentDisplay');
    if (!contentDisplay) {
        console.error('模块内容显示区域 #moduleContentDisplay 未找到!');
        return;
    }

    const currentTaskConfig = batchTaskConfigs[taskInstanceId];
    if (!currentTaskConfig) {
        console.error(`未找到任务配置 for ${taskInstanceId}`);
        contentDisplay.innerHTML = '<p>错误：任务配置数据丢失。</p>';
        return;
    }

    let htmlContent = '';
    contentDisplay.innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> 正在加载配置选项...</p>'; // 加载状态

    let availableWallets = [];
    let availableProxies = [];
    
    // 尝试检测IPC接口的不同可能位置和命名
    // 有些项目使用electron, 有些使用api, 有些直接用ipcRenderer
    const ipcOptions = [
        window.ipcRenderer,
        window.electron?.ipcRenderer,
        window.api?.invoke ? { invoke: window.api.invoke } : null,
        window.bridge?.invoke ? { invoke: window.bridge.invoke } : null,
        window.ipc,
        // 如果上面都找不到，最后添加一个全局搜索
        Object.keys(window).some(key => window[key]?.invoke && typeof window[key].invoke === 'function') 
            ? Object.keys(window).find(key => window[key]?.invoke && typeof window[key].invoke === 'function')
            : null
    ];
    
    let ipc = null;
    
    for (const option of ipcOptions) {
        if (option && typeof option.invoke === 'function') {
            ipc = option;
            console.log(`找到IPC接口: ${option === window.ipcRenderer ? 'window.ipcRenderer' : 
                option === window.electron?.ipcRenderer ? 'window.electron.ipcRenderer' : 
                option === window.api ? 'window.api' : 
                option === window.bridge ? 'window.bridge' : 
                option === window.ipc ? 'window.ipc' : '未知来源'}`);
            break;
        }
    }
    
    const hasIpcRenderer = !!ipc;
    
    if (!hasIpcRenderer) {
        console.warn("在window对象上找不到有效的IPC接口。使用模拟数据。");
        // 使用模拟数据，允许页面继续工作
        availableWallets = [
            { id: 'wallet1', address: '0x1234...5678', name: '主钱包1', group: 'L0组' },
            { id: 'wallet2', address: '0xabcd...efgh', name: '测试钱包A', group: 'Base组' },
            { id: 'wallet3', address: '0xdef1...2345', name: '空投钱包X', group: 'zkSync组' },
            { id: 'wallet4', address: '0xffff...0000', name: '分组钱包Y', group: 'Arbitrum组' },
        ];
        
        // 模拟代理数据
        availableProxies = [
            { id: 1, host: '192.168.1.1', port: 8080, protocol: 'http', username: 'user1', password: 'pass1' },
            { id: 2, host: '192.168.1.2', port: 8080, protocol: 'socks5', username: 'user2', password: 'pass2' },
            { id: 3, host: '192.168.1.3', port: 8080, protocol: 'http', username: 'user3', password: 'pass3' },
        ];
    }

    if (moduleId === 'simple-config') {
        if (hasIpcRenderer) {
            try {
                // 并行获取钱包和代理数据以提高加载速度
                const [walletResponse, proxyResponse] = await Promise.all([
                    ipc.invoke('db:getWallets', { /* 如果需要参数，在此处添加 */ }),
                    ipc.invoke('db:getProxies', { 
                        page: 1,
                        limit: 1000, // 请求足够多的代理，以确保获取全部
                        sortBy: 'id',
                        sortOrder: 'asc',
                        type: 'all',
                        groupId: 'all',
                        status: 'all',
                        search: ''
                    })
                ]);
                
                console.log("成功获取钱包列表: ", walletResponse);
                console.log("成功获取代理列表: ", proxyResponse);
                
                // 处理钱包数据
                if (walletResponse && Array.isArray(walletResponse.wallets)) {
                    availableWallets = walletResponse.wallets;
                    console.log(`成功解析钱包数据，共 ${walletResponse.totalCount} 个钱包`);
                } else if (Array.isArray(walletResponse)) {
                    availableWallets = walletResponse;
                    console.log(`成功解析钱包数据，数组长度为 ${walletResponse.length}`);
                } else {
                    console.warn("db:getWallets 返回格式异常", walletResponse);
                    availableWallets = [];
                }
                
                // 处理代理数据
                if (proxyResponse && Array.isArray(proxyResponse.proxies)) {
                    availableProxies = proxyResponse.proxies;
                    console.log(`成功解析代理数据，共 ${proxyResponse.totalCount} 个代理`);
                } else if (Array.isArray(proxyResponse)) {
                    availableProxies = proxyResponse;
                    console.log(`成功解析代理数据，数组长度为 ${proxyResponse.length}`);
                } else {
                    console.warn("db:getProxies 返回格式异常", proxyResponse);
                    availableProxies = [];
                }
            } catch (error) {
                console.error("获取数据失败:", error);
                contentDisplay.innerHTML = '<p>错误：无法加载数据。请检查控制台获取更多信息。</p>';
                return;
            }
        }

        const walletOptionsHtml = availableWallets.length > 0 
            ? availableWallets.map(wallet => `
                <div class="wallet-checkbox-item">
                    <input type="checkbox" id="wallet-${wallet.id}-${taskInstanceId}" name="selected-wallets" value="${wallet.address}" ${currentTaskConfig.accounts.includes(wallet.address) ? 'checked' : ''}>
                    <label for="wallet-${wallet.id}-${taskInstanceId}">${wallet.name || '未命名钱包'} ${wallet.group ? `(${wallet.group})` : ''} ${wallet.address}</label>
                        </div>
            `).join('')
            : '<p>没有可用的钱包账户。请先在钱包管理中添加钱包。</p>';
        
        // 格式化代理为字符串
        const formatProxy = (proxy) => {
            // 根据应用中的代理格式进行调整
            if (proxy.protocol && proxy.host && proxy.port) {
                if (proxy.username && proxy.password) {
                    return `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
                }
                return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
            } else if (proxy.url) {
                return proxy.url;
            } else if (proxy.proxy_url) {
                return proxy.proxy_url;
            } else if (typeof proxy === 'string') {
                return proxy;
            }
            // 如果没有标准格式，尝试JSON字符串化
            return JSON.stringify(proxy);
        };
        
        // 如果当前没有选择代理但有可用代理，则预填充
        if (currentTaskConfig.proxyConfig.proxies.length === 0 && availableProxies.length > 0) {
            currentTaskConfig.proxyConfig.proxies = availableProxies.map(formatProxy);
        }
        
        const proxyEnabled = currentTaskConfig.proxyConfig.enabled;
        const proxyStrategy = currentTaskConfig.proxyConfig.strategy;
        
        // 将钱包按组分类
        const walletGroups = {};
        availableWallets.forEach(wallet => {
            const group = wallet.group || wallet.groupName || '默认分组';
            if (!walletGroups[group]) {
                walletGroups[group] = [];
            }
            walletGroups[group].push(wallet);
        });

        // 生成分组的钱包选择HTML
        const walletGroupsHtml = Object.keys(walletGroups).length > 0
            ? Object.entries(walletGroups).map(([group, wallets]) => `
                <div class="wallet-group">
                    <div class="wallet-group-header" data-group="${group}">
                        <div class="group-title">
                            <span class="group-toggle"><i class="fas fa-chevron-down"></i></span>
                            <input type="checkbox" id="group-${group.replace(/\s+/g, '-')}-${taskInstanceId}" 
                                class="group-checkbox" data-group="${group}">
                            <label for="group-${group.replace(/\s+/g, '-')}-${taskInstanceId}">
                                <i class="fas fa-folder"></i> ${group} (${wallets.length})
                            </label>
                        </div>
                        </div>
                    <div class="wallet-group-content">
                        ${wallets.map(wallet => `
                            <div class="wallet-item">
                                <input type="checkbox" id="wallet-${wallet.id}-${taskInstanceId}" 
                                    name="selected-wallets" value="${wallet.address}" 
                                    data-group="${group}"
                                    ${currentTaskConfig.accounts.includes(wallet.address) ? 'checked' : ''}>
                                <label for="wallet-${wallet.id}-${taskInstanceId}" class="wallet-label">
                                    <div class="wallet-name">${wallet.name || '未命名钱包'}</div>
                                    <div class="wallet-address" title="${wallet.address}">${formatAddress(wallet.address)}</div>
                                </label>
                </div>
                        `).join('')}
                    </div>
                    </div>
            `).join('')
            : '<p>没有可用的钱包账户。请先在钱包管理中添加钱包。</p>';

        // 格式化代理为可视化卡片列表
        const proxyListUI = availableProxies.length > 0
            ? `
                <div class="proxy-visual-list">
                    ${availableProxies.map((proxy, index) => {
                        const proxyStr = formatProxy(proxy);
                        const isSelected = currentTaskConfig.proxyConfig.proxies.includes(proxyStr);
                        // 地区转换为中文
                        let location = '';
                        if (proxy.country) {
                            // 使用导入的地区转换函数
                            try {
                                location = translateLocation(proxy.country);
                                if (proxy.city) {
                                    location += `-${proxy.city}`;
                                }
                            } catch (e) {
                                location = proxy.country + (proxy.city ? `-${proxy.city}` : '');
                            }
                        }
                        
                        return `
                            <div class="proxy-item ${isSelected ? 'selected' : ''}" data-proxy="${encodeURIComponent(proxyStr)}">
                                <div class="proxy-card-checkbox">
                                    <input type="checkbox" id="proxy-${index}-${taskInstanceId}" class="proxy-checkbox" 
                                        ${isSelected ? 'checked' : ''}>
                                    <label for="proxy-${index}-${taskInstanceId}"></label>
                </div>
                                <div class="proxy-card-content">
                                    <div class="proxy-info-row">
                                        <span class="proxy-protocol">${proxy.protocol || 'http'}</span>
                                        <span class="proxy-host">${proxy.host || (proxy.url || '').split('://')[1]?.split(':')[0] || 'N/A'}</span>
                                        <span class="proxy-port">${proxy.port || 'N/A'}</span>
                                        ${location ? `<span class="proxy-location"><i class="fas fa-globe-asia"></i> ${location}</span>` : ''}
                    </div>
                    </div>
                </div>
            `;
                    }).join('')}
                    </div>
                <div class="proxy-selection-summary">
                    <span>已选择 <span class="selected-proxy-count">${currentTaskConfig.proxyConfig.proxies.length}</span> / ${availableProxies.length} 个代理</span>
                    <div class="proxy-actions">
                        <button id="select-all-proxies-${taskInstanceId}" class="btn btn-sm btn-outline">全选</button>
                        <button id="deselect-all-proxies-${taskInstanceId}" class="btn btn-sm btn-outline">取消全选</button>
                        <button id="add-proxy-${taskInstanceId}" class="btn btn-sm"><i class="fas fa-plus"></i> 添加代理</button>
                    </div>
                </div>
            `
            : `
                <div class="no-proxies-message">
                    <p>暂无可用代理。</p>
                    <button id="add-proxy-${taskInstanceId}" class="btn btn-primary"><i class="fas fa-plus"></i> 添加代理</button>
                </div>
            `;
            
        // 重新设计代理配置部分以适应一对一和一对多场景
        const oneToOneUI = `
            <div class="proxy-one-to-one">
                <div class="proxy-strategy-description">
                    <i class="fas fa-info-circle"></i>
                    <span>一对一模式下，每个账户将分配一个唯一的代理，代理数量需≥账户数量</span>
                    </div>
                <div class="proxy-assignment-preview">
                    <div class="accounts-count">
                        <div class="count-value">${currentTaskConfig.accounts.length}</div>
                        <div class="count-label">账户数</div>
                    </div>
                    <div class="assignment-arrow">
                        <i class="fas fa-long-arrow-alt-right"></i>
                    </div>
                    <div class="proxies-count ${currentTaskConfig.proxyConfig.proxies.length < currentTaskConfig.accounts.length ? 'warning' : ''}">
                        <div class="count-value">${currentTaskConfig.proxyConfig.proxies.length}</div>
                        <div class="count-label">代理数</div>
                        ${currentTaskConfig.proxyConfig.proxies.length < currentTaskConfig.accounts.length ? 
                            `<div class="count-warning">代理不足</div>` : ''}
                    </div>
                </div>
                </div>
            `;
        
        const oneToManyUI = `
            <div class="proxy-one-to-many">
                <div class="proxy-strategy-description">
                    <i class="fas fa-info-circle"></i>
                    <span>一对多模式下，多个账户共用一组代理，适合代理数量有限的场景</span>
                        </div>
                <div class="proxy-assignment-preview">
                    <div class="accounts-count">
                        <div class="count-value">${currentTaskConfig.accounts.length}</div>
                        <div class="count-label">账户数</div>
                        </div>
                    <div class="assignment-diagram">
                        <div class="assignment-lines"></div>
                        </div>
                    <div class="proxies-count">
                        <div class="count-value">${currentTaskConfig.proxyConfig.proxies.length}</div>
                        <div class="count-label">代理数</div>
                        ${currentTaskConfig.proxyConfig.proxies.length === 0 ? 
                            `<div class="count-warning">至少需要1个代理</div>` : ''}
                        </div>
                        </div>
                <div class="proxy-distribution">
                    <div class="distribution-label">每个代理将服务:</div>
                    <div class="distribution-value">
                        ${currentTaskConfig.proxyConfig.proxies.length > 0 ? 
                            `约 ${Math.ceil(currentTaskConfig.accounts.length / currentTaskConfig.proxyConfig.proxies.length)} 个账户` : 
                            '全部账户'}
                    </div>
                </div>
                </div>
            `;

            htmlContent = `
            <div id="module-simple-config" class="module-content-panel active-module">
                <div class="config-section wallet-config-section">
                    <div class="section-header">
                        <h3><i class="fas fa-wallet"></i> 账户选择</h3>
                        <div class="wallet-actions">
                            <div class="wallet-search">
                                <input type="text" id="wallet-search-${taskInstanceId}" placeholder="搜索钱包...">
                                <i class="fas fa-search"></i>
                    </div>
                            <div class="wallet-selection-controls">
                                <button id="select-all-wallets-${taskInstanceId}" class="btn btn-sm btn-outline">全选</button>
                                <button id="deselect-all-wallets-${taskInstanceId}" class="btn btn-sm btn-outline">取消全选</button>
                    </div>
                    </div>
                    </div>
                    <div class="wallet-selection-container">
                        <div id="wallets-list-${taskInstanceId}" class="wallets-list">
                            ${walletGroupsHtml}
                        </div>
                        <div class="wallet-selection-summary">
                            <div class="summary-item">
                                <span class="summary-label">总钱包数:</span>
                                <span class="summary-value">${availableWallets.length}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">已选择:</span>
                                <span id="selected-accounts-count-${taskInstanceId}" class="summary-value highlight">${currentTaskConfig.accounts.length}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="config-section proxy-config-section">
                    <div class="section-header">
                        <h3><i class="fas fa-network-wired"></i> 代理配置</h3>
                        <div class="proxy-toggle">
                            <label class="switch">
                                <input type="checkbox" id="proxy-enabled-${taskInstanceId}" ${proxyEnabled ? 'checked' : ''}>
                                <span class="slider round"></span>
                            </label>
                            <span>启用代理</span>
                        </div>
                    </div>
                    
                    <div id="proxy-options-${taskInstanceId}" class="proxy-options" style="display: ${proxyEnabled ? 'block' : 'none'};">
                        <div class="proxy-strategy-selector">
                            <div class="strategy-option ${proxyStrategy === 'one-to-one' ? 'selected' : ''}" data-strategy="one-to-one">
                                <input type="radio" id="strategy-one-to-one-${taskInstanceId}" name="proxy-strategy" 
                                    value="one-to-one" ${proxyStrategy === 'one-to-one' ? 'checked' : ''}>
                                <label for="strategy-one-to-one-${taskInstanceId}">
                                    <div class="strategy-icon"><i class="fas fa-exchange-alt"></i></div>
                                    <div class="strategy-text">
                                        <div class="strategy-title">一对一</div>
                                        <div class="strategy-desc">每个账户一个代理</div>
                                    </div>
                                </label>
                            </div>
                            <div class="strategy-option ${proxyStrategy === 'one-to-many' ? 'selected' : ''}" data-strategy="one-to-many">
                                <input type="radio" id="strategy-one-to-many-${taskInstanceId}" name="proxy-strategy" 
                                    value="one-to-many" ${proxyStrategy === 'one-to-many' ? 'checked' : ''}>
                                <label for="strategy-one-to-many-${taskInstanceId}">
                                    <div class="strategy-icon"><i class="fas fa-share-alt"></i></div>
                                    <div class="strategy-text">
                                        <div class="strategy-title">一对多</div>
                                        <div class="strategy-desc">多个账户共用代理</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <div class="proxy-strategy-details">
                            ${proxyStrategy === 'one-to-one' ? oneToOneUI : oneToManyUI}
                        </div>

                        <div class="proxy-management">
                            <div class="proxy-header">
                                <h4>代理列表</h4>
                                <div class="proxy-tools">
                                    <div class="proxy-search">
                                        <input type="text" id="proxy-search-${taskInstanceId}" placeholder="搜索代理...">
                                        <i class="fas fa-search"></i>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="proxy-list-container">
                                ${proxyListUI}
                            </div>
                        </div>
                    </div>
                </div>
                ${!hasIpcRenderer ? 
                    '<div class="warning-banner"><i class="fas fa-exclamation-triangle"></i> 注意：当前使用的是模拟数据，因为IPC通信未配置。真实数据不可用。</div>' : ''}
                </div>
            `;
    } else {
        htmlContent = '<p>未知配置模块。</p>';
    }
    contentDisplay.innerHTML = htmlContent;
    bindModuleSpecificInputEvents(moduleId, taskInstanceId, availableProxies);
    
    // 初始化分组折叠功能
    initWalletGroupCollapse();
}

/**
 * 初始化钱包分组折叠功能
 * 允许用户点击组标题来展开/折叠组内容
 */
function initWalletGroupCollapse() {
    const groupHeaders = document.querySelectorAll('.wallet-group-header');
    
    groupHeaders.forEach(header => {
        // 移除旧事件监听器（如果有）
        header.removeEventListener('click', handleGroupHeaderClick);
        
        // 添加新的事件监听器
        header.addEventListener('click', handleGroupHeaderClick);
        
        // 确保初始状态是展开的
        const groupContent = header.nextElementSibling;
        if (groupContent && groupContent.classList.contains('wallet-group-content')) {
            groupContent.style.display = 'block';
            
            // 确保箭头图标指向正确方向
            const toggleIcon = header.querySelector('.group-toggle i');
            if (toggleIcon) {
                toggleIcon.className = 'fas fa-chevron-down';
            }
        }
    });
}

/**
 * 处理组标题点击事件
 * @param {Event} event - 点击事件
 */
function handleGroupHeaderClick(event) {
    // 如果点击的是复选框或复选框的标签，不处理折叠/展开
    if (event.target.type === 'checkbox' || 
        event.target.tagName === 'LABEL' || 
        event.target.closest('label')) {
        return;
    }
    
    const header = event.currentTarget;
    const groupContent = header.nextElementSibling;
    const toggleIcon = header.querySelector('.group-toggle i');
    
    if (groupContent && groupContent.classList.contains('wallet-group-content')) {
        // 切换显示/隐藏状态
        const isVisible = groupContent.style.display !== 'none';
        groupContent.style.display = isVisible ? 'none' : 'block';
        
        // 更新箭头图标
        if (toggleIcon) {
            toggleIcon.className = isVisible ? 'fas fa-chevron-right' : 'fas fa-chevron-down';
        }
    }
}

/**
 * 更新模块导航按钮（上一步/下一步/开始执行）的启用/禁用状态和可见性
 */
function updateModuleNavigationButtons(taskInstanceId) {
    // 此函数不再需要，因为已经没有多模块导航了
    // 可以安全移除或注释掉调用它的地方
    console.log("updateModuleNavigationButtons called, but no longer necessary in simple config.");
}

/**
 * 为特定模块内的输入元素绑定事件，以便实时更新配置对象
 * @param {string} moduleId - 当前模块的ID
 * @param {string} taskInstanceId - 当前任务实例的ID
 * @param {Array} availableProxies - 可用的代理列表
 */
function bindModuleSpecificInputEvents(moduleId, taskInstanceId, availableProxies) {
    const currentTaskConfig = batchTaskConfigs[taskInstanceId];
    if (!currentTaskConfig) {
        console.warn(`bindModuleSpecificInputEvents: 未找到任务配置 for ${taskInstanceId}`);
        return;
    }

    if (moduleId === 'simple-config') {
        // 钱包选择相关事件
        const walletsListDiv = document.getElementById(`wallets-list-${taskInstanceId}`);
        const selectedAccountsCountSpan = document.getElementById(`selected-accounts-count-${taskInstanceId}`);
        const walletSearchInput = document.getElementById(`wallet-search-${taskInstanceId}`);
        const selectAllBtn = document.getElementById(`select-all-wallets-${taskInstanceId}`);
        const deselectAllBtn = document.getElementById(`deselect-all-wallets-${taskInstanceId}`);
        
        // 钱包单选事件
        if (walletsListDiv && selectedAccountsCountSpan) {
            walletsListDiv.addEventListener('change', (event) => {
                if (event.target.name === 'selected-wallets') {
                    // 单个钱包的选择状态改变
                    const selectedWallets = Array.from(walletsListDiv.querySelectorAll('input[name="selected-wallets"]:checked'))
                                                .map(cb => cb.value);
                    currentTaskConfig.accounts = selectedWallets;
                    selectedAccountsCountSpan.textContent = selectedWallets.length;
                    
                    // 更新所属分组的选中状态
                    if (event.target.dataset.group) {
                        const group = event.target.dataset.group;
                        const groupCheckbox = walletsListDiv.querySelector(`input[type="checkbox"].group-checkbox[data-group="${group}"]`);
                        const groupWallets = walletsListDiv.querySelectorAll(`input[name="selected-wallets"][data-group="${group}"]`);
                        const checkedGroupWallets = Array.from(groupWallets).filter(cb => cb.checked);
                        
                        if (groupCheckbox) {
                            // 如果组内全部选中，则设置组复选框为选中
                            // 如果组内部分选中，则设置组复选框为半选
                            // 如果组内全部未选中，则设置组复选框为未选中
                            if (checkedGroupWallets.length === groupWallets.length) {
                                groupCheckbox.checked = true;
                                groupCheckbox.indeterminate = false;
                            } else if (checkedGroupWallets.length > 0) {
                                groupCheckbox.checked = false;
                                groupCheckbox.indeterminate = true;
                            } else {
                                groupCheckbox.checked = false;
                                groupCheckbox.indeterminate = false;
                            }
                        }
                    }
                    
                    // 当选择钱包数量变化时，同时更新代理配置的UI显示
                    updateProxyStrategyDetails(taskInstanceId);
                } else if (event.target.classList.contains('group-checkbox')) {
                    // 分组复选框的选择状态改变
                    const group = event.target.dataset.group;
                    const groupWallets = walletsListDiv.querySelectorAll(`input[name="selected-wallets"][data-group="${group}"]`);
                    groupWallets.forEach(wallet => {
                        wallet.checked = event.target.checked;
                    });
                    
                    // 更新选中的钱包数据
                    const selectedWallets = Array.from(walletsListDiv.querySelectorAll('input[name="selected-wallets"]:checked'))
                                                .map(cb => cb.value);
                    currentTaskConfig.accounts = selectedWallets;
                    selectedAccountsCountSpan.textContent = selectedWallets.length;
                    
                    // 更新代理配置的UI显示
                    updateProxyStrategyDetails(taskInstanceId);
                }
            });
        }
        
        // 钱包搜索功能
        if (walletSearchInput && walletsListDiv) {
            walletSearchInput.addEventListener('input', (event) => {
                const searchTerm = event.target.value.toLowerCase().trim();
                const walletItems = walletsListDiv.querySelectorAll('.wallet-item');
                const walletGroups = walletsListDiv.querySelectorAll('.wallet-group');
                
                if (searchTerm === '') {
                    // 清空搜索，显示所有
                    walletItems.forEach(item => {
                        item.style.display = '';
                    });
                    walletGroups.forEach(group => {
                        group.style.display = '';
                    });
                } else {
                    // 按搜索词筛选钱包
                    walletItems.forEach(item => {
                        const nameEl = item.querySelector('.wallet-name');
                        const addressEl = item.querySelector('.wallet-address');
                        const name = nameEl ? nameEl.textContent.toLowerCase() : '';
                        const address = addressEl ? addressEl.title.toLowerCase() : '';
                        
                        if (name.includes(searchTerm) || address.includes(searchTerm)) {
                            item.style.display = '';
                        } else {
                            item.style.display = 'none';
                        }
                    });
                    
                    // 更新组的显示状态（如果组内所有钱包都隐藏了，则也隐藏组）
                    walletGroups.forEach(group => {
                        const groupContent = group.querySelector('.wallet-group-content');
                        const visibleItems = Array.from(groupContent.querySelectorAll('.wallet-item')).filter(
                            item => item.style.display !== 'none'
                        );
                        
                        if (visibleItems.length === 0) {
                            group.style.display = 'none';
                        } else {
                            group.style.display = '';
                        }
                    });
                }
            });
        }
        
        // 全选/取消全选事件
        if (selectAllBtn && walletsListDiv) {
            selectAllBtn.addEventListener('click', () => {
                // 只选择当前可见的钱包（考虑搜索过滤后）
                const visibleWallets = Array.from(walletsListDiv.querySelectorAll('.wallet-item:not([style*="display: none"]) input[name="selected-wallets"]'));
                visibleWallets.forEach(wallet => {
                    wallet.checked = true;
                });
                
                // 更新分组复选框状态
                walletsListDiv.querySelectorAll('.group-checkbox').forEach(groupCb => {
                    const group = groupCb.dataset.group;
                    const groupWallets = walletsListDiv.querySelectorAll(`input[name="selected-wallets"][data-group="${group}"]:not([style*="display: none"])`);
                    const checkedGroupWallets = Array.from(groupWallets).filter(cb => cb.checked);
                    
                    if (checkedGroupWallets.length === groupWallets.length) {
                        groupCb.checked = true;
                        groupCb.indeterminate = false;
                    } else if (checkedGroupWallets.length > 0) {
                        groupCb.checked = false;
                        groupCb.indeterminate = true;
                    } else {
                        groupCb.checked = false;
                        groupCb.indeterminate = false;
                    }
                });
                
                // 更新选中的钱包数据
                const selectedWallets = Array.from(walletsListDiv.querySelectorAll('input[name="selected-wallets"]:checked'))
                                            .map(cb => cb.value);
                currentTaskConfig.accounts = selectedWallets;
                selectedAccountsCountSpan.textContent = selectedWallets.length;
                
                // 更新代理配置的UI显示
                updateProxyStrategyDetails(taskInstanceId);
            });
        }
        
        if (deselectAllBtn && walletsListDiv) {
            deselectAllBtn.addEventListener('click', () => {
                // 取消选择所有可见钱包
                const visibleWallets = Array.from(walletsListDiv.querySelectorAll('.wallet-item:not([style*="display: none"]) input[name="selected-wallets"]'));
                visibleWallets.forEach(wallet => {
                    wallet.checked = false;
                });
                
                // 更新分组复选框状态
                walletsListDiv.querySelectorAll('.group-checkbox').forEach(groupCb => {
                    groupCb.checked = false;
                    groupCb.indeterminate = false;
                });
                
                // 更新选中的钱包数据
                const selectedWallets = Array.from(walletsListDiv.querySelectorAll('input[name="selected-wallets"]:checked'))
                                            .map(cb => cb.value);
                currentTaskConfig.accounts = selectedWallets;
                selectedAccountsCountSpan.textContent = selectedWallets.length;
                
                // 更新代理配置的UI显示
                updateProxyStrategyDetails(taskInstanceId);
            });
        }

        // 代理配置相关事件
        const proxyEnabledCheckbox = document.getElementById(`proxy-enabled-${taskInstanceId}`);
        const proxyOptionsDiv = document.getElementById(`proxy-options-${taskInstanceId}`);
        const proxySearchInput = document.getElementById(`proxy-search-${taskInstanceId}`);
        const proxyContainerElement = document.querySelector('.proxy-visual-list');
        const proxyCountElement = document.querySelector('.selected-proxy-count');
        const selectAllProxiesBtn = document.getElementById(`select-all-proxies-${taskInstanceId}`);
        const deselectAllProxiesBtn = document.getElementById(`deselect-all-proxies-${taskInstanceId}`);
        const addProxyBtn = document.getElementById(`add-proxy-${taskInstanceId}`);
        
        // 代理策略选择器
        const strategyOneToOneRadio = document.getElementById(`strategy-one-to-one-${taskInstanceId}`);
        const strategyOneToManyRadio = document.getElementById(`strategy-one-to-many-${taskInstanceId}`);
        const strategyOptions = document.querySelectorAll('.strategy-option');

        // 代理启用/禁用
        if (proxyEnabledCheckbox && proxyOptionsDiv) {
            proxyEnabledCheckbox.addEventListener('change', (event) => {
                currentTaskConfig.proxyConfig.enabled = event.target.checked;
                proxyOptionsDiv.style.display = event.target.checked ? 'block' : 'none';
            });
        }
        
        // 代理策略选择 - 使用新的单选按钮和卡片式UI
        if (strategyOptions.length > 0) {
            strategyOptions.forEach(option => {
                option.addEventListener('click', (event) => {
                    // 切换选中状态的视觉样式
                    strategyOptions.forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                    
                    // 更新单选按钮状态
                    const radio = option.querySelector('input[type="radio"]');
                    if (radio) {
                        radio.checked = true;
                        
                        // 更新配置对象
                        const strategy = radio.value;
                        currentTaskConfig.proxyConfig.strategy = strategy;
                        
                        // 更新UI显示
                        updateProxyStrategyDetails(taskInstanceId);
                    }
                });
            });
        }
        
        // 代理搜索功能
        if (proxySearchInput && proxyContainerElement) {
            proxySearchInput.addEventListener('input', (event) => {
                const searchTerm = event.target.value.toLowerCase().trim();
                const proxyItems = proxyContainerElement.querySelectorAll('.proxy-item');
                
                proxyItems.forEach(item => {
                    const proxyInfo = item.querySelector('.proxy-main-info');
                    if (!proxyInfo) return;
                    
                    const text = proxyInfo.textContent.toLowerCase();
                    if (searchTerm === '' || text.includes(searchTerm)) {
                        item.style.display = '';
                    } else {
                        item.style.display = 'none';
                    }
                });
            });
        }
        
        // 代理选择点击事件（单个代理卡片的选择/取消选择）
        if (proxyContainerElement) {
            proxyContainerElement.addEventListener('click', (event) => {
                const proxyItem = event.target.closest('.proxy-item');
                if (!proxyItem) return;
                
                const checkbox = proxyItem.querySelector('.proxy-checkbox');
                if (event.target === checkbox) {
                    // 如果直接点击了复选框，不需要额外处理
                    return;
                }
                
                // 切换复选框状态
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    
                    // 触发 change 事件以更新数据
                    const changeEvent = new Event('change', { bubbles: true });
                    checkbox.dispatchEvent(changeEvent);
                }
            });
            
            // 监听复选框的 change 事件
            proxyContainerElement.addEventListener('change', (event) => {
                if (event.target.classList.contains('proxy-checkbox')) {
                    // 更新选择状态的视觉效果
                    const proxyItem = event.target.closest('.proxy-item');
                    if (proxyItem) {
                        if (event.target.checked) {
                            proxyItem.classList.add('selected');
                        } else {
                            proxyItem.classList.remove('selected');
                        }
                    }
                    
                    // 更新数据模型
                    updateSelectedProxies(taskInstanceId, currentTaskConfig);
                }
            });
        }
        
        // 全选代理按钮
        if (selectAllProxiesBtn && proxyContainerElement) {
            selectAllProxiesBtn.addEventListener('click', () => {
                // 选择所有可见的代理卡片
                const visibleProxies = Array.from(proxyContainerElement.querySelectorAll('.proxy-item:not([style*="display: none"]) .proxy-checkbox'));
                visibleProxies.forEach(checkbox => {
                    checkbox.checked = true;
                    
                    // 更新卡片样式
                    const proxyItem = checkbox.closest('.proxy-item');
                    if (proxyItem) {
                        proxyItem.classList.add('selected');
                    }
                });
                
                // 更新数据模型
                updateSelectedProxies(taskInstanceId, currentTaskConfig);
            });
        }
        
        // 取消全选代理按钮
        if (deselectAllProxiesBtn && proxyContainerElement) {
            deselectAllProxiesBtn.addEventListener('click', () => {
                // 取消选择所有可见的代理卡片
                const visibleProxies = Array.from(proxyContainerElement.querySelectorAll('.proxy-item:not([style*="display: none"]) .proxy-checkbox'));
                visibleProxies.forEach(checkbox => {
                    checkbox.checked = false;
                    
                    // 更新卡片样式
                    const proxyItem = checkbox.closest('.proxy-item');
                    if (proxyItem) {
                        proxyItem.classList.remove('selected');
                    }
                });
                
                // 更新数据模型
                updateSelectedProxies(taskInstanceId, currentTaskConfig);
            });
        }
        
        // 添加代理按钮
        if (addProxyBtn) {
            addProxyBtn.addEventListener('click', () => {
                // 打开添加代理的模态框
                showModal({
                    title: '添加新代理',
                    content: `
                        <form id="add-proxy-form" class="modal-form">
                            <div class="form-group">
                                <label for="proxy-protocol">协议</label>
                                <select id="proxy-protocol" class="form-control" required>
                                    <option value="http">HTTP</option>
                                    <option value="https">HTTPS</option>
                                    <option value="socks4">SOCKS4</option>
                                    <option value="socks5">SOCKS5</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label for="proxy-host">主机地址</label>
                                <input type="text" id="proxy-host" class="form-control" placeholder="例如：127.0.0.1" required>
                            </div>
                            <div class="form-group">
                                <label for="proxy-port">端口</label>
                                <input type="number" id="proxy-port" class="form-control" placeholder="例如：8080" required>
                            </div>
                            <div class="form-group">
                                <label>认证信息（可选）</label>
                                <div class="auth-inputs">
                                    <input type="text" id="proxy-username" class="form-control" placeholder="用户名">
                                    <input type="password" id="proxy-password" class="form-control" placeholder="密码">
                                </div>
                            </div>
                        </form>
                    `,
                    showCancel: true,
                    confirmText: '添加',
                    cancelText: '取消',
                    onConfirm: async (modalElement) => {
                        const form = modalElement.querySelector('#add-proxy-form');
                        if (!form) return;
                        
                        // 基本验证
                        const protocol = form.querySelector('#proxy-protocol').value;
                        const host = form.querySelector('#proxy-host').value.trim();
                        const port = form.querySelector('#proxy-port').value.trim();
                        const username = form.querySelector('#proxy-username').value.trim();
                        const password = form.querySelector('#proxy-password').value.trim();
                        
                        if (!host || !port) {
                            // 显示错误提示
                            showToast('请填写主机地址和端口', 'error');
                            return false; // 不关闭模态框
                        }
                        
                        // 创建代理对象
                        const newProxy = {
                            protocol,
                            host,
                            port,
                            status: 'unknown'
                        };
                        
                        if (username && password) {
                            newProxy.username = username;
                            newProxy.password = password;
                        }
                        
                        try {
                            // 保存到数据库
                            if (hasIpcRenderer) {
                                const result = await window.electron.ipcRenderer.invoke('db:addProxy', newProxy);
                                if (result.success) {
                                    showToast('代理添加成功', 'success');
                                    
                                    // 添加到可用代理列表
                                    availableProxies.push(result.proxy || newProxy);
                                    
                                    // 刷新UI
                                    reloadProxyList(taskInstanceId, currentTaskConfig, availableProxies);
                                } else {
                                    showToast(`添加失败: ${result.error}`, 'error');
                                    return false;
                                }
                            } else {
                                // 模拟模式
                                showToast('模拟模式：代理已添加', 'info');
                                
                                // 添加到可用代理列表
                                newProxy.id = Date.now(); // 模拟ID
                                availableProxies.push(newProxy);
                                
                                // 刷新UI
                                reloadProxyList(taskInstanceId, currentTaskConfig, availableProxies);
                            }
                        } catch (error) {
                            console.error('添加代理失败:', error);
                            showToast(`添加失败: ${error.message}`, 'error');
                            return false;
                        }
                    }
                });
            });
        }
        
        // 初始更新代理策略UI
        updateProxyStrategyDetails(taskInstanceId);
    }
}

/**
 * 更新选中的代理列表并刷新UI
 * @param {string} taskInstanceId - 任务实例ID
 * @param {Object} taskConfig - 任务配置对象
 */
function updateSelectedProxies(taskInstanceId, taskConfig) {
    const proxyContainer = document.querySelector('.proxy-visual-list');
    if (!proxyContainer) return;
    
    // 获取所有选中的代理
    const selectedProxyItems = Array.from(proxyContainer.querySelectorAll('.proxy-checkbox:checked'));
    const selectedProxies = selectedProxyItems.map(checkbox => {
        const proxyItem = checkbox.closest('.proxy-item');
        const proxyData = proxyItem.dataset.proxy;
        return decodeURIComponent(proxyData);
    });
    
    // 更新配置对象
    taskConfig.proxyConfig.proxies = selectedProxies;
    
    // 更新UI显示
    const proxyCountElement = document.querySelector('.selected-proxy-count');
    if (proxyCountElement) {
        proxyCountElement.textContent = selectedProxies.length;
    }
    
    // 更新代理策略详情
    updateProxyStrategyDetails(taskInstanceId);
}

/**
 * 重新加载代理列表UI
 * @param {string} taskInstanceId - 任务实例ID
 * @param {Object} taskConfig - 任务配置对象
 * @param {Array} availableProxies - 可用的代理数组
 */
function reloadProxyList(taskInstanceId, taskConfig, availableProxies) {
    const proxyContainer = document.querySelector('.proxy-visual-list');
    if (!proxyContainer) return;
    
    // 格式化代理为字符串
    const formatProxy = (proxy) => {
        if (proxy.protocol && proxy.host && proxy.port) {
            if (proxy.username && proxy.password) {
                return `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
            }
            return `${proxy.protocol}://${proxy.host}:${proxy.port}`;
        } else if (proxy.url) {
            return proxy.url;
        } else if (proxy.proxy_url) {
            return proxy.proxy_url;
        } else if (typeof proxy === 'string') {
            return proxy;
        }
        return JSON.stringify(proxy);
    };
    
    // 生成代理卡片HTML
    const proxyCardsHTML = availableProxies.map((proxy, index) => {
        const proxyId = `proxy-${index}-${taskInstanceId}`;
        const proxyStr = formatProxy(proxy);
        const isSelected = taskConfig.proxyConfig.proxies.includes(proxyStr);
        const proxyStatus = proxy.status || 'unknown';
        const statusClass = getProxyStatusClass(proxyStatus);
        const statusText = getProxyStatusText(proxyStatus);
        
        // 提取主机和端口信息用于显示
        let displayHost = '';
        let displayPort = '';
        let displayProtocol = '';
        let hasAuth = false;
        
        if (proxy.host && proxy.port) {
            displayHost = proxy.host;
            displayPort = proxy.port;
            displayProtocol = proxy.protocol || 'http';
            hasAuth = !!(proxy.username && proxy.password);
        } else if (typeof proxy === 'string' || proxy.url || proxy.proxy_url) {
            const urlStr = proxy.url || proxy.proxy_url || proxy;
            try {
                const url = new URL(urlStr);
                displayProtocol = url.protocol.replace(':', '');
                displayHost = url.hostname;
                displayPort = url.port || (displayProtocol === 'https' ? '443' : '80');
                hasAuth = !!(url.username && url.password);
            } catch (e) {
                // 如果解析失败，直接显示原始字符串
                displayHost = typeof urlStr === 'string' ? urlStr : JSON.stringify(urlStr);
            }
        } else {
            displayHost = JSON.stringify(proxy);
        }
        
        // 地区转换为中文
        let location = '';
        if (proxy.country) {
            // 使用导入的地区转换函数
            try {
                location = translateLocation(proxy.country);
                if (proxy.city) {
                    location += `-${proxy.city}`;
                }
            } catch (e) {
                location = proxy.country + (proxy.city ? `-${proxy.city}` : '');
            }
        }
        
        return `
        <div class="proxy-item ${isSelected ? 'selected' : ''}" data-proxy="${encodeURIComponent(proxyStr)}">
            <div class="proxy-card-checkbox">
                <input type="checkbox" id="${proxyId}" class="proxy-checkbox" 
                    ${isSelected ? 'checked' : ''}>
                <label for="${proxyId}"></label>
            </div>
            <div class="proxy-card-content">
                <div class="proxy-info-row">
                    <span class="proxy-protocol">${displayProtocol}</span>
                    <span class="proxy-host">${displayHost}</span>
                    <span class="proxy-port">${displayPort}</span>
                    ${location ? `<span class="proxy-location"><i class="fas fa-globe-asia"></i> ${location}</span>` : ''}
                    ${hasAuth ? '<span class="proxy-auth-badge"><i class="fas fa-user-lock"></i> 认证</span>' : ''}
                    <span class="proxy-status ${statusClass}">
                        <i class="fas fa-circle"></i> ${statusText}
                    </span>
                </div>
            </div>
        </div>
        `;
    }).join('');
    
    // 更新UI
    proxyContainer.innerHTML = proxyCardsHTML;
    
    // 更新计数
    const proxyCountElement = document.querySelector('.selected-proxy-count');
    if (proxyCountElement) {
        proxyCountElement.textContent = taskConfig.proxyConfig.proxies.length;
    }
}

/**
 * 获取代理状态的CSS类
 * @param {string} status - 代理状态
 * @returns {string} 对应的CSS类名
 */
function getProxyStatusClass(status) {
    switch(status) {
        case 'active': return 'status-active';
        case 'inactive': return 'status-inactive';
        case 'error': return 'status-error';
        default: return 'status-unknown';
    }
}

/**
 * 获取代理状态的文本描述
 * @param {string} status - 代理状态
 * @returns {string} 状态的文本描述
 */
function getProxyStatusText(status) {
    switch(status) {
        case 'active': return '可用';
        case 'inactive': return '不可用';
        case 'error': return '错误';
        default: return '未测试';
    }
}

/**
 * 更新代理策略详情区域的UI显示
 * @param {string} taskInstanceId - 当前任务的ID
 */
function updateProxyStrategyDetails(taskInstanceId) {
    const currentTaskConfig = batchTaskConfigs[taskInstanceId];
    if (!currentTaskConfig) return;
    
    const proxyStrategyDetailsDiv = document.querySelector('.proxy-strategy-details');
    if (!proxyStrategyDetailsDiv) return;
    
    const strategy = currentTaskConfig.proxyConfig.strategy;
    const accountsCount = currentTaskConfig.accounts.length;
    const proxiesCount = currentTaskConfig.proxyConfig.proxies.length;
    
    let detailsHTML = '';
    
    if (strategy === 'one-to-one') {
        // 一对一策略的UI
        detailsHTML = `
            <div class="proxy-one-to-one">
                <div class="proxy-strategy-description">
                    <i class="fas fa-info-circle"></i>
                    <span>一对一模式下，每个账户将分配一个唯一的代理，代理数量需≥账户数量</span>
                </div>
                <div class="proxy-assignment-preview">
                    <div class="accounts-count">
                        <div class="count-value">${accountsCount}</div>
                        <div class="count-label">账户数</div>
                    </div>
                    <div class="assignment-arrow">
                        <i class="fas fa-long-arrow-alt-right"></i>
                    </div>
                    <div class="proxies-count ${proxiesCount < accountsCount ? 'warning' : ''}">
                        <div class="count-value">${proxiesCount}</div>
                        <div class="count-label">代理数</div>
                        ${proxiesCount < accountsCount ? 
                            `<div class="count-warning">代理不足</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    } else {
        // 一对多策略的UI
        const accountsPerProxy = proxiesCount > 0 ? Math.ceil(accountsCount / proxiesCount) : accountsCount;
        
        detailsHTML = `
            <div class="proxy-one-to-many">
                <div class="proxy-strategy-description">
                    <i class="fas fa-info-circle"></i>
                    <span>一对多模式下，多个账户共用一组代理，适合代理数量有限的场景</span>
                </div>
                <div class="proxy-assignment-preview">
                    <div class="accounts-count">
                        <div class="count-value">${accountsCount}</div>
                        <div class="count-label">账户数</div>
                    </div>
                    <div class="assignment-diagram">
                        <div class="assignment-lines"></div>
                    </div>
                    <div class="proxies-count">
                        <div class="count-value">${proxiesCount}</div>
                        <div class="count-label">代理数</div>
                        ${proxiesCount === 0 ? 
                            `<div class="count-warning">至少需要1个代理</div>` : ''}
                    </div>
                </div>
                <div class="proxy-distribution">
                    <div class="distribution-label">每个代理将服务:</div>
                    <div class="distribution-value">
                        ${proxiesCount > 0 ? 
                            `约 ${accountsPerProxy} 个账户` : 
                            '全部账户'}
                    </div>
                </div>
            </div>
        `;
    }
    
    proxyStrategyDetailsDiv.innerHTML = detailsHTML;
    
    // 更新代理警告信息
    const proxyWarningEl = document.querySelector('.proxy-count-info .proxy-warning');
    const proxyCountInfo = document.querySelector('.proxy-count-info');
    
    if (proxyCountInfo) {
        if (strategy === 'one-to-one' && proxiesCount < accountsCount) {
            if (!proxyWarningEl) {
                const warningSpan = document.createElement('span');
                warningSpan.className = 'proxy-warning';
                warningSpan.textContent = `（一对一模式下需要至少 ${accountsCount} 个代理）`;
                proxyCountInfo.appendChild(warningSpan);
            } else {
                proxyWarningEl.textContent = `（一对一模式下需要至少 ${accountsCount} 个代理）`;
            }
        } else if (proxyWarningEl) {
            proxyWarningEl.remove();
        }
    }
}

/**
 * 保存当前激活模块的数据到 batchTaskConfigs
 * @param {string} taskInstanceId - 当前配置的任务实例的ID
 */
function saveCurrentModuleData(taskInstanceId) {
    if (!taskInstanceId || !batchTaskConfigs[taskInstanceId]) {
        console.warn(`saveCurrentModuleData: 任务配置 for ${taskInstanceId} 未找到或 taskInstanceId 未定义`);
        return;
    }

    const currentConfig = batchTaskConfigs[taskInstanceId];
    const moduleId = moduleOrder[currentModuleIndex]; // 应该总是 'simple-config'

    if (moduleId === 'simple-config') {
        // 账户选择的保存已经通过事件监听实时更新了 currentConfig.accounts

        // 代理配置的保存
        const proxyEnabledCheckbox = document.getElementById(`proxy-enabled-${taskInstanceId}`);
        
        // 检查代理启用/禁用状态
        if (proxyEnabledCheckbox) {
            currentConfig.proxyConfig.enabled = proxyEnabledCheckbox.checked;
        }
        
        // 代理策略从单选按钮中获取
        const strategyOneToOneRadio = document.getElementById(`strategy-one-to-one-${taskInstanceId}`);
        const strategyOneToManyRadio = document.getElementById(`strategy-one-to-many-${taskInstanceId}`);
        
        if (strategyOneToOneRadio && strategyOneToOneRadio.checked) {
            currentConfig.proxyConfig.strategy = 'one-to-one';
        } else if (strategyOneToManyRadio && strategyOneToManyRadio.checked) {
            currentConfig.proxyConfig.strategy = 'one-to-many';
        }
        
        // 选中的代理由updateSelectedProxies函数实时更新，不需要在此处处理
        // 但可以进行一次额外的更新以确保数据一致性
        const proxyContainer = document.querySelector('.proxy-visual-list');
        if (proxyContainer) {
            const selectedProxyItems = Array.from(proxyContainer.querySelectorAll('.proxy-checkbox:checked'));
            const selectedProxies = selectedProxyItems.map(checkbox => {
                const proxyItem = checkbox.closest('.proxy-item');
                if (proxyItem && proxyItem.dataset.proxy) {
                    return decodeURIComponent(proxyItem.dataset.proxy);
                }
                return null;
            }).filter(proxy => proxy !== null);
            
            // 仅在有变更时更新配置
            if (JSON.stringify(selectedProxies) !== JSON.stringify(currentConfig.proxyConfig.proxies)) {
                currentConfig.proxyConfig.proxies = selectedProxies;
                console.log('已更新代理选择:', selectedProxies);
            }
        }
        
        console.log(`保存的配置 for ${taskInstanceId}:`, JSON.parse(JSON.stringify(currentConfig))); // 使用深拷贝打印，避免后续修改影响日志
    } else {
        console.warn(`saveCurrentModuleData: 未知模块ID ${moduleId}`);
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