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
    const { wallets, config, proxy: selectedProxy, http: httpClient, utils } = context; // 直接从 context 获取所需
    const { ethers } = require('ethers'); // 通过 require 获取 ethers

    console.info("开始查询钱包余额");
    
    try {
      // 检查钱包
      if (!wallets || wallets.length === 0) {
        console.error("请选择至少一个钱包");
        return { success: false, error: "请选择至少一个钱包" };
      }
      
      console.info(`已选择 ${wallets.length} 个钱包`);
      
      // 设置配置 - 使用 Alchemy RPC 作为默认值
      const rpcUrl = config.rpc_url || 'https://eth-mainnet.g.alchemy.com/v2/eOvLOWiFwLA0k3YIYnfJzmKrfUUO_dgo';
      const postUrl = config.post_url || "https://httpbin.org/post";
      
      console.info(`使用RPC: ${rpcUrl}`);
      console.info(`POST请求URL: ${postUrl}`);
      
      // 创建一个 provider
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      
      // 存储每个钱包的余额结果
      const results = [];
      
      // 依次查询每个钱包余额
      for (const wallet of wallets) {
        try {
          console.info(`正在查询钱包: ${wallet.address}`);
          
          // 查询余额
          const balanceBigInt = await provider.getBalance(wallet.address);
          const balanceEther = ethers.formatEther(balanceBigInt); // 使用解构的 ethers
          
          console.success(`钱包 ${wallet.address} 余额: ${balanceEther} ETH`);
          
          // 存储结果
          results.push({
            address: wallet.address,
            balance: balanceEther
          });
        } catch (error) {
          console.error(`查询钱包 ${wallet.address} 余额失败: ${error.message}`);
          results.push({
            address: wallet.address,
            error: error.message
          });
        }
      }
      
      // 发送POST请求 (使用选中的代理)
      try {
        console.info("正在发送POST请求...");
        
        const postData = {
          wallets: results,
          timestamp: new Date().toISOString(),
          client: "FourAir",
          version: "1.0.0"
        };
        
        const headers = {
          'Content-Type': 'application/json',
          'User-Agent': 'FourAir-Client/1.0',
          'Accept': 'application/json'
        };
        
        let requestOptions = { headers };

        if (selectedProxy && selectedProxy.url) { // 假设 selectedProxy 有 url 字段
            console.info(`使用代理: ${selectedProxy.url}`);
            // 注意：axios 的代理配置比较复杂，取决于代理类型 (http/https/socks)
            // 简单示例，具体需要根据 selectedProxy 的结构和 axios 文档调整
            try {
                const proxyUrl = new URL(selectedProxy.url);
                requestOptions.proxy = {
                    protocol: proxyUrl.protocol.slice(0, -1), // 'http' or 'https'
                    host: proxyUrl.hostname,
                    port: parseInt(proxyUrl.port, 10),
                };
                if (proxyUrl.username || proxyUrl.password) {
                    requestOptions.proxy.auth = {
                        username: proxyUrl.username,
                        password: proxyUrl.password,
                    };
                }
                console.info('代理配置已应用:', requestOptions.proxy);
            } catch (e) {
                console.error('解析代理URL失败:', e.message);
                // 可以选择在这里不使用代理继续，或者报错
            }
        } else {
            console.info('不使用代理或代理配置无效');
        }
              
        const response = await httpClient.post(postUrl, postData, requestOptions);
        
        console.success(`POST请求成功，状态码: ${response.status}`);
        console.info(`响应数据: ${JSON.stringify(response.data).substring(0, 200)}...`);

      } catch (postError) {
        console.error(`POST请求失败: ${postError.message}`);
        if (postError.response) {
          console.error(`HTTP错误状态码: ${postError.response.status}`);
          try {
            const errorDetail = typeof postError.response.data === 'string' 
              ? postError.response.data.replace(/\r\n/g, ' ').trim()
              : JSON.stringify(postError.response.data || {});
            console.error(`错误详情: ${errorDetail}`);
          } catch (e) {
            console.error(`错误详情无法解析: ${postError.response.data}`);
          }
        }
        // 不再在这里返回，让外层catch处理
        throw postError; // 重新抛出，以便外层能捕获并正确标记脚本失败
      }
      
      console.success("钱包余额查询及数据发送完成!");
      return { success: true, data: results };
      
    } catch (error) {
      console.error(`脚本执行遇到主错误: ${error.message}`);
      return { success: false, error: error.message };
    }
}

module.exports = { getConfig, main }; 