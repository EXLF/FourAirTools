/**
 * @fileoverview 钱包管理器 - 使用walletStore进行状态管理
 * @module pages/wallets/walletManager
 */

import { walletStore, subscribeToWallets } from '../../stores/walletStore.js';
import { showToast } from '../../components/toast.js';
import { showConfirmDialog } from '../../components/confirm.js';

/**
 * 钱包管理器类
 * 连接walletStore和UI，处理钱包相关的业务逻辑
 */
class WalletManager {
    constructor() {
        this.unsubscribe = null;
        this.elements = null;
        this.initialized = false;
    }

    /**
     * 初始化钱包管理器
     * @param {Object} elements - DOM元素引用
     */
    async initialize(elements) {
        if (this.initialized) {
            console.warn('[WalletManager] 已经初始化，跳过重复初始化');
            return;
        }

        this.elements = elements;
        
        // 订阅store变化
        this.unsubscribe = subscribeToWallets(
            (state, changes) => this.handleStoreChange(state, changes),
            ['wallets', 'selectedWalletIds', 'ui.loading', 'filters', 'pagination']
        );

        // 初始加载数据
        await this.loadInitialData();
        
        this.initialized = true;
        console.log('[WalletManager] 初始化完成');
    }

    /**
     * 加载初始数据
     */
    async loadInitialData() {
        try {
            walletStore.set('ui.loading', true);
            
            // 并行加载钱包和分组
            const [walletsResult, groupsResult] = await Promise.all([
                window.electronAPI.wallets.getAll(),
                window.electronAPI.wallets.getGroups()
            ]);

            if (walletsResult.success) {
                walletStore.setWallets(walletsResult.data);
            } else {
                throw new Error(walletsResult.message || '加载钱包失败');
            }

            if (groupsResult.success) {
                walletStore.setGroups(groupsResult.data);
                this.updateGroupFilter(groupsResult.data);
            }

        } catch (error) {
            console.error('[WalletManager] 加载初始数据失败:', error);
            showToast('加载数据失败: ' + error.message, 'error');
        } finally {
            walletStore.set('ui.loading', false);
        }
    }

    /**
     * 处理store状态变化
     */
    handleStoreChange(state, changes) {
        // 如果钱包列表或筛选条件变化，更新表格
        if (changes.wallets || changes.filters || changes.pagination) {
            this.renderWalletTable();
        }

        // 如果选中状态变化，更新UI
        if (changes.selectedWalletIds) {
            this.updateSelectionUI(state.selectedWalletIds);
        }

        // 如果加载状态变化，更新加载提示
        if (changes.ui?.loading !== undefined) {
            this.updateLoadingState(state.ui.loading);
        }
    }

    /**
     * 渲染钱包表格
     */
    renderWalletTable() {
        const state = walletStore.getState();
        const wallets = walletStore.getPaginatedWallets();
        const tbody = this.elements.tableBody;

        if (!tbody) return;

        // 清空表格
        tbody.innerHTML = '';

        if (wallets.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px;">
                        <div style="color: #666;">
                            <i class="fas fa-wallet" style="font-size: 48px; margin-bottom: 16px; opacity: 0.3;"></i>
                            <p>暂无钱包数据</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        // 渲染钱包行
        wallets.forEach(wallet => {
            const row = this.createWalletRow(wallet);
            tbody.appendChild(row);
        });

        // 更新分页
        this.updatePagination();
    }

    /**
     * 创建钱包表格行
     */
    createWalletRow(wallet) {
        const row = document.createElement('tr');
        row.dataset.id = wallet.id;
        
        const isSelected = walletStore.getState().selectedWalletIds.includes(wallet.id);
        const balance = walletStore.getState().balances[wallet.id];
        
        row.innerHTML = `
            <td class="checkbox-cell">
                <input type="checkbox" class="row-checkbox" data-id="${wallet.id}" ${isSelected ? 'checked' : ''}>
            </td>
            <td>${wallet.id}</td>
            <td class="wallet-address-cell">
                <span>${wallet.address}</span>
                <button class="copy-btn" title="复制地址">
                    <i class="fas fa-copy"></i>
                </button>
            </td>
            <td>${wallet.name || '-'}</td>
            <td>
                <span class="balance-value" data-wallet-id="${wallet.id}">
                    ${balance ? `${balance.balance} ETH` : '加载中...'}
                </span>
                ${balance && Date.now() - balance.lastUpdated > 60000 ? 
                    '<i class="fas fa-sync-alt refresh-balance" title="刷新余额" style="margin-left: 8px; cursor: pointer; color: #999;"></i>' : 
                    ''
                }
            </td>
            <td>${this.getGroupName(wallet.groupId)}</td>
            <td>${wallet.notes || '-'}</td>
            <td>${this.formatDate(wallet.createdAt)}</td>
            <td class="actions-cell">
                <button class="action-btn" data-action="查看详情">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="action-btn" data-action="编辑">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="action-btn" data-action="删除">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        // 添加事件监听器
        this.attachRowEventListeners(row, wallet);
        
        return row;
    }

    /**
     * 附加行事件监听器
     */
    attachRowEventListeners(row, wallet) {
        // 复选框变化
        const checkbox = row.querySelector('.row-checkbox');
        checkbox.addEventListener('change', (e) => {
            walletStore.toggleWalletSelection(wallet.id);
            e.stopPropagation();
        });

        // 复制地址
        const copyBtn = row.querySelector('.copy-btn');
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                await navigator.clipboard.writeText(wallet.address);
                showToast('地址已复制到剪贴板', 'success');
            } catch (error) {
                showToast('复制失败', 'error');
            }
        });

        // 刷新余额
        const refreshBtn = row.querySelector('.refresh-balance');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.refreshWalletBalance(wallet.id, wallet.address);
            });
        }

        // 操作按钮
        const actionBtns = row.querySelectorAll('.action-btn');
        actionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.dataset.action;
                this.handleWalletAction(action, wallet);
            });
        });

        // 行点击切换选择
        row.addEventListener('click', (e) => {
            if (!e.target.closest('button') && !e.target.closest('input')) {
                walletStore.toggleWalletSelection(wallet.id);
            }
        });
    }

    /**
     * 处理钱包操作
     */
    async handleWalletAction(action, wallet) {
        switch (action) {
            case '查看详情':
                // 触发查看详情事件
                this.elements.contentAreaCache.dispatchEvent(
                    new CustomEvent('wallet:viewDetails', { detail: { walletId: wallet.id } })
                );
                break;
                
            case '编辑':
                // 触发编辑事件
                this.elements.contentAreaCache.dispatchEvent(
                    new CustomEvent('wallet:edit', { detail: { walletId: wallet.id } })
                );
                break;
                
            case '删除':
                await this.handleDeleteWallet(wallet);
                break;
        }
    }

    /**
     * 处理删除钱包
     */
    async handleDeleteWallet(wallet) {
        const confirmed = await showConfirmDialog({
            title: '确认删除',
            message: `确定要删除钱包 ${wallet.address} 吗？`,
            confirmText: '删除',
            cancelText: '取消',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            const result = await window.electronAPI.wallets.delete([wallet.id]);
            
            if (result.success) {
                walletStore.removeWallets(wallet.id);
                showToast('钱包删除成功', 'success');
            } else {
                throw new Error(result.message || '删除失败');
            }
        } catch (error) {
            console.error('[WalletManager] 删除钱包失败:', error);
            showToast('删除失败: ' + error.message, 'error');
        }
    }

    /**
     * 刷新钱包余额
     */
    async refreshWalletBalance(walletId, address) {
        try {
            const balance = await window.electronAPI.wallets.getBalance(address);
            walletStore.setWalletBalance(walletId, balance);
        } catch (error) {
            console.error('[WalletManager] 刷新余额失败:', error);
            walletStore.setWalletBalance(walletId, '错误');
        }
    }

    /**
     * 更新分组筛选器
     */
    updateGroupFilter(groups) {
        const select = this.elements.groupFilterSelect;
        if (!select) return;

        // 保留当前选择
        const currentValue = select.value;

        // 清空并重新填充
        select.innerHTML = '<option value="">所有分组</option>';
        
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            select.appendChild(option);
        });

        // 恢复选择
        select.value = currentValue;
    }

    /**
     * 更新分页UI
     */
    updatePagination() {
        const state = walletStore.getState();
        const { page, pageSize, total } = state.pagination;
        const totalPages = Math.ceil(total / pageSize);
        
        const container = this.elements.paginationContainer;
        if (!container) return;

        // 这里可以使用现有的分页组件或创建新的
        // 暂时简单处理
        container.innerHTML = `
            <div class="pagination-info">
                显示 ${(page - 1) * pageSize + 1} - ${Math.min(page * pageSize, total)} / 共 ${total} 条
            </div>
        `;
    }

    /**
     * 更新选择UI
     */
    updateSelectionUI(selectedIds) {
        const count = selectedIds.length;
        const bulkDeleteBtn = this.elements.bulkDeleteBtn;
        
        if (bulkDeleteBtn) {
            bulkDeleteBtn.disabled = count === 0;
            bulkDeleteBtn.textContent = count > 0 ? `删除 (${count})` : '批量删除';
        }
    }

    /**
     * 更新加载状态
     */
    updateLoadingState(isLoading) {
        const tbody = this.elements.tableBody;
        if (isLoading && tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px;">
                        <i class="fas fa-spinner fa-spin" style="font-size: 24px;"></i>
                        <p style="margin-top: 10px;">加载中...</p>
                    </td>
                </tr>
            `;
        }
    }

    /**
     * 获取分组名称
     */
    getGroupName(groupId) {
        const groups = walletStore.getState().groups;
        const group = groups.find(g => g.id === groupId);
        return group ? group.name : '-';
    }

    /**
     * 格式化日期
     */
    formatDate(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN');
    }

    /**
     * 销毁管理器
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        this.elements = null;
        this.initialized = false;
        console.log('[WalletManager] 已销毁');
    }
}

// 导出单例实例
export const walletManager = new WalletManager(); 