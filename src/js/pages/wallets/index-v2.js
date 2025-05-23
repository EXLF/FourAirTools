/**
 * @fileoverview 钱包页面初始化 V2 - 使用walletStore进行状态管理
 * @module pages/wallets/index-v2
 */

import { walletManager } from './walletManager.js';
import { walletStore } from '../../stores/walletStore.js';
import { showToast } from '../../components/toast.js';
import { showConfirmDialog } from '../../components/confirm.js';
import {
    openWalletModal,
    openManageGroupsModal,
    openGenerateWalletsModal,
    showViewDetailsModal,
    openAddWalletManualModal
} from './modals.js';

/**
 * 初始化钱包页面（使用Store版本）
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export async function initWalletsPageV2(contentArea) {
    console.log('[WalletsV2] 开始初始化钱包页面...');

    // 缓存DOM元素
    const elements = {
        contentAreaCache: contentArea,
        tableBody: contentArea.querySelector('.wallet-table tbody'),
        groupFilterSelect: contentArea.querySelector('#wallet-group-filter'),
        searchInput: contentArea.querySelector('.table-search-input'),
        paginationContainer: contentArea.querySelector('.pagination'),
        generateBtn: contentArea.querySelector('#bulk-generate-wallets-btn'),
        importBtn: contentArea.querySelector('#import-wallets-btn'),
        exportBtn: contentArea.querySelector('#export-wallets-btn'),
        manageGroupsBtn: contentArea.querySelector('#manage-groups-btn'),
        bulkDeleteBtn: contentArea.querySelector('#bulk-delete-btn'),
        addWalletManualBtn: contentArea.querySelector('#add-wallet-manual-btn'),
        checkAllBox: contentArea.querySelector('.check-all'),
        pageSizeSelect: null // 将在后面创建
    };

    // 检查必要元素
    if (!validateElements(elements)) {
        return;
    }

    // 初始化钱包管理器
    await walletManager.initialize(elements);

    // 设置筛选器监听
    setupFilterListeners(elements);

    // 设置按钮监听
    setupButtonListeners(elements);

    // 设置表格监听
    setupTableListeners(elements);

    // 设置自定义事件监听
    setupCustomEventListeners(contentArea);

    // 创建页大小选择器
    createPageSizeSelector(elements);

    console.log('[WalletsV2] 钱包页面初始化完成');
}

/**
 * 验证必要的DOM元素
 */
function validateElements(elements) {
    const required = ['tableBody', 'groupFilterSelect', 'searchInput', 'paginationContainer'];
    
    for (const key of required) {
        if (!elements[key]) {
            console.error(`[WalletsV2] 缺少必要元素: ${key}`);
            elements.contentAreaCache.innerHTML = `
                <div style="color: red; padding: 20px; text-align: center;">
                    页面加载错误：缺少关键元素
                </div>
            `;
            return false;
        }
    }

    return true;
}

/**
 * 设置筛选器监听
 */
function setupFilterListeners(elements) {
    // 分组筛选
    elements.groupFilterSelect.addEventListener('change', (e) => {
        const groupId = e.target.value ? parseInt(e.target.value) : null;
        walletStore.setFilters({ groupId });
    });

    // 搜索筛选（使用防抖）
    let searchTimer;
    elements.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
            walletStore.setFilters({ search: e.target.value.trim() });
        }, 300);
    });
}

/**
 * 设置按钮监听
 */
function setupButtonListeners(elements) {
    // 生成钱包
    if (elements.generateBtn) {
        elements.generateBtn.addEventListener('click', () => {
            openGenerateWalletsModal();
        });
    }

    // 导入钱包
    if (elements.importBtn) {
        elements.importBtn.addEventListener('click', handleImportWallets);
    }

    // 导出钱包
    if (elements.exportBtn) {
        elements.exportBtn.addEventListener('click', handleExportWallets);
    }

    // 管理分组
    if (elements.manageGroupsBtn) {
        elements.manageGroupsBtn.addEventListener('click', () => {
            openManageGroupsModal();
        });
    }

    // 批量删除
    if (elements.bulkDeleteBtn) {
        elements.bulkDeleteBtn.addEventListener('click', handleBulkDelete);
    }

    // 手动添加钱包
    if (elements.addWalletManualBtn) {
        elements.addWalletManualBtn.addEventListener('click', () => {
            openAddWalletManualModal();
        });
    }
}

/**
 * 设置表格监听
 */
function setupTableListeners(elements) {
    // 全选复选框
    if (elements.checkAllBox) {
        elements.checkAllBox.addEventListener('change', (e) => {
            walletStore.selectAll(e.target.checked);
        });

        // 监听选中状态变化，更新全选框
        walletStore.subscribe((state) => {
            const wallets = walletStore.getFilteredWallets();
            const selectedCount = state.selectedWalletIds.length;
            
            if (selectedCount === 0) {
                elements.checkAllBox.checked = false;
                elements.checkAllBox.indeterminate = false;
            } else if (selectedCount === wallets.length && wallets.length > 0) {
                elements.checkAllBox.checked = true;
                elements.checkAllBox.indeterminate = false;
            } else {
                elements.checkAllBox.checked = false;
                elements.checkAllBox.indeterminate = true;
            }
        }, ['selectedWalletIds']);
    }
}

/**
 * 设置自定义事件监听
 */
function setupCustomEventListeners(contentArea) {
    // 查看详情事件
    contentArea.addEventListener('wallet:viewDetails', (e) => {
        showViewDetailsModal(e.detail.walletId);
    });

    // 编辑事件
    contentArea.addEventListener('wallet:edit', (e) => {
        openWalletModal(e.detail.walletId);
    });

    // 钱包添加成功事件
    contentArea.addEventListener('wallet:added', async (e) => {
        const wallet = e.detail.wallet;
        walletStore.addWallet(wallet);
        showToast('钱包添加成功', 'success');
    });

    // 钱包更新成功事件
    contentArea.addEventListener('wallet:updated', (e) => {
        const { walletId, updates } = e.detail;
        walletStore.updateWallet(walletId, updates);
        showToast('钱包更新成功', 'success');
    });
}

/**
 * 创建页大小选择器
 */
function createPageSizeSelector(elements) {
    const paginationContainer = elements.paginationContainer;
    if (!paginationContainer) return;

    // 创建页大小选择器
    const selectorHtml = `
        <div class="page-size-selector" style="margin-bottom: 10px;">
            <label>每页显示：</label>
            <select id="page-size-select">
                <option value="20">20</option>
                <option value="50" selected>50</option>
                <option value="100">100</option>
                <option value="200">200</option>
            </select>
        </div>
    `;

    paginationContainer.insertAdjacentHTML('beforebegin', selectorHtml);
    elements.pageSizeSelect = document.querySelector('#page-size-select');

    // 从localStorage恢复设置
    const savedPageSize = localStorage.getItem('walletPageSize');
    if (savedPageSize) {
        elements.pageSizeSelect.value = savedPageSize;
        walletStore.setPagination({ pageSize: parseInt(savedPageSize) });
    }

    // 监听变化
    elements.pageSizeSelect.addEventListener('change', (e) => {
        const pageSize = parseInt(e.target.value);
        walletStore.setPagination({ pageSize, page: 1 });
        localStorage.setItem('walletPageSize', pageSize);
    });
}

/**
 * 处理导入钱包
 */
async function handleImportWallets() {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.txt,.csv,.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const content = await file.text();
            const wallets = parseWalletFile(content, file.name);

            if (wallets.length === 0) {
                showToast('未找到有效的钱包数据', 'error');
                return;
            }

            // 批量导入
            const result = await window.electronAPI.wallets.batchImport(wallets);
            
            if (result.success) {
                // 重新加载钱包列表
                await walletManager.loadInitialData();
                
                showToast(
                    `成功导入 ${result.data.success.length} 个钱包` +
                    (result.data.failed.length > 0 ? `，失败 ${result.data.failed.length} 个` : ''),
                    'success'
                );
            } else {
                throw new Error(result.message || '导入失败');
            }
        };

        input.click();
    } catch (error) {
        console.error('[WalletsV2] 导入钱包失败:', error);
        showToast('导入失败: ' + error.message, 'error');
    }
}

/**
 * 解析钱包文件
 */
function parseWalletFile(content, filename) {
    const wallets = [];
    const ext = filename.split('.').pop().toLowerCase();

    try {
        if (ext === 'json') {
            // JSON格式
            const data = JSON.parse(content);
            const items = Array.isArray(data) ? data : [data];
            
            items.forEach(item => {
                if (item.address || item.privateKey) {
                    wallets.push({
                        address: item.address,
                        privateKey: item.privateKey,
                        name: item.name,
                        notes: item.notes
                    });
                }
            });
        } else {
            // TXT/CSV格式，每行一个私钥或地址
            const lines = content.split('\n').map(line => line.trim()).filter(Boolean);
            
            lines.forEach(line => {
                // 跳过注释行
                if (line.startsWith('#') || line.startsWith('//')) return;
                
                // CSV格式：address,privateKey,name
                const parts = line.split(',').map(p => p.trim());
                
                if (parts[0]) {
                    wallets.push({
                        address: parts[0].startsWith('0x') ? parts[0] : undefined,
                        privateKey: parts[0].startsWith('0x') ? parts[1] : parts[0],
                        name: parts[2]
                    });
                }
            });
        }
    } catch (error) {
        console.error('[WalletsV2] 解析钱包文件失败:', error);
    }

    return wallets;
}

/**
 * 处理导出钱包
 */
async function handleExportWallets() {
    const selectedIds = walletStore.getState().selectedWalletIds;
    
    if (selectedIds.length === 0) {
        showToast('请先选择要导出的钱包', 'warning');
        return;
    }

    const format = await showExportFormatDialog();
    if (!format) return;

    try {
        // 获取选中的钱包详情
        const wallets = walletStore.getState().wallets.filter(w => selectedIds.includes(w.id));
        
        let content = '';
        let filename = `wallets_${new Date().toISOString().split('T')[0]}`;

        switch (format) {
            case 'json':
                content = JSON.stringify(wallets.map(w => ({
                    address: w.address,
                    name: w.name,
                    notes: w.notes
                })), null, 2);
                filename += '.json';
                break;
                
            case 'csv':
                content = 'Address,Name,Notes\n';
                content += wallets.map(w => 
                    `${w.address},"${w.name || ''}","${w.notes || ''}"`
                ).join('\n');
                filename += '.csv';
                break;
                
            case 'txt':
                content = wallets.map(w => w.address).join('\n');
                filename += '.txt';
                break;
        }

        // 下载文件
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        showToast('导出成功', 'success');
    } catch (error) {
        console.error('[WalletsV2] 导出钱包失败:', error);
        showToast('导出失败: ' + error.message, 'error');
    }
}

/**
 * 显示导出格式选择对话框
 */
async function showExportFormatDialog() {
    return new Promise((resolve) => {
        // 这里可以使用自定义的模态框，暂时使用简单的实现
        const formats = ['json', 'csv', 'txt'];
        const selected = prompt('选择导出格式：\n1. JSON（包含名称和备注）\n2. CSV（包含名称和备注）\n3. TXT（仅地址）\n\n请输入数字：');
        
        if (selected && ['1', '2', '3'].includes(selected)) {
            resolve(formats[parseInt(selected) - 1]);
        } else {
            resolve(null);
        }
    });
}

/**
 * 处理批量删除
 */
async function handleBulkDelete() {
    const selectedIds = walletStore.getState().selectedWalletIds;
    
    if (selectedIds.length === 0) {
        showToast('请先选择要删除的钱包', 'warning');
        return;
    }

    const confirmed = await showConfirmDialog({
        title: '确认批量删除',
        message: `确定要删除选中的 ${selectedIds.length} 个钱包吗？此操作不可恢复。`,
        confirmText: '删除',
        cancelText: '取消',
        type: 'danger'
    });

    if (!confirmed) return;

    try {
        const result = await window.electronAPI.wallets.delete(selectedIds);
        
        if (result.success) {
            walletStore.removeWallets(selectedIds);
            showToast(`成功删除 ${result.data.deletedCount} 个钱包`, 'success');
        } else {
            throw new Error(result.message || '删除失败');
        }
    } catch (error) {
        console.error('[WalletsV2] 批量删除失败:', error);
        showToast('删除失败: ' + error.message, 'error');
    }
} 