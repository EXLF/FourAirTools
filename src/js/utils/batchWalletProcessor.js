/**
 * @fileoverview 多钱包批量处理工具
 * @module utils/batchWalletProcessor
 * @description 提供多钱包批量处理功能，支持并发控制、错误重试、进度跟踪等
 */

/**
 * @typedef {Object} WalletTask
 * @property {Object} wallet - 钱包信息
 * @property {Function} task - 要执行的任务函数
 * @property {number} retries - 重试次数
 * @property {Object} result - 执行结果
 */

/**
 * @typedef {Object} ProcessOptions
 * @property {number} concurrency - 并发数量
 * @property {number} maxRetries - 最大重试次数
 * @property {number} retryDelay - 重试延迟（毫秒）
 * @property {Function} onProgress - 进度回调
 * @property {Function} onError - 错误回调
 * @property {Function} onComplete - 完成回调
 * @property {boolean} stopOnError - 是否在错误时停止
 */

/**
 * 批量钱包处理器类
 */
export class BatchWalletProcessor {
    constructor(options = {}) {
        this.options = {
            concurrency: 3,
            maxRetries: 3,
            retryDelay: 1000,
            stopOnError: false,
            ...options
        };
        
        this.queue = [];
        this.activeCount = 0;
        this.results = new Map();
        this.errors = new Map();
        this.isRunning = false;
        this.isPaused = false;
        this.abortController = null;
    }
    
    /**
     * 添加钱包任务
     * @param {Object|Array} wallets - 钱包或钱包数组
     * @param {Function} taskFunction - 任务函数
     */
    addTask(wallets, taskFunction) {
        const walletArray = Array.isArray(wallets) ? wallets : [wallets];
        
        walletArray.forEach(wallet => {
            this.queue.push({
                wallet,
                task: taskFunction,
                retries: 0,
                id: wallet.id || wallet.address
            });
        });
    }
    
    /**
     * 开始处理
     * @returns {Promise<Object>} 处理结果
     */
    async start() {
        if (this.isRunning) {
            throw new Error('处理器已在运行中');
        }
        
        this.isRunning = true;
        this.isPaused = false;
        this.abortController = new AbortController();
        
        const startTime = Date.now();
        const totalTasks = this.queue.length;
        
        try {
            await this.processQueue();
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            return {
                success: true,
                totalTasks,
                successCount: this.results.size,
                errorCount: this.errors.size,
                duration,
                results: Object.fromEntries(this.results),
                errors: Object.fromEntries(this.errors)
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                totalTasks,
                successCount: this.results.size,
                errorCount: this.errors.size,
                results: Object.fromEntries(this.results),
                errors: Object.fromEntries(this.errors)
            };
        } finally {
            this.isRunning = false;
            this.abortController = null;
        }
    }
    
    /**
     * 暂停处理
     */
    pause() {
        this.isPaused = true;
    }
    
    /**
     * 恢复处理
     */
    resume() {
        this.isPaused = false;
    }
    
    /**
     * 停止处理
     */
    stop() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isRunning = false;
        this.isPaused = false;
    }
    
    /**
     * 处理队列
     */
    async processQueue() {
        const promises = [];
        
        while (this.queue.length > 0 || this.activeCount > 0) {
            // 检查是否暂停
            if (this.isPaused) {
                await this.waitForResume();
            }
            
            // 检查是否停止
            if (this.abortController?.signal.aborted) {
                throw new Error('处理已停止');
            }
            
            // 控制并发
            while (this.activeCount < this.options.concurrency && this.queue.length > 0) {
                const task = this.queue.shift();
                promises.push(this.processTask(task));
            }
            
            // 等待任务完成
            if (promises.length > 0) {
                await Promise.race(promises);
                promises.splice(0, promises.findIndex(p => p.isResolved));
            }
        }
        
        // 等待所有任务完成
        await Promise.all(promises);
    }
    
    /**
     * 处理单个任务
     * @param {WalletTask} task - 任务对象
     */
    async processTask(task) {
        this.activeCount++;
        
        try {
            // 执行任务
            const result = await this.executeWithRetry(task);
            
            // 保存结果
            this.results.set(task.id, {
                wallet: task.wallet,
                result,
                timestamp: Date.now()
            });
            
            // 触发进度回调
            this.triggerProgress(task, 'success', result);
            
        } catch (error) {
            // 保存错误
            this.errors.set(task.id, {
                wallet: task.wallet,
                error: error.message,
                timestamp: Date.now()
            });
            
            // 触发错误回调
            this.triggerError(task, error);
            
            // 检查是否停止
            if (this.options.stopOnError) {
                this.stop();
                throw error;
            }
        } finally {
            this.activeCount--;
        }
    }
    
    /**
     * 执行任务（带重试）
     * @param {WalletTask} task - 任务对象
     */
    async executeWithRetry(task) {
        let lastError;
        
        for (let i = 0; i <= this.options.maxRetries; i++) {
            try {
                // 检查是否停止
                if (this.abortController?.signal.aborted) {
                    throw new Error('任务已取消');
                }
                
                // 执行任务
                const result = await task.task(task.wallet, {
                    attempt: i + 1,
                    maxRetries: this.options.maxRetries,
                    signal: this.abortController?.signal
                });
                
                return result;
                
            } catch (error) {
                lastError = error;
                task.retries = i + 1;
                
                // 如果是最后一次尝试，抛出错误
                if (i === this.options.maxRetries) {
                    throw error;
                }
                
                // 等待后重试
                await this.delay(this.options.retryDelay * (i + 1));
            }
        }
        
        throw lastError;
    }
    
    /**
     * 等待恢复
     */
    async waitForResume() {
        while (this.isPaused && !this.abortController?.signal.aborted) {
            await this.delay(100);
        }
    }
    
    /**
     * 延迟
     * @param {number} ms - 毫秒数
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * 触发进度回调
     */
    triggerProgress(task, status, result) {
        if (this.options.onProgress) {
            const progress = {
                current: this.results.size + this.errors.size,
                total: this.queue.length + this.activeCount + this.results.size + this.errors.size,
                wallet: task.wallet,
                status,
                result
            };
            
            this.options.onProgress(progress);
        }
    }
    
    /**
     * 触发错误回调
     */
    triggerError(task, error) {
        if (this.options.onError) {
            this.options.onError({
                wallet: task.wallet,
                error,
                retries: task.retries
            });
        }
    }
    
    /**
     * 获取当前状态
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            queueLength: this.queue.length,
            activeCount: this.activeCount,
            successCount: this.results.size,
            errorCount: this.errors.size,
            progress: this.getProgress()
        };
    }
    
    /**
     * 获取进度百分比
     */
    getProgress() {
        const total = this.queue.length + this.activeCount + this.results.size + this.errors.size;
        if (total === 0) return 100;
        
        const completed = this.results.size + this.errors.size;
        return Math.round((completed / total) * 100);
    }
}

/**
 * 创建批量处理器的便捷函数
 * @param {Array} wallets - 钱包数组
 * @param {Function} taskFunction - 任务函数
 * @param {ProcessOptions} options - 处理选项
 * @returns {Promise<Object>} 处理结果
 */
export async function processBatchWallets(wallets, taskFunction, options = {}) {
    const processor = new BatchWalletProcessor(options);
    processor.addTask(wallets, taskFunction);
    return await processor.start();
}

/**
 * 创建带进度显示的批量处理器
 * @param {Array} wallets - 钱包数组
 * @param {Function} taskFunction - 任务函数
 * @param {Object} options - 处理选项
 * @returns {BatchWalletProcessor} 处理器实例
 */
export function createProgressProcessor(wallets, taskFunction, options = {}) {
    const processor = new BatchWalletProcessor({
        ...options,
        onProgress: (progress) => {
            const percentage = Math.round((progress.current / progress.total) * 100);
            console.log(`[批量处理] 进度: ${progress.current}/${progress.total} (${percentage}%) - ${progress.wallet.address}`);
        },
        onError: (error) => {
            console.error(`[批量处理] 错误: ${error.wallet.address} - ${error.error.message} (重试: ${error.retries})`);
        }
    });
    
    processor.addTask(wallets, taskFunction);
    return processor;
}

/**
 * 批量转账示例
 * @param {Array} wallets - 钱包数组
 * @param {string} toAddress - 接收地址
 * @param {string} amount - 转账金额
 * @param {Object} options - 选项
 */
export async function batchTransfer(wallets, toAddress, amount, options = {}) {
    const taskFunction = async (wallet, taskOptions) => {
        // 这里实现具体的转账逻辑
        console.log(`[转账] 从 ${wallet.address} 转账 ${amount} 到 ${toAddress}`);
        
        // 模拟转账操作
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 返回交易哈希
        return {
            txHash: '0x' + Math.random().toString(16).substr(2, 64),
            from: wallet.address,
            to: toAddress,
            amount
        };
    };
    
    return await processBatchWallets(wallets, taskFunction, {
        concurrency: 5,
        maxRetries: 3,
        ...options
    });
} 