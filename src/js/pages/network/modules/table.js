// 表格渲染和更新模块

import { elements } from './dom.js';
import { getLatencyClass, getRiskClass, getStatusClass } from './utils.js';
import { translateLocation } from '../../../utils/locationTranslator.js';

// 渲染表格内容
export function renderTable(proxies) {
    elements.tableBody.innerHTML = '';
    if (proxies.length === 0) {
        elements.tableBody.innerHTML = '<tr><td colspan="11" class="text-center p-4">未找到符合条件的代理配置。</td></tr>';
        // 重置全选框
        if (elements.selectAllCheckbox) {
            elements.selectAllCheckbox.checked = false;
            elements.selectAllCheckbox.indeterminate = false;
        }
        return;
    }

    proxies.forEach(proxy => {
        const row = document.createElement('tr');
        row.dataset.proxyId = proxy.id;
        row.classList.add('data-table');
        row.classList.toggle('enabled', proxy.is_enabled === 1);

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
        elements.tableBody.appendChild(row);
    });
    
    // 表格渲染完成后，初始化复选框事件监听
    initRowCheckboxListeners();
    
    // 重置全选框状态
    updateSelectAllCheckboxState();
}

// 初始化行复选框事件监听器
function initRowCheckboxListeners() {
    const rowCheckboxes = elements.tableBody.querySelectorAll('input.row-checkbox');
    rowCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const row = this.closest('tr');
            row.classList.toggle('selected', this.checked);
            
            // 更新全选框状态
            updateSelectAllCheckboxState();
            
            // 触发自定义事件，通知行选择状态改变
            const event = new CustomEvent('row-selection-change', {
                detail: { 
                    row,
                    checked: checkbox.checked 
                },
                bubbles: true
            });
            elements.tableBody.dispatchEvent(event);
        });
    });
}

// 更新行状态
export function updateRowStatus(rowElement, statusText) {
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
    if (testBtn) {
        const isTesting = (statusText === '测试中');
        testBtn.disabled = isTesting;
        testBtn.innerHTML = isTesting ? '<i class="fa fa-spinner fa-spin"></i>' : '<i class="fa fa-plug"></i>';
    }
}

// 批量更新行状态
export function updateRowsStatus(proxyIds, statusText) {
    proxyIds.forEach(id => {
        const row = elements.tableBody.querySelector(`tr[data-proxy-id="${id}"]`);
        if (row) {
            updateRowStatus(row, statusText);
        }
    });
}

// 更新单行数据
export function updateRow(rowElement, proxy) {
    const fullLocation = [proxy.country, proxy.region, proxy.city].filter(Boolean).join(', ');
    const location = translateLocation(fullLocation);
    const riskClass = getRiskClass(proxy.risk_level);
    const risk = proxy.risk_level ? `<span class="${riskClass}">${proxy.risk_level} (${proxy.risk_score ?? '?'})</span>` : '<span class="risk-unknown">未知</span>';
    const latencyClass = getLatencyClass(proxy.latency);
    const latency = proxy.latency !== null && proxy.latency !== undefined ? `<span class="${latencyClass}">${proxy.latency}ms</span>` : '-';
    const statusClass = getStatusClass(proxy.status);
    const isEnabled = proxy.is_enabled === 1;

    rowElement.classList.toggle('enabled', isEnabled);

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
    locationCell.title = fullLocation;
    rowElement.querySelector('td[data-field="risk"]').innerHTML = risk;

    const testBtn = rowElement.querySelector('.test-btn');
    if (testBtn) {
        testBtn.disabled = false;
        testBtn.innerHTML = '<i class="fa fa-plug"></i>';
    }
}

// 更新全选复选框状态
export function updateSelectAllCheckboxState() {
    const checkbox = elements.selectAllCheckbox;
    if (!checkbox) return;
    
    const allRows = elements.tableBody.querySelectorAll('input.row-checkbox');
    const selectedRows = elements.tableBody.querySelectorAll('input.row-checkbox:checked');
    
    if (allRows.length === 0) {
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } else if (selectedRows.length === 0) {
        // 没有选中时，全选框不勾选
        checkbox.checked = false;
        checkbox.indeterminate = false;
    } else if (selectedRows.length === allRows.length) {
        // 全部选中时，全选框勾选
        checkbox.checked = true;
        checkbox.indeterminate = false;
    } else {
        // 部分选中时，全选框显示横线
        checkbox.checked = false;
        checkbox.indeterminate = true;
    }
} 