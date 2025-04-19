import { setupFilteringAndSearch, setupCheckAll } from '../components/tableHelper.js';
// No table actions needed for this simple display table yet

/**
 * Initializes the Social Accounts page.
 * Sets up filtering, check-all, and header buttons.
 * @param {HTMLElement} contentArea - The main content area to work within.
 */
export function initSocialPage(contentArea) {
    console.log("Initializing Social Accounts Page...");

    // Setup filtering (platform buttons, group select, search input)
    // Note: setupFilteringAndSearch handles the platform buttons logic based on 'platform-filter-btn' class and data-platform attribute
    setupFilteringAndSearch(contentArea, '.filters-bar', '.social-table tbody tr', filterSocialRow);
    setupCheckAll(contentArea, '.social-table');

    // Add listeners for header buttons
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
 * Filter function for social account table rows.
 * @param {HTMLElement} rowElement - The table row element.
 * @param {object} filterValues - Object containing filter values.
 *                                  e.g., { search: '...', platform: 'twitter', 'social-group-filter': 'group-a' }
 * @returns {boolean} - True if the row should be shown.
 */
function filterSocialRow(rowElement, filterValues) {
    // Extract data from the row
    const cells = rowElement.cells;
    const platformIconClass = cells[1]?.querySelector('i')?.className || ''; // e.g., 'fab fa-twitter'
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

    // Get filter values
    const platformFilter = filterValues.platform || ''; // From platform buttons
    const groupFilter = filterValues['social-group-filter'] || ''; // From select
    const searchTerm = filterValues.search || '';

    // Apply filters
    const platformMatch = !platformFilter || platform === platformFilter;
    const groupMatch = !groupFilter || group.includes(groupFilter); // Assuming partial match for group is okay
    const searchMatch = !searchTerm || searchContent.includes(searchTerm);

    return platformMatch && groupMatch && searchMatch;
} 