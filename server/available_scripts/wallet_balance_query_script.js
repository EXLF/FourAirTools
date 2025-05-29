/**
 * 钱包余额查询脚本
 * 功能：批量查询选中钱包在不同链上的余额信息
 */

function getConfig() {
  return {
    id: "wallet_balance_query_script",
    name: "钱包余额查询",
    description: "批量查询选中钱包的余额信息，支持多链查询",
    version: "1.0.0",
    author: "FourAir",
    category: "钱包工具",
    icon: "wallet",  // FontAwesome图标
    imageUrl: "https://public.rootdata.com/images/b6/1739179963586.jpg",
    requires: {
      wallets: true,   // 需要钱包
      proxy: false     // 不强制需要代理
    },
    // 声明此脚本需要通过沙箱 require() 加载的模块
    requiredModules: ["ethers"],
    platforms: ["Ethereum", "BSC", "Polygon", "Arbitrum", "Optimism", "Base"],
    config: {
      chains: {
        type: "multiselect",
        label: "查询链",
        options: [
          { value: "ethereum", label: "以太坊主网", rpc: "https://eth-mainnet.g.alchemy.com/v2/eOvLOWiFwLA0k3YIYnfJzmKrfUUO_dgo" },
          { value: "bsc", label: "BSC", rpc: "https://bsc-dataseed1.binance.org" },
          { value: "polygon", label: "Polygon", rpc: "https://polygon-rpc.com" },
          { value: "arbitrum", label: "Arbitrum", rpc: "https://arb1.arbitrum.io/rpc" },
          { value: "optimism", label: "Optimism", rpc: "https://mainnet.optimism.io" },
          { value: "base", label: "Base", rpc: "https://mainnet.base.org" }
        ],
        default: ["ethereum"]
      },
      customRpc: {
        type: "textarea",
        label: "自定义RPC节点 (可选，格式: 链名称,RPC地址)",
        default: "",
        placeholder: "ethereum,https://your-custom-rpc.com\nbsc,https://your-bsc-rpc.com"
      },
      includeTokens: {
        type: "checkbox",
        label: "查询常见代币余额",
        default: false
      },
      tokenAddresses: {
        type: "textarea",
        label: "代币合约地址 (每行一个，格式: 链名称,代币符号,合约地址)",
        default: "ethereum,USDT,0xdAC17F958D2ee523a2206206994597C13D831ec7\nethereum,USDC,0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        placeholder: "ethereum,USDT,0xdAC17F958D2ee523a2206206994597C13D831ec7"
      },
      exportFormat: {
        type: "select",
        label: "导出格式",
        options: [
          { value: "console", label: "控制台输出" },
          { value: "json", label: "JSON格式" },
          { value: "csv", label: "CSV格式" }
        ],
        default: "console"
      },
      intervalSeconds: {
        type: "number",
        label: "查询间隔(秒)",
        default: 2,
        min: 1,
        max: 10
      }
    }
  };
}

// 主执行函数
async function main(context) {
  const { config, wallets, utils, proxy } = context;
  // 修改模块加载方式
  const ethers = require('ethers'); 
  
  console.info("钱包余额查询脚本: 开始批量查询");
  
  try {
    // 验证输入
    if (!wallets || wallets.length === 0) {
      throw new Error("请选择至少一个钱包");
    }
    
    console.info(`钱包余额查询脚本: 已选择 ${wallets.length} 个钱包`);
    
    // 解析配置
    const selectedChains = config.chains || ["ethereum"];
    const includeTokens = config.includeTokens || false;
    const exportFormat = config.exportFormat || "console";
    const intervalSeconds = config.intervalSeconds || 2;
    
    // 构建RPC配置 (从 getConfig 中获取默认值)
    const defaultConfiguredChains = getConfig().config.chains.options;
    const rpcConfig = {};
    defaultConfiguredChains.forEach(chain => {
      rpcConfig[chain.value] = chain.rpc;
    });
    
    // 解析自定义RPC
    if (config.customRpc) {
      const customRpcLines = config.customRpc.split('\n');
      for (const line of customRpcLines) {
        if (line.trim()) {
          const [chainName, rpcUrl] = line.split(',').map(s => s.trim());
          if (chainName && rpcUrl) {
            rpcConfig[chainName.toLowerCase()] = rpcUrl;
            console.info(`钱包余额查询脚本: 使用自定义RPC: ${chainName} -> ${rpcUrl}`);
          }
        }
      }
    }
    
    // 解析代币配置
    const tokenConfig = {};
    if (includeTokens && config.tokenAddresses) {
      const tokenLines = config.tokenAddresses.split('\n');
      for (const line of tokenLines) {
        if (line.trim()) {
          const [chainName, symbol, address] = line.split(',').map(s => s.trim());
          if (chainName && symbol && address) {
            const lowerChainName = chainName.toLowerCase();
            if (!tokenConfig[lowerChainName]) {
              tokenConfig[lowerChainName] = [];
            }
            tokenConfig[lowerChainName].push({ symbol, address });
          }
        }
      }
    }
    
    // 存储所有查询结果
    const allResults = [];
    
    // 遍历每个钱包
    for (let walletIndex = 0; walletIndex < wallets.length; walletIndex++) {
      const wallet = wallets[walletIndex];
      const walletAddrDisplay = wallet.address ? wallet.address.substring(0,10) + '...' : 'N/A';
      console.info(`钱包余额查询脚本: 处理钱包 ${walletIndex + 1}/${wallets.length}: ${walletAddrDisplay}`);
      
      const walletResult = {
        address: wallet.address,
        name: wallet.name || `钱包${walletIndex + 1}`,
        chains: {}
      };
      
      // 遍历每个链
      for (const chainKey of selectedChains) {
        const currentChainName = chainKey.toLowerCase();
        console.info(`钱包余额查询脚本: 查询 ${currentChainName} 链余额...`);
        
        try {
          const rpcUrl = rpcConfig[currentChainName];
          if (!rpcUrl) {
            console.warn(`钱包余额查询脚本: 未找到 ${currentChainName} 的RPC配置，跳过`);
            walletResult.chains[currentChainName] = { chainName: currentChainName, error: `RPC not configured for ${currentChainName}` };
            continue;
          }
          
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          
          const chainResult = {
            chainName: currentChainName,
            rpcUrl,
            nativeBalance: null,
            tokens: []
          };
          
          try {
            const balanceBigInt = await provider.getBalance(wallet.address);
            const balanceEther = ethers.formatEther(balanceBigInt);
            chainResult.nativeBalance = {
              raw: balanceBigInt.toString(),
              formatted: balanceEther,
              symbol: getNativeSymbol(currentChainName)
            };
            console.success(`钱包余额查询脚本: ${currentChainName} ${getNativeSymbol(currentChainName)}: ${balanceEther}`);
          } catch (error) {
            console.error(`钱包余额查询脚本: 查询 ${currentChainName} 原生余额失败 - ${error.message}`);
            chainResult.nativeBalance = { error: error.message };
          }
          
          if (includeTokens && tokenConfig[currentChainName]) {
            for (const token of tokenConfig[currentChainName]) {
              try {
                console.info(`钱包余额查询脚本: 查询代币 ${token.symbol} (${currentChainName})`);
                
                const erc20Abi = [
                  "function balanceOf(address owner) view returns (uint256)",
                  "function decimals() view returns (uint8)",
                  "function symbol() view returns (string)"
                ];
                
                const tokenContract = new ethers.Contract(token.address, erc20Abi, provider);
                
                const [balance, decimalsBN, symbol] = await Promise.all([
                  tokenContract.balanceOf(wallet.address),
                  tokenContract.decimals(),
                  tokenContract.symbol()
                ]);
                
                const decimals = Number(decimalsBN);
                const formattedBalance = ethers.formatUnits(balance, decimals);
                
                chainResult.tokens.push({
                  symbol: symbol || token.symbol,
                  address: token.address,
                  balance: {
                    raw: balance.toString(),
                    formatted: formattedBalance,
                    decimals
                  }
                });
                console.success(`钱包余额查询脚本: ${symbol || token.symbol} (${currentChainName}): ${formattedBalance}`);
                
              } catch (error) {
                console.error(`钱包余额查询脚本: 查询代币 ${token.symbol} (${currentChainName}) 失败 - ${error.message}`);
                chainResult.tokens.push({
                  symbol: token.symbol,
                  address: token.address,
                  error: error.message
                });
              }
            }
          }
          
          walletResult.chains[currentChainName] = chainResult;
          
        } catch (error) {
          console.error(`钱包余额查询脚本: 查询 ${currentChainName} 链失败 - ${error.message}`);
          walletResult.chains[currentChainName] = {
            chainName: currentChainName,
            error: error.message
          };
        }
        
        if (selectedChains.indexOf(chainKey) < selectedChains.length - 1) {
          await utils.delay(intervalSeconds * 1000);
        }
      }
      
      allResults.push(walletResult);
      
      if (walletIndex < wallets.length - 1) {
        console.info(`钱包余额查询脚本: 等待 ${intervalSeconds} 秒后处理下一个钱包...`);
        await utils.delay(intervalSeconds * 1000);
      }
    }
    
    console.info("钱包余额查询脚本: ===== 余额查询汇总 ====");
    outputResults(allResults, exportFormat, console);
    
    console.success("钱包余额查询脚本: 查询完成!");
    return { 
      success: true, 
      data: allResults,
      summary: {
        totalWallets: wallets.length,
        totalChains: selectedChains.length,
        includeTokens: includeTokens
      }
    };
    
  } catch (error) {
    console.error(`钱包余额查询脚本: 执行失败 - ${error.message}`);
    return { success: false, error: error.message };
  }
}

function getNativeSymbol(chainName) {
  const symbols = {
    ethereum: "ETH",
    bsc: "BNB", 
    polygon: "MATIC",
    arbitrum: "ETH",
    optimism: "ETH",
    base: "ETH"
  };
  return symbols[chainName.toLowerCase()] || "ETH"; // 确保 chainName 比较时为小写
}

function outputResults(results, format, logger) {
  switch (format) {
    case "json":
      logger.info("钱包余额查询脚本: JSON格式输出 (部分预览，完整见主进程控制台):");
      const jsonResults = JSON.stringify(results, null, 2);
      logger.info(jsonResults.substring(0, 1000) + (jsonResults.length > 1000 ? "..." : ""));
      break;
      
    case "csv":
      logger.info("钱包余额查询脚本: CSV格式输出 (见主进程控制台):");
      outputCSV(results, logger);
      break;
      
    default: // console
      logger.info("钱包余额查询脚本: 控制台格式输出:");
      outputConsole(results, logger);
      break;
  }
}

function outputConsole(results, logger) {
  results.forEach(wallet => {
    const walletHeader = `\n💼 钱包: ${wallet.name} (${wallet.address})`;
    logger.info(`[DEBUG_CONSOLE] walletHeader: ${walletHeader}`);
    logger.info(walletHeader);
    
    Object.entries(wallet.chains).forEach(([chainName, chainData]) => {
      const chainHeader = `  🔗 ${chainName}:`;
      logger.info(`[DEBUG_CONSOLE] chainHeader: ${chainHeader}`);
      logger.info(chainHeader);
      
      if (chainData.error) {
        const errorMsg = `    ❌ 错误: ${chainData.error}`;
        logger.error(`[DEBUG_CONSOLE] errorMsg: ${errorMsg}`);
        logger.error(errorMsg);
        return;
      }
      
      if (chainData.nativeBalance) {
        const nativeMsg = chainData.nativeBalance.error ? `    ❌ 原生代币: ${chainData.nativeBalance.error}` : `    💰 ${chainData.nativeBalance.symbol}: ${chainData.nativeBalance.formatted}`;
        logger.info(`[DEBUG_CONSOLE] nativeMsg: ${nativeMsg}`);
        (chainData.nativeBalance.error ? logger.error : logger.info)(nativeMsg);
      }
      
      if (chainData.tokens && chainData.tokens.length > 0) {
        for (const token of chainData.tokens) {
          const tokenMsg = token.error ? `    ❌ ${token.symbol}: ${token.error}` : `    🪙 ${token.symbol}: ${token.balance.formatted}`;
          logger.info(`[DEBUG_CONSOLE] tokenMsg: ${tokenMsg}`);
          (token.error ? logger.error : logger.info)(tokenMsg);
        }
      }
    });
  });
}

function outputCSV(results, logger) {
  const header = "钱包地址,钱包名称,链名称,代币符号,余额,合约地址";
  logger.info(`[DEBUG_CSV] header: ${header}`);
  logger.info(header);
  
  results.forEach(wallet => {
    Object.entries(wallet.chains).forEach(([chainName, chainData]) => {
      if (chainData.error) return;
      
      if (chainData.nativeBalance && !chainData.nativeBalance.error) {
        const line = `${wallet.address},${wallet.name},${chainName},${chainData.nativeBalance.symbol},${chainData.nativeBalance.formatted},原生代币`;
        logger.info(`[DEBUG_CSV] native line: ${line}`);
        logger.info(line);
      }
      
      if (chainData.tokens) {
        for (const token of chainData.tokens) {
          if (!token.error) {
            const line = `${wallet.address},${wallet.name},${chainName},${token.symbol},${token.balance.formatted},${token.address}`;
            logger.info(`[DEBUG_CSV] token line: ${line}`);
            logger.info(line);
          }
        }
      }
    });
  });
}

module.exports = { getConfig, main }; 