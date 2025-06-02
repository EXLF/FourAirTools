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
  const ethers = require('ethers');
  const currentTimestamp = new Date().toISOString();
  // This console.log will go to wherever console.log from within vm2 sandbox goes.
  console.log(`[SCRIPT TOP GLOBAL CONSOLE] main() CALLED at ${currentTimestamp}. ExecutionID from context: ${context.executionId}, ScriptID: ${context.scriptId}`);

  const { config, wallets, utils, proxy, executionId, scriptId } = context;
  const logger = utils && utils.logger ? utils.logger : console;

  // === DETAILED LOGGER DEBUGGING START (These console.logs will also go to wherever console.log from vm2 sandbox goes) ===
  console.log(`[SCRIPT LOGGER DEBUG] typeof utils: ${typeof utils}, utils keys: ${utils ? Object.keys(utils).join(',') : 'N/A'}`);
  console.log(`[SCRIPT LOGGER DEBUG] typeof utils.logger: ${typeof utils?.logger}`);
  console.log(`[SCRIPT LOGGER DEBUG] typeof logger: ${typeof logger}`);
  if (logger && typeof logger.info === 'function') {
      console.log(`[SCRIPT LOGGER DEBUG] logger.info IS a function. Attempting to log via logger.info...`);
      logger.info(`[SCRIPT TOP INJECTED LOGGER - ATTEMPT 1 VIA LOGGER.INFO] Test log via injected logger at ${new Date().toISOString()}. ExecutionID: ${executionId}, ScriptID: ${scriptId}`);
  } else if (logger && typeof logger === 'object') { // logger is an object, but logger.info is not a function
      console.log(`[SCRIPT LOGGER DEBUG] logger IS an object, but logger.info IS NOT a function. typeof logger.info: ${typeof logger.info}. Keys of logger: ${Object.keys(logger).join(',')}`);
      // Attempt to call other methods if they exist, or stringify
      if (typeof logger.log === 'function') {
        logger.log(`[SCRIPT TOP INJECTED LOGGER - ATTEMPT 1 VIA LOGGER.LOG_FALLBACK] Test log at ${new Date().toISOString()}. ExecutionID: ${executionId}, ScriptID: ${scriptId}`);
      } else {
        console.log(`[SCRIPT TOP INJECTED LOGGER - ATTEMPT 1 VIA DIRECT_CONSOLE.LOG_FALLBACK_LOGGER_BAD_OBJ] Test log at ${new Date().toISOString()}. Logger object: ${JSON.stringify(logger)}`);
      }
  } else if (typeof logger === 'function') { // logger itself is the console.log function (e.g. utils or utils.logger was undefined)
      console.log(`[SCRIPT LOGGER DEBUG] logger IS a function (likely console.log). Attempting to log via logger()...`);
      logger(`[SCRIPT TOP INJECTED LOGGER - ATTEMPT 1 VIA LOGGER_IS_CONSOLE_LOG_FALLBACK] Test log at ${new Date().toISOString()}. ExecutionID: ${executionId}, ScriptID: ${scriptId}`);
  } else { // logger is undefined or null or some other primitive
      console.log(`[SCRIPT LOGGER DEBUG] logger IS ${typeof logger}. Falling back to global console.log`);
      console.log(`[SCRIPT TOP INJECTED LOGGER - ATTEMPT 1 VIA GLOBAL_CONSOLE.LOG_FALLBACK_BECAUSE_LOGGER_INVALID] Test log at ${new Date().toISOString()}. ExecutionID: ${executionId}, ScriptID: ${scriptId}`);
  }
  // === DETAILED LOGGER DEBUGGING END ===
  
  // Original problematic log line - let's keep it to see its behavior
  (logger.info || console.log)(`[SCRIPT TOP INJECTED LOGGER - ORIGINAL LINE] Test log via injected logger at ${new Date().toISOString()}. ExecutionID: ${executionId}, ScriptID: ${scriptId}`);

  logger.info("钱包余额查询脚本 (via logger INFO): 开始批量查询"); // This one also doesn't show up in UI, but later ones do.
  
  try {
    if (!wallets || wallets.length === 0) {
      (logger.error || logger.info)("钱包余额查询脚本 (via logger ERROR): 请选择至少一个钱包");
      throw new Error("请选择至少一个钱包");
    }
    
    logger.info(`钱包余额查询脚本 (via logger INFO): 已选择 ${wallets.length} 个钱包`);
    
    const selectedChains = config.chains || ["ethereum"];
    const includeTokens = config.includeTokens || false;
    const exportFormat = config.exportFormat || "console";
    const intervalSeconds = config.intervalSeconds || 2;
    
    const defaultConfiguredChains = getConfig().config.chains.options;
    const rpcConfig = {};
    defaultConfiguredChains.forEach(chain => {
      rpcConfig[chain.value] = chain.rpc;
    });
    
    if (config.customRpc) {
      const customRpcLines = config.customRpc.split('\n');
      for (const line of customRpcLines) {
        if (line.trim()) {
          const [chainName, rpcUrl] = line.split(',').map(s => s.trim());
          if (chainName && rpcUrl) {
            rpcConfig[chainName.toLowerCase()] = rpcUrl;
            logger.info(`钱包余额查询脚本 (via logger INFO): 使用自定义RPC: ${chainName} -> ${rpcUrl}`);
          }
        }
      }
    }
    
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
    
    const allResults = [];
    
    for (let walletIndex = 0; walletIndex < wallets.length; walletIndex++) {
      const wallet = wallets[walletIndex];
      const walletAddrDisplay = wallet.address ? wallet.address.substring(0,10) + '...' : 'N/A';
      logger.info(`钱包余额查询脚本 (via logger INFO): 处理钱包 ${walletIndex + 1}/${wallets.length}: ${walletAddrDisplay}`);
      
      const walletResult = {
        address: wallet.address,
        name: wallet.name || `钱包${walletIndex + 1}`,
        chains: {}
      };
      
      for (const chainKey of selectedChains) {
        const currentChainName = chainKey.toLowerCase();
        logger.info(`钱包余额查询脚本 (via logger INFO): 查询 ${currentChainName} 链余额...`);
        
        try {
          const rpcUrl = rpcConfig[currentChainName];
          if (!rpcUrl) {
            (logger.warn || logger.info)(`钱包余额查询脚本 (via logger WARN): 未找到 ${currentChainName} 的RPC配置，跳过`);
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
            (logger.success || logger.info)(`钱包余额查询脚本 (via logger SUCCESS): ${currentChainName} ${getNativeSymbol(currentChainName)}: ${balanceEther}`);
          } catch (error) {
            (logger.error || logger.info)(`钱包余额查询脚本 (via logger ERROR): 查询 ${currentChainName} 原生余额失败 - ${error.message}`);
            chainResult.nativeBalance = { error: error.message };
          }
          
          if (includeTokens && tokenConfig[currentChainName]) {
            for (const token of tokenConfig[currentChainName]) {
              try {
                logger.info(`钱包余额查询脚本 (via logger INFO): 查询代币 ${token.symbol} (${currentChainName})`);
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
                (logger.success || logger.info)(`钱包余额查询脚本 (via logger SUCCESS): ${symbol || token.symbol} (${currentChainName}): ${formattedBalance}`);
              } catch (error) {
                (logger.error || logger.info)(`钱包余额查询脚本 (via logger ERROR): 查询代币 ${token.symbol} (${currentChainName}) 失败 - ${error.message}`);
                chainResult.tokens.push({
                  symbol: token.symbol,
                  address: token.address,
                  error: error.message
                });
              }
            }
          }
          walletResult.chains[currentChainName] = chainResult;
        } catch (e) {
          (logger.error || logger.info)(`钱包余额查询脚本 (via logger ERROR): 处理 ${currentChainName} 链时发生意外错误 - ${e.message}`);
          walletResult.chains[currentChainName] = { chainName: currentChainName, error: e.message };
        }
        await utils.delay(intervalSeconds * 1000); // Interval between chains for a wallet
      }
      allResults.push(walletResult);
      // Interval between wallets (if configured, though not explicitly in this script's params)
      // await utils.delay(intervalSeconds * 1000); 
    }
    
    // Output results using the selected format
    outputResults(allResults, exportFormat, logger);
    
    return { success: true, data: allResults };
    
  } catch (error) {
    (logger.error || logger.info)(`钱包余额查询脚本 (via logger ERROR): 脚本主逻辑发生错误 - ${error.message}`);
    return { success: false, error: error.message, stack: error.stack };
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
    case 'json':
      // For JSON, we might just return the data, or log it stringified.
      // The script-completed event in scriptEngine already stringifies.
      logger.info("结果 (JSON):");
      logger.info(JSON.stringify(results, null, 2));
      break;
    case 'csv':
      outputCSV(results, logger);
      break;
    case 'console':
    default:
      outputConsole(results, logger);
      break;
  }
}

function outputConsole(results, logger) {
  logger.info("===== 钱包余额查询结果 =====");
  results.forEach(wallet => {
    logger.info(`
钱包: ${wallet.name} (${wallet.address})`);
    Object.values(wallet.chains).forEach(chain => {
      if (chain.error) {
        (logger.warn || logger.info)(`  ${chain.chainName}: 查询错误 - ${chain.error}`);
      } else {
        logger.info(`  ${chain.chainName} (${chain.rpcUrl}):`);
        if (chain.nativeBalance) {
          if (chain.nativeBalance.error) {
            (logger.warn || logger.info)(`    原生代币: 查询错误 - ${chain.nativeBalance.error}`);
          } else {
            logger.info(`    ${chain.nativeBalance.symbol}: ${chain.nativeBalance.formatted}`);
          }
        }
        if (chain.tokens && chain.tokens.length > 0) {
          logger.info("    代币余额:");
          chain.tokens.forEach(token => {
            if (token.error) {
              (logger.warn || logger.info)(`      ${token.symbol}: 查询错误 - ${token.error}`);
            } else {
              logger.info(`      ${token.symbol}: ${token.balance.formatted}`);
            }
          });
        }
      }
    });
  });
  logger.info("===========================");
}

function outputCSV(results, logger) {
  // ... (CSV output implementation, ensure it uses logger for any messages)
  logger.info("CSV输出功能暂未完全实现，将以控制台格式输出。"); // Placeholder
  outputConsole(results, logger);
}

module.exports = { main, getConfig }; 