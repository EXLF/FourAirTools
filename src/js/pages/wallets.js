import { setupTableActions, setupFilteringAndSearch, setupCheckAll } from '../components/tableHelper.js';
// import { truncateAddress } from '../utils/index.js'; // 可能需要用于某些操作

// 导入数据库操作函数和工具函数
// 注意：这里使用了 require，假设运行环境支持 (如 Electron Renderer with nodeIntegration)
// 如果是纯浏览器环境，DB 交互需要通过 IPC 发送到主进程处理
// const {
//     getWallets, deleteWallet, getGroups, addWallet, updateWallet, getWalletById,
//     addGroup, updateGroup, deleteGroup, getWalletsByIds // 导入所有需要的函数
// } = require('../db');
import { truncateAddress } from '../utils/index.js';
import { debounce } from '../utils/index.js';
import { showModal, hideModal } from '../components/modal.js'; // 导入模态框函数
import { showToast } from '../components/toast.js'; // <-- 导入 showToast

// 存储当前筛选和分页状态
let currentFilters = {};
let currentPage = 1;
let rowsPerPage = 15; // 默认值
const LOCAL_STORAGE_KEY_ROWS_PER_PAGE = 'walletsPage_rowsPerPage'; // 定义 localStorage 键

// 缓存 DOM 元素
let tableBody;
let groupFilterSelect;
// let chainFilterSelect; // Removed
// let typeFilterSelect; // Removed
let searchInput;
let paginationContainer;
let pageSizeContainer; // 新增: 存储页面大小选择器的容器
let contentAreaCache; // 缓存 contentArea

/**
 * 初始化钱包页面。
 * 设置表格操作、筛选、全选和头部按钮。
 * 从数据库加载初始数据。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export async function initWalletsPage(contentArea) {
    // 加载持久化的设置
    const savedRowsPerPage = localStorage.getItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE);
    if (savedRowsPerPage) {
        rowsPerPage = parseInt(savedRowsPerPage, 10);
        // 可选：添加验证，确保加载的值在允许范围内
        const validOptions = [5, 10, 15, 25, 50, 100];
        if (!validOptions.includes(rowsPerPage)) {
            rowsPerPage = 15; // 如果无效，重置为默认值
            localStorage.removeItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE); // 移除无效值
        }
    }

    console.log(`正在初始化钱包页面 (IPC 版本)... 每页显示: ${rowsPerPage}`);
    contentAreaCache = contentArea; // 缓存供其他函数使用

    // 缓存页面元素
    tableBody = contentArea.querySelector('.wallet-table tbody');
    groupFilterSelect = contentArea.querySelector('#wallet-group-filter');
    // chainFilterSelect = contentArea.querySelector('#wallet-chain-filter'); // Removed
    // typeFilterSelect = contentArea.querySelector('#wallet-type-filter'); // Removed
    searchInput = contentArea.querySelector('.table-search-input');
    paginationContainer = contentArea.querySelector('.pagination');

    if (!tableBody || !groupFilterSelect || !searchInput || !paginationContainer) {
        console.error("钱包页面缺少必要的 DOM 元素！");
        return;
    }

    // 创建并插入页面大小选择器 (它会读取当前的 rowsPerPage)
    createPageSizeSelector();

    // 检查 dbAPI 是否通过 preload 脚本成功注入
    if (typeof window.dbAPI === 'undefined') {
        console.error("错误: window.dbAPI 未定义! Preload 脚本可能未正确加载或配置。");
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 20px; color: red;">应用程序配置错误，无法访问数据库。</td></tr>';
        return;
    }

    // 设置表格通用功能
    setupTableActions(contentArea, '.wallet-table', handleWalletAction);
    setupCheckAll(contentArea, '.wallet-table');

    // --- 新增：点击行内空白区域切换复选框 ---
    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const target = event.target;
            const row = target.closest('tr');
            if (!row) return; // 点击的不是表格行内

            // 检查是否点击在操作按钮、按钮图标、链接或复选框本身
            if (target.tagName === 'BUTTON' || 
                target.closest('button') || // 点击在按钮图标上
                target.tagName === 'A' || 
                target.tagName === 'INPUT' && target.type === 'checkbox') {
                return; // 如果是这些元素，则不触发切换
            }
            
            // 找到行内的复选框
            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) {
                // 切换选中状态
                checkbox.checked = !checkbox.checked;
                // 手动触发 change 事件，以更新 setupCheckAll 的状态
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
    // --- ---------------------------------- ---

    // 设置筛选和搜索的事件监听器
    setupFilterListeners();

    // 为头部按钮添加监听器 (保留占位符)
    const generateBtn = contentArea.querySelector('#bulk-generate-wallets-btn'); // 使用ID
    const importBtn = contentArea.querySelector('#import-wallets-btn'); // 使用ID
    const exportBtn = contentArea.querySelector('#export-wallets-btn'); // 使用ID
    const manageGroupsBtn = contentArea.querySelector('#manage-groups-btn'); // 使用ID
    const bulkDeleteBtn = contentArea.querySelector('#bulk-delete-btn');

    if (generateBtn) {
        generateBtn.addEventListener('click', openGenerateWalletsModal);
    }
    if (importBtn) {
        importBtn.addEventListener('click', handleImportWallets);
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportWallets);
    }
    if (manageGroupsBtn) {
        manageGroupsBtn.addEventListener('click', openManageGroupsModal);
    }
    if (bulkDeleteBtn) { 
        bulkDeleteBtn.addEventListener('click', handleBulkDelete);
    }

    // 加载分组过滤器选项
    await loadGroupFilters();

    // 加载并渲染初始钱包数据
    await loadAndRenderWallets();
}

/**
 * 配置页面大小选择器 (不再创建，而是配置模板中已有的)
 */
function createPageSizeSelector() {
    // 查找模板中已存在的容器和下拉框
    pageSizeContainer = contentAreaCache?.querySelector('.page-size-selector');
    const select = pageSizeContainer?.querySelector('.page-size-select');

    if (!pageSizeContainer || !select) {
        console.warn("未找到 .page-size-selector 或其内部的 .page-size-select，无法配置页面大小选择器。");
        return;
    }

    // 清空现有选项，以防重复添加
    select.innerHTML = '';

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

    // 移除旧的监听器（以防万一）
    select.removeEventListener('change', handlePageSizeChange);
    // 添加事件监听器
    select.addEventListener('change', handlePageSizeChange);

    // --- 移除所有动态创建和插入容器/包装器的逻辑 --- 
}

// 新增：处理页面大小变化的独立函数
async function handlePageSizeChange(event) {
    const select = event.target;
    const newSize = parseInt(select.value);
    if (newSize !== rowsPerPage) {
        rowsPerPage = newSize;
        currentPage = 1; 
        // 将新设置保存到 localStorage
        localStorage.setItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE, newSize.toString());
        await loadAndRenderWallets(); 
    }
}

/**
 * 设置筛选器和搜索框的事件监听器。
 * 当筛选条件改变时，重置页码并重新加载数据。
 */
function setupFilterListeners() {
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
async function loadGroupFilters() {
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
        // 可以在界面上显示错误提示
    }
}

/**
 * 从数据库加载钱包数据并渲染到表格中。
 * @param {object} [filters={}] - 当前应用的筛选条件。
 * @param {number} [page=currentPage] - 要加载的目标页码，默认为全局当前页。
 */
async function loadAndRenderWallets(filters = currentFilters, page = currentPage) {
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

    // 计算序号 (从 1 开始)
    const sequenceNumber = offset + index + 1;

    let privateKeyDisplay = '<span style="color: #aaa;">未存储</span>';
    if (wallet.encryptedPrivateKey) {
        const encryptedKey = wallet.encryptedPrivateKey;
        const truncatedKey = encryptedKey.length > 10 ?
                                `${encryptedKey.substring(0, 6)}...${encryptedKey.substring(encryptedKey.length - 4)}` :
                                '******';
        privateKeyDisplay = `<span title="私钥已存储 (未加密)">${truncatedKey}</span>`;
    }

    let mnemonicDisplay = '<span style="color: #aaa;">未存储</span>';
    if (wallet.mnemonic) {
        const words = wallet.mnemonic.split(' ').filter(w => w);
        let truncatedMnemonic = '******'; 
        if (words.length >= 4) {
            truncatedMnemonic = `${words[0]} ${words[1]} ... ${words[words.length - 2]} ${words[words.length - 1]}`;
        } else if (words.length > 0) {
            truncatedMnemonic = words.join(' ');
        }
        mnemonicDisplay = `<span title="助记词已存储">${truncatedMnemonic}</span>`;
    }

    tr.innerHTML = `
        <td><input type="checkbox"></td>
        <td>${sequenceNumber}</td>
        <td class="wallet-address-cell">
            <span>${truncateAddress(wallet.address)}</span>
        </td>
        <td>${privateKeyDisplay}</td>
        <td>${mnemonicDisplay}</td>
        <td>${wallet.notes || ''}</td>
        <td class="group-cell">${wallet.groupName || ''}</td>
        <td class="actions-cell">
            <button class="btn-icon" title="查看详情"><i class="fas fa-eye"></i></button>
            <button class="btn-icon" title="编辑"><i class="fas fa-pencil-alt"></i></button>
            <button class="btn-icon" title="删除"><i class="fas fa-trash-alt"></i></button>
        </td>
    `;
    return tr;
}

/**
 * 处理钱包表格行内的操作按钮点击事件。
 * @param {string} action - 操作名称 ('查看详情', '编辑', '删除')。
 * @param {HTMLElement} rowElement - 表格行元素 (<tr>)。
 * @param {Array<string>} rowData - (可选，但我们现在用 rowElement.dataset.id)
 */
async function handleWalletAction(action, rowElement, rowData) {
    const walletId = parseInt(rowElement.dataset.id);
    if (!walletId) {
        console.error("无法从表格行获取钱包 ID");
        return;
    }
    const walletAddress = rowElement.querySelector('.wallet-address-cell span')?.textContent || `ID: ${walletId}`;

    console.log(`IPC: 钱包操作: "${action}" on Wallet ID: ${walletId} (${walletAddress})`);

    if (action === '删除') {
        // 使用自定义模态框进行确认
        showModal('tpl-confirm-dialog', (modalElement) => {
            const messageElement = modalElement.querySelector('.confirm-message');
            const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
            const cancelBtn = modalElement.querySelector('.modal-cancel-btn'); // modal.js 应该已处理关闭按钮

            if (!messageElement || !confirmBtn || !cancelBtn) {
                console.error("确认模态框缺少必要的元素。");
                hideModal(); // 关闭可能有问题的模态框
                return;
            }

            // 设置确认信息
            messageElement.textContent = `确定删除钱包 ${walletAddress} 吗？此操作不可撤销。`;

            // 确认按钮事件监听 (只添加一次)
            const handleConfirm = async () => {
                // 移除监听器，避免重复执行
                confirmBtn.removeEventListener('click', handleConfirm);
                
                // 添加加载状态 (可选)
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';

                try {
                    const changes = await window.dbAPI.deleteWallet(walletId);
                    if (changes > 0) {
                        console.log(`IPC: 钱包 ${walletId} 已删除。`);
                        showToast(`钱包 ${walletAddress} 已删除`, 'success');
                        // 成功删除后，隐藏模态框并刷新列表
                        hideModal(); 
                        await loadAndRenderWallets(); 
                    } else {
                        console.warn(`IPC: 删除钱包 ${walletId} 未报告更改。`);
                        showToast(`删除钱包 ${walletAddress} 操作未执行`, 'warning');
                         hideModal(); // 也要关闭模态框
                    }
                } catch (error) {
                    console.error(`IPC: 删除钱包 ${walletId} 失败:`, error);
                    showToast(`删除钱包失败: ${error.message}`, 'error');
                    // 即使失败也要恢复按钮状态并允许关闭模态框
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '确认'; 
                    // 可能不需要 hideModal()，让用户可以点取消
                }
                // 注意：finally 块不是必需的，因为成功时已经 hideModal
            };

            confirmBtn.addEventListener('click', handleConfirm);

            // 取消按钮事件监听 (通常 modal.js 会处理关闭，但可以明确添加)
            // cancelBtn.addEventListener('click', () => hideModal());
        });
        
    } else if (action === '编辑') {
        openWalletModal(walletId);
    } else if (action === '查看详情') {
        try {
            // 获取完整的钱包数据，因为列表可能只显示了部分信息
            console.log(`[${Date.now()}] handleWalletAction: Fetching details for wallet ID ${walletId}`);
            const walletData = await window.dbAPI.getWalletById(walletId);
            if (!walletData) {
                showToast(`错误：找不到 ID 为 ${walletId} 的钱包数据。`, 'error');
                return;
            }
            console.log(`[${Date.now()}] handleWalletAction: Wallet data received, opening details modal.`);
            openViewDetailsModal(walletData);
        } catch (error) {
            console.error(`[${Date.now()}] handleWalletAction: Error fetching wallet details for ID ${walletId}:`, error);
            showToast(`获取钱包详情失败: ${error.message}`, 'error');
        }
    }
}

/**
 * 打开钱包添加/编辑模态框。
 * @param {number} [walletId=null] - 如果提供 ID，则为编辑模式；否则为添加模式。
 */
async function openWalletModal(walletId = null) {
    const isEditMode = walletId !== null;
    let walletData = {};

    if (isEditMode) {
        try {
            walletData = await window.dbAPI.getWalletById(walletId);
            if (!walletData) {
                showToast(`错误：找不到 ID 为 ${walletId} 的钱包。`, 'error');
                return;
            }
        } catch (error) {
            console.error(`IPC: 获取钱包 ${walletId} 数据失败:`, error);
            showToast(`加载编辑数据失败: ${error.message}`, 'error');
            return;
        }
    }

    showModal('tpl-wallet-form', async (modalElement) => {
        const modalBox = modalElement.querySelector('.modal-box'); 
        const form = modalBox.querySelector('form');        
        const title = modalBox.querySelector('.modal-title'); 
        const saveBtn = modalBox.querySelector('.modal-save-btn'); 
        // 现在只剩这两个字段需要获取
        const groupSelect = modalBox.querySelector('#wallet-group'); 
        const notesTextarea = modalBox.querySelector('#wallet-notes');

        // 更新检查
        if (!modalBox || !form || !title || !saveBtn || !groupSelect || !notesTextarea) { 
             console.error("钱包表单模态框错误: 缺少必要的元素 (modal-box, form, title, saveBtn, groupSelect, notesTextarea)。"); 
             hideModal(); 
             return; 
         }

        // 填充逻辑简化
        if (isEditMode) {
            // 编辑模式
            title.textContent = `编辑钱包 (ID: ${walletId})`;
            form.elements['wallet-id'].value = walletId;
            notesTextarea.value = walletData.notes || '';
            // 填充分组
            try {
                const groups = await window.dbAPI.getGroups();
                groupSelect.innerHTML = '<option value="">无分组</option>';
                groups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    if (walletData.groupId === group.id) { 
                        option.selected = true;
                    }
                    groupSelect.appendChild(option);
                });
            } catch (error) {
                console.error("IPC: 填充分组下拉菜单失败:", error);
            }
        } else {
            // 添加模式 (现在这个模态框不用于添加了，但这部分逻辑可以保留以防未来改动)
            title.textContent = '添加新钱包'; // 或者在编辑模式下隐藏此模态框的入口?
            form.reset();
            form.elements['wallet-id'].value = ''; 
            // 填充分组下拉菜单（添加模式）
            try {
                const groups = await window.dbAPI.getGroups();
                groupSelect.innerHTML = '<option value="">无分组</option>';
                groups.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.id;
                    option.textContent = group.name;
                    groupSelect.appendChild(option);
                });
            } catch (error) {
                console.error("IPC: 填充分组下拉菜单失败:", error);
            }
        }

        const handleSubmit = async (event) => {
            event.preventDefault();
            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';

            const formData = new FormData(form);
            let dataToSave = {};

            if (isEditMode) {
                // 编辑模式：只获取备注和分组
                dataToSave = {
                    notes: formData.get('wallet-notes').trim() || null,
                    groupId: formData.get('wallet-group') ? parseInt(formData.get('wallet-group')) : null,
                };
                // 注意：name 字段已从表单移除，所以不再包含 dataToSave.name
            } else {
                // 添加模式逻辑保留，但实际上此表单不再用于添加
                // 如果需要添加功能，应使用包含所有字段的另一个模板或恢复此模板
                console.warn("尝试使用仅编辑的表单进行添加操作！");
                // ... (获取所有字段的逻辑 - 保持不变，但理论上不会执行)
            }

            try {
                if (isEditMode) {
                    console.log(`[${Date.now()}] handleSubmit: Updating wallet ${walletId} with data:`, dataToSave);
                    const changes = await window.dbAPI.updateWallet(walletId, dataToSave);
                    console.log(`IPC: 更新钱包 ${walletId} 结果: ${changes} 行受影响`);
                    if (changes > 0) {
                        showToast('钱包更新成功！', 'success');
                    } else {
                        showToast('未检测到更改', 'info');
                    }
                } else {
                    // 不应该在这里执行添加操作
                    showToast('错误：此表单仅用于编辑。', 'error'); 
                }
                 hideModal();
                 await loadAndRenderWallets(); // 无论如何都刷新一下列表
            } catch (error) {
                 console.error("IPC: 保存钱包失败:", error);
                 if (error.message && error.message.includes('UNIQUE constraint failed: wallets.address')) {
                     showToast(`保存失败：钱包地址 "${dataToSave.address}" 已存在！`, 'error');
                 } else {
                    showToast(`保存钱包失败: ${error.message}`, 'error');
                 }
                 saveBtn.disabled = false;
                 saveBtn.textContent = '保存';
            }
        };

        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);
    });
}

/**
 * 处理导入钱包按钮点击事件。
 */
function handleImportWallets() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            let successCount = 0, errorCount = 0; const errors = [];
            const importBtn = contentAreaCache?.querySelector('#import-wallets-btn');
            try {
                const walletsToImport = JSON.parse(e.target.result);
                if (!Array.isArray(walletsToImport)) { throw new Error("导入文件需为钱包对象数组。"); }
                if(importBtn) importBtn.disabled = true;

                for (const walletData of walletsToImport) {
                    if (!walletData.address) {
                        errors.push(`跳过无效条目 (缺少地址): ${JSON.stringify(walletData)}`); errorCount++; continue;
                    }
                    try {
                         walletData.groupId = walletData.groupId ? parseInt(walletData.groupId) : null;
                         const { chain, type, isBackedUp, ...dataToSave } = walletData;

                         await window.dbAPI.addWallet(dataToSave);
                         successCount++;
                    } catch (error) {
                        errorCount++;
                        if (error.message && error.message.includes('UNIQUE constraint failed: wallets.address')) {
                            errors.push(`地址 ${walletData.address} 已存在，跳过。`);
                        } else { errors.push(`导入 ${walletData.address} 失败: ${error.message}`); }
                    }
                }
                let message = `导入完成！成功 ${successCount}，失败 ${errorCount}。`;
                if (errors.length > 0) { message += "\n\n错误详情:\n" + errors.join('\n'); console.warn("导入错误:", errors); }
                showToast(message, 'success', 5000);
                if(importBtn) importBtn.disabled = false;
                await loadAndRenderWallets();

            } catch (error) { console.error("解析或导入失败:", error); showToast(`导入失败: ${error.message}`, 'error'); if(importBtn) importBtn.disabled = false; }
        };
        reader.onerror = (e) => { console.error("读取文件失败:", e); showToast("读取文件错误。", 'error'); };
        reader.readAsText(file);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

/**
 * 处理导出选中钱包的逻辑。
 */
async function handleExportWallets() {
     if (!contentAreaCache) return;
     const checkedRows = contentAreaCache.querySelectorAll('.wallet-table tbody input[type="checkbox"]:checked');
     if (checkedRows.length === 0) {
         showToast("请先选择要导出的钱包！", 'warning');
         return;
     }
     const walletIdsToExport = Array.from(checkedRows)
         .map(cb => cb.closest('tr')?.dataset.id)
         .filter(id => id)
         .map(id => parseInt(id));
         
     if (walletIdsToExport.length === 0) { 
         console.error("无法从选中的行获取钱包 ID。"); 
         showToast("无法获取选中的钱包ID", 'error');
         return; 
     }

    try {
        const walletsToExport = await window.dbAPI.getWalletsByIds(walletIdsToExport);
        if (!walletsToExport || walletsToExport.length === 0) {
            showToast("错误：无法获取选定钱包的数据。", 'error'); 
            return;
        }

        const exportData = walletsToExport.map(({ groupName, ...rest }) => rest);
        const jsonString = JSON.stringify(exportData, null, 2);

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultPath = `four-air-wallets-export-${timestamp}.json`;

        showToast('正在准备导出文件...', 'info');
        const result = await window.dbAPI.saveFile({ defaultPath: defaultPath, content: jsonString });

        if (result.success) {
            showToast(`成功导出 ${walletsToExport.length} 个钱包到 ${result.filePath}`, 'success', 5000);
            showToast(`**重要提示：** 导出的 JSON 文件包含钱包的明文私钥和助记词！请务必妥善保管此文件，强烈建议使用密码管理器或其他安全方式存储！`, 'warning', 10000);
        } else if (result.canceled) {
            showToast('导出已取消', 'info');
        } else {
            console.error("导出钱包失败:", result.error);
            showToast(`导出钱包失败: ${result.error || '未知错误'}`, 'error');
        }

    } catch (error) {
        console.error("IPC: 导出钱包时发生意外错误:", error);
        showToast(`导出钱包时发生错误: ${error.message}`, 'error');
    }
}

/**
 * 打开分组管理模态框。
 */
async function openManageGroupsModal() {
     showModal('tpl-manage-groups', async (modalElement) => {
        const groupListElement = modalElement.querySelector('.group-list');
        const newGroupNameInput = modalElement.querySelector('#new-group-name');
        const addGroupBtn = modalElement.querySelector('.add-group-btn');

        if (!groupListElement || !newGroupNameInput || !addGroupBtn) {
            console.error("分组管理模态框缺少必要的元素 (.group-list, #new-group-name, .add-group-btn)。");
            hideModal(); return;
        }

        const renderGroupList = async () => {
            groupListElement.innerHTML = '加载中...';
            try {
                const groups = await window.dbAPI.getGroups();
                groupListElement.innerHTML = ''; 
                if (groups.length === 0) {
                    groupListElement.innerHTML = '<li style="padding: 10px; text-align: center; color: #888;">暂无分组。</li>'; // 改进空状态样式
                    return;
                }
                groups.forEach(group => {
                    const li = document.createElement('li');
                    li.dataset.id = group.id;
                    // 应用 Flexbox 布局和样式
                    li.style.cssText = `
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 10px 5px;
                        border-bottom: 1px solid #eee;
                    `;

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = group.name;
                    nameSpan.style.flexGrow = '1'; // 让名称占据多余空间
                    nameSpan.style.marginRight = '10px'; // 与按钮保持距离

                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'group-actions';
                    actionsDiv.style.flexShrink = '0'; // 防止按钮被压缩

                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '<i class="fa fa-edit"></i>';
                    editBtn.title = '重命名';
                    editBtn.className = 'btn-icon btn-icon-sm'; // 使用小尺寸图标按钮
                    editBtn.style.marginRight = '5px'; // 按钮间距
                    
                    // --- 修改：行内编辑逻辑 ---
                    editBtn.addEventListener('click', () => {
                        // 切换到编辑状态
                        li.classList.add('editing'); // 添加编辑状态类，方便样式控制
                        nameSpan.style.display = 'none'; // 隐藏原始名称
                        actionsDiv.style.display = 'none'; // 隐藏编辑/删除按钮

                        // 创建输入框
                        const input = document.createElement('input');
                        input.type = 'text';
                        input.value = group.name;
                        input.className = 'input input-sm group-edit-input'; // 使用通用样式和小尺寸
                        input.style.flexGrow = '1';
                        input.style.marginRight = '10px';
                        // 改进输入框样式
                        input.style.fontSize = '14px';
                        input.style.padding = '8px 12px';
                        input.style.height = 'auto';
                        input.style.borderRadius = '4px';
                        input.style.border = '1px solid #ddd';

                        // 创建保存按钮
                        const saveBtn = document.createElement('button');
                        saveBtn.innerHTML = '<i class="fas fa-check"></i>';
                        saveBtn.title = '保存';
                        saveBtn.className = 'btn-icon btn-icon-sm btn-success'; // 绿色勾
                        saveBtn.style.marginRight = '5px';

                        // 创建取消按钮
                        const cancelBtn = document.createElement('button');
                        cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
                        cancelBtn.title = '取消';
                        cancelBtn.className = 'btn-icon btn-icon-sm btn-secondary'; // 灰色叉

                        // 临时编辑控件容器
                        const editControls = document.createElement('div');
                        editControls.className = 'group-edit-controls';
                        editControls.style.display = 'flex';
                        editControls.style.alignItems = 'center';
                        editControls.style.flexGrow = '1'; // 占据空间
                        editControls.appendChild(input);
                        editControls.appendChild(saveBtn);
                        editControls.appendChild(cancelBtn);
                        
                        // 将编辑控件插入到 span 前面（或替换 span）
                        li.insertBefore(editControls, nameSpan);
                        input.focus(); // 自动聚焦
                        input.select(); // 全选文本

                        // 取消编辑状态的函数
                        const cancelEdit = () => {
                            li.removeChild(editControls);
                            nameSpan.style.display = ''; // 恢复显示
                            actionsDiv.style.display = ''; // 恢复显示
                            li.classList.remove('editing');
                        };

                        // 保存按钮逻辑
                        saveBtn.addEventListener('click', async () => {
                            const newName = input.value.trim();
                            if (!newName) {
                                showToast('分组名称不能为空', 'warning');
                                return;
                            }
                            if (newName === group.name) {
                                cancelEdit(); // 名称未改变，直接取消编辑
                                return;
                            }
                            
                            // 可选：检查新名称是否与其他分组冲突 (不包括自身)
                            const otherGroupNames = Array.from(groupListElement.querySelectorAll('li:not(.editing) span'))
                                                        .map(span => span.textContent.toLowerCase());
                            if (otherGroupNames.includes(newName.toLowerCase())) {
                                showToast(`分组名称 "${newName}" 已存在`, 'warning');
                                return;
                            }

                            saveBtn.disabled = true; // 防止重复点击
                            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                            try {
                                await window.dbAPI.updateGroup(group.id, newName);
                                showToast(`分组已重命名为 "${newName}"`, 'success');
                                // 更新成功后，直接修改界面上的文本并退出编辑状态
                                group.name = newName; // 更新内存中的名字
                                nameSpan.textContent = newName;
                                cancelEdit();
                                // 刷新主页面的筛选器
                                await loadGroupFilters(); 
                            } catch (error) {
                                if (error.message && error.message.includes('UNIQUE constraint failed: groups.name')) {
                                    showToast(`重命名失败：分组名称 "${newName}" 已存在！`, 'error');
                                } else {
                                    showToast(`重命名分组失败: ${error.message}`, 'error');
                                }
                                saveBtn.disabled = false; // 恢复按钮
                                saveBtn.innerHTML = '<i class="fas fa-check"></i>';
                            }
                        });

                        // 取消按钮逻辑
                        cancelBtn.addEventListener('click', cancelEdit);
                        
                        // 回车键保存，Esc键取消
                        input.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                saveBtn.click();
                            } else if (e.key === 'Escape') {
                                cancelEdit();
                            }
                        });
                    });
                    // --- 行内编辑逻辑结束 ---

                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '<i class="fa fa-trash"></i>';
                    deleteBtn.title = '删除';
                    deleteBtn.className = 'btn-icon btn-icon-sm'; // 使用小尺寸图标按钮
                     if (group.name === '默认分组') {
                         deleteBtn.disabled = true;
                         deleteBtn.title = '不能删除默认分组';
                         deleteBtn.style.opacity = '0.5'; // 视觉上灰显
                         deleteBtn.style.cursor = 'not-allowed';
                     } else {
                         deleteBtn.addEventListener('click', async () => {
                            // 使用自定义模态框确认
                            showModal('tpl-confirm-dialog', (confirmModalElement) => {
                                const messageElement = confirmModalElement.querySelector('.confirm-message');
                                const confirmBtnModal = confirmModalElement.querySelector('.modal-confirm-btn');
                                const cancelBtnModal = confirmModalElement.querySelector('.modal-cancel-btn');

                                if (!messageElement || !confirmBtnModal || !cancelBtnModal) {
                                    console.error("确认模态框缺少必要的元素。");
                                    hideModal(); return;
                                }

                                messageElement.innerHTML = `确定删除分组 "<b>${group.name}</b>"？<br>与此分组关联的钱包或社交账户将变为"无分组"。`; // 使用 innerHTML 加粗并换行

                                const handleConfirmGroupDelete = async () => {
                                    confirmBtnModal.removeEventListener('click', handleConfirmGroupDelete);
                                    hideModal(); // 关闭确认框

                                    try {
                                        await window.dbAPI.deleteGroup(group.id);
                                        showToast(`分组 "${group.name}" 已删除`, 'success');
                                        await renderGroupList(); // 刷新分组列表
                                        await loadGroupFilters(); // 刷新主页筛选器
                                        await loadAndRenderWallets(); // 刷新钱包列表（因为分组可能变了）
                                        // 如果社交页面也使用了分组，理想情况下也应该通知刷新，但这比较复杂，暂时省略
                                    } catch (error) {
                                        showToast(`删除分组失败: ${error.message}`, 'error');
                                    }
                                };
                                confirmBtnModal.addEventListener('click', handleConfirmGroupDelete);
                            });
                         });
                     }

                    actionsDiv.appendChild(editBtn);
                    actionsDiv.appendChild(deleteBtn);
                    li.appendChild(nameSpan);
                    li.appendChild(actionsDiv);
                    groupListElement.appendChild(li);
                });
                // 移除最后一个元素的下边框
                if (groupListElement.lastElementChild) {
                    groupListElement.lastElementChild.style.borderBottom = 'none';
                }
            } catch (error) {
                console.error("IPC: 加载分组列表失败:", error);
                groupListElement.innerHTML = '<li style="padding: 10px; color:red;">加载分组失败。</li>';
            }
        };

        const handleAddGroup = async () => {
            const name = newGroupNameInput.value.trim();
            if (name) {
                addGroupBtn.disabled = true;
                try {
                    await window.dbAPI.addGroup(name);
                    showToast(`分组 "${name}" 添加成功`, 'success');
                    newGroupNameInput.value = '';
                    await renderGroupList();
                    await loadGroupFilters();
                } catch (error) {
                     if (error.message && error.message.includes('UNIQUE constraint failed: groups.name')) {
                         showToast(`添加失败：分组名称 "${name}" 已存在！`, 'error');
                     } else {
                        showToast(`添加分组失败: ${error.message}`, 'error');
                     }
                } finally {
                    addGroupBtn.disabled = false;
                }
            }
        };

        const groupAddContainer = addGroupBtn.closest('.group-add-form');
        if (groupAddContainer) {
             groupAddContainer.addEventListener('submit', (e) => e.preventDefault());

            groupAddContainer.addEventListener('click', (e) => {
                if (e.target === addGroupBtn || e.target.closest('.add-group-btn')) {
                    handleAddGroup();
                }
            });
            newGroupNameInput.addEventListener('keypress', (e) => {
                 if (e.key === 'Enter') {
                     e.preventDefault();
                     handleAddGroup();
                 }
            });
        } else {
             addGroupBtn.addEventListener('click', handleAddGroup);
        }

        await renderGroupList();
     });
}

/**
 * 渲染分页控件。
 * @param {number} totalItems - 总记录数。
 * @param {number} itemsPerPage - 每页记录数。
 * @param {number} currentPage - 当前页码。
 */
function renderPagination(totalItems, itemsPerPage, currentPage) {
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
    
    // 确保在所有分页控件（包括页面大小选择器）都添加到DOM后初始化自定义下拉框
    if (window.initCustomSelects) {
        window.initCustomSelects();
    }
}

/**
 * 打开批量生成钱包模态框。
 */
async function openGenerateWalletsModal() {
    console.log(`[${Date.now()}] openGenerateWalletsModal: Start`);
    
    await Promise.resolve();
    
    console.log(`[${Date.now()}] openGenerateWalletsModal: Calling showModal`);
    showModal('tpl-generate-wallets', async (modalElement) => {
        console.log(`[${Date.now()}] openGenerateWalletsModal: showModal callback started`);
        const form = modalElement.querySelector('#generate-wallet-form');
        const countInput = modalElement.querySelector('#generate-count');
        const groupSelect = modalElement.querySelector('#generate-group');
        const generateBtn = modalElement.querySelector('.modal-generate-btn');
        const cancelBtn = modalElement.querySelector('.modal-cancel-btn');
        const progressDiv = modalElement.querySelector('#generate-progress');
        const progressBar = progressDiv.querySelector('progress');
        const progressText = progressDiv.querySelector('#generate-progress-text');

        if (!form || !countInput || !groupSelect || !generateBtn || !cancelBtn || !progressDiv || !progressBar || !progressText) {
            console.error(`[${Date.now()}] openGenerateWalletsModal: Missing elements`);
            hideModal(); return;
        }

        generateBtn.style.display = 'inline-block';
        cancelBtn.style.display = 'inline-block';
        cancelBtn.textContent = '取消';
        progressDiv.style.display = 'none';
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<i class="fa fa-cogs"></i> 开始生成';

        console.log(`[${Date.now()}] openGenerateWalletsModal: Attempting focus with improved method`);
        
        try {
            countInput.focus();
            console.log(`[${Date.now()}] openGenerateWalletsModal: Immediate focus attempt`);
        } catch (e) {
            console.error(`[${Date.now()}] openGenerateWalletsModal: Immediate focus failed`, e);
        }
        
        const attemptFocus = (attempt = 1) => {
            if (attempt > 5) return;
            
            const delay = attempt * 50;
            
            setTimeout(() => {
                if (modalElement.isConnected && countInput && document.body.contains(countInput)) {
                    try {
                        countInput.focus();
                        console.log(`[${Date.now()}] openGenerateWalletsModal: Focus attempt ${attempt} at ${delay}ms`);
                    } catch (e) {
                        console.error(`[${Date.now()}] openGenerateWalletsModal: Focus attempt ${attempt} failed`, e);
                    }
                    attemptFocus(attempt + 1);
                }
            }, delay);
        };
        
        requestAnimationFrame(() => {
            attemptFocus();
        });

        try {
            const groups = await window.dbAPI.getGroups();
            groupSelect.innerHTML = '<option value="">不指定分组</option>';
            let defaultGroupId = "";

            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                groupSelect.appendChild(option);

                if (group.name === '默认分组') {
                    defaultGroupId = group.id;
                }
            });

            if (defaultGroupId !== "") {
                groupSelect.value = defaultGroupId;
            }

        } catch (error) {
            console.error("IPC: 填充生成模态框分组失败:", error);
        }

        const handleGenerateSubmit = async (event) => {
            event.preventDefault();
            const count = parseInt(countInput.value);
            const groupId = groupSelect.value ? parseInt(groupSelect.value) : null;

            if (isNaN(count) || count <= 0) {
                showToast("请输入有效的生成数量 (大于0)。", 'warning');
                return;
            }
            if (count > 1000) {
                showToast("一次最多生成 1000 个钱包。", 'warning');
                return;
            }

            generateBtn.disabled = true;
            generateBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> 生成中...';
            progressDiv.style.display = 'block';
            progressBar.value = 0;
            progressBar.max = count;
            progressText.textContent = `正在生成 0 / ${count}...`;

            try {
                console.log(`请求批量生成: ${count} 个钱包, 分组ID: ${groupId}`);
                const result = await window.dbAPI.generateWallets({ count, groupId });
                console.log("批量生成结果:", result);

                let message = `批量生成完成！\n成功生成 ${result.generatedCount} 个钱包。`;
                if (result.errors && result.errors.length > 0) {
                    message += `\n\n出现 ${result.errors.length} 个错误:\n - ${result.errors.slice(0, 10).join('\n - ')}`;
                    if (result.errors.length > 10) message += '\n - ... (更多错误请查看控制台)';
                    console.warn("批量生成错误:", result.errors);
                }

                progressBar.value = progressBar.max;
                progressText.innerHTML = message.replace(/\n/g, '<br>');

                generateBtn.style.display = 'none';
                cancelBtn.textContent = '关闭';
                cancelBtn.style.display = 'inline-block';

                requestAnimationFrame(() => {
                    setTimeout(loadAndRenderWallets, 0);
                });

            } catch (error) {
                console.error("IPC: 调用钱包生成功能失败:", error);
                
                progressText.textContent = `批量生成过程中发生错误: ${error.message}`;
                progressText.style.color = 'red';
                
                generateBtn.disabled = false;
                generateBtn.innerHTML = '<i class="fa fa-cogs"></i> 重新生成';
                generateBtn.style.display = 'inline-block';
                cancelBtn.style.display = 'inline-block';
                cancelBtn.textContent = '取消';
            }
        };

        form.removeEventListener('submit', handleGenerateSubmit);
        form.addEventListener('submit', handleGenerateSubmit);

        cancelBtn.removeEventListener('click', hideModal);
        cancelBtn.addEventListener('click', hideModal);
    });
}

async function handleBulkDelete() {
    console.log(`[${Date.now()}] handleBulkDelete: Start`);
    
    const checkboxes = document.querySelectorAll('.wallet-table tbody input[type="checkbox"]:checked');
    const count = checkboxes.length;

    if (count === 0) {
        showToast('请至少选择一个钱包', 'error');
        return;
    }

    // --- 新增：使用自定义模态框确认 --- 
    showModal('tpl-confirm-dialog', (modalElement) => {
        const messageElement = modalElement.querySelector('.confirm-message');
        const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
        const cancelBtn = modalElement.querySelector('.modal-cancel-btn');

        if (!messageElement || !confirmBtn || !cancelBtn) {
            console.error("确认模态框缺少必要的元素。");
            hideModal(); return;
        }

        messageElement.textContent = `确定删除选中的 ${count} 个钱包吗？此操作不可撤销！`;

        const handleConfirmBulkDelete = async () => {
            confirmBtn.removeEventListener('click', handleConfirmBulkDelete);
            hideModal(); // 先关闭确认框

            // --- 原有的批量删除逻辑开始 ---
            const bulkGenWalletsBtn = document.getElementById('bulk-generate-wallets-btn');
            const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
            const exportWalletsBtn = document.getElementById('export-wallets-btn'); 
            const importWalletsBtn = document.getElementById('import-wallets-btn'); 

            if (bulkGenWalletsBtn) bulkGenWalletsBtn.disabled = true;
            if (bulkDeleteBtn) bulkDeleteBtn.disabled = true;
            if (exportWalletsBtn) exportWalletsBtn.disabled = true;
            if (importWalletsBtn) importWalletsBtn.disabled = true;

            showToast(`正在删除 ${count} 个钱包...`, 'info');
            
            let timeInterval = null; 
            try {
                const ids = Array.from(checkboxes).map(cb => {
                    const row = cb.closest('tr');
                    return row ? row.dataset.id : null;
                }).filter(id => id);
                
                if (ids.length === 0) {
                    showToast('无法获取选中的钱包ID', 'error');
                    if (bulkGenWalletsBtn) bulkGenWalletsBtn.disabled = false;
                    if (bulkDeleteBtn) bulkDeleteBtn.disabled = false;
                    if (exportWalletsBtn) exportWalletsBtn.disabled = false;
                    if (importWalletsBtn) importWalletsBtn.disabled = false;
                    return;
                }
                
                console.log(`[${Date.now()}] handleBulkDelete: Calling IPC deleteWalletsByIds for ${ids.length} wallets`);
                
                let elapsedTime = 0;
                timeInterval = setInterval(() => { 
                    elapsedTime += 0.5;
                    showToast(`正在删除钱包 (${elapsedTime.toFixed(1)}秒)...`, 'info');
                }, 500);
                
                const result = await window.dbAPI.deleteWalletsByIds(ids);
                clearInterval(timeInterval); 
                timeInterval = null; 
                
                console.log(`[${Date.now()}] handleBulkDelete: IPC deleteWalletsByIds returned`, result);
                
                if (result) {
                    showToast(`成功删除 ${count} 个钱包`, 'success');
                    if (count > 50) {
                        console.log(`[${Date.now()}] handleBulkDelete: Large delete (${count}), reloading page.`);
                        showToast('操作完成，正在刷新页面...', 'info');
                        setTimeout(() => { window.location.reload(); }, 1500);
                    } else {
                        console.log(`[${Date.now()}] handleBulkDelete: Small delete (${count}), reloading wallets table.`);
                        await loadAndRenderWallets(); 
                        console.log(`[${Date.now()}] handleBulkDelete: Wallets table reloaded after small delete.`);
                        if (bulkGenWalletsBtn) bulkGenWalletsBtn.disabled = false;
                        if (bulkDeleteBtn) bulkDeleteBtn.disabled = false;
                        if (exportWalletsBtn) exportWalletsBtn.disabled = false;
                        if (importWalletsBtn) importWalletsBtn.disabled = false;
                    }
                } else {
                    console.warn(`[${Date.now()}] handleBulkDelete: IPC deleteWalletsByIds reported failure (result: ${result})`);
                    showToast('删除钱包失败', 'error');
                    if (bulkGenWalletsBtn) bulkGenWalletsBtn.disabled = false;
                    if (bulkDeleteBtn) bulkDeleteBtn.disabled = false;
                    if (exportWalletsBtn) exportWalletsBtn.disabled = false;
                    if (importWalletsBtn) importWalletsBtn.disabled = false;
                }
            } catch (error) {
                if (timeInterval) { clearInterval(timeInterval); timeInterval = null; }
                console.error(`[${Date.now()}] handleBulkDelete: Error during bulk delete:`, error);
                showToast(`删除钱包时出错: ${error.message}`, 'error');
                if (bulkGenWalletsBtn) bulkGenWalletsBtn.disabled = false;
                if (bulkDeleteBtn) bulkDeleteBtn.disabled = false;
                if (exportWalletsBtn) exportWalletsBtn.disabled = false;
                if (importWalletsBtn) importWalletsBtn.disabled = false;
            } finally {
                console.log(`[${Date.now()}] handleBulkDelete: Finished.`);
            }
            // --- 原有的批量删除逻辑结束 ---
        };

        confirmBtn.addEventListener('click', handleConfirmBulkDelete);
        // cancelBtn 由 modal.js 处理关闭
    });
    // --- ---------------------------- ---
}

/**
 * 打开查看钱包详情模态框。
 * @param {object} walletData - 包含完整钱包信息的对象。
 */
function openViewDetailsModal(walletData) {
    showModal('tpl-view-wallet-details', (modalElement) => {
        console.log(`[${Date.now()}] openViewDetailsModal: Setting up modal for wallet:`, walletData.address);
        // 获取所有需要填充的元素
        const addressValueElement = modalElement.querySelector('#view-wallet-address-value'); 
        const privateKeyElement = modalElement.querySelector('#view-private-key');
        const mnemonicElement = modalElement.querySelector('#view-mnemonic');
        const copyButtons = modalElement.querySelectorAll('.copy-btn');

        // 检查所有元素是否存在
        if (!addressValueElement || !privateKeyElement || !mnemonicElement) { 
            console.error('查看详情模态框缺少必要的元素！(address, private key, or mnemonic code element)');
            hideModal();
            return;
        }

        // 填充数据 - 包括新添加的地址
        addressValueElement.textContent = walletData.address || '(地址未找到)'; // 确保地址存在
        addressValueElement.classList.remove('empty'); // 地址通常不会是空的

        if (walletData.encryptedPrivateKey) {
            privateKeyElement.textContent = walletData.encryptedPrivateKey;
            privateKeyElement.classList.remove('empty');
        } else {
            privateKeyElement.textContent = '(未存储)';
            privateKeyElement.classList.add('empty');
        }

        if (walletData.mnemonic) {
            mnemonicElement.textContent = walletData.mnemonic;
            mnemonicElement.classList.remove('empty');
        } else {
            mnemonicElement.textContent = '(未存储)';
            mnemonicElement.classList.add('empty');
        }

        // 为所有复制按钮添加事件监听器 (现有逻辑应该能处理新按钮)
        copyButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const targetId = button.dataset.target;
                const elementToCopy = modalElement.querySelector(`#${targetId}`);
                
                if (elementToCopy) {
                    const textToCopy = elementToCopy.textContent;
                    // 检查是否是有效数据（不是占位符）
                    if (textToCopy && !elementToCopy.classList.contains('empty') && textToCopy !== '加载中...') {
                        try {
                            await navigator.clipboard.writeText(textToCopy);
                            console.log(`[${Date.now()}] Copied to clipboard:`, targetId);
                            showToast('已复制到剪贴板', 'success');
                        } catch (err) {
                            console.error(`[${Date.now()}] Failed to copy ${targetId}: `, err);
                            showToast('复制失败！请检查浏览器权限或手动复制。', 'error');
                        }
                    } else {
                        console.log(`[${Date.now()}] Attempted to copy empty data for:`, targetId);
                        showToast('没有可复制的内容', 'warning');
                    }
                } else {
                     console.warn(`[${Date.now()}] Copy target element not found:`, targetId);
                }
            });
        });

        // 确保关闭按钮（页脚）能正常工作
        const closeButtonFooter = modalElement.querySelector('.modal-close-btn-footer');
        if (closeButtonFooter) {
             // 移除旧监听器以防重复添加
             const newCloseButton = closeButtonFooter.cloneNode(true);
             closeButtonFooter.parentNode.replaceChild(newCloseButton, closeButtonFooter);
             newCloseButton.addEventListener('click', hideModal); 
        }

        console.log(`[${Date.now()}] openViewDetailsModal: Modal setup complete.`);
    });
}