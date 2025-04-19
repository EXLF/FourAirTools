import { setupFilteringAndSearch, setupCheckAll } from '../components/tableHelper.js';
// 这个简单的显示表格暂时不需要表格操作

/**
 * 初始化社交账户页面。
 * 设置筛选、全选和头部按钮。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initSocialPage(contentArea) {
    console.log("正在初始化社交账户页面..."); // 控制台日志也中文化

    // 设置筛选（平台按钮、分组选择、搜索输入）
    // 注意：setupFilteringAndSearch 根据 'platform-filter-btn' 类和 data-platform 属性处理平台按钮逻辑
    setupFilteringAndSearch(contentArea, '.filters-bar', '.social-table tbody tr', filterSocialRow);
    setupCheckAll(contentArea, '.social-table');

    // 为头部按钮添加监听器
    const addBtn = contentArea.querySelector('.header-actions .btn-primary');
    const importBtn = contentArea.querySelector('.header-actions .btn-secondary:nth-of-type(1)'); // 批量导入
    const exportBtn = contentArea.querySelector('.header-actions .btn-secondary:nth-of-type(2)'); // 导出选中

    if (addBtn) {
        addBtn.addEventListener('click', () => alert('添加账户 (未实现)'));
    }
    if (importBtn) {
        importBtn.addEventListener('click', () => alert('批量导入 (未实现)'));
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            const checkedRows = contentArea.querySelectorAll('.social-table tbody input[type="checkbox"]:checked');
            if (checkedRows.length === 0) {
                alert("请先选择要导出的账户！");
                return;
            }
            alert(`导出选中的 ${checkedRows.length} 个账户 (未实现)`);
        });
    }
}

/**
 * 社交账户表格行的筛选函数。
 * @param {HTMLElement} rowElement - 表格行元素。
 * @param {object} filterValues - 包含筛选值的对象。
 *                                  例如：{ search: '...', platform: 'twitter', 'social-group-filter': 'group-a' }
 * @returns {boolean} - 如果行应该显示，则返回 true。
 */
function filterSocialRow(rowElement, filterValues) {
    // 从行中提取数据
    const cells = rowElement.cells;
    const platformIconClass = cells[1]?.querySelector('i')?.className || ''; // 例如：'fab fa-twitter'
    const platform = platformIconClass.includes('fa-twitter') ? 'twitter'
                   : platformIconClass.includes('fa-discord') ? 'discord'
                   : platformIconClass.includes('fa-telegram') ? 'telegram'
                   : platformIconClass.includes('fa-envelope') ? 'email'
                   : '';
    const username = cells[2]?.textContent.toLowerCase() || '';
    const emailPhone = cells[3]?.textContent.toLowerCase() || '';
    const notes = cells[4]?.textContent.toLowerCase() || '';
    const group = cells[5]?.textContent.toLowerCase() || '';

    const searchContent = `${platform} ${username} ${emailPhone} ${notes} ${group}`;

    // 获取筛选值
    const platformFilter = filterValues.platform || ''; // 来自平台按钮
    const groupFilter = filterValues['social-group-filter'] || ''; // 来自选择框
    const searchTerm = filterValues.search || '';

    // 应用筛选器
    const platformMatch = !platformFilter || platform === platformFilter;
    const groupMatch = !groupFilter || group.includes(groupFilter); // 假设分组允许部分匹配
    const searchMatch = !searchTerm || searchContent.includes(searchTerm);

    return platformMatch && groupMatch && searchMatch;
}