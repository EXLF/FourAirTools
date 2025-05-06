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
let availableScripts = []; // <--- 新增：用于存储从后端获取的脚本

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
async function initializeCardsView(contentArea) {
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
                    <option value="">全部分类</option>
                    <!-- 类型/分类选项可以后续动态生成 -->
                </select>
                <select id="scriptStatusFilter">
                    <option value="">全部状态</option>
                    <option value="active">可用</option>
                    <!-- 可以添加其他状态 -->
                </select>
                 </div>
             </div>
        
        <div class="script-cards-grid" id="scriptCardsContainer">
            <div class="loading-indicator">正在加载脚本列表...</div> <!-- 添加加载提示 -->
         </div>
    `;
    
    // 初始化脚本卡片
    await loadAndRenderScriptCards();
    
    // 初始化搜索和筛选功能
    initializeSearchFunction();
    // (可选) 动态填充筛选器选项
    populateFilters();
}

/**
 * 从后端加载脚本并渲染卡片
 */
async function loadAndRenderScriptCards() {
    const scriptCardsContainer = document.getElementById('scriptCardsContainer');
    if (!scriptCardsContainer) return;
    
    try {
        console.log("Fetching scripts from backend...");
        const result = await window.scriptAPI.getAllScripts();
        console.log("Scripts fetched:", result);

        scriptCardsContainer.innerHTML = ''; // 清空加载提示或旧卡片

        if (result && result.success && Array.isArray(result.scripts)) {
            availableScripts = result.scripts; // 存储获取到的脚本

            if (availableScripts.length === 0) {
                 scriptCardsContainer.innerHTML = '<p>未找到可用脚本。</p>';
                 return;
            }

            // 创建脚本卡片
            availableScripts.forEach(scriptMetadata => {
                 // 准备传递给 createScriptCard 的数据
                 const scriptDataForCard = {
                     id: scriptMetadata.id,
                     name: scriptMetadata.name,
                     description: scriptMetadata.description || '无描述',
                     // 使用 category 作为 type，如果没有则默认为 '未知分类'
                     type: scriptMetadata.category || '未知分类',
                     // 假设所有从后端获取的脚本都是可用的
                     status: 'active',
                     // 传递图标信息给 createScriptCard
                     icon: scriptMetadata.icon,
                     imageUrl: scriptMetadata.imageUrl // <--- 新增：传递图片URL
                 };
                 const card = createScriptCard(scriptDataForCard);
                 scriptCardsContainer.appendChild(card);
            });
        } else {
            console.error("Failed to load scripts:", result ? result.error : 'Unknown error');
            scriptCardsContainer.innerHTML = `<p class="error-message">加载脚本列表失败: ${result ? result.error : '未知错误'}</p>`;
            availableScripts = []; // 清空脚本列表
        }
    } catch (error) {
        console.error("Error fetching scripts:", error);
        scriptCardsContainer.innerHTML = `<p class="error-message">加载脚本列表时出错: ${error.message}</p>`;
        availableScripts = []; // 清空脚本列表
    }
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
    
    // 从存储的真实脚本数据中获取
    const scriptMetadata = getScriptData(scriptId);
    if (!scriptMetadata) {
        console.error(`Script with ID ${scriptId} not found in available scripts.`);
        // 可以显示错误消息或导航回列表
        addLogEntry('error', '系统', `无法加载脚本 ${scriptId} 的数据。`);
        navigateToScriptCards();
        return;
    }
    
    console.log(`Loading detail view for script: ${scriptId}`, scriptMetadata);
    
    // 注意：renderScriptDetailView 需要的是 scriptData 对象，其结构可能与 metadata 不同
    // 我们需要确保传递给它的对象包含它需要的所有属性（如 name, description, author, createdAt, updatedAt 等）
    // 这里直接传递后端返回的 metadata，如果 renderScriptDetailView 内部需要特定字段，
    // 可能需要调整 renderScriptDetailView 或在这里适配数据结构。
    // 假设 renderScriptDetailView 能处理 metadata 或已调整。
    renderScriptDetailView(contentArea, scriptMetadata);
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
 * 从已加载的脚本列表中获取脚本数据 (元数据)
 * @param {string} scriptId - 脚本ID
 * @returns {Object|null} 脚本元数据对象或null
 */
function getScriptData(scriptId) {
    // <--- 不再使用模拟数据，从 availableScripts 查找
    console.log(`Searching for scriptId: ${scriptId} in`, availableScripts);
    return availableScripts.find(script => script.id === scriptId) || null;
}

/**
 * 创建脚本卡片元素
 * @param {Object} scriptData - 包含脚本信息的对象
 *            { id, name, description, type, status, icon, imageUrl }
 * @returns {HTMLElement} 卡片DOM元素
 */
function createScriptCard(scriptData) {
    const card = document.createElement('div');
    card.className = 'script-card';
    card.setAttribute('data-script-id', scriptData.id);
    card.setAttribute('data-script-type', scriptData.type.toLowerCase());
    card.setAttribute('data-script-status', scriptData.status);
    
    // 卡片图标部分 - 优先级：imageUrl > icon > 默认图标
    let iconHTML;
    if (scriptData.imageUrl) {
        // 优先使用图片URL
        iconHTML = `<div class="card-icon"> <!-- 保持原有图片容器类名 -->
                       <img src="${scriptData.imageUrl}" alt="${scriptData.name}" class="script-image"> <!-- 保持原有图片类名 -->
                    </div>`;
    } else if (scriptData.icon) {
        // 其次使用 FontAwesome 图标
        iconHTML = `<div class="card-icon fa-icon">
                       <i class="fas fa-${scriptData.icon}"></i>
                    </div>`;
    } else {
        // 最后使用默认代码图标
        iconHTML = `<div class="card-icon code-icon">
                       <i class="fas fa-code"></i>
                    </div>`;
    }
    
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
        // 读取 data-script-type 属性进行类型匹配
        const type = card.getAttribute('data-script-type');
        const status = card.getAttribute('data-script-status');
        
        const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
        // 类型筛选：如果选了 '全部类型' (value 为空) 则匹配，否则比较 type 和 typeValue
        // 确保比较时大小写一致，这里 data-script-type 已经是小写
        const matchesType = !typeValue || type === typeValue.toLowerCase();
        const matchesStatus = !statusValue || status === statusValue;
        
        if (matchesSearch && matchesType && matchesStatus) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

/**
 * (新增) 动态填充筛选器选项
 */
function populateFilters() {
    const typeFilter = document.getElementById('scriptTypeFilter');
    if (!typeFilter || !availableScripts) return;

    // 获取所有唯一的分类
    const categories = [...new Set(availableScripts.map(script => script.category || '未知分类'))];

    // 清空现有选项 (保留 "全部类型")
    while (typeFilter.options.length > 1) {
        typeFilter.remove(1);
    }

    // 添加分类选项
    categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category.toLowerCase(); // 使用小写值
        option.textContent = category;
        typeFilter.appendChild(option);
    });
}

// 移除或注释掉不再使用的函数和模拟数据获取
// function setupScriptDetailView(scriptInfo) { ... }
// function navigateToScriptDetail(scriptId) { ... }
// function navigateToScriptList() { ... }
// function getMockScriptInfo(scriptId) { ... }
// function init() { ... } // DOMContentLoaded 逻辑移至 initScriptPluginPage 或其调用者

// 注意：原文件末尾的 DOMContentLoaded 事件监听器和 init 函数已被移除。
// initScriptPluginPage 函数现在是此模块的入口点，应在导航到此页面时被调用。 