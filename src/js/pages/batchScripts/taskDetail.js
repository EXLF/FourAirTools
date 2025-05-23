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
            // 实现编辑任务功能
            showEditTaskDialog(taskId, batchTaskManager);
        });
    }
    
    // 复制任务按钮
    const duplicateButton = container.querySelector('#duplicateBatchTaskBtn');
    if (duplicateButton) {
        duplicateButton.addEventListener('click', () => {
            // 实现复制任务功能
            duplicateTask(taskId, batchTaskManager);
        });
    }
    
    // 导出结果按钮
    const exportButton = container.querySelector('#exportBatchTaskBtn');
    if (exportButton) {
        exportButton.addEventListener('click', () => {
            // 实现导出结果功能
            exportTaskResults(taskId, batchTaskManager);
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

/**
 * 显示编辑任务对话框
 * @param {string} taskId - 任务ID
 * @param {Object} batchTaskManager - 批量任务管理器实例
 */
async function showEditTaskDialog(taskId, batchTaskManager) {
    try {
        // 获取任务数据
        const taskData = await batchTaskManager.getTaskData(taskId);
        if (!taskData) {
            TaskLogger.logError('无法获取任务数据');
            return;
        }
        
        // 创建编辑对话框
        const dialogHTML = `
            <div class="modal-box edit-task-dialog" style="width: 600px;">
                <h3 class="modal-title">编辑任务</h3>
                <div class="modal-content">
                    <form id="editTaskForm">
                        <div class="form-group">
                            <label>任务名称</label>
                            <input type="text" id="editTaskName" class="form-input" 
                                value="${taskData.name || ''}" placeholder="输入任务名称">
                        </div>
                        
                        <div class="form-group">
                            <label>描述</label>
                            <textarea id="editTaskDescription" class="form-input" rows="3" 
                                placeholder="输入任务描述">${taskData.description || ''}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>脚本配置</label>
                            <textarea id="editTaskConfig" class="form-input" rows="5" 
                                placeholder="输入脚本配置（JSON格式）">${JSON.stringify(taskData.scriptConfig || {}, null, 2)}</textarea>
                        </div>
                        
                        <div class="form-group">
                            <label>执行间隔（毫秒）</label>
                            <input type="number" id="editTaskInterval" class="form-input" 
                                value="${taskData.interval || 1000}" min="100" step="100">
                        </div>
                        
                        <div class="form-group">
                            <label>账户选择</label>
                            <div id="editAccountSelection" class="account-selection-list">
                                <!-- 动态生成账户列表 -->
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="closeModal('${modalId}')">取消</button>
                    <button class="btn btn-primary" id="saveTaskBtn">保存</button>
                </div>
            </div>
        `;
        
        const modalId = showModal(dialogHTML);
        const modal = document.getElementById(modalId);
        
        // 加载账户列表
        await loadAccountSelectionList(modal, taskData.accountIds);
        
        // 绑定保存按钮
        const saveBtn = modal.querySelector('#saveTaskBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                await saveEditedTask(taskId, batchTaskManager, modal, modalId);
            });
        }
        
    } catch (error) {
        console.error('显示编辑对话框失败:', error);
        TaskLogger.logError(`显示编辑对话框失败: ${error.message}`);
    }
}

/**
 * 加载账户选择列表
 * @param {HTMLElement} modal - 模态框元素
 * @param {Array} selectedAccountIds - 已选中的账户ID
 */
async function loadAccountSelectionList(modal, selectedAccountIds = []) {
    const container = modal.querySelector('#editAccountSelection');
    if (!container) return;
    
    try {
        // 获取所有账户（这里需要根据实际情况调整）
        const accounts = await window.electronAPI.social.getAccounts();
        
        let html = '<div class="account-checkbox-list">';
        
        accounts.forEach(account => {
            const isChecked = selectedAccountIds.includes(account.id) ? 'checked' : '';
            html += `
                <label class="checkbox-item">
                    <input type="checkbox" value="${account.id}" ${isChecked}>
                    <span>${account.name || account.platform || account.id}</span>
                </label>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
        
    } catch (error) {
        console.error('加载账户列表失败:', error);
        container.innerHTML = '<p class="error-message">加载账户列表失败</p>';
    }
}

/**
 * 保存编辑的任务
 * @param {string} taskId - 任务ID
 * @param {Object} batchTaskManager - 批量任务管理器
 * @param {HTMLElement} modal - 模态框元素
 * @param {string} modalId - 模态框ID
 */
async function saveEditedTask(taskId, batchTaskManager, modal, modalId) {
    try {
        // 获取表单数据
        const name = modal.querySelector('#editTaskName').value.trim();
        const description = modal.querySelector('#editTaskDescription').value.trim();
        const configText = modal.querySelector('#editTaskConfig').value.trim();
        const interval = parseInt(modal.querySelector('#editTaskInterval').value);
        
        // 获取选中的账户
        const selectedAccounts = [];
        modal.querySelectorAll('#editAccountSelection input[type="checkbox"]:checked').forEach(checkbox => {
            selectedAccounts.push(checkbox.value);
        });
        
        // 验证数据
        if (!name) {
            TaskLogger.logError('任务名称不能为空');
            return;
        }
        
        let scriptConfig = {};
        if (configText) {
            try {
                scriptConfig = JSON.parse(configText);
            } catch (e) {
                TaskLogger.logError('脚本配置格式错误，请输入有效的JSON');
                return;
            }
        }
        
        // 更新任务数据
        const updateData = {
            name,
            description,
            scriptConfig,
            interval,
            accountIds: selectedAccounts
        };
        
        await batchTaskManager.updateTask(taskId, updateData);
        
        TaskLogger.logSuccess('任务更新成功');
        closeModal(modalId);
        
        // 刷新任务详情
        const currentTask = await batchTaskManager.getTaskData(taskId);
        if (currentTask && currentDetailContainer) {
            fillTaskData(currentTask, currentDetailContainer);
            renderAccountStatusList(currentTask, currentDetailContainer);
        }
        
    } catch (error) {
        console.error('保存任务失败:', error);
        TaskLogger.logError(`保存任务失败: ${error.message}`);
    }
}

/**
 * 复制任务
 * @param {string} taskId - 任务ID
 * @param {Object} batchTaskManager - 批量任务管理器
 */
async function duplicateTask(taskId, batchTaskManager) {
    try {
        // 获取原任务数据
        const originalTask = await batchTaskManager.getTaskData(taskId);
        if (!originalTask) {
            TaskLogger.logError('无法获取任务数据');
            return;
        }
        
        // 创建新任务数据
        const newTaskData = {
            ...originalTask,
            id: undefined, // 移除ID，让系统生成新ID
            name: `${originalTask.name} (副本)`,
            status: 'idle',
            progress: 0,
            accountStatus: {},
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // 创建新任务
        const newTaskId = await batchTaskManager.createTask(newTaskData);
        
        if (newTaskId) {
            TaskLogger.logSuccess('任务复制成功');
            
            // 刷新任务列表
            const refreshBtn = document.querySelector('#refresh-batch-list-btn');
            if (refreshBtn) {
                refreshBtn.click();
            }
            
            // 可选：自动选中新任务
            setTimeout(() => {
                const newTaskItem = document.querySelector(`.batch-task-item[data-task-id="${newTaskId}"]`);
                if (newTaskItem) {
                    newTaskItem.click();
                }
            }, 500);
        }
        
    } catch (error) {
        console.error('复制任务失败:', error);
        TaskLogger.logError(`复制任务失败: ${error.message}`);
    }
}

/**
 * 导出任务结果
 * @param {string} taskId - 任务ID
 * @param {Object} batchTaskManager - 批量任务管理器
 */
async function exportTaskResults(taskId, batchTaskManager) {
    try {
        // 获取任务数据
        const taskData = await batchTaskManager.getTaskData(taskId);
        if (!taskData) {
            TaskLogger.logError('无法获取任务数据');
            return;
        }
        
        // 准备导出数据
        const exportData = {
            taskInfo: {
                id: taskData.id,
                name: taskData.name,
                description: taskData.description,
                scriptId: taskData.scriptId,
                scriptName: taskData.scriptName,
                status: taskData.status,
                progress: taskData.progress,
                createdAt: taskData.createdAt,
                updatedAt: taskData.updatedAt
            },
            summary: {
                totalAccounts: taskData.accountIds?.length || 0,
                successCount: 0,
                failedCount: 0,
                pendingCount: 0
            },
            accountResults: []
        };
        
        // 收集账户结果
        if (taskData.accountIds && taskData.accountStatus) {
            taskData.accountIds.forEach(accountId => {
                const status = taskData.accountStatus[accountId] || { status: 'pending' };
                
                // 更新统计
                if (status.status === 'success') exportData.summary.successCount++;
                else if (status.status === 'failed') exportData.summary.failedCount++;
                else exportData.summary.pendingCount++;
                
                exportData.accountResults.push({
                    accountId,
                    status: status.status,
                    result: status.result,
                    error: status.error,
                    startTime: status.startTime,
                    endTime: status.endTime,
                    duration: status.endTime && status.startTime 
                        ? new Date(status.endTime) - new Date(status.startTime) 
                        : null
                });
            });
        }
        
        // 生成文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `task-results-${taskData.name.replace(/[^a-zA-Z0-9]/g, '-')}-${timestamp}`;
        
        // 显示导出选项对话框
        showExportOptionsDialog(exportData, filename);
        
    } catch (error) {
        console.error('导出任务结果失败:', error);
        TaskLogger.logError(`导出任务结果失败: ${error.message}`);
    }
}

/**
 * 显示导出选项对话框
 * @param {Object} exportData - 导出数据
 * @param {string} filename - 文件名
 */
function showExportOptionsDialog(exportData, filename) {
    const dialogHTML = `
        <div class="modal-box export-options-dialog">
            <h3 class="modal-title">导出任务结果</h3>
            <div class="modal-content">
                <div class="export-summary">
                    <h4>任务摘要</h4>
                    <div class="summary-stats">
                        <div class="stat-item">
                            <span class="stat-label">总账户数:</span>
                            <span class="stat-value">${exportData.summary.totalAccounts}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">成功:</span>
                            <span class="stat-value success">${exportData.summary.successCount}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">失败:</span>
                            <span class="stat-value failed">${exportData.summary.failedCount}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">待处理:</span>
                            <span class="stat-value pending">${exportData.summary.pendingCount}</span>
                        </div>
                    </div>
                </div>
                
                <div class="export-options">
                    <h4>导出格式</h4>
                    <div class="format-options">
                        <label class="radio-item">
                            <input type="radio" name="exportFormat" value="json" checked>
                            <span>JSON格式</span>
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="exportFormat" value="csv">
                            <span>CSV格式</span>
                        </label>
                        <label class="radio-item">
                            <input type="radio" name="exportFormat" value="txt">
                            <span>文本格式</span>
                        </label>
                    </div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="closeModal('${modalId}')">取消</button>
                <button class="btn btn-primary" id="confirmExportBtn">导出</button>
            </div>
        </div>
    `;
    
    const modalId = showModal(dialogHTML);
    const modal = document.getElementById(modalId);
    
    // 绑定导出按钮
    const confirmBtn = modal.querySelector('#confirmExportBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            const format = modal.querySelector('input[name="exportFormat"]:checked').value;
            await performExport(exportData, filename, format);
            closeModal(modalId);
        });
    }
}

/**
 * 执行导出
 * @param {Object} exportData - 导出数据
 * @param {string} filename - 文件名
 * @param {string} format - 导出格式
 */
async function performExport(exportData, filename, format) {
    try {
        let content = '';
        let fileExtension = format;
        
        switch (format) {
            case 'json':
                content = JSON.stringify(exportData, null, 2);
                break;
                
            case 'csv':
                content = convertToCSV(exportData);
                break;
                
            case 'txt':
                content = convertToText(exportData);
                break;
        }
        
        // 创建下载
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        TaskLogger.logSuccess('导出成功');
        
    } catch (error) {
        console.error('执行导出失败:', error);
        TaskLogger.logError(`执行导出失败: ${error.message}`);
    }
}

/**
 * 转换为CSV格式
 * @param {Object} exportData - 导出数据
 * @returns {string} CSV内容
 */
function convertToCSV(exportData) {
    const headers = ['账户ID', '状态', '开始时间', '结束时间', '耗时(ms)', '结果/错误'];
    const rows = [headers.join(',')];
    
    exportData.accountResults.forEach(result => {
        const row = [
            result.accountId,
            result.status,
            result.startTime || '',
            result.endTime || '',
            result.duration || '',
            result.error || result.result || ''
        ];
        rows.push(row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    });
    
    return rows.join('\n');
}

/**
 * 转换为文本格式
 * @param {Object} exportData - 导出数据
 * @returns {string} 文本内容
 */
function convertToText(exportData) {
    let text = '任务执行结果报告\n';
    text += '='.repeat(50) + '\n\n';
    
    // 任务信息
    text += '任务信息:\n';
    text += `-任务名称: ${exportData.taskInfo.name}\n`;
    text += `-任务ID: ${exportData.taskInfo.id}\n`;
    text += `-脚本: ${exportData.taskInfo.scriptName}\n`;
    text += `-状态: ${exportData.taskInfo.status}\n`;
    text += `-创建时间: ${new Date(exportData.taskInfo.createdAt).toLocaleString()}\n`;
    text += '\n';
    
    // 执行统计
    text += '执行统计:\n';
    text += `-总账户数: ${exportData.summary.totalAccounts}\n`;
    text += `-成功: ${exportData.summary.successCount}\n`;
    text += `-失败: ${exportData.summary.failedCount}\n`;
    text += `-待处理: ${exportData.summary.pendingCount}\n`;
    text += '\n';
    
    // 详细结果
    text += '详细结果:\n';
    text += '-'.repeat(50) + '\n';
    
    exportData.accountResults.forEach((result, index) => {
        text += `\n[${index + 1}] ${result.accountId}\n`;
        text += `  状态: ${result.status}\n`;
        if (result.startTime) {
            text += `  开始时间: ${new Date(result.startTime).toLocaleString()}\n`;
        }
        if (result.endTime) {
            text += `  结束时间: ${new Date(result.endTime).toLocaleString()}\n`;
        }
        if (result.duration) {
            text += `  耗时: ${(result.duration / 1000).toFixed(2)}秒\n`;
        }
        if (result.error) {
            text += `  错误: ${result.error}\n`;
        } else if (result.result) {
            text += `  结果: ${result.result}\n`;
        }
    });
    
    return text;
} 