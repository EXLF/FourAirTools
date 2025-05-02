import { debounce } from '../../utils/index.js';
import { showToast } from '../../components/toast.js';
import { handleSocialAccountAction } from './actions.js'; // Import action handler

// --- Module Variables (Cached Elements & State) ---
let contentAreaCache = null;
let tableBody = null;
let tableHeader = null; // Cache the thead element
let paginationControls = null;
let pageSizeContainer = null;
let groupFilterSelect = null;
let searchInput = null;

let currentPage = 1;
let itemsPerPage = 10; // Default, will be overwritten by localStorage
let totalItems = 0;
// Default platform filter set during init
let currentFilters = { platform: 'twitter', groupId: null, search: '' };

const LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL = 'socialPage_rowsPerPage';

// Define sensitive fields to mask
const SENSITIVE_FIELDS = [
    'password',
    'twitter_2fa',
    'discord_password',
    'discord_token',
    'telegram_password',
    'telegram_login_api'
];

// Define fields considered sensitive for adding copy button
const SENSITIVE_FIELDS_FOR_COPY = [
    'password',
    'twitter_2fa',
    'discord_password',
    'discord_token',
    'telegram_password',
    'telegram_login_api'
];

// --- Platform Specific Column Definitions ---
const platformColumns = {
    twitter: [
        { header: '账户/邮箱', key: 'identifier' },
        { header: '密码', key: 'password', sensitive: true },
        { header: '推特邮箱', key: 'twitter_email' },
        { header: '推特辅助邮箱', key: 'twitter_recovery_email' },
        { header: '推特2FA', key: 'twitter_2fa', sensitive: true, truncatable: true },
        { header: '备注', key: 'notes' },
        { header: '分组', key: 'groupName' }
    ],
    discord: [
        { header: '账户/邮箱', key: 'identifier' },
        { header: '密码', key: 'discord_password', sensitive: true },
        { header: 'Token', key: 'discord_token', sensitive: true, truncatable: true },
        { header: '备注', key: 'notes' },
        { header: '分组', key: 'groupName' }
    ],
    telegram: [
        { header: '账户/邮箱', key: 'identifier' },
        { header: '密码', key: 'telegram_password', sensitive: true },
        { header: 'API信息', key: 'telegram_login_api', sensitive: true, truncatable: true },
        { header: '备注', key: 'notes' },
        { header: '分组', key: 'groupName' }
    ],
    email: [
        { header: '账户/邮箱', key: 'identifier' },
        { header: '密码', key: 'password', sensitive: true },
        { header: '备注', key: 'notes' },
        { header: '分组', key: 'groupName' }
    ]
};
// Define common columns to add at the start and end
const commonColumnsStart = [
    { header: '', key: 'checkbox', width: '3%' }, // Checkbox
    { header: '平台', key: 'platform' }         // Platform Icon/Name
];
const commonColumnsEnd = [
    { header: '操作', key: 'actions', width: '12%' } // Action buttons
];


// --- Initialization ---
export function initSocialTable(contentArea) {
    contentAreaCache = contentArea;

    const tableElement = contentArea.querySelector('.social-table');
    tableHeader = tableElement?.querySelector('thead'); // Cache thead
    tableBody = tableElement?.querySelector('tbody');
    paginationControls = contentArea.querySelector('.pagination');
    pageSizeContainer = contentArea.querySelector('.page-size-selector');
    groupFilterSelect = contentArea.querySelector('#social-group-filter');
    searchInput = contentArea.querySelector('.table-search-input');

    if (!tableHeader || !tableBody || !paginationControls || !pageSizeContainer || !groupFilterSelect || !searchInput) {
        console.error("Social table init failed: Required elements not found.");
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="1" class="text-center text-red-500 p-4">页面模板加载不完整，无法初始化表格。</td></tr>';
        return;
    }

    // Set default filter based on the initially active button in HTML
    const initialActiveButton = contentArea.querySelector('.platform-filter-btn.active');
    currentFilters.platform = initialActiveButton?.dataset.platform || 'twitter'; // Default to twitter if none active

    // Load itemsPerPage from localStorage (same as before)
    const savedRowsPerPage = localStorage.getItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL);
    if (savedRowsPerPage) {
        const parsedSize = parseInt(savedRowsPerPage, 10);
        const validOptions = [5, 10, 15, 25, 50, 100];
        if (validOptions.includes(parsedSize)) itemsPerPage = parsedSize;
        else { itemsPerPage = 10; localStorage.removeItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL); }
    } else itemsPerPage = 10;

    // Setup UI components and listeners
    createPageSizeSelector();
    setupPlatformFilterListeners();
    setupGroupFilterListener();
    setupSearchListener();
    setupTableRowClickListener();
    setupCopyButtonListener();

    // Load initial data and filters
    loadGroupFiltersForSocial();
    loadAndRenderSocialAccounts(); // This will now also render the initial header
}

// --- Table Header Rendering ---

/**
 * Renders the table header based on the selected platform.
 * @param {string} platform - The selected platform key (e.g., 'twitter').
 * @returns {number} The total number of columns (colspan).
 */
function renderTableHeader(platform) {
    if (!tableHeader) return 1; // Safety check

    const platformSpecificColumns = platformColumns[platform] || [];
    const allColumns = [...commonColumnsStart, ...platformSpecificColumns, ...commonColumnsEnd];

    let headerHTML = '<tr>';
    allColumns.forEach(col => {
        const style = col.width ? `style="width: ${col.width}"` : '';
        if (col.key === 'checkbox') {
            headerHTML += `<th ${style}><input type="checkbox" class="select-all-checkbox" title="全选"></th>`;
        } else {
            headerHTML += `<th ${style}>${col.header}</th>`;
        }
    });
    headerHTML += '</tr>';

    tableHeader.innerHTML = headerHTML;
    return allColumns.length; // Return the calculated colspan
}

// --- Data Loading & Rendering ---

export async function loadAndRenderSocialAccounts(page = currentPage, limit = itemsPerPage, filters = currentFilters) {
    console.log(`Loading social accounts for platform '${filters.platform}': Page ${page}, Limit ${limit}, Filters:`, filters);

    // **Render the correct header FIRST and get the colspan**
    const currentPlatform = filters.platform || 'twitter'; // Fallback if filter somehow becomes null
    const COLSPAN = renderTableHeader(currentPlatform);

    if (!tableBody || !window.dbAPI) {
        console.error("Table body or dbAPI not ready.");
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="${COLSPAN}" class="text-center text-red-500 p-4">无法加载数据：组件或数据库接口未就绪。</td></tr>`;
        return;
    }

    tableBody.innerHTML = `<tr><td colspan="${COLSPAN}" class="text-center p-4"><i class="fas fa-spinner fa-spin mr-2"></i>正在加载...</td></tr>`;

    try {
        const queryOptions = {
            page: page,
            limit: limit,
            platform: currentPlatform, // Use the determined platform
            group_id: filters.groupId,
            search: filters.search
        };

        const result = await window.dbAPI.getSocialAccounts(queryOptions);
        const accounts = result.accounts;
        totalItems = result.totalCount; // Use total count for the *filtered* platform
        currentPage = page;

        tableBody.innerHTML = '';

        if (!accounts || accounts.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="${COLSPAN}" class="text-center p-4">该平台下暂无社交账户数据。</td></tr>`;
        } else {
            // Get the column definitions for the current platform
            const platformSpecificColumns = platformColumns[currentPlatform] || [];
            const columnsToRender = [...commonColumnsStart, ...platformSpecificColumns, ...commonColumnsEnd];

            accounts.forEach(account => {
                // Pass the specific columns needed for this platform's row
                const row = createSocialAccountRowElement(account, columnsToRender);
                tableBody.appendChild(row);
            });
            setupCheckAll(contentAreaCache, '.social-table');
        }

        // Update pagination based on the total items for the *current filter*
        renderPagination(totalItems, itemsPerPage, currentPage);

    } catch (error) {
        console.error(`Failed to load social accounts data for ${currentPlatform}:`, error);
        tableBody.innerHTML = `<tr><td colspan="${COLSPAN}" class="text-center text-red-500 p-4">加载 ${currentPlatform} 数据失败: ${error.message}</td></tr>`;
    }
}

/**
 * Creates a table row (<tr>) element for a social account.
 * Renders potentially decrypted plaintext, handles decryption errors, truncates long values,
 * adds copy buttons for originally sensitive fields if successfully decrypted.
 * @param {object} account - The social account data object (may contain decrypted values or error flags).
 * @param {Array<object>} columns - Array of column definitions for the current platform.
 * @returns {HTMLTableRowElement} The created table row element.
 */
function createSocialAccountRowElement(account, columns) {
    const row = document.createElement('tr');
    row.dataset.accountId = account.id;

    // Helper function to get display value (handles truncation and empty values, no sensitive check needed here)
    const getDisplayValue = (value, isTruncatable = false) => {
        if (value === null || value === undefined || value === '') {
            return '-';
        }
        const strValue = String(value);

        // Check for decryption error markers BEFORE truncation/display
        if (strValue === '[解密失败]' || strValue === '[应用未解锁]') {
            return `<span class="text-red-500 text-xs">${strValue}</span>`; // Display error prominently
        }

        const TRUNCATE_LENGTH = 20;
        const TRUNCATE_EDGE = 8;

        if (isTruncatable && strValue.length > TRUNCATE_LENGTH) {
            return `${strValue.substring(0, TRUNCATE_EDGE)}...${strValue.substring(strValue.length - TRUNCATE_EDGE)}`;
        }
        return strValue.replace(/[<>]/g, char => ({ '<': '&lt;', '>': '&gt;' }[char])); // Basic XSS escape
    };

    columns.forEach(col => {
        const td = document.createElement('td');
        const rawValue = account[col.key]; // This might be decrypted plaintext or an error marker
        const isOriginallySensitive = SENSITIVE_FIELDS_FOR_COPY.includes(col.key);
        // Check if the value indicates a decryption problem for this specific field
        const hasValueError = rawValue === '[解密失败]' || rawValue === '[应用未解锁]';

        switch (col.key) {
            case 'checkbox':
                td.innerHTML = `<input type="checkbox" class="row-checkbox form-checkbox h-4 w-4 text-blue-600" value="${account.id}">`;
                break;
            case 'platform':
                let platformIconClass = 'fas fa-question-circle';
                let platformColor = '#6c757d';
                switch (account.platform?.toLowerCase()) {
                    case 'twitter': platformIconClass = 'fab fa-twitter'; platformColor = '#1DA1F2'; break;
                    case 'discord': platformIconClass = 'fab fa-discord'; platformColor = '#5865F2'; break;
                    case 'telegram': platformIconClass = 'fab fa-telegram'; platformColor = '#2AABEE'; break;
                    case 'email': platformIconClass = 'fas fa-envelope'; platformColor = '#DB4437'; break;
                }
                td.innerHTML = `<i class="${platformIconClass}" style="color: ${platformColor}; font-size: 1.2em; vertical-align: middle;"></i> ${account.platform || '-'}`;
                break;
            case 'actions':
                td.innerHTML = `
                    <button class="btn-icon action-btn" data-action="edit" title="编辑"><i class="fas fa-pencil-alt"></i></button>
                    <button class="btn-icon action-btn" data-action="delete" title="删除"><i class="fas fa-trash-alt"></i></button>
                `;
                // Attach listeners here to avoid searching the whole row later
                td.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
                    e.stopPropagation(); handleSocialAccountAction('edit', account.id);
                });
                td.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
                    e.stopPropagation(); handleSocialAccountAction('delete', account.id);
                });
                break;
            case 'groupName': // Use the pre-joined groupName if available
                 td.textContent = account.groupName || '无分组';
                 break;
            default: // Handle data fields
                const displayValue = getDisplayValue(rawValue, col.truncatable);
                td.innerHTML = `<span class="cell-value">${displayValue}</span>`; // Wrap value

                // Add copy button ONLY if the field was originally sensitive AND decryption was successful (rawValue exists and is not an error marker)
                if (isOriginallySensitive && rawValue && !hasValueError) {
                    const copyBtn = document.createElement('button');
                    copyBtn.className = 'btn-icon btn-icon-sm copy-btn';
                    copyBtn.title = '复制';
                    copyBtn.innerHTML = '<i class="fa fa-copy"></i>';
                    copyBtn.dataset.copyValue = escapeAttribute(rawValue); // Store the potentially decrypted value
                    td.appendChild(copyBtn);

                    td.style.display = 'flex';
                    td.style.alignItems = 'center';
                    td.style.justifyContent = 'space-between';
                    td.style.gap = '5px';
                } else if (isOriginallySensitive && hasValueError) {
                     // Optionally add a disabled/error icon instead of copy button if decryption failed
                     // td.innerHTML += '<i class="fa fa-exclamation-triangle text-red-500 ml-1" title="解密失败"></i>';
                }
                break;
        }
        row.appendChild(td);
    });

    // Optionally highlight the entire row if there was a general decryption error
    if (account.decryptionError) {
        // row.classList.add('decryption-error-row'); // Add a CSS class for styling
        // Or add a title attribute to the row
        row.title = `注意: ${account.decryptionError}`;
    }

    return row;
}

// Helper function to escape HTML attributes
function escapeAttribute(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/["&<>]/g, char => ({
        '"': '&quot;',
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    }[char]));
}

// --- Filtering & Searching ---

function setupPlatformFilterListeners() {
    const platformButtons = contentAreaCache?.querySelectorAll('.platform-filter-btn');
    if (!platformButtons) return;

    platformButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const platform = button.dataset.platform;
            if (platform === currentFilters.platform) return; // Do nothing if already active

            // Update active state
            platformButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            currentFilters.platform = platform;
            currentPage = 1; // Reset page
            // Reload data - this will also trigger header rendering
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

// --- Copy Button Functionality ---
function setupCopyButtonListener() {
    if (!tableBody) return;

    tableBody.addEventListener('click', async (event) => {
        const button = event.target.closest('.copy-btn');
        if (!button) return; // Click was not on a copy button

        event.stopPropagation(); // Prevent row click toggle

        const valueToCopy = button.dataset.copyValue;
        if (!valueToCopy) {
            showToast('没有可复制的内容', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(valueToCopy);
            showToast('已复制到剪贴板', 'success');
        } catch (err) {
            console.error('复制失败:', err);
            showToast('复制失败，请检查浏览器权限或使用 HTTPS', 'error');
        }
    });
} 