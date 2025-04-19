import { setupFilteringAndSearch } from '../components/tableHelper.js';
import { showModal } from '../components/modal.js'; // 用于运行/配置模态框
import { addLogEntry } from '../utils/index.js'; // 用于模态框日志

/**
 * 初始化脚本插件页面。
 * 加载插件，设置筛选，并处理插件卡片操作（运行、配置）。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initScriptPluginPage(contentArea) {
    console.log("Initializing Script Plugins Page..."); // 保留英文日志

    // 1. 加载/渲染插件卡片（占位符）
    loadAndRenderPlugins(contentArea);

    // 2. 设置筛选
    // 项目选择器是 '.plugin-card'（假设卡片是 #plugin-list-container 的直接子元素）
    setupFilteringAndSearch(contentArea, '.filters-bar', '#plugin-list-container .plugin-card', filterPluginCard);

    // 3. 为头部按钮添加监听器
    const addBtn = contentArea.querySelector('.header-actions .btn-primary');
    const manageBtn = contentArea.querySelector('.header-actions .btn-secondary');

    if (addBtn) {
        addBtn.addEventListener('click', () => alert('添加/发现插件 (未实现)'));
    }
    if (manageBtn) {
        manageBtn.addEventListener('click', () => alert('管理本地脚本 (未实现)'));
    }

    // 4. 为插件卡片操作设置事件委托
    const pluginContainer = contentArea.querySelector('#plugin-list-container');
    if (pluginContainer) {
        pluginContainer.addEventListener('click', handlePluginCardAction);
    }
}

/**
 * 加载和渲染插件卡片的占位符函数。
 * 在实际应用中，这将获取插件数据并生成 HTML。
 * @param {HTMLElement} contentArea
 */
function loadAndRenderPlugins(contentArea) {
    const container = contentArea.querySelector('#plugin-list-container');
    if (!container) return;

    // 示例插件数据（用实际数据加载替换）
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
            <div class="card-body">
                <p class="plugin-description">${plugin.description}</p>
            </div>
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
 * @param {HTMLElement} cardElement - 插件卡片元素。
 * @param {object} filterValues - 包含筛选值的对象。
 *                                例如，{ search: '...', 'plugin-type-filter': 'official', ... }
 * @returns {boolean} - 如果卡片应显示，则返回 true。
 */
function filterPluginCard(cardElement, filterValues) {
    // 从卡片提取数据
    const type = cardElement.dataset.pluginType?.toLowerCase() || '';
    const functions = (cardElement.dataset.pluginFunctions?.toLowerCase() || '').split(',');
    const name = cardElement.querySelector('.plugin-title h5')?.textContent.toLowerCase() || '';
    const description = cardElement.querySelector('.plugin-description')?.textContent.toLowerCase() || '';
    const author = cardElement.querySelector('.plugin-meta')?.textContent.toLowerCase() || '';
    const searchContent = `${type} ${functions.join(' ')} ${name} ${description} ${author}`;

    // 获取筛选值
    const typeFilter = filterValues['plugin-type-filter'] || '';
    const functionFilter = filterValues['plugin-function-filter'] || '';
    const searchTerm = filterValues.search || '';

    // 应用筛选器
    const typeMatch = !typeFilter || type === typeFilter;
    // 检查卡片中的 *任何* 功能是否匹配功能筛选器
    const functionMatch = !functionFilter || functions.some(fn => fn.trim() === functionFilter);
    const searchMatch = !searchTerm || searchContent.includes(searchTerm);

    return typeMatch && functionMatch && searchMatch;
}

/**
 * 处理从插件容器委托的点击事件。
 * 识别对运行或配置按钮的点击。
 * @param {Event} e - 点击事件对象。
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
        console.log(`Run button clicked for plugin: ${pluginName} (${pluginId})`); // 保留英文日志结构
        openRunPluginModal(pluginName, pluginId);
    } else if (configButton) {
        e.stopPropagation();
        console.log(`Config button clicked for plugin: ${pluginName} (${pluginId})`); // 保留英文日志结构
        openConfigPluginModal(pluginName, pluginId);
    }
}

/**
 * 打开“运行插件”模态框。
 * @param {string} pluginName - 插件名称。
 * @param {string} pluginId - 插件 ID。
 */
function openRunPluginModal(pluginName, pluginId) {
    showModal('tpl-modal-run-plugin', (modalElement) => {
        console.log("Setting up Run Plugin modal..."); // 保留英文日志
        modalElement.querySelector('#run-plugin-name').textContent = pluginName;
        const startBtn = modalElement.querySelector('#modal-start-execution-btn');
        const logContainer = modalElement.querySelector('.modal-log-container');
        const walletCountSpan = modalElement.querySelector('#modal-selected-wallet-count');

        // 占位符：在复选框更改时更新钱包计数
        const walletCheckboxes = modalElement.querySelectorAll('.wallet-checkboxes-compact-modal input[type="checkbox"]');
        const updateTotal = () => {
            const count = modalElement.querySelectorAll('.wallet-checkboxes-compact-modal input[type="checkbox"]:checked').length;
            walletCountSpan.textContent = count;
        };
        walletCheckboxes.forEach(cb => cb.addEventListener('change', updateTotal));
        updateTotal(); // 初始计数


        startBtn.onclick = () => {
             const selectedWallets = modalElement.querySelectorAll('.wallet-checkboxes-compact-modal input[type="checkbox"]:checked');
             if (selectedWallets.length === 0) {
                 addLogEntry('error', '系统', '请至少选择一个钱包！', logContainer);
                 return;
             }
            addLogEntry('info', '系统', `开始执行插件 "${pluginName}"，作用于 ${selectedWallets.length} 个钱包...`, logContainer);
             // 运行时禁用按钮？
             startBtn.disabled = true;
             startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中...';
             // 模拟执行
             setTimeout(() => {
                 addLogEntry('success', '系统', '插件执行完成 (模拟)。', logContainer);
                 startBtn.disabled = false;
                 startBtn.innerHTML = '<i class="fa fa-play"></i> 重新执行';
             }, 3000);
            // TODO: 实现实际的插件执行逻辑
        };
    });
}

/**
 * 打开“配置插件”模态框。
 * @param {string} pluginName - 插件名称。
 * @param {string} pluginId - 插件 ID。
 */
function openConfigPluginModal(pluginName, pluginId) {
    showModal('tpl-modal-config-plugin', (modalElement) => {
        console.log("Setting up Config Plugin modal..."); // 保留英文日志
        modalElement.querySelector('#config-plugin-name').textContent = pluginName;
        const saveBtn = modalElement.querySelector('#modal-save-config-btn');
        const configArea = modalElement.querySelector('#config-options-area');

        // TODO: 根据 pluginId 加载实际配置选项
        // 目前，仅使用占位符 HTML

        saveBtn.onclick = () => {
            alert(`保存插件 "${pluginName}" 的配置 (未实现)`);
            // TODO: 实现保存配置的逻辑
            // 可以在保存时关闭模态框：hideModal();
        };
    });
}