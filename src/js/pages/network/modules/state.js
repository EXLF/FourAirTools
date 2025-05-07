// 状态管理模块

// 全局状态
export const state = {
    isLoading: false,
    currentPage: 1,
    itemsPerPage: 10,
    totalItems: 0,
    currentSort: { field: 'id', order: 'asc' },
    currentFilters: { type: 'all', groupId: 'all', status: 'all', search: '' },
    groupsCache: []
};

// 更新加载状态
export function setLoading(loading) {
    state.isLoading = loading;
}

// 更新分页状态
export function updatePaginationState(page, total) {
    state.currentPage = page;
    state.totalItems = total;
}

// 更新排序状态
export function updateSortState(field, order) {
    state.currentSort = { field, order };
}

// 更新筛选状态
export function updateFilterState(filters) {
    state.currentFilters = { ...state.currentFilters, ...filters };
}

// 更新分组缓存
export function updateGroupsCache(groups) {
    state.groupsCache = groups;
}

// 获取当前查询选项
export function getCurrentQueryOptions() {
    return {
        page: state.currentPage,
        limit: state.itemsPerPage,
        sortBy: state.currentSort.field,
        sortOrder: state.currentSort.order,
        ...state.currentFilters
    };
} 