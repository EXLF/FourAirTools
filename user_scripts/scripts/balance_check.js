/**
 * 钱包余额查询脚本
 * 功能：使用选中的代理查询钱包余额并发送POST请求
 */
const axios = require('axios');
const { ethers } = require('ethers');

module.exports = {
  // 脚本元数据
  metadata: {
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
  },
  
  // 执行函数
  async execute(wallets, config, utils) {
    const { logger, http, proxy: selectedProxy } = utils;
    
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
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // 存储每个钱包的余额结果
      const results = [];
      
      // 依次查询每个钱包余额
      for (const wallet of wallets) {
        try {
          logger.info(`正在查询钱包: ${wallet.address}`);
          
          // 查询余额
          const balanceBigInt = await provider.getBalance(wallet.address);
          const balanceEther = ethers.formatEther(balanceBigInt);
          
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
        
        let axiosProxyConfig = null;
        if (selectedProxy) {
            // --- 从 selectedProxy 构建 axios 的代理配置 ---
            // selectedProxy 的结构可能类似 { type: 'HTTP', host: '...', port: ..., username?: '...', password?: '...' }
            // 注意：需要根据实际 selectedProxy 结构调整
            logger.info(`使用代理: ${selectedProxy.type}://${selectedProxy.host}:${selectedProxy.port}`);
            axiosProxyConfig = {
                protocol: selectedProxy.type ? selectedProxy.type.toLowerCase() : 'http', // 默认为 http
                host: selectedProxy.host,
                port: selectedProxy.port,
            };
            // 如果有认证信息
            if (selectedProxy.username && selectedProxy.password) {
                axiosProxyConfig.auth = {
                    username: selectedProxy.username,
                    password: selectedProxy.password
                };
            }
            // ------------------------------------------------
        } else {
            logger.warning("未选择代理，将直接发送POST请求。");
        }
        
        // 发送POST请求
        const response = await axios.post(postUrl, {
          wallets: results,
          timestamp: new Date().toISOString()
        }, {
          // --- 使用构建好的代理配置 ---
          proxy: axiosProxyConfig,
          // ---------------------------
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        logger.success(`POST请求成功，状态码: ${response.status}`);
        logger.info(`响应数据: ${JSON.stringify(response.data).substring(0, 200)}...`);
      } catch (error) {
        // --- 改进错误日志，区分代理连接错误和其他错误 ---
        if (error.code === 'ECONNREFUSED' || error.message.includes('connect ECONNREFUSED')) {
             logger.error(`POST请求失败：无法连接到代理服务器 ${selectedProxy ? selectedProxy.host + ':' + selectedProxy.port : ''}。请确保代理正在运行且配置正确。`);
        } else if (error.response) {
            // 请求已发出，但服务器响应状态码不在 2xx 范围
             logger.error(`POST请求失败：服务器响应错误 ${error.response.status} - ${error.response.statusText}`);
        } else if (error.request) {
             // 请求已发出，但没有收到响应
             logger.error(`POST请求失败：未收到服务器响应。检查网络连接或代理设置。`);
        } else {
            // 发生其他错误
            logger.error(`POST请求失败: ${error.message}`);
        }
        // -------------------------------------------------
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
}; 