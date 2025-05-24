/**
 * @fileoverview 项目状态管理
 * @module stores/projectStore
 */

import { BaseStore } from './BaseStore.js';

/**
 * 项目Store类
 * @extends BaseStore
 */
class ProjectStore extends BaseStore {
    constructor() {
        super({
            // 项目列表
            projects: [],
            
            // 任务列表（按项目ID索引）
            tasks: {},
            
            // 时间轴事件（按项目ID索引）
            timelines: {},
            
            // 打卡记录
            checkIns: {},
            
            // 筛选条件
            filters: {
                search: '',
                chain: 'all',
                type: 'all', // all | daily | timed
                status: 'all' // all | active | completed
            },
            
            // UI状态
            ui: {
                loading: false,
                selectedProjectId: null,
                calendarView: {
                    currentMonth: new Date(),
                    selectedDate: null
                }
            },
            
            // 统计信息
            stats: {
                totalProjects: 0,
                activeProjects: 0,
                completedTasks: 0,
                todayCheckIns: 0,
                chainCounts: {}
            }
        });
    }
    
    /**
     * 设置项目列表
     * @param {Array} projects - 项目数组
     */
    setProjects(projects) {
        this.setState({
            projects: projects,
            'stats.totalProjects': projects.length,
            'stats.activeProjects': projects.filter(p => p.status === 'active').length
        });
        
        // 更新链统计
        this.updateChainStats(projects);
    }
    
    /**
     * 设置项目任务
     * @param {number} projectId - 项目ID
     * @param {Array} tasks - 任务数组
     */
    setProjectTasks(projectId, tasks) {
        this.setState({
            [`tasks.${projectId}`]: tasks
        });
    }
    
    /**
     * 设置项目时间轴
     * @param {number} projectId - 项目ID
     * @param {Array} timeline - 时间轴事件数组
     */
    setProjectTimeline(projectId, timeline) {
        this.setState({
            [`timelines.${projectId}`]: timeline
        });
    }
    
    /**
     * 选择项目
     * @param {number|null} projectId - 项目ID
     */
    selectProject(projectId) {
        this.set('ui.selectedProjectId', projectId);
    }
    
    /**
     * 获取选中的项目
     * @returns {Object|null} 选中的项目
     */
    getSelectedProject() {
        const projectId = this.state.ui.selectedProjectId;
        if (!projectId) return null;
        
        return this.state.projects.find(p => p.id === projectId);
    }
    
    /**
     * 获取项目任务
     * @param {number} projectId - 项目ID
     * @returns {Array} 任务列表
     */
    getProjectTasks(projectId) {
        return this.state.tasks[projectId] || [];
    }
    
    /**
     * 获取项目时间轴
     * @param {number} projectId - 项目ID
     * @returns {Array} 时间轴事件列表
     */
    getProjectTimeline(projectId) {
        return this.state.timelines[projectId] || [];
    }
    
    /**
     * 添加打卡记录
     * @param {number} taskId - 任务ID
     * @param {string} date - 日期 (YYYY-MM-DD)
     */
    addCheckIn(taskId, date) {
        const key = `task_${taskId}_date_${date}`;
        this.setState({
            [`checkIns.${key}`]: {
                taskId,
                date,
                timestamp: Date.now()
            }
        });
        
        // 更新今日打卡统计
        const today = new Date().toISOString().split('T')[0];
        if (date === today) {
            this.set('stats.todayCheckIns', this.getTodayCheckIns().length);
        }
    }
    
    /**
     * 检查是否已打卡
     * @param {number} taskId - 任务ID
     * @param {string} date - 日期 (YYYY-MM-DD)
     * @returns {boolean} 是否已打卡
     */
    hasCheckedIn(taskId, date) {
        const key = `task_${taskId}_date_${date}`;
        return !!this.state.checkIns[key];
    }
    
    /**
     * 获取今日打卡记录
     * @returns {Array} 今日打卡记录
     */
    getTodayCheckIns() {
        const today = new Date().toISOString().split('T')[0];
        return Object.values(this.state.checkIns).filter(checkIn => 
            checkIn.date === today
        );
    }
    
    /**
     * 获取指定月份的打卡记录
     * @param {Date} month - 月份
     * @returns {Object} 按日期分组的打卡记录
     */
    getMonthCheckIns(month) {
        const year = month.getFullYear();
        const monthNum = month.getMonth();
        
        const checkInsByDate = {};
        
        Object.values(this.state.checkIns).forEach(checkIn => {
            const checkInDate = new Date(checkIn.date);
            if (checkInDate.getFullYear() === year && checkInDate.getMonth() === monthNum) {
                if (!checkInsByDate[checkIn.date]) {
                    checkInsByDate[checkIn.date] = [];
                }
                checkInsByDate[checkIn.date].push(checkIn);
            }
        });
        
        return checkInsByDate;
    }
    
    /**
     * 设置筛选条件
     * @param {Object} filters - 筛选条件
     */
    setFilters(filters) {
        this.setState({
            filters: { ...this.state.filters, ...filters }
        });
    }
    
    /**
     * 获取筛选后的项目
     * @returns {Array} 筛选后的项目列表
     */
    getFilteredProjects() {
        let projects = [...this.state.projects];
        const { search, chain, type, status } = this.state.filters;
        
        // 搜索筛选
        if (search) {
            const searchLower = search.toLowerCase();
            projects = projects.filter(p => 
                p.name.toLowerCase().includes(searchLower) ||
                p.description?.toLowerCase().includes(searchLower) ||
                p.project_chain?.toLowerCase().includes(searchLower)
            );
        }
        
        // 链筛选
        if (chain && chain !== 'all') {
            projects = projects.filter(p => p.project_chain === chain);
        }
        
        // 类型筛选
        if (type && type !== 'all') {
            projects = projects.filter(p => p.type === type);
        }
        
        // 状态筛选
        if (status && status !== 'all') {
            projects = projects.filter(p => p.status === status);
        }
        
        return projects;
    }
    
    /**
     * 更新任务状态
     * @param {number} taskId - 任务ID
     * @param {string} status - 新状态
     */
    updateTaskStatus(taskId, status) {
        // 遍历所有项目的任务
        Object.keys(this.state.tasks).forEach(projectId => {
            const tasks = this.state.tasks[projectId];
            const taskIndex = tasks.findIndex(t => t.id === taskId);
            
            if (taskIndex !== -1) {
                const updatedTasks = [...tasks];
                updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], status };
                
                this.setState({
                    [`tasks.${projectId}`]: updatedTasks
                });
                
                // 更新完成任务统计
                if (status === 'completed') {
                    this.set('stats.completedTasks', this.state.stats.completedTasks + 1);
                }
            }
        });
    }
    
    /**
     * 设置日历视图
     * @param {Object} calendarView - 日历视图配置
     */
    setCalendarView(calendarView) {
        this.setState({
            'ui.calendarView': { ...this.state.ui.calendarView, ...calendarView }
        });
    }
    
    /**
     * 更新链统计
     * @param {Array} projects - 项目列表
     */
    updateChainStats(projects) {
        const chainCounts = {};
        
        projects.forEach(project => {
            if (project.project_chain) {
                chainCounts[project.project_chain] = (chainCounts[project.project_chain] || 0) + 1;
            }
        });
        
        this.set('stats.chainCounts', chainCounts);
    }
    
    /**
     * 获取项目统计信息
     * @param {number} projectId - 项目ID
     * @returns {Object} 项目统计
     */
    getProjectStats(projectId) {
        const tasks = this.getProjectTasks(projectId);
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const dailyTasks = tasks.filter(t => t.type === 'daily').length;
        const timedTasks = tasks.filter(t => t.type === 'timed').length;
        
        // 计算连续打卡天数
        let consecutiveDays = 0;
        const today = new Date();
        const dailyTaskIds = tasks.filter(t => t.type === 'daily').map(t => t.id);
        
        for (let i = 0; i < 365; i++) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            const hasCheckedInToday = dailyTaskIds.some(taskId => 
                this.hasCheckedIn(taskId, dateStr)
            );
            
            if (hasCheckedInToday) {
                consecutiveDays++;
            } else if (i > 0) {
                break; // 中断连续
            }
        }
        
        return {
            totalTasks: tasks.length,
            completedTasks,
            dailyTasks,
            timedTasks,
            completionRate: tasks.length > 0 ? (completedTasks / tasks.length * 100).toFixed(1) : 0,
            consecutiveDays
        };
    }
}

// 创建单例实例
export const projectStore = new ProjectStore();

// 便捷订阅函数
export function subscribeToProjects(callback, paths) {
    return projectStore.subscribe(callback, paths);
} 