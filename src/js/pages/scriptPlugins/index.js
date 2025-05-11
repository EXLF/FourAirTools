/**
 * 脚本插件页面 - 管理和执行用户脚本
 */

// Import helpers and modules
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
    const electron = window.electron || {};
    const ipcRenderer = electron.ipcRenderer || {
      on: () => {},
      removeListener: () => {}
    };
    
    ipcRenderer.on('script-progress', progressHandler);
    ipcRenderer.on('script-completed', completedHandler);
    ipcRenderer.on('script-error', errorHandler);

    // 返回取消监听的方法
    return {
      unregister: () => {
        ipcRenderer.removeListener('script-progress', progressHandler);
        ipcRenderer.removeListener('script-completed', completedHandler);
        ipcRenderer.removeListener('script-error', errorHandler);
      }
    };
  }
};

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
        console.log("开始获取脚本列表...");
        scriptCardsContainer.innerHTML = '<div class="loading">加载中...</div>';
        
        // 使用API获取脚本列表
        let result;
        try {
            console.log("调用scriptAPI.getAllScripts...");
            result = await window.scriptAPI.getAllScripts();
            console.log("获取到的脚本列表:", result);
            
            // 确保结果格式正确
            if (!result) {
                throw new Error("API返回空结果");
            }
        } catch (apiError) {
            console.error("调用scriptAPI.getAllScripts失败:", apiError);
            console.log("使用备用方法调用IPC...");
            result = await window.electron.ipcRenderer.invoke('get-available-scripts');
            console.log("使用备用方法获取脚本列表:", result);
        }

        scriptCardsContainer.innerHTML = '';

        // 检查返回的结果结构
        console.log("脚本结果详情:", {
            hasResult: !!result,
            success: result?.success,
            hasData: result?.data ? true : false,
            dataIsArray: Array.isArray(result?.data),
            dataLength: result?.data?.length
        });

        // 确保result和result.data是有效的
        if (result && result.success === true && Array.isArray(result.data)) {
            availableScripts = result.data;
            console.log("有效脚本数量:", availableScripts.length);

            if (availableScripts.length === 0) {
                scriptCardsContainer.innerHTML = '<div class="empty-state">未找到可用脚本。</div>';
                 return;
            }

            // 创建脚本卡片
            availableScripts.forEach((scriptMetadata, index) => {
                console.log(`处理脚本 ${index+1}/${availableScripts.length}:`, scriptMetadata);
                
                // 准备传递给 createScriptCard 的数据
                const scriptDataForCard = {
                    id: scriptMetadata.id || scriptMetadata.fileName?.replace('.js', '') || `脚本${index+1}`,
                    name: scriptMetadata.name || scriptMetadata.id || `未命名脚本${index+1}`,
                    description: scriptMetadata.description || '无描述',
                    type: scriptMetadata.category || '未知分类',
                    status: 'active',
                    icon: scriptMetadata.icon || 'code',
                    imageUrl: scriptMetadata.imageUrl || null
                };
                
                console.log("创建脚本卡片:", scriptDataForCard);
                const card = createScriptCard(scriptDataForCard);
                scriptCardsContainer.appendChild(card);
            });
        } else {
            // 提取错误信息，确保显示有意义的错误
            let errorMessage = '未知错误';
            if (result) {
                if (result.error) {
                    errorMessage = result.error;
                } else if (!result.success) {
                    errorMessage = '请求失败';
                } else if (!result.data) {
                    errorMessage = '返回数据为空';
                } else if (!Array.isArray(result.data)) {
                    errorMessage = `返回数据不是数组: ${typeof result.data}`;
                }
            } else {
                errorMessage = '返回结果为空';
            }
            
            console.error("加载脚本列表失败:", errorMessage);
            scriptCardsContainer.innerHTML = `
                <div class="error-state">
                    <p>加载脚本列表失败</p>
                    <p class="error-message">${errorMessage}</p>
                </div>
            `;
            availableScripts = [];
        }
    } catch (error) {
        console.error("获取脚本列表时出错:", error);
        scriptCardsContainer.innerHTML = `
            <div class="error-state">
                <p>加载脚本列表时出错</p>
                <p class="error-message">${error.message}</p>
            </div>
        `;
        availableScripts = [];
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

// 页面初始化
document.addEventListener('DOMContentLoaded', async () => {
  // 初始化UI组件
  initUI();
  
  // 加载可用脚本列表
  await loadScriptsList();
  
  // 注册脚本事件监听器
  registerScriptEventListeners();
});

// 初始化UI组件
function initUI() {
  // 绑定"添加脚本"按钮事件
  const addScriptBtn = document.getElementById('add-script-btn');
  if (addScriptBtn) {
    addScriptBtn.addEventListener('click', handleAddScript);
  }
  
  // 绑定"刷新脚本列表"按钮事件
  const refreshBtn = document.getElementById('refresh-scripts-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadScriptsList);
  }
}

// 加载脚本列表
async function loadScriptsList() {
  const scriptsContainer = document.getElementById('scripts-container');
  if (!scriptsContainer) return;
  
  // 显示加载中
  scriptsContainer.innerHTML = '<div class="loading">加载脚本列表中...</div>';
  
  // 获取脚本列表
  const scripts = await ScriptManager.getAvailableScripts();
  
  if (scripts.length === 0) {
    scriptsContainer.innerHTML = '<div class="empty-state">没有找到可用脚本</div>';
    return;
  }
  
  // 渲染脚本列表
  scriptsContainer.innerHTML = '';
  scripts.forEach(script => {
    const scriptCard = createScriptCard(script);
    scriptsContainer.appendChild(scriptCard);
  });
}

// 处理添加脚本
function handleAddScript() {
  // 根据实际UI和业务逻辑实现
  console.log('添加脚本');
  // 例如，打开一个文件选择对话框，或显示添加脚本的模态框
}

// 处理运行脚本
async function handleRunScript(script) {
  // 获取脚本的最新元数据（确保配置项是最新的）
  const metadata = await ScriptManager.getScriptMetadata(script.fileName);
  if (!metadata) {
    showNotification('错误', `获取脚本 ${script.name} 配置失败`, 'error');
    return;
  }
  
  // 获取用户配置的参数
  // 如果没有配置项或用户还没有配置，则打开配置对话框
  if (metadata.config && Object.keys(metadata.config).length > 0) {
    // 检查是否已保存过配置
    const savedConfig = getSavedScriptConfig(script.id);
    if (!savedConfig) {
      // 如果没有保存的配置，则先打开配置对话框
      handleConfigScript(metadata);
      return;
    }
  }
  
  // 获取脚本所需的钱包
  let selectedWalletIds = [];
  if (metadata.requires && metadata.requires.wallets) {
    selectedWalletIds = await selectWalletsForScript(metadata);
    if (!selectedWalletIds || selectedWalletIds.length === 0) {
      showNotification('提示', '请选择至少一个钱包用于脚本执行', 'warning');
      return;
    }
  }
  
  // 获取脚本配置参数
  const scriptParams = getSavedScriptConfig(script.id) || {};
  
  // 执行脚本
  try {
    const response = await ScriptManager.runScript(
      script.fileName,
      scriptParams,
      selectedWalletIds
    );
    
    if (response.success) {
      showNotification('成功', `脚本 ${script.name} 开始执行`, 'success');
      
      // 可以显示脚本执行状态或打开日志查看器
      openScriptMonitor(response.data.executionId, script);
    } else {
      showNotification('错误', `启动脚本失败: ${response.error}`, 'error');
    }
  } catch (error) {
    showNotification('错误', `执行脚本时发生错误: ${error.message}`, 'error');
  }
}

// 处理配置脚本
function handleConfigScript(script) {
  // 打开配置对话框
  openScriptConfigDialog(script);
}

// 打开脚本配置对话框
function openScriptConfigDialog(script) {
  // 根据script.config创建配置表单
  // 这里只是一个示例，实际实现可能需要更复杂的逻辑
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.id = 'script-config-modal';
  modal.setAttribute('tabindex', '-1');
  
  // 获取保存的配置（如果有）
  const savedConfig = getSavedScriptConfig(script.id) || {};
  
  let formHtml = '';
  if (script.config) {
    Object.entries(script.config).forEach(([key, field]) => {
      const value = savedConfig[key] !== undefined ? savedConfig[key] : field.default;
      formHtml += createConfigFormField(key, field, value);
    });
  }
  
  modal.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">配置脚本: ${script.name}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form id="script-config-form">
            ${formHtml || '<p>此脚本没有可配置的选项</p>'}
          </form>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
          <button type="button" class="btn btn-primary" id="save-config-btn">保存配置</button>
          <button type="button" class="btn btn-success" id="save-run-btn">保存并运行</button>
        </div>
      </div>
    </div>
  `;
  
  // 添加到DOM
  document.body.appendChild(modal);
  
  // 初始化Bootstrap Modal
  const modalInstance = new bootstrap.Modal(modal);
  modalInstance.show();
  
  // 保存配置
  const saveConfigBtn = document.getElementById('save-config-btn');
  if (saveConfigBtn) {
    saveConfigBtn.addEventListener('click', () => {
      const config = collectFormValues('script-config-form', script.config);
      saveScriptConfig(script.id, config);
      modalInstance.hide();
      showNotification('成功', '配置已保存', 'success');
    });
  }
  
  // 保存并运行
  const saveRunBtn = document.getElementById('save-run-btn');
  if (saveRunBtn) {
    saveRunBtn.addEventListener('click', () => {
      const config = collectFormValues('script-config-form', script.config);
      saveScriptConfig(script.id, config);
      modalInstance.hide();
      
      // 运行脚本
      handleRunScript(script);
    });
  }
  
  // 模态框关闭时移除DOM
  modal.addEventListener('hidden.bs.modal', () => {
    document.body.removeChild(modal);
  });
}

// 创建配置表单字段
function createConfigFormField(key, field, value) {
  let html = '';
  const fieldId = `config-${key}`;
  
  // 根据字段类型创建不同的表单控件
  switch (field.type) {
    case 'string':
      html = `
        <div class="mb-3">
          <label for="${fieldId}" class="form-label">${field.label || key}</label>
          <input type="text" class="form-control" id="${fieldId}" name="${key}" 
                 value="${value || ''}" ${field.required ? 'required' : ''}>
          ${field.description ? `<div class="form-text">${field.description}</div>` : ''}
        </div>
      `;
      break;
      
    case 'number':
      html = `
        <div class="mb-3">
          <label for="${fieldId}" class="form-label">${field.label || key}</label>
          <input type="number" class="form-control" id="${fieldId}" name="${key}"
                 value="${value !== undefined ? value : ''}" 
                 ${field.min !== undefined ? `min="${field.min}"` : ''}
                 ${field.max !== undefined ? `max="${field.max}"` : ''}
                 ${field.step ? `step="${field.step}"` : ''}
                 ${field.required ? 'required' : ''}>
          ${field.description ? `<div class="form-text">${field.description}</div>` : ''}
        </div>
      `;
      break;
      
    case 'boolean':
      html = `
        <div class="mb-3 form-check">
          <input type="checkbox" class="form-check-input" id="${fieldId}" name="${key}"
                 ${value ? 'checked' : ''}>
          <label class="form-check-label" for="${fieldId}">${field.label || key}</label>
          ${field.description ? `<div class="form-text">${field.description}</div>` : ''}
        </div>
      `;
      break;
      
    case 'select':
      const options = (field.options || []).map(opt => {
        const isSelected = opt.value === value;
        return `<option value="${opt.value}" ${isSelected ? 'selected' : ''}>${opt.label}</option>`;
      }).join('');
      
      html = `
        <div class="mb-3">
          <label for="${fieldId}" class="form-label">${field.label || key}</label>
          <select class="form-select" id="${fieldId}" name="${key}" ${field.required ? 'required' : ''}>
            ${options}
          </select>
          ${field.description ? `<div class="form-text">${field.description}</div>` : ''}
        </div>
      `;
      break;
      
    case 'textarea':
      html = `
        <div class="mb-3">
          <label for="${fieldId}" class="form-label">${field.label || key}</label>
          <textarea class="form-control" id="${fieldId}" name="${key}" rows="${field.rows || 3}"
                   ${field.required ? 'required' : ''}>${value || ''}</textarea>
          ${field.description ? `<div class="form-text">${field.description}</div>` : ''}
        </div>
      `;
      break;
      
    case 'password':
      html = `
        <div class="mb-3">
          <label for="${fieldId}" class="form-label">${field.label || key}</label>
          <input type="password" class="form-control" id="${fieldId}" name="${key}"
                 value="${value || ''}" ${field.required ? 'required' : ''}>
          ${field.description ? `<div class="form-text">${field.description}</div>` : ''}
        </div>
      `;
      break;
      
    default:
      html = `
        <div class="mb-3">
          <label for="${fieldId}" class="form-label">${field.label || key}</label>
          <input type="text" class="form-control" id="${fieldId}" name="${key}"
                 value="${value || ''}" ${field.required ? 'required' : ''}>
          ${field.description ? `<div class="form-text">${field.description}</div>` : ''}
        </div>
      `;
  }
  
  return html;
}

// 收集表单值
function collectFormValues(formId, configSchema) {
  const form = document.getElementById(formId);
  if (!form) return {};
  
  const formData = new FormData(form);
  const values = {};
  
  // 处理表单数据
  for (const [key, value] of formData.entries()) {
    // 根据schema转换类型
    if (configSchema && configSchema[key]) {
      const fieldType = configSchema[key].type;
      
      switch (fieldType) {
        case 'number':
          values[key] = value === '' ? undefined : Number(value);
          break;
        case 'boolean':
          // 复选框未选中时不会出现在formData中，所以这里只处理选中的情况
          values[key] = true;
          break;
        default:
          values[key] = value;
      }
    } else {
      values[key] = value;
    }
  }
  
  // 特别处理未选中的复选框 (boolean类型)
  if (configSchema) {
    Object.entries(configSchema).forEach(([key, field]) => {
      if (field.type === 'boolean' && !formData.has(key)) {
        values[key] = false;
      }
    });
  }
  
  return values;
}

// 保存脚本配置
function saveScriptConfig(scriptId, config) {
  try {
    const key = `script_config_${scriptId}`;
    localStorage.setItem(key, JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('保存脚本配置失败:', error);
    return false;
  }
}

// 获取保存的脚本配置
function getSavedScriptConfig(scriptId) {
  try {
    const key = `script_config_${scriptId}`;
    const configStr = localStorage.getItem(key);
    return configStr ? JSON.parse(configStr) : null;
  } catch (error) {
    console.error('获取脚本配置失败:', error);
    return null;
  }
}

// 为脚本选择钱包
async function selectWalletsForScript(script) {
  // 这里应该打开一个钱包选择对话框
  // 返回用户选择的钱包ID数组
  
  // 简单示例：从localStorage获取上次选择的钱包
  try {
    const key = `script_wallets_${script.id}`;
    const walletsStr = localStorage.getItem(key);
    if (walletsStr) {
      return JSON.parse(walletsStr);
    }
    
    // 如果没有保存的选择，则打开钱包选择对话框
    return await openWalletSelector(script);
  } catch (error) {
    console.error('获取保存的钱包选择失败:', error);
    return await openWalletSelector(script);
  }
}

// 打开钱包选择器对话框
async function openWalletSelector(script) {
  // 创建并显示钱包选择对话框
  // 返回用户选择的钱包ID数组
  
  // 这个实现取决于你的UI框架和钱包管理系统
  // 这里只是一个示例
  
  // 模拟：返回第一个钱包
  return ['wallet1'];
}

// 打开脚本监控界面
function openScriptMonitor(executionId, script) {
  // 创建并显示脚本执行监控界面
  // 可以显示日志输出、进度、状态等
  
  console.log(`监控脚本执行: ${executionId}, 脚本: ${script.name}`);
  
  // 这个实现取决于你的UI设计
  // 这里是一个简单的示例
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.id = `script-monitor-${executionId}`;
  modal.setAttribute('tabindex', '-1');
  
  modal.innerHTML = `
    <div class="modal-dialog modal-lg">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">执行中: ${script.name}</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="script-status">
            <div class="progress mb-3">
              <div class="progress-bar" role="progressbar" style="width: 0%;" 
                   id="progress-bar-${executionId}" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
            </div>
            <div class="script-log" id="script-log-${executionId}" style="height: 300px; overflow-y: auto; background: #f8f9fa; padding: 10px; font-family: monospace;">
              <!-- 日志将在这里显示 -->
              <div class="log-entry">开始执行脚本: ${script.name}</div>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-danger" id="stop-script-${executionId}">停止脚本</button>
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
        </div>
      </div>
    </div>
  `;
  
  // 添加到DOM
  document.body.appendChild(modal);
  
  // 初始化Bootstrap Modal
  const modalInstance = new bootstrap.Modal(modal);
  modalInstance.show();
  
  // 停止脚本按钮
  const stopBtn = document.getElementById(`stop-script-${executionId}`);
  if (stopBtn) {
    stopBtn.addEventListener('click', async () => {
      try {
        const response = await ScriptManager.stopScript(executionId);
        if (response.success) {
          addLogEntry(executionId, '已请求停止脚本执行');
          stopBtn.disabled = true;
          stopBtn.textContent = '已停止';
        } else {
          addLogEntry(executionId, `停止脚本失败: ${response.error}`);
        }
      } catch (error) {
        addLogEntry(executionId, `停止脚本时发生错误: ${error.message}`);
      }
    });
  }
  
  // 模态框关闭时的清理
  modal.addEventListener('hidden.bs.modal', () => {
    document.body.removeChild(modal);
  });
  
  // 将执行ID和modal实例关联起来，以便在事件监听器中引用
  window.scriptMonitors = window.scriptMonitors || {};
  window.scriptMonitors[executionId] = {
    modal: modalInstance,
    script: script
  };
}

// 注册脚本事件监听器
function registerScriptEventListeners() {
  // 注册事件监听器
  const scriptEventHandler = ScriptManager.registerListeners({
    onProgress: (executionId, progress) => {
      console.log(`脚本 ${executionId} 进度更新:`, progress);
      
      if (typeof progress === 'number') {
        updateProgressBar(executionId, progress);
      } else if (progress.percent !== undefined) {
        updateProgressBar(executionId, progress.percent);
      }
      
      if (progress.message) {
        addLogEntry(executionId, progress.message);
      }
    },
    
    onCompleted: (executionId, result) => {
      console.log(`脚本 ${executionId} 执行完成:`, result);
      addLogEntry(executionId, `脚本执行完成: ${JSON.stringify(result)}`);
      updateProgressBar(executionId, 100);
      
      const monitor = window.scriptMonitors && window.scriptMonitors[executionId];
      if (monitor) {
        const stopBtn = document.getElementById(`stop-script-${executionId}`);
        if (stopBtn) {
          stopBtn.disabled = true;
          stopBtn.textContent = '已完成';
        }
      }
    },
    
    onError: (executionId, error) => {
      console.error(`脚本 ${executionId} 执行出错:`, error);
      addLogEntry(executionId, `错误: ${error}`);
      
      const monitor = window.scriptMonitors && window.scriptMonitors[executionId];
      if (monitor) {
        const stopBtn = document.getElementById(`stop-script-${executionId}`);
        if (stopBtn) {
          stopBtn.disabled = true;
          stopBtn.textContent = '已失败';
        }
      }
    }
  });
  
  // 当页面卸载时取消监听
  window.addEventListener('beforeunload', () => {
    scriptEventHandler.unregister();
  });
}

// 更新进度条
function updateProgressBar(executionId, percent) {
  const progressBar = document.getElementById(`progress-bar-${executionId}`);
  if (!progressBar) return;
  
  const percentValue = typeof percent === 'number' ? percent : 0;
  progressBar.style.width = `${percentValue}%`;
  progressBar.setAttribute('aria-valuenow', percentValue);
  progressBar.textContent = `${percentValue}%`;
}