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
    requires: {
      wallets: true,   // 需要钱包
      proxy: true      // 需要代理
    },
    platforms: ["ETH", "Arbitrum", "Optimism"],
    config: {
      rpc_url: {
        type: "string",
        label: "RPC节点URL",
        default: "https://rpc.ankr.com/eth"
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
    const { logger, http } = utils;
    
    logger.info("开始查询钱包余额");
    
    try {
      // 检查钱包
      if (!wallets || wallets.length === 0) {
        logger.error("请选择至少一个钱包");
        return { success: false, error: "请选择至少一个钱包" };
      }
      
      logger.info(`已选择 ${wallets.length} 个钱包`);
      
      // 设置配置
      const rpcUrl = config.rpc_url || "https://rpc.ankr.com/eth";
      const postUrl = config.post_url || "https://httpbin.org/post";
      
      logger.info(`使用RPC: ${rpcUrl}`);
      logger.info(`POST请求URL: ${postUrl}`);
      
      // 创建一个带代理的provider
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
      
      // 发送POST请求
      try {
        logger.info("正在发送POST请求...");
        
        // 创建代理配置
        const proxyConfig = {
          protocol: 'http',
          host: '127.0.0.1', // 这里应该使用选中的代理配置
          port: 7890
        };
        
        // 发送POST请求
        const response = await axios.post(postUrl, {
          wallets: results,
          timestamp: new Date().toISOString()
        }, {
          proxy: proxyConfig,
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        logger.success(`POST请求成功，状态码: ${response.status}`);
        logger.info(`响应数据: ${JSON.stringify(response.data).substring(0, 200)}...`);
      } catch (error) {
        logger.error(`POST请求失败: ${error.message}`);
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