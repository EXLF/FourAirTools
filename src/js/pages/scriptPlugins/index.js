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

    // Refactor: Move these responsibilities
    // --- Start Refactor Block ---
    loadAndRenderPlugins(contentArea); // Refactor: Should be in table.js or similar
    setupFilteringAndSearch(contentArea, '.filters-bar', '#plugin-list-container .plugin-card', filterPluginCard); // Refactor: Move to table.js

    const addBtn = contentArea.querySelector('.header-actions .btn-primary'); // Refactor: Move to actions.js
    const manageBtn = contentArea.querySelector('.header-actions .btn-secondary');
    if (addBtn) addBtn.addEventListener('click', () => alert('添加/发现插件 (未实现)')); // TODO: Call actions.handleAddPlugin()
    if (manageBtn) manageBtn.addEventListener('click', () => alert('管理本地脚本 (未实现)')); // TODO: Call actions.handleManageLocalScripts()

    const pluginContainer = contentArea.querySelector('#plugin-list-container'); // Refactor: Move to actions.js
    if (pluginContainer) {
        pluginContainer.addEventListener('click', handlePluginCardAction);
    }
    // --- End Refactor Block ---
}

/**
 * 加载和渲染插件卡片的占位符函数。
 * Refactor: Move to table.js or a dedicated rendering module.
 */
function loadAndRenderPlugins(contentArea) {
    const container = contentArea.querySelector('#plugin-list-container');
    if (!container) return;
    // Sample data - replace with actual data loading
    const plugins = [
        { id: 'p1', name: '批量跨链 (LayerZero)', type: 'official', functions: ['bridge'], description: '使用 Stargate/Merkly 等进行跨链交互。', author: '官方', version: '1.1.0' },
        { id: 'p2', name: '批量Swap (zkSync)', type: 'official', functions: ['swap', 'defi'], description: '在 SyncSwap/Mute 等 DEX 上执行兑换。', author: '官方', version: '1.0.5' },
        { id: 'p3', name: '邮箱钱包生成', type: 'community', functions: ['wallet', 'other'], description: '批量生成 burner 邮箱钱包。', author: '社区开发者 A', version: '0.9.0' },
        { id: 'p4', name: '每日签到 (多链)', type: 'local', functions: ['checkin'], description: '自动执行支持的 DApp 每日签到。', author: '本地', version: 'N/A' },
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
                     <button class="btn btn-secondary btn-small btn-config" title="配置"><i class="fas fa-cog"></i> 配置</button>
                     <button class="btn btn-primary btn-small btn-run" title="运行"><i class="fas fa-play"></i> 运行</button>
                 </div>
             </div>
         </div>
     `).join('');
}

/**
 * 插件卡片的筛选函数。
 * Refactor: Move to table.js.
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
 * 处理从插件容器委托的点击事件。
 * Refactor: Move to actions.js.
 */
function handlePluginCardAction(e) {
    const target = e.target;
    const runButton = target.closest('.btn-run');
    const configButton = target.closest('.btn-config');
    const card = target.closest('.plugin-card');
    if (!card) return;
    const pluginId = card.dataset.pluginId;
    const pluginName = card.querySelector('.plugin-title h5')?.textContent || '未知插件';

    if (runButton) {
        e.stopPropagation();
        console.log(`Run button clicked for plugin: ${pluginName} (${pluginId})`);
        openRunPluginModal(pluginName, pluginId); // Refactor: Call modals.openRunModal()
    } else if (configButton) {
        e.stopPropagation();
        console.log(`Config button clicked for plugin: ${pluginName} (${pluginId})`);
        openConfigPluginModal(pluginName, pluginId); // Refactor: Call modals.openConfigModal()
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