import { debounce } from '../../utils/index.js';
import { showToast } from '../../components/toast.js';
import { handleSocialAccountAction } from './actions.js'; // Import action handler
import {
    renderTableHeader,
    createSocialAccountRowElement,
    renderPageSizeSelector,
    renderPaginationControls
} from './socialTableRenderer.js'; // <--- 修改导入

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
    setupPaginationButtonListener();

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

    const selectorFragment = renderPageSizeSelector(itemsPerPage);
    pageSizeContainer.appendChild(selectorFragment);

    // 从容器中获取新创建的 select 元素以绑定事件
    const select = pageSizeContainer.querySelector('select'); 
    if (!select) {
        console.error('Page size selector SElECT element not found after rendering.');
        return;
    }

    // 原有的事件监听逻辑保持不变
    select.addEventListener('change', async () => {
        const newSize = parseInt(select.value);
        if (newSize !== itemsPerPage) {
            itemsPerPage = newSize;
            currentPage = 1; // Reset to first page on size change
            localStorage.setItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL, newSize.toString());
            await loadAndRenderSocialAccounts();
        }
    });

    // The label and select are now created by renderPageSizeSelector and appended as a fragment.
    // So, no need for pageSizeContainer.appendChild(label) or pageSizeContainer.appendChild(select) here.
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

    const controlsFragment = renderPaginationControls(totalItems, itemsPerPage, currentPage);
    paginationControls.appendChild(controlsFragment);
}

/**
 * 设置分页控件按钮的事件监听器 (事件委托)。
 */
function setupPaginationButtonListener() {
    if (!paginationControls) return;

    // 清理可能存在的旧监听器，以防 initSocialTable 被多次调用 (虽然不应该)
    // (或者使用 cloneNode 技巧，但对于事件委托，确保只添加一次更简单)
    // paginationControls.removeEventListener('click', handlePaginationClick); // 如果 handlePaginationClick 是具名函数
    // 为简化，这里假设 initSocialTable 只调用一次，或者 paginationControls 元素是动态替换的

    paginationControls.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-page]'); // 确保点击的是按钮且有 data-page 属性
        if (button && !button.disabled) {
            const pageNum = parseInt(button.dataset.page, 10);
            if (!isNaN(pageNum)) {
                loadAndRenderSocialAccounts(pageNum);
            }
        }
    });
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