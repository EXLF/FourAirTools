import { setupTableActions, setupFilteringAndSearch, setupCheckAll } from '../components/tableHelper.js';
// import { truncateAddress } from '../utils/index.js'; // 可能需要用于某些操作

/**
 * Initializes the Wallets page.
 * Sets up table actions, filtering, check-all, and header buttons.
 * @param {HTMLElement} contentArea - The main content area to work within.
 */
export function initWalletsPage(contentArea) {
    console.log("Initializing Wallets Page...");

    // Setup interactive table elements
    setupTableActions(contentArea, '.wallet-table', handleWalletAction);
    setupFilteringAndSearch(contentArea, '.filters-bar', '.wallet-table tbody tr', filterWalletRow);
    setupCheckAll(contentArea, '.wallet-table');

    // Add listeners for header buttons
    const addBtn = contentArea.querySelector('.header-actions .btn-primary');
    const importBtn = contentArea.querySelector('.header-actions .btn-secondary:nth-of-type(1)'); // 导入
    const exportBtn = contentArea.querySelector('.header-actions .btn-secondary:nth-of-type(2)'); // 导出
    const manageGroupsBtn = contentArea.querySelector('.header-actions .btn-secondary:nth-of-type(3)'); // 管理分组

    if (addBtn) {
        addBtn.addEventListener('click', () => alert('添加钱包 (未实现)'));
    }
    if (importBtn) {
        importBtn.addEventListener('click', () => alert('导入钱包 (未实现)'));
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
             const checkedRows = contentArea.querySelectorAll('.wallet-table tbody input[type="checkbox"]:checked');
             if (checkedRows.length === 0) {
                 alert("请先选择要导出的钱包！");
                 return;
             }
             alert(`导出选中的 ${checkedRows.length} 个钱包 (未实现)`);
        });
    }
     if (manageGroupsBtn) {
        manageGroupsBtn.addEventListener('click', () => alert('管理分组 (未实现)'));
    }
}

/**
 * Handles action button clicks within the wallet table rows.
 * @param {string} action - The action name (e.g., '查看详情', '编辑', '删除').
 * @param {HTMLElement} rowElement - The table row element.
 * @param {Array<string>} rowData - Array of cell text content for the row.
 */
function handleWalletAction(action, rowElement, rowData) {
    // Assuming address/identifier is in the second column (index 1)
    const walletIdentifier = rowData[1];
    console.log(`Wallet action: "${action}" on ${walletIdentifier}`);
    alert(`钱包操作: "${action}" on ${walletIdentifier} (未实现)`);

    if (action === '删除') {
        if (confirm(`确定删除钱包 ${walletIdentifier}?`)) {
            rowElement.remove();
            // TODO: Add logic to persist deletion (e.g., update local storage or send API request)
             // Re-run checkAll status update if needed
             const table = rowElement.closest('.wallet-table');
             if(table) {
                 const checkAll = table.querySelector('thead input[type="checkbox"]');
                 if(checkAll) checkAll.dispatchEvent(new Event('change')); // Trigger checkall logic update indirectly
             }
        }
    } else if (action === '查看详情') {
        // TODO: Implement view details modal or panel
    } else if (action === '编辑') {
        // TODO: Implement edit modal or inline editing
    }
}

/**
 * Filter function for wallet table rows based on selected filters and search term.
 * @param {HTMLElement} rowElement - The table row element.
 * @param {object} filterValues - Object containing filter values from filter bar controls.
 *                                  e.g., { search: 'abc', 'wallet-chain-filter': 'eth', ... }
 * @returns {boolean} - True if the row should be shown, false otherwise.
 */
function filterWalletRow(rowElement, filterValues) {
     // Extract data from the row cells based on assumed column order
     // Checkbox, Address/ID, Chain, Type, Notes, Group, Balance, Tx, Backup, Risk, Actions
     const cells = rowElement.cells;
     const addressOrId = cells[1]?.textContent.toLowerCase() || '';
     const chain = cells[2]?.textContent.toLowerCase() || '';
     const type = cells[3]?.textContent.toLowerCase() || '';
     const notes = cells[4]?.textContent.toLowerCase() || '';
     const group = cells[5]?.textContent.toLowerCase() || '';

     // Combine searchable text content
     const searchContent = `${addressOrId} ${chain} ${type} ${notes} ${group}`;

     // Get filter values from the passed object (keys should match select IDs)
     const chainFilter = filterValues['wallet-chain-filter'] || '';
     const typeFilter = filterValues['wallet-type-filter'] || '';
     const groupFilter = filterValues['wallet-group-filter'] || '';
     const searchTerm = filterValues.search || ''; // search is added by setupFilteringAndSearch

     // Apply filters
     const searchMatch = !searchTerm || searchContent.includes(searchTerm);
     const chainMatch = !chainFilter || chain.includes(chainFilter.toLowerCase());
     // Adjust type matching if needed (e.g., '链上钱包' vs 'onchain')
     const typeMatch = !typeFilter || type.replace(/\s/g, '').includes(typeFilter.toLowerCase().replace(/\s/g, ''));
     const groupMatch = !groupFilter || group.includes(groupFilter.toLowerCase());

     // Return true only if all conditions are met
     return searchMatch && chainMatch && typeMatch && groupMatch;
} 