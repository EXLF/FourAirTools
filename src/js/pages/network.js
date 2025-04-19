// ================= 网络（IP 代理）页面初始化 =================

import { setupTableActions, setupFilteringAndSearch, setupCheckAll } from '../components/tableHelper.js';

/**
 * 初始化网络（IP 代理）页面。
 * 设置表格操作、筛选和全选功能。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initNetworkPage(contentArea) {
    console.log("Initializing Network Page...");

    setupTableActions(contentArea, '.data-table', handleNetworkAction);
    setupFilteringAndSearch(contentArea, '.filters-bar', '.data-table tbody tr', filterNetworkRow);
    setupCheckAll(contentArea, '.data-table');

    const addBtn = contentArea.querySelector('.header-actions .btn-primary');
    if(addBtn) {
        addBtn.addEventListener('click', () => alert('添加代理配置 (未实现)'));
    }

    const testBtn = contentArea.querySelector('.header-actions .btn-secondary');
     if(testBtn) {
        testBtn.addEventListener('click', () => {
             const checkedRows = contentArea.querySelectorAll('.data-table tbody input[type="checkbox"]:checked');
             if (checkedRows.length === 0) {
                 alert("请先选择要测试的代理配置！");
                 return;
             }
            alert(`开始测试选中的 ${checkedRows.length} 个代理的连通性 (未实现)`);
        });
    }
}

/**
 * 处理网络表格行内的操作按钮点击。
 * @param {string} action - 操作名称（例如，'编辑', '删除', '测试'）。
 * @param {HTMLElement} rowElement - 表格行元素。
 * @param {Array<string>} rowData - 行单元格文本内容的数组。
 */
function handleNetworkAction(action, rowElement, rowData) {
    const name = rowData[1]; // 假设名称/标识符是第二列
    alert(`网络配置操作: "${action}" on ${name} (未实现)`);

    if (action === '删除') {
        if (confirm(`确定删除配置 ${name}?`)) {
            rowElement.remove();
            // TODO: 添加持久化删除的逻辑
        }
    } else if (action === '测试') {
        // TODO: 实现单个代理测试逻辑
    }
}

/**
 * 网络表格行的筛选函数。
 * 当前仅按搜索词筛选。
 * @param {HTMLElement} rowElement - 表格行元素。
 * @param {object} filterValues - 包含筛选值的对象（例如，filterValues.search）。
 * @returns {boolean} - 如果应显示该行，则为 true。
 */
function filterNetworkRow(rowElement, filterValues) {
     // 假设单元格顺序：复选框、名称、类型、地址、端口、用户、状态、分组
     const searchContent = Array.from(rowElement.cells)
                            .slice(1, -1) // 排除复选框和操作单元格
                            .map(c => c.textContent.toLowerCase())
                            .join(' ');
     const type = rowElement.cells[2]?.textContent.toLowerCase() || '';
     const group = rowElement.cells[7]?.textContent.toLowerCase() || ''; // 如果需要，调整索引

     // TODO: 如果下拉选择框有 ID，则获取实际的筛选值
     // const typeFilter = filterValues['network-type-filter'] || '';
     // const groupFilter = filterValues['network-group-filter'] || '';

     const searchMatch = !filterValues.search || searchContent.includes(filterValues.search);
     // const typeMatch = !typeFilter || type.includes(typeFilter);
     // const groupMatch = !groupFilter || group.includes(groupFilter);

     // return searchMatch && typeMatch && groupMatch;
     return searchMatch;
}