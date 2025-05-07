// 分页模块

import { elements } from './dom.js';
import { state, updatePaginationState } from './state.js';

// 渲染分页控件
export function renderPagination(total) {
    const totalPages = Math.ceil(total / state.itemsPerPage);
    
    if (!elements.paginationWrapper || !elements.pageInfoSpan || !elements.pageNumbersContainer || !elements.prevPageBtn || !elements.nextPageBtn) {
        console.error("Pagination elements not found, cannot render pagination.");
        return;
    }

    const totalCountSpan = elements.paginationWrapper.querySelector('.total-count');
    if (totalCountSpan) {
        totalCountSpan.textContent = total;
    }
    
    elements.pageInfoSpan.textContent = `${state.currentPage}/${totalPages}页 共${total}条`;
    elements.prevPageBtn.disabled = state.currentPage === 1;
    elements.nextPageBtn.disabled = state.currentPage === totalPages;

    elements.pageNumbersContainer.innerHTML = '';
    const maxPageButtons = 5;
    let startPage = Math.max(1, state.currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    
    if (endPage - startPage + 1 < maxPageButtons && totalPages >= maxPageButtons) {
        startPage = endPage - maxPageButtons + 1;
    }
    
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button');
        pageButton.className = `page-number ${i === state.currentPage ? 'active' : ''}`;
        pageButton.textContent = i;
        pageButton.dataset.page = i;
        elements.pageNumbersContainer.appendChild(pageButton);
    }

    elements.paginationWrapper.style.display = totalPages > 0 ? 'flex' : 'none';
}

// 跳转到指定页
export function goToPage(page) {
    const totalPages = Math.ceil(state.totalItems / state.itemsPerPage);
    if (page >= 1 && page <= totalPages && page !== state.currentPage) {
        updatePaginationState(page, state.totalItems);
        return true;
    }
    return false;
}

// 处理页码点击事件
export function handlePageNumberClick(event) {
    const pageButton = event.target.closest('.page-number');
    if (pageButton && !pageButton.classList.contains('active')) {
        const page = parseInt(pageButton.dataset.page, 10);
        if (page) {
            return goToPage(page);
        }
    }
    return false;
}

// 处理每页显示数量变化
export function handlePageSizeChange(event) {
    const newSize = parseInt(event.target.value, 10);
    if (newSize !== state.itemsPerPage) {
        state.itemsPerPage = newSize;
        updatePaginationState(1, state.totalItems);
        return true;
    }
    return false;
} 