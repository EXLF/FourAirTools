const { ipcMain, session } = require('electron');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const db = require('../db/index.js'); // 数据库访问

// --- 配置 ---
const TEST_TIMEOUT = 15000; // 测试超时时间 (ms)
const IP_INFO_URL = 'http://ip234.in/ip.json'; // 获取 IP 信息的 URL
const RISK_CHECK_URL = 'http://ip234.in/f.json'; // 获取风险评分的 URL
// const RISK_CHECK_IP_URL = 'http://ip234.in/fraud_check?ip='; // 备选：根据IP查风险


function setupProxyIpcHandlers(mainWindow) {
    console.log('[IPC] Setting up Proxy IPC handlers...');

    // --- 设置代理 --- 
    ipcMain.handle('proxy:set', async (event, proxyId) => {
        console.log(`[IPC] Received: proxy:set, proxyId: ${proxyId}`);
        const targetSession = session.defaultSession; // 应用全局代理

        if (proxyId === null || proxyId === undefined) {
            // 禁用代理
            try {
                await targetSession.setProxy({ mode: 'direct' });
                console.log('[Proxy Manager] Proxy disabled (direct connection).');
                // 可选：更新数据库中所有代理的 is_enabled 为 0
                // await db.db.run('UPDATE proxies SET is_enabled = 0');
                return { success: true, message: '代理已禁用' };
            } catch (error) {
                console.error('[Proxy Manager] Failed to disable proxy:', error);
                throw new Error('禁用代理失败');
            }
        } else {
            // 启用指定代理
            try {
                const proxy = await db.getProxyById(db.db, proxyId);
                if (!proxy) {
                    throw new Error(`找不到 ID 为 ${proxyId} 的代理配置`);
                }

                if (!proxy.decryptedPassword && proxy.password && proxy.username) {
                     console.warn(`[Proxy Manager] 代理 ${proxyId} 需要密码但无法解密，可能加密服务未解锁。`);
                    // 强制禁用代理可能更安全，或者抛出错误
                    // await targetSession.setProxy({ mode: 'direct' }); 
                     throw new Error('无法应用需要密码的代理，请先解锁应用');
                }

                const proxyUrl = formatProxyUrl(proxy);
                if (!proxyUrl) {
                     throw new Error('无法格式化代理 URL');
                 }
                
                let proxyRules = '';
                if (proxy.type === 'HTTP' || proxy.type === 'HTTPS') {
                    // Electron 的 setProxy 对 http/https 使用相同的规则
                    proxyRules = `${proxyUrl.protocol}//${proxyUrl.host}`; 
                } else if (proxy.type === 'SOCKS5') {
                    proxyRules = `socks5://${proxyUrl.host}`; // SOCKS5 规则
                    // 注意: Electron 对 SOCKS4/SOCKS5 的用户名密码支持可能有限或需要特定格式
                    // 如果 proxyUrl 包含认证信息，可能需要额外处理
                }
                 
                // 对于 SOCKS 代理，认证信息通常嵌入 URL (socks5://user:pass@host:port)
                // Electron 的 setProxy 可能不直接支持 SOCKS 认证，axios 的 agent 会处理
                // 但全局设置时要小心
                // 这里简化处理，假设 Electron 能处理 socks5://host:port

                const config = {
                    // mode: 'fixed_servers', // 明确指定使用固定代理
                    proxyRules: proxyRules,
                    proxyBypassRules: '<local>' // 绕过本地地址
                };

                console.log(`[Proxy Manager] Setting proxy config:`, JSON.stringify(config));
                await targetSession.setProxy(config);
                console.log(`[Proxy Manager] Proxy enabled: ${proxy.name} (${proxy.type}://${proxy.host}:${proxy.port})`);

                // 可选：更新数据库，确保只有当前代理是启用状态
                 await db.db.run('UPDATE proxies SET is_enabled = 0 WHERE id != ?', [proxyId]);
                 await db.db.run('UPDATE proxies SET is_enabled = 1 WHERE id = ?', [proxyId]);

                return { success: true, message: `代理 ${proxy.name} 已启用` };

            } catch (error) {
                console.error(`[Proxy Manager] Failed to enable proxy ${proxyId}:`, error);
                 // 尝试禁用代理以防部分设置成功
                 try { await targetSession.setProxy({ mode: 'direct' }); } catch (_) {}
                throw new Error(`启用代理失败: ${error.message}`);
            }
        }
    });

    // --- 测试代理 --- 
    ipcMain.handle('proxy:test', async (event, proxyIds) => {
        console.log(`[IPC] Received: proxy:test, proxyIds:`, proxyIds);
        if (!Array.isArray(proxyIds) || proxyIds.length === 0) {
            return { success: false, message: '需要提供代理 ID 数组' };
        }

        // 使用 Promise.allSettled 来处理所有测试，即使部分失败也不中断
        const results = await Promise.allSettled(
            proxyIds.map(id => testSingleProxy(id, mainWindow))
        );

        console.log('[Proxy Manager] All proxy tests finished.');

        // 返回结果（可选，因为结果通过事件发送）
        // 可以汇总成功和失败的数量
        const successfulTests = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
        const failedTests = results.length - successfulTests;
        return { success: true, message: `测试完成: ${successfulTests} 成功, ${failedTests} 失败` };
    });

    console.log('[IPC] Proxy IPC handlers ready.');
}

/**
 * 测试单个代理的连通性、获取 IP 信息和风险评分。
 * @param {number} proxyId - 要测试的代理 ID。
 * @param {BrowserWindow} mainWindow - 主窗口实例，用于发送事件。
 * @returns {Promise<{success: boolean, data?: object}>} 测试结果。
 */
async function testSingleProxy(proxyId, mainWindow) {
    let proxyConfig = null;
    let agent = null;
    const startTime = Date.now();

    try {
        // 1. 获取代理配置并解密密码
        proxyConfig = await db.getProxyById(db.db, proxyId);
        if (!proxyConfig) {
            throw new Error('Proxy configuration not found in DB.');
        }

        // 尝试更新状态为 测试中，并通知 UI
        try {
             await db.updateProxy(db.db, proxyId, { status: '测试中' });
             if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('proxy:testResult', { proxyId, success: false, data: { status: '测试中' } });
            }
        } catch (dbError) {
             console.warn(`[Proxy Test ${proxyId}] Failed to update status to '测试中':`, dbError.message);
        }

        // 检查密码是否需要且已解密
        if (proxyConfig.username && proxyConfig.password && !proxyConfig.decryptedPassword) {
             throw new Error('Password required but could not be decrypted (is the app unlocked?).');
         }

        // 2. 根据类型创建代理 Agent
        const proxyUrl = formatProxyUrl(proxyConfig);
         if (!proxyUrl) {
            throw new Error('Failed to format proxy URL.');
         }

        if (proxyConfig.type === 'HTTP' || proxyConfig.type === 'HTTPS') {
            agent = new HttpsProxyAgent(proxyUrl, { rejectUnauthorized: false, timeout: TEST_TIMEOUT }); // HTTPS Agent for both
        } else if (proxyConfig.type === 'SOCKS5') {
            agent = new SocksProxyAgent(proxyUrl, { timeout: TEST_TIMEOUT });
        } else {
            throw new Error(`Unsupported proxy type: ${proxyConfig.type}`);
        }

        // 3. 使用代理请求 IP 信息 URL
        console.log(`[Proxy Test ${proxyId}] Requesting IP info from ${IP_INFO_URL} via ${proxyConfig.type}...`);
        const ipInfoResponse = await axios.get(IP_INFO_URL, {
            httpsAgent: agent, // axios 使用 httpsAgent 处理 http 和 https
            httpAgent: agent,  // 也指定 httpAgent 以防万一
            timeout: TEST_TIMEOUT,
            // proxy: false // 确保 axios 不使用系统代理
        });
        const latency = Date.now() - startTime;
        console.log(`[Proxy Test ${proxyId}] IP info request successful (${latency}ms). Status: ${ipInfoResponse.status}`);

        if (ipInfoResponse.status !== 200 || typeof ipInfoResponse.data !== 'object') {
            throw new Error(`Failed to get valid IP info, status: ${ipInfoResponse.status}`);
        }

        const ipInfo = ipInfoResponse.data;
         if (!ipInfo.ip) {
             throw new Error('IP info response missing IP address.');
         }
        console.log(`[Proxy Test ${proxyId}] Exit IP: ${ipInfo.ip}`);

        // 4. 使用代理请求风险评分 URL
         console.log(`[Proxy Test ${proxyId}] Requesting risk score from ${RISK_CHECK_URL}...`);
         let riskInfo = { risk: '未知', score: null }; // Default risk info
         try {
             const riskResponse = await axios.get(RISK_CHECK_URL, {
                 httpsAgent: agent,
                 httpAgent: agent,
                 timeout: TEST_TIMEOUT,
                 // proxy: false
             });
             if (riskResponse.status === 200 && riskResponse.data && riskResponse.data.code === 0 && riskResponse.data.data) {
                riskInfo = {
                     risk: riskResponse.data.data.risk || '未知',
                     score: riskResponse.data.data.score ?? null
                 };
                 console.log(`[Proxy Test ${proxyId}] Risk score fetched:`, riskInfo);
             } else {
                 console.warn(`[Proxy Test ${proxyId}] Failed to get valid risk score, status: ${riskResponse.status}, data:`, riskResponse.data);
            }
        } catch (riskError) {
             console.warn(`[Proxy Test ${proxyId}] Error fetching risk score:`, riskError.message);
             // 不中断测试，继续使用默认风险信息
         }


        // 5. 组合结果并更新数据库
        const updateData = {
            status: '可用',
            latency: latency,
            exit_ip: ipInfo.ip,
            country: ipInfo.country,
            country_code: ipInfo.country_code,
            region: ipInfo.region_cn || ipInfo.region,
            city: ipInfo.city,
            organization: ipInfo.organization,
            asn: ipInfo.asn,
            risk_level: riskInfo.risk,
            risk_score: riskInfo.score,
            last_checked_at: new Date().toISOString()
        };

        await db.updateProxy(db.db, proxyId, updateData);
        console.log(`[Proxy Test ${proxyId}] DB updated successfully.`);

        // 6. 发送成功结果事件
        const resultData = { ...proxyConfig, ...updateData }; // 合并原始配置和更新数据
        if (mainWindow && !mainWindow.isDestroyed()) {
             mainWindow.webContents.send('proxy:testResult', { proxyId, success: true, data: resultData });
         }
        return { success: true, data: resultData };

    } catch (error) {
        const endTime = Date.now();
        console.error(`[Proxy Test ${proxyId}] FAILED (${endTime - startTime}ms):`, error.message);

        // 更新数据库状态为不可用
        const failureData = {
            status: '不可用',
            latency: null,
            // 可以选择清除旧的 IP/风险信息或保留
             // exit_ip: null, country: null, risk_level: null, ...
            last_checked_at: new Date().toISOString()
        };
        try {
            await db.updateProxy(db.db, proxyId, failureData);
        } catch (dbError) {
            console.error(`[Proxy Test ${proxyId}] Failed to update DB status on error:`, dbError.message);
        }

        // 发送失败结果事件
         const errorResultData = { ...proxyConfig, ...failureData }; // 包含失败状态
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('proxy:testResult', { proxyId, success: false, data: errorResultData });
        }
        // return { success: false, message: error.message };
        // 从 Promise.allSettled 角度，即使业务失败，也算执行完成，只是结果是失败
         // 抛出错误会让 Promise.allSettled 捕获到 rejected 状态
         // 这里选择 resolve 一个失败对象，也可以
         return { success: false, message: error.message, data: errorResultData }; 
    }
}

/**
 * 格式化代理配置为 URL 对象 (用于 axios agent)。
 * @param {object} proxy - 包含 type, host, port, username, decryptedPassword 的代理对象。
 * @returns {URL|null} 格式化后的 URL 对象或 null。
 */
function formatProxyUrl(proxy) {
    try {
        const protocol = proxy.type === 'SOCKS5' ? 'socks:' : 'http:'; // Agent 通常处理 http/https
        let auth = '';
        if (proxy.username && proxy.decryptedPassword) {
            // 对用户名和密码进行 URL 编码，以防包含特殊字符
            auth = `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.decryptedPassword)}@`;
        } else if (proxy.username) {
             auth = `${encodeURIComponent(proxy.username)}@`; // 只有用户名？
        }
        
        const urlString = `${protocol}//${auth}${proxy.host}:${proxy.port}`;
        return new URL(urlString);
    } catch (error) {
        console.error('Error formatting proxy URL:', error);
        return null;
    }
}


module.exports = {
    setupProxyIpcHandlers,
}; 