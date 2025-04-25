import { debounce } from '../utils/index.js';

/**
 * 使用事件委托为表格行内的操作按钮设置通用逻辑。
 * 假设操作按钮具有类 'btn-icon' 并且位于 'actions-cell' 内。
 * @param {HTMLElement} contentArea - 表格所在的父容器。
 * @param {string} tableSelector - 表格的 CSS 选择器。
 * @param {function} actionHandler - 点击操作按钮时调用的函数。接收 (action, rowElement, rowData)。
 */
export function setupTableActions(contentArea, tableSelector, actionHandler) {
    const table = contentArea.querySelector(tableSelector);
    if (!table) {
        console.warn(`Table not found for action setup: ${tableSelector}`);
        return;
    }

    // 在表格主体（或表格本身）上使用事件委托
    const tableBody = table.querySelector('tbody') || table;
    tableBody.addEventListener('click', (e) => {
        const button = e.target.closest('.actions-cell .btn-icon');
        if (button) {
            const row = button.closest('tr');
            if (!row) return;

            const action = button.title || button.dataset.action; // 使用 title 或 data-action
            // 基础行数据提取（如有需要可以改进）
            const rowData = Array.from(row.cells).map(cell => cell.textContent.trim());

            actionHandler(action, row, rowData);
        }
    });
}

/**
 * 为项目列表设置筛选控件和搜索输入的通用逻辑。
 * @param {HTMLElement} contentArea - 筛选器和项目所在的父容器。
 * @param {string} filtersBarSelector - 筛选控件容器的 CSS 选择器。
 * @param {string} itemSelector - 需要筛选的项目的 CSS 选择器 (例如, 'tbody tr', '.project-card')。
 * @param {function} filterFunction - 用于确定是否显示项目的函数。接收 (itemElement, filterValues)。返回 true 显示，false 隐藏。
 */
export function setupFilteringAndSearch(contentArea, filtersBarSelector, itemSelector, filterFunction) {
    const filtersBar = contentArea.querySelector(filtersBarSelector);
    if (!filtersBar) {
        // console.warn(`Filters bar not found: ${filtersBarSelector}`);
        // 如果筛选栏对于页面是可选的，则不发出警告
        return;
    }

    const items = contentArea.querySelectorAll(itemSelector);
    // 不在此处检查 items.length，因为项目可能稍后动态加载

    const selects = filtersBar.querySelectorAll('.select-filter');
    const searchInput = filtersBar.querySelector('.table-search-input'); // 搜索的通用类
    const platformButtons = filtersBar.querySelectorAll('.platform-filter-btn'); // 社交页面特有

    // 存储当前筛选值以供筛选函数使用
    let currentFilterValues = {};

    const applyFilters = () => {
        // 每次调用 applyFilters 时重新计算筛选值
        currentFilterValues = {};
        selects.forEach(select => {
            if (select.id) { // 确保 select 有 ID 作为键
                 currentFilterValues[select.id] = select.value;
            } else {
                 console.warn('筛选下拉框缺少 ID:', select);
            }
        });
        currentFilterValues.search = searchInput ? searchInput.value.toLowerCase() : '';

        // 特定处理平台按钮（如果存在）
        const activePlatformBtn = filtersBar.querySelector('.platform-filter-btn.active');
        if (activePlatformBtn !== null) { // 检查 querySelector 是否找到元素
             currentFilterValues.platform = activePlatformBtn.dataset.platform || '';
        }

        // 重新查询项目以防它们是动态添加的
        const currentItems = contentArea.querySelectorAll(itemSelector);
        currentItems.forEach(item => {
            if (filterFunction(item, currentFilterValues)) {
                item.style.display = ''; // 显示项目
            } else {
                item.style.display = 'none'; // 隐藏项目
            }
        });
    };

    // 附加监听器
    selects.forEach(select => select.addEventListener('change', applyFilters));

    if (searchInput) {
        searchInput.addEventListener('input', debounce(applyFilters, 300)); // 对搜索输入进行防抖处理
    }

    if (platformButtons.length > 0) {
         platformButtons.forEach(button => {
            button.addEventListener('click', () => {
                platformButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                applyFilters(); // 平台更改时重新应用筛选
            });
        });
    }

    // 设置时初始应用筛选
    // 在初始筛选前确保项目存在，或在项目加载后调用它。
    // 现在调用它，假设项目可能最初存在于模板中。
     if (contentArea.querySelectorAll(itemSelector).length > 0) {
         applyFilters();
     }
}

/**
 * 为表格设置"全选"复选框功能。
 * @param {HTMLElement} contentArea - 表格所在的父容器。
 * @param {string} tableSelector - 表格的 CSS 选择器。
 */
export function setupCheckAll(contentArea, tableSelector) {
    const table = contentArea.querySelector(tableSelector);
    if (!table) {
        console.warn(`未找到用于设置全选的表格: ${tableSelector}`);
        return;
    }
    const checkAll = table.querySelector('thead input[type="checkbox"]');
    const checkBoxes = table.querySelectorAll('tbody input[type="checkbox"]');

    if (!checkAll) {
        // console.warn(`在表格 ${tableSelector} 的 thead 中未找到全选复选框`);
        return; // 并非所有表格都可能有全选功能
    }

    if (checkBoxes.length === 0) return; // 没有可供选中的行

    checkAll.addEventListener('change', (e) => {
        checkBoxes.forEach(cb => cb.checked = e.target.checked);
    });

    // 为单个复选框添加监听器以取消选中"全选"
    const updateCheckAllState = () => {
         const allChecked = Array.from(checkBoxes).every(cb => cb.checked);
         const noneChecked = Array.from(checkBoxes).every(cb => !cb.checked);
         checkAll.checked = allChecked;
         // 如果部分但非全部选中，则设置不确定状态
         checkAll.indeterminate = !allChecked && !noneChecked;
    };

    checkBoxes.forEach(cb => {
        cb.addEventListener('change', updateCheckAllState);
    });

    // 初始状态检查，以防某些框开始时已选中
    updateCheckAllState();
} 

/**
 * 渲染分页控件的通用函数。
 * @param {HTMLElement} containerElement - 用于放置分页控件的容器元素。
 * @param {number} totalItems - 总记录数。
 * @param {number} itemsPerPage - 每页记录数。
 * @param {number} currentPage - 当前页码 (1-based)。
 * @param {function} onPageChangeCallback - 当页码改变时调用的回调函数，接收新的页码作为参数。
 */
export function renderPagination(containerElement, totalItems, itemsPerPage, currentPage, onPageChangeCallback) {
    if (!containerElement) {
        console.warn("Pagination container element not provided.");
        return;
    }

    containerElement.innerHTML = ''; // 清空旧的分页
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // 显示页码信息
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    const displayPage = Math.max(1, currentPage);
    const displayTotalPages = Math.max(1, totalPages);
    pageInfo.textContent = `${displayPage}/${displayTotalPages}页 共${totalItems}条`;
    pageInfo.style.marginRight = '15px'; // 可根据需要调整样式
    containerElement.appendChild(pageInfo);

    if (totalPages <= 1) return; // 如果只有一页或没有数据，则不需要分页按钮

    // --- 创建按钮的辅助函数 ---
    const createButton = (text, pageNumber, isDisabled = false, isActive = false) => {
        const button = document.createElement('button');
        button.innerHTML = text; // 使用 innerHTML 以支持 HTML 实体 (如 &laquo;)
        button.disabled = isDisabled;
        if (isActive) {
            button.classList.add('active');
        }
        if (pageNumber !== null) {
            button.addEventListener('click', (e) => {
                e.preventDefault(); // 防止潜在的表单提交
                if (!isDisabled && !isActive) {
                    onPageChangeCallback(pageNumber);
                }
            });
        }
        return button;
    };
    // --- ----------------- ---

    // 上一页按钮
    containerElement.appendChild(createButton('&laquo;', currentPage - 1, currentPage === 1));

    // 页码按钮逻辑 (显示当前页、前后几页、省略号)
    const maxPagesToShow = 5; // 最多显示的页码按钮数 (包括省略号)
    let startPage, endPage;

    if (totalPages <= maxPagesToShow) {
        startPage = 1;
        endPage = totalPages;
    } else {
        const maxPagesBeforeCurrent = Math.floor((maxPagesToShow - 3) / 2); // -3 for first, last, ellipsis
        const maxPagesAfterCurrent = Math.ceil((maxPagesToShow - 3) / 2);

        if (currentPage <= maxPagesBeforeCurrent + 1) {
            startPage = 1;
            endPage = maxPagesToShow - 2; // first, pages, ellipsis, last
        } else if (currentPage >= totalPages - maxPagesAfterCurrent) {
            startPage = totalPages - (maxPagesToShow - 3);
            endPage = totalPages;
        } else {
            startPage = currentPage - maxPagesBeforeCurrent;
            endPage = currentPage + maxPagesAfterCurrent;
        }
    }

    // 第一页和省略号
    if (startPage > 1) {
        containerElement.appendChild(createButton('1', 1));
        if (startPage > 2) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '0 8px'; // 可调整样式
            containerElement.appendChild(ellipsis);
        }
    }

    // 中间的页码按钮
    for (let i = startPage; i <= endPage; i++) {
        containerElement.appendChild(createButton(i.toString(), i, false, i === currentPage));
    }

    // 省略号和最后一页
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement('span');
            ellipsis.textContent = '...';
            ellipsis.style.padding = '0 8px';
            containerElement.appendChild(ellipsis);
        }
        containerElement.appendChild(createButton(totalPages.toString(), totalPages));
    }

    // 下一页按钮
    containerElement.appendChild(createButton('&raquo;', currentPage + 1, currentPage === totalPages));
}

/**
 * 设置页面大小（每页行数）选择器。
 * @param {string} containerSelector - 放置选择器的容器元素的 CSS 选择器。
 * @param {Array<number>} options - 可选的页面大小数字数组，例如 [5, 10, 15, 25, 50, 100]。
 * @param {number} initialValue - 初始的每页行数值。
 * @param {string} localStorageKey - 用于在 localStorage 中存储用户选择的键名。
 * @param {function} onChangeCallback - 当选择改变时调用的回调函数，接收新的页面大小作为参数。
 * @param {HTMLElement} [parentElement=document] - 查找容器元素的父元素，默认为 document。
 */
export function setupPageSizeSelector(containerSelector, options, initialValue, localStorageKey, onChangeCallback, parentElement = document) {
    const container = parentElement.querySelector(containerSelector);
    if (!container) {
        console.warn(`Page size selector container not found: ${containerSelector}`);
        return initialValue; // Return initial value if container not found
    }

    // 尝试从 localStorage 加载保存的值
    const savedValue = localStorage.getItem(localStorageKey);
    let currentValue = initialValue;
    if (savedValue) {
        const parsedValue = parseInt(savedValue, 10);
        if (options.includes(parsedValue)) {
            currentValue = parsedValue;
        } else {
            localStorage.removeItem(localStorageKey);
        }
    }

    // 创建或查找下拉框元素
    let select = container.querySelector('select.page-size-select');
    if (!select) {
        container.innerHTML = ''; // 清空容器
        const label = document.createElement('span');
        label.textContent = '每页显示: ';
        label.style.marginRight = '8px';
        container.appendChild(label);

        select = document.createElement('select');
        select.className = 'page-size-select';
        select.style.cssText = 'padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc; margin-left: 5px;'; 
        container.appendChild(select);
    } else {
        select.innerHTML = ''; // 清空现有选项
    }

    // 填充选项
    options.forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size}条`;
        if (size === currentValue) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    // 移除旧监听器并添加新监听器 (克隆节点法)
    const oldSelect = select;
    const newSelect = oldSelect.cloneNode(true);
    oldSelect.parentNode.replaceChild(newSelect, oldSelect);

    newSelect.addEventListener('change', (event) => {
        const newSize = parseInt(event.target.value);
        if (newSize !== currentValue) { 
            localStorage.setItem(localStorageKey, newSize.toString());
            onChangeCallback(newSize);
            // 注意：currentValue 的更新现在由调用者在回调中处理
        }
    });

    // 返回最终确定的当前页面大小 (可能来自 localStorage)
    return currentValue;
} 