/**
 * @fileoverview 社交账户状态管理
 * @module stores/socialStore
 */

import { BaseStore } from './BaseStore.js';

/**
 * 社交账户Store类
 * @extends BaseStore
 */
class SocialStore extends BaseStore {
    constructor() {
        super({
            // 社交账户列表
            accounts: [],
            
            // 筛选条件
            filters: {
                search: '',
                platform: 'all',
                status: 'all',
                tags: []
            },
            
            // 分页状态
            pagination: {
                currentPage: 1,
                pageSize: 20,
                total: 0
            },
            
            // UI状态
            ui: {
                loading: false,
                selectedAccounts: new Set(),
                sortBy: 'createdAt',
                sortOrder: 'desc',
                viewMode: 'table' // table | cards
            },
            
            // 统计信息
            stats: {
                totalAccounts: 0,
                platformCounts: {},
                statusCounts: {}
            }
        });
    }
    
    /**
     * 设置账户列表
     * @param {Array} accounts - 账户数组
     */
    setAccounts(accounts) {
        this.setState({
            accounts: accounts,
            'pagination.total': accounts.length,
            'stats.totalAccounts': accounts.length
        });
        
        // 更新统计信息
        this.updateStats(accounts);
    }
    
    /**
     * 添加账户
     * @param {Object} account - 账户数据
     */
    addAccount(account) {
        const accounts = [...this.state.accounts, account];
        this.setAccounts(accounts);
    }
    
    /**
     * 更新账户
     * @param {number} id - 账户ID
     * @param {Object} updates - 更新数据
     */
    updateAccount(id, updates) {
        const accounts = this.state.accounts.map(acc => 
            acc.id === id ? { ...acc, ...updates } : acc
        );
        this.setAccounts(accounts);
    }
    
    /**
     * 删除账户
     * @param {number|Array<number>} ids - 账户ID或ID数组
     */
    deleteAccounts(ids) {
        const idsToDelete = Array.isArray(ids) ? ids : [ids];
        const accounts = this.state.accounts.filter(acc => 
            !idsToDelete.includes(acc.id)
        );
        this.setAccounts(accounts);
        
        // 清理选中状态
        const selectedAccounts = new Set(this.state.ui.selectedAccounts);
        idsToDelete.forEach(id => selectedAccounts.delete(id));
        this.set('ui.selectedAccounts', selectedAccounts);
    }
    
    /**
     * 设置筛选条件
     * @param {Object} filters - 筛选条件
     */
    setFilters(filters) {
        this.setState({
            filters: { ...this.state.filters, ...filters },
            'pagination.currentPage': 1 // 重置到第一页
        });
    }
    
    /**
     * 设置分页
     * @param {Object} pagination - 分页参数
     */
    setPagination(pagination) {
        this.setState({
            pagination: { ...this.state.pagination, ...pagination }
        });
    }
    
    /**
     * 切换账户选中状态
     * @param {number} id - 账户ID
     */
    toggleAccountSelection(id) {
        const selectedAccounts = new Set(this.state.ui.selectedAccounts);
        if (selectedAccounts.has(id)) {
            selectedAccounts.delete(id);
        } else {
            selectedAccounts.add(id);
        }
        this.set('ui.selectedAccounts', selectedAccounts);
    }
    
    /**
     * 全选/取消全选
     * @param {boolean} selected - 是否选中
     */
    selectAll(selected) {
        if (selected) {
            const allIds = this.getFilteredAccounts().map(acc => acc.id);
            this.set('ui.selectedAccounts', new Set(allIds));
        } else {
            this.set('ui.selectedAccounts', new Set());
        }
    }
    
    /**
     * 获取筛选后的账户
     * @returns {Array} 筛选后的账户列表
     */
    getFilteredAccounts() {
        let accounts = [...this.state.accounts];
        const { search, platform, status, tags } = this.state.filters;
        
        // 搜索筛选
        if (search) {
            const searchLower = search.toLowerCase();
            accounts = accounts.filter(acc => 
                acc.username?.toLowerCase().includes(searchLower) ||
                acc.email?.toLowerCase().includes(searchLower) ||
                acc.phone?.includes(search) ||
                acc.notes?.toLowerCase().includes(searchLower)
            );
        }
        
        // 平台筛选
        if (platform && platform !== 'all') {
            accounts = accounts.filter(acc => acc.platform === platform);
        }
        
        // 状态筛选
        if (status && status !== 'all') {
            accounts = accounts.filter(acc => acc.status === status);
        }
        
        // 标签筛选
        if (tags && tags.length > 0) {
            accounts = accounts.filter(acc => 
                tags.some(tag => acc.tags?.includes(tag))
            );
        }
        
        // 排序
        const { sortBy, sortOrder } = this.state.ui;
        accounts.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];
            
            // 处理日期
            if (sortBy === 'createdAt' || sortBy === 'updatedAt') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            }
            
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
        
        return accounts;
    }
    
    /**
     * 获取分页后的账户
     * @returns {Array} 当前页的账户列表
     */
    getPaginatedAccounts() {
        const filtered = this.getFilteredAccounts();
        const { currentPage, pageSize } = this.state.pagination;
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        
        return filtered.slice(start, end);
    }
    
    /**
     * 更新统计信息
     * @param {Array} accounts - 账户列表
     */
    updateStats(accounts) {
        const platformCounts = {};
        const statusCounts = {};
        
        accounts.forEach(acc => {
            // 平台统计
            platformCounts[acc.platform] = (platformCounts[acc.platform] || 0) + 1;
            
            // 状态统计
            statusCounts[acc.status] = (statusCounts[acc.status] || 0) + 1;
        });
        
        this.setState({
            'stats.platformCounts': platformCounts,
            'stats.statusCounts': statusCounts
        });
    }
    
    /**
     * 批量更新账户状态
     * @param {Array<number>} ids - 账户ID数组
     * @param {string} status - 新状态
     */
    batchUpdateStatus(ids, status) {
        const accounts = this.state.accounts.map(acc => 
            ids.includes(acc.id) ? { ...acc, status } : acc
        );
        this.setAccounts(accounts);
    }
    
    /**
     * 批量添加标签
     * @param {Array<number>} ids - 账户ID数组
     * @param {Array<string>} tags - 标签数组
     */
    batchAddTags(ids, tags) {
        const accounts = this.state.accounts.map(acc => {
            if (ids.includes(acc.id)) {
                const existingTags = acc.tags || [];
                const newTags = [...new Set([...existingTags, ...tags])];
                return { ...acc, tags: newTags };
            }
            return acc;
        });
        this.setAccounts(accounts);
    }
}

// 创建单例实例
export const socialStore = new SocialStore();

// 便捷订阅函数
export function subscribeToSocial(callback, paths) {
    return socialStore.subscribe(callback, paths);
} 