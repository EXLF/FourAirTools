/**
 * 脚本插件页面 - 管理和执行用户脚本
 */

// Import helpers and modules
import { loadPage } from '../../core/navigation.js'; // <--- 新增导入
import { setupFilteringAndSearch } from '../../components/tableHelper.js'; // Note: Using this for cards for now
import { showModal } from '../../components/modal.js';
import { renderScriptDetailView, setCurrentScriptId } from './detail/index.js';
import { addLogEntry } from './detail/logger.js';  // 从正确的位置导入
// import * as table from './table.js'; // If using a table layout
// import * as modals from './modals.js';
// import * as actions from './actions.js';

// 视图状态
let currentView = 'cards'; // 'cards' or 'detail'
let contentAreaRef = null; // 保存内容区域引用
let availableScripts = []; // <--- 新增：用于存储从后端获取的脚本

// 获取和管理用户脚本的模块
const ScriptManager = {
  /**
   * 获取所有可用的脚本
   * @returns {Promise<Array>} 脚本列表
   */
  async getAvailableScripts() {
    try {
      const response = window.scriptAPI && typeof window.scriptAPI.getAllScripts === 'function'
        ? await window.scriptAPI.getAllScripts()
        : await window.electron.ipcRenderer.invoke('get-available-scripts');
        
      if (response.success) {
        return response.data || response.scripts || [];
      } else {
        console.error('获取脚本列表失败:', response.error);
        return [];
      }
    } catch (error) {
      console.error('调用获取脚本列表失败:', error);
      return [];
    }
  },

  /**
   * 获取单个脚本的详细信息
   * @param {string} scriptFileName - 脚本文件名
   * @returns {Promise<Object|null>} 脚本元数据
   */
  async getScriptMetadata(scriptFileName) {
    try {
      const response = await window.electron.ipcRenderer.invoke('get-script-metadata', scriptFileName);
      if (response.success) {
        return response.data;
      } else {
        console.error(`获取脚本 ${scriptFileName} 元数据失败:`, response.error);
        return null;
      }
    } catch (error) {
      console.error(`调用获取脚本元数据失败:`, error);
      return null;
    }
  },

  /**
   * 运行脚本
   * @param {string} scriptFileName - 脚本文件名
   * @param {Object} params - 脚本参数
   * @param {Array<string>} walletIds - 要使用的钱包ID列表
   * @returns {Promise<Object>} 执行结果
   */
  async runScript(scriptFileName, params = {}, walletIds = []) {
    try {
      const response = await window.electron.ipcRenderer.invoke('run-script', {
        scriptFileName,
        params,
        walletIds
      });
      
      return response;
    } catch (error) {
      console.error(`运行脚本 ${scriptFileName} 失败:`, error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 停止正在运行的脚本
   * @param {string} executionId - 脚本执行ID
   * @returns {Promise<Object>} 停止结果
   */
  async stopScript(executionId) {
    try {
      const response = await window.electron.ipcRenderer.invoke('stop-script', executionId);
      return response;
    } catch (error) {
      console.error(`停止脚本执行 ${executionId} 失败:`, error);
      return { success: false, error: error.message };
    }
  },

  /**
   * 获取所有正在运行的脚本
   * @returns {Promise<Array>} 正在运行的脚本列表
   */
  async getRunningScripts() {
    try {
      const response = await window.electron.ipcRenderer.invoke('get-running-scripts');
      if (response.success) {
        return response.data;
      } else {
        console.error('获取正在运行的脚本列表失败:', response.error);
        return [];
      }
    } catch (error) {
      console.error('调用获取正在运行的脚本列表失败:', error);
      return [];
    }
  },

  /**
   * 注册脚本事件监听器
   * @param {Object} listeners - 事件监听器对象
   * @param {Function} listeners.onProgress - 进度更新回调
   * @param {Function} listeners.onCompleted - 完成回调
   * @param {Function} listeners.onError - 错误回调
   * @returns {Object} 包含取消监听的方法
   */
  registerListeners({ onProgress, onCompleted, onError }) {
    // 进度更新
    const progressHandler = (event, data) => {
      if (onProgress && typeof onProgress === 'function') {
        onProgress(data.executionId, data.progress);
      }
    };

    // 完成事件
    const completedHandler = (event, data) => {
      if (onCompleted && typeof onCompleted === 'function') {
        onCompleted(data.executionId, data.result);
      }
    };

    // 错误事件
    const errorHandler = (event, data) => {
      if (onError && typeof onError === 'function') {
        onError(data.executionId, data.error, data.stack);
      }
    };

    // 注册监听器
    const ipcRenderer = window.electron?.ipcRenderer;
    
    if (ipcRenderer) {
        ipcRenderer.on('script-progress', progressHandler);
        ipcRenderer.on('script-completed', completedHandler);
        ipcRenderer.on('script-error', errorHandler);
    } else {
        console.warn('[ScriptManager] ipcRenderer is not available. Script event listeners not registered.');
    }

    // 返回取消监听的方法
    return {
      unregister: () => {
        if (ipcRenderer) {
            ipcRenderer.removeListener('script-progress', progressHandler);
            ipcRenderer.removeListener('script-completed', completedHandler);
            ipcRenderer.removeListener('script-error', errorHandler);
        }
      }
    };
  }
};

/**
 * 初始化脚本插件页面。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initScriptPluginPage(contentArea) {
    console.log("Initializing Script Plugins Page (index.js)...");
    contentAreaRef = contentArea;
    renderScriptPluginsListView(contentArea);
}

/**
 * 设置脚本插件列表视图的结构、事件监听器并加载初始数据。
 * (替换原 initializeCardsView)
 * @param {HTMLElement} pageContentArea - 脚本插件页面的主内容区域 (由 navigation.js 传入的HTML模板的根).
 */
async function renderScriptPluginsListView(pageContentArea) {
    currentView = 'cards';

    // const addScriptBtn = pageContentArea.querySelector('#add-script-btn'); // 按钮已移除
    const refreshBtn = pageContentArea.querySelector('#refresh-scripts-list-btn');
    const searchInput = pageContentArea.querySelector('#scriptSearchInput');
    const typeFilter = pageContentArea.querySelector('#scriptTypeFilter');
    const statusFilter = pageContentArea.querySelector('#scriptStatusFilter');
    const scriptCardsContainer = pageContentArea.querySelector('#scriptCardsContainer');

    // if (!scriptCardsContainer || !searchInput || !typeFilter || !statusFilter || !addScriptBtn || !refreshBtn) { // addScriptBtn 不再是必需的
    if (!scriptCardsContainer || !searchInput || !typeFilter || !statusFilter || !refreshBtn) {
        console.error("Script Plugins Page (index.js): Could not find one or more required elements in the template. Content Area:", pageContentArea);
        if(pageContentArea) pageContentArea.innerHTML = "<p class='notice error'>页面结构加载不完整，请检查模板文件。</p>";
        return;
    }
    
    // addScriptBtn.addEventListener('click', handleAddScript); // 事件监听器已移除
    refreshBtn.addEventListener('click', () => {
        loadAndRenderScriptCards(scriptCardsContainer, typeFilter, statusFilter);
    });

    await loadAndRenderScriptCards(scriptCardsContainer, typeFilter, statusFilter);
    initializeSearchFunction(searchInput, typeFilter, statusFilter, scriptCardsContainer);
}

/**
 * 从后端加载脚本并渲染卡片, 并填充筛选器选项
 * @param {HTMLElement} cardsContainer - 脚本卡片容器元素
 * @param {HTMLElement} typeFilterElement - 类型筛选器 <select> 元素
 * @param {HTMLElement} statusFilterElement - 状态筛选器 <select> 元素
 */
async function loadAndRenderScriptCards(cardsContainer, typeFilterElement, statusFilterElement) {
    if (!cardsContainer) {
        console.error("loadAndRenderScriptCards: scriptCardsContainer is null");
        return;
    }
    
    cardsContainer.innerHTML = '<div class="loading-indicator">正在加载脚本列表...</div>';
    
    try {
        const scripts = await ScriptManager.getAvailableScripts();
        availableScripts = scripts; // 更新全局可用脚本列表

        if (!Array.isArray(scripts)) {
            console.error('获取到的脚本列表不是一个数组:', scripts);
            cardsContainer.innerHTML = '<div class="notice error">加载脚本列表失败: 数据格式错误。</div>';
            return;
        }

        if (scripts.length === 0) {
            cardsContainer.innerHTML = '<div class="notice empty"><i class="fas fa-info-circle"></i> 未找到可用脚本。</div>';
        } else {
            cardsContainer.innerHTML = ''; // 清空加载提示
            scripts.forEach(scriptData => {
                const cardElement = createScriptCard(scriptData);
                if (cardElement) {
                    cardsContainer.appendChild(cardElement);
                }
            });
        }
        
        // 在脚本加载和渲染完成后，填充筛选器选项
        if (typeFilterElement && statusFilterElement) { // 确保元素存在
             populateFilters(typeFilterElement, statusFilterElement, availableScripts);
        } else {
            console.warn("Filter elements not provided to loadAndRenderScriptCards, skipping populateFilters.");
        }

    } catch (error) {
        console.error('加载并渲染脚本卡片时出错:', error);
        cardsContainer.innerHTML = '<div class="notice error">加载脚本列表时发生错误，请稍后重试。</div>';
        availableScripts = []; // 清空脚本列表
    }
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
    card.setAttribute('data-script-type', (scriptData.category || scriptData.type || '').toLowerCase());
    card.setAttribute('data-script-status', scriptData.status || 'unknown');
    
    let iconHTML;
    if (scriptData.imageUrl) {
        iconHTML = `<div class="card-icon"><img src="${scriptData.imageUrl}" alt="${scriptData.name}" class="script-image"></div>`;
    } else if (scriptData.icon) {
        iconHTML = `<div class="card-icon fa-icon"><i class="fas fa-${scriptData.icon}"></i></div>`;
    } else {
        iconHTML = `<div class="card-icon code-icon"><i class="fas fa-code"></i></div>`;
    }
    
    const typeDisplay = scriptData.category || scriptData.type || 'N/A';
    const statusDisplay = (scriptData.status === 'active' ? '可用' : (scriptData.status || '未知'));

    card.innerHTML = `
        ${iconHTML}
        <div class="card-content">
            <h3 class="card-title">${scriptData.name || '未命名脚本'}</h3>
            <p class="card-description">${scriptData.description || '无描述'}</p>
        </div>
        <div class="card-footer">
            <span class="card-meta">${typeDisplay}</span>
            <span class="card-status ${scriptData.status}">${statusDisplay}</span>
        </div>
    `;
    
    card.addEventListener('click', () => {
        // loadScriptDetail is now a module-local function (or will be)
        // It should handle switching the view within contentAreaRef
        loadScriptDetail(scriptData.id); 
    });
    
    return card;
}

/**
 * 初始化搜索和筛选功能
 * @param {HTMLInputElement} searchInputEl
 * @param {HTMLSelectElement} typeFilterEl
 * @param {HTMLSelectElement} statusFilterEl
 * @param {HTMLElement} cardsGridEl - The container of all script cards
 */
function initializeSearchFunction(searchInputEl, typeFilterEl, statusFilterEl, cardsGridEl) {
    if (!searchInputEl || !typeFilterEl || !statusFilterEl || !cardsGridEl) {
        console.warn("initializeSearchFunction: One or more elements not provided.");
        return;
    }
    
    const performFilter = () => filterScriptCards(searchInputEl, typeFilterEl, statusFilterEl, cardsGridEl);
    
    searchInputEl.addEventListener('input', performFilter);
    typeFilterEl.addEventListener('change', performFilter);
    statusFilterEl.addEventListener('change', performFilter);
}

/**
 * 筛选脚本卡片
 * @param {HTMLInputElement} searchInputEl
 * @param {HTMLSelectElement} typeFilterEl
 * @param {HTMLSelectElement} statusFilterEl
 * @param {HTMLElement} cardsGridEl
 */
function filterScriptCards(searchInputEl, typeFilterEl, statusFilterEl, cardsGridEl) {
    // No longer query for elements, use passed-in references
    const cards = cardsGridEl.querySelectorAll('.script-card');
    
    if (!cards.length && !(searchInputEl.value || typeFilterEl.value || statusFilterEl.value)) return; // No cards and no active filter
    
    const searchTerm = searchInputEl.value.toLowerCase();
    const typeValue = typeFilterEl.value.toLowerCase(); // Ensure comparison is case-insensitive
    const statusValue = statusFilterEl.value;
    
    cards.forEach(card => {
        const title = (card.querySelector('.card-title')?.textContent || '').toLowerCase();
        const description = (card.querySelector('.card-description')?.textContent || '').toLowerCase();
        const cardType = card.getAttribute('data-script-type') || ''; // Already lowercase from createScriptCard
        const cardStatus = card.getAttribute('data-script-status') || '';
        
        const matchesSearch = title.includes(searchTerm) || description.includes(searchTerm);
        const matchesType = !typeValue || cardType === typeValue;
        const matchesStatus = !statusValue || cardStatus === statusValue;
        
        card.style.display = (matchesSearch && matchesType && matchesStatus) ? '' : 'none';
    });
}

/**
 * 动态填充筛选器选项
 * @param {HTMLSelectElement} typeFilterElement
 * @param {HTMLSelectElement} statusFilterElement - (Currently unused for populating, but good to have)
 * @param {Array} scriptsData - Array of script objects from availableScripts
 */
function populateFilters(typeFilterElement, statusFilterElement, scriptsData) {
    if (!typeFilterElement || !Array.isArray(scriptsData)) {
        console.warn("populateFilters: typeFilterElement or scriptsData not valid.");
        return;
    }

    // 获取所有唯一的分类 (使用 category 优先，然后是 type)
    const categories = [...new Set(scriptsData.map(script => script.category || script.type || '未知分类'))]
                        .filter(cat => cat !== '未知分类'); // Optionally filter out '未知分类'

    // 清空现有选项 (保留 "全部类型")
    while (typeFilterElement.options.length > 1) {
        typeFilterElement.remove(1);
    }

    categories.sort().forEach(category => {
        const option = document.createElement('option');
        option.value = category.toLowerCase();
        option.textContent = category;
        typeFilterElement.appendChild(option);
    });
    
    // TODO: Populate statusFilter if its options are also meant to be dynamic
    // For now, statusFilter options are hardcoded in the HTML template.
}

/**
 * 初始化详情视图
 * @param {HTMLElement} contentArea - 内容区域元素
 * @param {string} scriptId - 脚本ID
 */
function initializeDetailView(contentArea, scriptId) {
    currentView = 'detail';
    setCurrentScriptId(scriptId);
    
    const scriptMetadata = getScriptData(scriptId);
    if (!scriptMetadata) {
        console.error(`Script with ID ${scriptId} not found in available scripts.`);
        addLogEntry( 'system', `无法加载脚本 ${scriptId} 的数据。`, 'error');
        navigateToScriptCards();
        return;
    }
    
    console.log(`Loading detail view (index.js) for script: ${scriptId}`, scriptMetadata);
    
    // 将本模块的 loadScriptDetail 作为回调传递给详情视图，
    // 以便详情视图内部的脚本列表 (侧边栏) 可以调用它来切换脚本详情
    renderScriptDetailView(contentArea, scriptMetadata, navigateToScriptCards, loadScriptDetail);
}

/**
 * 导航到卡片视图 (重新加载并渲染脚本列表页面)
 */
function navigateToScriptCards() {
    if (typeof loadPage === 'function') {
        console.log("Navigating back to script plugins list view via loadPage...");
        // 调用 navigation.js 中的 loadPage 函数重新加载 script-plugins 页面。
        // 这会触发 initScriptPluginPage，从而正确重新渲染列表视图。
        loadPage('script-plugins'); 
    } else {
        console.error("navigateToScriptCards: loadPage function is not available. Cannot navigate back.");
        // 尝试获取 contentAreaRef，如果存在，则显示错误消息
        const currentContentArea = contentAreaRef || document.querySelector('.content-area'); // Fallback query
        if(currentContentArea) currentContentArea.innerHTML = "<p class='notice error'>导航功能出错，无法返回列表。</p>";
    }
}

/**
 * 加载脚本详情 (由卡片点击触发 或 由详情页内部侧边栏脚本列表点击触发)
 * @param {string} scriptId - 脚本ID
 */
function loadScriptDetail(scriptId) {
    if (contentAreaRef) {
        // 当从侧边栏点击时，我们实际上是重新初始化详情视图，但针对新的 scriptId
        // 这会重新渲染整个详情页内容区域
        console.log(`loadScriptDetail (index.js) called for scriptId: ${scriptId}. Re-initializing detail view.`);
        initializeDetailView(contentAreaRef, scriptId);
    } else {
        console.error("loadScriptDetail (index.js): contentAreaRef is not set.");
    }
}

/**
 * 从已加载的脚本列表中获取脚本数据 (元数据)
 * @param {string} scriptId - 脚本ID
 * @returns {Object|null} 脚本元数据对象或null
 */
function getScriptData(scriptId) {
    console.log(`Searching for scriptId: ${scriptId} in`, availableScripts);
    return availableScripts.find(script => script.id === scriptId) || null;
}

// Remaining functions for script execution, configuration, modals etc.,
// are now primarily located within the ./detail/ submodules (e.g., detail/events.js, detail/config.js)
// or interact with modals defined in HTML templates (tpl-modal-run-plugin, tpl-modal-config-plugin).

// Old, now obsolete, initialization code has been removed.
// Ensure any specific UI event listeners for script progress/completion/error
// are handled within the context where scripts are run (e.g., detail view or specific run modals)
// by using ScriptManager.registerListeners with appropriate UI callbacks.