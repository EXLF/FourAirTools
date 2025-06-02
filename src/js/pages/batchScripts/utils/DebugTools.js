/**
 * 脚本插件调试工具集合
 * 提供各种调试、测试和诊断功能
 */

/**
 * 调试工具类
 * 集中管理所有调试和测试相关的功能
 */
export class DebugTools {
    constructor() {
        this.testTaskIds = [];
        this.debugMode = false;
    }

    /**
     * 启用调试模式
     */
    enableDebugMode() {
        this.debugMode = true;
        console.log('🐛 调试模式已启用');
    }

    /**
     * 禁用调试模式
     */
    disableDebugMode() {
        this.debugMode = false;
        console.log('🐛 调试模式已禁用');
    }

    /**
     * 创建测试后台任务
     * 用于测试后台任务功能
     */
    createTestBackgroundTask() {
        console.log('🧪 创建测试后台任务...');
        
        try {
            const testTaskId = `test_task_${Date.now()}`;
            const testTask = {
                taskInstanceId: testTaskId,
                executionId: `exec_${Date.now()}`,
                scriptType: {
                    id: 'test_script',
                    name: '测试脚本',
                    description: '用于测试的模拟脚本'
                },
                startTime: Date.now(),
                status: 'running',
                logHistory: [
                    {
                        level: 'info',
                        message: '测试任务开始执行',
                        timestamp: new Date().toISOString()
                    },
                    {
                        level: 'success',
                        message: '测试步骤1完成',
                        timestamp: new Date().toISOString()
                    }
                ]
            };
            
            // 检查是否有全局后台任务管理器（优先使用全局集合）
            const backgroundTasks = window.__FABackgroundTasks || window.backgroundTasks;
            
            if (backgroundTasks) {
                backgroundTasks.set(testTaskId, testTask);
                this.testTaskIds.push(testTaskId);
                
                // 保存到存储
                if (window.FABackgroundTaskManager?.saveToStorage) {
                    window.FABackgroundTaskManager.saveToStorage();
                } else if (typeof window.saveBackgroundTasksToStorage === 'function') {
                    window.saveBackgroundTasksToStorage();
                }
                
                // 更新UI显示
                if (window.FABackgroundTaskManager?.updateIndicator) {
                    window.FABackgroundTaskManager.updateIndicator();
                } else if (typeof window.updateBackgroundTaskIndicator === 'function') {
                    window.updateBackgroundTaskIndicator();
                }
                
                console.log(`✅ 测试任务已创建: ${testTaskId}`);
                console.log(`📊 当前后台任务总数: ${backgroundTasks.size}`);
                return testTaskId;
            } else {
                console.log('❌ 后台任务管理器不可用');
                return null;
            }
        } catch (error) {
            console.error('❌ 创建测试任务失败:', error);
            return null;
        }
    }

    /**
     * 强制刷新后台任务指示器
     * 用于调试UI更新问题
     */
    forceUpdateIndicator() {
        console.log('[调试] 强制刷新后台任务指示器');
        
        if (typeof window !== 'undefined' && typeof window.updateBackgroundTaskIndicator === 'function') {
            window.updateBackgroundTaskIndicator();
        } else {
            console.log('❌ updateBackgroundTaskIndicator 函数不可用');
        }
        
        // 也更新面板内容
        const panel = document.getElementById('backgroundTasksPanel');
        if (panel && panel.style.display !== 'none') {
            if (typeof window.renderBackgroundTasksList === 'function') {
                window.renderBackgroundTasksList();
            }
        }
    }

    /**
     * 清理所有测试任务
     * 删除所有通过测试创建的任务
     */
    clearAllTestTasks() {
        console.log('🧹 清理所有测试任务...');
        
        try {
            const backgroundTasks = window.__FABackgroundTasks || window.backgroundTasks;
            
            if (backgroundTasks) {
                const removedTasks = [];
                
                for (const taskId of this.testTaskIds) {
                    if (backgroundTasks.has(taskId)) {
                        backgroundTasks.delete(taskId);
                        removedTasks.push(taskId);
                    }
                }
                
                this.testTaskIds = [];
                
                // 保存到存储并更新UI
                if (window.FABackgroundTaskManager?.saveToStorage) {
                    window.FABackgroundTaskManager.saveToStorage();
                } else if (typeof window.saveBackgroundTasksToStorage === 'function') {
                    window.saveBackgroundTasksToStorage();
                }
                
                if (window.FABackgroundTaskManager?.updateIndicator) {
                    window.FABackgroundTaskManager.updateIndicator();
                } else if (typeof window.updateBackgroundTaskIndicator === 'function') {
                    window.updateBackgroundTaskIndicator();
                }
                
                console.log(`✅ 已清理 ${removedTasks.length} 个测试任务`);
                console.log('✅ 清理后后台任务总数:', backgroundTasks.size);
                
                return removedTasks.length;
            } else {
                console.log('❌ 后台任务管理器不可用');
                return 0;
            }
        } catch (error) {
            console.error('❌ 清理测试任务失败:', error);
            return 0;
        }
    }

    /**
     * 清理所有僵尸任务
     * 用于手动清理localStorage中的无效后台任务
     */
    clearZombieTasks() {
        console.log('🧟 开始清理僵尸任务...');
        
        try {
            const BACKGROUND_TASKS_STORAGE_KEY = 'backgroundTasks';
            const stored = localStorage.getItem(BACKGROUND_TASKS_STORAGE_KEY);
            
            if (stored) {
                const tasksArray = JSON.parse(stored);
                console.log(`🧟 发现 ${tasksArray.length} 个可能的僵尸任务`);
                
                if (tasksArray.length > 0) {
                    console.log('🧟 清理的任务列表:');
                    tasksArray.forEach(task => {
                        console.log(`  - ${task.scriptType?.name || '未知脚本'} (${task.taskId})`);
                    });
                    
                    // 清理localStorage
                    localStorage.removeItem(BACKGROUND_TASKS_STORAGE_KEY);
                    
                    // 清理内存中的任务
                    const backgroundTasks = window.__FABackgroundTasks || window.backgroundTasks;
                    if (backgroundTasks) {
                        backgroundTasks.clear();
                    }
                    
                    // 更新UI
                    if (typeof window.updateBackgroundTaskIndicator === 'function') {
                        window.updateBackgroundTaskIndicator();
                    }
                    
                    const panel = document.getElementById('backgroundTasksPanel');
                    if (panel && panel.style.display !== 'none') {
                        if (typeof window.renderBackgroundTasksList === 'function') {
                            window.renderBackgroundTasksList();
                        }
                    }
                    
                    console.log(`✅ 成功清理 ${tasksArray.length} 个僵尸任务`);
                    return tasksArray.length;
                } else {
                    console.log('✅ 没有发现僵尸任务');
                    return 0;
                }
            } else {
                console.log('✅ localStorage中没有后台任务数据');
                return 0;
            }
        } catch (error) {
            console.error('❌ 清理僵尸任务失败:', error);
            return 0;
        }
    }

    /**
     * 强制清理僵尸任务
     * 更彻底的清理方式，会清理所有相关状态
     */
    forceCleanZombies() {
        console.log('💀 强制清理所有僵尸状态...');
        
        try {
            let cleanedCount = 0;
            
            // 清理localStorage中的后台任务
            const backgroundTasksCount = this.clearZombieTasks();
            cleanedCount += backgroundTasksCount;
            
            // 清理全局状态
            if (typeof window !== 'undefined') {
                // 清理任务状态相关的全局变量
                if (window.__currentTaskInstanceId) {
                    console.log('🧹 清理全局任务实例ID');
                    window.__currentTaskInstanceId = null;
                }
                
                if (window.__currentExecutionId) {
                    console.log('🧹 清理全局执行ID');
                    window.__currentExecutionId = null;
                }
                
                // 清理计时器
                if (window.__executionTimer) {
                    console.log('🧹 清理执行计时器');
                    clearInterval(window.__executionTimer);
                    window.__executionTimer = null;
                }
                
                // 清理核心管理器状态
                if (window.__FA_CoreManagers && window.__FA_CoreManagers.taskStateManager) {
                    const stateManager = window.__FA_CoreManagers.taskStateManager;
                    if (typeof stateManager.detectAndCleanZombieTasks === 'function') {
                        const zombieCount = stateManager.detectAndCleanZombieTasks();
                        console.log(`🧹 通过TaskStateManager清理了 ${zombieCount} 个僵尸任务`);
                        cleanedCount += zombieCount;
                    }
                }
            }
            
            console.log(`✅ 强制清理完成，总共清理 ${cleanedCount} 个僵尸状态`);
            return cleanedCount;
        } catch (error) {
            console.error('❌ 强制清理失败:', error);
            return 0;
        }
    }

    /**
     * 测试后台任务流程
     * 完整测试后台任务的创建、管理和清理流程
     */
    testBackgroundTaskFlow() {
        console.log('🔄 测试后台任务完整流程...');
        
        try {
            // 第一步：记录初始状态
            const initialCount = typeof window !== 'undefined' && window.backgroundTasks 
                ? window.backgroundTasks.size : 0;
            console.log(`📊 初始后台任务数量: ${initialCount}`);
            
            // 第二步：创建测试任务
            console.log('1️⃣ 创建测试任务...');
            const testTaskId = this.createTestBackgroundTask();
            if (!testTaskId) {
                console.log('❌ 测试任务创建失败，终止测试');
                return false;
            }
            
            // 第三步：验证任务创建
            setTimeout(() => {
                console.log('2️⃣ 验证任务创建...');
                const currentCount = window.backgroundTasks ? window.backgroundTasks.size : 0;
                const created = currentCount > initialCount;
                console.log(`📊 当前后台任务数量: ${currentCount}`);
                console.log(`✅ 任务创建${created ? '成功' : '失败'}`);
                
                // 第四步：测试UI更新
                setTimeout(() => {
                    console.log('3️⃣ 测试UI更新...');
                    this.forceUpdateIndicator();
                    
                    const btn = document.getElementById('background-tasks-btn');
                    const hasButton = btn && btn.style.display !== 'none';
                    console.log(`🔘 后台任务按钮显示: ${hasButton ? '✅ 可见' : '❌ 隐藏'}`);
                    
                    // 第五步：清理测试任务
                    setTimeout(() => {
                        console.log('4️⃣ 清理测试任务...');
                        const cleanedCount = this.clearAllTestTasks();
                        const finalCount = window.backgroundTasks ? window.backgroundTasks.size : 0;
                        console.log(`📊 最终后台任务数量: ${finalCount}`);
                        console.log(`✅ 流程测试完成，清理了 ${cleanedCount} 个任务`);
                    }, 1000);
                }, 1000);
            }, 500);
            
            return true;
        } catch (error) {
            console.error('❌ 后台任务流程测试失败:', error);
            return false;
        }
    }

    /**
     * 测试后台任务面板功能
     * 测试面板的显示、隐藏和交互功能
     */
    testBackgroundTasksPanel() {
        console.log('📋 测试后台任务面板功能...');
        
        try {
            // 检查面板元素
            const panel = document.getElementById('backgroundTasksPanel');
            const btnElement = document.getElementById('background-tasks-btn');
            
            if (!panel) {
                console.log('❌ 后台任务面板不存在');
                return false;
            }
            
            if (!btnElement) {
                console.log('❌ 后台任务按钮不存在');
                return false;
            }
            
            // 模拟点击按钮打开面板
            console.log('🖱️ 模拟点击后台任务按钮...');
            btnElement.click();
            
            setTimeout(() => {
                const isVisible = panel.style.display !== 'none';
                console.log('👀 面板显示状态:', isVisible ? '✅ 可见' : '❌ 隐藏');
                
                if (isVisible) {
                    console.log('✅ 后台任务面板功能正常');
                    // 自动关闭面板
                    setTimeout(() => {
                        if (typeof window.toggleBackgroundTasksPanel === 'function') {
                            window.toggleBackgroundTasksPanel(false);
                        }
                    }, 2000);
                }
            }, 100);
            
            return true;
        } catch (error) {
            console.log('❌ 面板测试失败:', error);
            return false;
        }
    }

    /**
     * 调试后台任务状态
     * 输出详细的后台任务信息用于调试
     */
    debugBackgroundTasks() {
        console.log('🔍 调试后台任务状态...');
        console.log('=' * 50);
        
        try {
            // 检查后台任务集合（优先使用全局集合）
            const backgroundTasks = window.__FABackgroundTasks || window.backgroundTasks;
            
            if (backgroundTasks) {
                console.log(`📦 后台任务总数: ${backgroundTasks.size}`);
                
                if (backgroundTasks.size > 0) {
                    console.log('📋 任务详情:');
                    for (const [taskId, task] of backgroundTasks.entries()) {
                        console.log(`  🔹 ${taskId}:`);
                        console.log(`    📜 脚本: ${task.scriptType?.name || '未知'}`);
                        console.log(`    🏃 状态: ${task.status || '未知'}`);
                        console.log(`    ⏰ 开始时间: ${task.startTime ? new Date(task.startTime).toLocaleString() : '未知'}`);
                        console.log(`    📊 日志数量: ${task.logHistory ? task.logHistory.length : 0}`);
                        console.log(`    🆔 执行ID: ${task.executionId || '未知'}`);
                    }
                } else {
                    console.log('📭 没有后台任务');
                }
            } else {
                console.log('❌ 后台任务管理器不可用');
            }
            
            // 检查localStorage存储
            console.log('\n💾 检查localStorage存储:');
            const BACKGROUND_TASKS_STORAGE_KEY = 'backgroundTasks';
            const stored = localStorage.getItem(BACKGROUND_TASKS_STORAGE_KEY);
            if (stored) {
                try {
                    const storedTasks = JSON.parse(stored);
                    console.log(`💾 存储的任务数量: ${storedTasks.length}`);
                } catch (e) {
                    console.log('❌ 存储数据解析失败:', e);
                }
            } else {
                console.log('💾 localStorage中无后台任务数据');
            }
            
            // 检查UI元素
            console.log('\n🖼️ 检查UI元素:');
            const btn = document.getElementById('background-tasks-btn');
            const panel = document.getElementById('backgroundTasksPanel');
            const count = document.getElementById('background-task-count');
            
            console.log(`🔘 后台任务按钮: ${btn ? '✅ 存在' : '❌ 缺失'}`);
            if (btn) {
                console.log(`   显示状态: ${btn.style.display || 'default'}`);
                console.log(`   CSS类: ${btn.className}`);
            }
            
            console.log(`📋 后台任务面板: ${panel ? '✅ 存在' : '❌ 缺失'}`);
            if (panel) {
                console.log(`   显示状态: ${panel.style.display || 'default'}`);
            }
            
            console.log(`🔢 任务计数元素: ${count ? '✅ 存在' : '❌ 缺失'}`);
            if (count) {
                console.log(`   显示数字: ${count.textContent}`);
            }
            
            console.log('=' * 50);
            console.log('🔍 调试信息输出完成');
            
        } catch (error) {
            console.error('❌ 调试过程出错:', error);
        }
    }

    /**
     * 获取调试统计信息
     * 返回当前系统的调试统计数据
     */
    getDebugStats() {
        const stats = {
            testTasksCreated: this.testTaskIds.length,
            debugMode: this.debugMode,
            backgroundTasksAvailable: typeof window !== 'undefined' && !!window.backgroundTasks,
            coreManagersAvailable: typeof window !== 'undefined' && !!window.__FA_CoreManagers,
            timestamp: Date.now()
        };

        if (stats.backgroundTasksAvailable) {
            stats.backgroundTaskCount = window.backgroundTasks.size;
        }

        if (stats.coreManagersAvailable) {
            const managers = window.__FA_CoreManagers;
            stats.coreManagers = {
                scriptManager: !!managers.scriptManager,
                taskStateManager: !!managers.taskStateManager,
                executionEngine: !!managers.executionEngine,
                logManager: !!managers.logManager
            };
        }

        return stats;
    }

    /**
     * 初始化调试工具
     * 设置调试环境和暴露调试函数到全局
     */
    static initDebugTools() {
        console.log('🛠️ 初始化调试工具...');
        
        // 创建调试工具实例
        const debugTools = new DebugTools();
        
        // 暴露到全局作用域用于控制台调试
        if (typeof window !== 'undefined') {
            window.__FA_DebugTools = debugTools;
            
            // 暴露常用调试函数
            window.__debugBackgroundTasks = debugTools.debugBackgroundTasks.bind(debugTools);
            window.__clearZombieTasks = debugTools.clearZombieTasks.bind(debugTools);
            window.__forceCleanZombies = debugTools.forceCleanZombies.bind(debugTools);
            window.__testBackgroundTaskFlow = debugTools.testBackgroundTaskFlow.bind(debugTools);
            window.__forceUpdateIndicator = debugTools.forceUpdateIndicator.bind(debugTools);
            window.__createTestBackgroundTask = debugTools.createTestBackgroundTask.bind(debugTools);
            window.__clearAllTestTasks = debugTools.clearAllTestTasks.bind(debugTools);
            
            console.log('🛠️ 调试工具已暴露到全局作用域');
            console.log('💡 可用函数:');
            console.log('   - window.__debugBackgroundTasks() - 调试后台任务');
            console.log('   - window.__clearZombieTasks() - 清理僵尸任务');
            console.log('   - window.__forceCleanZombies() - 强制清理僵尸状态');
            console.log('   - window.__testBackgroundTaskFlow() - 测试后台任务流程');
            console.log('   - window.__forceUpdateIndicator() - 强制更新指示器');
            console.log('   - window.__createTestBackgroundTask() - 创建测试任务');
            console.log('   - window.__clearAllTestTasks() - 清理测试任务');
        }
        
        return debugTools;
    }
}

// 默认导出调试工具类
export default DebugTools; 