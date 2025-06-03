/**
 * Web3多链协议脚本示例
 * 演示FourAir预装模块在Web3开发中的应用
 * 支持以太坊、Solana、Polkadot等多链协议
 */

function getConfig() {
  return {
    id: "web3_multichain_demo",
    name: "Web3多链协议演示",
    description: "展示多链Web3协议开发，包含余额查询、DeFi交互、跨链桥接等功能",
    version: "1.0.0",
    author: "FourAir开发团队",
    category: "Web3协议",
    icon: "fas fa-link",
    
    requires: {
      wallets: true,
      proxy: false
    },
    
    // 声明使用的预装模块
    requiredModules: [
      // Node.js核心模块
      "crypto", "path", "url", "util",
      
      // 区块链开发库
      "ethers", "web3", "web3-utils", "bip39", "ethereumjs-wallet",
      
      // 以太坊生态
      "@ethersproject/contracts", "@ethersproject/providers", 
      "@ethersproject/wallet", "@ethersproject/units",
      
      // Solana生态
      "@solana/web3.js",
      
      // Polkadot生态
      "@polkadot/api", "@polkadot/util", "@polkadot/util-crypto",
      
      // 数学和工具库
      "bn.js", "big.js", "decimal.js", "moment", "uuid", "lodash",
      
      // 数据验证
      "joi", "jsonschema", "semver",
      
      // 异步控制
      "retry", "p-limit", "p-queue"
    ],
    
    // 配置参数 - 修改为对象格式以兼容前端
    config: {
      targetChain: {
        type: "select",
        label: "目标区块链",
        description: "选择要操作的区块链网络",
        required: true,
        default: "ethereum",
        options: [
          { value: "ethereum", label: "以太坊 (Ethereum)" },
          { value: "solana", label: "索拉纳 (Solana)" },
          { value: "polkadot", label: "波卡 (Polkadot)" },
          { value: "multichain", label: "多链操作" }
        ]
      },
      operationType: {
        type: "select",
        label: "操作类型",
        description: "选择要执行的操作",
        required: true,
        default: "balance_check",
        options: [
          { value: "balance_check", label: "余额查询" },
          { value: "token_analysis", label: "代币分析" },
          { value: "defi_interaction", label: "DeFi协议交互" },
          { value: "cross_chain", label: "跨链操作" },
          { value: "portfolio_analysis", label: "投资组合分析" }
        ]
      },
      ethereumRpc: {
        type: "text",
        label: "以太坊RPC地址",
        description: "以太坊网络RPC节点URL",
        required: false,
        default: "https://rpc.ankr.com/eth"
      },
      solanaRpc: {
        type: "text",
        label: "Solana RPC地址",
        description: "Solana网络RPC节点URL",
        required: false,
        default: "https://api.mainnet-beta.solana.com"
      },
      polkadotRpc: {
        type: "text",
        label: "Polkadot RPC地址",
        description: "Polkadot网络RPC节点URL（WebSocket）",
        required: false,
        default: "wss://rpc.polkadot.io"
      },
      batchSize: {
        type: "number",
        label: "批处理大小",
        description: "每批处理的钱包数量",
        required: true,
        default: 5,
        min: 1,
        max: 20
      },
      delayBetweenRequests: {
        type: "number",
        label: "请求间延迟(毫秒)",
        description: "请求之间的延迟时间",
        required: true,
        default: 1000,
        min: 500,
        max: 5000
      },
      enableDetailedLogs: {
        type: "checkbox",
        label: "启用详细日志",
        description: "显示详细的执行日志",
        default: true
      }
    }
  };
}

async function main(context) {
  const { config, wallets, utils, storage } = context;
  
  console.log('🚀 开始执行Web3多链协议演示');
  console.log('🔍 接收到的配置:', JSON.stringify(config, null, 2));
  console.log(`💼 钱包数量: ${wallets.length}`);
  
  // 设置默认配置
  const defaultConfig = {
    targetChain: 'ethereum',
    operationType: 'balance_check',
    ethereumRpc: 'https://rpc.ankr.com/eth',
    solanaRpc: 'https://api.mainnet-beta.solana.com',
    polkadotRpc: 'wss://rpc.polkadot.io',
    batchSize: 5,
    delayBetweenRequests: 1000,
    enableDetailedLogs: true
  };
  
  // 合并配置
  const finalConfig = { ...defaultConfig, ...config };
  
  console.log(`🎯 目标链: ${finalConfig.targetChain}`);
  console.log(`⚙️ 操作类型: ${finalConfig.operationType}`);
  console.log('📋 最终配置:', JSON.stringify(finalConfig, null, 2));
  
  try {
    // 初始化工具模块
    const modules = await initializeModules();
    const { 
      crypto, ethers, moment, uuid, 
      lodash: _, bn: BN, big: Big 
    } = modules;
    const Web3 = modules.Web3;
    
    // 生成执行会话
    const sessionId = uuid.v4();
    const startTime = moment();
    
    console.log(`📝 会话ID: ${sessionId.substring(0, 8)}`);
    console.log(`⏰ 开始时间: ${startTime.format('YYYY-MM-DD HH:mm:ss')}`);
    
    // 初始化统计数据
    const stats = {
      sessionId,
      startTime,
      total: wallets.length,
      processed: 0,
      successful: 0,
      failed: 0,
      results: [],
      errors: []
    };
    
    // 存储会话信息
    await storage.setItem('currentSession', {
      id: sessionId,
      startTime: startTime.toISOString(),
      config: finalConfig
    });
    
    // 创建新的context，使用最终配置
    const enhancedContext = {
      ...context,
      config: finalConfig
    };
    
    // 根据目标链执行操作
    switch (finalConfig.targetChain) {
      case 'ethereum':
        await executeEthereumOperations(enhancedContext, stats);
        break;
      case 'solana':
        await executeSolanaOperations(enhancedContext, stats);
        break;
      case 'polkadot':
        await executePolkadotOperations(enhancedContext, stats);
        break;
      case 'multichain':
        await executeMultichainOperations(enhancedContext, stats);
        break;
      default:
        throw new Error(`不支持的区块链: ${finalConfig.targetChain}`);
    }
    
    // 生成执行报告
    await generateExecutionReport(enhancedContext, stats);
    
    console.log('✅ Web3多链协议演示执行完成');
    return {
      success: true,
      message: '执行成功',
      data: {
        sessionId,
        processed: stats.processed,
        successful: stats.successful,
        failed: stats.failed
      }
    };
    
  } catch (error) {
    console.log(`❌ 脚本执行失败: ${error.message}`);
    throw error;
  }
}

/**
 * 初始化所需模块
 */
async function initializeModules() {
  const modules = {};
  
  try {
    console.log('🔧 开始逐步初始化模块...');
    
    // Node.js核心模块
    try {
      modules.crypto = require('crypto');
      console.log('✅ crypto 模块加载成功');
    } catch (e) {
      console.log('❌ crypto 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.path = require('path');
      console.log('✅ path 模块加载成功');
    } catch (e) {
      console.log('❌ path 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.url = require('url');
      console.log('✅ url 模块加载成功');
    } catch (e) {
      console.log('❌ url 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.util = require('util');
      console.log('✅ util 模块加载成功');
    } catch (e) {
      console.log('❌ util 模块加载失败:', e.message);
      throw e;
    }
    
    // 区块链开发库
    try {
      modules.ethers = require('ethers');
      console.log('✅ ethers 模块加载成功');
    } catch (e) {
      console.log('❌ ethers 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      const Web3Module = require('web3');
      // 处理Web3.js v4的导入方式变化
      modules.Web3 = Web3Module.default || Web3Module.Web3 || Web3Module;
      console.log('✅ web3 模块加载成功');
    } catch (e) {
      console.log('❌ web3 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.webUtils = require('web3-utils');
      console.log('✅ web3-utils 模块加载成功');
    } catch (e) {
      console.log('❌ web3-utils 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.bip39 = require('bip39');
      console.log('✅ bip39 模块加载成功');
    } catch (e) {
      console.log('❌ bip39 模块加载失败:', e.message);
      throw e;
    }
    
    // 数学和工具库（先加载这些，跳过problematic的@ethersproject模块）
    try {
      modules.bn = require('bn.js');
      console.log('✅ bn.js 模块加载成功');
    } catch (e) {
      console.log('❌ bn.js 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.big = require('big.js');
      console.log('✅ big.js 模块加载成功');
    } catch (e) {
      console.log('❌ big.js 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.decimal = require('decimal.js');
      console.log('✅ decimal.js 模块加载成功');
    } catch (e) {
      console.log('❌ decimal.js 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.moment = require('moment');
      console.log('✅ moment 模块加载成功');
    } catch (e) {
      console.log('❌ moment 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.uuid = require('uuid');
      console.log('✅ uuid 模块加载成功');
    } catch (e) {
      console.log('❌ uuid 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.lodash = require('lodash');
      console.log('✅ lodash 模块加载成功');
    } catch (e) {
      console.log('❌ lodash 模块加载失败:', e.message);
      throw e;
    }
    
    // 数据验证
    try {
      modules.joi = require('joi');
      console.log('✅ joi 模块加载成功');
    } catch (e) {
      console.log('❌ joi 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.jsonschema = require('jsonschema');
      console.log('✅ jsonschema 模块加载成功');
    } catch (e) {
      console.log('❌ jsonschema 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.semver = require('semver');
      console.log('✅ semver 模块加载成功');
    } catch (e) {
      console.log('❌ semver 模块加载失败:', e.message);
      throw e;
    }
    
    // 异步控制
    try {
      modules.retry = require('retry');
      console.log('✅ retry 模块加载成功');
    } catch (e) {
      console.log('❌ retry 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.pLimit = require('p-limit');
      console.log('✅ p-limit 模块加载成功');
    } catch (e) {
      console.log('❌ p-limit 模块加载失败:', e.message);
      throw e;
    }
    
    try {
      modules.pQueue = require('p-queue');
      console.log('✅ p-queue 模块加载成功');
    } catch (e) {
      console.log('❌ p-queue 模块加载失败:', e.message);
      throw e;
    }
    
    console.log('✅ 核心模块初始化成功');
    
    // 尝试加载@ethersproject模块（可选，如果失败不中断整个流程）
    console.log('🔧 开始尝试加载@ethersproject模块...');
    
    try {
      console.log('🔧 尝试加载 @ethersproject/contracts...');
      modules.ethersContracts = require('@ethersproject/contracts');
      console.log('✅ @ethersproject/contracts 模块加载成功');
    } catch (e) {
      console.log('⚠️ @ethersproject/contracts 模块加载失败，将使用ethers内置功能:', e.message);
      modules.ethersContracts = null;
    }
    
    try {
      console.log('🔧 尝试加载 @ethersproject/providers...');
      modules.ethersProviders = require('@ethersproject/providers');
      console.log('✅ @ethersproject/providers 模块加载成功');
    } catch (e) {
      console.log('⚠️ @ethersproject/providers 模块加载失败，将使用ethers内置功能:', e.message);
      modules.ethersProviders = null;
    }
    
    try {
      console.log('🔧 尝试加载 @ethersproject/wallet...');
      modules.ethersWallet = require('@ethersproject/wallet');
      console.log('✅ @ethersproject/wallet 模块加载成功');
    } catch (e) {
      console.log('⚠️ @ethersproject/wallet 模块加载失败，将使用ethers内置功能:', e.message);
      modules.ethersWallet = null;
    }
    
    try {
      console.log('🔧 尝试加载 @ethersproject/units...');
      modules.ethersUnits = require('@ethersproject/units');
      console.log('✅ @ethersproject/units 模块加载成功');
    } catch (e) {
      console.log('⚠️ @ethersproject/units 模块加载失败，将使用ethers内置功能:', e.message);
      modules.ethersUnits = null;
    }
    
    // 尝试加载可选模块
    try {
      modules.solanaWeb3 = require('@solana/web3.js');
      console.log('✅ Solana模块可用');
    } catch (e) {
      console.log('⚠️ Solana模块不可用，将跳过Solana相关功能:', e.message);
    }
    
    try {
      modules.polkadotApi = require('@polkadot/api');
      modules.polkadotUtil = require('@polkadot/util');
      modules.polkadotUtilCrypto = require('@polkadot/util-crypto');
      console.log('✅ Polkadot模块可用');
    } catch (e) {
      console.log('⚠️ Polkadot模块不可用，将跳过Polkadot相关功能:', e.message);
    }
    
    console.log('🎉 模块初始化过程完成');
    return modules;
    
  } catch (error) {
    console.log('💥 模块初始化过程中发生严重错误:', error.message);
    throw new Error(`模块初始化失败: ${error.message}`);
  }
}

/**
 * 执行以太坊操作
 */
async function executeEthereumOperations(context, stats) {
  const { config, wallets, utils } = context;
  const ethers = require('ethers');
  const Web3Module = require('web3');
  const Web3 = Web3Module.default || Web3Module.Web3 || Web3Module;
  const _ = require('lodash');
  const pLimit = require('p-limit');
  
  console.log('🔷 开始以太坊链操作...');
  
  try {
    // 创建提供者
    const provider = new ethers.JsonRpcProvider(config.ethereumRpc);
    const web3 = new Web3(config.ethereumRpc);
    
    // 测试网络连接
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    
    console.log(`🌐 已连接到以太坊网络: ${network.name} (ChainID: ${network.chainId})`);
    console.log(`📦 当前区块: ${blockNumber}`);
    
    // 并发控制
    const limit = pLimit(config.batchSize);
    
    // 分批处理钱包
    const batches = _.chunk(wallets, config.batchSize);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`📦 处理第 ${batchIndex + 1}/${batches.length} 批 (${batch.length} 个钱包)`);
      
      const batchPromises = batch.map(wallet => 
        limit(async () => {
          try {
            const result = await processEthereumWallet(provider, web3, wallet, config);
            stats.successful++;
            stats.results.push(result);
            
            if (config.enableDetailedLogs) {
              console.log(`✅ ${wallet.address}: ETH余额 ${result.ethBalance}`);
            }
            
            return result;
          } catch (error) {
            stats.failed++;
            stats.errors.push({
              address: wallet.address,
              error: error.message
            });
            console.log(`❌ ${wallet.address}: ${error.message}`);
            throw error;
          } finally {
            stats.processed++;
          }
        })
      );
      
      await Promise.allSettled(batchPromises);
      
      // 进度显示
      const progress = ((batchIndex + 1) / batches.length * 100).toFixed(1);
      console.log(`📊 进度: ${progress}% (${stats.processed}/${stats.total})`);
      
      // 批次间延迟
      if (batchIndex < batches.length - 1) {
        await utils.delay(config.delayBetweenRequests);
      }
    }
    
  } catch (error) {
    console.log(`❌ 以太坊操作失败: ${error.message}`);
    throw error;
  }
}

/**
 * 处理单个以太坊钱包
 */
async function processEthereumWallet(provider, web3, wallet, config) {
  // 尝试使用@ethersproject/units，如果不可用则使用ethers内置的
  let formatEther;
  try {
    const unitsModule = require('@ethersproject/units');
    formatEther = unitsModule.formatEther;
  } catch (e) {
    // 回退到ethers内置的formatEther
    const ethers = require('ethers');
    formatEther = ethers.formatEther;
  }
  
  // 验证地址格式
  const ethers = require('ethers');
  if (!ethers.isAddress(wallet.address)) {
    throw new Error('无效的以太坊地址');
  }
  
  const result = {
    address: wallet.address,
    name: wallet.name || '未命名钱包',
    chain: 'ethereum'
  };
  
  // 查询ETH余额
  const balance = await provider.getBalance(wallet.address);
  result.ethBalance = formatEther(balance);
  
  // 查询交易计数
  const txCount = await provider.getTransactionCount(wallet.address);
  result.transactionCount = txCount;
  
  // 根据操作类型执行不同功能
  switch (config.operationType) {
    case 'balance_check':
      await performBalanceCheck(provider, wallet.address, result);
      break;
    case 'token_analysis':
      await performTokenAnalysis(provider, wallet.address, result);
      break;
    case 'defi_interaction':
      await performDeFiAnalysis(provider, wallet.address, result);
      break;
    case 'portfolio_analysis':
      await performPortfolioAnalysis(provider, wallet.address, result);
      break;
  }
  
  return result;
}

/**
 * 执行余额检查
 */
async function performBalanceCheck(provider, address, result) {
  // 检查是否为合约地址
  const code = await provider.getCode(address);
  result.isContract = code !== '0x';
  
  // 如果是EOA，获取最新交易信息
  if (!result.isContract && result.transactionCount > 0) {
    try {
      // 这里可以添加获取最新交易的逻辑
      result.lastActivity = '最近有交易活动';
    } catch (error) {
      result.lastActivity = '无法获取交易历史';
    }
  }
}

/**
 * 执行代币分析
 */
async function performTokenAnalysis(provider, address, result) {
  // 这里可以添加代币分析逻辑
  result.tokenAnalysis = {
    message: '代币分析功能待实现',
    supportedTokens: ['USDT', 'USDC', 'DAI', 'WETH']
  };
}

/**
 * 执行DeFi分析
 */
async function performDeFiAnalysis(provider, address, result) {
  result.defiAnalysis = {
    message: 'DeFi分析功能待实现',
    protocols: ['Uniswap', 'Aave', 'Compound', 'MakerDAO']
  };
}

/**
 * 执行投资组合分析
 */
async function performPortfolioAnalysis(provider, address, result) {
  result.portfolioAnalysis = {
    message: '投资组合分析功能待实现',
    totalValue: 'USD $0.00',
    diversification: '待计算'
  };
}

/**
 * 执行Solana操作
 */
async function executeSolanaOperations(context, stats) {
  console.log('🟣 开始Solana链操作...');
  
  try {
    const { Connection, PublicKey } = require('@solana/web3.js');
    
    // 创建连接
    const connection = new Connection(context.config.solanaRpc, 'confirmed');
    
    // 测试连接
    const version = await connection.getVersion();
    console.log(`🌐 已连接到Solana网络，版本: ${version['solana-core']}`);
    
    // 处理钱包
    for (const wallet of context.wallets) {
      try {
        const publicKey = new PublicKey(wallet.address);
        const balance = await connection.getBalance(publicKey);
        const solBalance = (balance / 1e9).toFixed(6);
        
        stats.processed++;
        stats.successful++;
        stats.results.push({
          address: wallet.address,
          name: wallet.name,
          chain: 'solana',
          balance: `${solBalance} SOL`
        });
        
        console.log(`✅ ${wallet.address}: ${solBalance} SOL`);
        
      } catch (error) {
        stats.processed++;
        stats.failed++;
        stats.errors.push({
          address: wallet.address,
          error: error.message
        });
        console.log(`❌ ${wallet.address}: ${error.message}`);
      }
      
      await context.utils.delay(context.config.delayBetweenRequests);
    }
    
  } catch (error) {
    console.log(`❌ Solana操作失败: ${error.message}`);
    if (error.message.includes('Cannot resolve module')) {
      console.log('💡 提示: Solana模块可能未安装，请检查系统依赖');
    }
    throw error;
  }
}

/**
 * 执行Polkadot操作
 */
async function executePolkadotOperations(context, stats) {
  console.log('🔴 开始Polkadot链操作...');
  
  try {
    const { ApiPromise, WsProvider } = require('@polkadot/api');
    const { cryptoWaitReady } = require('@polkadot/util-crypto');
    
    // 等待加密库就绪
    await cryptoWaitReady();
    
    // 创建API连接
    const wsProvider = new WsProvider(context.config.polkadotRpc);
    const api = await ApiPromise.create({ provider: wsProvider });
    
    // 获取链信息
    const chain = await api.rpc.system.chain();
    console.log(`🌐 已连接到 ${chain} 网络`);
    
    // 处理钱包
    for (const wallet of context.wallets) {
      try {
        const account = await api.query.system.account(wallet.address);
        const balance = account.data.free.toString();
        
        stats.processed++;
        stats.successful++;
        stats.results.push({
          address: wallet.address,
          name: wallet.name,
          chain: 'polkadot',
          balance: `${balance} 单位`
        });
        
        console.log(`✅ ${wallet.address}: ${balance} 单位`);
        
      } catch (error) {
        stats.processed++;
        stats.failed++;
        stats.errors.push({
          address: wallet.address,
          error: error.message
        });
        console.log(`❌ ${wallet.address}: ${error.message}`);
      }
      
      await context.utils.delay(context.config.delayBetweenRequests);
    }
    
    await api.disconnect();
    
  } catch (error) {
    console.log(`❌ Polkadot操作失败: ${error.message}`);
    if (error.message.includes('Cannot resolve module')) {
      console.log('💡 提示: Polkadot模块可能未安装，请检查系统依赖');
    }
    throw error;
  }
}

/**
 * 执行多链操作
 */
async function executeMultichainOperations(context, stats) {
  console.log('🌈 开始多链操作...');
  
  const chains = [
    { name: 'ethereum', handler: executeEthereumOperations },
    { name: 'solana', handler: executeSolanaOperations },
    { name: 'polkadot', handler: executePolkadotOperations }
  ];
  
  for (const chain of chains) {
    try {
      console.log(`🔄 正在处理 ${chain.name} 链...`);
      
      const chainContext = {
        ...context,
        config: { ...context.config, targetChain: chain.name }
      };
      
      await chain.handler(chainContext, stats);
      console.log(`✅ ${chain.name} 链处理完成`);
      
    } catch (error) {
      console.log(`⚠️ ${chain.name} 链处理失败: ${error.message}`);
      // 继续处理其他链，不中断整个流程
    }
  }
}

/**
 * 生成执行报告
 */
async function generateExecutionReport(context, stats) {
  const { storage } = context;
  const moment = require('moment');
  const _ = require('lodash');
  
  const endTime = moment();
  const duration = moment.duration(endTime.diff(stats.startTime));
  
  const report = {
    sessionId: stats.sessionId,
    执行概要: {
      开始时间: stats.startTime.format('YYYY-MM-DD HH:mm:ss'),
      结束时间: endTime.format('YYYY-MM-DD HH:mm:ss'),
      总耗时: duration.humanize(),
      目标链: context.config.targetChain,
      操作类型: context.config.operationType
    },
    处理统计: {
      总数量: stats.total,
      已处理: stats.processed,
      成功数: stats.successful,
      失败数: stats.failed,
      成功率: stats.total > 0 ? `${(stats.successful / stats.total * 100).toFixed(2)}%` : '0%'
    },
    性能指标: {
      平均处理时间: stats.processed > 0 ? `${(duration.asSeconds() / stats.processed).toFixed(2)}秒/个` : '0秒',
      处理速度: stats.processed > 0 ? `${(stats.processed / duration.asMinutes()).toFixed(2)}个/分钟` : '0个/分钟'
    }
  };
  
  // 保存报告
  await storage.setItem('lastExecutionReport', report);
  await storage.setItem('lastResults', stats.results);
  
  // 输出报告
  console.log('\n📊 =============== 执行报告 ===============');
  console.log(`🎯 目标链: ${report.执行概要.目标链}`);
  console.log(`⚙️ 操作: ${report.执行概要.操作类型}`);
  console.log(`⏱️ 耗时: ${report.执行概要.总耗时}`);
  console.log(`📈 成功率: ${report.处理统计.成功率} (${report.处理统计.成功数}/${report.处理统计.总数量})`);
  console.log(`⚡ 速度: ${report.性能指标.处理速度}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️ 错误汇总 (${stats.errors.length}个):`);
    const errorSummary = _.take(stats.errors, 3);
    errorSummary.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.address}: ${error.error}`);
    });
    if (stats.errors.length > 3) {
      console.log(`   ... 还有 ${stats.errors.length - 3} 个错误`);
    }
  }
  
  console.log('🏁 报告生成完成');
}

// 本地测试功能
if (require.main === module) {
  (async () => {
    const testContext = {
      config: {
        targetChain: 'ethereum',
        operationType: 'balance_check',
        ethereumRpc: 'https://rpc.ankr.com/eth',
        batchSize: 2,
        delayBetweenRequests: 1000,
        enableDetailedLogs: true
      },
      wallets: [
        { address: '0x742d35Cc6C4F73f3Bc99e7C05E5f3E2B3CF6b4a1', name: '测试钱包1' },
        { address: '0x8ba1f109551bD432803012645Hac136c54c38f00', name: '测试钱包2' }
      ],
      utils: {
        delay: (ms) => new Promise(resolve => setTimeout(resolve, ms))
      },
      storage: {
        _data: {},
        setItem: function(k, v) { this._data[k] = v; return Promise.resolve(); },
        getItem: function(k) { return Promise.resolve(this._data[k]); },
        removeItem: function(k) { delete this._data[k]; return Promise.resolve(); },
        clear: function() { this._data = {}; return Promise.resolve(); }
      }
    };
    
    try {
      console.log('🧪 开始本地测试...');
      const result = await main(testContext);
      console.log('✅ 本地测试完成:', result);
    } catch (error) {
      console.log('❌ 本地测试失败:', error.message);
    }
  })();
}

module.exports = {
  getConfig,
  main
}; 