// 事件处理模块

import { elements, getSelectedProxyIds } from './dom.js';
import { state, updateFilterState } from './state.js';
import { showModal, hideModal } from '../../../components/modal.js';
import { showToast } from '../../../components/toast.js';
import { updateSelectAllCheckboxState, updateRow } from './table.js';
import { handlePageNumberClick, handlePageSizeChange } from './pagination.js';
import { handleImportClick, handleExportClick } from './import-export.js';
import { handleProxyFormSubmit, openProxyModal } from './modals.js';
import { debounce } from '../../../utils/index.js';

// 设置事件监听器
export function setupEventListeners(loadProxies) {
    // 添加代理按钮
    elements.addProxyBtn.addEventListener('click', () => openProxyModal());

    // 批量测试按钮
    elements.bulkTestBtn.addEventListener('click', () => handleBulkTestClick(loadProxies));

    // 批量删除按钮
    elements.bulkDeleteBtn.addEventListener('click', () => handleBulkDeleteClick(loadProxies));

    // 导入代理按钮
    elements.importProxiesBtn.addEventListener('click', () => handleImportClick(loadProxies));

    // 导出代理按钮
    elements.exportProxiesBtn.addEventListener('click', () => handleExportClick(loadProxies));

    // 筛选器变化
    Object.values(elements.filterElements).forEach(select => {
        select.addEventListener('change', (event) => handleFilterChange(event, loadProxies));
    });

    // 搜索输入 (防抖)
    elements.searchInput.addEventListener('input', debounce((event) => handleSearchInput(event, loadProxies), 300));

    // 全选/取消全选
    elements.selectAllCheckbox.addEventListener('change', handleSelectAllChange);

    // 表格内事件委托 (操作按钮, 行选择)
    elements.tableBody.addEventListener('click', (event) => handleTableClick(event, loadProxies));
    elements.tableBody.addEventListener('change', handleTableRowCheckboxChange);
    
    // 监听自定义行选择事件
    elements.tableBody.addEventListener('row-selection-change', () => updateSelectedCount());

    // 分页相关的事件监听器
    elements.pageSizeSelect.addEventListener('change', (event) => {
        if (handlePageSizeChange(event)) {
            loadProxies();
        }
    });
    elements.prevPageBtn.addEventListener('click', () => {
        if (handlePageNumberClick({ target: { dataset: { page: state.currentPage - 1 } } })) {
            loadProxies();
        }
    });
    elements.nextPageBtn.addEventListener('click', () => {
        if (handlePageNumberClick({ target: { dataset: { page: state.currentPage + 1 } } })) {
            loadProxies();
        }
    });
    elements.pageNumbersContainer.addEventListener('click', (event) => {
        if (handlePageNumberClick(event)) {
            loadProxies();
        }
    });

    // 监听代理列表更新事件
    document.addEventListener('proxy-list-updated', () => { 
        console.log('[Events] Received proxy-list-updated event, reloading proxies.');
        if (loadProxies && typeof loadProxies === 'function') {
            loadProxies();
        } else {
            console.warn('[Events] loadProxies function is not available to handle proxy-list-updated event.');
        }
    });
}

// 处理筛选器变化
function handleFilterChange(event, loadProxies) {
    const filterType = event.target.dataset.filter;
    const value = event.target.value;
    updateFilterState({ [filterType]: value });
    loadProxies();
}

// 处理搜索输入
function handleSearchInput(event, loadProxies) {
    const searchTerm = event.target.value.trim();
    updateFilterState({ search: searchTerm });
    loadProxies();
}

// 处理全选/取消全选
function handleSelectAllChange(event) {
    const isChecked = event.target.checked;
    const checkbox = event.target;
    const rowCheckboxes = elements.tableBody.querySelectorAll('input.row-checkbox');
    
    // 当前是否处于部分选中状态
    const isIndeterminate = checkbox.indeterminate;
    
    // 如果是部分选中状态，点击后变为全选
    if (isIndeterminate) {
        rowCheckboxes.forEach(cb => {
            cb.checked = true;
            cb.closest('tr').classList.add('selected');
        });
        checkbox.indeterminate = false;
        checkbox.checked = true;
    } else {
        // 否则根据checkbox的状态进行全选或全不选
        rowCheckboxes.forEach(cb => {
            cb.checked = isChecked;
            cb.closest('tr').classList.toggle('selected', isChecked);
        });
    }
    
    // 更新选中计数和功能按钮状态
    updateSelectedCount();
}

// 更新选中计数和功能按钮状态
function updateSelectedCount() {
    const selectedCount = elements.tableBody.querySelectorAll('input.row-checkbox:checked').length;
    const totalCount = elements.tableBody.querySelectorAll('input.row-checkbox').length;
    
    // 更新批量操作按钮状态
    if (elements.bulkTestBtn) {
        elements.bulkTestBtn.disabled = selectedCount === 0;
    }
    if (elements.bulkDeleteBtn) {
        elements.bulkDeleteBtn.disabled = selectedCount === 0;
    }
    
    // 如果有显示选中计数的元素，可以在这里更新
    const countDisplay = document.querySelector('.selected-count');
    if (countDisplay) {
        countDisplay.textContent = selectedCount > 0 ? `已选择 ${selectedCount}/${totalCount}` : '';
    }
}

// 处理表格行复选框变化
function handleTableRowCheckboxChange(event) {
    if (event.target.matches('input.row-checkbox')) {
        event.target.closest('tr').classList.toggle('selected', event.target.checked);
        // 更新全选框状态
        updateSelectAllCheckboxState();
        // 更新选中计数和按钮状态
        updateSelectedCount();
    }
}

// 处理表格点击事件
function handleTableClick(event, loadProxies) {
    const target = event.target;
    const actionBtn = target.closest('.action-btn');
    const row = target.closest('tr');

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
                handleDeleteProxy(proxyId, row, loadProxies);
                break;
        }
        return;
    }

    // 如果点击了复选框本身，不做额外处理（让默认的change事件去处理）
    if (target.matches('input[type="checkbox"]')) {
        return;
    }

    // 点击行的其他部分，切换行选择状态
    if (row) {
        const checkbox = row.querySelector('input.row-checkbox');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            row.classList.toggle('selected', checkbox.checked);
            
            // 通过自定义事件通知状态变化
            const event = new CustomEvent('row-selection-change', {
                detail: { 
                    row,
                    checked: checkbox.checked 
                },
                bubbles: true
            });
            elements.tableBody.dispatchEvent(event);
            
            // 更新全选框状态
            updateSelectAllCheckboxState();
        }
    }
}

// 处理启用/禁用代理
async function handleToggleEnable(proxyId, rowElement) {
    const currentIsEnabled = rowElement.classList.contains('enabled');
    const newIsEnabled = !currentIsEnabled;
    const newState = newIsEnabled ? 1 : 0;

    try {
        await window.dbAPI.updateProxy(proxyId, { is_enabled: newState });
        rowElement.classList.toggle('enabled', newIsEnabled);
        const icon = rowElement.querySelector('.toggle-enable-btn i');
        if (icon) {
            icon.classList.toggle('fa-toggle-on', newIsEnabled);
            icon.classList.toggle('text-green-500', newIsEnabled);
            icon.classList.toggle('fa-toggle-off', !newIsEnabled);
            icon.classList.toggle('text-gray-500', !newIsEnabled);
            icon.closest('button').title = `点击${newIsEnabled ? '禁用' : '启用'}`;
        }
        showToast(`代理已${newIsEnabled ? '启用' : '禁用'}`, 'success');
        await window.proxyAPI.setProxy(newIsEnabled ? proxyId : null);
    } catch (error) {
        console.error(`切换代理 ${proxyId} 启用状态失败:`, error);
        showToast(`操作失败: ${error.message}`, 'error');
    }
}

// 处理单个代理测试
async function handleSingleTest(proxyId, rowElement) {
    showToast(`开始测试代理 ${proxyId}...`, 'info');
    try {
        await window.proxyAPI.testProxies([proxyId]);
    } catch (error) {
        console.error(`测试代理 ${proxyId} 失败:`, error);
        showToast(`发起测试失败: ${error.message}`, 'error');
    }
}

// 处理编辑代理
async function handleEditProxy(proxyId) {
    try {
        const proxyData = await window.dbAPI.getProxyById(proxyId);
        if (!proxyData) {
            showToast('找不到要编辑的代理信息', 'error');
            return;
        }
        openProxyModal(proxyData);
    } catch (error) {
        console.error(`获取代理 ${proxyId} 信息失败:`, error);
        showToast('加载编辑信息失败', 'error');
    }
}

// 处理删除代理
function handleDeleteProxy(proxyId, rowElement, loadProxies) {
    showModal('tpl-confirm-dialog', (modalElement) => {
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        const titleElement = modalElement.querySelector('.modal-title');

        if (!messageElement || !confirmBtn || !titleElement) {
            console.error("确认对话框元素缺失");
            hideModal();
            return;
        }

        titleElement.textContent = '确认删除代理';
        messageElement.textContent = `确定要删除代理 ${proxyId} 吗？此操作不可撤销。`;
        confirmBtn.textContent = '确认删除';
        confirmBtn.classList.add('btn-danger');

        const handleConfirm = async () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 删除中...';

            try {
                await window.dbAPI.deleteProxy(proxyId);
                hideModal();
                showToast(`代理 ${proxyId} 已删除`, 'success');
                // 刷新列表
                if (typeof loadProxies === 'function') {
                    loadProxies();
                }
            } catch (error) {
                console.error(`删除代理 ${proxyId} 失败:`, error);
                showToast(`删除失败: ${error.message}`, 'error');
                confirmBtn.disabled = false;
                confirmBtn.textContent = '重试删除';
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
    });
}

// 处理批量测试
async function handleBulkTestClick(loadProxies) {
    const selectedIds = getSelectedProxyIds();
    if (selectedIds.length === 0) {
        showToast('请先选择要测试的代理配置', 'warning');
        return;
    }
    showToast(`开始测试 ${selectedIds.length} 个代理...`, 'info');
    try {
        await window.proxyAPI.testProxies(selectedIds);
    } catch (error) {
        console.error('批量测试代理失败:', error);
        showToast(`发起批量测试失败: ${error.message}`, 'error');
    }
}

// 处理批量删除
async function handleBulkDeleteClick(loadProxies) {
    const selectedIds = getSelectedProxyIds();
    const count = selectedIds.length;
    
    if (count === 0) {
        showToast('请先选择要删除的代理', 'warning');
        return;
    }

    showModal('tpl-confirm-dialog', (modalElement) => {
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        const titleElement = modalElement.querySelector('.modal-title');

        if (!messageElement || !confirmBtn || !titleElement) {
            console.error("确认对话框元素缺失");
            hideModal();
            return;
        }

        titleElement.textContent = '确认批量删除';
        messageElement.textContent = `确定要删除选中的 ${count} 个代理吗？此操作不可撤销。`;
        confirmBtn.textContent = `确认删除 (${count})`;
        confirmBtn.classList.add('btn-danger');

        const handleConfirm = async () => {
            confirmBtn.removeEventListener('click', handleConfirm);
            confirmBtn.disabled = true;
            confirmBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 删除中...';

            try {
                const result = await window.dbAPI.deleteProxiesByIds(selectedIds);
                hideModal();
                showToast(`成功删除 ${result.deletedCount} 个代理`, 'success');
                // 刷新列表
                if (typeof loadProxies === 'function') {
                    loadProxies();
                }
            } catch (error) {
                console.error('批量删除失败:', error);
                showToast(`删除失败: ${error.message}`, 'error');
                confirmBtn.disabled = false;
                confirmBtn.textContent = `重试删除 (${count})`;
            }
        };

        confirmBtn.addEventListener('click', handleConfirm);
    });
}

// 监听测试结果
export function listenForTestResults(updateRow) {
    window.proxyAPI.onTestResult((result) => {
        console.log('Received test result:', result);
        const { proxyId, success, data } = result;
        const row = elements.tableBody.querySelector(`tr[data-proxy-id="${proxyId}"]`);
        if (row) {
            if (success && data) {
                updateRow(row, data);
            } else {
                const statusText = data?.status || '不可用';
                const statusCell = row.querySelector('td[data-field="status"] span');
                if (statusCell) {
                    statusCell.textContent = statusText;
                    statusCell.className = `status ${statusText === '可用' ? 'available' : 'unavailable'}`;
                }
            }
        }
    });
} 