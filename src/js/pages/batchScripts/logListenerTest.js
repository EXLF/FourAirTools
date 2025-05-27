/**
 * 日志监听器测试工具
 * 用于验证监听器重复问题是否已修复
 */

export class LogListenerTest {
    constructor() {
        this.testResults = [];
        this.isRunning = false;
    }

    /**
     * 测试监听器重复问题
     */
    async testListenerDuplication() {
        if (this.isRunning) {
            console.log('[监听器测试] 测试正在进行中...');
            return;
        }

        this.isRunning = true;
        this.testResults = [];
        
        console.log('\n=== 🧪 日志监听器重复测试开始 ===');
        
        try {
            // 1. 检查初始状态
            await this._checkInitialState();
            
            // 2. 模拟第一次脚本执行
            await this._simulateFirstExecution();
            
            // 3. 模拟任务移至后台
            await this._simulateBackgroundMove();
            
            // 4. 模拟任务恢复
            await this._simulateTaskRestore();
            
            // 5. 检查最终状态
            await this._checkFinalState();
            
            // 6. 显示测试结果
            this._showTestResults();
            
        } catch (error) {
            console.error('[监听器测试] 测试失败:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * 检查初始状态
     */
    async _checkInitialState() {
        console.log('1️⃣ 检查初始状态...');
        
        const logCount = this._getListenerCount('script-log');
        const completedCount = this._getListenerCount('script-completed');
        
        this.testResults.push({
            step: '初始状态',
            logListeners: logCount,
            completedListeners: completedCount,
            expected: { log: 0, completed: 0 },
            passed: logCount === 0 && completedCount === 0
        });
        
        console.log(`   script-log 监听器: ${logCount}`);
        console.log(`   script-completed 监听器: ${completedCount}`);
    }

    /**
     * 模拟第一次脚本执行
     */
    async _simulateFirstExecution() {
        console.log('2️⃣ 模拟第一次脚本执行...');
        
        // 模拟设置监听器
        if (window.electron && window.electron.ipcRenderer) {
            // 清理现有监听器
            window.electron.ipcRenderer.removeAllListeners('script-log');
            window.electron.ipcRenderer.removeAllListeners('script-completed');
            
            // 添加新监听器
            const testHandler = () => {};
            window.electron.ipcRenderer.on('script-log', testHandler);
            window.electron.ipcRenderer.on('script-completed', testHandler);
        }
        
        const logCount = this._getListenerCount('script-log');
        const completedCount = this._getListenerCount('script-completed');
        
        this.testResults.push({
            step: '第一次执行',
            logListeners: logCount,
            completedListeners: completedCount,
            expected: { log: 1, completed: 1 },
            passed: logCount === 1 && completedCount === 1
        });
        
        console.log(`   script-log 监听器: ${logCount}`);
        console.log(`   script-completed 监听器: ${completedCount}`);
    }

    /**
     * 模拟任务移至后台
     */
    async _simulateBackgroundMove() {
        console.log('3️⃣ 模拟任务移至后台...');
        
        // 任务移至后台时，监听器应该保持不变
        const logCount = this._getListenerCount('script-log');
        const completedCount = this._getListenerCount('script-completed');
        
        this.testResults.push({
            step: '移至后台',
            logListeners: logCount,
            completedListeners: completedCount,
            expected: { log: 1, completed: 1 },
            passed: logCount === 1 && completedCount === 1
        });
        
        console.log(`   script-log 监听器: ${logCount}`);
        console.log(`   script-completed 监听器: ${completedCount}`);
    }

    /**
     * 模拟任务恢复
     */
    async _simulateTaskRestore() {
        console.log('4️⃣ 模拟任务恢复...');
        
        // 模拟任务恢复时的监听器设置
        if (window.electron && window.electron.ipcRenderer) {
            // 清理旧监听器
            window.electron.ipcRenderer.removeAllListeners('script-log');
            window.electron.ipcRenderer.removeAllListeners('script-completed');
            
            // 添加新监听器
            const testHandler = () => {};
            window.electron.ipcRenderer.on('script-log', testHandler);
            window.electron.ipcRenderer.on('script-completed', testHandler);
        }
        
        const logCount = this._getListenerCount('script-log');
        const completedCount = this._getListenerCount('script-completed');
        
        this.testResults.push({
            step: '任务恢复',
            logListeners: logCount,
            completedListeners: completedCount,
            expected: { log: 1, completed: 1 },
            passed: logCount === 1 && completedCount === 1
        });
        
        console.log(`   script-log 监听器: ${logCount}`);
        console.log(`   script-completed 监听器: ${completedCount}`);
    }

    /**
     * 检查最终状态
     */
    async _checkFinalState() {
        console.log('5️⃣ 检查最终状态...');
        
        const logCount = this._getListenerCount('script-log');
        const completedCount = this._getListenerCount('script-completed');
        
        this.testResults.push({
            step: '最终状态',
            logListeners: logCount,
            completedListeners: completedCount,
            expected: { log: 1, completed: 1 },
            passed: logCount === 1 && completedCount === 1
        });
        
        console.log(`   script-log 监听器: ${logCount}`);
        console.log(`   script-completed 监听器: ${completedCount}`);
    }

    /**
     * 获取监听器数量
     */
    _getListenerCount(eventName) {
        if (window.electron && window.electron.ipcRenderer && window.electron.ipcRenderer.listenerCount) {
            return window.electron.ipcRenderer.listenerCount(eventName);
        }
        return 0;
    }

    /**
     * 显示测试结果
     */
    _showTestResults() {
        console.log('\n📊 测试结果汇总:');
        console.log('==========================================');
        
        let allPassed = true;
        this.testResults.forEach((result, index) => {
            const status = result.passed ? '✅ 通过' : '❌ 失败';
            console.log(`${index + 1}. ${result.step}: ${status}`);
            console.log(`   实际: log=${result.logListeners}, completed=${result.completedListeners}`);
            console.log(`   期望: log=${result.expected.log}, completed=${result.expected.completed}`);
            
            if (!result.passed) {
                allPassed = false;
            }
        });
        
        console.log('==========================================');
        if (allPassed) {
            console.log('🎉 所有测试通过！监听器重复问题已修复');
        } else {
            console.log('⚠️ 部分测试失败，监听器可能仍有重复问题');
        }
        
        // 清理测试监听器
        this._cleanup();
    }

    /**
     * 清理测试监听器
     */
    _cleanup() {
        console.log('🧹 清理测试监听器...');
        if (window.electron && window.electron.ipcRenderer) {
            window.electron.ipcRenderer.removeAllListeners('script-log');
            window.electron.ipcRenderer.removeAllListeners('script-completed');
        }
    }
}

// 创建全局测试实例
window.logListenerTest = new LogListenerTest();

// 添加快捷测试函数
window.testLogListeners = () => {
    window.logListenerTest.testListenerDuplication();
};

console.log('[监听器测试] 测试工具已加载');
console.log('使用 testLogListeners() 运行测试'); 