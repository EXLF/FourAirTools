/**
 * @fileoverview 脚本管理器 - 使用scriptStore进行状态管理
 * @module pages/batchScripts/scriptManager
 */

import { scriptStore, subscribeToScripts } from '../../stores/scriptStore.js';
import { showToast } from '../../components/toast.js';
import { showConfirmDialog } from '../../components/confirm.js';

/**
 * 脚本管理器类
 * 连接scriptStore和UI，处理脚本执行相关的业务逻辑
 */
class ScriptManager {
    constructor() {
        this.unsubscribe = null;
        this.elements = null;
        this.initialized = false;
        this.taskEventListeners = new Map();
    }

    /**
     * 初始化脚本管理器
     * @param {Object} elements - DOM元素引用
     */
    async initialize(elements) {
        if (this.initialized) {
            console.warn('[ScriptManager] 已经初始化，跳过重复初始化');
            return;
        }

        this.elements = elements;
        
        // 订阅store变化
        this.unsubscribe = subscribeToScripts(
            (state, changes) => this.handleStoreChange(state, changes),
            ['scripts', 'tasks', 'ui.selectedScript', 'ui.selectedCategory']
        );

        // 监听脚本执行事件
        this.setupScriptEventListeners();

        // 初始加载数据
        await this.loadInitialData();
        
        this.initialized = true;
        console.log('[ScriptManager] 初始化完成');
    }

    /**
     * 加载初始数据
     */
    async loadInitialData() {
        try {
            scriptStore.set('ui.loading', true);
            
            // 加载可用脚本列表
            const scriptsResult = await window.electronAPI.script.getAvailableScripts();
            
            if (scriptsResult.success) {
                scriptStore.setScripts(scriptsResult.data);
            } else {
                throw new Error(scriptsResult.message || '加载脚本列表失败');
            }

            // 加载正在执行的任务
            const tasksResult = await window.electronAPI.script.getAllTasks();
            
            if (tasksResult.success && tasksResult.data) {
                // 恢复任务到store
                tasksResult.data.forEach(task => {
                    scriptStore.setState({
                        tasks: {
                            ...scriptStore.get('tasks'),
                            [task.id]: task
                        }
                    });
                    
                    if (task.status === 'running') {
                        scriptStore.setState({
                            activeTasks: [...scriptStore.get('activeTasks'), task.id]
                        });
                    }
                });
            }

        } catch (error) {
            console.error('[ScriptManager] 加载初始数据失败:', error);
            showToast('加载数据失败: ' + error.message, 'error');
        } finally {
            scriptStore.set('ui.loading', false);
        }
    }

    /**
     * 设置脚本事件监听器
     */
    setupScriptEventListeners() {
        // 任务创建
        window.electronAPI.on('script:taskCreated', (task) => {
            console.log('[ScriptManager] 任务创建:', task);
            scriptStore.createTask(task);
        });

        // 任务开始
        window.electronAPI.on('script:taskStarted', (task) => {
            console.log('[ScriptManager] 任务开始:', task);
            scriptStore.updateTask(task.id, { status: 'running', startTime: Date.now() });
        });

        // 任务进度
        window.electronAPI.on('script:taskProgress', (data) => {
            scriptStore.updateTaskProgress(data.taskId, data.progress, data.message);
        });

        // 任务日志
        window.electronAPI.on('script:taskLog', (data) => {
            scriptStore.addTaskLog(data.taskId, {
                level: data.level,
                message: data.message,
                timestamp: data.timestamp
            });
        });

        // 任务结果
        window.electronAPI.on('script:taskResult', (data) => {
            scriptStore.addTaskResult(data.taskId, data.result);
        });

        // 任务错误
        window.electronAPI.on('script:taskError', (data) => {
            scriptStore.addTaskError(data.taskId, data.error);
        });

        // 任务完成
        window.electronAPI.on('script:taskFinished', (data) => {
            console.log('[ScriptManager] 任务完成:', data);
            scriptStore.updateTask(data.id, {
                status: data.status,
                endTime: data.endTime,
                progress: 100
            });
        });

        // 任务停止
        window.electronAPI.on('script:taskStopped', (task) => {
            console.log('[ScriptManager] 任务停止:', task);
            scriptStore.stopTask(task.id);
        });
    }

    /**
     * 处理store状态变化
     */
    handleStoreChange(state, changes) {
        // 脚本列表变化
        if (changes.scripts || changes.ui?.selectedCategory) {
            this.renderScriptCards();
        }

        // 任务状态变化
        if (changes.tasks) {
            this.updateTasksUI();
        }

        // 选中脚本变化
        if (changes.ui?.selectedScript) {
            this.handleScriptSelection(state.ui.selectedScript);
        }
    }

    /**
     * 渲染脚本卡片
     */
    renderScriptCards() {
        const container = this.elements.scriptCardsContainer;
        if (!container) return;

        const scripts = scriptStore.getFilteredScripts();
        
        if (scripts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-code" style="font-size: 48px; color: #999; margin-bottom: 16px;"></i>
                    <p>暂无可用脚本</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        scripts.forEach(script => {
            const card = this.createScriptCard(script);
            container.appendChild(card);
        });
    }

    /**
     * 创建脚本卡片
     */
    createScriptCard(script) {
        const card = document.createElement('div');
        card.className = 'script-card';
        card.dataset.scriptId = script.id;
        
        // 获取该脚本的活动任务
        const activeTasks = scriptStore.getActiveTasks().filter(t => t.scriptId === script.id);
        const hasActiveTasks = activeTasks.length > 0;
        
        card.innerHTML = `
            <div class="script-card-header">
                <div class="script-icon">
                    <i class="fas fa-${script.icon || 'code'}"></i>
                </div>
                <div class="script-info">
                    <h3>${script.name}</h3>
                    <p class="script-description">${script.description || ''}</p>
                </div>
            </div>
            <div class="script-card-meta">
                <span class="meta-item">
                    <i class="fas fa-layer-group"></i> ${script.category}
                </span>
                <span class="meta-item">
                    <i class="fas fa-code-branch"></i> v${script.version || '1.0.0'}
                </span>
                ${hasActiveTasks ? `
                    <span class="meta-item active-task">
                        <i class="fas fa-spinner fa-spin"></i> ${activeTasks.length} 个任务执行中
                    </span>
                ` : ''}
            </div>
            <div class="script-card-actions">
                <button class="btn btn-primary configure-btn" data-script-id="${script.id}">
                    <i class="fas fa-cog"></i> 配置执行
                </button>
                ${hasActiveTasks ? `
                    <button class="btn btn-secondary view-tasks-btn" data-script-id="${script.id}">
                        <i class="fas fa-tasks"></i> 查看任务
                    </button>
                ` : ''}
            </div>
        `;

        // 绑定事件
        const configureBtn = card.querySelector('.configure-btn');
        configureBtn.addEventListener('click', () => {
            scriptStore.set('ui.selectedScript', script);
        });

        const viewTasksBtn = card.querySelector('.view-tasks-btn');
        if (viewTasksBtn) {
            viewTasksBtn.addEventListener('click', () => {
                this.showScriptTasks(script.id);
            });
        }

        return card;
    }

    /**
     * 处理脚本选择
     */
    handleScriptSelection(script) {
        if (!script) return;
        
        // 触发配置事件
        this.elements.contentArea.dispatchEvent(
            new CustomEvent('script:configure', { detail: { script } })
        );
    }

    /**
     * 执行脚本
     */
    async executeScript(scriptId, wallets, params = {}) {
        try {
            const script = scriptStore.get('scripts').find(s => s.id === scriptId);
            if (!script) {
                throw new Error('脚本不存在');
            }

            // 创建任务
            const taskData = {
                scriptId: script.id,
                scriptName: script.name,
                wallets: wallets,
                params: params
            };
            
            const taskId = scriptStore.createTask(taskData);
            
            // 调用后端执行脚本
            const result = await window.electronAPI.script.execute({
                scriptPath: script.path,
                params: params,
                wallets: wallets
            });
            
            if (result.success) {
                showToast('脚本开始执行', 'success');
                return { success: true, taskId };
            } else {
                throw new Error(result.message || '执行失败');
            }
            
        } catch (error) {
            console.error('[ScriptManager] 执行脚本失败:', error);
            showToast('执行失败: ' + error.message, 'error');
            return { success: false, error: error.message };
        }
    }

    /**
     * 停止任务执行
     */
    async stopTask(taskId) {
        const confirmed = await showConfirmDialog({
            title: '确认停止',
            message: '确定要停止此任务吗？',
            confirmText: '停止',
            cancelText: '取消',
            type: 'warning'
        });

        if (!confirmed) return;

        try {
            const result = await window.electronAPI.script.stop(taskId);
            
            if (result.success) {
                showToast('任务已停止', 'success');
            } else {
                throw new Error(result.message || '停止失败');
            }
        } catch (error) {
            console.error('[ScriptManager] 停止任务失败:', error);
            showToast('停止失败: ' + error.message, 'error');
        }
    }

    /**
     * 更新任务UI
     */
    updateTasksUI() {
        const activeTasks = scriptStore.getActiveTasks();
        
        // 更新活动任务计数
        const activeTasksCount = this.elements.activeTasksCount;
        if (activeTasksCount) {
            activeTasksCount.textContent = activeTasks.length;
            activeTasksCount.style.display = activeTasks.length > 0 ? 'inline' : 'none';
        }

        // 更新任务列表
        this.renderTasksList();
    }

    /**
     * 渲染任务列表
     */
    renderTasksList() {
        const container = this.elements.tasksContainer;
        if (!container) return;

        const tasks = Object.values(scriptStore.get('tasks'))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 10); // 显示最近10个任务

        if (tasks.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>暂无执行任务</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        
        tasks.forEach(task => {
            const taskElement = this.createTaskElement(task);
            container.appendChild(taskElement);
        });
    }

    /**
     * 创建任务元素
     */
    createTaskElement(task) {
        const element = document.createElement('div');
        element.className = `task-item ${task.status}`;
        element.dataset.taskId = task.id;
        
        const duration = task.endTime ? 
            this.formatDuration(task.endTime - task.startTime) : 
            this.formatDuration(Date.now() - task.startTime);
        
        element.innerHTML = `
            <div class="task-header">
                <h4>${task.scriptName}</h4>
                <span class="task-status ${task.status}">
                    ${this.getStatusIcon(task.status)} ${this.getStatusText(task.status)}
                </span>
            </div>
            <div class="task-info">
                <span><i class="fas fa-wallet"></i> ${task.wallets.length} 个钱包</span>
                <span><i class="fas fa-clock"></i> ${duration}</span>
                ${task.status === 'running' ? `
                    <span><i class="fas fa-spinner fa-spin"></i> ${task.progress}%</span>
                ` : ''}
            </div>
            <div class="task-actions">
                ${task.status === 'running' ? `
                    <button class="btn btn-sm btn-danger stop-task-btn" data-task-id="${task.id}">
                        <i class="fas fa-stop"></i> 停止
                    </button>
                ` : ''}
                <button class="btn btn-sm btn-secondary view-logs-btn" data-task-id="${task.id}">
                    <i class="fas fa-file-alt"></i> 查看日志
                </button>
            </div>
        `;

        // 绑定事件
        const stopBtn = element.querySelector('.stop-task-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopTask(task.id));
        }

        const viewLogsBtn = element.querySelector('.view-logs-btn');
        viewLogsBtn.addEventListener('click', () => this.showTaskLogs(task.id));

        return element;
    }

    /**
     * 显示任务日志
     */
    showTaskLogs(taskId) {
        const task = scriptStore.get(`tasks.${taskId}`);
        if (!task) return;

        // 触发显示日志事件
        this.elements.contentArea.dispatchEvent(
            new CustomEvent('task:viewLogs', { detail: { task } })
        );
    }

    /**
     * 显示脚本的所有任务
     */
    showScriptTasks(scriptId) {
        // 触发显示任务列表事件
        this.elements.contentArea.dispatchEvent(
            new CustomEvent('script:viewTasks', { detail: { scriptId } })
        );
    }

    /**
     * 获取状态图标
     */
    getStatusIcon(status) {
        const icons = {
            pending: '<i class="fas fa-clock"></i>',
            running: '<i class="fas fa-spinner fa-spin"></i>',
            completed: '<i class="fas fa-check-circle"></i>',
            failed: '<i class="fas fa-times-circle"></i>',
            stopped: '<i class="fas fa-stop-circle"></i>'
        };
        return icons[status] || '';
    }

    /**
     * 获取状态文本
     */
    getStatusText(status) {
        const texts = {
            pending: '等待中',
            running: '执行中',
            completed: '已完成',
            failed: '失败',
            stopped: '已停止'
        };
        return texts[status] || status;
    }

    /**
     * 格式化持续时间
     */
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}小时${minutes % 60}分钟`;
        } else if (minutes > 0) {
            return `${minutes}分钟${seconds % 60}秒`;
        } else {
            return `${seconds}秒`;
        }
    }

    /**
     * 销毁管理器
     */
    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        
        // 清理事件监听器
        this.taskEventListeners.forEach((listener, event) => {
            window.electronAPI.off(event, listener);
        });
        this.taskEventListeners.clear();
        
        this.elements = null;
        this.initialized = false;
        console.log('[ScriptManager] 已销毁');
    }
}

// 导出单例实例
export const scriptManager = new ScriptManager(); 