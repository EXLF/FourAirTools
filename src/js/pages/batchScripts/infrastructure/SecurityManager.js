/**
 * 统一安全管理器
 * 集成所有安全功能，提供统一的安全服务
 */

import { networkSecurity } from './NetworkSecurityManager.js';
import { secureHttpClient } from './SecureHttpClient.js';
import { credentialManager } from './CredentialManager.js';

export class SecurityManager {
    constructor() {
        this.isInitialized = false;
        this.modules = {
            networkSecurity: null,
            secureHttpClient: null,
            credentialManager: null
        };
        
        this.config = {
            autoInit: true,
            logLevel: 'info',
            enableGlobalDebug: true
        };
        
        console.log('[SecurityManager] 统一安全管理器构造完成');
    }

    /**
     * 初始化安全管理器
     */
    async initialize() {
        if (this.isInitialized) {
            console.log('[SecurityManager] 已初始化，跳过重复初始化');
            return { success: true, message: '已初始化' };
        }

        try {
            console.log('[SecurityManager] 🔒 开始初始化安全基础设施...');

            // 1. 初始化网络安全管理器
            this.modules.networkSecurity = networkSecurity;
            console.log('[SecurityManager] ✅ 网络安全管理器已加载');

            // 2. 初始化安全HTTP客户端
            this.modules.secureHttpClient = secureHttpClient;
            console.log('[SecurityManager] ✅ 安全HTTP客户端已加载');

            // 3. 初始化凭据管理器
            this.modules.credentialManager = credentialManager;
            console.log('[SecurityManager] ✅ 凭据管理器已加载');

            // 4. 配置安全策略
            this.applySafetyPolicies();

            // 5. 设置全局调试函数
            if (this.config.enableGlobalDebug) {
                this.setupGlobalDebugFunctions();
            }

            // 6. 设置安全监控
            this.setupSecurityMonitoring();

            this.isInitialized = true;
            
            const stats = this.getSecurityStats();
            console.log('[SecurityManager] 🛡️ 安全基础设施初始化完成:', stats);

            return {
                success: true,
                message: '安全基础设施初始化成功',
                stats: stats
            };

        } catch (error) {
            console.error('[SecurityManager] 安全基础设施初始化失败:', error);
            return {
                success: false,
                message: `初始化失败: ${error.message}`,
                error: error
            };
        }
    }

    /**
     * 应用安全策略
     */
    applySafetyPolicies() {
        // 配置网络安全策略
        this.modules.networkSecurity.updateSecurityConfig({
            forceHTTPS: false, // 暂时关闭强制HTTPS，允许localhost
            rateLimitThreshold: 100,
            allowedDomains: [
                'api.capsolver.com',
                'api.github.com', 
                'jsonplaceholder.typicode.com',
                'localhost',
                '127.0.0.1',
                'raw.githubusercontent.com',
                'api.openai.com',
                'httpbin.org'
            ]
        });

        // 配置凭据管理策略
        this.modules.credentialManager.updateConfig({
            credentialExpiration: 24 * 60 * 60 * 1000, // 24小时
            enableAccessLogging: true,
            autoCleanupInterval: 60 * 60 * 1000 // 1小时清理
        });

        console.log('[SecurityManager] 安全策略已应用');
    }

    /**
     * 设置全局调试函数
     */
    setupGlobalDebugFunctions() {
        if (typeof window !== 'undefined') {
            // 统一的安全调试函数
            window.debugSecurity = () => {
                console.log('=== FourAir 安全管理器总览 ===');
                console.log('初始化状态:', this.isInitialized);
                console.log('安全统计:', this.getSecurityStats());
                console.log('可用模块:', Object.keys(this.modules));
                
                console.log('\n=== 详细模块信息 ===');
                if (this.modules.networkSecurity) {
                    console.log('网络安全:', this.modules.networkSecurity.getSecurityStats());
                }
                if (this.modules.secureHttpClient) {
                    console.log('HTTP客户端:', this.modules.secureHttpClient.getStats());
                }
                if (this.modules.credentialManager) {
                    console.log('凭据管理:', this.modules.credentialManager.getStats());
                }
                
                return this;
            };

            // 网络安全调试（保持原有接口）
            window.debugNetworkSecurity = () => {
                console.log('=== FourAir 网络安全管理器 ===');
                if (this.modules.networkSecurity) {
                    console.log('安全统计:', this.modules.networkSecurity.getSecurityStats());
                    console.log('配置信息:', this.modules.networkSecurity.securityConfig);
                    return this.modules.networkSecurity;
                } else {
                    console.warn('网络安全管理器未初始化');
                    return null;
                }
            };

            // HTTP客户端调试
            window.debugSecureHttp = () => {
                console.log('=== FourAir 安全HTTP客户端 ===');
                if (this.modules.secureHttpClient) {
                    console.log('客户端统计:', this.modules.secureHttpClient.getStats());
                    return this.modules.secureHttpClient;
                } else {
                    console.warn('安全HTTP客户端未初始化');
                    return null;
                }
            };

            // 凭据管理调试
            window.debugCredentials = () => {
                console.log('=== FourAir 凭据管理器 ===');
                if (this.modules.credentialManager) {
                    console.log('统计信息:', this.modules.credentialManager.getStats());
                    console.log('凭据列表:', this.modules.credentialManager.list());
                    console.log('最近访问:', this.modules.credentialManager.getAccessLog(10));
                    return this.modules.credentialManager;
                } else {
                    console.warn('凭据管理器未初始化');
                    return null;
                }
            };

            // 安全测试函数
            window.testSecurity = () => {
                return this.runSecurityTests();
            };

            console.log('[SecurityManager] 全局调试函数已设置');
            console.log('💡 可用函数: debugSecurity(), debugNetworkSecurity(), debugSecureHttp(), debugCredentials(), testSecurity()');
        }
    }

    /**
     * 设置安全监控
     */
    setupSecurityMonitoring() {
        // 定期安全检查
        setInterval(() => {
            this.performSecurityCheck();
        }, 5 * 60 * 1000); // 每5分钟检查一次

        console.log('[SecurityManager] 安全监控已启动');
    }

    /**
     * 执行安全检查
     */
    performSecurityCheck() {
        try {
            const stats = this.getSecurityStats();
            
            // 检查异常情况
            if (stats.networkSecurity && stats.networkSecurity.totalRequests > 1000) {
                console.warn('[SecurityManager] 网络请求量异常高:', stats.networkSecurity.totalRequests);
            }
            
            if (stats.credentialManager && stats.credentialManager.expired > 10) {
                console.warn('[SecurityManager] 大量凭据过期:', stats.credentialManager.expired);
                this.modules.credentialManager.cleanup();
            }
            
        } catch (error) {
            console.error('[SecurityManager] 安全检查失败:', error);
        }
    }

    /**
     * 获取安全统计信息
     */
    getSecurityStats() {
        const stats = {
            initialized: this.isInitialized,
            modules: Object.keys(this.modules).length,
            timestamp: new Date().toISOString()
        };

        if (this.modules.networkSecurity) {
            stats.networkSecurity = this.modules.networkSecurity.getSecurityStats();
        }

        if (this.modules.secureHttpClient) {
            stats.secureHttpClient = this.modules.secureHttpClient.getStats();
        }

        if (this.modules.credentialManager) {
            stats.credentialManager = this.modules.credentialManager.getStats();
        }

        return stats;
    }

    /**
     * 运行安全测试
     */
    async runSecurityTests() {
        console.log('[SecurityManager] 🧪 开始安全功能测试...');
        
        const tests = {
            networkSecurity: false,
            credentialManager: false,
            httpClient: false
        };

        try {
            // 测试网络安全
            if (this.modules.networkSecurity) {
                const urlTest = this.modules.networkSecurity.validateUrlSecurity('https://api.github.com');
                tests.networkSecurity = urlTest.safe;
                console.log('[SecurityManager] ✅ 网络安全测试通过');
            }

            // 测试凭据管理
            if (this.modules.credentialManager) {
                const testKey = 'test_credential_' + Date.now();
                const stored = this.modules.credentialManager.store(testKey, 'test_value', {
                    type: 'test',
                    description: '测试凭据'
                });
                
                if (stored) {
                    const retrieved = this.modules.credentialManager.get(testKey);
                    tests.credentialManager = retrieved === 'test_value';
                    this.modules.credentialManager.delete(testKey); // 清理测试数据
                    console.log('[SecurityManager] ✅ 凭据管理测试通过');
                }
            }

            // 测试HTTP客户端
            if (this.modules.secureHttpClient) {
                try {
                    const stats = this.modules.secureHttpClient.getStats();
                    tests.httpClient = stats && typeof stats === 'object';
                    console.log('[SecurityManager] ✅ HTTP客户端测试通过');
                } catch (error) {
                    console.warn('[SecurityManager] HTTP客户端测试失败:', error.message);
                }
            }

            const allPassed = Object.values(tests).every(test => test === true);
            
            console.log('[SecurityManager] 🧪 安全测试完成:', {
                allPassed,
                details: tests
            });

            return { success: allPassed, tests };

        } catch (error) {
            console.error('[SecurityManager] 安全测试失败:', error);
            return { success: false, error: error.message, tests };
        }
    }

    /**
     * 获取安全HTTP客户端实例
     */
    getSecureHttpClient() {
        if (!this.isInitialized) {
            console.warn('[SecurityManager] 安全管理器未初始化，返回null');
            return null;
        }
        return this.modules.secureHttpClient;
    }

    /**
     * 获取凭据管理器实例
     */
    getCredentialManager() {
        if (!this.isInitialized) {
            console.warn('[SecurityManager] 安全管理器未初始化，返回null');
            return null;
        }
        return this.modules.credentialManager;
    }

    /**
     * 清理安全管理器
     */
    cleanup() {
        if (this.modules.credentialManager) {
            this.modules.credentialManager.clear();
        }
        
        this.isInitialized = false;
        console.log('[SecurityManager] 安全管理器已清理');
    }
}

// 创建全局实例
export const securityManager = new SecurityManager();

// 导出便捷的初始化函数
export async function initializeSecurity() {
    return await securityManager.initialize();
} 