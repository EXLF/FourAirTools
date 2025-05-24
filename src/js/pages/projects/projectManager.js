/**
 * @fileoverview 项目管理器 - 使用projectStore进行状态管理
 * @module pages/projects/projectManager
 */

import { projectStore, subscribeToProjects } from '../../stores/projectStore.js';
import { showToast } from '../../components/toast.js';
import { getProjects } from '../../services/projectAPI.js';
import { createCalendar } from '../../components/calendar.js';

/**
 * 项目管理器类
 * 连接projectStore和UI，处理项目相关的业务逻辑
 */
class ProjectManager {
    constructor() {
        this.unsubscribe = null;
        this.elements = null;
        this.initialized = false;
        this.calendarInstance = null;
    }

    /**
     * 初始化项目管理器
     * @param {Object} elements - DOM元素引用
     */
    async initialize(elements) {
        if (this.initialized) {
            console.warn('[ProjectManager] 已经初始化，跳过重复初始化');
            return;
        }

        this.elements = elements;
        
        // 订阅store变化
        this.unsubscribe = subscribeToProjects(
            (state, changes) => this.handleStoreChange(state, changes),
            ['projects', 'ui.selectedProjectId', 'filters', 'checkIns', 'tasks']
        );

        // 初始加载数据
        await this.loadInitialData();
        
        // 初始化日历
        this.initializeCalendar();
        
        this.initialized = true;
        console.log('[ProjectManager] 初始化完成');
    }

    /**
     * 加载初始数据
     */
    async loadInitialData() {
        try {
            projectStore.set('ui.loading', true);
            
            // 从API获取项目数据
            const projects = await getProjects();
            
            // 设置项目数据
            projectStore.setProjects(projects);
            
            // 为每个项目设置任务和时间轴
            for (const project of projects) {
                if (project.tasks) {
                    projectStore.setProjectTasks(project.id, project.tasks);
                }
                if (project.timeline) {
                    projectStore.setProjectTimeline(project.id, project.timeline);
                }
            }
            
            // TODO: 从本地数据库加载打卡记录
            // const checkIns = await loadCheckInsFromDB();
            // projectStore.setState({ checkIns });
            
        } catch (error) {
            console.error('[ProjectManager] 加载初始数据失败:', error);
            showToast('加载项目数据失败', 'error');
        } finally {
            projectStore.set('ui.loading', false);
        }
    }

    /**
     * 处理store状态变化
     */
    handleStoreChange(state, changes) {
        // 项目列表或筛选条件变化时重新渲染列表
        if (changes.projects || changes.filters) {
            this.renderProjectList();
        }

        // 选中项目变化时更新详情
        if (changes.ui?.selectedProjectId !== undefined) {
            if (state.ui.selectedProjectId) {
                this.renderProjectDetails();
            } else {
                this.showPlaceholder();
            }
        }

        // 任务或打卡记录变化时更新任务列表
        if (changes.tasks || changes.checkIns) {
            const selectedProjectId = state.ui.selectedProjectId;
            if (selectedProjectId) {
                this.renderTaskList(selectedProjectId);
            }
        }

        // 打卡记录变化时更新日历
        if (changes.checkIns && this.calendarInstance) {
            this.updateCalendarEvents();
        }
    }

    /**
     * 渲染项目列表
     */
    renderProjectList() {
        const container = this.elements.projectListContainer;
        if (!container) return;

        const projects = projectStore.getFilteredProjects();
        const selectedProjectId = projectStore.get('ui.selectedProjectId');
        
        if (projects.length === 0) {
            container.innerHTML = '<p class="empty-message">未找到任何跟踪项目。</p>';
            return;
        }

        container.innerHTML = projects.map(project => {
            const isSelected = project.id === selectedProjectId;
            const statusBadge = this.getProjectStatusBadge(project);
            const chainBadge = project.project_chain ? 
                `<span class="chain-badge">${project.project_chain}</span>` : '';

            return `
                <div class="project-list-item ${isSelected ? 'selected' : ''}" 
                     data-project-id="${project.id}">
                    <div class="project-info">
                        ${project.icon || this.getDefaultIcon()}
                        <span class="project-name">${project.name}${chainBadge}</span>
                        ${statusBadge}
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 渲染项目详情
     */
    renderProjectDetails() {
        const project = projectStore.getSelectedProject();
        if (!project) return;

        // 显示详情区域
        this.elements.projectDetailPlaceholder.classList.add('hidden');
        this.elements.projectDetailContent.classList.remove('hidden');

        // 填充项目信息
        this.elements.detailProjectIcon.innerHTML = project.icon || this.getDefaultIcon();
        this.elements.detailProjectName.textContent = project.name;
        this.elements.detailProjectName.dataset.projectId = project.id;
        this.elements.detailProjectDescription.textContent = project.description;

        // 添加链标签
        if (project.project_chain) {
            this.elements.detailProjectName.innerHTML = `
                ${project.name} 
                <span class="chain-tag">${project.project_chain}</span>
            `;
        }

        // 处理关联教程链接
        if (project.tutorial_project_id && project.tutorial_name) {
            this.elements.detailTutorialLinkArea.classList.remove('hidden');
            this.elements.detailTutorialLink.textContent = project.tutorial_name;
            this.elements.detailTutorialLink.href = project.tutorial_link || '#';
        } else {
            this.elements.detailTutorialLinkArea.classList.add('hidden');
        }

        // 渲染任务列表
        this.renderTaskList(project.id);

        // 渲染时间轴
        this.renderTimeline(project.id);

        // 更新日历
        this.updateCalendarForProject(project.id);
    }

    /**
     * 渲染任务列表
     */
    renderTaskList(projectId) {
        const container = this.elements.taskListContainer;
        if (!container) return;

        const tasks = projectStore.getProjectTasks(projectId);
        
        if (tasks.length === 0) {
            container.innerHTML = '<p class="empty-message">该项目暂无任务。</p>';
            return;
        }

        container.innerHTML = tasks.map(task => {
            const taskHtml = this.createTaskElement(task);
            return taskHtml;
        }).join('');
    }

    /**
     * 创建任务元素
     */
    createTaskElement(task) {
        let iconHtml = '';
        let taskTypeClass = '';
        let actionButtonHtml = '';

        switch (task.type) {
            case 'daily':
                iconHtml = '<div class="task-icon"><i class="fas fa-calendar-day"></i></div>';
                taskTypeClass = 'daily-task';
                const today = new Date().toISOString().split('T')[0];
                const hasCheckedIn = projectStore.hasCheckedIn(task.id, today);
                
                if (hasCheckedIn) {
                    actionButtonHtml = `
                        <button class="btn btn-secondary btn-small btn-daily-checkin disabled" disabled>
                            <i class="fas fa-check-circle"></i> 今日已打卡
                        </button>`;
                } else {
                    actionButtonHtml = `
                        <button class="btn btn-success btn-small btn-daily-checkin" 
                                data-task-id="${task.id}">
                            <i class="fas fa-check"></i> 今日打卡
                        </button>`;
                }
                break;
                
            case 'timed':
                iconHtml = '<div class="task-icon"><i class="fas fa-stopwatch"></i></div>';
                taskTypeClass = 'timed-task';
                actionButtonHtml = `
                    <button class="btn btn-primary btn-small" data-task-id="${task.id}">
                        <i class="fas fa-arrow-right"></i> 查看详情
                    </button>`;
                break;
                
            case 'tutorial_update':
                iconHtml = '<div class="task-icon"><i class="fas fa-book-open"></i></div>';
                taskTypeClass = 'tutorial-update-task';
                actionButtonHtml = `
                    <button class="btn btn-info btn-small">
                        <i class="fas fa-external-link-alt"></i> 查看教程
                    </button>`;
                break;
                
            default:
                iconHtml = '<div class="task-icon"><i class="fas fa-tasks"></i></div>';
                taskTypeClass = 'general-task';
                const isCompleted = task.status === 'completed';
                actionButtonHtml = `
                    <button class="btn btn-outline-secondary btn-small mark-complete-btn" 
                            data-task-id="${task.id}"
                            ${isCompleted ? 'disabled' : ''}>
                        <i class="${isCompleted ? 'fas fa-check-square' : 'far fa-square'}"></i> 
                        ${isCompleted ? '已完成' : '标记完成'}
                    </button>`;
                break;
        }

        let deadlineHtml = '';
        if (task.type === 'timed' && task.end_time) {
            const deadline = new Date(task.end_time);
            const now = new Date();
            const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
            
            let deadlineStyle = daysLeft <= 3 ? 'color: #e03131; font-weight: bold;' : '';
            deadlineHtml = `
                <p class="task-deadline" style="${deadlineStyle}">
                    <i class="fas fa-clock"></i> 
                    截止: ${deadline.toLocaleString('zh-CN', { 
                        month: 'numeric', 
                        day: 'numeric', 
                        hour: 'numeric', 
                        minute: 'numeric'
                    })}
                </p>`;
        }

        const descriptionHtml = task.description ? 
            `<p class="task-description">${task.description}</p>` : '';

        return `
            <div class="task-item ${taskTypeClass}" data-task-id="${task.id}" data-task-type="${task.type}">
                ${iconHtml}
                <div class="task-content">
                    <div class="task-title">${task.title}</div>
                    ${descriptionHtml}
                    ${deadlineHtml}
                </div>
                <div class="task-actions">${actionButtonHtml}</div>
            </div>
        `;
    }

    /**
     * 渲染时间轴
     */
    renderTimeline(projectId) {
        const container = this.elements.projectTimelineContainer;
        if (!container) return;

        const timeline = projectStore.getProjectTimeline(projectId);
        const project = projectStore.getSelectedProject();
        
        if (!timeline || timeline.length === 0) {
            container.innerHTML = '<p class="empty-message">暂无时间轴事件。</p>';
            return;
        }

        // 按日期排序
        const sortedTimeline = [...timeline].sort((a, b) => 
            new Date(a.date) - new Date(b.date)
        );

        container.innerHTML = sortedTimeline.map(event => {
            const eventDate = new Date(event.date);
            const now = new Date();
            const isPast = eventDate < now;
            const isCurrent = Math.abs(eventDate - now) < 7 * 24 * 60 * 60 * 1000; // 7天内
            
            let statusClass = '';
            if (event.type === 'milestone') {
                statusClass = 'milestone';
            } else if (isPast) {
                statusClass = 'past';
            } else if (isCurrent) {
                statusClass = 'current';
            } else {
                statusClass = 'future';
            }

            return `
                <div class="timeline-event ${statusClass}">
                    <div class="timeline-date">
                        ${eventDate.toLocaleDateString('zh-CN', { 
                            month: 'short', 
                            day: 'numeric' 
                        })}
                    </div>
                    <div class="timeline-content">
                        <h4>${event.title}</h4>
                        <p>${event.description}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * 处理每日打卡
     */
    async handleDailyCheckIn(taskId) {
        const today = new Date().toISOString().split('T')[0];
        
        if (projectStore.hasCheckedIn(taskId, today)) {
            showToast('今天已经打过卡了', 'warning');
            return;
        }

        try {
            // TODO: 保存到数据库
            // await saveCheckInToDB(taskId, today);
            
            // 更新store
            projectStore.addCheckIn(taskId, today);
            
            showToast('打卡成功！', 'success');
            
            // 更新项目列表中的状态
            this.updateProjectListStatus();
            
        } catch (error) {
            console.error('[ProjectManager] 打卡失败:', error);
            showToast('打卡失败，请重试', 'error');
        }
    }

    /**
     * 处理任务完成
     */
    async handleTaskComplete(taskId) {
        try {
            // TODO: 保存到数据库
            // await updateTaskStatusInDB(taskId, 'completed');
            
            // 更新store
            projectStore.updateTaskStatus(taskId, 'completed');
            
            showToast('任务已标记为完成', 'success');
            
        } catch (error) {
            console.error('[ProjectManager] 更新任务状态失败:', error);
            showToast('操作失败，请重试', 'error');
        }
    }

    /**
     * 获取项目状态徽章
     */
    getProjectStatusBadge(project) {
        if (project.type === 'daily') {
            const tasks = projectStore.getProjectTasks(project.id);
            const dailyTask = tasks.find(t => t.type === 'daily');
            
            if (dailyTask) {
                const today = new Date().toISOString().split('T')[0];
                const hasCheckedIn = projectStore.hasCheckedIn(dailyTask.id, today);
                
                if (hasCheckedIn) {
                    return '<span class="status-badge status-checked">已打卡</span>';
                } else {
                    return '<span class="status-badge status-daily">待打卡</span>';
                }
            }
        } else if (project.type === 'timed') {
            const tasks = projectStore.getProjectTasks(project.id);
            const timedTask = tasks.find(t => t.type === 'timed');
            
            if (timedTask && timedTask.end_time) {
                const endDate = new Date(timedTask.end_time);
                const now = new Date();
                const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                
                if (daysLeft > 0) {
                    return `<span class="status-badge" style="background: #fd7e14;">剩${daysLeft}天</span>`;
                } else {
                    return '<span class="status-badge" style="background: #868e96;">已结束</span>';
                }
            }
        }
        
        // 检查是否有教程更新
        const tasks = projectStore.getProjectTasks(project.id);
        if (tasks.some(t => t.type === 'tutorial_update')) {
            return '<span class="status-badge status-update">更新</span>';
        }
        
        return '';
    }

    /**
     * 获取默认图标
     */
    getDefaultIcon() {
        return '<div class="project-icon-circle" style="background-color: #adb5bd;"><i class="fas fa-question-circle"></i></div>';
    }

    /**
     * 显示占位符
     */
    showPlaceholder() {
        this.elements.projectDetailPlaceholder.classList.remove('hidden');
        this.elements.projectDetailContent.classList.add('hidden');
    }

    /**
     * 更新项目列表状态
     */
    updateProjectListStatus() {
        const selectedProjectId = projectStore.get('ui.selectedProjectId');
        if (!selectedProjectId) return;

        const projectItem = this.elements.projectListContainer.querySelector(
            `.project-list-item[data-project-id="${selectedProjectId}"]`
        );
        
        if (projectItem) {
            const project = projectStore.getSelectedProject();
            const statusBadge = projectItem.querySelector('.status-badge');
            
            if (statusBadge && project) {
                const newBadgeHtml = this.getProjectStatusBadge(project);
                if (newBadgeHtml) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = newBadgeHtml;
                    const newBadge = tempDiv.firstChild;
                    statusBadge.replaceWith(newBadge);
                }
            }
        }
    }

    /**
     * 初始化日历
     */
    initializeCalendar() {
        if (!this.elements.checkInCalendar) return;

        this.calendarInstance = createCalendar(this.elements.checkInCalendar, {
            onDateClick: (dateInfo, events) => this.handleCalendarDateClick(dateInfo, events),
            onMonthChange: (currentDate) => this.handleCalendarMonthChange(currentDate)
        });
    }

    /**
     * 更新日历事件
     */
    updateCalendarEvents() {
        if (!this.calendarInstance) return;

        const currentMonth = projectStore.get('ui.calendarView.currentMonth');
        const checkIns = projectStore.getMonthCheckIns(currentMonth);
        
        const events = [];
        Object.entries(checkIns).forEach(([date, checkInList]) => {
            events.push({
                date: date,
                type: 'checkin',
                count: checkInList.length,
                title: `${checkInList.length} 个打卡`
            });
        });

        this.calendarInstance.updateEvents(events);
    }

    /**
     * 为特定项目更新日历
     */
    updateCalendarForProject(projectId) {
        if (!this.calendarInstance) return;

        const tasks = projectStore.getProjectTasks(projectId);
        const dailyTaskIds = tasks.filter(t => t.type === 'daily').map(t => t.id);
        
        const currentMonth = projectStore.get('ui.calendarView.currentMonth');
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        
        const events = [];
        
        // 遍历当月每一天
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toISOString().split('T')[0];
            
            const checkInsForDay = dailyTaskIds.filter(taskId => 
                projectStore.hasCheckedIn(taskId, dateStr)
            );
            
            if (checkInsForDay.length > 0) {
                events.push({
                    date: dateStr,
                    type: 'checkin',
                    count: checkInsForDay.length,
                    title: `${checkInsForDay.length} 个打卡`
                });
            }
        }

        this.calendarInstance.updateEvents(events);
    }

    /**
     * 处理日历日期点击
     */
    handleCalendarDateClick(dateInfo, events) {
        console.log('[ProjectManager] 日历日期点击:', dateInfo, events);
        // TODO: 显示当天的打卡详情
    }

    /**
     * 处理日历月份变化
     */
    handleCalendarMonthChange(currentDate) {
        projectStore.setCalendarView({ currentMonth: currentDate });
        
        const selectedProjectId = projectStore.get('ui.selectedProjectId');
        if (selectedProjectId) {
            this.updateCalendarForProject(selectedProjectId);
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
        
        if (this.calendarInstance) {
            // TODO: 销毁日历实例
            this.calendarInstance = null;
        }
        
        this.elements = null;
        this.initialized = false;
        console.log('[ProjectManager] 已销毁');
    }
}

// 导出单例实例
export const projectManager = new ProjectManager(); 