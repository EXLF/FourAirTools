// ================= 网络（IP 代理）页面初始化 =================

import { setupTableActions, setupCheckAll } from '../components/tableHelper.js';
import { debounce } from '../utils/index.js'; // 引入 debounce
import { showModal, hideModal } from '../components/modal.js'; // 引入模态框函数
import { showToast } from '../components/toast.js'; // 引入 Toast

/**
 * 初始化网络（IP 代理）页面。
 * 设置表格操作、筛选和全选功能。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initNetworkPage(contentArea) {
    console.log("Initializing Network Page...");

    setupTableActions(contentArea, '.data-table', handleNetworkAction);
    // setupFilteringAndSearch(contentArea, '.filters-bar', '.data-table tbody tr', filterNetworkRow);
    setupCheckAll(contentArea, '.data-table');

    // 改进筛选逻辑
    setupNetworkFiltering(contentArea);

    const addBtn = contentArea.querySelector('.header-actions .btn-primary');
    if(addBtn) {
        addBtn.addEventListener('click', openAddProxyModal);
    }

    const testBtn = contentArea.querySelector('.header-actions .btn-secondary');
     if(testBtn) {
        testBtn.addEventListener('click', () => {
             const checkedRows = contentArea.querySelectorAll('.data-table tbody input[type="checkbox"]:checked');
             if (checkedRows.length === 0) {
                 showToast("请先选择要测试的代理配置！", 'warning');
                 return;
             }
            showToast(`开始测试选中的 ${checkedRows.length} 个代理的连通性 (未实现)`, 'info');
        });
    }

    // TODO: 页面加载时获取并渲染代理列表
    loadAndRenderProxies(contentArea); // 调用加载函数
}

// --- 新增：全局变量存储分页和筛选状态 ---
let currentProxyPage = 1;
let proxyItemsPerPage = 10; // 可以考虑从 localStorage 加载
let currentProxyFilters = {}; // 存储当前筛选条件
// --- -------------------------------- ---

/**
 * 打开添加代理配置的模态框。
 */
async function openAddProxyModal() {
    console.log('Opening add proxy modal...');
    showModal('tpl-add-proxy-form', async (modalElement) => {
        const form = modalElement.querySelector('#add-proxy-form-actual');
        const saveBtn = modalElement.querySelector('.modal-save-btn');
        const groupSelect = modalElement.querySelector('#proxy-group');
        const usernameInput = modalElement.querySelector('#proxy-username');
        const passwordInput = modalElement.querySelector('#proxy-password');
        const usernameCounter = usernameInput?.closest('.option-group')?.querySelector('.char-counter');
        const passwordCounter = passwordInput?.closest('.option-group')?.querySelector('.char-counter');
        const clearButtons = modalElement.querySelectorAll('.clear-input-btn');
        const proxyTestBtn = modalElement.querySelector('.proxy-test-btn');

        if (!form || !saveBtn || !groupSelect) {
            console.error('Add proxy modal elements missing!');
            hideModal();
            showToast('无法加载代理表单', 'error');
            return;
        }

        // 填充分组下拉菜单
        try {
            const groups = await window.dbAPI.getGroups();
            groupSelect.innerHTML = '<option value="">无分组</option>'; // Reset options
            let defaultGroupId = null;
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                if (group.name === '默认分组') defaultGroupId = group.id;
                groupSelect.appendChild(option);
            });
            // 自动选择默认分组
            if (defaultGroupId) {
                const defaultOption = groupSelect.querySelector(`option[value="${defaultGroupId}"]`);
                if (defaultOption) defaultOption.selected = true;
            }
        } catch (error) {
            console.error("加载分组失败:", error);
            showToast("加载分组选项失败", 'error');
            // 不阻塞表单显示，允许无分组添加
        }
        
        // 清除按钮逻辑
        clearButtons.forEach(btn => {
            const input = btn.previousElementSibling; // 获取旁边的 input
            if (input) {
                btn.addEventListener('click', () => { input.value = ''; input.focus(); input.dispatchEvent(new Event('input')); });
                input.addEventListener('input', () => { btn.style.visibility = input.value ? 'visible' : 'hidden'; });
                btn.style.visibility = input.value ? 'visible' : 'hidden'; // 初始状态
            }
        });

        // 字符计数器逻辑
        const setupCounter = (input, counter) => {
            if (!input || !counter) return;
            const maxLength = input.maxLength;
            const updateCount = () => { counter.textContent = `${input.value.length}/${maxLength}`; };
            input.addEventListener('input', updateCount);
            updateCount(); // 初始显示
        };
        setupCounter(usernameInput, usernameCounter);
        setupCounter(passwordInput, passwordCounter);
        
        // 代理测试按钮逻辑
        if (proxyTestBtn) {
            const resultDisplay = modalElement.querySelector('#proxy-test-result-display'); // 获取结果显示区域
            if (!resultDisplay) {
                console.error('Proxy test result display element not found!');
                return; // 如果找不到显示区域，则不继续
            }

            proxyTestBtn.addEventListener('click', async () => {
                // 清空并隐藏上次结果
                resultDisplay.innerHTML = '';
                resultDisplay.style.display = 'none';
                resultDisplay.classList.remove('success', 'error');

                // 收集当前表单数据
                const formData = new FormData(form);
                const proxyConfig = {
                    type: formData.get('type'),
                    host: formData.get('host').trim(),
                    port: parseInt(formData.get('port')),
                    username: formData.get('username') || null,
                    password: formData.get('password') || null
                };
                const ipQueryChannel = formData.get('ipQueryChannel');

                // 基本验证
                if (!proxyConfig.type || !proxyConfig.host || isNaN(proxyConfig.port)) {
                    showToast('请先填写有效的代理类型、主机和端口！', 'warning');
                    return;
                }

                // 禁用按钮并显示加载状态
                proxyTestBtn.disabled = true;
                proxyTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 5px;"></i>检测中...';

                try {
                    console.log(`Testing proxy with config:`, proxyConfig, `Channel:`, ipQueryChannel);
                    const result = await window.dbAPI.proxyTestConnection(proxyConfig, ipQueryChannel);
                    console.log('Proxy test result:', result);

                    resultDisplay.style.display = 'block'; // 显示结果区域

                    if (result.success) {
                        resultDisplay.classList.add('success');
                        let outputText = `IP: ${result.data.query || 'N/A'}\n`; // 优先使用 query
                        if(result.data.country) outputText += `国家/地区: ${result.data.country}\n`;
                        if(result.data.regionName) outputText += `州/省: ${result.data.regionName}\n`;
                        if(result.data.city) outputText += `城市: ${result.data.city}\n`;
                        if(result.data.isp) outputText += `ISP: ${result.data.isp}\n`;
                        if(result.data.org) outputText += `组织: ${result.data.org}\n`;
                        
                        // 处理 httpbin 的情况
                        if (ipQueryChannel === 'httpbin' && result.data.origin) {
                            outputText = `IP: ${result.data.origin}`; // httpbin 只返回 IP
                        }
                        // 处理 ipify 的情况
                        if (ipQueryChannel === 'ipify' && result.data.ip) {
                           outputText = `IP: ${result.data.ip}`; 
                        }
                         // 处理非 JSON 响应
                        if (result.data?.raw) {
                             outputText = `代理可用，但响应不是标准 JSON:\n${result.data.raw.substring(0, 200)}... (详情见控制台)`;
                        }
                        
                        resultDisplay.textContent = outputText.trim();
                        // 不再使用 Toast
                        // showToast(`检测成功！代理IP: ${ipInfo || '无法解析'}`, 'success', 5000);
                    } else {
                        resultDisplay.classList.add('error');
                        resultDisplay.textContent = `检测失败: ${result.message}`;
                        // 不再使用 Toast
                        // showToast(`检测失败: ${result.message}`, 'error');
                    }
                } catch (error) {
                    console.error("代理检测 IPC 调用失败:", error);
                    resultDisplay.style.display = 'block'; // 即使IPC失败也要显示错误区域
                    resultDisplay.classList.add('error');
                    resultDisplay.textContent = `检测调用失败: ${error.message}`;
                    // 不再使用 Toast
                    // showToast(`检测失败: ${error.message}`, 'error');
                } finally {
                    // 恢复按钮状态
                    proxyTestBtn.disabled = false;
                    proxyTestBtn.innerHTML = '<i class="fa fa-plug" style="margin-right: 5px;"></i>代理检测';
                }
            });
        }

        // 表单提交逻辑
        const handleSubmit = async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const configData = {
                name: formData.get('name') || null,
                type: formData.get('type'),
                host: formData.get('host').trim(),
                port: parseInt(formData.get('port')), // 确保是数字
                username: formData.get('username') || null,
                password: formData.get('password') || null, // 注意：实际应用中密码不应这样明文传输和存储
                ipProtocol: formData.get('ipProtocol'),
                ipQueryChannel: formData.get('ipQueryChannel'),
                groupId: formData.get('groupId') ? parseInt(formData.get('groupId')) : null
            };

            // 基本验证
            if (!configData.type || !configData.host || isNaN(configData.port) || configData.port < 1 || configData.port > 65535) {
                showToast('请填写有效的代理类型、主机和端口 (1-65535)！', 'warning');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';

            try {
                console.log("准备保存代理配置:", configData);
                const newId = await window.dbAPI.addProxyConfig(configData);
                console.log("代理配置添加成功, ID:", newId);
                showToast('代理配置添加成功', 'success');
                hideModal();
                // 刷新代理列表
                await loadAndRenderProxies(document.querySelector('.content-area'));
            } catch (error) {
                console.error("保存代理配置失败:", error);
                showToast(`添加失败: ${error.message}`, 'error');
                saveBtn.disabled = false;
                saveBtn.textContent = '确定';
            }
        };

        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);
    });
}

/**
 * 设置网络页面的筛选器监听。
 * @param {HTMLElement} contentArea
 */
function setupNetworkFiltering(contentArea) {
    const typeFilter = contentArea.querySelector('#network-type-filter');
    const groupFilter = contentArea.querySelector('#network-group-filter');
    const searchInput = contentArea.querySelector('#network-search-input');
    // const tableRows = contentArea.querySelectorAll('.data-table tbody tr'); // 不再需要直接操作行

    if (!typeFilter || !groupFilter || !searchInput) {
        console.warn("Network page filtering elements not found.");
        return;
    }

    const applyFilters = debounce(() => {
        currentProxyFilters = {
            type: typeFilter.value || null, // 空字符串转为 null
            groupId: groupFilter.value ? parseInt(groupFilter.value) : null, // 处理分组ID
            search: searchInput.value.trim() || null
        };
        currentProxyPage = 1; // 筛选时重置到第一页
        loadAndRenderProxies(contentArea); // 重新加载数据并渲染

    }, 300);

    typeFilter.addEventListener('change', applyFilters);
    groupFilter.addEventListener('change', applyFilters); // TODO: 分组筛选逻辑待完善
    searchInput.addEventListener('input', applyFilters);

    // TODO: 页面加载时可能需要加载分组选项到 groupFilter
    // await loadGroupFiltersForNetwork(groupFilter);

}

/**
 * 新增：加载并渲染代理配置数据到表格。
 * @param {HTMLElement} contentArea - 页面内容区域。
 */
async function loadAndRenderProxies(contentArea) {
    const tableBody = contentArea.querySelector('.data-table tbody');
    const paginationControls = contentArea.querySelector('.pagination'); // 获取分页控件容器

    if (!tableBody || !paginationControls || typeof window.dbAPI === 'undefined') {
        console.error("Table body, pagination controls, or dbAPI not ready for proxy loading.");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">加载代理列表失败：组件或接口未准备好。</td></tr>';
        return;
    }

    console.log(`Loading proxies: Page ${currentProxyPage}, Limit ${proxyItemsPerPage}, Filters:`, currentProxyFilters);
    tableBody.innerHTML = '<tr><td colspan="9" class="text-center"><i class="fas fa-spinner fa-spin"></i> 正在加载代理列表...</td></tr>'; // 显示加载状态

    try {
        const options = {
            page: currentProxyPage,
            limit: proxyItemsPerPage,
            ...currentProxyFilters // 应用当前筛选条件
            // sortBy: 'createdAt', // 默认排序
            // sortOrder: 'DESC'
        };

        const result = await window.dbAPI.getProxyConfigs(options);
        const configs = result.configs;
        const totalItems = result.totalCount;

        tableBody.innerHTML = ''; // 清空旧内容

        if (!configs || configs.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="9" class="text-center">暂无代理配置数据。</td></tr>';
        } else {
            configs.forEach(config => {
                const row = createProxyRowElement(config);
                tableBody.appendChild(row);
            });
        }

        // 渲染分页 (需要一个通用的或特定于此页面的 renderPagination 函数)
        renderProxyPagination(contentArea, totalItems, proxyItemsPerPage, currentProxyPage);
        // 重新初始化全选复选框状态
        setupCheckAll(contentArea, '.data-table');

    } catch (error) {
        console.error("加载代理配置失败:", error);
        tableBody.innerHTML = `<tr><td colspan="9" class="text-center text-danger">加载代理列表失败: ${error.message}</td></tr>`;
    }
}

/**
 * 新增：根据代理配置数据创建表格行元素 (<tr>)。
 * @param {object} config - 代理配置对象。
 * @returns {HTMLTableRowElement} - 创建的表格行元素。
 */
function createProxyRowElement(config) {
    const row = document.createElement('tr');
    row.dataset.id = config.id; // 用于后续操作

    // 简单的状态显示逻辑
    let statusHtml = '<span class="status unknown">未知</span>';
    if (config.status === 'active') {
        statusHtml = '<span class="status active">可用</span>';
    } else if (config.status === 'inactive' || config.status === 'error') {
        statusHtml = '<span class="status inactive">不可用</span>';
    }

    row.innerHTML = `
        <td><input type="checkbox" class="row-checkbox" value="${config.id}"></td>
        <td>${config.name || '-'}</td>
        <td>${config.type.toUpperCase()}</td>
        <td>${config.host}</td>
        <td>${config.port}</td>
        <td>${config.username || '-'}</td>
        <td>${statusHtml}</td>
        <td>${config.groupName || '-'}</td>
        <td class="actions-cell">
            <button class="btn-icon" data-action="test" title="测试"><i class="fa fa-plug"></i></button>
            <button class="btn-icon" data-action="edit" title="编辑"><i class="fa fa-edit"></i></button>
            <button class="btn-icon" data-action="delete" title="删除"><i class="fa fa-trash"></i></button>
        </td>
    `;
    // 添加事件监听器到操作按钮
    const actionButtons = row.querySelectorAll('.actions-cell button');
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const action = button.dataset.action;
            handleNetworkAction(action, row, config); // 传递整个 config 对象可能更有用
        });
    });
    return row;
}

/**
 * 新增：渲染网络页面的分页控件。
 * @param {HTMLElement} contentArea
 * @param {number} totalItems
 * @param {number} itemsPerPage
 * @param {number} currentPage
 */
function renderProxyPagination(contentArea, totalItems, itemsPerPage, currentPage) {
    const paginationControls = contentArea.querySelector('.pagination');
    if (!paginationControls) return;

    paginationControls.innerHTML = ''; // 清空
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // 显示页码信息
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    const displayPage = Math.max(1, currentPage);
    const displayTotalPages = Math.max(1, totalPages);
    pageInfo.textContent = `${displayPage}/${displayTotalPages}页 共${totalItems}条`;
    pageInfo.style.marginRight = '15px';
    paginationControls.appendChild(pageInfo);

    if (totalPages <= 1) return;

    // 创建分页按钮 (与 social.js 类似)
    const createPageButton = (text, pageNum, isDisabled = false, isActive = false) => {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.disabled = isDisabled;
        if (isActive) button.classList.add('active');
        button.addEventListener('click', async () => {
            currentProxyPage = pageNum;
            await loadAndRenderProxies(contentArea);
        });
        return button;
    };

    // 上一页按钮
    paginationControls.appendChild(createPageButton('&laquo;', currentPage - 1, currentPage === 1));

    // 页码按钮逻辑 (简化版，可按需扩展)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) paginationControls.appendChild(createPageButton('1', 1));
    if (startPage > 2) {
        const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; ellipsis.style.padding = '0 10px';
        paginationControls.appendChild(ellipsis);
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationControls.appendChild(createPageButton(i, i, false, i === currentPage));
    }

    if (endPage < totalPages - 1) {
        const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; ellipsis.style.padding = '0 10px';
        paginationControls.appendChild(ellipsis);
    }
    if (endPage < totalPages) paginationControls.appendChild(createPageButton(totalPages, totalPages));

    // 下一页按钮
    paginationControls.appendChild(createPageButton('&raquo;', currentPage + 1, currentPage === totalPages));
}

/**
 * 处理网络表格行内的操作按钮点击。
 * @param {string} action - 操作名称（例如，'编辑', '删除', '测试'）。
 * @param {HTMLElement} rowElement - 表格行元素。
 * @param {object} configData - 完整的配置对象。
 */
function handleNetworkAction(action, rowElement, configData) {
    // const name = rowData[1]; // 旧方式，改用 configData
    const configId = configData.id;
    const displayName = configData.name || `${configData.type.toUpperCase()}://${configData.host}:${configData.port}`;

    console.log(`Handling action "${action}" for proxy config ID: ${configId} (${displayName})`);

    if (action === 'delete') {
        // TODO: 使用确认模态框
        if (confirm(`确定删除代理配置 "${displayName}"?`)) {
            // TODO: 调用数据库删除函数 window.dbAPI.deleteProxyConfig(configId)
            // 成功后调用 loadAndRenderProxies 刷新
            console.log(`删除代理 ${configId} (未实现)`);
            rowElement.remove(); // 临时移除
            showToast(`代理配置 "${displayName}" 已删除 (模拟)`, 'success');
        }
    } else if (action === 'edit') {
        // TODO: 打开编辑模态框，预填充 configData
        console.log(`编辑代理 ${configId} (未实现)`);
        alert(`编辑代理 "${displayName}" (功能未实现)`);
    } else if (action === 'test') {
        // TODO: 实现单个代理测试逻辑
        console.log(`测试代理 ${configId} (未实现)`);
        showToast(`开始测试代理 "${displayName}" (未实现)`, 'info');
    }
}

/**
 * 网络表格行的筛选函数。
 * @param {HTMLElement} rowElement - 表格行元素。
 * @param {object} filterValues - 包含筛选值的对象 { type: '...', group: '...', search: '...' }。
 * @returns {boolean} - 如果应显示该行，则为 true。
 */
// 注意：此函数在新的加载逻辑下，如果后端实现了筛选，则前端不再需要
// 但如果希望保留前端即时筛选（不重新请求数据），则可以保留并由 loadAndRenderProxies 调用
function filterNetworkRow(rowElement, filterValues) {
     const cells = rowElement.cells;
     const type = cells[2]?.textContent.toLowerCase() || '';
     const group = cells[7]?.textContent.toLowerCase() || ''; // 假设分组在第8列
     const searchContent = Array.from(cells)
                            .slice(1, -1) // 排除复选框和操作单元格
                            .map(c => c.textContent.toLowerCase())
                            .join(' ');

     const typeMatch = !filterValues.type || type === filterValues.type;
     const groupMatch = !filterValues.group || group === filterValues.group; // TODO: 确认分组筛选逻辑
     const searchMatch = !filterValues.search || searchContent.includes(filterValues.search);

     return typeMatch && groupMatch && searchMatch;
}