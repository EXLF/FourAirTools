import { setupTableActions, setupCheckAll } from '../../components/tableHelper.js';
import { showToast } from '../../components/toast.js';
import {
    initTableElements,
    createPageSizeSelector,
    setupFilterListeners,
    loadGroupFilters,
    loadAndRenderWallets,
    getPersistedRowsPerPage,
    setRowsPerPage,
    getRowsPerPage // Import getRowsPerPage
} from './table.js';
import {
    openWalletModal,
    openManageGroupsModal,
    openGenerateWalletsModal,
    openViewDetailsModal,
    openAddWalletManualModal // 导入新增钱包模态框函数
} from './modals.js';
import {
    initActionElements,
    handleImportWallets,
    handleExportWallets,
    handleBulkDelete,
    handleSingleDelete
} from './actions.js';

let contentAreaCache; // 缓存 contentArea

/**
 * 初始化钱包页面。
 * 设置表格操作、筛选、全选和头部按钮。
 * 从数据库加载初始数据。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export async function initWalletsPage(contentArea) {
    contentAreaCache = contentArea; // 缓存供其他模块使用

    // --- 初始化 --- 
    console.log(`正在初始化钱包页面 (模块化版本)...`);

    // 1. 加载并设置每页行数
    const persistedSize = getPersistedRowsPerPage();
    setRowsPerPage(persistedSize);
    console.log(`每页显示设置为: ${getRowsPerPage()}`);

    // 2. 缓存页面元素
    const elements = {
        tableBody: contentArea.querySelector('.wallet-table tbody'),
        groupFilterSelect: contentArea.querySelector('#wallet-group-filter'),
        searchInput: contentArea.querySelector('.table-search-input'),
        paginationContainer: contentArea.querySelector('.pagination'),
        generateBtn: contentArea.querySelector('#bulk-generate-wallets-btn'),
        importBtn: contentArea.querySelector('#import-wallets-btn'),
        exportBtn: contentArea.querySelector('#export-wallets-btn'),
        manageGroupsBtn: contentArea.querySelector('#manage-groups-btn'),
        bulkDeleteBtn: contentArea.querySelector('#bulk-delete-btn'),
        addWalletManualBtn: contentArea.querySelector('#add-wallet-manual-btn'), // 缓存新按钮
        contentAreaCache: contentArea // 传递给其他模块
    };

    // 检查必要元素
    if (!elements.tableBody || !elements.groupFilterSelect || !elements.searchInput || !elements.paginationContainer) {
        console.error("钱包页面缺少必要的 DOM 元素！初始化中止。");
        contentArea.innerHTML = '<p style="color:red; padding: 20px;">页面加载错误：缺少关键元素。</p>';
        return;
    }

    // 检查 dbAPI
    if (typeof window.dbAPI === 'undefined') {
        console.error("错误: window.dbAPI 未定义! Preload 脚本可能未正确加载或配置。");
        elements.tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 20px; color: red;">应用程序配置错误，无法访问数据库。</td></tr>';
        return;
    }

    // --- 设置 Table 模块 --- 
    initTableElements(elements); // 将元素传递给 table 模块
    createPageSizeSelector();
    setupFilterListeners();

    // --- 设置 Actions 模块 --- 
    initActionElements(elements); // 将元素传递给 actions 模块

    // --- 设置表格交互 --- 
    setupTableActions(contentArea, '.wallet-table', handleWalletTableRowAction);
    setupCheckAll(contentArea, '.wallet-table');
    setupRowClickListener(elements.tableBody); // 设置行点击事件

    // --- 设置头部按钮监听器 --- 
    if (elements.generateBtn) elements.generateBtn.addEventListener('click', openGenerateWalletsModal);
    if (elements.importBtn) elements.importBtn.addEventListener('click', handleImportWallets);
    if (elements.exportBtn) elements.exportBtn.addEventListener('click', handleExportWallets);
    if (elements.manageGroupsBtn) elements.manageGroupsBtn.addEventListener('click', openManageGroupsModal);
    if (elements.bulkDeleteBtn) elements.bulkDeleteBtn.addEventListener('click', handleBulkDelete);
    if (elements.addWalletManualBtn) elements.addWalletManualBtn.addEventListener('click', openAddWalletManualModal); // 添加监听器

    // --- 加载初始数据 --- 
    try {
        await loadGroupFilters();
        await loadAndRenderWallets(); // 使用 table 模块的函数
    } catch (error) {
        console.error("初始化加载数据失败:", error);
        showToast("加载初始数据失败", 'error');
    }

    console.log("钱包页面初始化完成。");
}

/**
 * 处理钱包表格行内的操作按钮点击事件（由 tableHelper 调用）。
 * @param {string} action - 操作名称 ('查看详情', '编辑', '删除')。
 * @param {HTMLElement} rowElement - 表格行元素 (<tr>)。
 */
async function handleWalletTableRowAction(action, rowElement) {
    const walletId = parseInt(rowElement.dataset.id);
    if (!walletId) {
        console.error("无法从表格行获取钱包 ID");
        return;
    }
    // 获取地址用于提示信息
    const walletAddressElement = rowElement.querySelector('.wallet-address-cell span');
    const walletAddress = walletAddressElement ? walletAddressElement.textContent : `ID: ${walletId}`;

    console.log(`行内操作: "${action}" on Wallet ID: ${walletId} (${walletAddress})`);

    switch (action) {
        case '删除':
            // 调用 actions 模块处理单个删除
            handleSingleDelete(walletId, walletAddress);
            break;
        case '编辑':
            // 调用 modals 模块打开编辑模态框
            openWalletModal(walletId);
            break;
        case '查看详情':
            try {
                const walletData = await window.dbAPI.getWalletById(walletId);
                if (!walletData) {
                    showToast(`错误：找不到 ID 为 ${walletId} 的钱包数据。`, 'error');
                    return;
                }
                // 调用 modals 模块打开详情模态框
                openViewDetailsModal(walletData);
            } catch (error) {
                console.error(`获取钱包详情失败 ID ${walletId}:`, error);
                showToast(`获取钱包详情失败: ${error.message}`, 'error');
            }
            break;
        default:
            console.warn(`未知的钱包行操作: ${action}`);
    }
}

/**
 * 设置表格行点击切换复选框的监听器。
 * @param {HTMLElement} tableBodyElement 
 */
function setupRowClickListener(tableBodyElement) {
    if (!tableBodyElement) return;

    tableBodyElement.addEventListener('click', (event) => {
        const target = event.target;
        // 如果点击的是单元格本身或单元格内的span，并且不是操作单元格
        if ((target.tagName === 'TD' || target.tagName === 'SPAN') && !target.closest('.actions-cell')) {
            const row = target.closest('tr');
            if (!row) return; 
            
             // 检查是否点击在操作按钮、链接或复选框本身 (更精确的检查)
             if (target.tagName === 'BUTTON' || target.closest('button') || target.tagName === 'A' || (target.tagName === 'INPUT' && target.type === 'checkbox')) {
                 return; // 如果是这些元素，则不触发切换
             }

            const checkbox = row.querySelector('input[type="checkbox"]');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                // 手动触发 change 事件，以更新 setupCheckAll 和可能的其他监听器
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    });
}
