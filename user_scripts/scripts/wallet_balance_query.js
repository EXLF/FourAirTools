/**
 * 钱包余额查询脚本
 * 功能：批量查询选中钱包在不同链上的余额信息
 */

function getConfig() {
  return {
    id: "wallet_balance_query",
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
        default: "ethereum,USDT,0xdAC17F958D2ee523a2206206994597C13D831ec7\nethereum,USDC,0xA0b86a33E6417c8f4c8c8c8c8c8c8c8c8c8c8c8c",
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
  const { ethers } = require('ethers');
  
  console.info("🔍 开始批量查询钱包余额");
  
  try {
    // 验证输入
    if (!wallets || wallets.length === 0) {
      throw new Error("请选择至少一个钱包");
    }
    
    console.info(`📊 已选择 ${wallets.length} 个钱包进行余额查询`);
    
    // 解析配置
    const selectedChains = config.chains || ["ethereum"];
    const includeTokens = config.includeTokens || false;
    const exportFormat = config.exportFormat || "console";
    const intervalSeconds = config.intervalSeconds || 2;
    
    // 构建RPC配置
    const rpcConfig = {
      ethereum: "https://eth-mainnet.g.alchemy.com/v2/eOvLOWiFwLA0k3YIYnfJzmKrfUUO_dgo",
      bsc: "https://bsc-dataseed1.binance.org",
      polygon: "https://polygon-rpc.com",
      arbitrum: "https://arb1.arbitrum.io/rpc",
      optimism: "https://mainnet.optimism.io",
      base: "https://mainnet.base.org"
    };
    
    // 解析自定义RPC
    if (config.customRpc) {
      const customRpcLines = config.customRpc.split('\n');
      for (const line of customRpcLines) {
        if (line.trim()) {
          const [chainName, rpcUrl] = line.split(',').map(s => s.trim());
          if (chainName && rpcUrl) {
            rpcConfig[chainName] = rpcUrl;
            console.info(`🔗 使用自定义RPC: ${chainName} -> ${rpcUrl}`);
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
            if (!tokenConfig[chainName]) {
              tokenConfig[chainName] = [];
            }
            tokenConfig[chainName].push({ symbol, address });
          }
        }
      }
    }
    
    // 存储所有查询结果
    const allResults = [];
    
    // 遍历每个钱包
    for (let walletIndex = 0; walletIndex < wallets.length; walletIndex++) {
      const wallet = wallets[walletIndex];
      console.info(`\n💼 处理钱包 ${walletIndex + 1}/${wallets.length}: ${wallet.address}`);
      
      const walletResult = {
        address: wallet.address,
        name: wallet.name || `钱包${walletIndex + 1}`,
        chains: {}
      };
      
      // 遍历每个链
      for (const chainName of selectedChains) {
        console.info(`🔗 查询 ${chainName} 链余额...`);
        
        try {
          const rpcUrl = rpcConfig[chainName];
          if (!rpcUrl) {
            console.warn(`⚠️  未找到 ${chainName} 的RPC配置，跳过`);
            continue;
          }
          
          // 创建provider
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          
          const chainResult = {
            chainName,
            rpcUrl,
            nativeBalance: null,
            tokens: []
          };
          
          // 查询原生代币余额
          try {
            const balanceBigInt = await provider.getBalance(wallet.address);
            const balanceEther = ethers.formatEther(balanceBigInt);
            chainResult.nativeBalance = {
              raw: balanceBigInt.toString(),
              formatted: balanceEther,
              symbol: getNativeSymbol(chainName)
            };
            
            console.success(`✅ ${chainName} 原生代币余额: ${balanceEther} ${getNativeSymbol(chainName)}`);
          } catch (error) {
            console.error(`❌ 查询 ${chainName} 原生代币余额失败: ${error.message}`);
            chainResult.nativeBalance = { error: error.message };
          }
          
          // 查询代币余额
          if (includeTokens && tokenConfig[chainName]) {
            for (const token of tokenConfig[chainName]) {
              try {
                console.info(`🪙 查询代币 ${token.symbol} 余额...`);
                
                // ERC20 ABI (只需要 balanceOf 和 decimals)
                const erc20Abi = [
                  "function balanceOf(address owner) view returns (uint256)",
                  "function decimals() view returns (uint8)",
                  "function symbol() view returns (string)"
                ];
                
                const tokenContract = new ethers.Contract(token.address, erc20Abi, provider);
                
                // 获取代币信息
                const [balance, decimals, symbol] = await Promise.all([
                  tokenContract.balanceOf(wallet.address),
                  tokenContract.decimals(),
                  tokenContract.symbol()
                ]);
                
                const formattedBalance = ethers.formatUnits(balance, decimals);
                
                chainResult.tokens.push({
                  symbol: symbol || token.symbol,
                  address: token.address,
                  balance: {
                    raw: balance.toString(),
                    formatted: formattedBalance,
                    decimals: decimals
                  }
                });
                
                console.success(`✅ ${symbol || token.symbol} 余额: ${formattedBalance}`);
                
              } catch (error) {
                console.error(`❌ 查询代币 ${token.symbol} 余额失败: ${error.message}`);
                chainResult.tokens.push({
                  symbol: token.symbol,
                  address: token.address,
                  error: error.message
                });
              }
            }
          }
          
          walletResult.chains[chainName] = chainResult;
          
        } catch (error) {
          console.error(`❌ 查询 ${chainName} 链失败: ${error.message}`);
          walletResult.chains[chainName] = {
            chainName,
            error: error.message
          };
        }
        
        // 链之间的间隔
        if (selectedChains.indexOf(chainName) < selectedChains.length - 1) {
          await utils.delay(intervalSeconds * 1000);
        }
      }
      
      allResults.push(walletResult);
      
      // 钱包之间的间隔
      if (walletIndex < wallets.length - 1) {
        console.info(`⏳ 等待 ${intervalSeconds} 秒后处理下一个钱包...`);
        await utils.delay(intervalSeconds * 1000);
      }
    }
    
    // 输出结果
    console.info("\n📋 ===== 余额查询汇总 =====");
    outputResults(allResults, exportFormat);
    
    console.success("🎉 钱包余额查询完成!");
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
    console.error(`❌ 脚本执行失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 获取原生代币符号
function getNativeSymbol(chainName) {
  const symbols = {
    ethereum: "ETH",
    bsc: "BNB", 
    polygon: "MATIC",
    arbitrum: "ETH",
    optimism: "ETH",
    base: "ETH"
  };
  return symbols[chainName] || "ETH";
}

// 输出结果
function outputResults(results, format) {
  switch (format) {
    case "json":
      console.info("📄 JSON格式输出:");
      console.info(JSON.stringify(results, null, 2));
      break;
      
    case "csv":
      console.info("📊 CSV格式输出:");
      outputCSV(results);
      break;
      
    default:
      console.info("📋 控制台格式输出:");
      outputConsole(results);
      break;
  }
}

// 控制台格式输出
function outputConsole(results) {
  for (const wallet of results) {
    console.info(`\n💼 钱包: ${wallet.name} (${wallet.address})`);
    
    for (const [chainName, chainData] of Object.entries(wallet.chains)) {
      if (chainData.error) {
        console.error(`  ❌ ${chainName}: ${chainData.error}`);
        continue;
      }
      
      console.info(`  🔗 ${chainName}:`);
      
      if (chainData.nativeBalance) {
        if (chainData.nativeBalance.error) {
          console.error(`    ❌ 原生代币: ${chainData.nativeBalance.error}`);
        } else {
          console.info(`    💰 ${chainData.nativeBalance.symbol}: ${chainData.nativeBalance.formatted}`);
        }
      }
      
      if (chainData.tokens && chainData.tokens.length > 0) {
        for (const token of chainData.tokens) {
          if (token.error) {
            console.error(`    ❌ ${token.symbol}: ${token.error}`);
          } else {
            console.info(`    🪙 ${token.symbol}: ${token.balance.formatted}`);
          }
        }
      }
    }
  }
}

// CSV格式输出
function outputCSV(results) {
  console.info("钱包地址,钱包名称,链名称,代币符号,余额,合约地址");
  
  for (const wallet of results) {
    for (const [chainName, chainData] of Object.entries(wallet.chains)) {
      if (chainData.error) continue;
      
      // 原生代币
      if (chainData.nativeBalance && !chainData.nativeBalance.error) {
        console.info(`${wallet.address},${wallet.name},${chainName},${chainData.nativeBalance.symbol},${chainData.nativeBalance.formatted},原生代币`);
      }
      
      // 代币
      if (chainData.tokens) {
        for (const token of chainData.tokens) {
          if (!token.error) {
            console.info(`${wallet.address},${wallet.name},${chainName},${token.symbol},${token.balance.formatted},${token.address}`);
          }
        }
      }
    }
  }
}

module.exports = { getConfig, main }; 