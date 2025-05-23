/**
 * @fileoverview 钱包Store - 管理钱包相关状态
 * @module stores/walletStore
 */

import { BaseStore } from './BaseStore.js';

/**
 * 钱包Store类
 * 管理钱包列表、选中状态、筛选条件等
 */
class WalletStore extends BaseStore {
    constructor() {
        super({
            // 钱包列表
            wallets: [],
            
            // 钱包分组
            groups: [],
            
            // 选中的钱包ID
            selectedWalletIds: [],
            
            // 筛选条件
            filters: {
                search: '',
                groupId: null,
                sortBy: 'createdAt',
                sortOrder: 'desc'
            },
            
            // 分页
            pagination: {
                page: 1,
                pageSize: 50,
                total: 0
            },
            
            // UI状态
            ui: {
                loading: false,
                refreshing: false,
                selectedTab: 'all', // all, grouped, imported
                expandedGroups: [], // 展开的分组ID
                viewMode: 'table' // table, grid
            },
            
            // 余额信息缓存
            balances: {}, // walletId -> { balance, lastUpdated }
            
            // 批量操作状态
            batchOperation: {
                isProcessing: false,
                currentOperation: null,
                progress: 0,
                results: []
            }
        });
        
        // 初始化
        this._init();
    }

    /**
     * 初始化Store
     * @private
     */
    _init() {
        // 定期清理过期的余额缓存
        setInterval(() => {
            this.cleanExpiredBalances();
        }, 5 * 60 * 1000); // 5分钟
    }

    /**
     * 设置钱包列表
     * @param {Array} wallets - 钱包数组
     */
    setWallets(wallets) {
        this.setState({
            wallets,
            pagination: {
                ...this.get('pagination'),
                total: wallets.length
            }
        });
    }

    /**
     * 添加钱包
     * @param {Object} wallet - 钱包对象
     */
    addWallet(wallet) {
        this.setState({
            wallets: [...this.get('wallets'), wallet],
            pagination: {
                ...this.get('pagination'),
                total: this.get('pagination.total') + 1
            }
        });
    }

    /**
     * 更新钱包
     * @param {number} walletId - 钱包ID
     * @param {Object} updates - 更新内容
     */
    updateWallet(walletId, updates) {
        const wallets = this.get('wallets').map(wallet => 
            wallet.id === walletId ? { ...wallet, ...updates } : wallet
        );
        this.set('wallets', wallets);
    }

    /**
     * 删除钱包
     * @param {number|Array<number>} walletIds - 钱包ID或ID数组
     */
    removeWallets(walletIds) {
        const idsToRemove = Array.isArray(walletIds) ? walletIds : [walletIds];
        const wallets = this.get('wallets').filter(w => !idsToRemove.includes(w.id));
        
        this.setState({
            wallets,
            selectedWalletIds: this.get('selectedWalletIds').filter(id => !idsToRemove.includes(id)),
            pagination: {
                ...this.get('pagination'),
                total: wallets.length
            }
        });
        
        // 清理余额缓存
        idsToRemove.forEach(id => {
            const balances = { ...this.get('balances') };
            delete balances[id];
            this.set('balances', balances);
        });
    }

    /**
     * 设置分组列表
     * @param {Array} groups - 分组数组
     */
    setGroups(groups) {
        this.set('groups', groups);
    }

    /**
     * 选择钱包
     * @param {number|Array<number>} walletIds - 钱包ID或ID数组
     * @param {boolean} [append=false] - 是否追加到现有选择
     */
    selectWallets(walletIds, append = false) {
        const ids = Array.isArray(walletIds) ? walletIds : [walletIds];
        
        if (append) {
            const currentIds = this.get('selectedWalletIds');
            const newIds = [...new Set([...currentIds, ...ids])];
            this.set('selectedWalletIds', newIds);
        } else {
            this.set('selectedWalletIds', ids);
        }
    }

    /**
     * 取消选择钱包
     * @param {number|Array<number>} [walletIds] - 钱包ID或ID数组，不传则取消所有
     */
    deselectWallets(walletIds) {
        if (!walletIds) {
            this.set('selectedWalletIds', []);
            return;
        }
        
        const idsToRemove = Array.isArray(walletIds) ? walletIds : [walletIds];
        const selectedIds = this.get('selectedWalletIds').filter(id => !idsToRemove.includes(id));
        this.set('selectedWalletIds', selectedIds);
    }

    /**
     * 切换钱包选择状态
     * @param {number} walletId - 钱包ID
     */
    toggleWalletSelection(walletId) {
        const selectedIds = this.get('selectedWalletIds');
        if (selectedIds.includes(walletId)) {
            this.deselectWallets(walletId);
        } else {
            this.selectWallets(walletId, true);
        }
    }

    /**
     * 全选/取消全选
     * @param {boolean} [select=true] - 是否全选
     */
    selectAll(select = true) {
        if (select) {
            const allIds = this.get('wallets').map(w => w.id);
            this.set('selectedWalletIds', allIds);
        } else {
            this.set('selectedWalletIds', []);
        }
    }

    /**
     * 设置筛选条件
     * @param {Object} filters - 筛选条件
     */
    setFilters(filters) {
        this.setState({
            filters: {
                ...this.get('filters'),
                ...filters
            },
            pagination: {
                ...this.get('pagination'),
                page: 1 // 重置到第一页
            }
        });
    }

    /**
     * 设置分页
     * @param {Object} pagination - 分页参数
     */
    setPagination(pagination) {
        this.setState({
            pagination: {
                ...this.get('pagination'),
                ...pagination
            }
        });
    }

    /**
     * 设置钱包余额
     * @param {number} walletId - 钱包ID
     * @param {string} balance - 余额
     */
    setWalletBalance(walletId, balance) {
        this.setState({
            balances: {
                ...this.get('balances'),
                [walletId]: {
                    balance,
                    lastUpdated: Date.now()
                }
            }
        });
    }

    /**
     * 批量设置余额
     * @param {Object} balances - 余额对象 { walletId: balance }
     */
    setBulkBalances(balances) {
        const now = Date.now();
        const balanceData = {};
        
        Object.entries(balances).forEach(([walletId, balance]) => {
            balanceData[walletId] = {
                balance,
                lastUpdated: now
            };
        });
        
        this.setState({
            balances: {
                ...this.get('balances'),
                ...balanceData
            }
        });
    }

    /**
     * 清理过期的余额缓存
     * @param {number} [maxAge=300000] - 最大缓存时间(默认5分钟)
     */
    cleanExpiredBalances(maxAge = 300000) {
        const now = Date.now();
        const balances = this.get('balances');
        const cleaned = {};
        
        Object.entries(balances).forEach(([walletId, data]) => {
            if (now - data.lastUpdated < maxAge) {
                cleaned[walletId] = data;
            }
        });
        
        if (Object.keys(cleaned).length !== Object.keys(balances).length) {
            this.set('balances', cleaned);
        }
    }

    /**
     * 设置批量操作状态
     * @param {Object} status - 批量操作状态
     */
    setBatchOperationStatus(status) {
        this.setState({
            batchOperation: {
                ...this.get('batchOperation'),
                ...status
            }
        });
    }

    /**
     * 获取筛选后的钱包
     * @returns {Array} 筛选后的钱包列表
     */
    getFilteredWallets() {
        const wallets = this.get('wallets');
        const filters = this.get('filters');
        
        let filtered = wallets;
        
        // 搜索筛选
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(w => 
                w.address.toLowerCase().includes(searchLower) ||
                (w.name && w.name.toLowerCase().includes(searchLower)) ||
                (w.notes && w.notes.toLowerCase().includes(searchLower))
            );
        }
        
        // 分组筛选
        if (filters.groupId !== null) {
            filtered = filtered.filter(w => w.groupId === filters.groupId);
        }
        
        // 排序
        if (filters.sortBy) {
            filtered.sort((a, b) => {
                const aVal = a[filters.sortBy];
                const bVal = b[filters.sortBy];
                
                if (filters.sortOrder === 'asc') {
                    return aVal > bVal ? 1 : -1;
                } else {
                    return aVal < bVal ? 1 : -1;
                }
            });
        }
        
        return filtered;
    }

    /**
     * 获取分页后的钱包
     * @returns {Array} 分页后的钱包列表
     */
    getPaginatedWallets() {
        const filtered = this.getFilteredWallets();
        const { page, pageSize } = this.get('pagination');
        
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        
        return filtered.slice(start, end);
    }

    /**
     * 切换分组展开状态
     * @param {number} groupId - 分组ID
     */
    toggleGroupExpansion(groupId) {
        const expandedGroups = this.get('ui.expandedGroups');
        const index = expandedGroups.indexOf(groupId);
        
        if (index === -1) {
            this.set('ui.expandedGroups', [...expandedGroups, groupId]);
        } else {
            this.set('ui.expandedGroups', expandedGroups.filter(id => id !== groupId));
        }
    }

    /**
     * 设置视图模式
     * @param {string} mode - 视图模式 (table/grid)
     */
    setViewMode(mode) {
        this.set('ui.viewMode', mode);
    }
}

// 创建单例实例
const walletStore = new WalletStore();

// 导出store实例和便捷方法
export { walletStore };

// 导出便捷方法
export const getWalletState = () => walletStore.getState();
export const setWalletState = (updates) => walletStore.setState(updates);
export const subscribeToWallets = (callback, paths) => walletStore.subscribe(callback, paths); 