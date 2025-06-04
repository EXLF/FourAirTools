/**
 * 凭据管理器
 * 安全地管理API密钥、令牌等敏感信息
 */

export class CredentialManager {
    constructor() {
        this.credentials = new Map();
        this.encryptionKey = this.generateEncryptionKey();
        this.accessLog = [];
        
        // 配置
        this.config = {
            maxLogEntries: 1000,
            credentialExpiration: 24 * 60 * 60 * 1000, // 24小时
            autoCleanupInterval: 60 * 60 * 1000,       // 1小时清理一次
            enableAccessLogging: true
        };
        
        // 启动自动清理
        this.startAutoCleanup();
        
        console.log('[CredentialManager] 凭据管理器已初始化');
    }

    /**
     * 生成加密密钥
     */
    generateEncryptionKey() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 简单加密（用于演示，生产环境应使用更强的加密）
     */
    encrypt(text) {
        const textBytes = new TextEncoder().encode(text);
        const keyBytes = new TextEncoder().encode(this.encryptionKey.substring(0, 16));
        
        const encrypted = new Uint8Array(textBytes.length);
        for (let i = 0; i < textBytes.length; i++) {
            encrypted[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
        }
        
        return btoa(String.fromCharCode(...encrypted));
    }

    /**
     * 简单解密
     */
    decrypt(encryptedText) {
        try {
            const encrypted = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)));
            const keyBytes = new TextEncoder().encode(this.encryptionKey.substring(0, 16));
            
            const decrypted = new Uint8Array(encrypted.length);
            for (let i = 0; i < encrypted.length; i++) {
                decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
            }
            
            return new TextDecoder().decode(decrypted);
        } catch (error) {
            console.error('[CredentialManager] 解密失败:', error);
            return null;
        }
    }

    /**
     * 存储凭据
     */
    store(key, value, options = {}) {
        try {
            if (!key || !value) {
                throw new Error('密钥和值不能为空');
            }
            
            const credential = {
                key: key,
                value: this.encrypt(value),
                type: options.type || 'generic',
                description: options.description || '',
                createdAt: Date.now(),
                lastAccessedAt: Date.now(),
                expiresAt: options.expiresAt || (Date.now() + this.config.credentialExpiration),
                accessCount: 0,
                metadata: options.metadata || {}
            };
            
            this.credentials.set(key, credential);
            
            this.logAccess('store', key, {
                type: credential.type,
                description: credential.description
            });
            
            console.log(`[CredentialManager] 凭据已存储: ${key} (${credential.type})`);
            return true;
            
        } catch (error) {
            console.error('[CredentialManager] 存储凭据失败:', error);
            return false;
        }
    }

    /**
     * 获取凭据
     */
    get(key) {
        try {
            const credential = this.credentials.get(key);
            
            if (!credential) {
                this.logAccess('get_not_found', key);
                return null;
            }
            
            // 检查是否过期
            if (Date.now() > credential.expiresAt) {
                this.credentials.delete(key);
                this.logAccess('get_expired', key);
                console.warn(`[CredentialManager] 凭据已过期并被删除: ${key}`);
                return null;
            }
            
            // 更新访问信息
            credential.lastAccessedAt = Date.now();
            credential.accessCount++;
            
            this.logAccess('get_success', key, {
                accessCount: credential.accessCount
            });
            
            return this.decrypt(credential.value);
            
        } catch (error) {
            console.error('[CredentialManager] 获取凭据失败:', error);
            this.logAccess('get_error', key, { error: error.message });
            return null;
        }
    }

    /**
     * 删除凭据
     */
    delete(key) {
        try {
            const existed = this.credentials.has(key);
            if (existed) {
                this.credentials.delete(key);
                this.logAccess('delete', key);
                console.log(`[CredentialManager] 凭据已删除: ${key}`);
            }
            return existed;
        } catch (error) {
            console.error('[CredentialManager] 删除凭据失败:', error);
            return false;
        }
    }

    /**
     * 检查凭据是否存在
     */
    has(key) {
        const credential = this.credentials.get(key);
        if (!credential) return false;
        
        // 检查是否过期
        if (Date.now() > credential.expiresAt) {
            this.credentials.delete(key);
            return false;
        }
        
        return true;
    }

    /**
     * 获取凭据元数据
     */
    getMetadata(key) {
        const credential = this.credentials.get(key);
        if (!credential) return null;
        
        return {
            key: credential.key,
            type: credential.type,
            description: credential.description,
            createdAt: credential.createdAt,
            lastAccessedAt: credential.lastAccessedAt,
            expiresAt: credential.expiresAt,
            accessCount: credential.accessCount,
            metadata: credential.metadata
        };
    }

    /**
     * 列出所有凭据（不包含值）
     */
    list() {
        const list = [];
        
        for (const [key, credential] of this.credentials) {
            // 检查是否过期
            if (Date.now() > credential.expiresAt) {
                this.credentials.delete(key);
                continue;
            }
            
            list.push({
                key: credential.key,
                type: credential.type,
                description: credential.description,
                createdAt: credential.createdAt,
                lastAccessedAt: credential.lastAccessedAt,
                expiresAt: credential.expiresAt,
                accessCount: credential.accessCount
            });
        }
        
        return list;
    }

    /**
     * 清理过期凭据
     */
    cleanup() {
        const now = Date.now();
        let cleanedCount = 0;
        
        for (const [key, credential] of this.credentials) {
            if (now > credential.expiresAt) {
                this.credentials.delete(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`[CredentialManager] 已清理 ${cleanedCount} 个过期凭据`);
        }
        
        return cleanedCount;
    }

    /**
     * 记录访问日志
     */
    logAccess(action, key, details = {}) {
        if (!this.config.enableAccessLogging) return;
        
        const logEntry = {
            timestamp: Date.now(),
            action: action,
            key: key,
            details: details,
            userAgent: navigator.userAgent.substring(0, 100) // 截断用户代理
        };
        
        this.accessLog.push(logEntry);
        
        // 保持日志大小在限制内
        if (this.accessLog.length > this.config.maxLogEntries) {
            this.accessLog.splice(0, this.accessLog.length - this.config.maxLogEntries);
        }
    }

    /**
     * 获取访问日志
     */
    getAccessLog(limit = 100) {
        return this.accessLog.slice(-limit);
    }

    /**
     * 启动自动清理
     */
    startAutoCleanup() {
        setInterval(() => {
            this.cleanup();
        }, this.config.autoCleanupInterval);
    }

    /**
     * 获取统计信息
     */
    getStats() {
        const now = Date.now();
        let activeCredentials = 0;
        let expiredCredentials = 0;
        
        for (const credential of this.credentials.values()) {
            if (now > credential.expiresAt) {
                expiredCredentials++;
            } else {
                activeCredentials++;
            }
        }
        
        return {
            total: this.credentials.size,
            active: activeCredentials,
            expired: expiredCredentials,
            accessLogEntries: this.accessLog.length,
            config: this.config
        };
    }

    /**
     * 更新配置
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
        
        console.log('[CredentialManager] 配置已更新:', newConfig);
    }

    /**
     * 清除所有数据
     */
    clear() {
        this.credentials.clear();
        this.accessLog.length = 0;
        console.log('[CredentialManager] 所有凭据已清除');
    }
}

// 创建全局实例
export const credentialManager = new CredentialManager();

// 导出调试函数
if (typeof window !== 'undefined') {
    window.debugCredentials = () => {
        console.log('=== FourAir 凭据管理器 ===');
        console.log('统计信息:', credentialManager.getStats());
        console.log('凭据列表:', credentialManager.list());
        console.log('最近访问:', credentialManager.getAccessLog(10));
        return credentialManager;
    };
} 