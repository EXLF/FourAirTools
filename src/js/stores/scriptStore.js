/**
 * @fileoverview 脚本Store - 管理脚本执行相关状态
 * @module stores/scriptStore
 */

import { BaseStore } from './BaseStore.js';

/**
 * 脚本Store类
 * 管理脚本列表、执行任务、日志等
 */
class ScriptStore extends BaseStore {
    constructor() {
        super({
            // 可用脚本列表
            scripts: [],
            
            // 脚本分类
            categories: [
                { id: 'defi', name: 'DeFi', icon: 'chart-line' },
                { id: 'nft', name: 'NFT', icon: 'image' },
                { id: 'airdrop', name: '空投', icon: 'gift' },
                { id: 'social', name: '社交', icon: 'users' },
                { id: 'tools', name: '工具', icon: 'wrench' },
                { id: 'custom', name: '自定义', icon: 'code' }
            ],
            
            // 执行任务
            tasks: {}, // taskId -> task object
            
            // 当前活动任务ID列表
            activeTasks: [],
            
            // 任务历史
            history: [],
            
            // 执行配置
            config: {
                concurrencyLimit: 3,
                defaultInterval: [30, 60], // 默认间隔30-60秒
                randomInterval: true,
                gasStrategy: 'auto', // auto, fast, slow
                retryAttempts: 3,
                retryDelay: 5000
            },
            
            // UI状态
            ui: {
                selectedScript: null,
                selectedCategory: 'all',
                showLogs: true,
                logLevel: 'info', // all, info, warn, error
                expandedTasks: [] // 展开的任务ID
            },
            
            // 脚本配置缓存
            scriptConfigs: {}, // scriptId -> config object
            
            // 执行统计
            statistics: {
                totalExecutions: 0,
                successfulExecutions: 0,
                failedExecutions: 0,
                averageExecutionTime: 0,
                lastExecutionTime: null
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
        // 定期清理已完成的任务
        setInterval(() => {
            this.cleanupCompletedTasks();
        }, 10 * 60 * 1000); // 10分钟
        
        // 监听任务变化，更新统计
        this.subscribe((state) => {
            this.updateStatistics();
        }, ['tasks']);
    }

    /**
     * 设置脚本列表
     * @param {Array} scripts - 脚本数组
     */
    setScripts(scripts) {
        this.set('scripts', scripts);
    }

    /**
     * 添加脚本
     * @param {Object} script - 脚本对象
     */
    addScript(script) {
        this.set('scripts', [...this.get('scripts'), script]);
    }

    /**
     * 更新脚本
     * @param {string} scriptId - 脚本ID
     * @param {Object} updates - 更新内容
     */
    updateScript(scriptId, updates) {
        const scripts = this.get('scripts').map(script => 
            script.id === scriptId ? { ...script, ...updates } : script
        );
        this.set('scripts', scripts);
    }

    /**
     * 删除脚本
     * @param {string} scriptId - 脚本ID
     */
    removeScript(scriptId) {
        const scripts = this.get('scripts').filter(s => s.id !== scriptId);
        this.set('scripts', scripts);
        
        // 清理配置缓存
        const configs = { ...this.get('scriptConfigs') };
        delete configs[scriptId];
        this.set('scriptConfigs', configs);
    }

    /**
     * 创建新任务
     * @param {Object} taskData - 任务数据
     * @returns {string} 任务ID
     */
    createTask(taskData) {
        const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const task = {
            id: taskId,
            scriptId: taskData.scriptId,
            scriptName: taskData.scriptName,
            wallets: taskData.wallets || [],
            params: taskData.params || {},
            status: 'pending',
            progress: 0,
            logs: [],
            results: [],
            errors: [],
            startTime: null,
            endTime: null,
            createdAt: Date.now()
        };
        
        this.setState({
            tasks: {
                ...this.get('tasks'),
                [taskId]: task
            },
            activeTasks: [...this.get('activeTasks'), taskId]
        });
        
        return taskId;
    }

    /**
     * 更新任务
     * @param {string} taskId - 任务ID
     * @param {Object} updates - 更新内容
     */
    updateTask(taskId, updates) {
        const tasks = this.get('tasks');
        if (!tasks[taskId]) return;
        
        const updatedTask = {
            ...tasks[taskId],
            ...updates
        };
        
        // 如果任务完成，从活动任务中移除
        if (updates.status && ['completed', 'failed', 'stopped'].includes(updates.status)) {
            const activeTasks = this.get('activeTasks').filter(id => id !== taskId);
            this.setState({
                tasks: {
                    ...tasks,
                    [taskId]: updatedTask
                },
                activeTasks
            });
            
            // 添加到历史
            this.addToHistory(updatedTask);
        } else {
            this.set(`tasks.${taskId}`, updatedTask);
        }
    }

    /**
     * 添加任务日志
     * @param {string} taskId - 任务ID
     * @param {Object} log - 日志对象
     */
    addTaskLog(taskId, log) {
        const task = this.get(`tasks.${taskId}`);
        if (!task) return;
        
        const logEntry = {
            timestamp: Date.now(),
            ...log
        };
        
        this.set(`tasks.${taskId}.logs`, [...task.logs, logEntry]);
    }

    /**
     * 添加任务结果
     * @param {string} taskId - 任务ID
     * @param {Object} result - 结果对象
     */
    addTaskResult(taskId, result) {
        const task = this.get(`tasks.${taskId}`);
        if (!task) return;
        
        this.set(`tasks.${taskId}.results`, [...task.results, result]);
    }

    /**
     * 添加任务错误
     * @param {string} taskId - 任务ID
     * @param {Object} error - 错误对象
     */
    addTaskError(taskId, error) {
        const task = this.get(`tasks.${taskId}`);
        if (!task) return;
        
        this.set(`tasks.${taskId}.errors`, [...task.errors, error]);
    }

    /**
     * 更新任务进度
     * @param {string} taskId - 任务ID
     * @param {number} progress - 进度(0-100)
     * @param {string} [message] - 进度消息
     */
    updateTaskProgress(taskId, progress, message) {
        const updates = { progress };
        if (message) {
            this.addTaskLog(taskId, {
                level: 'info',
                message: message
            });
        }
        this.updateTask(taskId, updates);
    }

    /**
     * 停止任务
     * @param {string} taskId - 任务ID
     */
    stopTask(taskId) {
        this.updateTask(taskId, {
            status: 'stopped',
            endTime: Date.now()
        });
    }

    /**
     * 清理已完成的任务
     * @param {number} [olderThanMs=3600000] - 清理多久之前的任务(默认1小时)
     */
    cleanupCompletedTasks(olderThanMs = 3600000) {
        const now = Date.now();
        const tasks = this.get('tasks');
        const tasksToKeep = {};
        
        Object.entries(tasks).forEach(([taskId, task]) => {
            const isCompleted = ['completed', 'failed', 'stopped'].includes(task.status);
            const isOld = task.endTime && (now - task.endTime > olderThanMs);
            
            if (!isCompleted || !isOld) {
                tasksToKeep[taskId] = task;
            }
        });
        
        if (Object.keys(tasksToKeep).length !== Object.keys(tasks).length) {
            this.set('tasks', tasksToKeep);
        }
    }

    /**
     * 添加到历史记录
     * @param {Object} task - 任务对象
     * @private
     */
    addToHistory(task) {
        const history = this.get('history');
        const historyEntry = {
            id: task.id,
            scriptId: task.scriptId,
            scriptName: task.scriptName,
            walletCount: task.wallets.length,
            status: task.status,
            duration: task.endTime - task.startTime,
            resultCount: task.results.length,
            errorCount: task.errors.length,
            completedAt: task.endTime
        };
        
        // 保持历史记录在合理范围内
        const newHistory = [historyEntry, ...history].slice(0, 100);
        this.set('history', newHistory);
    }

    /**
     * 更新执行统计
     * @private
     */
    updateStatistics() {
        const tasks = Object.values(this.get('tasks'));
        const completedTasks = tasks.filter(t => t.status === 'completed');
        const failedTasks = tasks.filter(t => t.status === 'failed');
        
        const totalExecutions = completedTasks.length + failedTasks.length;
        const successfulExecutions = completedTasks.length;
        const failedExecutions = failedTasks.length;
        
        // 计算平均执行时间
        let averageExecutionTime = 0;
        if (completedTasks.length > 0) {
            const totalTime = completedTasks.reduce((sum, task) => {
                return sum + (task.endTime - task.startTime);
            }, 0);
            averageExecutionTime = Math.round(totalTime / completedTasks.length);
        }
        
        // 最后执行时间
        const lastTask = tasks
            .filter(t => t.endTime)
            .sort((a, b) => b.endTime - a.endTime)[0];
        const lastExecutionTime = lastTask ? lastTask.endTime : null;
        
        this.set('statistics', {
            totalExecutions,
            successfulExecutions,
            failedExecutions,
            averageExecutionTime,
            lastExecutionTime
        });
    }

    /**
     * 设置脚本配置
     * @param {string} scriptId - 脚本ID
     * @param {Object} config - 配置对象
     */
    setScriptConfig(scriptId, config) {
        this.set(`scriptConfigs.${scriptId}`, config);
    }

    /**
     * 获取脚本配置
     * @param {string} scriptId - 脚本ID
     * @returns {Object|null} 配置对象
     */
    getScriptConfig(scriptId) {
        return this.get(`scriptConfigs.${scriptId}`) || null;
    }

    /**
     * 设置执行配置
     * @param {Object} config - 执行配置
     */
    setExecutionConfig(config) {
        this.setState({
            config: {
                ...this.get('config'),
                ...config
            }
        });
    }

    /**
     * 获取活动任务
     * @returns {Array} 活动任务列表
     */
    getActiveTasks() {
        const tasks = this.get('tasks');
        const activeTasks = this.get('activeTasks');
        
        return activeTasks
            .map(id => tasks[id])
            .filter(task => task && task.status === 'running');
    }

    /**
     * 获取筛选后的脚本
     * @returns {Array} 筛选后的脚本列表
     */
    getFilteredScripts() {
        const scripts = this.get('scripts');
        const selectedCategory = this.get('ui.selectedCategory');
        
        if (selectedCategory === 'all') {
            return scripts;
        }
        
        return scripts.filter(s => s.category === selectedCategory);
    }

    /**
     * 切换任务展开状态
     * @param {string} taskId - 任务ID
     */
    toggleTaskExpansion(taskId) {
        const expandedTasks = this.get('ui.expandedTasks');
        const index = expandedTasks.indexOf(taskId);
        
        if (index === -1) {
            this.set('ui.expandedTasks', [...expandedTasks, taskId]);
        } else {
            this.set('ui.expandedTasks', expandedTasks.filter(id => id !== taskId));
        }
    }
}

// 创建单例实例
const scriptStore = new ScriptStore();

// 导出store实例和便捷方法
export { scriptStore };

// 导出便捷方法
export const getScriptState = () => scriptStore.getState();
export const setScriptState = (updates) => scriptStore.setState(updates);
export const subscribeToScripts = (callback, paths) => scriptStore.subscribe(callback, paths); 