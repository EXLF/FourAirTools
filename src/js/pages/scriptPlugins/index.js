// Import helpers and modules
import { setupFilteringAndSearch } from '../../components/tableHelper.js'; // Note: Using this for cards for now
import { showModal } from '../../components/modal.js';
import { renderScriptDetailView, setCurrentScriptId, addLogEntry } from './detail.js';
// import * as table from './table.js'; // If using a table layout
// import * as modals from './modals.js';
// import * as actions from './actions.js';

// 视图状态
let currentView = 'cards'; // 'cards' or 'detail'
let contentAreaRef = null; // 保存内容区域引用

/**
 * 初始化脚本插件页面。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initScriptPluginPage(contentArea) {
    console.log("Initializing Script Plugins Page...");
    contentAreaRef = contentArea;
    
    // 初始化卡片视图
    initializeCardsView(contentArea);
    
    // 为全局添加导航和脚本加载方法
    window.navigateToScriptCards = navigateToScriptCards;
    window.loadScriptDetail = loadScriptDetail;
}

/**
 * 初始化卡片视图
 * @param {HTMLElement} contentArea - 内容区域元素
 */
function initializeCardsView(contentArea) {
    // 设置当前视图
    currentView = 'cards';
    
    // 创建卡片容器
    contentArea.innerHTML = `
        <div class="page-header">
            <h1>脚本插件</h1>
            <p>管理脚本任务，提高Web3操作效率</p>
                 </div>
        
        <div class="scripts-filter-bar">
            <div class="search-box">
                <input type="text" id="scriptSearchInput" placeholder="搜索脚本...">
                <i class="fas fa-search"></i>
             </div>
            <div class="filter-actions">
                <select id="scriptTypeFilter">
                    <option value="">全部类型</option>
                    <option value="local">本地脚本</option>
                    <option value="remote">远程脚本</option>
                </select>
                <select id="scriptStatusFilter">
                    <option value="">全部状态</option>
                    <option value="active">可用</option>
                    <option value="inactive">不可用</option>
                </select>
                 </div>
             </div>
        
        <div class="script-cards-grid" id="scriptCardsContainer">
            <!-- 脚本卡片将在这里动态生成 -->
         </div>
    `;
    
    // 初始化脚本卡片
    initializeScriptCards();
    
    // 初始化搜索和筛选功能
    initializeSearchFunction();
}

/**
 * 初始化详情视图
 * @param {HTMLElement} contentArea - 内容区域元素
 * @param {string} scriptId - 脚本ID
 */
function initializeDetailView(contentArea, scriptId) {
    // 设置当前视图和脚本ID
    currentView = 'detail';
    setCurrentScriptId(scriptId);
    
    // 获取脚本数据
    const scriptData = getScriptData(scriptId);
    if (!scriptData) {
        console.error(`Script with ID ${scriptId} not found.`);
        navigateToScriptCards();
        return;
    }
    
    // 初始化详情视图，使用从detail.js导入的函数
    renderScriptDetailView(contentArea, scriptData);
}

/**
 * 导航到卡片视图
 */
function navigateToScriptCards() {
    if (contentAreaRef) {
        initializeCardsView(contentAreaRef);
    }
}

/**
 * 加载脚本详情
 * @param {string} scriptId - 脚本ID
 */
function loadScriptDetail(scriptId) {
    if (contentAreaRef) {
        initializeDetailView(contentAreaRef, scriptId);
    }
}

/**
 * 获取脚本数据
 * @param {string} scriptId - 脚本ID
 * @returns {Object|null} 脚本数据对象或null
 */
function getScriptData(scriptId) {
    // 模拟从数据源获取脚本数据
    const scripts = [
        {
            id: 'print123',
            name: '打印123',
            description: '简单的测试脚本，用于打印数字123。',
            type: '本地脚本',
            status: 'active',
            imageUrl: 'https://public.rootdata.com/images/b6/1745979546369.png',
            author: '系统',
            createdAt: '2024-05-01',
            updatedAt: '2024-05-29'
        },
        {
            id: 'noimage',
            name: '无图片脚本',
            description: '这个脚本没有图片，将显示默认图标。演示发送HTTP请求以获取数据。',
            type: '本地脚本',
            status: 'active',
            author: '系统',
            createdAt: '2024-05-10',
            updatedAt: '2024-05-28'
        },
        {
            id: 'script3',
            name: '示例脚本3',
            description: '远程脚本示例，目前处于不可用状态。',
            type: '远程脚本',
            status: 'inactive',
            author: 'Remote User',
            createdAt: '2024-05-15',
            updatedAt: '2024-05-20'
        },
        {
            id: 'script4',
            name: '示例脚本4',
            description: '另一个本地脚本示例，用于测试各种功能。',
            type: '本地脚本',
            status: 'active',
            imageUrl: 'https://public.rootdata.com/images/b6/1745979546369.png',
            author: '系统',
            createdAt: '2024-05-12',
            updatedAt: '2024-05-25'
        }
    ];
    
    return scripts.find(script => script.id === scriptId) || null;
}

// 初始化脚本卡片
function initializeScriptCards() {
    const scriptCardsContainer = document.getElementById('scriptCardsContainer');
    if (!scriptCardsContainer) return;
    
    // 清空容器
    scriptCardsContainer.innerHTML = '';
    
    // 获取所有脚本数据
    const scripts = [
        {
            id: 'print123',
            name: '打印123',
            description: '简单的测试脚本，用于打印数字123。',
            type: '本地脚本',
            status: 'active',
            imageUrl: 'https://public.rootdata.com/images/b6/1745979546369.png'
        },
        {
            id: 'noimage',
            name: '无图片脚本',
            description: '这个脚本没有图片，将显示默认图标。',
            type: '本地脚本',
            status: 'active'
        },
        {
            id: 'script3',
            name: '示例脚本3',
            description: '远程脚本示例，目前处于不可用状态。',
            type: '远程脚本',
            status: 'inactive'
        },
        {
            id: 'script4',
            name: '示例脚本4',
            description: '另一个本地脚本示例，用于测试各种功能。',
            type: '本地脚本',
            status: 'active',
            imageUrl: 'https://public.rootdata.com/images/b6/1745979546369.png'
        }
    ];
    
    // 创建脚本卡片
    scripts.forEach(scriptData => {
        const card = createScriptCard(scriptData);
        scriptCardsContainer.appendChild(card);
    });
}

// 创建脚本卡片元素
function createScriptCard(scriptData) {
    const card = document.createElement('div');
    card.className = 'script-card';
    card.setAttribute('data-script-id', scriptData.id);
    card.setAttribute('data-script-type', scriptData.type === '远程脚本' ? 'remote' : 'local');
    card.setAttribute('data-script-status', scriptData.status);
    
    // 卡片图标部分 - 支持图片URL或默认图标
    const iconHTML = scriptData.imageUrl 
        ? `<div class="card-icon">
             <img src="${scriptData.imageUrl}" alt="${scriptData.name}" class="script-image">
           </div>`
        : `<div class="card-icon code-icon">
             <i class="fas fa-code"></i>
           </div>`;
    
    card.innerHTML = `
        ${iconHTML}
        <div class="card-content">
            <h3 class="card-title">${scriptData.name}</h3>
            <p class="card-description">${scriptData.description}</p>
        </div>
        <div class="card-footer">
            <span class="card-meta">${scriptData.type}</span>
            <span class="card-status ${scriptData.status}">${scriptData.status === 'active' ? '可用' : '不可用'}</span>
        </div>
    `;
    
    // 绑定卡片点击事件，切换到详情视图
    card.addEventListener('click', () => {
        const scriptId = card.getAttribute('data-script-id');
        loadScriptDetail(scriptId);
    });
    
    return card;
}

/**
 * 初始化搜索和筛选功能
 */
function initializeSearchFunction() {
    const searchInput = document.getElementById('scriptSearchInput');
    const typeFilter = document.getElementById('scriptTypeFilter');
    const statusFilter = document.getElementById('scriptStatusFilter');
    
    if (!searchInput || !typeFilter || !statusFilter) return;
    
    // 搜索功能
    searchInput.addEventListener('input', filterScriptCards);
    
    // 类型筛选
    typeFilter.addEventListener('change', filterScriptCards);
    
    // 状态筛选
    statusFilter.addEventListener('change', filterScriptCards);
}

/**
 * 筛选脚本卡片
 */
function filterScriptCards() {
    const searchInput = document.getElementById('scriptSearchInput');
    const typeFilter = document.getElementById('scriptTypeFilter');
    const statusFilter = document.getElementById('scriptStatusFilter');
    const cards = document.querySelectorAll('.script-card');
    
    if (!searchInput || !typeFilter || !statusFilter || !cards.length) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const typeValue = typeFilter.value;
    const statusValue = statusFilter.value;
    
    cards.forEach(card => {
        const title = card.querySelector('.card-title').textContent.toLowerCase();
        const description = card.querySelector('.card-description').textContent.toLowerCase();
        const type = card.getAttribute('data-script-type');
        const status = card.getAttribute('data-script-status');
        
        const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
        const matchesType = !typeValue || type === typeValue;
        const matchesStatus = !statusValue || status === statusValue;
        
        if (matchesSearch && matchesType && matchesStatus) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

/**
 * 初始化脚本详情页面
 * @param {Object} scriptInfo - 脚本信息对象
 */
function setupScriptDetailView(scriptInfo) {
    const container = document.querySelector('.script-detail-wrapper');
    if (!container) {
        console.error('脚本详情页容器不存在');
        return;
    }
    
    // 确保能访问到详情页模块
    if (window.ScriptDetail && typeof window.ScriptDetail.init === 'function') {
        window.ScriptDetail.init(container, scriptInfo);
    } else {
        console.error('未找到ScriptDetail模块');
    }
}

/**
 * 导航到脚本详情页
 * @param {string} scriptId - 脚本ID
 */
function navigateToScriptDetail(scriptId) {
    // 暂时使用模拟数据
    const scriptInfo = getMockScriptInfo(scriptId);
    
    // 隐藏卡片视图，显示详情视图
    document.querySelector('.script-cards-wrapper').style.display = 'none';
    document.querySelector('.script-detail-wrapper').style.display = 'block';
    
    // 初始化详情页
    setupScriptDetailView(scriptInfo);
    
    // 更新页面URL（如果需要）
    // history.pushState(null, null, `?view=detail&id=${scriptId}`);
}

/**
 * 导航回脚本列表页
 */
function navigateToScriptList() {
    document.querySelector('.script-cards-wrapper').style.display = 'flex';
    document.querySelector('.script-detail-wrapper').style.display = 'none';
    
    // 更新页面URL（如果需要）
    // history.pushState(null, null, '?view=list');
}

/**
 * 获取模拟脚本数据
 * @param {string} scriptId - 脚本ID
 * @returns {Object} 脚本信息对象
 */
function getMockScriptInfo(scriptId) {
    // 模拟脚本数据库
    const mockScripts = [
        {
            id: 'script1',
            name: 'Uniswap自动兑换',
            description: '在Uniswap上自动进行ETH与指定代币的兑换交易',
            type: 'swap',
            status: 'active',
            updateTime: '2023-05-15',
            config: {
                tokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f', // DAI
                slippage: 0.5,
                useGasOptimizer: true
            },
            requiresWallet: true
        },
        {
            id: 'script2',
            name: 'NFT抢购助手',
            description: '监控NFT上新并自动参与抢购，支持多市场',
            type: 'mint',
            status: 'active',
            updateTime: '2023-06-22',
            config: {
                marketplaces: ['opensea', 'blur'],
                maxPrice: 0.5,
                autoConfirm: false
            },
            requiresWallet: true
        },
        {
            id: 'script3',
            name: '多链资产查询',
            description: '一键查询多链钱包余额和代币价值',
            type: 'query',
            status: 'active',
            updateTime: '2023-04-08',
            config: {
                chains: ['ethereum', 'bsc', 'polygon'],
                includeNFTs: true,
                refreshInterval: 60
            },
            requiresWallet: true
        },
        {
            id: 'script4',
            name: '跨链资产桥接',
            description: '在不同区块链网络间安全转移资产',
            type: 'bridge',
            status: 'active',
            updateTime: '2023-07-11',
            config: {
                sourceChain: 'ethereum',
                targetChain: 'polygon',
                useFastMode: false
            },
            requiresWallet: true
        }
    ];
    
    return mockScripts.find(script => script.id === scriptId) || mockScripts[0];
}

/**
 * 初始化页面
 */
function init() {
    // 创建脚本卡片
    const scriptCards = [
        { id: 'script1', name: 'Uniswap自动兑换', description: '在Uniswap上自动进行ETH与指定代币的兑换交易', status: 'active' },
        { id: 'script2', name: 'NFT抢购助手', description: '监控NFT上新并自动参与抢购，支持多市场', status: 'active' },
        { id: 'script3', name: '多链资产查询', description: '一键查询多链钱包余额和代币价值', status: 'active' },
        { id: 'script4', name: '跨链资产桥接', description: '在不同区块链网络间安全转移资产', status: 'active' },
        { id: 'script5', name: '交易数据分析', description: '分析历史交易数据，提供优化建议', status: 'inactive' },
        { id: 'script6', name: '定时DCA投资', description: '设置定时定额购买策略，实现数字资产的平均成本投资', status: 'inactive' }
    ];
    
    const cardsContainer = document.querySelector('.script-cards');
    scriptCards.forEach(card => {
        const cardElement = createScriptCard(card);
        cardsContainer.appendChild(cardElement);
        
        // 添加点击事件以跳转到详情页
        cardElement.addEventListener('click', () => {
            navigateToScriptDetail(card.id);
        });
    });
    
    // 绑定搜索功能
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const keyword = this.value.toLowerCase().trim();
            const cards = document.querySelectorAll('.script-card');
            
            cards.forEach(card => {
                const name = card.querySelector('.card-title').textContent.toLowerCase();
                const description = card.querySelector('.card-desc').textContent.toLowerCase();
                
                if (name.includes(keyword) || description.includes(keyword)) {
                    card.style.display = 'flex';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    }
    
    // 将函数导出到全局
    window.navigateToScriptDetail = navigateToScriptDetail;
    window.navigateToScriptList = navigateToScriptList;
}

// 在DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', init); 