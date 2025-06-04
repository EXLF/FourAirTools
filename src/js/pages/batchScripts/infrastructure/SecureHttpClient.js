/**
 * 安全HTTP客户端
 * 集成网络安全管理器，为所有网络请求提供安全保护
 */

import { networkSecurity } from './NetworkSecurityManager.js';

export class SecureHttpClient {
    constructor(baseConfig = {}) {
        this.baseConfig = {
            timeout: 30000,
            validateStatus: (status) => status >= 200 && status < 400,
            ...baseConfig
        };
        
        this.interceptors = {
            request: [],
            response: []
        };
        
        console.log('[SecureHttpClient] 安全HTTP客户端已初始化');
    }

    /**
     * 添加请求拦截器
     */
    addRequestInterceptor(interceptor) {
        this.interceptors.request.push(interceptor);
    }

    /**
     * 添加响应拦截器
     */
    addResponseInterceptor(interceptor) {
        this.interceptors.response.push(interceptor);
    }

    /**
     * 应用请求拦截器
     */
    async applyRequestInterceptors(config) {
        let modifiedConfig = config;
        
        for (const interceptor of this.interceptors.request) {
            try {
                modifiedConfig = await interceptor(modifiedConfig);
            } catch (error) {
                console.error('[SecureHttpClient] 请求拦截器错误:', error);
            }
        }
        
        return modifiedConfig;
    }

    /**
     * 应用响应拦截器
     */
    async applyResponseInterceptors(response) {
        let modifiedResponse = response;
        
        for (const interceptor of this.interceptors.response) {
            try {
                modifiedResponse = await interceptor(modifiedResponse);
            } catch (error) {
                console.error('[SecureHttpClient] 响应拦截器错误:', error);
            }
        }
        
        return modifiedResponse;
    }

    /**
     * 执行安全的HTTP请求
     */
    async request(config) {
        try {
            // 合并基础配置
            const mergedConfig = {
                ...this.baseConfig,
                ...config
            };

            // 应用网络安全保护
            const secureConfig = networkSecurity.secureRequestConfig(mergedConfig);
            
            // 应用请求拦截器
            const finalConfig = await this.applyRequestInterceptors(secureConfig);

            // 记录请求（脱敏）
            const sanitizedConfig = this.sanitizeConfigForLogging(finalConfig);
            console.log('[SecureHttpClient] 发起安全请求:', {
                method: sanitizedConfig.method || 'GET',
                url: sanitizedConfig.url,
                headers: sanitizedConfig.headers
            });

            // 执行请求
            const startTime = Date.now();
            const response = await this.executeRequest(finalConfig);
            const duration = Date.now() - startTime;

            // 验证响应安全性
            const responseValidation = networkSecurity.validateResponse(response, finalConfig.url);
            if (!responseValidation.valid) {
                console.warn('[SecureHttpClient] 响应安全验证失败:', responseValidation.reason);
            }

            // 应用响应拦截器
            const finalResponse = await this.applyResponseInterceptors(response);

            // 记录成功请求
            console.log('[SecureHttpClient] 请求完成:', {
                status: finalResponse.status,
                duration: `${duration}ms`,
                size: this.getResponseSize(finalResponse)
            });

            return finalResponse;

        } catch (error) {
            // 记录安全事件
            networkSecurity.logSecurityEvent('request_failed', {
                url: config.url,
                method: config.method,
                error: error.message
            });

            console.error('[SecureHttpClient] 请求失败:', error.message);
            throw error;
        }
    }

    /**
     * 执行实际的HTTP请求
     */
    async executeRequest(config) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            
            // 设置请求
            xhr.open(config.method || 'GET', config.url, true);
            
            // 设置headers
            if (config.headers) {
                Object.keys(config.headers).forEach(key => {
                    xhr.setRequestHeader(key, config.headers[key]);
                });
            }
            
            // 设置超时
            xhr.timeout = config.timeout || 30000;
            
            // 设置响应类型
            if (config.responseType) {
                xhr.responseType = config.responseType;
            }
            
            // 处理响应
            xhr.onload = () => {
                const response = {
                    status: xhr.status,
                    statusText: xhr.statusText,
                    headers: this.parseResponseHeaders(xhr.getAllResponseHeaders()),
                    data: xhr.response,
                    config: config
                };
                
                if (config.validateStatus(xhr.status)) {
                    resolve(response);
                } else {
                    reject(new Error(`请求失败: ${xhr.status} ${xhr.statusText}`));
                }
            };
            
            xhr.onerror = () => {
                reject(new Error('网络错误'));
            };
            
            xhr.ontimeout = () => {
                reject(new Error('请求超时'));
            };
            
            // 发送请求
            if (config.data) {
                if (typeof config.data === 'object') {
                    xhr.send(JSON.stringify(config.data));
                } else {
                    xhr.send(config.data);
                }
            } else {
                xhr.send();
            }
        });
    }

    /**
     * 解析响应headers
     */
    parseResponseHeaders(headerStr) {
        const headers = {};
        if (!headerStr) return headers;
        
        headerStr.split('\r\n').forEach(line => {
            const parts = line.split(': ');
            if (parts.length === 2) {
                headers[parts[0].toLowerCase()] = parts[1];
            }
        });
        
        return headers;
    }

    /**
     * 获取响应大小
     */
    getResponseSize(response) {
        if (response.data) {
            if (typeof response.data === 'string') {
                return `${response.data.length} bytes`;
            } else if (response.data instanceof ArrayBuffer) {
                return `${response.data.byteLength} bytes`;
            } else {
                return `${JSON.stringify(response.data).length} bytes`;
            }
        }
        return '0 bytes';
    }

    /**
     * 脱敏配置用于日志记录
     */
    sanitizeConfigForLogging(config) {
        const sanitized = { ...config };
        
        // 脱敏data
        if (sanitized.data) {
            sanitized.data = networkSecurity.sanitizeRequestData(sanitized.data);
        }
        
        // 脱敏headers中的敏感信息
        if (sanitized.headers) {
            const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];
            sanitized.headers = { ...sanitized.headers };
            
            sensitiveHeaders.forEach(header => {
                if (sanitized.headers[header]) {
                    sanitized.headers[header] = '***REDACTED***';
                }
            });
        }
        
        return sanitized;
    }

    /**
     * GET请求
     */
    async get(url, config = {}) {
        return this.request({
            ...config,
            method: 'GET',
            url
        });
    }

    /**
     * POST请求
     */
    async post(url, data, config = {}) {
        return this.request({
            ...config,
            method: 'POST',
            url,
            data,
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            }
        });
    }

    /**
     * PUT请求
     */
    async put(url, data, config = {}) {
        return this.request({
            ...config,
            method: 'PUT',
            url,
            data,
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            }
        });
    }

    /**
     * DELETE请求
     */
    async delete(url, config = {}) {
        return this.request({
            ...config,
            method: 'DELETE',
            url
        });
    }

    /**
     * 获取客户端统计信息
     */
    getStats() {
        return {
            networkSecurity: networkSecurity.getSecurityStats(),
            interceptors: {
                request: this.interceptors.request.length,
                response: this.interceptors.response.length
            },
            baseConfig: this.baseConfig
        };
    }
}

// 创建默认的安全HTTP客户端实例
export const secureHttpClient = new SecureHttpClient();

// 导出调试函数
if (typeof window !== 'undefined') {
    window.debugSecureHttp = () => {
        console.log('=== FourAir 安全HTTP客户端 ===');
        console.log('客户端统计:', secureHttpClient.getStats());
        return secureHttpClient;
    };
} 