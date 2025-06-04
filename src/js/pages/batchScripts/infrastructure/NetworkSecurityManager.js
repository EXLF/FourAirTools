/**
 * 网络安全管理器
 * 强化所有网络请求的安全性，防止中间人攻击和数据泄露
 */

export class NetworkSecurityManager {
    constructor() {
        this.securityConfig = {
            forceHTTPS: true,              // 强制HTTPS
            validateCertificates: true,     // 证书验证
            enableRequestSigning: true,     // 请求签名
            enableResponseValidation: true, // 响应验证
            rateLimitThreshold: 100,       // 速率限制（每分钟）
            requestTimeoutMs: 30000,       // 请求超时
            allowedDomains: [              // 白名单域名
                'api.capsolver.com',
                'api.github.com',
                'jsonplaceholder.typicode.com'
            ]
        };
        
        this.requestHistory = new Map(); // 请求历史，用于速率限制
        this.securityHeaders = {
            'User-Agent': 'FourAir-SecureClient/2.0',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block'
        };
        
        console.log('[NetworkSecurity] 网络安全管理器已初始化');
    }

    /**
     * 验证URL安全性
     */
    validateUrlSecurity(url) {
        try {
            const urlObj = new URL(url);
            
            // 强制HTTPS检查
            if (this.securityConfig.forceHTTPS && urlObj.protocol !== 'https:') {
                throw new Error(`不安全的协议: ${urlObj.protocol}，必须使用HTTPS`);
            }
            
            // 域名白名单检查
            if (this.securityConfig.allowedDomains.length > 0) {
                const isAllowed = this.securityConfig.allowedDomains.some(domain => 
                    urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
                );
                
                if (!isAllowed) {
                    console.warn(`[NetworkSecurity] 访问未在白名单的域名: ${urlObj.hostname}`);
                    return {
                        safe: false,
                        reason: '域名不在安全白名单中',
                        recommendation: '请确认此域名的安全性'
                    };
                }
            }
            
            // 检查是否为已知的恶意域名（可扩展）
            const suspiciousDomains = ['malware.com', 'phishing.net'];
            if (suspiciousDomains.includes(urlObj.hostname)) {
                throw new Error(`检测到恶意域名: ${urlObj.hostname}`);
            }
            
            return { safe: true };
            
        } catch (error) {
            console.error('[NetworkSecurity] URL验证失败:', error.message);
            return {
                safe: false,
                reason: error.message,
                recommendation: '请使用安全的HTTPS地址'
            };
        }
    }

    /**
     * 应用速率限制
     */
    applyRateLimit(url) {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const now = Date.now();
        const windowMs = 60000; // 1分钟窗口
        
        if (!this.requestHistory.has(domain)) {
            this.requestHistory.set(domain, []);
        }
        
        const domainHistory = this.requestHistory.get(domain);
        
        // 清理过期记录
        const validRequests = domainHistory.filter(time => now - time < windowMs);
        this.requestHistory.set(domain, validRequests);
        
        // 检查是否超过限制
        if (validRequests.length >= this.securityConfig.rateLimitThreshold) {
            throw new Error(`对域名 ${domain} 的请求过于频繁，请稍后再试`);
        }
        
        // 记录当前请求
        validRequests.push(now);
    }

    /**
     * 生成请求签名
     */
    generateRequestSignature(method, url, body, timestamp) {
        const dataToSign = `${method.toUpperCase()}|${url}|${body || ''}|${timestamp}`;
        const secretKey = 'FourAir-Request-Secret-2024';
        
        // 简单的签名实现，实际应用中应使用更强的加密
        let hash = 0;
        for (let i = 0; i < dataToSign.length; i++) {
            const char = dataToSign.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString(36);
    }

    /**
     * 安全化网络请求配置
     */
    secureRequestConfig(config) {
        const secureConfig = { ...config };
        
        // 验证URL
        const urlValidation = this.validateUrlSecurity(config.url);
        if (!urlValidation.safe) {
            throw new Error(`URL安全验证失败: ${urlValidation.reason}`);
        }
        
        // 应用速率限制
        this.applyRateLimit(config.url);
        
        // 设置安全headers
        secureConfig.headers = {
            ...this.securityHeaders,
            ...config.headers
        };
        
        // 设置超时
        secureConfig.timeout = this.securityConfig.requestTimeoutMs;
        
        // 启用HTTPS证书验证（在Electron主进程中配置）
        if (this.securityConfig.validateCertificates) {
            secureConfig.rejectUnauthorized = true;
        }
        
        // 添加请求签名
        if (this.securityConfig.enableRequestSigning) {
            const timestamp = Date.now().toString();
            const signature = this.generateRequestSignature(
                config.method || 'GET',
                config.url,
                config.data ? JSON.stringify(config.data) : null,
                timestamp
            );
            
            secureConfig.headers['X-Request-Timestamp'] = timestamp;
            secureConfig.headers['X-Request-Signature'] = signature;
        }
        
        // 移除可能泄露信息的headers
        delete secureConfig.headers['X-Powered-By'];
        delete secureConfig.headers['Server'];
        
        return secureConfig;
    }

    /**
     * 验证响应安全性
     */
    validateResponse(response, originalUrl) {
        if (!this.securityConfig.enableResponseValidation) {
            return { valid: true };
        }
        
        try {
            // 检查响应状态
            if (response.status < 200 || response.status >= 400) {
                console.warn(`[NetworkSecurity] 响应状态异常: ${response.status}`);
            }
            
            // 检查响应headers中的安全指示
            const headers = response.headers || {};
            
            // 验证Content-Type
            const contentType = headers['content-type'] || '';
            if (contentType.includes('text/html') && !originalUrl.includes('.html')) {
                console.warn('[NetworkSecurity] 可能的重定向攻击，期望JSON但收到HTML');
                return {
                    valid: false,
                    reason: '响应内容类型异常，可能存在重定向攻击'
                };
            }
            
            // 检查安全headers
            const securityHeadersCheck = {
                'strict-transport-security': '检测HSTS支持',
                'x-content-type-options': '检测内容类型保护',
                'x-frame-options': '检测点击劫持保护'
            };
            
            const missingHeaders = [];
            Object.keys(securityHeadersCheck).forEach(header => {
                if (!headers[header.toLowerCase()]) {
                    missingHeaders.push(securityHeadersCheck[header]);
                }
            });
            
            if (missingHeaders.length > 0) {
                console.warn('[NetworkSecurity] 服务器缺少安全headers:', missingHeaders);
            }
            
            return { valid: true };
            
        } catch (error) {
            console.error('[NetworkSecurity] 响应验证失败:', error);
            return {
                valid: false,
                reason: `响应验证错误: ${error.message}`
            };
        }
    }

    /**
     * 记录安全事件
     */
    logSecurityEvent(event, details) {
        const securityLog = {
            timestamp: new Date().toISOString(),
            event: event,
            details: details,
            userAgent: navigator.userAgent,
            location: window.location.href
        };
        
        console.warn('[NetworkSecurity] 安全事件:', securityLog);
        
        // 可以扩展为发送到安全监控系统
        // this.sendToSecurityMonitoring(securityLog);
    }

    /**
     * 清理敏感数据
     */
    sanitizeRequestData(data) {
        if (!data || typeof data !== 'object') {
            return data;
        }
        
        const sensitiveFields = [
            'password', 'token', 'apiKey', 'clientKey', 'secret',
            'privateKey', 'accessToken', 'refreshToken', 'sessionId'
        ];
        
        const sanitized = { ...data };
        
        function recursiveSanitize(obj, path = '') {
            for (const key in obj) {
                const currentPath = path ? `${path}.${key}` : key;
                const lowerKey = key.toLowerCase();
                
                if (sensitiveFields.some(field => lowerKey.includes(field.toLowerCase()))) {
                    obj[key] = '***REDACTED***';
                    console.log(`[NetworkSecurity] 已脱敏敏感字段: ${currentPath}`);
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    recursiveSanitize(obj[key], currentPath);
                }
            }
        }
        
        recursiveSanitize(sanitized);
        return sanitized;
    }

    /**
     * 获取安全统计信息
     */
    getSecurityStats() {
        const totalRequests = Array.from(this.requestHistory.values())
            .reduce((total, requests) => total + requests.length, 0);
        
        const activeDomains = this.requestHistory.size;
        
        return {
            totalRequests,
            activeDomains,
            securityConfig: this.securityConfig,
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * 更新安全配置
     */
    updateSecurityConfig(newConfig) {
        this.securityConfig = {
            ...this.securityConfig,
            ...newConfig
        };
        
        console.log('[NetworkSecurity] 安全配置已更新:', newConfig);
    }
}

// 创建全局实例
export const networkSecurity = new NetworkSecurityManager();

// 导出调试函数
if (typeof window !== 'undefined') {
    window.debugNetworkSecurity = () => {
        console.log('=== FourAir 网络安全管理器 ===');
        console.log('安全统计:', networkSecurity.getSecurityStats());
        console.log('配置信息:', networkSecurity.securityConfig);
        return networkSecurity;
    };
} 