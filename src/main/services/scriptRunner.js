/**
 * @fileoverview 脚本运行器 - 在子进程中执行用户脚本
 * @module services/scriptRunner
 */

const vm = require('vm');
const fs = require('fs').promises;
const path = require('path');

/**
 * 脚本运行器类
 * 负责在隔离的环境中执行用户脚本
 */
class ScriptRunner {
    constructor() {
        this.isRunning = false;
        this.shouldStop = false;
        this.context = null;
    }

    /**
     * 发送消息到父进程
     * @param {string} type - 消息类型
     * @param {any} data - 消息数据
     */
    sendMessage(type, data) {
        if (process.send) {
            process.send({ type, data });
        }
    }

    /**
     * 发送进度更新
     * @param {number} current - 当前进度
     * @param {number} total - 总数
     * @param {string} [message] - 进度消息
     */
    updateProgress(current, total, message = '') {
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;
        this.sendMessage('progress', {
            current,
            total,
            percent,
            message
        });
    }

    /**
     * 发送日志
     * @param {string} level - 日志级别
     * @param {string} message - 日志内容
     */
    log(level, message) {
        this.sendMessage('log', {
            level,
            message,
            timestamp: Date.now()
        });
    }

    /**
     * 创建脚本执行上下文
     * @param {Object} params - 脚本参数
     * @param {Array} wallets - 钱包列表
     * @returns {Object} VM上下文
     */
    createContext(params, wallets) {
        const self = this;
        
        // 创建安全的全局对象
        const sandbox = {
            // 基础对象
            console: {
                log: (...args) => self.log('info', args.join(' ')),
                error: (...args) => self.log('error', args.join(' ')),
                warn: (...args) => self.log('warn', args.join(' ')),
                info: (...args) => self.log('info', args.join(' '))
            },
            
            // 脚本参数
            params: params,
            wallets: wallets,
            
            // 工具函数
            utils: {
                delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
                random: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
                shuffle: (array) => {
                    const arr = [...array];
                    for (let i = arr.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [arr[i], arr[j]] = [arr[j], arr[i]];
                    }
                    return arr;
                }
            },
            
            // 进度和结果报告
            progress: {
                update: (current, total, message) => self.updateProgress(current, total, message),
                complete: () => self.updateProgress(1, 1, '完成')
            },
            
            result: {
                success: (data) => self.sendMessage('result', { status: 'success', ...data }),
                error: (error) => self.sendMessage('result', { status: 'error', error: error.message || error }),
                info: (data) => self.sendMessage('result', { status: 'info', ...data })
            },
            
            // 检查是否应该停止
            shouldStop: () => self.shouldStop,
            
            // 允许的Node.js模块
            require: (moduleName) => {
                const allowedModules = [
                    'ethers',
                    'axios',
                    'crypto',
                    'querystring',
                    'url',
                    'path'
                ];
                
                if (allowedModules.includes(moduleName)) {
                    return require(moduleName);
                }
                
                throw new Error(`模块 '${moduleName}' 不在允许列表中`);
            },
            
            // 定时器
            setTimeout,
            setInterval,
            clearTimeout,
            clearInterval,
            
            // Promise
            Promise,
            
            // 数学和日期
            Math,
            Date,
            
            // 其他全局对象
            Buffer,
            URL,
            URLSearchParams
        };
        
        // 创建上下文
        return vm.createContext(sandbox);
    }

    /**
     * 执行脚本
     * @param {string} scriptPath - 脚本路径
     * @param {Object} params - 脚本参数
     * @param {Array} wallets - 钱包列表
     */
    async execute(scriptPath, params, wallets) {
        try {
            this.isRunning = true;
            this.shouldStop = false;
            
            // 读取脚本内容
            const scriptContent = await fs.readFile(scriptPath, 'utf-8');
            
            // 创建执行上下文
            this.context = this.createContext(params, wallets);
            
            // 包装脚本为异步函数
            const wrappedScript = `
                (async function() {
                    ${scriptContent}
                })();
            `;
            
            // 编译脚本
            const script = new vm.Script(wrappedScript, {
                filename: path.basename(scriptPath),
                timeout: 30000 // 30秒超时
            });
            
            // 执行脚本
            this.log('info', `开始执行脚本: ${path.basename(scriptPath)}`);
            const result = await script.runInContext(this.context, {
                timeout: 3600000, // 1小时总超时
                breakOnSigint: true
            });
            
            // 脚本执行完成
            this.log('info', '脚本执行完成');
            this.sendMessage('completed', { result });
            
        } catch (error) {
            this.log('error', `脚本执行错误: ${error.message}`);
            this.sendMessage('error', {
                type: 'execution_error',
                message: error.message,
                stack: error.stack
            });
            this.sendMessage('failed', { error: error.message });
            
        } finally {
            this.isRunning = false;
            this.context = null;
        }
    }

    /**
     * 停止脚本执行
     */
    stop() {
        this.shouldStop = true;
        this.log('info', '收到停止信号');
        
        // 如果有正在运行的脚本，尝试中断
        if (this.context && this.isRunning) {
            // 设置停止标志，让脚本自行检查并退出
            // 脚本应该定期检查 shouldStop() 函数
        }
    }
}

// 主程序
const runner = new ScriptRunner();

// 监听父进程消息
process.on('message', async (message) => {
    switch (message.type) {
        case 'execute':
            const { scriptPath, params, wallets } = message;
            await runner.execute(scriptPath, params, wallets);
            break;
            
        case 'stop':
            runner.stop();
            // 给脚本一些时间来清理，然后退出
            setTimeout(() => {
                process.exit(0);
            }, 3000);
            break;
            
        default:
            console.error('Unknown message type:', message.type);
    }
});

// 处理未捕获的错误
process.on('uncaughtException', (error) => {
    runner.sendMessage('error', {
        type: 'uncaught_exception',
        message: error.message,
        stack: error.stack
    });
    runner.sendMessage('failed', { error: error.message });
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    runner.sendMessage('error', {
        type: 'unhandled_rejection',
        message: reason?.message || String(reason),
        stack: reason?.stack
    });
    runner.sendMessage('failed', { error: reason?.message || String(reason) });
    process.exit(1);
});

// 优雅退出
process.on('SIGTERM', () => {
    runner.stop();
    setTimeout(() => {
        process.exit(0);
    }, 3000);
});

process.on('SIGINT', () => {
    runner.stop();
    setTimeout(() => {
        process.exit(0);
    }, 3000);
}); 