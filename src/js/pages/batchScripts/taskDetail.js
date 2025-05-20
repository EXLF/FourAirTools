/**
 * 批量脚本任务详情模块
 * 负责展示任务详情和状态
 */

import { TaskLogger } from './logger.js';
import { showModal, closeModal } from '../../components/modal.js';

let currentTaskId = null;
let currentDetailContainer = null;
let logRenderCleanup = null;
let taskUpdateRemover = null;

/**
 * 渲染任务详情
 * @param {string} taskId - 任务ID
 * @param {HTMLElement} pageContainer - 页面容器
 * @param {Object} batchTaskManager - 批量任务管理器实例
 */
export async function renderTaskDetail(taskId, pageContainer, batchTaskManager) {
    // 清理之前的监听器
    if (taskUpdateRemover) {
        taskUpdateRemover();
    }
    
    // 保存当前状态
    currentTaskId = taskId;
    
    try {
        // 获取任务数据
        const taskData = await batchTaskManager.getTaskById(taskId);
        if (!taskData) {
            throw new Error(`未找到任务 ${taskId} 的数据`);
        }
        
        // 获取任务详情面板容器
        const detailPanel = pageContainer.querySelector('#taskDetailPanel');
        if (!detailPanel) return;
        
        // 使用任务详情模板渲染
        const template = document.getElementById('tpl-batch-task-detail');
        if (!template) {
            console.error('未找到任务详情模板');
            return;
        }
        
        // 克隆模板内容
        const detailContent = template.content.cloneNode(true);
        detailPanel.innerHTML = '';
        detailPanel.appendChild(detailContent);
        
        // 保存详情容器引用
        currentDetailContainer = detailPanel;
        
        // 填充任务数据
        fillTaskData(taskData, detailPanel);
        
        // 绑定任务操作按钮事件
        bindTaskActionButtons(detailPanel, taskId, batchTaskManager);
        
        // 设置账户状态筛选器
        setupAccountFilters(detailPanel);
        
        // 渲染账户状态列表
        renderAccountStatusList(taskData, detailPanel);
        
        // 设置日志渲染
        setupLogRendering(detailPanel);
        
        // 注册任务更新监听器
        taskUpdateRemover = batchTaskManager.addTaskEventListener(taskId, handleTaskUpdate);
    } catch (error) {
        console.error(`渲染任务详情失败:`, error);
        const detailPanel = pageContainer.querySelector('#taskDetailPanel');
        if (detailPanel) {
            detailPanel.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>加载任务详情失败: ${error.message}</p>
                </div>
            `;
        }
    }
}

/**
 * 填充任务详情数据
 * @param {Object} taskData - 任务数据
 * @param {HTMLElement} container - 容器元素
 */
function fillTaskData(taskData, container) {
    // 设置任务标题
    const titleElement = container.querySelector('.task-detail-title');
    if (titleElement) {
        titleElement.textContent = taskData.name || '未命名任务';
    }
    
    // 设置脚本名称
    const scriptNameElement = container.querySelector('#taskScriptName');
    if (scriptNameElement) {
        scriptNameElement.textContent = taskData.scriptName || taskData.scriptId || '未指定';
    }
    
    // 设置状态徽章
    const statusBadgeElement = container.querySelector('#taskStatusBadge');
    if (statusBadgeElement) {
        const statusClass = getStatusClass(taskData.status);
        const statusText = getStatusText(taskData.status);
        statusBadgeElement.className = `status-badge ${statusClass}`;
        statusBadgeElement.textContent = statusText;
    }
    
    // 设置账户数量
    const accountCountElement = container.querySelector('#taskAccountCount');
    if (accountCountElement) {
        accountCountElement.textContent = taskData.accountIds?.length || 0;
    }
    
    const accountBadgeElement = container.querySelector('#accountCountBadge');
    if (accountBadgeElement) {
        accountBadgeElement.textContent = taskData.accountIds?.length || 0;
    }
    
    // 设置进度条
    const progressBar = container.querySelector('#taskProgressBar');
    const progressText = container.querySelector('#taskProgressText');
    if (progressBar && progressText) {
        const progress = taskData.progress || 0;
        progressBar.style.width = `${progress}%`;
        
        const completedCount = taskData.accountStatus 
            ? Object.values(taskData.accountStatus).filter(s => ['success', 'failed'].includes(s.status)).length
            : 0;
        const totalCount = taskData.accountIds?.length || 0;
        
        progressText.textContent = `${completedCount}/${totalCount} 完成`;
    }
}

/**
 * 绑定任务操作按钮事件
 * @param {HTMLElement} container - 容器元素
 * @param {string} taskId - 任务ID
 * @param {Object} batchTaskManager - 批量任务管理器实例
 */
function bindTaskActionButtons(container, taskId, batchTaskManager) {
    // 开始按钮
    const startButton = container.querySelector('#startBatchTaskBtn');
    if (startButton) {
        startButton.addEventListener('click', async () => {
            try {
                startButton.disabled = true;
                startButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 启动中...';
                
                await batchTaskManager.startTask(taskId);
                
                // 按钮状态会通过任务更新事件自动更新
            } catch (error) {
                console.error(`启动任务失败:`, error);
                TaskLogger.logError(`启动任务失败: ${error.message}`);
                
                // 恢复按钮状态
                startButton.disabled = false;
                startButton.innerHTML = '<i class="fas fa-play"></i> 开始';
            }
        });
    }
    
    // 暂停按钮
    const pauseButton = container.querySelector('#pauseBatchTaskBtn');
    if (pauseButton) {
        pauseButton.addEventListener('click', async () => {
            try {
                pauseButton.disabled = true;
                pauseButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 暂停中...';
                
                await batchTaskManager.pauseTask(taskId);
                
                // 按钮状态会通过任务更新事件自动更新
            } catch (error) {
                console.error(`暂停任务失败:`, error);
                TaskLogger.logError(`暂停任务失败: ${error.message}`);
                
                // 恢复按钮状态
                pauseButton.disabled = false;
                pauseButton.innerHTML = '<i class="fas fa-pause"></i> 暂停';
            }
        });
    }
    
    // 停止按钮
    const stopButton = container.querySelector('#stopBatchTaskBtn');
    if (stopButton) {
        stopButton.addEventListener('click', async () => {
            try {
                stopButton.disabled = true;
                stopButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 停止中...';
                
                await batchTaskManager.stopTask(taskId);
                
                // 按钮状态会通过任务更新事件自动更新
            } catch (error) {
                console.error(`停止任务失败:`, error);
                TaskLogger.logError(`停止任务失败: ${error.message}`);
                
                // 恢复按钮状态
                stopButton.disabled = false;
                stopButton.innerHTML = '<i class="fas fa-stop"></i> 停止';
            }
        });
    }
    
    // 删除任务按钮
    const deleteButton = container.querySelector('#deleteBatchTaskBtn');
    if (deleteButton) {
        deleteButton.addEventListener('click', () => {
            // 确认删除
            showConfirmDialog(
                '确认删除', 
                '确定要删除此任务吗？此操作不可撤销。',
                async () => {
                    try {
                        await batchTaskManager.deleteTask(taskId);
                        
                        // 任务删除成功，刷新列表
                        const refreshBtn = document.querySelector('#refresh-batch-list-btn');
                        if (refreshBtn) {
                            refreshBtn.click();
                        }
                    } catch (error) {
                        console.error(`删除任务失败:`, error);
                        TaskLogger.logError(`删除任务失败: ${error.message}`);
                    }
                }
            );
        });
    }
    
    // 编辑任务按钮
    const editButton = container.querySelector('#editBatchTaskBtn');
    if (editButton) {
        editButton.addEventListener('click', () => {
            // TODO: 实现编辑任务功能
            TaskLogger.logInfo('编辑任务功能正在开发中...');
        });
    }
    
    // 复制任务按钮
    const duplicateButton = container.querySelector('#duplicateBatchTaskBtn');
    if (duplicateButton) {
        duplicateButton.addEventListener('click', () => {
            // TODO: 实现复制任务功能
            TaskLogger.logInfo('复制任务功能正在开发中...');
        });
    }
    
    // 导出结果按钮
    const exportButton = container.querySelector('#exportBatchTaskBtn');
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            // TODO: 实现导出结果功能
            TaskLogger.logInfo('导出结果功能正在开发中...');
        });
    }
}

/**
 * 设置账户状态筛选器
 * @param {HTMLElement} container - 容器元素
 */
function setupAccountFilters(container) {
    const filterButtons = container.querySelectorAll('.account-status-filters .btn-filter');
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // 移除所有按钮的活动状态
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // 添加当前按钮的活动状态
            button.classList.add('active');
            
            // 获取筛选值
            const filterValue = button.getAttribute('data-filter');
            
            // 筛选账户列表
            filterAccountList(container, filterValue);
        });
    });
}

/**
 * 筛选账户列表
 * @param {HTMLElement} container - 容器元素
 * @param {string} filterValue - 筛选值
 */
function filterAccountList(container, filterValue) {
    const accountItems = container.querySelectorAll('.account-item');
    accountItems.forEach(item => {
        const status = item.getAttribute('data-status');
        
        if (filterValue === 'all' || status === filterValue) {
            item.style.display = '';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * 渲染账户状态列表
 * @param {Object} taskData - 任务数据
 * @param {HTMLElement} container - 容器元素
 */
function renderAccountStatusList(taskData, container) {
    const accountList = container.querySelector('#accountStatusList');
    if (!accountList) return;
    
    // 如果没有账户，显示提示信息
    if (!taskData.accountIds || taskData.accountIds.length === 0) {
        accountList.innerHTML = '<div class="empty-message">此任务没有关联账户</div>';
        return;
    }
    
    const accountStatus = taskData.accountStatus || {};
    let accountListHTML = '';
    
    taskData.accountIds.forEach(accountId => {
        const status = accountStatus[accountId]?.status || 'pending';
        const statusClass = getAccountStatusClass(status);
        const statusText = getAccountStatusText(status);
        
        let displayAccount = accountId;
        if (displayAccount.length > 12) {
            displayAccount = displayAccount.substring(0, 6) + '...' + displayAccount.substring(displayAccount.length - 4);
        }
        
        accountListHTML += `
            <div class="account-item" data-account-id="${accountId}" data-status="${status}">
                <div class="account-address">${displayAccount}</div>
                <div class="account-status ${statusClass}">${statusText}</div>
            </div>
        `;
    });
    
    accountList.innerHTML = accountListHTML;
}

/**
 * 设置日志渲染
 * @param {HTMLElement} container - 容器元素
 */
function setupLogRendering(container) {
    const logContainer = container.querySelector('#taskLogContainer');
    if (!logContainer) return;
    
    // 清理之前的日志渲染器
    if (logRenderCleanup) {
        logRenderCleanup();
    }
    
    // 清空日志容器
    logContainer.innerHTML = '';
    
    // 创建新的日志渲染器
    logRenderCleanup = TaskLogger.renderLogsToContainer(logContainer, true);
}

/**
 * 处理任务更新
 * @param {string} taskId - 任务ID
 * @param {Object} updateData - 更新数据
 */
function handleTaskUpdate(taskId, updateData) {
    if (!currentDetailContainer || taskId !== currentTaskId) return;
    
    // 更新任务状态
    if (updateData.status) {
        const statusBadge = currentDetailContainer.querySelector('#taskStatusBadge');
        if (statusBadge) {
            const statusClass = getStatusClass(updateData.status);
            const statusText = getStatusText(updateData.status);
            statusBadge.className = `status-badge ${statusClass}`;
            statusBadge.textContent = statusText;
        }
        
        // 更新按钮状态
        updateButtonStates(currentDetailContainer, updateData.status);
    }
    
    // 更新进度
    if (typeof updateData.progress === 'number') {
        const progressBar = currentDetailContainer.querySelector('#taskProgressBar');
        if (progressBar) {
            progressBar.style.width = `${updateData.progress}%`;
        }
    }
    
    // 更新账户状态
    if (updateData.accountId && updateData.accountState) {
        updateAccountStatus(
            currentDetailContainer, 
            updateData.accountId, 
            updateData.accountState
        );
    }
}

/**
 * 更新按钮状态
 * @param {HTMLElement} container - 容器元素
 * @param {string} taskStatus - 任务状态
 */
function updateButtonStates(container, taskStatus) {
    const startBtn = container.querySelector('#startBatchTaskBtn');
    const pauseBtn = container.querySelector('#pauseBatchTaskBtn');
    const stopBtn = container.querySelector('#stopBatchTaskBtn');
    
    if (!startBtn || !pauseBtn || !stopBtn) return;
    
    // 重置按钮文本
    startBtn.innerHTML = '<i class="fas fa-play"></i> 开始';
    pauseBtn.innerHTML = '<i class="fas fa-pause"></i> 暂停';
    stopBtn.innerHTML = '<i class="fas fa-stop"></i> 停止';
    
    // 根据任务状态设置按钮状态
    if (taskStatus === 'running') {
        startBtn.disabled = true;
        pauseBtn.disabled = false;
        stopBtn.disabled = false;
    } else if (taskStatus === 'paused') {
        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fas fa-play"></i> 继续';
        pauseBtn.disabled = true;
        stopBtn.disabled = false;
    } else {
        // 完成或失败或其他状态
        startBtn.disabled = false;
        pauseBtn.disabled = true;
        stopBtn.disabled = true;
    }
}

/**
 * 更新账户状态
 * @param {HTMLElement} container - 容器元素
 * @param {string} accountId - 账户ID
 * @param {string} status - 状态
 */
function updateAccountStatus(container, accountId, status) {
    const accountItem = container.querySelector(`.account-item[data-account-id="${accountId}"]`);
    if (!accountItem) return;
    
    // 更新状态属性
    accountItem.setAttribute('data-status', status);
    
    // 更新状态文本
    const statusElement = accountItem.querySelector('.account-status');
    if (statusElement) {
        const statusClass = getAccountStatusClass(status);
        const statusText = getAccountStatusText(status);
        statusElement.className = `account-status ${statusClass}`;
        statusElement.textContent = statusText;
    }
    
    // 更新完成计数
    updateCompletionCount(container);
}

/**
 * 更新完成计数
 * @param {HTMLElement} container - 容器元素
 */
function updateCompletionCount(container) {
    const accountItems = container.querySelectorAll('.account-item');
    const totalCount = accountItems.length;
    
    // 计算已完成的账户数量
    const completedCount = Array.from(accountItems).filter(item => {
        const status = item.getAttribute('data-status');
        return ['success', 'failed'].includes(status);
    }).length;
    
    // 更新进度文本
    const progressText = container.querySelector('#taskProgressText');
    if (progressText) {
        progressText.textContent = `${completedCount}/${totalCount} 完成`;
    }
}

/**
 * 显示确认对话框
 * @param {string} title - 标题
 * @param {string} message - 消息
 * @param {Function} onConfirm - 确认回调
 */
function showConfirmDialog(title, message, onConfirm) {
    const dialogHTML = `
        <div class="modal-box confirm-dialog">
            <h3 class="modal-title">${title}</h3>
            <div class="modal-content">
                <p>${message}</p>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary cancel-btn">取消</button>
                <button class="btn btn-danger confirm-btn">确认</button>
            </div>
        </div>
    `;
    
    const modalId = showModal(dialogHTML);
    
    // 绑定按钮事件
    const modal = document.getElementById(modalId);
    if (modal) {
        const cancelBtn = modal.querySelector('.cancel-btn');
        const confirmBtn = modal.querySelector('.confirm-btn');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                closeModal(modalId);
            });
        }
        
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                closeModal(modalId);
                if (typeof onConfirm === 'function') {
                    onConfirm();
                }
            });
        }
    }
}

/**
 * 获取任务状态对应的CSS类
 * @param {string} status - 状态
 * @returns {string} CSS类
 */
function getStatusClass(status) {
    switch (status) {
        case 'running': return 'status-running';
        case 'completed': 
        case 'completed_with_errors': 
            return 'status-completed';
        case 'failed': 
        case 'stopped':
            return 'status-failed';
        case 'paused': return 'status-paused';
        default: return 'status-idle';
    }
}

/**
 * 获取任务状态文本
 * @param {string} status - 状态
 * @returns {string} 状态文本
 */
function getStatusText(status) {
    switch (status) {
        case 'running': return '运行中';
        case 'completed': return '已完成';
        case 'completed_with_errors': return '部分完成';
        case 'failed': return '失败';
        case 'stopped': return '已停止';
        case 'paused': return '已暂停';
        default: return '待执行';
    }
}

/**
 * 获取账户状态CSS类
 * @param {string} status - 状态
 * @returns {string} CSS类
 */
function getAccountStatusClass(status) {
    switch (status) {
        case 'pending': return 'status-idle';
        case 'running': return 'status-running';
        case 'success': return 'status-completed';
        case 'failed': return 'status-failed';
        default: return 'status-idle';
    }
}

/**
 * 获取账户状态文本
 * @param {string} status - 状态
 * @returns {string} 状态文本
 */
function getAccountStatusText(status) {
    switch (status) {
        case 'pending': return '待执行';
        case 'running': return '执行中';
        case 'success': return '成功';
        case 'failed': return '失败';
        default: return status;
    }
} 