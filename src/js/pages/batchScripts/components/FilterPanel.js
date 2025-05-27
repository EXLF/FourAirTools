/**
 * 筛选面板组件
 */

import { setupFilteringAndSearch } from '../../../components/tableHelper.js';

/**
 * 创建筛选面板HTML
 * @param {Object} options - 配置选项
 * @returns {string} HTML字符串
 */
export function createFilterPanelHTML(options = {}) {
    const {
        showSearch = true,
        showStatusFilter = true,
        searchPlaceholder = '搜索脚本插件...'
    } = options;
    
    return `
        <div class="scripts-filter-bar">
            ${showSearch ? `
                <div class="search-box">
                    <input type="text" id="batchScriptSearchInput" class="table-search-input" placeholder="${searchPlaceholder}">
                    <i class="fas fa-search"></i>
                </div>
            ` : ''}
            <div class="filter-actions">
                ${showStatusFilter ? `
                    <select id="batchScriptStatusFilter" class="select-filter">
                        <option value="">全部状态</option>
                        <option value="active">可用</option>
                    </select>
                ` : ''}
            </div>
        </div>
    `;
}

/**
 * 设置筛选功能
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export function setupFilteringFunction(contentArea) {
    const searchInput = contentArea.querySelector('#batchScriptSearchInput');
    const statusFilter = contentArea.querySelector('#batchScriptStatusFilter');
    const cardsGrid = contentArea.querySelector('#batchScriptCardsContainer');
    
    if (!searchInput || !statusFilter || !cardsGrid) return;
    
    setupFilteringAndSearch(
        contentArea,
        '.scripts-filter-bar',
        '.script-card',
        (card, filters) => {
            const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
            const description = card.querySelector('.card-description')?.textContent.toLowerCase() || '';
            const status = card.dataset.status?.toLowerCase() || '';
            
            const searchTerm = filters.search || '';
            if (searchTerm && !title.includes(searchTerm) && !description.includes(searchTerm)) return false;
            if (filters.batchScriptStatusFilter && filters.batchScriptStatusFilter !== '' && status !== filters.batchScriptStatusFilter) return false;
            return true;
        }
    );
}

/**
 * 填充筛选器选项
 * @param {HTMLSelectElement} statusFilterElement - 状态筛选下拉框
 * @param {Array} scriptData - 脚本数据数组
 */
export function populateFilters(statusFilterElement, scriptData) {
    if (!statusFilterElement) return;
    
    const statuses = new Set();
    scriptData.forEach(script => {
        if (script.status) statuses.add(script.status);
    });
    
    statusFilterElement.innerHTML = '<option value="">全部状态</option>';
    statuses.forEach(status => {
        const option = document.createElement('option');
        option.value = status.toLowerCase();
        option.textContent = status === 'active' ? '可用' : 
                             status === 'coming' ? '即将推出' : 
                             status === 'deprecated' ? '已弃用' : status;
        statusFilterElement.appendChild(option);
    });
} 