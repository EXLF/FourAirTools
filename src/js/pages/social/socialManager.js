/**
 * @fileoverview 社交账户管理器 - 使用socialStore进行状态管理
 * @module pages/social/socialManager
 */

import { socialStore, subscribeToSocial } from '../../stores/socialStore.js';
import { showToast } from '../../components/toast.js';
import { showConfirmDialog } from '../../components/confirm.js';

/**
 * 社交账户管理器类
 * 连接socialStore和UI，处理社交账户相关的业务逻辑
 */
class SocialManager {
    constructor() {
        this.unsubscribe = null;
        this.elements = null;
        this.initialized = false;
    }

    /**
     * 初始化社交账户管理器
     * @param {Object} elements - DOM元素引用
     */
    async initialize(elements) {
        if (this.initialized) {
            console.warn('[SocialManager] 已经初始化，跳过重复初始化');
            return;
        }

        this.elements = elements;
        
        // 订阅store变化
        this.unsubscribe = subscribeToSocial(
            (state, changes) => this.handleStoreChange(state, changes),
            ['accounts', 'filters', 'pagination', 'ui.selectedAccounts']
        );

        // 初始加载数据
        await this.loadInitialData();
        
        this.initialized = true;
        console.log('[SocialManager] 初始化完成');
    }

    /**
     * 加载初始数据
     */
    async loadInitialData() {
        try {
            socialStore.set('ui.loading', true);
            
            const result = await window.dbAPI.getSocialAccounts();
            
            if (result.success) {
                socialStore.setAccounts(result.data || []);
            } else {
                throw new Error(result.message || '加载社交账户失败');
            }
        } catch (error) {
            console.error('[SocialManager] 加载初始数据失败:', error);
            showToast('加载数据失败: ' + error.message, 'error');
        } finally {
            socialStore.set('ui.loading', false);
        }
    }

    /**
     * 处理store状态变化
     */
    handleStoreChange(state, changes) {
        // 账户列表或筛选条件变化时重新渲染表格
        if (changes.accounts || changes.filters || changes.pagination) {
            this.renderTable();
            this.updatePagination();
        }

        // 选中状态变化时更新UI
        if (changes.ui?.selectedAccounts) {
            this.updateSelectionUI();
        }
    }

    /**
     * 渲染表格
     */
    renderTable() {
        const tbody = this.elements.tableBody;
        if (!tbody) return;

        const accounts = socialStore.getPaginatedAccounts();
        const selectedAccounts = socialStore.get('ui.selectedAccounts');
        
        if (accounts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-4">
                        <div class="empty-state">
                            <i class="fas fa-users" style="font-size: 48px; color: #999; margin-bottom: 16px;"></i>
                            <p>暂无社交账户</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = accounts.map(account => this.createAccountRow(account, selectedAccounts)).join('');
        
        // 绑定行事件
        this.bindRowEvents();
    }

    /**
     * 创建账户行HTML
     */
    createAccountRow(account, selectedAccounts) {
        const isSelected = selectedAccounts.has(account.id);
        const statusClass = this.getStatusClass(account.status);
        
        return `
            <tr data-account-id="${account.id}" class="${isSelected ? 'selected' : ''}">
                <td>
                    <input type="checkbox" class="account-checkbox" 
                           value="${account.id}" 
                           ${isSelected ? 'checked' : ''}>
                </td>
                <td>
                    <div class="platform-info">
                        <i class="fab fa-${this.getPlatformIcon(account.platform)}"></i>
                        <span>${account.platform}</span>
                    </div>
                </td>
                <td>${account.username || '-'}</td>
                <td>${account.email || '-'}</td>
                <td>${account.phone || '-'}</td>
                <td>
                    <span class="status-badge ${statusClass}">
                        ${this.getStatusText(account.status)}
                    </span>
                </td>
                <td>${account.notes || '-'}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-secondary edit-btn" 
                                data-account-id="${account.id}" 
                                title="编辑">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger delete-btn" 
                                data-account-id="${account.id}" 
                                title="删除">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * 绑定表格行事件
     */
    bindRowEvents() {
        const tbody = this.elements.tableBody;
        
        // 复选框事件
        tbody.querySelectorAll('.account-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const accountId = parseInt(e.target.value);
                socialStore.toggleAccountSelection(accountId);
            });
        });

        // 编辑按钮事件
        tbody.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const accountId = parseInt(btn.dataset.accountId);
                this.editAccount(accountId);
            });
        });

        // 删除按钮事件
        tbody.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const accountId = parseInt(btn.dataset.accountId);
                this.deleteAccount(accountId);
            });
        });
    }

    /**
     * 更新分页UI
     */
    updatePagination() {
        const paginationContainer = this.elements.paginationContainer;
        if (!paginationContainer) return;

        const { currentPage, pageSize, total } = socialStore.get('pagination');
        const filteredTotal = socialStore.getFilteredAccounts().length;
        const totalPages = Math.ceil(filteredTotal / pageSize);

        // 更新分页信息
        const startIndex = (currentPage - 1) * pageSize + 1;
        const endIndex = Math.min(currentPage * pageSize, filteredTotal);
        
        paginationContainer.innerHTML = `
            <div class="pagination-info">
                显示 ${startIndex}-${endIndex} / 共 ${filteredTotal} 条
            </div>
            <div class="pagination-controls">
                <button class="btn btn-sm" ${currentPage === 1 ? 'disabled' : ''} data-page="1">
                    <i class="fas fa-angle-double-left"></i>
                </button>
                <button class="btn btn-sm" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
                    <i class="fas fa-angle-left"></i>
                </button>
                <span class="page-number">第 ${currentPage} / ${totalPages} 页</span>
                <button class="btn btn-sm" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
                    <i class="fas fa-angle-right"></i>
                </button>
                <button class="btn btn-sm" ${currentPage === totalPages ? 'disabled' : ''} data-page="${totalPages}">
                    <i class="fas fa-angle-double-right"></i>
                </button>
            </div>
        `;

        // 绑定分页事件
        paginationContainer.querySelectorAll('button[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const page = parseInt(btn.dataset.page);
                if (page && !btn.disabled) {
                    socialStore.setPagination({ currentPage: page });
                }
            });
        });
    }

    /**
     * 更新选中状态UI
     */
    updateSelectionUI() {
        const selectedCount = socialStore.get('ui.selectedAccounts').size;
        const selectedCountElement = this.elements.selectedCount;
        
        if (selectedCountElement) {
            selectedCountElement.textContent = selectedCount;
            selectedCountElement.style.display = selectedCount > 0 ? 'inline' : 'none';
        }

        // 更新全选复选框
        const selectAllCheckbox = this.elements.selectAllCheckbox;
        if (selectAllCheckbox) {
            const totalOnPage = socialStore.getPaginatedAccounts().length;
            selectAllCheckbox.checked = selectedCount === totalOnPage && totalOnPage > 0;
            selectAllCheckbox.indeterminate = selectedCount > 0 && selectedCount < totalOnPage;
        }
    }

    /**
     * 添加账户
     */
    async addAccount(accountData) {
        try {
            const result = await window.dbAPI.addSocialAccount(accountData);
            
            if (result.success) {
                socialStore.addAccount(result.data);
                showToast('账户添加成功', 'success');
                return { success: true };
            } else {
                throw new Error(result.message || '添加失败');
            }
        } catch (error) {
            console.error('[SocialManager] 添加账户失败:', error);
            showToast('添加失败: ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * 编辑账户
     */
    async editAccount(accountId) {
        const account = socialStore.get('accounts').find(a => a.id === accountId);
        if (!account) return;

        // 触发编辑事件
        this.elements.contentArea.dispatchEvent(
            new CustomEvent('social:edit', { detail: { account } })
        );
    }

    /**
     * 更新账户
     */
    async updateAccount(accountId, updates) {
        try {
            const result = await window.dbAPI.updateSocialAccount(accountId, updates);
            
            if (result.success) {
                socialStore.updateAccount(accountId, updates);
                showToast('账户更新成功', 'success');
                return { success: true };
            } else {
                throw new Error(result.message || '更新失败');
            }
        } catch (error) {
            console.error('[SocialManager] 更新账户失败:', error);
            showToast('更新失败: ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * 删除账户
     */
    async deleteAccount(accountId) {
        const confirmed = await showConfirmDialog({
            title: '确认删除',
            message: '确定要删除此账户吗？',
            confirmText: '删除',
            cancelText: '取消',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            const result = await window.dbAPI.deleteSocialAccounts([accountId]);
            
            if (result.success) {
                socialStore.deleteAccounts(accountId);
                showToast('账户删除成功', 'success');
            } else {
                throw new Error(result.message || '删除失败');
            }
        } catch (error) {
            console.error('[SocialManager] 删除账户失败:', error);
            showToast('删除失败: ' + error.message, 'error');
        }
    }

    /**
     * 批量删除账户
     */
    async deleteSelectedAccounts() {
        const selectedIds = Array.from(socialStore.get('ui.selectedAccounts'));
        if (selectedIds.length === 0) {
            showToast('请先选择要删除的账户', 'warning');
            return;
        }

        const confirmed = await showConfirmDialog({
            title: '确认批量删除',
            message: `确定要删除选中的 ${selectedIds.length} 个账户吗？`,
            confirmText: '删除',
            cancelText: '取消',
            type: 'danger'
        });

        if (!confirmed) return;

        try {
            const result = await window.dbAPI.deleteSocialAccounts(selectedIds);
            
            if (result.success) {
                socialStore.deleteAccounts(selectedIds);
                showToast(`成功删除 ${selectedIds.length} 个账户`, 'success');
            } else {
                throw new Error(result.message || '批量删除失败');
            }
        } catch (error) {
            console.error('[SocialManager] 批量删除失败:', error);
            showToast('批量删除失败: ' + error.message, 'error');
        }
    }

    /**
     * 获取平台图标
     */
    getPlatformIcon(platform) {
        const icons = {
            'Twitter': 'twitter',
            'Facebook': 'facebook',
            'Instagram': 'instagram',
            'LinkedIn': 'linkedin',
            'TikTok': 'tiktok',
            'YouTube': 'youtube',
            'Discord': 'discord',
            'Telegram': 'telegram',
            'WhatsApp': 'whatsapp'
        };
        return icons[platform] || 'globe';
    }

    /**
     * 获取状态样式类
     */
    getStatusClass(status) {
        const classes = {
            'active': 'status-active',
            'inactive': 'status-inactive',
            'banned': 'status-banned',
            'pending': 'status-pending'
        };
        return classes[status] || '';
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const texts = {
            'active': '正常',
            'inactive': '未激活',
            'banned': '已封禁',
            'pending': '待验证'
        };
        return texts[status] || status;
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
        console.log('[SocialManager] 已销毁');
    }
}

// 导出单例实例
export const socialManager = new SocialManager(); 