const { ipcMain } = require('electron');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');

// IP 查询服务的 URL 列表 (可以根据需要调整或从设置读取)
const ipCheckUrls = {
    'ip123': 'https://api.ip123.in/ipinfo', // 添加 IP123
    'ip-api': 'http://ip-api.com/json/?fields=status,message,query,country,regionName,city,isp,org',
    'ipify': 'https://api.ipify.org?format=json',
    'httpbin': 'https://httpbin.org/ip'
    // 'ip138': '...', // 暂不处理 HTML
    // 'maxmind': '...' // 暂不处理
};

/**
 * 测试代理连接并获取出口 IP。
 * @param {object} proxyConfig - { type, host, port, username?, password? }
 * @param {string} ipQueryChannel - 使用哪个 IP 查询服务 ('ip-api', 'ip138', etc.)
 * @returns {Promise<object>} - 返回检测结果 { success: boolean, message: string, data?: object }
 */
async function testProxyConnection(proxyConfig, ipQueryChannel = 'ip-api') {
    const { type, host, port, username, password } = proxyConfig;
    const targetUrl = ipCheckUrls[ipQueryChannel] || ipCheckUrls['ip-api']; // 默认使用 ip-api

    if (!targetUrl) {
        return { success: false, message: `无效的 IP 查询渠道: ${ipQueryChannel}` };
    }

    let agent;
    const proxyUrl = `${type}://${username && password ? `${username}:${password}@` : ''}${host}:${port}`;

    try {
        if (type === 'http' || type === 'https') {
            agent = new HttpsProxyAgent(proxyUrl);
        } else if (type === 'socks5') {
            agent = new SocksProxyAgent(proxyUrl);
        } else {
            return { success: false, message: `不支持的代理类型: ${type}` };
        }
    } catch (error) { 
        console.error('创建代理 Agent 失败:', error);
        return { success: false, message: `创建代理 Agent 失败: ${error.message}` };
    }

    console.log(`Testing proxy: ${proxyUrl} via ${targetUrl}`);

    try {
        // 设置 axios 请求配置
        const axiosConfig = {
            url: targetUrl,
            method: 'get',
            timeout: 10000, // 设置超时时间 (10秒)
            httpsAgent: (type === 'http' || type === 'https') ? agent : undefined,
            httpAgent: (type === 'http' || type === 'https') ? agent : undefined, // HTTP也可能需要代理
            // SOCKS 代理需要直接在 agent 中处理，axios 本身不直接支持 socks
            // 但 SocksProxyAgent 会处理底层连接，所以 httpsAgent/httpAgent 设为 undefined (或不设)
            // 对于 socks 代理，我们需要确保 axios 的底层 http/https 模块能使用 agent
            // HttpsProxyAgent 和 SocksProxyAgent 的实现方式不同，后者通常直接包装 net.Socket
            // 对于 socks5，可能需要根据 axios 版本和 socks-proxy-agent 的文档调整
            // 常见的做法是确保 axios 底层使用被 agent 包装过的 http/https 模块
            // 如果是 socks5，直接设置 httpsAgent/httpAgent 可能无效或报错
            // 尝试让 axios 自动选择 agent (如果 socks-proxy-agent 配置了全局代理)
            // 或者针对 socks 单独处理请求逻辑
             proxy: false, // 禁用 axios 内置的 proxy 设置，完全依赖 agent
        };
        
        // 特别处理 SOCKS 代理
        if (type === 'socks5') {
             axiosConfig.httpsAgent = agent;
             axiosConfig.httpAgent = agent;
        }

        const response = await axios(axiosConfig);

        // 检查响应状态码
        if (response.status >= 200 && response.status < 300) {
             console.log('代理检测成功:', response.data);
             let resultData = response.data;

             // 尝试将非对象响应解析为 JSON
             if (typeof resultData !== 'object' && typeof resultData === 'string') {
                try {
                    resultData = JSON.parse(resultData);
                } catch (parseError) {
                     // 如果解析失败，保留原始字符串
                     console.warn('响应不是有效的 JSON:', resultData);
                }
             }
             
             // --- 统一化数据结构 (可选，但推荐) ---
             let normalizedData = {};
             if (typeof resultData === 'object' && resultData !== null) {
                if (ipQueryChannel === 'ip123') {
                    normalizedData.query = resultData.ip;       // ip123 的 IP 字段是 'ip'
                    normalizedData.country = resultData.country;
                    normalizedData.regionName = resultData.province;
                    normalizedData.city = resultData.city;
                    normalizedData.isp = resultData.isp;
                } else if (ipQueryChannel === 'ip-api') {
                    normalizedData = { ...resultData };        // ip-api 的字段基本符合需要
                } else if (ipQueryChannel === 'ipify') {
                    normalizedData.query = resultData.ip;       // ipify 的 IP 字段是 'ip'
                } else if (ipQueryChannel === 'httpbin') {
                    normalizedData.query = resultData.origin;   // httpbin 的 IP 字段是 'origin'
                }
                 // 如果原始数据就是非对象 (例如解析 JSON 失败), 存入 raw
                 else if (typeof resultData !== 'object') {
                     normalizedData.raw = resultData;
                     normalizedData.message = '代理可用，但响应格式无法解析';
                 }
             } else {
                 // 处理 resultData 不是对象或为 null 的情况
                 normalizedData.raw = resultData; // Store whatever was received
                 normalizedData.message = '代理可用，但响应为空或格式未知';
             }
             // --- ------------------------------- ---

            return { success: true, message: '代理连接成功', data: normalizedData };
        } else {
             console.warn(`代理检测失败，状态码: ${response.status}`);
            return { success: false, message: `代理检测失败，状态码: ${response.status}` };
        }
    } catch (error) {
        console.error('代理检测出错:', error.message);
        let errorMessage = `代理连接失败: ${error.message}`;
        if (error.code) {
            errorMessage += ` (Code: ${error.code})`;
        }
        if (error.response) {
            errorMessage += ` (Status: ${error.response.status})`;
        }
         if (error.message.includes('timed out')) {
            errorMessage = '代理连接超时 (10秒)';
        }
        return { success: false, message: errorMessage };
    }
}

function setupProxyIpcHandlers() {
    console.log('[IPC] Setting up Proxy IPC handlers...');

    ipcMain.handle('proxy:testConnection', async (event, proxyConfig, ipQueryChannel) => {
        console.log('[IPC] Received: proxy:testConnection', proxyConfig, ipQueryChannel);
        if (!proxyConfig || !proxyConfig.type || !proxyConfig.host || !proxyConfig.port) {
            return { success: false, message: '无效的代理配置参数' };
        }
        return await testProxyConnection(proxyConfig, ipQueryChannel);
    });

    console.log('[IPC] Proxy IPC handlers ready.');
}

module.exports = {
    setupProxyIpcHandlers,
    testProxyConnection // 也导出函数本身，方便其他地方调用（如果需要）
}; 