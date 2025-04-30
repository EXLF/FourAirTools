// Import helpers and other modules if needed
import { setupTableActions, setupFilteringAndSearch, setupCheckAll } from '../../components/tableHelper.js';
import { showModal, hideModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { debounce } from '../../utils/index.js';
// import * as table from './table.js';
// import * as modals from './modals.js';
// import * as actions from './actions.js';

// 全局变量声明
let contentArea = null;
let tableBody = null;
let paginationContainer = null;
let searchInput = null;
let selectAllCheckbox = null;
let addProxyBtn = null;
let bulkTestBtn = null;
let filterElements = {};
let isLoading = false;
let currentPage = 1;
let itemsPerPage = 10;
let currentSort = { field: 'id', order: 'desc' };
let currentFilters = { type: 'all', groupId: 'all', status: 'all', search: '' };
let groupsCache = [];

/**
 * 初始化网络（IP 代理）页面。
 * @param {HTMLElement} pageElement - 要操作的主要内容区域。
 */
export function initNetworkPage(pageElement) {
    console.log("Initializing Network Page...");
    contentArea = pageElement;
    if (!contentArea) {
        console.error('[Network Page] Content area not provided!');
        return;
    }

    // 缓存 DOM 元素
    tableBody = contentArea.querySelector('.proxies-table tbody');
    paginationContainer = contentArea.querySelector('.pagination');
    searchInput = contentArea.querySelector('.table-search-input');
    selectAllCheckbox = contentArea.querySelector('.select-all-checkbox');
    addProxyBtn = contentArea.querySelector('.add-proxy-btn');
    bulkTestBtn = contentArea.querySelector('.bulk-test-proxies-btn');
    filterElements = {
        type: contentArea.querySelector('.select-filter[data-filter="type"]'),
        groupId: contentArea.querySelector('.select-filter[data-filter="groupId"]'),
        status: contentArea.querySelector('.select-filter[data-filter="status"]'),
    };

    if (!tableBody || !paginationContainer || !searchInput || !selectAllCheckbox || !addProxyBtn || !bulkTestBtn || !filterElements.type || !filterElements.groupId || !filterElements.status) {
        console.error('[Network Page] Failed to find all required elements in the template.');
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="14" class="text-center text-red-500 p-4">页面元素加载不完整，无法初始化代理管理。</td></tr>';
        return;
    }

    // 设置事件监听器
    setupEventListeners();

    // 初始化：加载分组 -> 加载数据
    loadGroups().then(() => {
        loadProxies(); // 初始加载第一页数据
    });

    // 监听代理测试结果
    listenForTestResults();
}

/**
 * 设置页面上的事件监听器。
 */
function setupEventListeners() {
    // 添加代理按钮
    addProxyBtn.addEventListener('click', handleAddProxyClick);

    // 批量测试按钮
    bulkTestBtn.addEventListener('click', handleBulkTestClick);

    // 筛选器变化
    Object.values(filterElements).forEach(select => {
        select.addEventListener('change', handleFilterChange);
    });

    // 搜索输入 (防抖)
    searchInput.addEventListener('input', debounce(handleSearchInput, 300));

    // 全选/取消全选
    selectAllCheckbox.addEventListener('change', handleSelectAllChange);

    // 表格内事件委托 (操作按钮, 行选择)
    tableBody.addEventListener('click', handleTableClick);
    tableBody.addEventListener('change', handleTableRowCheckboxChange);
}

/**
 * 从数据库加载分组信息并填充筛选器和模态框。
 */
async function loadGroups() {
    try {
        groupsCache = await window.dbAPI.getGroups();
        populateGroupFilter(groupsCache);
        // 模态框里的分组下拉也会用到 groupsCache
    } catch (error) {
        console.error('加载分组失败:', error);
        showToast('加载分组列表失败', 'error');
        groupsCache = []; // 确保是空数组
    }
}

/**
 * 填充分组筛选下拉框。
 */
function populateGroupFilter(groups) {
    const groupSelect = filterElements.groupId;
    // 保留第一个"所有分组"选项
    groupSelect.innerHTML = '<option value="all">所有分组</option>';
    groups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        groupSelect.appendChild(option);
    });
}

/**
 * 加载代理数据 (核心函数)。
 */
async function loadProxies() {
    if (isLoading) return;
    isLoading = true;
    showLoadingIndicator();

    const options = {
        page: currentPage,
        limit: itemsPerPage,
        sortBy: currentSort.field,
        sortOrder: currentSort.order,
        ...currentFilters // 包含 type, groupId, status, search
    };

    try {
        const { proxies, total } = await window.dbAPI.getProxies(options);
        renderTable(proxies);
        renderPagination(total);
    } catch (error) {
        console.error('加载代理列表失败:', error);
        showToast('加载代理列表失败', 'error');
        tableBody.innerHTML = `<tr><td colspan="14" class="text-center text-red-500 p-4">加载数据出错: ${error.message}</td></tr>`;
        paginationContainer.innerHTML = ''; // 清空分页
    } finally {
        isLoading = false;
        hideLoadingIndicator();
        updateSelectAllCheckboxState(); // 确保全选框状态正确
    }
}

/**
 * 渲染表格内容。
 * @param {Array<object>} proxies - 代理数据数组。
 */
function renderTable(proxies) {
    tableBody.innerHTML = ''; // 清空旧数据
    if (proxies.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="14" class="text-center p-4">未找到符合条件的代理配置。</td></tr>';
        return;
    }

    proxies.forEach(proxy => {
        const row = document.createElement('tr');
        row.dataset.proxyId = proxy.id;
        row.classList.toggle('enabled', proxy.is_enabled === 1); // 根据启用状态添加类

        // 格式化地区和风险
        const location = [proxy.country, proxy.region, proxy.city].filter(Boolean).join(', ') || '-';
        const risk = proxy.risk_level ? `${proxy.risk_level} (${proxy.risk_score ?? '?'})` : (proxy.status === '可用' ? '未知' : '-');
        const latency = proxy.latency !== null && proxy.latency !== undefined ? `${proxy.latency}ms` : '-';
        const statusClass = getStatusClass(proxy.status);

        row.innerHTML = `
            <td><input type="checkbox" class="row-checkbox"></td>
            <td data-field="name">${proxy.name || '-'}</td>
            <td data-field="type">${proxy.type || '-'}</td>
            <td data-field="host">${proxy.host || '-'}</td>
            <td data-field="port">${proxy.port || '-'}</td>
            <td data-field="username">${proxy.username || '-'}</td>
            <td data-field="status"><span class="status ${statusClass}">${proxy.status || '-'}</span></td>
            <td data-field="latency">${latency}</td>
            <td data-field="exit_ip">${proxy.exit_ip || '-'}</td>
            <td data-field="location" title="${proxy.organization || ''}">${location}</td>
            <td data-field="risk">${risk}</td>
            <td data-field="group_name">${proxy.group_name || '无分组'}</td>
            <td>
                <button class="btn-icon action-btn toggle-enable-btn" data-action="toggle-enable" title="点击${proxy.is_enabled ? '禁用' : '启用'}">
                    <i class="fa ${proxy.is_enabled ? 'fa-toggle-on text-green-500' : 'fa-toggle-off text-gray-500'}"></i>
                </button>
            </td>
            <td class="actions-cell">
                 <button class="btn-icon action-btn test-btn" data-action="test" title="测试连通性"><i class="fa fa-plug"></i></button>
                 <button class="btn-icon action-btn edit-btn" data-action="edit" title="编辑"><i class="fa fa-edit"></i></button>
                 <button class="btn-icon action-btn delete-btn" data-action="delete" title="删除"><i class="fa fa-trash"></i></button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * 根据状态字符串返回对应的 CSS 类名。
 */
function getStatusClass(status) {
    switch (status) {
        case '可用': return 'available'; // 绿色
        case '不可用': return 'unavailable'; // 红色
        case '测试中': return 'testing'; // 蓝色/黄色
        case '信息获取失败': return 'error'; // 橙色/红色
        case '未测试':
        default: return 'unknown'; // 灰色
    }
}

/**
 * 渲染分页控件。
 * @param {number} totalItems - 总项目数。
 */
function renderPagination(totalItems) {
    paginationContainer.innerHTML = ''; // 清空旧控件
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (totalPages <= 1) return; // 只有一页或没有数据则不显示分页

    const paginationWrapper = document.createElement('div');
    paginationWrapper.className = 'pagination-controls';

    // 上一页按钮
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '<i class="fa fa-chevron-left"></i>';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadProxies();
        }
    });
    paginationWrapper.appendChild(prevButton);

    // 页码信息 (例如: "第 1 / 10 页")
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    pageInfo.textContent = `第 ${currentPage} / ${totalPages} 页`;
    paginationWrapper.appendChild(pageInfo);

    // 下一页按钮
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '<i class="fa fa-chevron-right"></i>';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            loadProxies();
        }
    });
    paginationWrapper.appendChild(nextButton);

    paginationContainer.appendChild(paginationWrapper);
}

// --- 事件处理函数 ---

function handleAddProxyClick() {
    openProxyModal(); // 打开空表单的模态框
}

async function handleBulkTestClick() {
    const selectedIds = getSelectedProxyIds();
    if (selectedIds.length === 0) {
        showToast('请先选择要测试的代理配置', 'warning');
        return;
    }
    showToast(`开始测试 ${selectedIds.length} 个代理...`, 'info');
    updateRowsStatus(selectedIds, '测试中'); // 立即更新UI状态
    try {
        await window.proxyAPI.testProxies(selectedIds);
        // 测试结果将通过 onTestResult 更新 UI
    } catch (error) {
        console.error('批量测试代理失败:', error);
        showToast(`发起批量测试失败: ${error.message}`, 'error');
        // 可能需要将状态重置回 未测试 或之前的状态
        // loadProxies(); // 或者重新加载数据
    }
}

function handleFilterChange(event) {
    const filterType = event.target.dataset.filter;
    const value = event.target.value;
    if (currentFilters[filterType] !== value) {
        currentFilters[filterType] = value;
        currentPage = 1; //筛选变化，重置到第一页
        loadProxies();
    }
}

function handleSearchInput(event) {
    const searchTerm = event.target.value.trim();
    if (currentFilters.search !== searchTerm) {
        currentFilters.search = searchTerm;
        currentPage = 1;
        loadProxies();
    }
}

function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    tableBody.querySelectorAll('.row-checkbox').forEach(checkbox => {
        checkbox.checked = isChecked;
        // 触发 change 事件以更新行样式（如果需要）
        // checkbox.dispatchEvent(new Event('change'));
        checkbox.closest('tr').classList.toggle('selected', isChecked);
    });
}

function handleTableClick(event) {
    const target = event.target;
    const actionBtn = target.closest('.action-btn');

    if (actionBtn) {
        const action = actionBtn.dataset.action;
        const row = actionBtn.closest('tr');
        const proxyId = parseInt(row.dataset.proxyId, 10);

        switch (action) {
            case 'toggle-enable':
                handleToggleEnable(proxyId, row);
                break;
            case 'test':
                handleSingleTest(proxyId, row);
                break;
            case 'edit':
                handleEditProxy(proxyId);
                break;
            case 'delete':
                handleDeleteProxy(proxyId, row);
                break;
        }
    }
}

function handleTableRowCheckboxChange(event) {
     if (event.target.matches('input.row-checkbox')) {
        event.target.closest('tr').classList.toggle('selected', event.target.checked);
        updateSelectAllCheckboxState();
     }
}

// --- 具体操作处理 ---

async function handleToggleEnable(proxyId, rowElement) {
    const currentIsEnabled = rowElement.classList.contains('enabled');
    const newIsEnabled = !currentIsEnabled;
    const newState = newIsEnabled ? 1 : 0;

    try {
        await window.dbAPI.updateProxy(proxyId, { is_enabled: newState });

        // 更新 UI
        rowElement.classList.toggle('enabled', newIsEnabled);
        const icon = rowElement.querySelector('.toggle-enable-btn i');
        icon.classList.toggle('fa-toggle-on', newIsEnabled);
        icon.classList.toggle('text-green-500', newIsEnabled);
        icon.classList.toggle('fa-toggle-off', !newIsEnabled);
        icon.classList.toggle('text-gray-500', !newIsEnabled);
        icon.closest('button').title = `点击${newIsEnabled ? '禁用' : '启用'}`;

        showToast(`代理已${newIsEnabled ? '启用' : '禁用'}`, 'success');

        // 调用主进程应用设置 (如果需要全局立即生效)
        // 如果只想启用一个，需要先禁用其他所有？还是只启用当前选中的？
        // 方案：调用 setProxy 时，主进程可以只启用传入的 ID，并自动禁用其他的。
        // 或者，UI 只允许一个代理处于启用状态。
        // 这里先假设 setProxy(proxyId) 会启用这个，setProxy(null) 会禁用所有。
        // 这里先假设 setProxy(proxyId) 会启用这个，setProxy(null) 会禁用所有。
        await window.proxyAPI.setProxy(newIsEnabled ? proxyId : null);

    } catch (error) {
        console.error(`切换代理 ${proxyId} 启用状态失败:`, error);
        showToast(`操作失败: ${error.message}`, 'error');
    }
}

async function handleSingleTest(proxyId, rowElement) {
    showToast(`开始测试代理 #${proxyId}...`, 'info');
    updateRowStatus(rowElement, '测试中');
    try {
        await window.proxyAPI.testProxies([proxyId]); // 使用数组包裹单个 ID
    } catch (error) {
        console.error(`测试代理 ${proxyId} 失败:`, error);
        showToast(`发起测试失败: ${error.message}`, 'error');
        // 可能需要将状态改回 未测试
        // const proxyData = await window.dbAPI.getProxyById(proxyId); // 重新获取数据更新行
        // updateRow(rowElement, proxyData);
    }
}

async function handleEditProxy(proxyId) {
    try {
        const proxyData = await window.dbAPI.getProxyById(proxyId);
        if (!proxyData) {
            showToast('找不到要编辑的代理信息', 'error');
                 return;
             }
        openProxyModal(proxyData); // 使用获取到的数据填充模态框
    } catch (error) {
        console.error(`获取代理 ${proxyId} 信息失败:`, error);
        showToast('加载编辑信息失败', 'error');
    }
}

async function handleDeleteProxy(proxyId, rowElement) {
    // 使用 confirm 或自定义确认框
    if (confirm(`确定要删除代理 #${proxyId} 吗？此操作不可撤销。`)) {
        try {
            await window.dbAPI.deleteProxy(proxyId);
            rowElement.remove(); // 从 DOM 中移除
            showToast(`代理 #${proxyId} 已删除`, 'success');
            // 可能需要重新计算总数并更新分页（如果跨页）
            // 简单处理：重新加载当前页
            loadProxies();
        } catch (error) {
            console.error(`删除代理 ${proxyId} 失败:`, error);
            showToast(`删除失败: ${error.message}`, 'error');
        }
    }
}

// --- 模态框处理 ---

/**
 * 打开添加/编辑代理的模态框。
 * @param {object|null} proxyData - 如果是编辑，则传入代理数据；添加则不传或传 null。
 */
function openProxyModal(proxyData = null) {
    showModal('tpl-modal-proxy-form', (modalElement) => {
        const form = modalElement.querySelector('#proxy-form');
        const title = modalElement.querySelector('.modal-title');
        const saveBtn = modalElement.querySelector('#modal-save-proxy-btn');
        const groupSelect = form.querySelector('#proxy-group');

        // 填充分组下拉框
        groupSelect.innerHTML = '<option value="">-- 无分组 --</option>'; // 重置
        groupsCache.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });

        if (proxyData) {
            // 编辑模式
            title.textContent = '编辑代理配置';
            form.elements['id'].value = proxyData.id;
            form.elements['name'].value = proxyData.name || '';
            form.elements['type'].value = proxyData.type || 'HTTP';
            form.elements['host'].value = proxyData.host || '';
            form.elements['port'].value = proxyData.port || '';
            form.elements['username'].value = proxyData.username || '';
            // 密码字段留空，表示不修改
            form.elements['password'].value = ''; // 清空密码输入框
            form.elements['password'].placeholder = '留空则不修改密码';
            groupSelect.value = proxyData.group_id || '';
        } else {
            // 添加模式
            title.textContent = '添加代理配置';
            form.reset(); // 重置表单
            form.elements['id'].value = ''; // 确保 ID 为空
             form.elements['password'].placeholder = '输入密码 (可选)';
        }

        // 保存按钮事件 (移除旧监听器确保只有一个)
        saveBtn.onclick = async () => {
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            const formData = new FormData(form);
            const data = {};
            let hasPassword = false;
            formData.forEach((value, key) => {
                // 特殊处理 group_id，如果是空字符串，设为 null
                if (key === 'group_id' && value === '') {
                    data[key] = null;
                } else if (key === 'password') {
                    if (value.trim() !== '') { // 只有非空时才包含密码字段
                       data[key] = value;
                       hasPassword = true;
                    }
                } else {
                    data[key] = value;
                }
            });

             // 类型转换
            data.port = parseInt(data.port, 10);
            if (data.group_id) data.group_id = parseInt(data.group_id, 10);

            const isEditing = !!data.id;

            try {
                 // 添加检查加密服务是否解锁的逻辑（仅在有密码时）
                if (hasPassword && !(await window.electron.ipcRenderer.invoke('auth:isUnlocked'))) {
                     showToast('请先解锁应用以保存密码！', 'error');
                     // 可能需要触发解锁流程
                     return;
                 }

                if (isEditing) {
                    data.id = parseInt(data.id, 10); // 确保 ID 是数字
                    await window.dbAPI.updateProxy(data.id, data);
                    showToast('代理配置已更新', 'success');
                } else {
                    delete data.id; // 移除空的 id 字段
                    await window.dbAPI.addProxy(data);
                    showToast('代理配置已添加', 'success');
                }
                hideModal();
                loadProxies(); // 刷新列表
            } catch (error) {
                console.error('保存代理配置失败:', error);
                showToast(`保存失败: ${error.message}`, 'error');
            }
        };
    });
}

// --- 辅助函数 ---

function showLoadingIndicator() {
    // TODO: 实现显示加载状态的逻辑，例如在表格上覆盖一个半透明层和 spinner
    console.log("Loading proxies...");
    if(tableBody) tableBody.style.opacity = '0.5';
}

function hideLoadingIndicator() {
    // TODO: 隐藏加载状态
     if(tableBody) tableBody.style.opacity = '1';
}

function getSelectedProxyIds() {
    return Array.from(tableBody.querySelectorAll('.row-checkbox:checked'))
                .map(cb => parseInt(cb.closest('tr').dataset.proxyId, 10));
}

function updateSelectAllCheckboxState() {
     if (!selectAllCheckbox || !tableBody) return;
     const rowCheckboxes = tableBody.querySelectorAll('input.row-checkbox');
     const totalRows = rowCheckboxes.length;
     const checkedRows = tableBody.querySelectorAll('input.row-checkbox:checked').length;

    if (totalRows > 0) {
        selectAllCheckbox.checked = checkedRows === totalRows;
        selectAllCheckbox.indeterminate = checkedRows > 0 && checkedRows < totalRows;
    } else {
        selectAllCheckbox.checked = false;
        selectAllCheckbox.indeterminate = false;
    }
}

/**
 * 监听主进程发送的测试结果。
 */
function listenForTestResults() {
    window.proxyAPI.onTestResult((result) => {
        console.log('Received test result:', result);
        const { proxyId, success, data } = result;
        const row = tableBody.querySelector(`tr[data-proxy-id="${proxyId}"]`);
        if (row) {
            if (success && data) {
                 updateRow(row, data); // 使用成功的数据更新行
            } else {
                // 测试失败，更新状态为不可用或信息获取失败
                updateRowStatus(row, data?.status || '不可用');
            }
        }
    });
}

/**
 * 更新指定行的状态显示。
 * @param {HTMLElement} rowElement - 要更新的表格行。
 * @param {string} statusText - 新的状态文本 ('测试中', '可用', '不可用', etc.)。
 */
function updateRowStatus(rowElement, statusText) {
    const statusCell = rowElement.querySelector('td[data-field="status"] span');
    const testBtn = rowElement.querySelector('.test-btn');
    if (statusCell) {
        statusCell.textContent = statusText;
        statusCell.className = `status ${getStatusClass(statusText)}`;
    }
     // 测试中时禁用测试按钮
    if (testBtn) {
         testBtn.disabled = (statusText === '测试中');
         if (testBtn.disabled) {
             testBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
         } else {
             testBtn.innerHTML = '<i class="fa fa-plug"></i>';
         }
    }
}

/**
 * 批量更新行的状态。
 */
function updateRowsStatus(proxyIds, statusText) {
    proxyIds.forEach(id => {
        const row = tableBody.querySelector(`tr[data-proxy-id="${id}"]`);
        if (row) {
            updateRowStatus(row, statusText);
        }
    });
}

/**
 * 使用新的代理数据完全更新表格行内容。
 * @param {HTMLElement} rowElement - 要更新的表格行。
 * @param {object} proxy - 新的代理数据对象 (应包含所有渲染所需字段)。
 */
function updateRow(rowElement, proxy) {
    const location = [proxy.country, proxy.region, proxy.city].filter(Boolean).join(', ') || '-';
    const risk = proxy.risk_level ? `${proxy.risk_level} (${proxy.risk_score ?? '?'})` : (proxy.status === '可用' ? '未知' : '-');
    const latency = proxy.latency !== null && proxy.latency !== undefined ? `${proxy.latency}ms` : '-';
    const statusClass = getStatusClass(proxy.status);
    const isEnabled = proxy.is_enabled === 1;

    rowElement.classList.toggle('enabled', isEnabled);

    // 更新每个单元格的内容
    rowElement.querySelector('td[data-field="name"]').textContent = proxy.name || '-';
    rowElement.querySelector('td[data-field="type"]').textContent = proxy.type || '-';
    rowElement.querySelector('td[data-field="host"]').textContent = proxy.host || '-';
    rowElement.querySelector('td[data-field="port"]').textContent = proxy.port || '-';
    rowElement.querySelector('td[data-field="username"]').textContent = proxy.username || '-';
    const statusSpan = rowElement.querySelector('td[data-field="status"] span');
    statusSpan.textContent = proxy.status || '-';
    statusSpan.className = `status ${statusClass}`;
    rowElement.querySelector('td[data-field="latency"]').textContent = latency;
    rowElement.querySelector('td[data-field="exit_ip"]').textContent = proxy.exit_ip || '-';
    rowElement.querySelector('td[data-field="location"]').textContent = location;
    rowElement.querySelector('td[data-field="location"]').title = proxy.organization || '';
    rowElement.querySelector('td[data-field="risk"]').textContent = risk;
    rowElement.querySelector('td[data-field="group_name"]').textContent = proxy.group_name || '无分组';

    // 更新启用开关
    const toggleBtnIcon = rowElement.querySelector('.toggle-enable-btn i');
    toggleBtnIcon.classList.toggle('fa-toggle-on', isEnabled);
    toggleBtnIcon.classList.toggle('text-green-500', isEnabled);
    toggleBtnIcon.classList.toggle('fa-toggle-off', !isEnabled);
    toggleBtnIcon.classList.toggle('text-gray-500', !isEnabled);
    toggleBtnIcon.closest('button').title = `点击${isEnabled ? '禁用' : '启用'}`;

    // 恢复测试按钮状态
     const testBtn = rowElement.querySelector('.test-btn');
     if (testBtn) {
         testBtn.disabled = false;
         testBtn.innerHTML = '<i class="fa fa-plug"></i>';
     }
}

// --- 导出初始化函数 ---
// (index.js 中已包含导出) 