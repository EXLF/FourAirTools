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