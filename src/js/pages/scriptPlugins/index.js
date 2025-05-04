// Import helpers and modules
import { setupFilteringAndSearch } from '../../components/tableHelper.js'; // Note: Using this for cards for now
import { showModal } from '../../components/modal.js';
import { addLogEntry } from '../../utils/index.js';
// import * as table from './table.js'; // If using a table layout
// import * as modals from './modals.js';
// import * as actions from './actions.js';

/**
 * 初始化脚本插件页面。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initScriptPluginPage(contentArea) {
    console.log("Initializing Script Plugins Page...");
    loadAndRenderPlugins(contentArea);
    setupFilteringAndSearch(contentArea, '.filters-bar', '#plugin-list-container .plugin-card', filterPluginCard);

    const pluginContainer = contentArea.querySelector('#plugin-list-container');
    if (pluginContainer) {
        pluginContainer.addEventListener('click', handlePluginCardAction);
    }
}

/**
 * 加载和渲染插件卡片。
 */
function loadAndRenderPlugins(contentArea) {
    const container = contentArea.querySelector('#plugin-list-container');
    if (!container) return;
    
    const plugins = [
        { 
            id: 'print123', 
            name: '发送POST请求', 
            type: 'local', 
            functions: ['test'], 
            description: '向指定接口发送POST请求，并在日志窗口显示请求过程。', 
            author: '本地', 
            version: '1.0.0' 
        }
    ];
    
    container.innerHTML = plugins.map(plugin => `
        <div class="plugin-card" data-plugin-id="${plugin.id}" data-plugin-type="${plugin.type}" data-plugin-functions="${plugin.functions.join(',')}">
            <div class="card-header">
                 <i class="fas fa-plug plugin-icon"></i>
                 <div class="plugin-title">
                     <h5>${plugin.name}</h5>
                     <span>${plugin.functions.map(f => `<span class="tag tag-blue">${f}</span>`).join(' ')}</span>
                 </div>
                 <span class="plugin-type ${plugin.type}">${plugin.type}</span>
             </div>
             <div class="card-body"><p class="plugin-description">${plugin.description}</p></div>
             <div class="card-footer">
                 <span class="plugin-meta">作者: ${plugin.author} | V${plugin.version}</span>
                 <div class="plugin-actions">
                     <button class="btn btn-primary btn-small btn-run" title="运行"><i class="fas fa-play"></i> 运行</button>
                 </div>
             </div>
         </div>
     `).join('');
}

/**
 * 插件卡片的筛选函数。
 */
function filterPluginCard(cardElement, filterValues) {
    const type = cardElement.dataset.pluginType?.toLowerCase() || '';
    const functions = (cardElement.dataset.pluginFunctions?.toLowerCase() || '').split(',');
    const name = cardElement.querySelector('.plugin-title h5')?.textContent.toLowerCase() || '';
    const description = cardElement.querySelector('.plugin-description')?.textContent.toLowerCase() || '';
    const author = cardElement.querySelector('.plugin-meta')?.textContent.toLowerCase() || '';
    const searchContent = `${type} ${functions.join(' ')} ${name} ${description} ${author}`;
    const typeFilter = filterValues['plugin-type-filter'] || '';
    const functionFilter = filterValues['plugin-function-filter'] || '';
    const searchTerm = filterValues.search || '';
    const typeMatch = !typeFilter || type === typeFilter;
    const functionMatch = !functionFilter || functions.some(fn => fn.trim() === functionFilter);
    const searchMatch = !searchTerm || searchContent.includes(searchTerm);
    return typeMatch && functionMatch && searchMatch;
}

/**
 * 处理插件卡片的点击事件。
 */
function handlePluginCardAction(e) {
    const target = e.target;
    const runButton = target.closest('.btn-run');
    const card = target.closest('.plugin-card');
    if (!card || !runButton) return;
    
    e.stopPropagation();
    const pluginId = card.dataset.pluginId;

    if (pluginId === 'print123') {
        showModal('tpl-modal-run-plugin', async (modalElement) => {
            const logContainer = modalElement.querySelector('.modal-log-container');
            const startBtn = modalElement.querySelector('#modal-start-execution-btn');
            
            // 更新模态框标题
            modalElement.querySelector('#run-plugin-name').textContent = '发送POST请求';
            
            startBtn.onclick = async () => {
                try {
                    startBtn.disabled = true;
                    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中...';
                    
                    // 添加初始日志
                    addLogEntry('info', '系统', '开始执行脚本...', logContainer);
                    addLogEntry('info', '系统', '准备发送POST请求...', logContainer);
                    
                    // 发送POST请求
                    const testUrl = 'https://httpbin.org/post';
                    const testData = {
                        test: true,
                        timestamp: new Date().toISOString()
                    };
                    
                    addLogEntry('info', '系统', `请求URL: ${testUrl}`, logContainer);
                    addLogEntry('info', '系统', `请求数据: ${JSON.stringify(testData)}`, logContainer);
                    
                    const response = await axios.post(testUrl, testData);
                    
                    addLogEntry('success', '系统', '请求发送成功！', logContainer);
                    addLogEntry('info', '系统', `响应状态: ${response.status}`, logContainer);
                    addLogEntry('info', '系统', `响应数据: ${JSON.stringify(response.data)}`, logContainer);
                    
                    startBtn.innerHTML = '<i class="fas fa-check"></i> 执行完成';
                } catch (error) {
                    addLogEntry('error', '系统', `执行出错: ${error.message}`, logContainer);
                    startBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 执行失败';
                } finally {
                    startBtn.disabled = false;
                }
            };
        });
    }
}

// --- Modal functions (Refactor: Move these to modals.js) --- 

/**
 * 打开"运行插件"模态框。
 */
function openRunPluginModal(pluginName, pluginId) {
    showModal('tpl-modal-run-plugin', (modalElement) => {
        modalElement.querySelector('#run-plugin-name').textContent = pluginName;
        const startBtn = modalElement.querySelector('#modal-start-execution-btn');
        const logContainer = modalElement.querySelector('.modal-log-container');
        const walletCountSpan = modalElement.querySelector('#modal-selected-wallet-count');
        // TODO: Load actual wallets instead of placeholders
        const walletCheckboxes = modalElement.querySelectorAll('.wallet-checkboxes-compact-modal input[type="checkbox"]');
        const updateTotal = () => {
            const count = modalElement.querySelectorAll('.wallet-checkboxes-compact-modal input[type="checkbox"]:checked').length;
            walletCountSpan.textContent = count;
        };
        walletCheckboxes.forEach(cb => cb.addEventListener('change', updateTotal));
        updateTotal();

        startBtn.onclick = () => {
             const selectedWallets = modalElement.querySelectorAll('.wallet-checkboxes-compact-modal input[type="checkbox"]:checked');
             if (selectedWallets.length === 0) {
                 addLogEntry('error', '系统', '请至少选择一个钱包！', logContainer);
                 return;
             }
            addLogEntry('info', '系统', `开始执行插件 "${pluginName}"，作用于 ${selectedWallets.length} 个钱包...`, logContainer);
             startBtn.disabled = true;
             startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中...';
             setTimeout(() => { // Simulate execution
                 addLogEntry('success', '系统', '插件执行完成 (模拟)。', logContainer);
                 startBtn.disabled = false;
                 startBtn.innerHTML = '<i class="fa fa-play"></i> 重新执行';
             }, 3000);
            // TODO: Implement actual plugin execution via IPC
        };
    });
}

/**
 * 打开"配置插件"模态框。
 */
function openConfigPluginModal(pluginName, pluginId) {
    showModal('tpl-modal-config-plugin', (modalElement) => {
        modalElement.querySelector('#config-plugin-name').textContent = pluginName;
        const saveBtn = modalElement.querySelector('#modal-save-config-btn');
        const configArea = modalElement.querySelector('#config-options-area');
        // TODO: Load actual config options based on pluginId
        saveBtn.onclick = () => {
            alert(`保存插件 "${pluginName}" 的配置 (未实现)`);
            // TODO: Implement saving config via IPC
        };
    });
} 