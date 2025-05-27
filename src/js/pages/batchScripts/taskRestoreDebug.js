/**
 * 任务恢复调试工具
 * 用于测试和验证任务恢复功能的修复效果
 */

/**
 * 调试任务恢复流程
 */
export function debugTaskRestore() {
    console.log('\n🔍 任务恢复调试工具');
    console.log('='.repeat(50));
    
    // 1. 检查DOM元素
    console.log('1️⃣ 检查关键DOM元素:');
    const logContainer = document.getElementById('taskLogContainer');
    const statusText = document.getElementById('statusText');
    const timerElement = document.getElementById('timer');
    const stopBtn = document.getElementById('stop-btn');
    
    console.log('  📋 日志容器:', logContainer ? '✅ 存在' : '❌ 缺失');
    console.log('  📊 状态文本:', statusText ? '✅ 存在' : '❌ 缺失');
    console.log('  ⏱️ 计时器:', timerElement ? '✅ 存在' : '❌ 缺失');
    console.log('  🛑 停止按钮:', stopBtn ? '✅ 存在' : '❌ 缺失');
    
    // 2. 检查全局状态
    console.log('\n2️⃣ 检查全局状态:');
    console.log('  🔗 执行ID:', window.__currentExecutionId || '❌ 未设置');
    console.log('  📝 任务ID:', window.__currentTaskInstanceId || '❌ 未设置');
    console.log('  ⏰ 开始时间:', window.__startTime ? new Date(window.__startTime).toLocaleTimeString() : '❌ 未设置');
    console.log('  🎯 当前脚本:', window.pageState?.currentBatchScriptType?.name || '❌ 未设置');
    
    // 3. 检查监听器状态
    console.log('\n3️⃣ 检查监听器状态:');
    const unsubscribers = window.__currentLogUnsubscribers;
    console.log('  👂 日志监听器:', unsubscribers ? `✅ ${unsubscribers.length} 个` : '❌ 未设置');
    console.log('  🧹 清理函数:', window.__currentLogCleanup ? '✅ 存在' : '❌ 未设置');
    
    // 4. 检查后台任务
    console.log('\n4️⃣ 检查后台任务:');
    if (typeof backgroundTasks !== 'undefined') {
        console.log('  📦 后台任务数量:', backgroundTasks.size);
        if (backgroundTasks.size > 0) {
            console.log('  📋 任务列表:');
            for (const [taskId, task] of backgroundTasks.entries()) {
                console.log(`    - ${taskId}: ${task.scriptType?.name || '未知脚本'}`);
            }
        }
    } else {
        console.log('  📦 后台任务: ❌ backgroundTasks 未定义');
    }
    
    // 5. 检查IPC状态
    console.log('\n5️⃣ 检查IPC状态:');
    console.log('  🔌 electron:', window.electron ? '✅ 存在' : '❌ 缺失');
    console.log('  📡 ipcRenderer:', window.electron?.ipcRenderer ? '✅ 存在' : '❌ 缺失');
    console.log('  🎯 scriptAPI:', window.scriptAPI ? '✅ 存在' : '❌ 缺失');
    
    console.log('\n' + '='.repeat(50));
}

/**
 * 模拟任务恢复测试
 */
export async function simulateTaskRestore() {
    console.log('\n🧪 模拟任务恢复测试');
    console.log('='.repeat(50));
    
    try {
        // 创建模拟后台任务
        const mockTaskId = 'test_restore_' + Date.now();
        const mockTask = {
            taskInstanceId: mockTaskId,
            executionId: 'exec_' + Date.now(),
            scriptType: {
                id: 'test_script',
                name: '测试恢复脚本'
            },
            logHistory: [
                {
                    type: 'info',
                    time: '[' + new Date().toLocaleTimeString() + ']',
                    message: '这是一条测试日志',
                    html: '<div class="log-entry log-type-info"><span class="log-time">[' + new Date().toLocaleTimeString() + ']</span><span class="log-message">这是一条测试日志</span></div>',
                    timestamp: Date.now(),
                    index: 0,
                    content: '[' + new Date().toLocaleTimeString() + '] 这是一条测试日志'
                }
            ],
            startTime: Date.now() - 60000,
            status: 'running',
            metadata: {
                backgroundTime: Date.now() - 30000,
                logCount: 1,
                scriptName: '测试恢复脚本',
                version: '2.0'
            }
        };
        
        console.log('1️⃣ 创建模拟任务:', mockTaskId);
        
        // 保存到后台任务
        if (typeof backgroundTasks !== 'undefined') {
            backgroundTasks.set(mockTaskId, mockTask);
            console.log('2️⃣ 任务已保存到后台');
        }
        
        // 导入恢复管理器
        const { taskRestoreManager } = await import('./taskRestoreManager.js');
        console.log('3️⃣ 恢复管理器已导入');
        
        // 执行恢复
        console.log('4️⃣ 开始执行恢复...');
        const success = await taskRestoreManager.restoreTask(mockTaskId, mockTask);
        
        if (success) {
            console.log('✅ 模拟恢复成功！');
            
            // 检查恢复后的状态
            setTimeout(() => {
                console.log('5️⃣ 恢复后状态检查:');
                debugTaskRestore();
            }, 1000);
        } else {
            console.log('❌ 模拟恢复失败');
        }
        
    } catch (error) {
        console.error('❌ 模拟测试失败:', error);
    }
    
    console.log('\n' + '='.repeat(50));
}

/**
 * 检查日志容器状态
 */
export function checkLogContainer() {
    console.log('\n📋 日志容器状态检查');
    console.log('='.repeat(30));
    
    const logContainer = document.getElementById('taskLogContainer');
    
    if (logContainer) {
        console.log('✅ 日志容器存在');
        console.log('  📏 容器高度:', logContainer.offsetHeight + 'px');
        console.log('  👁️ 可见性:', logContainer.style.display || 'visible');
        console.log('  📝 子元素数量:', logContainer.children.length);
        console.log('  📜 滚动位置:', logContainer.scrollTop + '/' + logContainer.scrollHeight);
        
        // 检查日志条目
        const logEntries = logContainer.querySelectorAll('.log-entry');
        console.log('  📄 日志条目数量:', logEntries.length);
        
        if (logEntries.length > 0) {
            console.log('  📋 最新日志:');
            const lastEntry = logEntries[logEntries.length - 1];
            const timeElement = lastEntry.querySelector('.log-time');
            const messageElement = lastEntry.querySelector('.log-message');
            console.log(`    时间: ${timeElement?.textContent || '未知'}`);
            console.log(`    内容: ${messageElement?.textContent || '未知'}`);
        }
    } else {
        console.log('❌ 日志容器不存在');
        
        // 检查可能的父容器
        const logSection = document.getElementById('logSection');
        const configSection = document.getElementById('configSection');
        
        console.log('  📦 日志区域:', logSection ? '✅ 存在' : '❌ 缺失');
        console.log('  ⚙️ 配置区域:', configSection ? '✅ 存在' : '❌ 缺失');
        
        if (logSection) {
            console.log('  👁️ 日志区域可见性:', logSection.style.display || 'visible');
        }
        if (configSection) {
            console.log('  👁️ 配置区域可见性:', configSection.style.display || 'visible');
        }
    }
    
    console.log('='.repeat(30));
}

/**
 * 强制切换到执行阶段
 */
export function forceExecutionStage() {
    console.log('\n🔄 强制切换到执行阶段');
    
    // 隐藏配置区域
    const configSection = document.getElementById('configSection');
    if (configSection) {
        configSection.style.display = 'none';
        console.log('✅ 已隐藏配置区域');
    }
    
    // 显示日志区域
    const logSection = document.getElementById('logSection');
    if (logSection) {
        logSection.style.display = 'flex';
        console.log('✅ 已显示日志区域');
    }
    
    // 显示头部控制按钮
    const headerControls = document.getElementById('headerControls');
    if (headerControls) {
        headerControls.style.display = 'flex';
        console.log('✅ 已显示头部控制按钮');
    }
    
    // 更新状态
    const statusText = document.getElementById('statusText');
    if (statusText) {
        statusText.textContent = '执行中';
        statusText.style.color = '#f39c12';
        console.log('✅ 已更新状态文本');
    }
    
    // 显示计时器
    const timerElement = document.getElementById('timer');
    if (timerElement) {
        timerElement.style.display = 'inline';
        console.log('✅ 已显示计时器');
    }
    
    // 显示停止按钮
    const stopBtn = document.getElementById('stop-btn');
    if (stopBtn) {
        stopBtn.style.display = 'inline-flex';
        console.log('✅ 已显示停止按钮');
    }
    
    console.log('🎉 强制切换完成');
}

/**
 * 快速修复任务恢复问题
 */
export function quickFixTaskRestore() {
    console.log('\n🔧 快速修复任务恢复问题');
    
    // 1. 检查是否需要创建UI结构
    const logSection = document.getElementById('logSection');
    const configSection = document.getElementById('configSection');
    
    if (!logSection && !configSection) {
        console.log('🏗️ UI结构不存在，尝试重新导航...');
        
        // 尝试重新导航到任务管理器
        const taskInstanceId = window.__currentTaskInstanceId;
        if (taskInstanceId && window.navigateToModularTaskManager) {
            window.navigateToModularTaskManager(taskInstanceId);
            
            // 等待UI创建完成
            setTimeout(() => {
                forceExecutionStage();
                setTimeout(() => {
                    checkLogContainer();
                    const logContainer = document.getElementById('taskLogContainer');
                    if (logContainer) {
                        logContainer.scrollTop = logContainer.scrollHeight;
                        console.log('✅ 日志容器已滚动到底部');
                    }
                }, 500);
            }, 1000);
        } else {
            console.error('❌ 无法重新导航，缺少任务ID或导航函数');
            createMinimalUI();
        }
    } else {
        // 2. 强制切换到执行阶段
        forceExecutionStage();
        
        // 3. 检查并修复日志容器
        setTimeout(() => {
            checkLogContainer();
            
            // 如果日志容器存在，滚动到底部
            const logContainer = document.getElementById('taskLogContainer');
            if (logContainer) {
                logContainer.scrollTop = logContainer.scrollHeight;
                console.log('✅ 日志容器已滚动到底部');
            }
        }, 500);
    }
    
    console.log('🎉 快速修复完成');
}

/**
 * 创建最小化的UI结构
 */
function createMinimalUI() {
    console.log('🏗️ 创建最小化UI结构...');
    
    // 获取内容区域
    const contentArea = document.querySelector('.content-area') || document.body;
    
    // 创建基本的任务管理器结构
    const taskManagerHTML = `
        <div class="batch-task-container">
            <div class="task-header">
                <div class="header-nav">
                    <button id="back-to-cards-btn" class="back-btn" title="返回">
                        <i class="fas fa-arrow-left"></i>
                    </button>
                    <h3>任务恢复</h3>
                </div>
                <div class="header-status">
                    <div class="status-info">
                        <span class="status-text" id="statusText">执行中</span>
                        <span class="timer" id="timer">00:00</span>
                    </div>
                    <div class="header-controls" id="headerControls">
                        <button id="stop-btn" class="control-btn btn-danger" title="停止执行">
                            <i class="fas fa-stop"></i>
                            <span>停止</span>
                        </button>
                    </div>
                </div>
            </div>
            
            <div class="task-body">
                <div class="config-section" id="configSection" style="display: none;">
                    <!-- 配置区域 -->
                </div>
                
                <div class="log-section" id="logSection" style="display: flex;">
                    <div class="log-toolbar">
                        <div class="log-info">
                            <span class="log-title">执行日志</span>
                            <span class="log-stats">
                                <span id="totalCount">0</span> 个任务 | 
                                成功 <span id="successCount">0</span> | 
                                失败 <span id="failCount">0</span>
                            </span>
                        </div>
                    </div>
                    <div class="log-container" id="taskLogContainer">
                        <!-- 日志内容 -->
                    </div>
                </div>
            </div>
        </div>
    `;
    
    contentArea.innerHTML = taskManagerHTML;
    console.log('✅ 最小化UI结构已创建');
    
    // 初始化日志系统
    setTimeout(() => {
        const logContainer = document.getElementById('taskLogContainer');
        if (logContainer && window.TaskLogger) {
            const { TaskLogger } = require('./logger.js');
            const cleanupLogRender = TaskLogger.renderLogsToContainer(logContainer, true);
            window.__currentLogCleanup = cleanupLogRender;
            TaskLogger.logInfo('📋 任务恢复 - 日志系统已初始化');
            console.log('✅ 日志系统已初始化');
        }
    }, 100);
}

/**
 * 检查脚本运行状态
 */
export function checkScriptStatus() {
    console.log('\n📊 脚本运行状态检查');
    console.log('='.repeat(40));
    
    const executionId = window.__currentExecutionId;
    const taskInstanceId = window.__currentTaskInstanceId;
    const startTime = window.__startTime;
    const hasExecutionTimer = !!window.__executionTimer;
    
    console.log('🔗 执行ID:', executionId || '❌ 未设置');
    console.log('📝 任务ID:', taskInstanceId || '❌ 未设置');
    
    if (startTime) {
        const runningTime = Date.now() - startTime;
        const minutes = Math.floor(runningTime / 60000);
        const seconds = Math.floor((runningTime % 60000) / 1000);
        console.log(`⏰ 运行时长: ${minutes}分${seconds}秒`);
    } else {
        console.log('⏰ 运行时长: ❌ 未知');
    }
    
    // 检查任务运行状态
    const isTaskRunning = (taskInstanceId && hasExecutionTimer) || executionId;
    console.log('🚀 任务运行状态:', isTaskRunning ? '✅ 运行中' : '❌ 未运行');
    
    // 检查监听器数组状态
    const unsubscribers = window.__currentLogUnsubscribers;
    if (unsubscribers) {
        console.log(`📋 监听器数组: ✅ 存在 (${unsubscribers.length} 个)`);
    } else {
        console.log('📋 监听器数组: ❌ 不存在或为null');
    }
    
    // 检查IPC监听器数量
    if (window.electron && window.electron.ipcRenderer) {
        const logListeners = window.electron.ipcRenderer.listenerCount?.('script-log') || 0;
        const completedListeners = window.electron.ipcRenderer.listenerCount?.('script-completed') || 0;
        console.log(`👂 script-log 监听器: ${logListeners} 个`);
        console.log(`🏁 script-completed 监听器: ${completedListeners} 个`);
    }
    
    // 检查计时器状态
    console.log('⏱️ 执行计时器:', hasExecutionTimer ? '✅ 运行中' : '❌ 未运行');
    
    // 检查日志清理函数
    console.log('🧹 日志清理函数:', window.__currentLogCleanup ? '✅ 存在' : '❌ 不存在');
    
    // 检查后台任务状态
    if (typeof backgroundTasks !== 'undefined') {
        console.log(`📦 后台任务数量: ${backgroundTasks.size}`);
    } else {
        console.log('📦 后台任务: ❌ backgroundTasks 未定义');
    }
    
    console.log('='.repeat(40));
}

/**
 * 强制恢复任务UI
 */
export function forceRestoreTaskUI() {
    console.log('\n🚀 强制恢复任务UI');
    
    const taskInstanceId = window.__currentTaskInstanceId;
    const executionId = window.__currentExecutionId;
    
    if (!taskInstanceId || !executionId) {
        console.error('❌ 缺少任务ID或执行ID，无法恢复');
        return;
    }
    
    console.log(`📝 任务ID: ${taskInstanceId}`);
    console.log(`🔗 执行ID: ${executionId}`);
    
    // 1. 创建UI结构
    createMinimalUI();
    
    // 2. 等待UI创建完成后初始化
    setTimeout(() => {
        // 3. 启动计时器
        const startTime = window.__startTime || Date.now();
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            let seconds = elapsedSeconds;
            
            const updateTimer = () => {
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                timerElement.textContent = 
                    `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            };
            
            updateTimer();
            
            if (!window.__executionTimer) {
                window.__executionTimer = setInterval(() => {
                    seconds++;
                    updateTimer();
                }, 1000);
                console.log('✅ 计时器已启动');
            }
        }
        
        // 4. 初始化日志系统
        const logContainer = document.getElementById('taskLogContainer');
        if (logContainer) {
            // 动态导入TaskLogger
            import('./logger.js').then(({ TaskLogger }) => {
                const cleanupLogRender = TaskLogger.renderLogsToContainer(logContainer, true);
                window.__currentLogCleanup = cleanupLogRender;
                
                TaskLogger.logInfo('🔄 任务UI已强制恢复');
                TaskLogger.logInfo(`📝 任务ID: ${taskInstanceId}`);
                TaskLogger.logInfo(`🔗 执行ID: ${executionId}`);
                TaskLogger.logInfo(`⏰ 运行时长: ${Math.floor(elapsedSeconds/60)}分${elapsedSeconds%60}秒`);
                
                // 滚动到底部
                logContainer.scrollTop = logContainer.scrollHeight;
                
                console.log('✅ 日志系统已初始化');
            }).catch(error => {
                console.error('❌ 加载日志系统失败:', error);
            });
        }
        
        console.log('🎉 任务UI强制恢复完成');
    }, 200);
}

// 绑定到全局作用域
if (typeof window !== 'undefined') {
    window.debugTaskRestore = debugTaskRestore;
    window.simulateTaskRestore = simulateTaskRestore;
    window.checkLogContainer = checkLogContainer;
    window.forceExecutionStage = forceExecutionStage;
    window.quickFixTaskRestore = quickFixTaskRestore;
    window.forceRestoreTaskUI = forceRestoreTaskUI;
    window.checkScriptStatus = checkScriptStatus;
    
    console.log('🔧 任务恢复调试工具已加载');
    console.log('可用命令:');
    console.log('  - debugTaskRestore() : 检查恢复状态');
    console.log('  - checkScriptStatus() : 检查脚本运行状态');
    console.log('  - quickFixTaskRestore() : 快速修复恢复问题');
    console.log('  - forceRestoreTaskUI() : 强制恢复任务UI');
    console.log('  - checkLogContainer() : 检查日志容器');
} 