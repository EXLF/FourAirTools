/**
 * 钱包余额查询脚本
 * 功能：使用选中的代理查询钱包余额并发送POST请求
 */
// const axios = require('axios'); // 将通过 context.api.axios 或 context.api.http 提供
// const { ethers } = require('ethers'); // 将通过 context.api.ethers 提供

function getConfig() {
  return {
    id: "wallet_balance_check",
    name: "钱包余额查询",
    description: "使用代理查询钱包余额并发送POST请求",
    version: "1.0.0",
    author: "FourAir",
    category: "钱包",
    icon: "wallet",  // FontAwesome图标
    imageUrl: "https://public.rootdata.com/images/b12/1739178949527.jpg",
    requires: {
      wallets: true,   // 需要钱包
      proxy: true      // 需要代理
    },
    platforms: ["ETH", "Arbitrum", "Optimism"],
    config: {
      rpc_url: {
        type: "string",
        label: "RPC节点URL",
        default: "https://eth-mainnet.g.alchemy.com/v2/eOvLOWiFwLA0k3YIYnfJzmKrfUUO_dgo"
      },
      post_url: {
        type: "string",
        label: "POST请求URL",
        default: "https://httpbin.org/post"
      }
    }
  };
}
  
// 执行函数
// async execute(wallets, config, utils) {
async function main(context) {
    const { wallets, params: config, api } = context;
    // const { logger, http, proxy: selectedProxy } = utils;
    const { logger, ethers, axios: httpClient, proxy: selectedProxy } = api; // 假设 api.axios 是 http客户端，或提供 api.http
    
    logger.info("开始查询钱包余额");
    
    try {
      // 检查钱包
      if (!wallets || wallets.length === 0) {
        logger.error("请选择至少一个钱包");
        return { success: false, error: "请选择至少一个钱包" };
      }
      
      logger.info(`已选择 ${wallets.length} 个钱包`);
      
      // 设置配置 - 使用 Alchemy RPC 作为默认值
      const rpcUrl = config.rpc_url || 'https://eth-mainnet.g.alchemy.com/v2/eOvLOWiFwLA0k3YIYnfJzmKrfUUO_dgo'; // <--- 替换默认 RPC
      const postUrl = config.post_url || "https://httpbin.org/post";
      
      logger.info(`使用RPC: ${rpcUrl}`);
      logger.info(`POST请求URL: ${postUrl}`);
      
      // 创建一个 provider (无需代理，查询余额通常不通过代理)
      const provider = new ethers.JsonRpcProvider(rpcUrl); // 使用 api.ethers
      
      // 存储每个钱包的余额结果
      const results = [];
      
      // 依次查询每个钱包余额
      for (const wallet of wallets) {
        try {
          logger.info(`正在查询钱包: ${wallet.address}`);
          
          // 查询余额
          const balanceBigInt = await provider.getBalance(wallet.address);
          const balanceEther = api.ethers.formatEther(balanceBigInt);
          
          logger.success(`钱包 ${wallet.address} 余额: ${balanceEther} ETH`);
          
          // 存储结果
          results.push({
            address: wallet.address,
            balance: balanceEther
          });
        } catch (error) {
          logger.error(`查询钱包 ${wallet.address} 余额失败: ${error.message}`);
          results.push({
            address: wallet.address,
            error: error.message
          });
        }
      }
      
      // 发送POST请求 (使用选中的代理)
      try {
        logger.info("正在发送POST请求...");
        
        // 构建更健壮的请求数据
        const postData = {
          wallets: results,
          timestamp: new Date().toISOString(),
          // 可以添加其他必要信息
          client: "FourAir",
          version: "1.0.0"
        };
        
        // 更完整的请求头
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'FourAir-Client/1.0',
          'Accept': 'application/json'
        };
        
        if (selectedProxy) {
            logger.info(`使用代理: ${selectedProxy.type}://${selectedProxy.host}:${selectedProxy.port}`);
            
            // 检查代理是否有认证信息
            if (selectedProxy.username && selectedProxy.password) {
              logger.info('代理配置包含认证信息');
            } else {
              logger.warning('代理配置不包含认证信息，可能导致部分服务访问受限');
            }

            // 在发送请求前先测试代理连通性
            try {
              logger.info('测试代理连通性...');
              
              // 确保使用正确的协议格式
              const testUrl = 'http://httpbin.org/ip'; // 使用HTTP协议而非HTTPS测试
              
              // 使用 httpClient (axios) 或 api.http
              const testResponse = await httpClient.get(testUrl, { 
                  // 代理配置需要根据 httpClient (axios) 的格式来调整
                  // 如果 selectedProxy 格式为 { host, port, username, password, protocol }
                  // axios 代理配置: httpsAgent (for https), httpAgent (for http), proxy (object { host, port, auth? })
                  // 这里假设 httpClient 支持直接传入 selectedProxy 对象，如果不是，需要转换格式
                  // 或者脚本引擎提供的 httpClient 已经封装了代理逻辑
                   proxy: selectedProxy && selectedProxy.url ? {
                       host: new URL(selectedProxy.url).hostname,
                       port: new URL(selectedProxy.url).port,
                       auth: selectedProxy.username && selectedProxy.password ? { username: selectedProxy.username, password: selectedProxy.password } : undefined,
                       protocol: new URL(selectedProxy.url).protocol.slice(0, -1) // 'http' or 'https'
                   } : false // 或者不传proxy让axios自己处理环境变量
              });
              logger.success(`代理测试成功，IP: ${JSON.stringify(testResponse.data)}`);
              
              // 请求成功后，使用正确的协议发起真正的请求
              // 检查目标URL的协议
              let targetUrl = postUrl;
              if (targetUrl.startsWith('https://') && selectedProxy.type === 'HTTP') {
                // 如果目标是HTTPS但代理是HTTP，修改为HTTP请求
                logger.warning('目标URL使用HTTPS但代理是HTTP，尝试使用HTTP协议发送请求');
                targetUrl = targetUrl.replace('https://', 'http://');
              }
              
              // 使用 httpClient (axios) 或 api.http
              const response = await httpClient.post(targetUrl, postData, { 
                  headers,
                  proxy: selectedProxy && selectedProxy.url ? { /* 同上 */ } : false
              });
              
              logger.success(`POST请求成功，状态码: ${response.status}`);
              logger.info(`响应数据: ${JSON.stringify(response.data).substring(0, 200)}...`);
            } catch (proxyError) {
              // 代理请求失败，记录详细错误
              logger.warning(`使用代理请求失败: ${proxyError.message}`);
              
              // 记录HTTP详细错误
              if (proxyError.response) {
                logger.error(`HTTP错误状态码: ${proxyError.response.status}`);
                
                try {
                  if (typeof proxyError.response.data === 'string') {
                    logger.error(`错误详情: ${proxyError.response.data.replace(/\r\n/g, ' ').trim()}`);
                  } else {
                    logger.error(`错误详情: ${JSON.stringify(proxyError.response.data || {})}`);
                  }
                } catch (e) {
                  logger.error(`错误详情无法解析: ${proxyError.response.data}`);
                }
                
                // 对于400错误特别处理
                if (proxyError.response.status === 400) {
                  const errorText = typeof proxyError.response.data === 'string' 
                    ? proxyError.response.data 
                    : JSON.stringify(proxyError.response.data);
                  
                  if (errorText.includes('HTTP request') && errorText.includes('HTTPS port')) {
                    logger.error('协议不匹配: HTTP请求被发送到HTTPS端口，尝试不使用代理');
                  } else {
                    logger.error('400 Bad Request: 请求格式不正确或缺少必要参数');
                  }
                } else if (proxyError.response.status === 401) {
                  logger.error('401 Unauthorized: 需要认证信息');
                } else if (proxyError.response.status === 403) {
                  logger.error('403 Forbidden: 无权访问，可能是API密钥无效或IP限制');
                } else if (proxyError.response.status === 429) {
                  logger.error('429 Too Many Requests: 请求过于频繁，被限流');
                }
              }
              
              // 尝试不使用代理
              logger.info('尝试不使用代理发送请求...');
              // 使用 httpClient (axios) 或 api.http
              const directResponse = await httpClient.post(postUrl, postData, { headers });
              logger.success(`不使用代理的请求成功，状态码: ${directResponse.status}`);
              logger.info(`响应数据: ${JSON.stringify(directResponse.data).substring(0, 200)}...`);
            }
        } else {
            logger.warning("未选择代理，将直接发送POST请求。");
            
            // 无代理发送请求
            const response = await httpClient.post(postUrl, postData, { headers });
            
            logger.success(`POST请求成功，状态码: ${response.status}`);
            logger.info(`响应数据: ${JSON.stringify(response.data).substring(0, 200)}...`);
        }
      } catch (error) {
        // 改进错误日志，更详细的错误信息
        if (error.code === 'ECONNREFUSED' || error.message.includes('connect ECONNREFUSED')) {
             logger.error(`POST请求失败：无法连接到代理服务器 ${selectedProxy ? selectedProxy.host + ':' + selectedProxy.port : ''}。请确保代理正在运行且配置正确。`);
        } else if (error.response) {
            // 请求已发出，但服务器响应状态码不在 2xx 范围
            logger.error(`POST请求失败：服务器响应错误 ${error.response.status} - ${error.response.statusText}`);
            
            // 记录错误详情
            if (error.response.data) {
              try {
                logger.error(`错误详情: ${JSON.stringify(error.response.data)}`);
              } catch (e) {
                logger.error(`错误详情无法解析为JSON`);
              }
            }
            
            // 特别处理常见的HTTP错误
            if (error.response.status === 400) {
              logger.error('建议检查请求数据格式是否符合API要求');
            } else if (error.response.status === 401 || error.response.status === 403) {
              logger.error('可能缺少必要的认证信息或API密钥无效');
            } else if (error.response.status === 429) {
              logger.error('请求过于频繁，被目标服务器限流');
            }
        } else if (error.request) {
             // 请求已发出，但没有收到响应
             logger.error(`POST请求失败：未收到服务器响应。检查网络连接或代理设置。`);
        } else {
            // 发生其他错误
            logger.error(`POST请求失败: ${error.message}`);
        }
      }
      
      logger.success("脚本执行完成");
      return { 
        success: true, 
        data: {
          wallets: results,
          requestTime: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error(`脚本执行失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

module.exports = { getConfig, main }; 