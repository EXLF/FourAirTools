/**
 * 反馈管理后台JavaScript
 */

// 全局变量
let currentPage = 1;
let currentLimit = 20;
let currentFilters = {};
let currentFeedback = null;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeEventListeners();
    loadStats();
    loadFeedbacks();
});

/**
 * 初始化事件监听器
 */
function initializeEventListeners() {
    // 搜索按钮
    document.getElementById('search-btn').addEventListener('click', handleSearch);
    
    // 刷新按钮
    document.getElementById('refresh-btn').addEventListener('click', handleRefresh);
    
    // 回车键搜索
    document.getElementById('search-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    
    // 筛选器变化
    document.getElementById('filter-type').addEventListener('change', handleSearch);
    document.getElementById('filter-status').addEventListener('change', handleSearch);
    document.getElementById('filter-priority').addEventListener('change', handleSearch);
}

/**
 * 处理搜索
 */
function handleSearch() {
    currentPage = 1;
    
    // 获取筛选条件
    currentFilters = {
        type: document.getElementById('filter-type').value,
        status: document.getElementById('filter-status').value,
        priority: document.getElementById('filter-priority').value,
        search: document.getElementById('search-input').value.trim()
    };
    
    loadFeedbacks();
}

/**
 * 处理刷新
 */
function handleRefresh() {
    loadStats();
    loadFeedbacks();
}

/**
 * 加载统计数据
 */
async function loadStats() {
    try {
        const response = await fetch('/api/feedback/admin/stats');
        const result = await response.json();
        
        if (result.success) {
            renderStats(result.data);
        } else {
            showToast('加载统计数据失败', 'error');
        }
    } catch (error) {
        console.error('加载统计数据失败:', error);
        showToast('网络错误', 'error');
    }
}

/**
 * 渲染统计数据
 */
function renderStats(stats) {
    const statsGrid = document.getElementById('stats-grid');
    
    statsGrid.innerHTML = `
        <div class="stat-card">
            <h3>${stats.total}</h3>
            <p>总反馈数</p>
        </div>
        <div class="stat-card">
            <h3>${stats.statusStats.pending}</h3>
            <p>待处理</p>
        </div>
        <div class="stat-card">
            <h3>${stats.statusStats.processing}</h3>
            <p>处理中</p>
        </div>
        <div class="stat-card">
            <h3>${stats.statusStats.resolved}</h3>
            <p>已解决</p>
        </div>
        <div class="stat-card">
            <h3>${stats.typeStats.bug || 0}</h3>
            <p>Bug报告</p>
        </div>
        <div class="stat-card">
            <h3>${stats.typeStats.feature || 0}</h3>
            <p>功能建议</p>
        </div>
    `;
}

/**
 * 加载反馈列表
 */
async function loadFeedbacks() {
    showLoading();
    
    try {
        const params = new URLSearchParams({
            page: currentPage,
            limit: currentLimit,
            ...currentFilters
        });
        
        const response = await fetch(`/api/feedback?${params}`);
        const result = await response.json();
        
        if (result.success) {
            renderFeedbacks(result.data.feedbacks);
            renderPagination(result.data.pagination);
        } else {
            showToast('加载反馈列表失败', 'error');
            showEmptyState();
        }
    } catch (error) {
        console.error('加载反馈列表失败:', error);
        showToast('网络错误', 'error');
        showEmptyState();
    } finally {
        hideLoading();
    }
}

/**
 * 渲染反馈列表
 */
function renderFeedbacks(feedbacks) {
    const tbody = document.getElementById('feedback-table-body');
    
    if (feedbacks.length === 0) {
        showEmptyState();
        return;
    }
    
    showTableWrapper();
    
    tbody.innerHTML = feedbacks.map(feedback => `
        <tr>
            <td>${feedback.id}</td>
            <td>
                <span class="type-badge type-${feedback.type}">
                    ${getTypeLabel(feedback.type)}
                </span>
            </td>
            <td>
                <span class="priority-badge priority-${feedback.priority}">
                    ${getPriorityLabel(feedback.priority)}
                </span>
            </td>
            <td>
                <div style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" 
                     title="${escapeHtml(feedback.title)}">
                    ${escapeHtml(feedback.title)}
                </div>
            </td>
            <td>${feedback.contactName || '匿名'}</td>
            <td>
                <span class="status-badge status-${feedback.status}">
                    ${getStatusLabel(feedback.status)}
                </span>
            </td>
            <td>${formatDate(feedback.createdAt)}</td>
            <td>
                <div class="actions">
                    <button class="btn btn-primary" onclick="viewFeedback(${feedback.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-warning" onclick="editFeedback(${feedback.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger" onclick="deleteFeedback(${feedback.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

/**
 * 渲染分页
 */
function renderPagination(pagination) {
    const paginationEl = document.getElementById('pagination');
    
    if (pagination.totalPages <= 1) {
        paginationEl.innerHTML = '';
        return;
    }
    
    let paginationHTML = '';
    
    // 上一页
    paginationHTML += `
        <button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''} 
                onclick="changePage(${pagination.page - 1})">
            <i class="fas fa-chevron-left"></i>
        </button>
    `;
    
    // 页码
    const startPage = Math.max(1, pagination.page - 2);
    const endPage = Math.min(pagination.totalPages, pagination.page + 2);
    
    if (startPage > 1) {
        paginationHTML += `<button class="page-btn" onclick="changePage(1)">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span style="padding: 0 0.5rem;">...</span>`;
        }
    }
    
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `
            <button class="page-btn ${i === pagination.page ? 'active' : ''}" 
                    onclick="changePage(${i})">
                ${i}
            </button>
        `;
    }
    
    if (endPage < pagination.totalPages) {
        if (endPage < pagination.totalPages - 1) {
            paginationHTML += `<span style="padding: 0 0.5rem;">...</span>`;
        }
        paginationHTML += `<button class="page-btn" onclick="changePage(${pagination.totalPages})">${pagination.totalPages}</button>`;
    }
    
    // 下一页
    paginationHTML += `
        <button class="page-btn" ${pagination.page >= pagination.totalPages ? 'disabled' : ''} 
                onclick="changePage(${pagination.page + 1})">
            <i class="fas fa-chevron-right"></i>
        </button>
    `;
    
    paginationEl.innerHTML = paginationHTML;
}

/**
 * 改变页码
 */
function changePage(page) {
    currentPage = page;
    loadFeedbacks();
}

/**
 * 查看反馈详情
 */
async function viewFeedback(id) {
    try {
        const response = await fetch(`/api/feedback/${id}`);
        const result = await response.json();
        
        if (result.success) {
            currentFeedback = result.data;
            showFeedbackModal(result.data, 'view');
        } else {
            showToast('获取反馈详情失败', 'error');
        }
    } catch (error) {
        console.error('获取反馈详情失败:', error);
        showToast('网络错误', 'error');
    }
}

/**
 * 编辑反馈
 */
async function editFeedback(id) {
    try {
        const response = await fetch(`/api/feedback/${id}`);
        const result = await response.json();
        
        if (result.success) {
            currentFeedback = result.data;
            showFeedbackModal(result.data, 'edit');
        } else {
            showToast('获取反馈详情失败', 'error');
        }
    } catch (error) {
        console.error('获取反馈详情失败:', error);
        showToast('网络错误', 'error');
    }
}

/**
 * 删除反馈
 */
async function deleteFeedback(id) {
    if (!confirm('确定要删除这个反馈吗？此操作不可撤销。')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/feedback/${id}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('反馈删除成功', 'success');
            loadStats();
            loadFeedbacks();
        } else {
            showToast('删除失败: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('删除反馈失败:', error);
        showToast('网络错误', 'error');
    }
}

/**
 * 显示反馈模态框
 */
function showFeedbackModal(feedback, mode) {
    const modal = document.getElementById('feedback-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const saveBtn = document.getElementById('save-btn');
    
    modalTitle.textContent = mode === 'edit' ? '编辑反馈' : '反馈详情';
    saveBtn.style.display = mode === 'edit' ? 'inline-block' : 'none';
    
    if (mode === 'view') {
        modalBody.innerHTML = `
            <div class="form-group">
                <label>反馈类型：</label>
                <span class="type-badge type-${feedback.type}">${getTypeLabel(feedback.type)}</span>
            </div>
            
            <div class="form-group">
                <label>优先级：</label>
                <span class="priority-badge priority-${feedback.priority}">${getPriorityLabel(feedback.priority)}</span>
            </div>
            
            <div class="form-group">
                <label>状态：</label>
                <span class="status-badge status-${feedback.status}">${getStatusLabel(feedback.status)}</span>
            </div>
            
            <div class="form-group">
                <label>标题：</label>
                <p>${escapeHtml(feedback.title)}</p>
            </div>
            
            <div class="form-group">
                <label>详细描述：</label>
                <p style="white-space: pre-wrap; background: #f8f9fa; padding: 1rem; border-radius: 4px;">${escapeHtml(feedback.description)}</p>
            </div>
            
            <div class="form-group">
                <label>环境信息：</label>
                <p>浏览器/系统: ${feedback.browser || '未提供'}</p>
                <p>产品版本: ${feedback.version || '未提供'}</p>
                <p>IP地址: ${feedback.ipAddress || '未知'}</p>
            </div>
            
            <div class="form-group">
                <label>联系信息：</label>
                <p>联系人: ${feedback.contactName || '匿名'}</p>
                <p>联系方式: ${feedback.contact || '未提供'}</p>
            </div>
            
            <div class="form-group">
                <label>时间信息：</label>
                <p>创建时间: ${formatDateTime(feedback.createdAt)}</p>
                <p>更新时间: ${formatDateTime(feedback.updatedAt)}</p>
                ${feedback.resolvedAt ? `<p>解决时间: ${formatDateTime(feedback.resolvedAt)}</p>` : ''}
            </div>
            
            ${feedback.adminNotes ? `
                <div class="form-group">
                    <label>管理员备注：</label>
                    <p style="white-space: pre-wrap; background: #f8f9fa; padding: 1rem; border-radius: 4px;">${escapeHtml(feedback.adminNotes)}</p>
                </div>
            ` : ''}
        `;
    } else {
        modalBody.innerHTML = `
            <div class="form-group">
                <label>反馈类型：</label>
                <span class="type-badge type-${feedback.type}">${getTypeLabel(feedback.type)}</span>
            </div>
            
            <div class="form-group">
                <label>标题：</label>
                <p>${escapeHtml(feedback.title)}</p>
            </div>
            
            <div class="form-group">
                <label>状态：</label>
                <select id="modal-status" class="form-select">
                    <option value="pending" ${feedback.status === 'pending' ? 'selected' : ''}>待处理</option>
                    <option value="processing" ${feedback.status === 'processing' ? 'selected' : ''}>处理中</option>
                    <option value="resolved" ${feedback.status === 'resolved' ? 'selected' : ''}>已解决</option>
                    <option value="closed" ${feedback.status === 'closed' ? 'selected' : ''}>已关闭</option>
                </select>
            </div>
            
            <div class="form-group">
                <label>分配给：</label>
                <input type="text" id="modal-assigned" class="form-input" 
                       value="${feedback.assignedTo || ''}" placeholder="处理人员姓名">
            </div>
            
            <div class="form-group">
                <label>管理员备注：</label>
                <textarea id="modal-notes" class="form-textarea" 
                          placeholder="添加处理备注...">${feedback.adminNotes || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label>详细描述：</label>
                <p style="white-space: pre-wrap; background: #f8f9fa; padding: 1rem; border-radius: 4px; max-height: 200px; overflow-y: auto;">${escapeHtml(feedback.description)}</p>
            </div>
        `;
    }
    
    modal.style.display = 'flex';
}

/**
 * 关闭反馈模态框
 */
function closeFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    modal.style.display = 'none';
    currentFeedback = null;
}

/**
 * 保存反馈
 */
async function saveFeedback() {
    if (!currentFeedback) return;
    
    const status = document.getElementById('modal-status').value;
    const assignedTo = document.getElementById('modal-assigned').value.trim();
    const adminNotes = document.getElementById('modal-notes').value.trim();
    
    try {
        const response = await fetch(`/api/feedback/${currentFeedback.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status,
                assignedTo: assignedTo || null,
                adminNotes: adminNotes || null
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('反馈更新成功', 'success');
            closeFeedbackModal();
            loadStats();
            loadFeedbacks();
        } else {
            showToast('更新失败: ' + result.message, 'error');
        }
    } catch (error) {
        console.error('保存反馈失败:', error);
        showToast('网络错误', 'error');
    }
}

/**
 * 显示加载状态
 */
function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('table-wrapper').style.display = 'none';
    document.getElementById('empty-state').style.display = 'none';
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

/**
 * 显示表格
 */
function showTableWrapper() {
    document.getElementById('table-wrapper').style.display = 'block';
    document.getElementById('empty-state').style.display = 'none';
}

/**
 * 显示空状态
 */
function showEmptyState() {
    document.getElementById('table-wrapper').style.display = 'none';
    document.getElementById('empty-state').style.display = 'block';
}

/**
 * 显示Toast消息
 */
function showToast(message, type = 'info', duration = 3000) {
    // 移除现有的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 创建新的toast
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 显示toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    // 自动隐藏
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, duration);
}

/**
 * 工具函数
 */

// 获取类型标签
function getTypeLabel(type) {
    const typeLabels = {
        bug: 'Bug报告',
        feature: '功能建议',
        improvement: '体验优化',
        other: '其他反馈'
    };
    return typeLabels[type] || type;
}

// 获取优先级标签
function getPriorityLabel(priority) {
    const priorityLabels = {
        low: '一般',
        medium: '重要',
        high: '紧急'
    };
    return priorityLabels[priority] || priority;
}

// 获取状态标签
function getStatusLabel(status) {
    const statusLabels = {
        pending: '待处理',
        processing: '处理中',
        resolved: '已解决',
        closed: '已关闭'
    };
    return statusLabels[status] || status;
}

// 格式化日期
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN');
}

// 格式化日期时间
function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
} 