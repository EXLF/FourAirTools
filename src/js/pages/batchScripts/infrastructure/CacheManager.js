/**
 * 缓存管理器
 * 提供内存缓存、TTL过期机制和缓存统计
 */

export class CacheManager {
    constructor() {
        this.cache = new Map();
        this.timers = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            clears: 0
        };
        
        // 默认TTL：5分钟
        this.defaultTTL = 5 * 60 * 1000;
        
        // 最大缓存条目数
        this.maxSize = 1000;
        
        console.log('[CacheManager] 初始化完成, 最大缓存:', this.maxSize);
    }

    /**
     * 设置缓存项
     */
    set(key, value, ttl = this.defaultTTL) {
        // 检查缓存大小限制
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            this.evictOldest();
        }

        // 清除现有的定时器
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
        }

        // 存储缓存项
        const cacheItem = {
            value,
            timestamp: Date.now(),
            ttl,
            hits: 0
        };
        
        this.cache.set(key, cacheItem);
        this.stats.sets++;

        // 设置过期定时器
        if (ttl > 0) {
            const timer = setTimeout(() => {
                this.delete(key);
            }, ttl);
            this.timers.set(key, timer);
        }

        console.log(`[CacheManager] 缓存设置: ${key} (TTL: ${ttl}ms)`);
    }

    /**
     * 获取缓存项
     */
    get(key) {
        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            return undefined;
        }

        // 检查是否过期
        if (this.isExpired(item)) {
            this.delete(key);
            this.stats.misses++;
            return undefined;
        }

        // 更新访问统计
        item.hits++;
        this.stats.hits++;
        
        console.log(`[CacheManager] 缓存命中: ${key}`);
        return item.value;
    }

    /**
     * 检查缓存项是否过期
     */
    isExpired(item) {
        if (item.ttl <= 0) return false; // 永不过期
        return Date.now() - item.timestamp > item.ttl;
    }

    /**
     * 删除缓存项
     */
    delete(key) {
        const existed = this.cache.delete(key);
        
        if (this.timers.has(key)) {
            clearTimeout(this.timers.get(key));
            this.timers.delete(key);
        }
        
        if (existed) {
            this.stats.deletes++;
            console.log(`[CacheManager] 缓存删除: ${key}`);
        }
        
        return existed;
    }

    /**
     * 按模式清除缓存
     */
    clear(pattern = null) {
        let deletedCount = 0;
        
        if (pattern === null) {
            // 清除所有缓存
            deletedCount = this.cache.size;
            this.cache.clear();
            this.timers.forEach(timer => clearTimeout(timer));
            this.timers.clear();
        } else {
            // 按模式清除
            const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
            
            for (const key of this.cache.keys()) {
                if (regex.test(key)) {
                    this.delete(key);
                    deletedCount++;
                }
            }
        }
        
        this.stats.clears++;
        console.log(`[CacheManager] 清除缓存: ${deletedCount} 项`);
        return deletedCount;
    }

    /**
     * 清除所有缓存
     */
    clearAll() {
        return this.clear();
    }

    /**
     * 淘汰最旧的缓存项
     */
    evictOldest() {
        let oldestKey = null;
        let oldestTimestamp = Infinity;
        
        for (const [key, item] of this.cache.entries()) {
            if (item.timestamp < oldestTimestamp) {
                oldestTimestamp = item.timestamp;
                oldestKey = key;
            }
        }
        
        if (oldestKey) {
            this.delete(oldestKey);
            console.log(`[CacheManager] 淘汰最旧缓存: ${oldestKey}`);
        }
    }

    /**
     * 获取缓存统计信息
     */
    getStats() {
        const totalRequests = this.stats.hits + this.stats.misses;
        const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests * 100).toFixed(2) : 0;
        
        return {
            ...this.stats,
            totalRequests,
            hitRate: `${hitRate}%`,
            cacheSize: this.cache.size,
            maxSize: this.maxSize
        };
    }
} 