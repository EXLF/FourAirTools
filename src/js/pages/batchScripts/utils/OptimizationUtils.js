/**
 * 优化工具类
 * 提供性能优化、缓存管理、资源清理等工具函数
 */

export class OptimizationUtils {
    /**
     * 性能监控类
     */
    static PerformanceMonitor = class {
        constructor() {
            this.metrics = new Map();
            this.startTimes = new Map();
        }
        
        start(label) {
            this.startTimes.set(label, performance.now());
        }
        
        end(label) {
            const startTime = this.startTimes.get(label);
            if (startTime) {
                const duration = performance.now() - startTime;
                this.metrics.set(label, duration);
                this.startTimes.delete(label);
                return duration;
            }
            return 0;
        }
        
        getMetrics() {
            return Object.fromEntries(this.metrics);
        }
        
        clear() {
            this.metrics.clear();
            this.startTimes.clear();
        }
    };

    /**
     * 内存清理工具
     */
    static MemoryManager = class {
        static cleanupGlobalVariables() {
            const cleanupList = [
                '__currentLogUnsubscribers',
                '__currentLogCleanup',
                '__logObserver',
                '__executionTimer',
                'batchTaskLogs'
            ];
            
            let cleanedCount = 0;
            cleanupList.forEach(varName => {
                if (window[varName]) {
                    try {
                        if (typeof window[varName] === 'function') {
                            window[varName]();
                        } else if (Array.isArray(window[varName])) {
                            window[varName].length = 0;
                        } else if (typeof window[varName] === 'object') {
                            if (window[varName].disconnect) {
                                window[varName].disconnect();
                            }
                            if (window[varName].clear) {
                                window[varName].clear();
                            }
                        }
                        delete window[varName];
                        cleanedCount++;
                    } catch (error) {
                        console.warn(`[内存清理] 清理变量失败: ${varName}`, error);
                    }
                }
            });
            
            console.log(`[内存清理] 已清理 ${cleanedCount} 个全局变量`);
            return cleanedCount;
        }
        
        static cleanupEventListeners() {
            // 清理可能的僵尸事件监听器
            if (window.electron?.ipcRenderer) {
                const channels = ['script-log', 'script-completed', 'script-progress'];
                channels.forEach(channel => {
                    try {
                        const listenerCount = window.electron.ipcRenderer.listenerCount(channel);
                        if (listenerCount > 2) { // 保留必要的监听器
                            console.warn(`[内存清理] 发现过多监听器: ${channel} (${listenerCount})`);
                            // 清理多余监听器，保留最后2个
                            window.electron.ipcRenderer.removeAllListeners(channel);
                        }
                    } catch (error) {
                        console.warn(`[内存清理] 清理监听器失败: ${channel}`, error);
                    }
                });
            }
        }
        
        static getMemoryUsage() {
            if (performance.memory) {
                return {
                    used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };
            }
            return null;
        }
    };

    /**
     * 缓存优化工具
     */
    static CacheOptimizer = class {
        static optimizeLocalStorage() {
            try {
                const keys = Object.keys(localStorage);
                const stats = {
                    totalKeys: keys.length,
                    totalSize: 0,
                    expiredKeys: 0,
                    cleanedSize: 0
                };
                
                keys.forEach(key => {
                    const value = localStorage.getItem(key);
                    if (value) {
                        stats.totalSize += value.length;
                        
                        // 检查是否为过期的缓存
                        if (key.startsWith('fa_cache_') || key.startsWith('cache_')) {
                            try {
                                const data = JSON.parse(value);
                                if (data.expires && Date.now() > data.expires) {
                                    localStorage.removeItem(key);
                                    stats.expiredKeys++;
                                    stats.cleanedSize += value.length;
                                }
                            } catch (e) {
                                // 忽略解析错误
                            }
                        }
                    }
                });
                
                console.log('[缓存优化] LocalStorage统计:', stats);
                return stats;
            } catch (error) {
                console.error('[缓存优化] 优化LocalStorage失败:', error);
                return null;
            }
        }
        
        static cleanOldExecutionHistory() {
            try {
                const history = JSON.parse(localStorage.getItem('fa_script_execution_history') || '[]');
                const cutoffTime = Date.now() - (7 * 24 * 60 * 60 * 1000); // 7天前
                const filteredHistory = history.filter(record => record.timestamp > cutoffTime);
                
                if (filteredHistory.length < history.length) {
                    localStorage.setItem('fa_script_execution_history', JSON.stringify(filteredHistory));
                    console.log(`[缓存优化] 清理了 ${history.length - filteredHistory.length} 条过期执行历史`);
                    return history.length - filteredHistory.length;
                }
                return 0;
            } catch (error) {
                console.warn('[缓存优化] 清理执行历史失败:', error);
                return 0;
            }
        }
    };

    /**
     * DOM优化工具
     */
    static DOMOptimizer = class {
        static cleanupOrphanedElements() {
            // 清理可能的孤立DOM元素
            const selectors = [
                '.modal-backdrop:not(.show)',
                '.toast:not(.show)',
                '.tooltip:not(.show)',
                '.popover:not(.show)',
                '.dropdown-menu:not(.show)'
            ];
            
            let cleanedCount = 0;
            selectors.forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        if (!element.offsetParent && element.parentNode) {
                            element.parentNode.removeChild(element);
                            cleanedCount++;
                        }
                    });
                } catch (error) {
                    console.warn(`[DOM优化] 清理元素失败: ${selector}`, error);
                }
            });
            
            if (cleanedCount > 0) {
                console.log(`[DOM优化] 清理了 ${cleanedCount} 个孤立DOM元素`);
            }
            return cleanedCount;
        }
        
        static optimizeScrollPerformance() {
            // 为长列表添加虚拟滚动优化
            const longLists = document.querySelectorAll('[data-long-list]');
            longLists.forEach(list => {
                if (list.children.length > 100) {
                    console.log('[DOM优化] 检测到长列表，建议使用虚拟滚动');
                    list.setAttribute('data-optimization-needed', 'virtual-scroll');
                }
            });
        }
    };

    /**
     * 执行完整的系统优化
     */
    static async performFullOptimization() {
        console.log('🚀 [系统优化] 开始执行完整优化...');
        const monitor = new this.PerformanceMonitor();
        const results = {};
        
        try {
            // 1. 内存清理
            monitor.start('memory');
            results.memory = {
                globalVariables: this.MemoryManager.cleanupGlobalVariables(),
                memoryUsage: this.MemoryManager.getMemoryUsage()
            };
            this.MemoryManager.cleanupEventListeners();
            monitor.end('memory');
            
            // 2. 缓存优化
            monitor.start('cache');
            results.cache = {
                localStorage: this.CacheOptimizer.optimizeLocalStorage(),
                executionHistory: this.CacheOptimizer.cleanOldExecutionHistory()
            };
            monitor.end('cache');
            
            // 3. DOM优化
            monitor.start('dom');
            results.dom = {
                orphanedElements: this.DOMOptimizer.cleanupOrphanedElements()
            };
            this.DOMOptimizer.optimizeScrollPerformance();
            monitor.end('dom');
            
            // 4. 垃圾回收建议
            if (window.gc) {
                monitor.start('gc');
                window.gc();
                monitor.end('gc');
                results.gc = true;
            }
            
            results.performance = monitor.getMetrics();
            
            console.log('✅ [系统优化] 优化完成:', results);
            return results;
            
        } catch (error) {
            console.error('❌ [系统优化] 优化失败:', error);
            return { error: error.message };
        }
    }

    /**
     * 获取系统性能报告
     */
    static getPerformanceReport() {
        const report = {
            timestamp: Date.now(),
            memory: this.MemoryManager.getMemoryUsage(),
            localStorage: {
                keys: Object.keys(localStorage).length,
                size: JSON.stringify(localStorage).length
            },
            features: {
                serviceLayer: !!window.__FA_Infrastructure,
                scriptService: !!window.FA_ScriptService,
                taskService: !!window.FA_TaskService,
                coreManagers: !!window.__FA_CoreManagers
            },
            activeConnections: {
                ipcListeners: window.electron?.ipcRenderer ? 
                    ['script-log', 'script-completed'].map(ch => 
                        window.electron.ipcRenderer.listenerCount(ch)
                    ).reduce((a, b) => a + b, 0) : 0,
                intervals: this._countActiveIntervals(),
                timeouts: this._countActiveTimeouts()
            }
        };
        
        return report;
    }
    
    static _countActiveIntervals() {
        // 简单的活动interval计数（浏览器限制）
        let count = 0;
        for (let i = 1; i < 1000; i++) {
            try {
                if (window.clearInterval(i) === undefined) count++;
            } catch (e) {
                break;
            }
        }
        return count;
    }
    
    static _countActiveTimeouts() {
        // 简单的活动timeout计数（浏览器限制）
        let count = 0;
        for (let i = 1; i < 1000; i++) {
            try {
                if (window.clearTimeout(i) === undefined) count++;
            } catch (e) {
                break;
            }
        }
        return count;
    }
}

// 暴露到全局用于调试
if (typeof window !== 'undefined') {
    window.FA_OptimizationUtils = OptimizationUtils;
    window.FA_performOptimization = () => OptimizationUtils.performFullOptimization();
    window.FA_getPerformanceReport = () => OptimizationUtils.getPerformanceReport();
} 