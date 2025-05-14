import { debounce } from '../../utils/index.js';
import { showToast } from '../../components/toast.js';
import { handleSocialAccountAction } from './actions.js'; // Import action handler
import { renderTableHeader, createSocialAccountRowElement } from './socialTableRenderer.js'; // <--- 修改导入

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
// 这些配置将作为参数传递给 socialTableRenderer.js 中的 renderTableHeader
const platformColumnsConfig = {
    twitter: [
        { header: '账户/邮箱', key: 'identifier' },
        { header: '密码', key: 'password', sensitive: true },
        { header: '推特邮箱', key: 'twitter_email' },
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
        { header: '辅助邮箱', key: 'email_recovery_email' },
        { header: '备注', key: 'notes' },
        { header: '分组', key: 'groupName' }
    ]
};
const commonColumnsStartConfig = [
    { header: '', key: 'checkbox', width: '3%' }, // Checkbox
    { header: '平台', key: 'platform' }         // Platform Icon/Name
];
const commonColumnsEndConfig = [
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
    setupCellCopyListener();

    // Load initial data and filters
    loadGroupFiltersForSocial();
    loadAndRenderSocialAccounts(); // This will now also render the initial header
}

// --- Table Header Rendering --- (旧的 renderTableHeader 函数已移除)
// function renderTableHeader(platform) { ... }

// --- Data Loading & Rendering ---

export async function loadAndRenderSocialAccounts(page = currentPage, limit = itemsPerPage, filters = currentFilters) {
    console.log(`Loading social accounts for platform '${filters.platform}': Page ${page}, Limit ${limit}, Filters:`, filters);

    const currentPlatform = filters.platform || 'twitter'; // Fallback
    
    // **Render the correct header FIRST and get the colspan**
    // 调用新的 renderTableHeader
    const { headerHTML, colspan: COLSPAN } = renderTableHeader(
        platformColumnsConfig, 
        commonColumnsStartConfig, 
        commonColumnsEndConfig, 
        currentPlatform
    );

    if (!tableHeader || !tableBody || !window.dbAPI) { // tableHeader 仍然在这里检查，因为它需要被填充
        console.error("Table header, body or dbAPI not ready.");
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="${COLSPAN || 1}" class="text-center text-red-500 p-4">无法加载数据：组件或数据库接口未就绪。</td></tr>`;
        return;
    }
    tableHeader.innerHTML = headerHTML; // <--- 设置表头内容

    tableBody.innerHTML = `<tr><td colspan="${COLSPAN}" class="text-center p-4"><i class="fas fa-spinner fa-spin mr-2"></i>正在加载...</td></tr>`;

    try {
        const queryOptions = {
            page: page,
            limit: limit,
            platform: currentPlatform,
            group_id: filters.groupId,
            search: filters.search
        };

        const result = await window.dbAPI.getSocialAccounts(queryOptions);
        const accounts = result.accounts;
        totalItems = result.totalCount;
        currentPage = page;

        tableBody.innerHTML = '';

        if (!accounts || accounts.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="${COLSPAN}" class="text-center p-4">该平台下暂无社交账户数据。</td></tr>`;
        } else {
            // 获取列定义以传递给 createSocialAccountRowElement
            // 注意：这里的 platformColumnsConfig 和 common...Config 是模块级常量，可以直接在 createSocialAccountRowElement 中访问（如果它还未被移动）
            // 或者，如果 createSocialAccountRowElement 也被移动并期望这些作为参数，则需要调整。
            // 目前假设 createSocialAccountRowElement 仍然在 table.js 内部。
            const platformSpecificCols = platformColumnsConfig[currentPlatform] || [];
            const columnsToRender = [...commonColumnsStartConfig, ...platformSpecificCols, ...commonColumnsEndConfig];

            accounts.forEach(account => {
                const row = createSocialAccountRowElement(account, columnsToRender, SENSITIVE_FIELDS_FOR_COPY, handleSocialAccountAction);
                tableBody.appendChild(row);
            });
            setupCheckAll(contentAreaCache, '.social-table');
        }
        renderPagination(totalItems, itemsPerPage, currentPage);
    } catch (error) {
        console.error(`Failed to load social accounts data for ${currentPlatform}:`, error);
        tableBody.innerHTML = `<tr><td colspan="${COLSPAN}" class="text-center text-red-500 p-4">加载 ${currentPlatform} 数据失败: ${error.message}</td></tr>`;
    }
}

/**
 * Creates a table row (<tr>) element for a social account.
 * Renders plaintext, truncates long values, adds copy functionality to cells.
 * @param {object} account - The social account data object.
 * @param {Array<object>} columns - Array of column definitions for the current platform.
 * @returns {HTMLTableRowElement} The created table row element.
 */
/*
function createSocialAccountRowElement(account, columns) {
    const row = document.createElement('tr');
    row.dataset.accountId = account.id;

    const getDisplayValue = (value, isTruncatable = false) => {
        if (value === null || value === undefined || value === '') return '-';
        const strValue = String(value);
        if (strValue === '[解密失败]' || strValue === '[应用未解锁]') {
            return `<span class="text-red-500 text-xs">${strValue}</span>`;
        }
        const TRUNCATE_LENGTH = 20, TRUNCATE_EDGE = 8;
        if (isTruncatable && strValue.length > TRUNCATE_LENGTH) {
            return `${strValue.substring(0, TRUNCATE_EDGE)}...${strValue.substring(strValue.length - TRUNCATE_EDGE)}`;
        }
        return strValue.replace(/[<>]/g, char => ({ '<': '&lt;', '>': '&gt;' }[char]));
    };

    columns.forEach(col => {
        const td = document.createElement('td');
        let rawValue = account[col.key];
        
        // Discord 平台特殊处理，同时检查两个密码字段
        if (col.key === 'discord_password' && (!rawValue || rawValue === '')) {
            rawValue = account['password']; // 尝试使用通用密码字段
            console.log('使用通用密码字段作为 Discord 密码');
        }
        
        // 调试输出
        if (col.key === 'email_recovery_email') {
            console.log(`账户 ${account.id} 的辅助邮箱: ${rawValue}, 类型: ${typeof rawValue}`);
        }
        
        const isOriginallySensitive = SENSITIVE_FIELDS_FOR_COPY.includes(col.key);
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
                td.innerHTML = displayValue; // Directly set innerHTML for potential error styling

                // Add copyable class and data attribute if the field is copyable and successfully retrieved
                if (isOriginallySensitive && rawValue && !hasValueError) {
                    td.classList.add('copyable-cell');
                    td.dataset.copyValue = escapeAttribute(rawValue); // Store raw value for copying
                    td.title = '点击复制'; // Add title tooltip
                } else if (hasValueError) {
                    td.title = rawValue; // Show error in title
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
*/// 函数已被移至 socialTableRenderer.js

// Helper function to escape HTML attributes
/*
function escapeAttribute(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/["&<>]/g, char => ({
        '"': '&quot;',
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;'
    }[char]));
}
*/// 函数已被移至 socialTableRenderer.js

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
 * Ignores clicks on interactive elements AND copyable cells.
 */
function setupTableRowClickListener() {
    if (!tableBody) return;
    tableBody.addEventListener('click', (event) => {
        const target = event.target;
        const row = target.closest('tr');

        // Ensure it's a valid row with an ID
        if (!row || !row.dataset.accountId) {
            return;
        }

        // Ignore clicks on interactive elements (buttons, inputs, links, etc.)
        // AND ignore clicks if the direct target or its parent is a copyable cell
        if (target.closest('button, a, input, select, .copyable-cell')) {
            return;
        }

        // Find the checkbox and toggle it
        const checkbox = row.querySelector('.row-checkbox');
        if (checkbox) {
            checkbox.checked = !checkbox.checked;
            checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            row.classList.toggle('selected', checkbox.checked);
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

// --- Copy Cell Functionality ---
// Renamed from setupCopyButtonListener
function setupCellCopyListener() {
    if (!tableBody) return;

    // Listen on the table body for clicks
    tableBody.addEventListener('click', async (event) => {
        // Check if the clicked element is a TD with the copyable class
        const targetCell = event.target.closest('td.copyable-cell');
        if (!targetCell) return; // Click was not on a copyable cell

        // No need for stopPropagation here unless it interferes with row selection unexpectedly

        const valueToCopy = targetCell.dataset.copyValue;
        if (valueToCopy === undefined || valueToCopy === null) { // Check for undefined or null
            showToast('没有可复制的内容', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(valueToCopy);
            showToast('已复制到剪贴板', 'success'); // Use existing toast
        } catch (err) {
            console.error('复制失败:', err);
            showToast('复制失败', 'error'); // Simpler error message
        }
    });
} 