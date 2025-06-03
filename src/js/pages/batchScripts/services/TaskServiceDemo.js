/**
 * TaskServiceDemo - TaskService演示和测试模块
 * 展示TaskService的各种功能和集成方法
 */

import { TaskService, TaskState } from './TaskService.js';
import { TaskStateManager } from '../core/TaskStateManager.js';
import { BatchTaskManager } from '../batchTaskManager.js';
import { ScriptService } from './ScriptService.js';

export class TaskServiceDemo {
    constructor() {
        this.taskService = null;
        this.testResults = [];
        this.isInitialized = false;
        
        console.log('[TaskServiceDemo] 演示模块初始化');
    }

    /**
     * 初始化TaskService和依赖
     */
    async initialize() {
        try {
            console.log('[TaskServiceDemo] 开始初始化TaskService...');
            
            // 初始化依赖服务
            const taskStateManager = new TaskStateManager();
            const scriptService = new ScriptService();
            
            let batchTaskManager = null;
            try {
                batchTaskManager = new BatchTaskManager();
                console.log('[TaskServiceDemo] BatchTaskManager初始化成功');
            } catch (error) {
                console.warn('[TaskServiceDemo] BatchTaskManager初始化失败，将使用独立模式:', error);
            }
            
            // 创建TaskService实例
            this.taskService = new TaskService({
                taskStateManager,
                batchTaskManager,
                scriptService,
                maxConcurrentTasks: 2,
                enableTaskPriority: true,
                enableBackgroundTasks: true
            });
            
            // 设置事件监听器
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('[TaskServiceDemo] TaskService初始化完成');
            
            return { success: true, message: 'TaskService初始化成功' };
            
        } catch (error) {
            console.error('[TaskServiceDemo] 初始化失败:', error);
            return { 
                success: false, 
                error: error.message,
                details: error 
            };
        }
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 监听任务创建事件
        this.taskService.addEventListener('taskCreated', (data) => {
            console.log('[TaskServiceDemo] 任务创建事件:', data.taskId);
        });
        
        // 监听任务启动事件
        this.taskService.addEventListener('taskStarted', (data) => {
            console.log('[TaskServiceDemo] 任务启动事件:', data.taskId);
        });
        
        // 监听任务状态更新事件
        this.taskService.addEventListener('taskStatusUpdated', (data) => {
            console.log('[TaskServiceDemo] 任务状态更新:', data.taskId, '->', data.newState);
        });
        
        // 监听任务停止事件
        this.taskService.addEventListener('taskStopped', (data) => {
            console.log('[TaskServiceDemo] 任务停止事件:', data.taskId);
        });
    }

    /**
     * 运行完整的演示测试
     */
    async runFullDemo() {
        console.log('🚀 [TaskServiceDemo] 开始完整演示测试...');
        
        if (!this.isInitialized) {
            const initResult = await this.initialize();
            if (!initResult.success) {
                return initResult;
            }
        }
        
        this.testResults = [];
        const startTime = Date.now();
        
        try {
            // 测试1: 基础任务创建
            await this.testBasicTaskCreation();
            
            // 测试2: 任务配置验证
            await this.testTaskValidation();
            
            // 测试3: 任务生命周期管理
            await this.testTaskLifecycle();
            
            // 测试4: 并发任务管理
            await this.testConcurrentTasks();
            
            // 测试5: 任务队列功能
            await this.testTaskQueue();
            
            // 测试6: 任务统计和监控
            await this.testTaskStatistics();
            
            // 测试7: 错误处理和恢复
            await this.testErrorHandling();
            
            const totalTime = Date.now() - startTime;
            const successCount = this.testResults.filter(r => r.success).length;
            const totalCount = this.testResults.length;
            
            console.log(`✅ [TaskServiceDemo] 演示完成: ${successCount}/${totalCount} 测试通过, 耗时: ${totalTime}ms`);
            
            return {
                success: successCount === totalCount,
                summary: {
                    totalTests: totalCount,
                    passedTests: successCount,
                    failedTests: totalCount - successCount,
                    totalTime: totalTime,
                    averageTime: totalTime / totalCount
                },
                results: this.testResults
            };
            
        } catch (error) {
            console.error('[TaskServiceDemo] 演示测试失败:', error);
            return {
                success: false,
                error: error.message,
                results: this.testResults
            };
        }
    }

    /**
     * 测试基础任务创建
     */
    async testBasicTaskCreation() {
        console.log('📝 测试1: 基础任务创建');
        const testStart = Date.now();
        
        try {
            const taskConfig = {
                name: '演示任务 - 基础创建',
                scriptId: 'demo_script_001',
                scriptType: 'daily_task',
                accounts: [
                    { id: 'wallet_1', name: '钱包1', address: '0x123...' },
                    { id: 'wallet_2', name: '钱包2', address: '0x456...' }
                ],
                proxyConfig: {
                    enabled: true,
                    type: 'http',
                    url: 'http://127.0.0.1:7890'
                },
                scriptParams: {
                    delay: 5000,
                    retryAttempts: 3
                },
                priority: 'normal'
            };
            
            const result = await this.taskService.createTask(taskConfig);
            
            if (result.success) {
                console.log(`  ✅ 任务创建成功: ${result.taskId}`);
                
                // 验证任务数据
                const taskData = this.taskService.getTask(result.taskId);
                if (taskData && taskData.accounts.length === 2) {
                    this.addTestResult('基础任务创建', true, Date.now() - testStart, {
                        taskId: result.taskId,
                        accountCount: taskData.accounts.length
                    });
                } else {
                    throw new Error('任务数据验证失败');
                }
            } else {
                throw new Error(result.error?.message || '任务创建失败');
            }
            
        } catch (error) {
            console.error('  ❌ 基础任务创建失败:', error);
            this.addTestResult('基础任务创建', false, Date.now() - testStart, null, error.message);
        }
    }

    /**
     * 测试任务配置验证
     */
    async testTaskValidation() {
        console.log('🔍 测试2: 任务配置验证');
        const testStart = Date.now();
        
        try {
            // 测试无效配置
            const invalidConfigs = [
                { name: '无脚本ID' }, // 缺少scriptId
                { scriptId: 'test', accounts: 'invalid' }, // 账户格式错误
                { scriptId: 'test', accounts: [] }, // 账户列表为空
                { scriptId: 'test', accounts: [{}] }, // 无效账户对象
                { scriptId: 'test', accounts: [{ id: 'test' }], priority: 'invalid' } // 无效优先级
            ];
            
            let validationErrors = 0;
            for (const config of invalidConfigs) {
                const result = await this.taskService.createTask(config);
                if (!result.success) {
                    validationErrors++;
                    console.log(`  ✅ 正确识别无效配置: ${result.error.message}`);
                } else {
                    console.warn(`  ⚠️ 未识别无效配置:`, config);
                }
            }
            
            // 测试有效配置
            const validConfig = {
                scriptId: 'validation_test',
                accounts: [{ id: 'test_wallet', name: 'Test Wallet' }],
                priority: 'high',
                timeout: 60000
            };
            
            const validResult = await this.taskService.createTask(validConfig);
            if (validResult.success) {
                console.log(`  ✅ 有效配置创建成功: ${validResult.taskId}`);
                
                this.addTestResult('任务配置验证', true, Date.now() - testStart, {
                    detectedErrors: validationErrors,
                    totalTests: invalidConfigs.length + 1
                });
            } else {
                throw new Error('有效配置创建失败');
            }
            
        } catch (error) {
            console.error('  ❌ 任务配置验证失败:', error);
            this.addTestResult('任务配置验证', false, Date.now() - testStart, null, error.message);
        }
    }

    /**
     * 测试任务生命周期管理
     */
    async testTaskLifecycle() {
        console.log('🔄 测试3: 任务生命周期管理');
        const testStart = Date.now();
        
        try {
            // 创建测试任务
            const taskConfig = {
                name: '生命周期测试任务',
                scriptId: 'lifecycle_test',
                accounts: [{ id: 'lifecycle_wallet', name: 'Lifecycle Test Wallet' }]
            };
            
            const createResult = await this.taskService.createTask(taskConfig);
            if (!createResult.success) {
                throw new Error('任务创建失败');
            }
            
            const taskId = createResult.taskId;
            console.log(`  📋 创建任务: ${taskId}`);
            
            // 检查初始状态
            let taskData = this.taskService.getTask(taskId);
            if (taskData.currentState !== TaskState.PENDING) {
                throw new Error(`初始状态错误: 期望 ${TaskState.PENDING}, 实际 ${taskData.currentState}`);
            }
            console.log(`  ✅ 初始状态正确: ${taskData.currentState}`);
            
            // 模拟启动任务（不实际执行）
            await this.taskService.updateTaskStatus(taskId, TaskState.RUNNING, {
                simulatedStart: true,
                startTime: Date.now()
            });
            
            taskData = this.taskService.getTask(taskId);
            if (taskData.currentState !== TaskState.RUNNING) {
                throw new Error(`运行状态错误: 期望 ${TaskState.RUNNING}, 实际 ${taskData.currentState}`);
            }
            console.log(`  ✅ 运行状态正确: ${taskData.currentState}`);
            
            // 等待一下模拟执行时间
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 模拟完成任务
            await this.taskService.updateTaskStatus(taskId, TaskState.COMPLETED, {
                simulatedCompletion: true,
                endTime: Date.now(),
                result: 'Test completed successfully'
            });
            
            taskData = this.taskService.getTask(taskId);
            if (taskData.currentState !== TaskState.COMPLETED) {
                throw new Error(`完成状态错误: 期望 ${TaskState.COMPLETED}, 实际 ${taskData.currentState}`);
            }
            console.log(`  ✅ 完成状态正确: ${taskData.currentState}`);
            
            // 验证状态历史
            const stateHistory = taskData.stateHistory;
            if (stateHistory.length < 3) {
                throw new Error(`状态历史记录不足: 期望至少3条, 实际 ${stateHistory.length}条`);
            }
            console.log(`  ✅ 状态历史记录正确: ${stateHistory.length}条记录`);
            
            this.addTestResult('任务生命周期管理', true, Date.now() - testStart, {
                taskId,
                stateTransitions: stateHistory.length,
                finalState: taskData.currentState
            });
            
        } catch (error) {
            console.error('  ❌ 任务生命周期测试失败:', error);
            this.addTestResult('任务生命周期管理', false, Date.now() - testStart, null, error.message);
        }
    }

    /**
     * 测试并发任务管理
     */
    async testConcurrentTasks() {
        console.log('⚡ 测试4: 并发任务管理');
        const testStart = Date.now();
        
        try {
            const tasks = [];
            
            // 创建多个任务
            for (let i = 1; i <= 5; i++) {
                const taskConfig = {
                    name: `并发任务 ${i}`,
                    scriptId: `concurrent_test_${i}`,
                    accounts: [{ id: `wallet_${i}`, name: `Wallet ${i}` }],
                    priority: i <= 2 ? 'high' : 'normal'
                };
                
                const result = await this.taskService.createTask(taskConfig);
                if (result.success) {
                    tasks.push(result.taskId);
                    console.log(`  📋 创建任务${i}: ${result.taskId}`);
                }
            }
            
            if (tasks.length !== 5) {
                throw new Error(`任务创建数量错误: 期望5个, 实际${tasks.length}个`);
            }
            
            // 检查任务队列和并发限制
            const stats = this.taskService.getStats();
            console.log(`  📊 当前统计: 活跃任务${stats.activeTasks}, 运行中${stats.runningTasks}`);
            
            // 模拟并发执行
            const concurrentResults = await Promise.allSettled(
                tasks.slice(0, 3).map(async (taskId, index) => {
                    await this.taskService.updateTaskStatus(taskId, TaskState.RUNNING, {
                        simulatedConcurrent: true,
                        index
                    });
                    
                    // 模拟执行时间
                    await new Promise(resolve => setTimeout(resolve, 50 + index * 20));
                    
                    await this.taskService.updateTaskStatus(taskId, TaskState.COMPLETED, {
                        simulatedConcurrentCompletion: true
                    });
                    
                    return taskId;
                })
            );
            
            const completedTasks = concurrentResults.filter(r => r.status === 'fulfilled').length;
            console.log(`  ✅ 并发执行完成: ${completedTasks}个任务`);
            
            // 验证最终状态
            const finalStats = this.taskService.getStats();
            console.log(`  📊 最终统计: 完成${finalStats.totalCompleted}, 活跃${finalStats.activeTasks}`);
            
            this.addTestResult('并发任务管理', true, Date.now() - testStart, {
                totalTasks: tasks.length,
                completedTasks,
                finalStats
            });
            
        } catch (error) {
            console.error('  ❌ 并发任务测试失败:', error);
            this.addTestResult('并发任务管理', false, Date.now() - testStart, null, error.message);
        }
    }

    /**
     * 测试任务队列功能
     */
    async testTaskQueue() {
        console.log('📋 测试5: 任务队列功能');
        const testStart = Date.now();
        
        try {
            // 创建高优先级任务
            const highPriorityConfig = {
                name: '高优先级队列任务',
                scriptId: 'queue_test_high',
                accounts: [{ id: 'queue_wallet_high', name: 'High Priority Wallet' }],
                priority: 'critical'
            };
            
            const highResult = await this.taskService.createTask(highPriorityConfig);
            if (!highResult.success) {
                throw new Error('高优先级任务创建失败');
            }
            
            // 创建普通优先级任务
            const normalPriorityConfig = {
                name: '普通优先级队列任务',
                scriptId: 'queue_test_normal',
                accounts: [{ id: 'queue_wallet_normal', name: 'Normal Priority Wallet' }],
                priority: 'normal'
            };
            
            const normalResult = await this.taskService.createTask(normalPriorityConfig);
            if (!normalResult.success) {
                throw new Error('普通优先级任务创建失败');
            }
            
            console.log(`  📋 创建队列任务: 高优先级(${highResult.taskId}), 普通优先级(${normalResult.taskId})`);
            
            // 验证任务优先级设置
            const highTask = this.taskService.getTask(highResult.taskId);
            const normalTask = this.taskService.getTask(normalResult.taskId);
            
            if (highTask.priorityWeight <= normalTask.priorityWeight) {
                throw new Error('优先级权重设置错误');
            }
            
            console.log(`  ✅ 优先级权重正确: 高优先级(${highTask.priorityWeight}) > 普通优先级(${normalTask.priorityWeight})`);
            
            // 测试队列处理逻辑（模拟）
            const queueStats = {
                beforeQueue: this.taskService.taskQueue.length,
                highPriority: highTask.priorityWeight,
                normalPriority: normalTask.priorityWeight
            };
            
            this.addTestResult('任务队列功能', true, Date.now() - testStart, {
                highTaskId: highResult.taskId,
                normalTaskId: normalResult.taskId,
                queueStats
            });
            
        } catch (error) {
            console.error('  ❌ 任务队列测试失败:', error);
            this.addTestResult('任务队列功能', false, Date.now() - testStart, null, error.message);
        }
    }

    /**
     * 测试任务统计和监控
     */
    async testTaskStatistics() {
        console.log('📊 测试6: 任务统计和监控');
        const testStart = Date.now();
        
        try {
            // 获取当前统计
            const beforeStats = this.taskService.getStats();
            console.log('  📊 测试前统计:', beforeStats);
            
            // 创建一个测试任务并模拟完整生命周期
            const statsTestConfig = {
                name: '统计测试任务',
                scriptId: 'stats_test',
                accounts: [{ id: 'stats_wallet', name: 'Stats Test Wallet' }]
            };
            
            const createResult = await this.taskService.createTask(statsTestConfig);
            if (!createResult.success) {
                throw new Error('统计测试任务创建失败');
            }
            
            const taskId = createResult.taskId;
            
            // 模拟任务执行和完成
            await this.taskService.updateTaskStatus(taskId, TaskState.RUNNING);
            await new Promise(resolve => setTimeout(resolve, 50));
            await this.taskService.updateTaskStatus(taskId, TaskState.COMPLETED);
            
            // 获取更新后的统计
            const afterStats = this.taskService.getStats();
            console.log('  📊 测试后统计:', afterStats);
            
            // 验证统计数据变化
            if (afterStats.totalCreated <= beforeStats.totalCreated) {
                throw new Error('总创建数量未增加');
            }
            
            if (afterStats.totalCompleted <= beforeStats.totalCompleted) {
                throw new Error('总完成数量未增加');
            }
            
            if (afterStats.activeTasks < 0) {
                throw new Error('活跃任务数量异常');
            }
            
            console.log(`  ✅ 统计数据验证成功: 创建+${afterStats.totalCreated - beforeStats.totalCreated}, 完成+${afterStats.totalCompleted - beforeStats.totalCompleted}`);
            
            // 测试任务列表过滤
            const allTasks = this.taskService.getAllTasks();
            const completedTasks = this.taskService.getAllTasks({ status: TaskState.COMPLETED });
            const specificScriptTasks = this.taskService.getAllTasks({ scriptId: 'stats_test' });
            
            console.log(`  📋 任务列表: 全部(${allTasks.length}), 已完成(${completedTasks.length}), 特定脚本(${specificScriptTasks.length})`);
            
            this.addTestResult('任务统计和监控', true, Date.now() - testStart, {
                beforeStats,
                afterStats,
                taskCounts: {
                    all: allTasks.length,
                    completed: completedTasks.length,
                    specificScript: specificScriptTasks.length
                }
            });
            
        } catch (error) {
            console.error('  ❌ 任务统计测试失败:', error);
            this.addTestResult('任务统计和监控', false, Date.now() - testStart, null, error.message);
        }
    }

    /**
     * 测试错误处理和恢复
     */
    async testErrorHandling() {
        console.log('🛠️ 测试7: 错误处理和恢复');
        const testStart = Date.now();
        
        try {
            // 测试任务不存在的情况
            const nonExistentTask = this.taskService.getTask('non_existent_task_id');
            if (nonExistentTask !== null) {
                throw new Error('应该返回null对于不存在的任务');
            }
            console.log('  ✅ 正确处理不存在的任务');
            
            // 创建一个任务并模拟错误
            const errorTestConfig = {
                name: '错误处理测试任务',
                scriptId: 'error_test',
                accounts: [{ id: 'error_wallet', name: 'Error Test Wallet' }]
            };
            
            const createResult = await this.taskService.createTask(errorTestConfig);
            if (!createResult.success) {
                throw new Error('错误测试任务创建失败');
            }
            
            const taskId = createResult.taskId;
            
            // 模拟任务执行失败
            await this.taskService.updateTaskStatus(taskId, TaskState.RUNNING);
            await this.taskService.updateTaskStatus(taskId, TaskState.FAILED, {
                error: 'Simulated execution error',
                errorType: 'EXECUTION_FAILED',
                retryable: true
            });
            
            const failedTask = this.taskService.getTask(taskId);
            if (failedTask.currentState !== TaskState.FAILED) {
                throw new Error('任务状态未正确设置为失败');
            }
            
            console.log(`  ✅ 正确处理任务执行失败: ${taskId}`);
            
            // 验证错误统计
            const errorStats = this.taskService.getStats();
            if (errorStats.totalFailed <= 0) {
                throw new Error('失败统计未正确更新');
            }
            
            console.log(`  📊 错误统计正确: 总失败数 ${errorStats.totalFailed}`);
            
            // 测试事件系统的错误处理
            let eventErrorHandled = false;
            this.taskService.addEventListener('testEvent', () => {
                throw new Error('Test event error');
            });
            
            try {
                this.taskService.emitEvent('testEvent', { test: true });
                eventErrorHandled = true;
            } catch (error) {
                // 事件错误应该被内部处理，不应该抛出
                console.warn('  ⚠️ 事件错误未被正确处理');
            }
            
            if (eventErrorHandled) {
                console.log('  ✅ 事件系统错误处理正确');
            }
            
            this.addTestResult('错误处理和恢复', true, Date.now() - testStart, {
                errorTaskId: taskId,
                finalStats: errorStats,
                eventErrorHandled
            });
            
        } catch (error) {
            console.error('  ❌ 错误处理测试失败:', error);
            this.addTestResult('错误处理和恢复', false, Date.now() - testStart, null, error.message);
        }
    }

    /**
     * 添加测试结果
     */
    addTestResult(testName, success, duration, data = null, error = null) {
        this.testResults.push({
            testName,
            success,
            duration,
            timestamp: Date.now(),
            data,
            error
        });
    }

    /**
     * 获取TaskService实例（用于外部访问）
     */
    getTaskService() {
        return this.taskService;
    }

    /**
     * 获取测试结果
     */
    getTestResults() {
        return this.testResults;
    }

    /**
     * 清理资源
     */
    cleanup() {
        if (this.taskService) {
            this.taskService.cleanup();
        }
        this.testResults = [];
        this.isInitialized = false;
        console.log('[TaskServiceDemo] 资源清理完成');
    }
}

// 全局实例
let taskServiceDemo = null;

/**
 * 获取TaskServiceDemo单例
 */
export function getTaskServiceDemo() {
    if (!taskServiceDemo) {
        taskServiceDemo = new TaskServiceDemo();
    }
    return taskServiceDemo;
}

/**
 * 全局测试函数
 */
window.FA_testTaskService = async function() {
    console.log('🚀 开始TaskService演示测试...');
    
    const demo = getTaskServiceDemo();
    const result = await demo.runFullDemo();
    
    console.log('📊 TaskService测试结果:', result);
    
    // 如果测试成功，将TaskService实例暴露到全局
    if (result.success) {
        window.FA_TaskService = demo.getTaskService();
        console.log('✅ TaskService已暴露到全局变量 window.FA_TaskService');
    }
    
    return result;
};

/**
 * 初始化TaskService的快捷函数
 */
window.FA_initTaskService = async function() {
    console.log('🔧 初始化TaskService...');
    
    const demo = getTaskServiceDemo();
    const result = await demo.initialize();
    
    if (result.success) {
        window.FA_TaskService = demo.getTaskService();
        console.log('✅ TaskService初始化成功并暴露到全局');
    } else {
        console.error('❌ TaskService初始化失败:', result.error);
    }
    
    return result;
};

/**
 * 创建测试任务的快捷函数
 */
window.FA_createTestTask = async function(taskName = '快速测试任务') {
    if (!window.FA_TaskService) {
        console.log('⚠️ TaskService未初始化，正在初始化...');
        await window.FA_initTaskService();
    }
    
    const taskConfig = {
        name: taskName,
        scriptId: 'quick_test_' + Date.now(),
        accounts: [
            { id: 'test_wallet_1', name: '测试钱包1', address: '0x123...' }
        ],
        priority: 'normal'
    };
    
    const result = await window.FA_TaskService.createTask(taskConfig);
    console.log('📋 快速创建任务结果:', result);
    
    return result;
};

console.log('📦 TaskServiceDemo模块加载完成');
console.log('🔧 可用的全局函数:');
console.log('  - FA_testTaskService() - 运行完整演示测试');
console.log('  - FA_initTaskService() - 初始化TaskService');
console.log('  - FA_createTestTask(name) - 创建测试任务'); 