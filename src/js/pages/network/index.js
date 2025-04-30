// Import helpers and other modules if needed
import { setupTableActions, setupFilteringAndSearch, setupCheckAll } from '../../components/tableHelper.js';
import { showModal, hideModal } from '../../components/modal.js';
import { showToast } from '../../components/toast.js';
import { debounce } from '../../utils/index.js';
import { translateLocation } from '../../utils/locationTranslator.js';
// import * as table from './table.js';
// import * as modals from './modals.js';
// import * as actions from './actions.js';

// 全局变量声明
let contentArea = null;
let tableBody = null;
let paginationWrapper = null; // 外层容器
let paginationContainer = null; // 内层按钮容器
let searchInput = null;
let selectAllCheckbox = null;
let addProxyBtn = null;
let bulkTestBtn = null;
let bulkDeleteBtn = null; // 新增：批量删除按钮
let importProxiesBtn = null; // 新增：导入代理按钮
let exportProxiesBtn = null; // 新增：导出代理按钮
let filterElements = {};
let isLoading = false;
let currentPage = 1;
let itemsPerPage = 10;
let totalItems = 0;
let currentSort = { field: 'id', order: 'asc' };
let currentFilters = { type: 'all', groupId: 'all', status: 'all', search: '' };
let groupsCache = [];

// 分页相关的DOM元素引用 (匹配新结构)
let pageSizeSelect = null;
let prevPageBtn = null;
let nextPageBtn = null;
let pageNumbersContainer = null;
let pageInfoSpan = null;
// totalCountSpan 不再直接在HTML中，将在JS中查找

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
    paginationWrapper = contentArea.querySelector('.pagination-controls-wrapper'); // 外层
    searchInput = contentArea.querySelector('.table-search-input');
    selectAllCheckbox = contentArea.querySelector('.select-all-checkbox');
    addProxyBtn = contentArea.querySelector('.add-proxy-btn');
    bulkTestBtn = contentArea.querySelector('.bulk-test-proxies-btn');
    bulkDeleteBtn = contentArea.querySelector('.bulk-delete-proxies-btn'); // 获取删除按钮
    importProxiesBtn = contentArea.querySelector('.import-proxies-btn'); // 获取导入按钮
    exportProxiesBtn = contentArea.querySelector('.export-proxies-btn'); // 获取导出按钮
    
    // 分页相关元素 (从 wrapper 内部查找)
    if (paginationWrapper) {
        pageSizeSelect = paginationWrapper.querySelector('.page-size-select');
        paginationContainer = paginationWrapper.querySelector('.pagination'); // 内层
        if (paginationContainer) {
            prevPageBtn = paginationContainer.querySelector('.prev-page-btn');
            nextPageBtn = paginationContainer.querySelector('.next-page-btn');
            pageNumbersContainer = paginationContainer.querySelector('.page-numbers');
            pageInfoSpan = paginationContainer.querySelector('.page-info');
        }
    }
    
    filterElements = {
        type: contentArea.querySelector('.select-filter[data-filter="type"]'),
        status: contentArea.querySelector('.select-filter[data-filter="status"]'),
    };

    if (!validateRequiredElements()) {
        return;
    }

    // 设置事件监听器
    setupEventListeners();

    // 直接加载数据，不需要先加载分组
    loadProxies();

    // 监听代理测试结果
    listenForTestResults();
}

/**
 * 校验必需的DOM元素是否存在。
 */
function validateRequiredElements() {
    const requiredElements = {
        tableBody,
        paginationWrapper, // 检查外层
        paginationContainer, // 检查内层
        searchInput,
        selectAllCheckbox,
        addProxyBtn,
        bulkTestBtn,
        bulkDeleteBtn,      // 验证删除按钮
        importProxiesBtn,   // 验证导入按钮
        exportProxiesBtn,   // 验证导出按钮
        pageSizeSelect,
        prevPageBtn, 
        nextPageBtn, 
        pageNumbersContainer, 
        pageInfoSpan,
        // totalCountSpan 不再直接检查，会在 renderPagination 中处理
        ...filterElements
    };

    for (const [name, element] of Object.entries(requiredElements)) {
        if (!element) {
            console.error(`[Network Page] Required element not found: ${name}`);
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="14" class="text-center text-red-500 p-4">页面元素加载不完整，无法初始化代理管理。</td></tr>';
            }
            return false;
        }
    }
    return true;
}

/**
 * 设置页面上的事件监听器。
 */
function setupEventListeners() {
    // 添加代理按钮
    addProxyBtn.addEventListener('click', handleAddProxyClick);

    // 批量测试按钮
    bulkTestBtn.addEventListener('click', handleBulkTestClick);

    // 批量删除按钮
    bulkDeleteBtn.addEventListener('click', handleBulkDeleteClick); // 添加删除监听器

    // 导入代理按钮
    importProxiesBtn.addEventListener('click', handleImportClick); // 添加导入监听器

    // 导出代理按钮
    exportProxiesBtn.addEventListener('click', handleExportClick); // 添加导出监听器

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

    // 分页相关的事件监听器 (复制自钱包管理)
    pageSizeSelect.addEventListener('change', handlePageSizeChange);
    prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
    nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));
    pageNumbersContainer.addEventListener('click', handlePageNumberClick);
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
 * 获取延迟对应的样式类。
 * @param {number} latencyMs - 延迟时间（毫秒）。
 * @returns {string} CSS 类名。
 */
function getLatencyClass(latencyMs) {
    if (latencyMs === null || latencyMs === undefined) return '';
    if (latencyMs < 100) return 'latency-excellent';
    if (latencyMs < 300) return 'latency-good';
    if (latencyMs < 800) return 'latency-fair';
    return 'latency-poor';
}

/**
 * 获取风险等级对应的样式类。
 * @param {string} riskLevel - 风险等级。
 * @returns {string} CSS 类名。
 */
function getRiskClass(riskLevel) {
    if (!riskLevel) return 'risk-unknown';
    switch (riskLevel.toLowerCase()) {
        case 'low':
        case '低风险':
            return 'risk-low';
        case 'medium':
        case '中等风险':
            return 'risk-medium';
        case 'high':
        case '高风险':
            return 'risk-high';
        default:
            return 'risk-unknown';
    }
}

/**
 * 渲染表格内容。
 * @param {Array<object>} proxies - 代理数据数组。
 */
function renderTable(proxies) {
    tableBody.innerHTML = '';
    if (proxies.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="11" class="text-center p-4">未找到符合条件的代理配置。</td></tr>';
        return;
    }

    proxies.forEach(proxy => {
        const row = document.createElement('tr');
        row.dataset.proxyId = proxy.id;
        row.classList.add('data-table');
        row.classList.toggle('enabled', proxy.is_enabled === 1);

        // 格式化地区和风险
        const location = translateLocation([proxy.country, proxy.region, proxy.city].filter(Boolean).join(', '));
        const riskClass = getRiskClass(proxy.risk_level);
        const risk = proxy.risk_level ? `<span class="${riskClass}">${proxy.risk_level} (${proxy.risk_score ?? '?'})</span>` : '<span class="risk-unknown">未知</span>';
        const latencyClass = getLatencyClass(proxy.latency);
        const latency = proxy.latency !== null && proxy.latency !== undefined ? `<span class="${latencyClass}">${proxy.latency}ms</span>` : '-';
        const statusClass = getStatusClass(proxy.status);

        row.innerHTML = `
            <td><input type="checkbox" class="row-checkbox"></td>
            <td data-field="name">${proxy.id}</td>
            <td data-field="type">${proxy.type || '-'}</td>
            <td data-field="host">${proxy.host || '-'}</td>
            <td data-field="port">${proxy.port || '-'}</td>
            <td data-field="status"><span class="status ${statusClass}">${proxy.status || '-'}</span></td>
            <td data-field="latency">${latency}</td>
            <td data-field="location" title="${[proxy.country, proxy.region, proxy.city].filter(Boolean).join(', ')}">${location}</td>
            <td data-field="risk">${risk}</td>
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
 * 渲染分页控件 (匹配新结构)。
 */
function renderPagination(total) {
    totalItems = total;
    const totalPages = Math.ceil(total / itemsPerPage);
    
    // 安全检查
    if (!paginationWrapper || !pageInfoSpan || !pageNumbersContainer || !prevPageBtn || !nextPageBtn) {
        console.error("Pagination elements not found, cannot render pagination.");
        return;
    }

    // 更新总数显示 (查找totalCountSpan)
    const totalCountSpan = paginationWrapper.querySelector('.total-count');
    if (totalCountSpan) {
        totalCountSpan.textContent = total;
    }
    
    // 更新页码信息
    pageInfoSpan.textContent = `${currentPage}/${totalPages}页 共${total}条`;

    // 更新按钮状态
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;

    // 生成页码按钮
    pageNumbersContainer.innerHTML = '';
    const maxPageButtons = 5; 
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    if (endPage - startPage + 1 < maxPageButtons && totalPages >= maxPageButtons) {
        startPage = endPage - maxPageButtons + 1;
    }
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `page-number ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.dataset.page = i;
        pageNumbersContainer.appendChild(pageButton);
    }

    // 控制整个 wrapper 的显示
    paginationWrapper.style.display = totalPages > 0 ? 'flex' : 'none'; // 修改：有数据才显示
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
    const row = target.closest('tr');

    // 如果点击的是操作按钮，处理按钮事件
    if (actionBtn) {
        const action = actionBtn.dataset.action;
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
        return; // 如果是按钮点击，不执行后续的行选中逻辑
    }

    // 如果点击的是复选框，不处理行点击事件
    if (target.matches('input[type="checkbox"]')) {
        return;
    }

    // 处理行点击事件
    if (row) {
        const checkbox = row.querySelector('input.row-checkbox');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            row.classList.toggle('selected', checkbox.checked);
            // 触发change事件以更新全选框状态
            checkbox.dispatchEvent(new Event('change'));
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
    showToast(`开始测试代理 ${proxyId}...`, 'info');
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
    // 获取代理信息用于确认提示 (如果需要更详细的信息)
    // const proxyType = rowElement.cells[2]?.textContent?.trim() || '未知类型';
    // const proxyHost = rowElement.cells[3]?.textContent?.trim() || `ID: ${proxyId}`;

    showModal('tpl-confirm-dialog', (modalElement) => {
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        const titleElement = modalElement.querySelector('.modal-title');

        if (!messageElement || !confirmBtn || !titleElement) {
            console.error("确认模态框缺少元素");
            hideModal();
            return;
        }

        // 设置模态框内容
        titleElement.textContent = '确认删除代理';
        messageElement.textContent = `确定要删除代理 ${proxyId} 吗？此操作不可撤销。`;
        confirmBtn.textContent = '确认删除';
        confirmBtn.classList.add('btn-danger'); // 使用危险色

        const handleConfirm = async () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 删除中...';

            try {
                await window.dbAPI.deleteProxy(proxyId);
                rowElement.remove(); // 从 DOM 中移除
                showToast(`代理 ${proxyId} 已删除`, 'success');
                // 可能需要重新计算总数并更新分页（如果跨页）
                // 简单处理：重新加载当前页
                await loadProxies();
                hideModal(); // 成功后关闭模态框
            } catch (error) {
                console.error(`删除代理 ${proxyId} 失败:`, error);
                showToast(`删除失败: ${error.message}`, 'error');
                confirmBtn.disabled = false;
                confirmBtn.textContent = '确认删除';
                // 失败时不关闭模态框，允许用户重试或取消
            }
        };

        // 添加确认按钮监听器
        confirmBtn.addEventListener('click', handleConfirm);
    });
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

        // 重置表单
        form.reset();
        
        if (proxyData) {
            // 编辑模式
            console.log('正在编辑代理', proxyData);
            title.textContent = '编辑代理配置';
            
            // 设置表单字段值前先检查元素是否存在
            if (form.elements['id']) form.elements['id'].value = proxyData.id || '';
            if (form.elements['type']) form.elements['type'].value = proxyData.type || 'HTTP';
            if (form.elements['host']) form.elements['host'].value = proxyData.host || '';
            if (form.elements['port']) form.elements['port'].value = proxyData.port || '';
            if (form.elements['username']) form.elements['username'].value = proxyData.username || '';
            if (form.elements['password']) {
                form.elements['password'].value = proxyData.password || '';
                form.elements['password'].placeholder = '留空则不修改密码';
            }
            
            // 修改name字段的设置，可能不存在这个字段
            if (form.elements['name'] && proxyData.name) {
                form.elements['name'].value = proxyData.name;
            }
        } else {
            // 添加模式
            title.textContent = '添加代理配置';
            if (form.elements['id']) form.elements['id'].value = ''; // 确保 ID 为空
            if (form.elements['password']) {
                form.elements['password'].placeholder = '输入密码 (可选)';
            }
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
                if (key === 'password') {
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

            const isEditing = !!data.id;

            try {
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
                console.error('保存代理配置失败:', error); // 保留详细错误日志在控制台
                // 对用户显示友好的错误信息
                let userMessage = '保存失败，请检查输入是否正确';
                if (error.message.includes('already exists') || error.message.includes('已存在')) {
                    userMessage = '该IP地址已存在，请勿重复添加';
                } else if (error.message.includes('required') || error.message.includes('缺少')) {
                    userMessage = '请填写所有必填项';
                }
                showToast(userMessage, 'error');
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
    // Add null check for rowElement for extra safety
    if (!rowElement) {
        console.warn('updateRowStatus called with null rowElement');
        return;
    }
    const statusCell = rowElement.querySelector('td[data-field="status"] span');
    const testBtn = rowElement.querySelector('.test-btn');
    if (statusCell) {
        statusCell.textContent = statusText;
        statusCell.className = `status ${getStatusClass(statusText)}`;
    }
     // 根据状态更新测试按钮
    if (testBtn) {
         const isTesting = (statusText === '测试中');
         testBtn.disabled = isTesting; // 测试中时禁用
         // 如果正在测试，显示旋转图标，否则恢复默认图标
         testBtn.innerHTML = isTesting ? '<i class="fa fa-spinner fa-spin"></i>' : '<i class="fa fa-plug"></i>';
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
    // 格式化地区和风险
    const fullLocation = [proxy.country, proxy.region, proxy.city].filter(Boolean).join(', ');
    const location = translateLocation(fullLocation);
    const riskClass = getRiskClass(proxy.risk_level);
    const risk = proxy.risk_level ? `<span class="${riskClass}">${proxy.risk_level} (${proxy.risk_score ?? '?'})</span>` : '<span class="risk-unknown">未知</span>';
    const latencyClass = getLatencyClass(proxy.latency);
    const latency = proxy.latency !== null && proxy.latency !== undefined ? `<span class="${latencyClass}">${proxy.latency}ms</span>` : '-';
    const statusClass = getStatusClass(proxy.status);
    const isEnabled = proxy.is_enabled === 1;

    rowElement.classList.toggle('enabled', isEnabled);

    // 更新每个单元格的内容
    rowElement.querySelector('td[data-field="name"]').textContent = proxy.name || '-';
    rowElement.querySelector('td[data-field="type"]').textContent = proxy.type || '-';
    rowElement.querySelector('td[data-field="host"]').textContent = proxy.host || '-';
    rowElement.querySelector('td[data-field="port"]').textContent = proxy.port || '-';
    const statusSpan = rowElement.querySelector('td[data-field="status"] span');
    statusSpan.textContent = proxy.status || '-';
    statusSpan.className = `status ${statusClass}`;
    rowElement.querySelector('td[data-field="latency"]').innerHTML = latency;
    const locationCell = rowElement.querySelector('td[data-field="location"]');
    locationCell.textContent = location;
    locationCell.title = fullLocation; // 完整地址信息放在 title 中
    rowElement.querySelector('td[data-field="risk"]').innerHTML = risk;

    // 更新启用开关
    const toggleBtnIcon = rowElement.querySelector('.toggle-enable-btn i');
    if (toggleBtnIcon) { 
        toggleBtnIcon.classList.toggle('fa-toggle-on', isEnabled);
        toggleBtnIcon.classList.toggle('text-green-500', isEnabled);
        toggleBtnIcon.classList.toggle('fa-toggle-off', !isEnabled);
        toggleBtnIcon.classList.toggle('text-gray-500', !isEnabled);
        const toggleBtn = toggleBtnIcon.closest('button');
        if (toggleBtn) {
           toggleBtn.title = `点击${isEnabled ? '禁用' : '启用'}`;
        }
    } else {
        // 可以选择在这里打印一个警告，说明切换按钮未找到
        // console.warn(`Toggle enable button not found in row for proxy ${proxy.id}`);
    }

    // 恢复测试按钮状态
     const testBtn = rowElement.querySelector('.test-btn');
     if (testBtn) {
         testBtn.disabled = false;
         testBtn.innerHTML = '<i class="fa fa-plug"></i>';
     }
}

/**
 * 处理每页显示数量变化。
 */
function handlePageSizeChange(event) {
    const newSize = parseInt(event.target.value, 10);
    if (newSize !== itemsPerPage) {
        itemsPerPage = newSize;
        currentPage = 1; // 重置到第一页
        loadProxies();
    }
}

/**
 * 处理页码点击事件 (复制自钱包管理)。
 */
function handlePageNumberClick(event) {
    const pageButton = event.target.closest('.page-number');
    if (pageButton && !pageButton.classList.contains('active')) {
        const page = parseInt(pageButton.dataset.page, 10);
        if (page) {
            goToPage(page);
        }
    }
}

/**
 * 跳转到指定页。
 */
function goToPage(page) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (page >= 1 && page <= totalPages && page !== currentPage) {
        currentPage = page;
        loadProxies();
    }
}

// --- 新增或修改的事件处理函数 ---

/**
 * 处理批量删除选中代理的逻辑。
 */
async function handleBulkDeleteClick() {
    const selectedIds = getSelectedProxyIds();
    const count = selectedIds.length;

    if (count === 0) {
        showToast('请至少选择一个代理进行删除', 'warning');
        return;
    }

    showModal('tpl-confirm-dialog', (modalElement) => {
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        const titleElement = modalElement.querySelector('.modal-title');
        if (!messageElement || !confirmBtn || !titleElement) { console.error("确认框元素缺失"); hideModal(); return; }

        titleElement.textContent = '确认批量删除';
        messageElement.textContent = `确定删除选中的 ${count} 个代理吗？此操作不可撤销！`;
        confirmBtn.textContent = `确认删除 (${count})`;
        confirmBtn.classList.add('btn-danger');

        const handleConfirm = async () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> 删除中 (${count})...`;
            hideModal(); // 先关闭确认框
            showToast(`正在删除 ${count} 个代理...`, 'info');

            try {
                // TODO: 实现或调用 window.dbAPI.deleteProxies(selectedIds)
                // 假设存在批量删除API
                // const changes = await window.dbAPI.deleteProxies(selectedIds);
                // 使用正确的函数名调用批量删除API
                const result = await window.dbAPI.deleteProxiesByIds(selectedIds);
                const changes = result.deletedCount; // 获取删除的数量
                showToast(`成功删除 ${changes} 个代理`, 'success');
                await loadProxies(); // 刷新列表
            } catch (error) {
                console.error('批量删除代理失败:', error);
                showToast(`批量删除失败: ${error.message}`, 'error');
            } finally {
                // 重新启用按钮等操作（如果需要）
            }
        };
        confirmBtn.addEventListener('click', handleConfirm);
    });
}

/**
 * 处理导入代理按钮点击事件。
 * 支持两种格式：
 * 1. 协议类型:ip:端口:用户名:密码 - 新格式
 * 2. ip:端口:用户名:密码 - 兼容旧格式，默认HTTP
 */
async function handleImportClick() {
    // 创建一个隐藏的文件输入元素
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.txt,.csv';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // 监听文件选择
    fileInput.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) {
            document.body.removeChild(fileInput);
            return;
        }

        try {
            // 读取文件内容
            const content = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(new Error('读取文件失败'));
                reader.readAsText(file);
            });

            // 解析代理列表
            const proxies = parseProxyList(content);
            if (proxies.length === 0) {
                showToast('未找到有效的代理配置', 'warning');
                document.body.removeChild(fileInput);
                return;
            }

            // 显示确认对话框
            showModal('tpl-confirm-dialog', (modalElement) => {
                const messageElement = modalElement.querySelector('.confirm-message');
                const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
                const titleElement = modalElement.querySelector('.modal-title');

                if (!messageElement || !confirmBtn || !titleElement) {
                    console.error("确认框元素缺失");
                    hideModal();
                    return;
                }

                titleElement.textContent = '确认导入代理';
                messageElement.textContent = `发现 ${proxies.length} 个代理配置，是否导入？`;
                messageElement.innerHTML += `<div style="margin-top:10px;font-size:0.9em;color:#666;">
                    <p>支持格式：</p>
                    <p>1. IP:端口</p>
                    <p>2. IP:端口:用户名:密码</p>
                    <p>3. 协议类型:IP:端口:用户名:密码</p>
                    <p>注：如不指定协议类型，默认为HTTP</p>
                </div>`;
                confirmBtn.textContent = `确认导入 (${proxies.length})`;
                confirmBtn.classList.remove('btn-danger');
                confirmBtn.classList.add('btn-primary');

                const handleConfirm = async () => {
                    confirmBtn.removeEventListener('click', handleConfirm);
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> 导入中...`;

                    try {
                        // 批量添加代理
                        let successCount = 0;
                        let errorCount = 0;
                        const errors = [];

                        for (const proxy of proxies) {
                            try {
                                await window.dbAPI.addProxy({
                                    type: proxy.type || 'HTTP',
                                    host: proxy.host,
                                    port: proxy.port,
                                    username: proxy.username || null,
                                    password: proxy.password || null,
                                    group_id: null
                                });
                                successCount++;
                            } catch (err) {
                                errorCount++;
                                errors.push(`${proxy.host}:${proxy.port} - ${err.message}`);
                            }
                        }

                        // 显示导入结果
                        if (errorCount > 0) {
                            showToast(`导入完成: ${successCount} 成功, ${errorCount} 失败`, 'warning');
                            console.error('导入错误:', errors);
                        } else {
                            showToast(`成功导入 ${successCount} 个代理`, 'success');
                        }

                        hideModal();
                        loadProxies(); // 刷新列表
                    } catch (error) {
                        console.error('导入代理失败:', error);
                        showToast(`导入失败: ${error.message}`, 'error');
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = '重试导入';
                    }
                };

                confirmBtn.addEventListener('click', handleConfirm);
            });

        } catch (error) {
            console.error('处理文件失败:', error);
            showToast(`处理文件失败: ${error.message}`, 'error');
        } finally {
            document.body.removeChild(fileInput);
        }
    };

    // 触发文件选择
    fileInput.click();
}

/**
 * 解析代理列表文本内容。
 * 支持格式:
 * 1. IP:端口
 * 2. IP:端口:用户名:密码
 * 3. 协议类型:IP:端口:用户名:密码
 * @param {string} content - 文件内容
 * @returns {Array<{type: string, host: string, port: number, username?: string, password?: string}>}
 */
function parseProxyList(content) {
    const proxies = [];
    const lines = content.split(/\r?\n/);

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const parts = trimmed.split(':');
        
        // 至少需要IP和端口
        if (parts.length < 2) {
            console.warn(`跳过无效的代理配置: ${trimmed} (格式错误)`);
            continue;
        }

        // 判断第一部分是协议类型还是IP
        const hasProtocol = !isValidIP(parts[0]);
        let proxy = {};

        if (hasProtocol) {
            // 格式: 协议类型:IP:端口[:用户名:密码]
            if (parts.length < 3) {
                console.warn(`跳过无效的代理配置: ${trimmed} (缺少必要参数)`);
                continue;
            }
            proxy.type = parts[0].toUpperCase();
            proxy.host = parts[1];
            proxy.port = parseInt(parts[2], 10);
            if (parts.length >= 5) {
                proxy.username = parts[3] || null;
                proxy.password = parts[4] || null;
            }
        } else {
            // 格式: IP:端口[:用户名:密码]
            proxy.type = 'HTTP';
            proxy.host = parts[0];
            proxy.port = parseInt(parts[1], 10);
            if (parts.length >= 4) {
                proxy.username = parts[2] || null;
                proxy.password = parts[3] || null;
            }
        }

        // 验证IP和端口
        if (!isValidIP(proxy.host)) {
            console.warn(`跳过无效的代理配置: ${trimmed} (IP地址无效)`);
            continue;
        }
        if (!isValidPort(proxy.port)) {
            console.warn(`跳过无效的代理配置: ${trimmed} (端口号无效)`);
            continue;
        }

        proxies.push(proxy);
    }

    return proxies;
}

/**
 * 验证IP地址格式。
 * @param {string} ip - IP地址
 * @returns {boolean}
 */
function isValidIP(ip) {
    const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!pattern.test(ip)) return false;
    
    const parts = ip.split('.');
    return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
}

/**
 * 验证端口号。
 * @param {number} port - 端口号
 * @returns {boolean}
 */
function isValidPort(port) {
    return Number.isInteger(port) && port > 0 && port <= 65535;
}

// --- 新增导出代理功能的处理函数 ---

/**
 * 处理导出代理按钮点击事件。
 */
async function handleExportClick() {
    // 检查是否有选中的代理
    const selectedIds = getSelectedProxyIds();
    let proxies = [];

    try {
        // 确认是否需要导出加密信息（如密码）
        let needDecryption = false;
        let exportAll = false;

        // 显示确认对话框
        showModal('tpl-confirm-dialog', (modalElement) => {
            const messageElement = modalElement.querySelector('.confirm-message');
            const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
            const titleElement = modalElement.querySelector('.modal-title');
            const modalContent = modalElement.querySelector('.modal-content');

            if (!messageElement || !confirmBtn || !titleElement || !modalContent) {
                console.error("确认对话框元素缺失");
                hideModal();
                return;
            }

            // 设置对话框内容
            titleElement.textContent = '导出代理配置';
            
            // 创建额外选项
            const exportOptions = document.createElement('div');
            exportOptions.className = 'export-options';
            exportOptions.style.marginTop = '15px';
            
            const exportSelection = document.createElement('div');
            exportSelection.className = 'form-group';
            exportSelection.innerHTML = `
                <label>
                    <input type="radio" name="export-selection" value="selected" ${selectedIds.length > 0 ? 'checked' : ''} ${selectedIds.length === 0 ? 'disabled' : ''}>
                    导出选中的代理 (${selectedIds.length}个)
                </label><br>
                <label>
                    <input type="radio" name="export-selection" value="all" ${selectedIds.length === 0 ? 'checked' : ''}>
                    导出全部代理
                </label>
            `;

            const decryptionOption = document.createElement('div');
            decryptionOption.className = 'form-group';
            decryptionOption.style.marginTop = '10px';
            decryptionOption.innerHTML = `
                <label>
                    <input type="checkbox" name="decrypt-passwords" checked>
                    勾选导出账户密码，未勾选则只导出IP端口
                </label>
            `;

            exportOptions.appendChild(exportSelection);
            exportOptions.appendChild(decryptionOption);
            
            // 在原有消息后面添加选项
            messageElement.textContent = '请选择导出选项:';
            modalContent.appendChild(exportOptions);

            // 调整按钮样式
            confirmBtn.textContent = '确认导出';
            confirmBtn.classList.remove('btn-danger');
            confirmBtn.classList.add('btn-primary');

            const handleConfirm = async () => {
                // 获取用户选择的选项
                const exportSelectionValue = modalElement.querySelector('input[name="export-selection"]:checked').value;
                exportAll = exportSelectionValue === 'all';
                needDecryption = modalElement.querySelector('input[name="decrypt-passwords"]').checked;

                confirmBtn.removeEventListener('click', handleConfirm);
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 处理中...';

                try {
                    // 获取代理数据
                    if (exportAll) {
                        // 获取所有代理
                        const result = await window.dbAPI.getProxies({
                            sortBy: 'id', 
                            sortOrder: 'asc',
                            limit: 99999 // 设置一个很大的值以获取所有代理
                        });
                        proxies = result.proxies;
                    } else {
                        // 获取选中的代理
                        proxies = [];
                        for (const id of selectedIds) {
                            const proxy = await window.dbAPI.getProxyById(id);
                            if (proxy) {
                                proxies.push(proxy);
                            }
                        }
                    }

                    // 不再需要特殊处理密码解密
                    if (needDecryption) {
                        console.log('用户选择导出密码，但不再需要解密');
                        // 所有密码都是明文存储，无需任何处理
                    } else {
                        // 用户选择不导出密码，清空所有代理的密码字段
                        for (const proxy of proxies) {
                            proxy.password = null;
                        }
                    }

                    // 打印调试信息
                    console.log('导出前的代理数据:', JSON.stringify(proxies, null, 2));

                    // 导出为文本文件
                    const content = formatProxiesForExport(proxies, needDecryption);
                    console.log('导出内容:', content);
                    downloadTextFile(content, 'proxies_export.txt');
                    hideModal();
                    showToast(`成功导出 ${proxies.length} 个代理配置`, 'success');
                } catch (error) {
                    console.error('导出代理失败:', error);
                    showToast(`导出失败: ${error.message}`, 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '重试导出';
                }
            };

            confirmBtn.addEventListener('click', handleConfirm);
        });
    } catch (error) {
        console.error('导出操作失败:', error);
        showToast(`导出失败: ${error.message}`, 'error');
    }
}

/**
 * 将代理数据格式化为导出格式。
 * @param {Array<object>} proxies - 代理数据数组
 * @param {boolean} includeAuth - 是否包含认证信息
 * @returns {string} 格式化后的文本内容
 */
function formatProxiesForExport(proxies, includeAuth) {
    let content = '# FourAir IP代理导出\n';
    content += `# 导出时间: ${new Date().toLocaleString()}\n`;
    content += '# 格式: 协议类型:ip:端口:用户名:密码\n';
    content += '#\n\n';

    proxies.forEach(proxy => {
        // 基本格式: 协议类型:ip:端口
        let line = `${proxy.type || 'HTTP'}:${proxy.host}:${proxy.port}`;
        
        // 如果包含认证信息，则添加用户名和密码
        if (includeAuth) {
            // 优先使用已解密的密码字段
            const username = proxy.username || '';
            let password = proxy.password || '';
            
            // 添加用户名和密码（即使为空，也保留冒号作为占位符）
            line += `:${username}:${password}`;
        }
        
        content += line + '\n';
    });

    return content;
}

/**
 * 下载文本内容为文件。
 * @param {string} content - 要下载的文本内容
 * @param {string} filename - 文件名
 */
function downloadTextFile(content, filename) {
    // 创建Blob对象
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    
    // 创建下载链接
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    // 添加到文档中并触发点击
    document.body.appendChild(link);
    link.click();
    
    // 清理
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}

// --- 导出初始化函数 ---
// (index.js 中已包含导出) 