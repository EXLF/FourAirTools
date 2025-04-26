import { truncateAddress } from '../../utils/index.js';
import { debounce } from '../../utils/index.js';
import { showToast } from '../../components/toast.js';
import { setupCheckAll } from '../../components/tableHelper.js';

// 存储当前筛选和分页状态
let currentFilters = {};
let currentPage = 1;
let rowsPerPage = 15; // 默认值
const LOCAL_STORAGE_KEY_ROWS_PER_PAGE = 'walletsPage_rowsPerPage'; // 定义 localStorage 键

// *** 新增：余额缓存 ***
const balanceCache = new Map(); // 使用 Map 存储: address => { balanceFormatted: string, timestamp: number }
const CACHE_DURATION_MS = 5 * 60 * 1000; // 缓存有效期：5分钟
// *** -------------- ***

// 缓存 DOM 元素 (在 index.js 中初始化并传入)
let tableBody;
let groupFilterSelect;
let searchInput;
let paginationContainer;
let pageSizeContainer;
let contentAreaCache; // 缓存 contentArea, 确保 setupCheckAll 能用

/**
 * 初始化表格模块所需的 DOM 元素引用。
 * @param {object} elements - 包含 DOM 元素引用的对象。
 */
export function initTableElements(elements) {
    tableBody = elements.tableBody;
    groupFilterSelect = elements.groupFilterSelect;
    searchInput = elements.searchInput;
    paginationContainer = elements.paginationContainer;
    contentAreaCache = elements.contentAreaCache; // 传递 contentArea
    // pageSizeContainer 在 createPageSizeSelector 中创建和缓存
}

/**
 * 获取当前表格每页显示的行数。
 * @returns {number}
 */
export function getRowsPerPage() {
    return rowsPerPage;
}

/**
 * 设置当前表格每页显示的行数。
 * @param {number} newSize 
 */
export function setRowsPerPage(newSize) {
    rowsPerPage = newSize;
}

/**
 * 获取当前筛选条件。
 * @returns {object}
 */
export function getCurrentFilters() {
    return currentFilters;
}

/**
 * 创建并插入页面大小选择器
 */
export function createPageSizeSelector() {
    // 创建容器
    pageSizeContainer = document.createElement('div');
    pageSizeContainer.className = 'page-size-selector';
    pageSizeContainer.style.cssText = 'display: inline-flex; align-items: center; margin-right: 15px;';
    
    // 创建标签
    const label = document.createElement('span');
    label.textContent = '每页显示: ';
    label.style.marginRight = '8px';
    
    // 创建下拉框
    const select = document.createElement('select');
    select.className = 'page-size-select';
    select.style.cssText = 'padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;';
    
    // 添加选项 (确保选中状态与当前的 rowsPerPage 匹配)
    const options = [5, 10, 15, 25, 50, 100];
    options.forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size}条`;
        if (size === rowsPerPage) { // 使用初始化或加载后的 rowsPerPage 值
            option.selected = true;
        }
        select.appendChild(option);
    });
    
    // 添加事件监听器
    select.addEventListener('change', async () => {
        const newSize = parseInt(select.value);
        if (newSize !== rowsPerPage) {
            rowsPerPage = newSize;
            currentPage = 1; 
            // 将新设置保存到 localStorage
            localStorage.setItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE, newSize.toString());
            await loadAndRenderWallets(); 
        }
    });
    
    // 组装元素
    pageSizeContainer.appendChild(label);
    pageSizeContainer.appendChild(select);
    
    // 插入到 DOM
    // 我们需要找到分页控件的父元素，然后将我们的选择器插入其前面或后面
    if (paginationContainer && paginationContainer.parentNode) {
        // 创建包装容器将分页和页面大小选择器放在一起
        const paginationWrapper = document.createElement('div');
        paginationWrapper.className = 'pagination-controls-wrapper';
        paginationWrapper.style.cssText = 'display: flex; justify-content: flex-end; align-items: baseline; margin-top: 15px;';
        
        // 将分页控件从其父元素移除
        const parent = paginationContainer.parentNode;
        parent.removeChild(paginationContainer);
        
        // 将两者添加到包装容器
        paginationWrapper.appendChild(pageSizeContainer);
        paginationWrapper.appendChild(paginationContainer);
        
        // 将包装容器添加到原始父元素
        parent.appendChild(paginationWrapper);
    }
}

/**
 * 设置筛选器和搜索框的事件监听器。
 * 当筛选条件改变时，重置页码并重新加载数据。
 */
export function setupFilterListeners() {
    const applyFiltersAndReload = debounce(async () => {
        currentPage = 1;
        currentFilters = {
            groupId: groupFilterSelect.value ? parseInt(groupFilterSelect.value) : null,
            search: searchInput.value.trim()
        };
        await loadAndRenderWallets(currentFilters);
    }, 300);

    groupFilterSelect.addEventListener('change', applyFiltersAndReload);
    searchInput.addEventListener('input', applyFiltersAndReload);
}

/**
 * 从数据库加载分组数据并填充到筛选器下拉菜单中。
 */
export async function loadGroupFilters() {
    if (!groupFilterSelect) {
        console.warn("loadGroupFilters called before groupFilterSelect is initialized.");
        return;
    }
    try {
        // 使用 IPC 调用
        const groups = await window.dbAPI.getGroups();
        groupFilterSelect.innerHTML = '<option value="">所有分组</option>';
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupFilterSelect.appendChild(option);
        });
    } catch (error) {
        console.error("IPC: 加载分组筛选器失败:", error);
        showToast("加载分组筛选器失败", 'error');
    }
}

/**
 * 缩短字符串，显示前缀和后缀，中间用省略号代替。
 * @param {string} str - 要缩短的字符串。
 * @param {number} prefixLength - 要保留的前缀长度。
 * @param {number} suffixLength - 要保留的后缀长度。
 * @returns {string} 缩短后的字符串或原始字符串（如果太短）。
 */
function shortenString(str, prefixLength = 6, suffixLength = 4) {
    if (!str || typeof str !== 'string') {
        return ''; // 返回空字符串或合适的占位符
    }
    const minLength = prefixLength + suffixLength + 3; // 至少需要能放下前缀+后缀+***
    if (str.length > minLength) {
        return `${str.substring(0, prefixLength)}***${str.substring(str.length - suffixLength)}`;
    }
    return str; // 如果字符串不够长，直接返回
}

/**
 * 从数据库加载钱包数据并渲染到表格中。
 * @param {object} [filters=currentFilters] - 当前应用的筛选条件。
 * @param {number} [page=currentPage] - 要加载的目标页码，默认为全局当前页。
 */
export async function loadAndRenderWallets(filters = currentFilters, page = currentPage) {
    if (!tableBody || !contentAreaCache) {
         console.error("loadAndRenderWallets called before tableBody or contentAreaCache is initialized.");
         return;
     }
    console.log(`[${Date.now()}] loadAndRenderWallets: Start. Filters:`, filters, `Page:`, page);
    try {
        const targetPage = page;
        const offset = (targetPage - 1) * rowsPerPage;
        const options = {
            ...filters,
            limit: rowsPerPage,
            offset: offset,
            sortBy: 'createdAt',
            sortOrder: 'DESC'
        };
        console.log(`[${Date.now()}] loadAndRenderWallets: Requesting wallets with options:`, options);
        const { wallets, totalCount } = await window.dbAPI.getWallets(options);
        console.log(`[${Date.now()}] loadAndRenderWallets: Received ${wallets?.length} wallets, totalCount: ${totalCount}`);

        tableBody.innerHTML = '';

        if (wallets && wallets.length > 0) {
            wallets.forEach((wallet, index) => {
                const rowElement = createWalletRowElement(wallet, index, offset);
                tableBody.appendChild(rowElement);
            });
        } else {
            tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px;">没有找到匹配的钱包。</td></tr>';
        }

        currentPage = targetPage;
        console.log(`[${Date.now()}] loadAndRenderWallets: Rendering pagination for page ${currentPage}`);
        renderPagination(totalCount, rowsPerPage, currentPage);
        // 注意：确保 setupCheckAll 能访问到正确的 contentArea
        setupCheckAll(contentAreaCache, '.wallet-table');
        console.log(`[${Date.now()}] loadAndRenderWallets: End successfully.`);

    } catch (error) {
        console.error(`[${Date.now()}] loadAndRenderWallets: Error loading/rendering wallets:`, error);
        tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px; color: red;">加载钱包数据时出错。</td></tr>';
    }
}

/**
 * 根据钱包数据对象创建一个表格行 (<tr>) HTML 元素。
 * @param {object} wallet - 从数据库获取的钱包对象。
 * @param {number} index - 当前行在当前页的从 0 开始的索引。
 * @param {number} offset - 当前页的起始偏移量。
 * @returns {HTMLElement} - 创建的 <tr> 元素。
 */
function createWalletRowElement(wallet, index, offset) {
    const tr = document.createElement('tr');
    tr.dataset.id = wallet.id;

    const sequenceNumber = offset + index + 1;
    let privateKeyDisplay = '<span class="text-muted">未存储</span>';
    if (wallet.encryptedPrivateKey) {
        const shortKey = shortenString(wallet.encryptedPrivateKey, 6, 4);
        privateKeyDisplay = `<code class="encrypted-data" title="私钥已加密存储">${shortKey}</code>`;
    }
    let mnemonicDisplay = '<span class="text-muted">未存储</span>';
    if (wallet.mnemonic) {
        const shortMnemonic = shortenString(wallet.mnemonic, 6, 4);
        mnemonicDisplay = `<code class="encrypted-data" title="助记词已加密存储">${shortMnemonic}</code>`;
    }

    // 先设置不包含余额列的 innerHTML
    tr.innerHTML = `
        <td><input type="checkbox"></td>
        <td>${sequenceNumber}</td>
        <td class="wallet-address-cell">
            <span>${truncateAddress(wallet.address)}</span>
        </td>
        <td>${privateKeyDisplay}</td>
        <td>${mnemonicDisplay}</td>
        <!-- 余额占位 -->
        <td>${wallet.notes || ''}</td>
        <td class="group-cell">${wallet.groupName || ''}</td>
        <td class="actions-cell">
            <button class="btn-icon" title="查看详情" data-action="查看详情"><i class="fas fa-eye"></i></button>
            <button class="btn-icon" title="编辑" data-action="编辑"><i class="fas fa-pencil-alt"></i></button>
            <button class="btn-icon" title="删除" data-action="删除"><i class="fas fa-trash-alt"></i></button>
        </td>
    `;

    // *** 修改：单独创建余额单元格和内容元素 ***
    const balanceTd = document.createElement('td');
    const balanceElement = document.createElement('span');
    balanceElement.id = `balance-${wallet.id}`;
    balanceElement.className = 'balance-loading text-muted';
    balanceElement.textContent = '加载中...';
    balanceTd.appendChild(balanceElement);

    // 将余额单元格插入到正确的位置 (助记词后面，备注前面)
    // 注意：列的索引从 0 开始，插入到索引 5 的位置 (第 6 列)
    const mnemonicTd = tr.cells[4]; // 获取助记词单元格 (索引4)
    tr.insertBefore(balanceTd, mnemonicTd.nextSibling); // 插入到助记词后面

    // --- 异步获取/更新余额 (现在直接操作 balanceElement) --- 
    (async (elementToUpdate) => {
        const address = wallet.address;
        const now = Date.now();
        const cachedEntry = balanceCache.get(address);

        // 检查缓存
        if (cachedEntry && (now - cachedEntry.timestamp < CACHE_DURATION_MS)) {
            // console.log(`[Table] Using cached balance for ${address}`);
            const displayBalance = parseFloat(cachedEntry.balanceFormatted).toFixed(4);
            elementToUpdate.textContent = `${displayBalance} ETH`;
            elementToUpdate.className = ''; // 清除加载和提示样式
            elementToUpdate.title = `余额: ${cachedEntry.balanceFormatted} ETH`;
            return; // 命中缓存
        }

        // --- 缓存无效或不存在 --- 
        elementToUpdate.textContent = '查询中...';
        elementToUpdate.className = 'balance-loading text-muted';
        
        try {
            // console.log(`[Table] Fetching balance for ${address}`);
            const result = await window.walletAPI.getBalance(address);

            if (result && result.error === null && result.balanceFormatted !== null) {
                const displayBalance = parseFloat(result.balanceFormatted).toFixed(4);
                elementToUpdate.textContent = `${displayBalance} ETH`;
                elementToUpdate.className = ''; 
                elementToUpdate.title = `余额: ${result.balanceFormatted} ETH`;
                // 更新缓存
                balanceCache.set(address, { 
                    balanceFormatted: result.balanceFormatted, 
                    timestamp: Date.now() 
                });
            } else {
                elementToUpdate.textContent = '获取失败';
                elementToUpdate.className = 'text-danger'; // 错误样式
                elementToUpdate.title = result?.error || '获取余额时发生未知错误';
            }
        } catch (error) {
            console.error(`[Table] Error fetching balance for ${address}:`, error);
            elementToUpdate.textContent = '错误';
            elementToUpdate.className = 'text-danger'; 
            elementToUpdate.title = error.message;
        }
    })(balanceElement);

    return tr;
}

/**
 * 渲染分页控件。
 * @param {number} totalItems - 总记录数。
 * @param {number} itemsPerPage - 每页记录数。
 * @param {number} currentPage - 当前页码。
 */
function renderPagination(totalItems, itemsPerPage, currentPage) {
    if (!paginationContainer || !pageSizeContainer) {
        console.warn("renderPagination called before paginationContainer or pageSizeContainer is initialized.");
        return;
    }
    // 更新页面大小选择器的值（如果存在且不匹配）
    const pageSizeSelect = pageSizeContainer?.querySelector('.page-size-select');
    if (pageSizeSelect && parseInt(pageSizeSelect.value) !== itemsPerPage) {
        pageSizeSelect.value = itemsPerPage.toString();
    }

    paginationContainer.innerHTML = ''; // 清空现有分页
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // --- 始终创建并显示页码信息（总条数） ---
    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    // 确保 currentPage 和 totalPages 至少为 1
    const displayPage = Math.max(1, currentPage); 
    const displayTotalPages = Math.max(1, totalPages); 
    pageInfo.textContent = `${displayPage}/${displayTotalPages}页 共${totalItems}条`;
    pageInfo.style.marginRight = '15px';
    paginationContainer.appendChild(pageInfo);
    // --- ------------------------------------ ---

    // 如果只有一页或没有数据，则不显示分页按钮
    if (totalPages <= 1) {
        return;
    }

    // --- 只有在有多页时才添加分页按钮 --- 
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '&laquo;';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', async () => {
        if (currentPage > 1) { 
            const targetPage = currentPage - 1;
            await loadAndRenderWallets(currentFilters, targetPage); 
        }
    });
    paginationContainer.appendChild(prevButton);

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
     if (startPage > 1) {
        const firstButton = document.createElement('button'); firstButton.textContent = '1';
        firstButton.addEventListener('click', async () => { 
            await loadAndRenderWallets(currentFilters, 1); 
        });
        paginationContainer.appendChild(firstButton);
        if (startPage > 2) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; ellipsis.style.padding = '0 10px'; paginationContainer.appendChild(ellipsis); }
    }
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button'); pageButton.textContent = i;
        if (i === currentPage) { pageButton.classList.add('active'); }
        const pageNumber = i; 
        pageButton.addEventListener('click', async () => { 
            await loadAndRenderWallets(currentFilters, pageNumber); 
        });
        paginationContainer.appendChild(pageButton);
    }
     if (endPage < totalPages) {
         if (endPage < totalPages - 1) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; ellipsis.style.padding = '0 10px'; paginationContainer.appendChild(ellipsis); }
        const lastButton = document.createElement('button'); lastButton.textContent = totalPages;
        lastButton.addEventListener('click', async () => { 
            await loadAndRenderWallets(currentFilters, totalPages); 
        });
        paginationContainer.appendChild(lastButton);
    }

    const nextButton = document.createElement('button');
    nextButton.innerHTML = '&raquo;';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', async () => {
        if (currentPage < totalPages) { 
            const targetPage = currentPage + 1;
            await loadAndRenderWallets(currentFilters, targetPage); 
        }
    });
    paginationContainer.appendChild(nextButton);
    // --- ----------------------------- ---
}

/**
 * 获取当前选中的钱包 ID 列表。
 * @returns {Array<number>}
 */
export function getSelectedWalletIds() {
     if (!contentAreaCache) return [];
     const checkedRows = contentAreaCache.querySelectorAll('.wallet-table tbody input[type="checkbox"]:checked');
     const walletIds = Array.from(checkedRows)
         .map(cb => cb.closest('tr')?.dataset.id)
         .filter(id => id)
         .map(id => parseInt(id));
     return walletIds;
}

/**
 * 获取localStorage中保存的每页行数设置
 * @returns {number}
 */
export function getPersistedRowsPerPage() {
    const savedRowsPerPage = localStorage.getItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE);
    if (savedRowsPerPage) {
        const parsedSize = parseInt(savedRowsPerPage, 10);
        const validOptions = [5, 10, 15, 25, 50, 100];
        if (validOptions.includes(parsedSize)) {
            return parsedSize;
        } else {
             localStorage.removeItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE); // 移除无效值
        }
    }
    return 15; // 返回默认值
} 