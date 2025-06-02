/**
 * 核心管理器功能测试脚本
 * 在浏览器控制台中运行此脚本来验证重构效果
 */

// 测试脚本 - 在浏览器控制台中执行
function testCoreManagers() {
    console.log('🔧 开始测试核心管理器...');
    
    // 检查核心管理器是否已初始化
    if (typeof window.__FA_CoreManagers === 'undefined') {
        console.error('❌ 核心管理器未初始化');
        return false;
    }
    
    const managers = window.__FA_CoreManagers;
    console.log('✅ 核心管理器已初始化:', managers);
    
    // 测试 ScriptManager
    console.log('\n📜 测试 ScriptManager...');
    if (managers.scriptManager) {
        console.log('✅ ScriptManager 可用');
        console.log('   统计信息:', managers.scriptManager.getStats());
        
        // 测试脚本加载
        managers.scriptManager.getAvailableScripts()
            .then(scripts => {
                console.log(`✅ 成功加载 ${scripts.length} 个脚本`);
                scripts.forEach(script => {
                    console.log(`   - ${script.name} (${script.id})`);
                });
            })
            .catch(error => {
                console.log('⚠️  脚本加载使用回退机制:', error.message);
            });
    } else {
        console.error('❌ ScriptManager 不可用');
    }
    
    // 测试 TaskStateManager
    console.log('\n📊 测试 TaskStateManager...');
    if (managers.taskStateManager) {
        console.log('✅ TaskStateManager 可用');
        console.log('   统计信息:', managers.taskStateManager.getStats());
        
        // 测试状态管理
        const testTaskId = 'test_task_' + Date.now();
        const success = managers.taskStateManager.setState(testTaskId, 'pending', {
            testRun: true
        });
        console.log(`   测试状态设置: ${success ? '✅' : '❌'}`);
        
        if (success) {
            const state = managers.taskStateManager.getState(testTaskId);
            console.log('   测试状态获取:', state);
            
            // 清理测试状态
            managers.taskStateManager.removeTask(testTaskId);
        }
    } else {
        console.error('❌ TaskStateManager 不可用');
    }
    
    // 测试 ExecutionEngine
    console.log('\n⚙️ 测试 ExecutionEngine...');
    if (managers.executionEngine) {
        console.log('✅ ExecutionEngine 可用');
        console.log('   统计信息:', managers.executionEngine.getStats());
        console.log('   队列状态:', managers.executionEngine.getQueueStatus());
    } else {
        console.error('❌ ExecutionEngine 不可用');
    }
    
    // 测试 LogManager
    console.log('\n📝 测试 LogManager...');
    if (managers.logManager) {
        console.log('✅ LogManager 可用');
        console.log('   统计信息:', managers.logManager.getLogStats());
        console.log('   内存使用:', managers.logManager.getMemoryUsage());
        
        // 测试日志添加
        const testExecutionId = 'test_exec_' + Date.now();
        managers.logManager.addLog(testExecutionId, 'info', '测试日志消息', {
            testRun: true
        });
        
        const logs = managers.logManager.getLogs(testExecutionId);
        console.log(`   测试日志: ${logs.length > 0 ? '✅' : '❌'}`);
        
        if (logs.length > 0) {
            console.log('   日志内容:', logs[0]);
            // 清理测试日志
            managers.logManager.clearLogs(testExecutionId);
        }
    } else {
        console.error('❌ LogManager 不可用');
    }
    
    console.log('\n🎉 核心管理器测试完成！');
    return true;
}

// 测试跨模块通信
function testCrossModuleCommunication() {
    console.log('\n🔗 测试跨模块通信...');
    
    const managers = window.__FA_CoreManagers;
    if (!managers) {
        console.error('❌ 核心管理器不可用');
        return;
    }
    
    const testTaskId = 'comm_test_' + Date.now();
    
    // 订阅状态变更事件
    const unsubscribe = managers.taskStateManager.subscribe((taskId, stateData) => {
        if (taskId === testTaskId) {
            console.log('✅ 状态变更事件触发:', taskId, stateData.state);
            
            // 应该自动在日志中记录状态变更
            setTimeout(() => {
                const logs = managers.logManager.getLogs(taskId);
                const stateChangeLogs = logs.filter(log => log.metadata?.stateTransition);
                console.log(`✅ 状态变更日志: ${stateChangeLogs.length} 条`);
                
                // 清理
                managers.taskStateManager.removeTask(testTaskId);
                managers.logManager.clearLogs(testTaskId);
                unsubscribe();
            }, 100);
        }
    });
    
    // 触发状态变更
    managers.taskStateManager.setState(testTaskId, 'pending');
    managers.taskStateManager.setState(testTaskId, 'running');
    managers.taskStateManager.setState(testTaskId, 'completed');
}

// 自动运行测试（如果在浏览器环境中）
if (typeof window !== 'undefined') {
    // 等待页面加载完成后运行测试
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                testCoreManagers();
                testCrossModuleCommunication();
            }, 2000); // 等待2秒确保所有模块都已初始化
        });
    } else {
        setTimeout(() => {
            testCoreManagers();
            testCrossModuleCommunication();
        }, 2000);
    }
}

// 导出测试函数供手动调用
if (typeof window !== 'undefined') {
    window.testCoreManagers = testCoreManagers;
    window.testCrossModuleCommunication = testCrossModuleCommunication;
}

console.log('📋 核心管理器测试脚本已加载');
console.log('   手动运行: testCoreManagers()');
console.log('   跨模块通信测试: testCrossModuleCommunication()'); 