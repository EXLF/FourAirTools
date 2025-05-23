/**
 * @fileoverview 性能优化工具函数
 * @module utils/performance
 * @description 提供防抖、节流、批量更新等性能优化功能
 */

/**
 * 防抖函数 - 在一定时间内多次触发只执行最后一次
 * @param {Function} func - 要执行的函数
 * @param {number} delay - 延迟时间（毫秒）
 * @param {boolean} immediate - 是否立即执行
 * @returns {Function} 防抖后的函数
 */
export function debounce(func, delay, immediate = false) {
    let timeout;
    let result;
    
    const debounced = function(...args) {
        const context = this;
        const later = function() {
            timeout = null;
            if (!immediate) {
                result = func.apply(context, args);
            }
        };
        
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, delay);
        
        if (callNow) {
            result = func.apply(context, args);
        }
        
        return result;
    };
    
    // 添加取消方法
    debounced.cancel = function() {
        clearTimeout(timeout);
        timeout = null;
    };
    
    return debounced;
}

/**
 * 节流函数 - 在一定时间内只执行一次
 * @param {Function} func - 要执行的函数
 * @param {number} wait - 等待时间（毫秒）
 * @param {Object} options - 配置选项
 * @param {boolean} options.leading - 是否在开始时执行
 * @param {boolean} options.trailing - 是否在结束时执行
 * @returns {Function} 节流后的函数
 */
export function throttle(func, wait, options = {}) {
    let timeout, context, args, result;
    let previous = 0;
    const { leading = true, trailing = true } = options;
    
    const later = function() {
        previous = leading === false ? 0 : Date.now();
        timeout = null;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
    };
    
    const throttled = function() {
        const now = Date.now();
        if (!previous && leading === false) previous = now;
        const remaining = wait - (now - previous);
        context = this;
        args = arguments;
        
        if (remaining <= 0 || remaining > wait) {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
            previous = now;
            result = func.apply(context, args);
            if (!timeout) context = args = null;
        } else if (!timeout && trailing !== false) {
            timeout = setTimeout(later, remaining);
        }
        
        return result;
    };
    
    throttled.cancel = function() {
        clearTimeout(timeout);
        previous = 0;
        timeout = context = args = null;
    };
    
    return throttled;
}

/**
 * 批量更新 - 将多个更新操作合并到一次重绘中
 * @param {Function} updateFn - 更新函数
 * @returns {Function} 批量更新函数
 */
export function batchUpdate(updateFn) {
    let pending = false;
    let updates = [];
    
    return function(...args) {
        updates.push(args);
        
        if (!pending) {
            pending = true;
            requestAnimationFrame(() => {
                const currentUpdates = updates.slice();
                updates = [];
                pending = false;
                
                // 执行所有更新
                currentUpdates.forEach(updateArgs => {
                    updateFn.apply(this, updateArgs);
                });
            });
        }
    };
}

/**
 * 懒加载观察器 - 监视元素进入视口时触发回调
 * @param {Object} options - 配置选项
 * @returns {IntersectionObserver} 观察器实例
 */
export function createLazyLoadObserver(options = {}) {
    const {
        root = null,
        rootMargin = '50px',
        threshold = 0.01,
        onIntersect
    } = options;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                if (onIntersect) {
                    onIntersect(entry.target);
                }
                // 处理后停止观察
                observer.unobserve(entry.target);
            }
        });
    }, {
        root,
        rootMargin,
        threshold
    });
    
    return observer;
}

/**
 * 请求空闲回调 - 在浏览器空闲时执行任务
 * @param {Function} callback - 要执行的回调函数
 * @param {Object} options - 配置选项
 * @returns {number} 任务ID
 */
export function requestIdleCallback(callback, options = {}) {
    if ('requestIdleCallback' in window) {
        return window.requestIdleCallback(callback, options);
    } else {
        // 降级方案
        const timeout = options.timeout || 1;
        const start = Date.now();
        return setTimeout(() => {
            callback({
                didTimeout: false,
                timeRemaining: () => Math.max(0, 50 - (Date.now() - start))
            });
        }, timeout);
    }
}

/**
 * 取消空闲回调
 * @param {number} id - 任务ID
 */
export function cancelIdleCallback(id) {
    if ('cancelIdleCallback' in window) {
        window.cancelIdleCallback(id);
    } else {
        clearTimeout(id);
    }
}

/**
 * 内存缓存类 - 带有大小限制和过期时间的缓存
 */
export class MemoryCache {
    constructor(options = {}) {
        this.maxSize = options.maxSize || 100;
        this.ttl = options.ttl || 5 * 60 * 1000; // 默认5分钟
        this.cache = new Map();
        this.accessOrder = [];
    }
    
    /**
     * 获取缓存值
     * @param {string} key - 缓存键
     * @returns {*} 缓存值
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        
        // 检查是否过期
        if (Date.now() > item.expireAt) {
            this.delete(key);
            return null;
        }
        
        // 更新访问顺序
        this.updateAccessOrder(key);
        return item.value;
    }
    
    /**
     * 设置缓存值
     * @param {string} key - 缓存键
     * @param {*} value - 缓存值
     * @param {number} ttl - 过期时间（毫秒）
     */
    set(key, value, ttl = this.ttl) {
        // 如果已存在，先删除
        if (this.cache.has(key)) {
            this.delete(key);
        }
        
        // 检查容量
        if (this.cache.size >= this.maxSize) {
            // 删除最久未访问的项
            const oldestKey = this.accessOrder[0];
            this.delete(oldestKey);
        }
        
        // 添加新项
        this.cache.set(key, {
            value,
            expireAt: Date.now() + ttl
        });
        this.accessOrder.push(key);
    }
    
    /**
     * 删除缓存项
     * @param {string} key - 缓存键
     */
    delete(key) {
        this.cache.delete(key);
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
    }
    
    /**
     * 清空缓存
     */
    clear() {
        this.cache.clear();
        this.accessOrder = [];
    }
    
    /**
     * 更新访问顺序
     * @param {string} key - 缓存键
     */
    updateAccessOrder(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
            this.accessOrder.push(key);
        }
    }
}

/**
 * 性能监控 - 测量函数执行时间
 * @param {Function} fn - 要监控的函数
 * @param {string} name - 函数名称
 * @returns {Function} 包装后的函数
 */
export function measurePerformance(fn, name = fn.name) {
    return function(...args) {
        const start = performance.now();
        const result = fn.apply(this, args);
        
        // 处理异步函数
        if (result instanceof Promise) {
            return result.finally(() => {
                const duration = performance.now() - start;
                console.log(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
            });
        }
        
        const duration = performance.now() - start;
        console.log(`[Performance] ${name} took ${duration.toFixed(2)}ms`);
        return result;
    };
} 