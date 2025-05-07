// DOM元素引用和验证模块

// DOM元素引用
export const elements = {
    contentArea: null,
    tableBody: null,
    paginationWrapper: null,
    paginationContainer: null,
    searchInput: null,
    selectAllCheckbox: null,
    addProxyBtn: null,
    bulkTestBtn: null,
    bulkDeleteBtn: null,
    importProxiesBtn: null,
    exportProxiesBtn: null,
    filterElements: {},
    pageSizeSelect: null,
    prevPageBtn: null,
    nextPageBtn: null,
    pageNumbersContainer: null,
    pageInfoSpan: null
};

// 初始化DOM元素引用
export function initDOMElements(pageElement) {
    elements.contentArea = pageElement;
    if (!elements.contentArea) {
        console.error('[Network Page] Content area not provided!');
        return false;
    }

    elements.tableBody = pageElement.querySelector('.proxies-table tbody');
    elements.paginationWrapper = pageElement.querySelector('.pagination-controls-wrapper');
    elements.searchInput = pageElement.querySelector('.table-search-input');
    elements.selectAllCheckbox = pageElement.querySelector('.select-all-checkbox');
    elements.addProxyBtn = pageElement.querySelector('.add-proxy-btn');
    elements.bulkTestBtn = pageElement.querySelector('.bulk-test-proxies-btn');
    elements.bulkDeleteBtn = pageElement.querySelector('.bulk-delete-proxies-btn');
    elements.importProxiesBtn = pageElement.querySelector('.import-proxies-btn');
    elements.exportProxiesBtn = pageElement.querySelector('.export-proxies-btn');

    if (elements.paginationWrapper) {
        elements.pageSizeSelect = elements.paginationWrapper.querySelector('.page-size-select');
        elements.paginationContainer = elements.paginationWrapper.querySelector('.pagination');
        if (elements.paginationContainer) {
            elements.prevPageBtn = elements.paginationContainer.querySelector('.prev-page-btn');
            elements.nextPageBtn = elements.paginationContainer.querySelector('.next-page-btn');
            elements.pageNumbersContainer = elements.paginationContainer.querySelector('.page-numbers');
            elements.pageInfoSpan = elements.paginationContainer.querySelector('.page-info');
        }
    }

    elements.filterElements = {
        type: pageElement.querySelector('.select-filter[data-filter="type"]'),
        status: pageElement.querySelector('.select-filter[data-filter="status"]'),
    };

    return validateRequiredElements();
}

// 验证必需的DOM元素
function validateRequiredElements() {
    const requiredElements = {
        tableBody: elements.tableBody,
        paginationWrapper: elements.paginationWrapper,
        paginationContainer: elements.paginationContainer,
        searchInput: elements.searchInput,
        selectAllCheckbox: elements.selectAllCheckbox,
        addProxyBtn: elements.addProxyBtn,
        bulkTestBtn: elements.bulkTestBtn,
        bulkDeleteBtn: elements.bulkDeleteBtn,
        importProxiesBtn: elements.importProxiesBtn,
        exportProxiesBtn: elements.exportProxiesBtn,
        pageSizeSelect: elements.pageSizeSelect,
        prevPageBtn: elements.prevPageBtn,
        nextPageBtn: elements.nextPageBtn,
        pageNumbersContainer: elements.pageNumbersContainer,
        pageInfoSpan: elements.pageInfoSpan,
        ...elements.filterElements
    };

    for (const [name, element] of Object.entries(requiredElements)) {
        if (!element) {
            console.error(`[Network Page] Required element not found: ${name}`);
            if (elements.tableBody) {
                elements.tableBody.innerHTML = '<tr><td colspan="14" class="text-center text-red-500 p-4">页面元素加载不完整，无法初始化代理管理。</td></tr>';
            }
            return false;
        }
    }
    return true;
}

// 获取选中的代理ID列表
export function getSelectedProxyIds() {
    return Array.from(elements.tableBody.querySelectorAll('.row-checkbox:checked'))
        .map(cb => parseInt(cb.closest('tr').dataset.proxyId, 10));
}

// 显示加载指示器
export function showLoadingIndicator() {
    if(elements.tableBody) elements.tableBody.style.opacity = '0.5';
}

// 隐藏加载指示器
export function hideLoadingIndicator() {
    if(elements.tableBody) elements.tableBody.style.opacity = '1';
} 