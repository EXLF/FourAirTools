import { debounce } from '../../utils/index.js';
import { showToast } from '../../components/toast.js';
import { handleSocialAccountAction } from './actions.js'; // Import action handler

// --- Module Variables (Cached Elements & State) ---
let contentAreaCache = null;
let tableBody = null;
let paginationControls = null;
let pageSizeContainer = null;
let groupFilterSelect = null;
let searchInput = null;

let currentPage = 1;
let itemsPerPage = 10; // Default, will be overwritten by localStorage
let totalItems = 0;
let currentFilters = { platform: null, groupId: null, search: '' }; // Store filters

const LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL = 'socialPage_rowsPerPage';

// --- Initialization ---

/**
 * Initializes the social accounts table module.
 * Caches elements, sets up listeners, loads initial data.
 * @param {HTMLElement} contentArea - The main content area for the social page.
 */
export function initSocialTable(contentArea) {
    contentAreaCache = contentArea;

    // Cache main elements
    tableBody = contentArea.querySelector('.social-table tbody');
    paginationControls = contentArea.querySelector('.pagination');
    pageSizeContainer = contentArea.querySelector('.page-size-selector');
    groupFilterSelect = contentArea.querySelector('#social-group-filter');
    searchInput = contentArea.querySelector('.table-search-input');

    if (!tableBody || !paginationControls || !pageSizeContainer || !groupFilterSelect || !searchInput) {
        console.error("Social table init failed: Required elements not found in the template.");
        // Display an error message to the user maybe?
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500 p-4">页面模板加载不完整，无法初始化表格。</td></tr>';
        return;
    }

    // Load itemsPerPage from localStorage
    const savedRowsPerPage = localStorage.getItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL);
    if (savedRowsPerPage) {
        const parsedSize = parseInt(savedRowsPerPage, 10);
        const validOptions = [5, 10, 15, 25, 50, 100];
        if (validOptions.includes(parsedSize)) {
            itemsPerPage = parsedSize;
        } else {
            itemsPerPage = 10; // Reset if invalid
            localStorage.removeItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL);
        }
    } else {
        itemsPerPage = 10; // Default
    }

    // Setup UI components and listeners
    createPageSizeSelector(); // Needs to run before first load if it influences itemsPerPage
    setupPlatformFilterListeners();
    setupGroupFilterListener();
    setupSearchListener();
    setupTableRowClickListener(); // Setup row click for checkbox toggle

    // Load initial data and filters
    loadGroupFiltersForSocial(); // Load group options first
    loadAndRenderSocialAccounts(); // Then load the table data
}

// --- Data Loading & Rendering ---

/**
 * Loads and renders social accounts data into the table.
 * Handles pagination and filtering.
 * @param {number} page - The page number to load.
 * @param {number} limit - The number of items per page.
 * @param {object} filters - The filter criteria.
 */
export async function loadAndRenderSocialAccounts(page = currentPage, limit = itemsPerPage, filters = currentFilters) {
    console.log(`Loading social accounts: Page ${page}, Limit ${limit}, Filters:`, filters);
    if (!tableBody || !window.dbAPI) {
        console.error("Table body or dbAPI not ready.");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-red-500 p-4">无法加载数据：组件或数据库接口未就绪。</td></tr>';
        return;
    }

    tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4"><i class="fas fa-spinner fa-spin mr-2"></i>正在加载...</td></tr>';

    try {
        const queryOptions = {
            page: page,
            limit: limit,
            ...filters
        };

        const result = await window.dbAPI.getSocialAccounts(queryOptions);
        const accounts = result.accounts;
        totalItems = result.totalCount;
        currentPage = page; // Update current page state

        tableBody.innerHTML = ''; // Clear loading indicator

        if (!accounts || accounts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" class="text-center p-4">暂无社交账户数据。</td></tr>';
        } else {
            accounts.forEach(account => {
                const row = createSocialAccountRowElement(account);
                tableBody.appendChild(row);
            });
            // Re-setup check all after rendering rows
            setupCheckAll(contentAreaCache, '.social-table');
        }

        renderPagination(totalItems, itemsPerPage, currentPage);

    } catch (error) {
        console.error("Failed to load social accounts data:", error);
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 p-4">加载数据失败: ${error.message}</td></tr>`;
    }
}

/**
 * Creates a table row (<tr>) element for a social account.
 * @param {object} account - The social account data object.
 * @returns {HTMLTableRowElement} The created table row element.
 */
function createSocialAccountRowElement(account) {
    const row = document.createElement('tr');
    row.dataset.accountId = account.id; // Store ID for actions

    let platformIconClass = 'fas fa-question-circle';
    let platformColor = '#6c757d';
    switch (account.platform?.toLowerCase()) {
        case 'twitter': platformIconClass = 'fab fa-twitter'; platformColor = '#1DA1F2'; break;
        case 'discord': platformIconClass = 'fab fa-discord'; platformColor = '#5865F2'; break;
        case 'telegram': platformIconClass = 'fab fa-telegram'; platformColor = '#2AABEE'; break;
        case 'email': platformIconClass = 'fas fa-envelope'; platformColor = '#DB4437'; break; // Using generic envelope
        // Add other platforms as needed
    }

    const groupNameText = account.groupName || '无分组';

    row.innerHTML = `
        <td><input type="checkbox" class="row-checkbox form-checkbox h-4 w-4 text-blue-600" value="${account.id}"></td>
        <td><i class="${platformIconClass}" style="color: ${platformColor}; font-size: 1.2em; vertical-align: middle;"></i> ${account.platform || ''}</td>
        <td>${account.username || ''}</td>
        <td>${account.binding || '-'}</td>
        <td>${account.notes || '-'}</td>
        <td>${groupNameText}</td>
        <td>
            <button class="btn-icon action-btn" data-action="edit" title="编辑"><i class="fas fa-pencil-alt"></i></button>
            <button class="btn-icon action-btn" data-action="delete" title="删除"><i class="fas fa-trash-alt"></i></button>
        </td>
    `;

    // Attach listeners directly here
    const editBtn = row.querySelector('[data-action="edit"]');
    const deleteBtn = row.querySelector('[data-action="delete"]');

    if (editBtn) {
        editBtn.addEventListener('click', (e) => {
             e.stopPropagation(); // Prevent row click toggle
             handleSocialAccountAction('edit', account.id);
        });
    }
    if (deleteBtn) {
         deleteBtn.addEventListener('click', (e) => {
             e.stopPropagation(); // Prevent row click toggle
             handleSocialAccountAction('delete', account.id);
        });
    }

    return row;
}

// --- Pagination ---

/**
 * Creates and configures the page size selector dropdown.
 */
function createPageSizeSelector() {
    if (!pageSizeContainer) return;
    pageSizeContainer.innerHTML = ''; // Clear previous content

    const label = document.createElement('span');
    label.textContent = '每页显示: ';
    label.style.marginRight = '8px';

    const select = document.createElement('select');
    select.style.cssText = 'padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;'; // 应用和钱包页面一致的内联样式

    const options = [5, 10, 15, 25, 50, 100];
    options.forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size}条`;
        if (size === itemsPerPage) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    select.addEventListener('change', async () => {
        const newSize = parseInt(select.value);
        if (newSize !== itemsPerPage) {
            itemsPerPage = newSize;
            currentPage = 1; // Reset to first page on size change
            localStorage.setItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL, newSize.toString());
            await loadAndRenderSocialAccounts();
        }
    });

    pageSizeContainer.appendChild(label);
    pageSizeContainer.appendChild(select);
}

/**
 * Renders the pagination controls based on total items and current state.
 * @param {number} totalItems - Total number of items.
 * @param {number} itemsPerPage - Items displayed per page.
 * @param {number} currentPage - The currently active page.
 */
function renderPagination(totalItems, itemsPerPage, currentPage) {
    if (!paginationControls) return;
    paginationControls.innerHTML = ''; // Clear previous controls

    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Page Info (e.g., "1/10页 共95条")
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info text-sm text-gray-600 mr-4';
    pageInfo.textContent = `${Math.max(1, currentPage)}/${Math.max(1, totalPages)}页 共${totalItems}条`;
    paginationControls.appendChild(pageInfo);

    if (totalPages <= 1) return; // No buttons needed for single page

    // Button creation helper
    const createButton = (text, pageNum, isDisabled = false, isActive = false) => {
        const button = document.createElement('button');
        button.innerHTML = text;
        button.disabled = isDisabled;
        button.className = `px-3 py-1 border rounded-md text-sm mx-1 ${isActive ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`;
        if (!isDisabled && pageNum) {
            button.addEventListener('click', () => loadAndRenderSocialAccounts(pageNum));
        }
        return button;
    };

    // Previous Button
    paginationControls.appendChild(createButton('&laquo;', currentPage - 1, currentPage === 1));

    // Page Number Buttons (with ellipsis)
    const maxPagesToShow = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
    let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
    if (endPage - startPage + 1 < maxPagesToShow) {
        startPage = Math.max(1, endPage - maxPagesToShow + 1);
    }

    if (startPage > 1) {
        paginationControls.appendChild(createButton('1', 1));
        if (startPage > 2) {
             const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; ellipsis.className = 'px-2 py-1 text-sm'; paginationControls.appendChild(ellipsis);
        }
    }

    for (let i = startPage; i <= endPage; i++) {
        paginationControls.appendChild(createButton(i.toString(), i, false, i === currentPage));
    }

     if (endPage < totalPages) {
         if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; ellipsis.className = 'px-2 py-1 text-sm'; paginationControls.appendChild(ellipsis);
         }
        paginationControls.appendChild(createButton(totalPages.toString(), totalPages));
    }

    // Next Button
    paginationControls.appendChild(createButton('&raquo;', currentPage + 1, currentPage === totalPages));
}


// --- Filtering & Searching ---

/**
 * Sets up event listeners for platform filter buttons.
 */
function setupPlatformFilterListeners() {
    const platformButtons = contentAreaCache?.querySelectorAll('.platform-filter-btn');
    if (!platformButtons) return;

    platformButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const platform = button.dataset.platform;

            // Toggle active state
            platformButtons.forEach(btn => btn.classList.remove('active')); // Use your active class
            button.classList.add('active');

            currentFilters.platform = platform || null; // null or empty string means 'all'
            currentPage = 1; // Reset page
            await loadAndRenderSocialAccounts();
        });
    });
}

/**
 * Sets up the event listener for the group filter dropdown.
 */
function setupGroupFilterListener() {
    if (!groupFilterSelect) return;
    groupFilterSelect.addEventListener('change', async () => {
        const selectedGroupId = groupFilterSelect.value;
        currentFilters.groupId = selectedGroupId ? parseInt(selectedGroupId) : null;
        currentPage = 1;
        await loadAndRenderSocialAccounts();
    });
}

/**
 * Loads group data and populates the group filter dropdown.
 * Exported so modals.js can call it after adding a group.
 */
export async function loadGroupFiltersForSocial() {
    if (!groupFilterSelect) {
        console.warn("Group filter select element not found.");
        return;
    }
    const currentValue = groupFilterSelect.value; // Preserve selection if possible

    try {
        const groups = await window.dbAPI.getGroups();
        groupFilterSelect.innerHTML = '<option value="">所有分组</option>'; // Default "All"
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupFilterSelect.appendChild(option);
        });
        // Restore previous selection if it still exists
        if (Array.from(groupFilterSelect.options).some(opt => opt.value === currentValue)) {
             groupFilterSelect.value = currentValue;
        }
    } catch (error) {
        console.error("Failed to load groups for filter:", error);
        groupFilterSelect.innerHTML = '<option value="">加载分组筛选选项失败</option>';
        showToast('加载分组筛选选项失败', 'error');
    }
}

/**
 * Sets up the search input listener with debounce.
 */
function setupSearchListener() {
    if (!searchInput) return;

    const debouncedSearch = debounce(async () => {
        currentFilters.search = searchInput.value.trim();
        currentPage = 1;
        await loadAndRenderSocialAccounts();
    }, 300); // 300ms debounce

    searchInput.addEventListener('input', debouncedSearch);
}

// --- Table Interaction ---

/**
 * Sets up click listener on table rows to toggle the checkbox.
 */
function setupTableRowClickListener() {
    if (!tableBody) return;
    tableBody.addEventListener('click', (event) => {
        const target = event.target;
        const row = target.closest('tr');
        // Ensure it's a valid row with an ID and not a click on an interactive element
        if (!row || !row.dataset.accountId || target.closest('button, a, input, select')) {
            return;
        }

        // Find the checkbox and toggle it
        const checkbox = row.querySelector('.row-checkbox');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            // Dispatch change event for checkAll functionality
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            // Update row selection visual style if needed
             row.classList.toggle('selected', checkbox.checked); // Add a 'selected' class maybe
        }
    });
}

/**
 * Gets the IDs of the currently selected social accounts in the table.
 * @returns {number[]} An array of selected account IDs.
 */
export function getSelectedSocialAccountIds() {
    if (!tableBody) {
        console.error("Cannot get selected IDs: Table body not initialized.");
        return [];
    }
    const selectedCheckboxes = tableBody.querySelectorAll('input.row-checkbox:checked');
    return Array.from(selectedCheckboxes)
        .map(cb => parseInt(cb.value, 10))
        .filter(id => !isNaN(id)); // Filter out potential NaN values
}


// --- Check All Functionality (Adapted from tableHelper.js - needs to live here or be imported carefully) ---
// For simplicity, copying the logic here. Consider a shared component if used elsewhere.

let selectAllCheckbox = null;

/**
 * Sets up the "Select All" checkbox functionality for a table.
 * @param {HTMLElement} container - The container element holding the table and checkbox.
 * @param {string} tableSelector - CSS selector for the table element.
 */
function setupCheckAll(container, tableSelector) {
    selectAllCheckbox = container.querySelector('.select-all-checkbox');
    const table = container.querySelector(tableSelector);
    const tbody = table?.querySelector('tbody');

    if (!selectAllCheckbox || !tbody) {
        // console.warn("Select All checkbox or table body not found for selector:", tableSelector);
        return; // Silently return if elements aren't present (might be intentional for some pages)
    }

    // Clear previous listeners to prevent duplicates if called multiple times
    const newSelectAllCheckbox = selectAllCheckbox.cloneNode(true);
    selectAllCheckbox.parentNode.replaceChild(newSelectAllCheckbox, selectAllCheckbox);
    selectAllCheckbox = newSelectAllCheckbox;

    const handleSelectAllChange = () => {
        const rowCheckboxes = tbody.querySelectorAll('input.row-checkbox');
        rowCheckboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
            // Optionally update row style
             checkbox.closest('tr')?.classList.toggle('selected', checkbox.checked);
        });
    };

    const handleRowCheckboxChange = () => {
        const rowCheckboxes = tbody.querySelectorAll('input.row-checkbox');
        const totalRows = rowCheckboxes.length;
        const checkedRows = tbody.querySelectorAll('input.row-checkbox:checked').length;

        if (totalRows > 0) {
            selectAllCheckbox.checked = checkedRows === totalRows;
            selectAllCheckbox.indeterminate = checkedRows > 0 && checkedRows < totalRows;
        } else {
             selectAllCheckbox.checked = false;
             selectAllCheckbox.indeterminate = false;
        }
         // Update row style
         rowCheckboxes.forEach(checkbox => {
            checkbox.closest('tr')?.classList.toggle('selected', checkbox.checked);
         });
    };

    selectAllCheckbox.addEventListener('change', handleSelectAllChange);

    // Use event delegation on tbody for row checkboxes
    tbody.removeEventListener('change', handleRowCheckboxChangeDelegated); // Remove previous listener if any
    tbody.addEventListener('change', handleRowCheckboxChangeDelegated);
}

// Delegated handler for row checkbox changes
function handleRowCheckboxChangeDelegated(event) {
     if (event.target.matches('input.row-checkbox')) {
        const tbody = event.currentTarget; // tbody is where the listener is attached
        const rowCheckboxes = tbody.querySelectorAll('input.row-checkbox');
        const totalRows = rowCheckboxes.length;
        const checkedRows = tbody.querySelectorAll('input.row-checkbox:checked').length;

        if (selectAllCheckbox) { // Ensure selectAllCheckbox is available
             if (totalRows > 0) {
                selectAllCheckbox.checked = checkedRows === totalRows;
                selectAllCheckbox.indeterminate = checkedRows > 0 && checkedRows < totalRows;
            } else {
                 selectAllCheckbox.checked = false;
                 selectAllCheckbox.indeterminate = false;
            }
        }
         // Update row style
        event.target.closest('tr')?.classList.toggle('selected', event.target.checked);
     }
 } 