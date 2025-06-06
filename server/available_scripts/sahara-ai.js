/**
 * Sahara AI 自动化交互脚本
 * 功能：水龙头领取、随机转账、任务奖励领取
 * 作者：一笑
 * 版本：1.0.0 (FourAir规范版)
 * 更新：2025-06-05
 */

// 1. 配置函数 - 必需
function getConfig() {
  return {
    // 基本信息
    id: "sahara_ai_bot",
    name: "Sahara AI 自动化脚本",
    description: "自动化执行Sahara AI测试网的水龙头领取、测试网随机转账和任务奖励领取",
    version: "1.0.0",
    author: "一笑",
    category: "Sahara AI自动化脚本",
    icon: "fas fa-desert",
    imageUrl: "https://public.rootdata.com/images/b6/1723642779997.png",
    
    // 依赖声明
    requires: {
      wallets: true,  // 需要钱包
      proxy: false    // 代理可选
    },
    
    // 模块声明
    requiredModules: ["ethers", "crypto"],
    
    // 支持平台
    platforms: ["Sahara AI Testnet"],
    
    // 执行超时 (30分钟)
    timeout: 1800000,
    
    // 配置参数
    config: {
      useGlobalCaptcha: {
        type: "checkbox",
        label: "使用全局验证码配置",
        description: "优先使用全局设置中的验证码服务，未配置时使用下方单独配置",
        default: true
      },
      captchaService: {
        type: "select",
        label: "验证码服务 (全局未配置时使用)",
        options: [
          { value: "2captcha", label: "2Captcha" },
          { value: "yescaptcha", label: "YesCaptcha" }
        ],
        default: "2captcha",
        required: true
      },
      enableFaucet: {
        type: "checkbox",
        label: "启用水龙头领取",
        default: true
      },
      enableTransaction: {
        type: "checkbox", 
        label: "启用随机转账 (Sahara测试网)",
        default: true
      },
      enableClaim: {
        type: "checkbox",
        label: "启用任务奖励领取",
        default: true
      },
      minTransferAmount: {
        type: "text",
        label: "最小转账金额 (测试网ETH)",
        placeholder: "0.0001",
        default: "0.0001",
        required: true
      },
      maxTransferAmount: {
        type: "text",
        label: "最大转账金额 (测试网ETH)",
        placeholder: "0.001",
        default: "0.001",
        required: true
      },
      waitBetweenWallets: {
        type: "number",
        label: "钱包间延时(秒)",
        min: 30,
        max: 300,
        default: 60,
        required: true
      },
      waitBetweenActions: {
        type: "number",
        label: "操作间延时(秒)", 
        min: 10,
        max: 60,
        default: 15,
        required: true
      },
      forceNoProxy: {
        type: "checkbox",
        label: "强制无代理模式 (解决验证码时不使用代理)",
        default: false
      }
    }
  };
}

// 2. 主执行函数 - 必需
async function main(context) {
  const { wallets, config, proxy, utils, http, storage, globalCaptcha } = context;
  
  try {
    console.log('🏜️ Sahara AI 自动化脚本开始执行...');
    
    // 确定验证码服务配置
    let captchaService, selectedApiKey;
    
    if (config.useGlobalCaptcha && globalCaptcha && globalCaptcha.isConfigured()) {
      // 使用全局配置
      captchaService = globalCaptcha.defaultService;
      selectedApiKey = globalCaptcha.getApiKey();
      console.log(`🔧 使用全局验证码配置: ${captchaService}`);
    } else {
      // 使用脚本单独配置（但不支持API Key，需要全局配置）
      if (config.enableFaucet) {
        throw new Error('启用水龙头功能需要在全局设置中配置验证码服务');
      }
      
      console.log(`🔧 全局验证码服务未配置，将跳过验证码相关功能`);
      captchaService = config.captchaService;
      selectedApiKey = null;
    }
    
    console.log(`📋 执行配置:`);
    console.log(`   - 钱包数量: ${wallets.length}`);
    console.log(`   - 验证码服务: ${captchaService === 'yescaptcha' ? 'YesCaptcha' : '2Captcha'}`);
    console.log(`   - 水龙头: ${config.enableFaucet ? '✅' : '❌'}`);
    console.log(`   - 转账: ${config.enableTransaction ? '✅' : '❌'}`);
    console.log(`   - 奖励领取: ${config.enableClaim ? '✅' : '❌'}`);
    if (proxy) {
      console.log(`   - 代理: ${proxy.type}://${proxy.host}:${proxy.port}`);
    }
    if (config.forceNoProxy) {
      console.log(`   - 验证码模式: 强制无代理`);
    } else {
      console.log(`   - 验证码模式: 自动降级 (代理失败时尝试无代理)`);
    }
    
    // 检查功能启用状态
    if (!config.enableFaucet && !config.enableTransaction && !config.enableClaim) {
      throw new Error('所有功能都已禁用，请至少启用一个功能');
    }
    
    // 环境检测
    console.log('🔍 环境检测...');
    try {
      const { ethers } = require('ethers');
      console.log(`✅ ethers模块加载成功: v${ethers.version}`);
    } catch (error) {
      throw new Error(`ethers模块加载失败: ${error.message}`);
    }
    
    try {
      const crypto = require('crypto');
      console.log('✅ crypto模块加载成功');
    } catch (error) {
      throw new Error(`crypto模块加载失败: ${error.message}`);
    }
    
    // 网络配置和测试
    console.log('🌐 网络配置检测...');
    const networks = {
      main: 'https://eth.llamarpc.com',
      sahara: 'https://testnet.saharalabs.ai'
    };
    
    console.log(`   - 以太坊主网RPC: ${networks.main}`);
    console.log(`   - Sahara测试网RPC: ${networks.sahara}`);
    
    // 预先测试网络连接
    console.log('🔗 测试网络连接...');
    const { ethers } = require('ethers');
    
    // 测试主网连接
    try {
      const mainProvider = new ethers.JsonRpcProvider(networks.main);
      const mainNetwork = await mainProvider.getNetwork();
      console.log(`✅ 主网连接成功 - 链ID: ${mainNetwork.chainId}`);
    } catch (error) {
      console.log(`⚠️ 主网连接测试失败: ${error.message}`);
    }
    
    // 测试Sahara测试网连接
    try {
      const saharaProvider = new ethers.JsonRpcProvider(networks.sahara);
      const saharaNetwork = await saharaProvider.getNetwork();
      console.log(`✅ Sahara测试网连接成功 - 链ID: ${saharaNetwork.chainId}`);
    } catch (error) {
      console.log(`⚠️ Sahara测试网连接测试失败: ${error.message}`);
      // 如果Sahara测试网无法连接，但启用了转账，则报错
      if (config.enableTransaction) {
        throw new Error(`Sahara测试网连接失败，无法执行转账操作: ${error.message}`);
      }
    }
    
    // 处理结果统计
    const results = {
      faucet: { success: 0, failed: 0 },
      transaction: { success: 0, failed: 0 },
      claim: { success: 0, failed: 0 }
    };

    // 处理每个钱包
    for (let i = 0; i < wallets.length; i++) {
      const walletInfo = wallets[i];
      
      try {
        console.log(`\n📝 处理钱包 ${i + 1}/${wallets.length}: ${walletInfo.address}`);
        
        // 创建provider和wallet
        console.log('🔧 创建区块链连接...');
        const provider = await createProvider(networks.main, proxy, utils);
        const saharaProvider = await createProvider(networks.sahara, proxy, utils);
        const wallet = new ethers.Wallet(walletInfo.privateKey, provider);
        const saharaWallet = new ethers.Wallet(walletInfo.privateKey, saharaProvider);
        
        console.log('✅ 钱包实例创建成功');
        
        // 检查主网ETH余额（仅用于显示）
        console.log('💰 查询余额信息...');
        try {
          const mainBalance = await provider.getBalance(wallet.address);
          console.log(`💰 主网余额: ${ethers.formatEther(mainBalance)} ETH`);
        } catch (error) {
          console.log(`⚠️ 主网余额查询失败: ${error.message}`);
        }
        
        // 检查Sahara测试网余额（用于转账判断）
        let saharaBalance = ethers.parseEther("0");
        try {
          saharaBalance = await saharaProvider.getBalance(wallet.address);
          console.log(`🏜️ Sahara测试网余额: ${ethers.formatEther(saharaBalance)} ETH`);
        } catch (error) {
          console.log(`⚠️ Sahara测试网余额查询失败: ${error.message}`);
          if (config.enableTransaction) {
            console.log(`⚠️ 由于余额查询失败，跳过转账操作`);
          }
        }
        
        // 执行水龙头领取 (不需要余额检查)
        if (config.enableFaucet) {
          console.log(`\n💧 开始执行水龙头领取...`);
          try {
            let faucetResult = false;
            
            if (config.useGlobalCaptcha && globalCaptcha && globalCaptcha.isConfigured()) {
              // 使用全局验证码工具
              console.log(`🔐 使用全局验证码工具解决水龙头验证码...`);
              faucetResult = await claimFaucetWithGlobal(wallet, http, globalCaptcha, utils, proxy);
            } else {
              // 使用原有的脚本内验证码逻辑
              console.log(`🔐 使用脚本内验证码逻辑...`);
              faucetResult = await claimFaucet(wallet, http, captchaService, selectedApiKey, utils, proxy, config.forceNoProxy);
            }
            
            if (faucetResult) {
              results.faucet.success++;
              console.log('✅ 水龙头领取完成');
            } else {
              results.faucet.failed++;
              console.log('❌ 水龙头领取失败');
            }
          } catch (error) {
            results.faucet.failed++;
            console.log(`❌ 水龙头领取异常: ${error.message}`);
          }
          await utils.delay(config.waitBetweenActions * 1000);
        }
        
        // 执行随机转账 (需要测试网余额检查)
        if (config.enableTransaction) {
          console.log(`\n💸 开始执行随机转账...`);
          try {
            const minBalance = ethers.parseEther("0.01");
            if (saharaBalance < minBalance) {
              console.log(`⚠️ Sahara测试网余额不足，跳过转账 (${ethers.formatEther(saharaBalance)} ETH < 0.01 ETH)`);
              results.transaction.failed++;
            } else {
              const transactionResult = await performRandomTransaction(saharaWallet, config, utils);
              if (transactionResult) {
                results.transaction.success++;
                console.log('✅ 随机转账完成');
              } else {
                results.transaction.failed++;
                console.log('❌ 随机转账失败');
              }
            }
          } catch (error) {
            results.transaction.failed++;
            console.log(`❌ 随机转账异常: ${error.message}`);
          }
          await utils.delay(config.waitBetweenActions * 1000);
        }
        
        // 执行任务奖励领取
        if (config.enableClaim) {
          console.log(`\n🎁 开始执行任务奖励领取...`);
          try {
            const claimResult = await claimTaskReward(wallet, http, utils);
            if (claimResult) {
              results.claim.success++;
              console.log('✅ 任务奖励领取完成');
            } else {
              results.claim.failed++;
              console.log('❌ 任务奖励领取失败');
            }
          } catch (error) {
            results.claim.failed++;
            console.log(`❌ 任务奖励领取异常: ${error.message}`);
          }
        }
        
        console.log(`\n✅ 钱包 ${walletInfo.address} 处理完成`);
        
      } catch (error) {
        console.log(`\n❌ 钱包 ${walletInfo.address} 处理失败: ${error.message}`);
        console.log(`🔍 错误详情: ${error.stack || error.toString()}`);
        
        // 记录失败
        if (config.enableFaucet) results.faucet.failed++;
        if (config.enableTransaction) results.transaction.failed++;
        if (config.enableClaim) results.claim.failed++;
      }
      
      // 钱包间延时
      if (i < wallets.length - 1) {
        console.log(`\n⏰ 等待 ${config.waitBetweenWallets} 秒后处理下一个钱包...`);
        await utils.delay(config.waitBetweenWallets * 1000);
      }
      
      // 进度显示
      console.log(`📊 进度: ${i + 1}/${wallets.length} (${Math.round((i + 1)/wallets.length*100)}%)`);
    }
    
    // 输出最终统计
    console.log('\n📊 执行统计:');
    if (config.enableFaucet) {
      console.log(`   💧 水龙头: ${results.faucet.success} 成功, ${results.faucet.failed} 失败`);
    }
    if (config.enableTransaction) {
      console.log(`   💸 测试网转账: ${results.transaction.success} 成功, ${results.transaction.failed} 失败`);
    }
    if (config.enableClaim) {
      console.log(`   🎁 奖励领取: ${results.claim.success} 成功, ${results.claim.failed} 失败`);
    }
    
    console.log('\n✅ Sahara AI 自动化脚本执行完成');
    
    return {
      success: true,
      message: '脚本执行完成',
      data: {
        processed: wallets.length,
        results: results
      }
    };
    
  } catch (error) {
    console.log(`❌ 脚本执行失败: ${error.message}`);
    console.log(`🔍 错误详情: ${error.stack || error.toString()}`);
    
    // 提供诊断建议
    if (error.message.includes('ethers')) {
      console.log(`💡 建议: 检查ethers模块是否正确加载`);
    } else if (error.message.includes('网络') || error.message.includes('连接')) {
      console.log(`💡 建议: 检查网络连接和RPC端点`);
    } else if (error.message.includes('钱包') || error.message.includes('私钥')) {
      console.log(`💡 建议: 检查钱包配置和私钥格式`);
    } else if (error.message.includes('API Key')) {
      console.log(`💡 建议: 检查验证码服务API Key配置`);
    }
    
    throw error;
  }
}

// 辅助函数

async function createProvider(rpcUrl, proxy, utils) {
  const { ethers } = require('ethers');
  
  try {
    console.log(`🔗 正在连接: ${rpcUrl}`);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    // 测试连接
    const network = await provider.getNetwork();
    console.log(`✅ 区块链连接成功: ${rpcUrl} (链ID: ${network.chainId})`);
    return provider;
  } catch (error) {
    console.log(`❌ 创建provider失败 (${rpcUrl}): ${error.message}`);
    
    // 为Sahara测试网提供备用RPC
    if (rpcUrl.includes('saharalabs.ai')) {
      console.log('🔄 尝试备用Sahara测试网连接...');
      try {
        // 使用HTTP方式重试
        const backupUrl = 'https://testnet.saharalabs.ai/';
        const backupProvider = new ethers.JsonRpcProvider(backupUrl);
        const backupNetwork = await backupProvider.getNetwork();
        console.log(`✅ 备用连接成功: ${backupUrl} (链ID: ${backupNetwork.chainId})`);
        return backupProvider;
      } catch (backupError) {
        console.log(`❌ 备用连接也失败: ${backupError.message}`);
      }
    }
    
    throw error;
  }
}

async function solveTurnstileCaptcha(captchaService, apiKey, siteUrl, siteKey, userAgent, proxy, http, utils, forceNoProxy = false) {
  if (!apiKey) {
    console.log(`⚠️ 未配置${captchaService === 'yescaptcha' ? 'YesCaptcha' : '2Captcha'} API Key，跳过验证码解决`);
    return null;
  }
  
  if (captchaService === 'yescaptcha') {
    // 使用 YesCaptcha
    return await solveWithYesCaptcha(apiKey, siteUrl, siteKey, userAgent, http, utils);
  } else {
    // 使用 2Captcha (原有逻辑)
    return await solveWith2Captcha(apiKey, siteUrl, siteKey, userAgent, proxy, http, utils, forceNoProxy);
  }
}

async function solveWith2Captcha(apiKey, siteUrl, siteKey, userAgent, proxy, http, utils, forceNoProxy = false) {
  // 如果强制无代理模式，直接使用无代理
  if (forceNoProxy) {
    console.log('🔧 用户选择强制无代理模式');
    return await attemptCaptchaSolve(apiKey, siteUrl, siteKey, userAgent, null, http, utils, false);
  }
  
  // 首先尝试使用代理
  let result = await attemptCaptchaSolve(apiKey, siteUrl, siteKey, userAgent, proxy, http, utils, true);
  
  // 如果代理失败且有代理配置，尝试无代理模式
  if (!result && proxy) {
    console.log('⚠️ 2Captcha代理模式失败，尝试无代理模式...');
    result = await attemptCaptchaSolve(apiKey, siteUrl, siteKey, userAgent, null, http, utils, false);
  }
  
  return result;
}

async function solveWithYesCaptcha(apiKey, siteUrl, siteKey, userAgent, http, utils) {
  try {
    console.log('🔐 开始使用YesCaptcha解决Turnstile验证码...');
    
    // 创建验证码任务
    const createResponse = await http.post('https://api.yescaptcha.com/createTask', {
      clientKey: apiKey,
      task: {
        type: 'TurnstileTaskProxyless',
        websiteURL: siteUrl,
        websiteKey: siteKey
      }
    });
    
    if (!createResponse.data.taskId) {
      console.log('❌ YesCaptcha创建任务失败:', createResponse.data);
      throw new Error(`YesCaptcha创建任务失败: ${createResponse.data.errorDescription || '未知错误'}`);
    }
    
    const taskId = createResponse.data.taskId;
    console.log(`📋 YesCaptcha任务ID: ${taskId}`);
    
    // 轮询获取结果
    const maxAttempts = 60; // 最多等待5分钟
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      await utils.delay(5000); // 等待5秒
      attempts++;
      
      const resultResponse = await http.post('https://api.yescaptcha.com/getTaskResult', {
        clientKey: apiKey,
        taskId: taskId
      });
      
      if (resultResponse.data.status === 'ready') {
        const token = resultResponse.data.solution.token;
        console.log('✅ YesCaptcha验证码解决成功');
        return token;
      } else if (resultResponse.data.status === 'processing') {
        console.log(`⏳ YesCaptcha验证码解决中... (${attempts}/${maxAttempts})`);
      } else {
        throw new Error(`YesCaptcha验证码任务状态异常: ${resultResponse.data.status}`);
      }
    }
    
    throw new Error('YesCaptcha验证码获取超时');
    
  } catch (error) {
    console.log(`❌ YesCaptcha验证码解决异常: ${error.message}`);
    return null;
  }
}

async function attemptCaptchaSolve(apiKey, siteUrl, siteKey, userAgent, proxy, http, utils, useProxy) {
  try {
    if (useProxy && proxy) {
      console.log(`🔐 开始解决Turnstile验证码 (使用代理: ${proxy.host}:${proxy.port})...`);
    } else {
      console.log('🔐 开始解决Turnstile验证码 (无代理模式)...');
    }
    
    // 创建验证码任务
    const createTaskPayload = {
      clientKey: apiKey,
      task: {
        type: "TurnstileTask",
        websiteURL: siteUrl,
        websiteKey: siteKey,
        userAgent: userAgent
      }
    };
    
    // 如果使用代理且代理存在，添加代理配置
    if (useProxy && proxy) {
      createTaskPayload.task.proxyType = proxy.type === 'socks5' ? 'socks5' : 'http';
      createTaskPayload.task.proxyAddress = proxy.host;
      createTaskPayload.task.proxyPort = proxy.port;
      if (proxy.username) {
        createTaskPayload.task.proxyLogin = proxy.username;
        createTaskPayload.task.proxyPassword = proxy.password;
      }
    }
    
    const createResponse = await http.post('https://api.2captcha.com/createTask', createTaskPayload);
    
    if (createResponse.data.errorId !== 0) {
      throw new Error(`创建验证码任务失败: ${createResponse.data.errorDescription || '未知错误'}`);
    }
    
    const taskId = createResponse.data.taskId;
    console.log(`📋 验证码任务ID: ${taskId}`);
    
    // 轮询获取结果
    const resultPayload = {
      clientKey: apiKey,
      taskId: taskId
    };
    
    const timeout = 360; // 6分钟超时
    let totalTime = 0;
    
    while (totalTime < timeout) {
      await utils.delay(5000); // 等待5秒
      totalTime += 5;
      
      const resultResponse = await http.post('https://api.2captcha.com/getTaskResult', resultPayload);
      
      if (resultResponse.data.status === 'ready') {
        const token = resultResponse.data.solution.token;
        const mode = useProxy && proxy ? '代理模式' : '无代理模式';
        console.log(`✅ 验证码解决成功 (${mode})`);
        return token;
      } else if (resultResponse.data.status === 'processing') {
        console.log(`⏳ 验证码解决中... (${totalTime}/${timeout}秒)`);
      } else {
        throw new Error(`验证码解决失败: ${resultResponse.data.errorDescription || '未知状态'}`);
      }
    }
    
    throw new Error('验证码解决超时');
    
  } catch (error) {
    const mode = useProxy && proxy ? '代理模式' : '无代理模式';
    console.log(`❌ 验证码解决异常 (${mode}): ${error.message}`);
    return null;
  }
}

async function claimFaucet(wallet, http, captchaService, captchaApiKey, utils, proxy, forceNoProxy) {
  try {
    console.log(`💧 水龙头领取流程开始...`);
    
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    
    // 检查网络连接
    console.log('🔍 测试Sahara网络连接...');
    const testPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [wallet.address, 'latest']
    };
    
    try {
      const testResponse = await retryOperation(async () => {
        return await http.post('https://testnet.saharalabs.ai/', testPayload, {
          headers: { 'user-agent': userAgent }
        });
      }, 3, utils);
      
      if (testResponse.status === 200) {
        console.log('✅ Sahara网络连接正常');
      } else {
        console.log(`⚠️ Sahara网络连接异常: HTTP ${testResponse.status}`);
        return false;
      }
    } catch (networkError) {
      console.log(`❌ Sahara网络连接失败: ${networkError.message}`);
      return false;
    }
    
    // 解决验证码
    const captchaToken = await solveTurnstileCaptcha(
      captchaService,
      captchaApiKey,
      'https://faucet.saharalabs.ai/',
      '0x4AAAAAAA8hNPuIp1dAT_d9',
      userAgent,
      proxy,
      http,
      utils,
      forceNoProxy
    );
    
    if (!captchaToken) {
      console.log('⚠️ 验证码解决失败，跳过水龙头领取');
      return false;
    }
    
    // 提交水龙头申请
    const claimPayload = {
      address: wallet.address
    };
    
    const claimResponse = await retryOperation(async () => {
      return await http.post('https://faucet-api.saharaa.info/api/claim2', claimPayload, {
        headers: {
          'cf-turnstile-response': captchaToken,
          'user-agent': userAgent,
          'content-type': 'application/json'
        }
      });
    }, 3, utils);
    
    if (claimResponse.status === 200) {
      console.log('✅ 水龙头领取成功');
      return true;
    } else if (claimResponse.status === 429) {
      const errorData = claimResponse.data;
      console.log(`⚠️ 水龙头领取失败: ${errorData.msg || '请求过于频繁'}`);
      return false;
    } else {
      console.log(`❌ 水龙头领取失败: HTTP ${claimResponse.status}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ 领取水龙头异常: ${error.message}`);
    return false;
  }
}

async function performRandomTransaction(wallet, config, utils) {
  try {
    console.log(`💸 开始Sahara测试网随机转账...`);
    
    const { ethers } = require('ethers');
    
    // 生成随机转账金额
    const minAmount = parseFloat(config.minTransferAmount);
    const maxAmount = parseFloat(config.maxTransferAmount);
    const randomAmount = Math.random() * (maxAmount - minAmount) + minAmount;
    const amount = ethers.parseEther(randomAmount.toString());
    
    // 生成随机接收地址
    const randomWallet = ethers.Wallet.createRandom();
    const toAddress = randomWallet.address;
    
    console.log(`💰 转账金额: ${randomAmount.toFixed(6)} 测试网ETH`);
    console.log(`📮 接收地址: ${toAddress}`);
    
    // 检查Sahara测试网余额
    const balance = await wallet.provider.getBalance(wallet.address);
    if (balance < amount) {
      console.log(`⚠️ Sahara测试网余额不足，跳过转账 (余额: ${ethers.formatEther(balance)} 测试网ETH)`);
      return false;
    }
    
    // 发送交易
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: amount
    });
    
    console.log(`⏳ 交易已发送: ${tx.hash}`);
    console.log(`⏳ 等待交易确认...`);
    
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      console.log(`✅ Sahara测试网随机转账成功: ${tx.hash}`);
      return true;
    } else {
      console.log(`❌ Sahara测试网交易失败: ${tx.hash}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ Sahara测试网随机转账异常: ${error.message}`);
    return false;
  }
}

async function claimTaskReward(wallet, http, utils) {
  try {
    console.log(`🎁 开始领取任务奖励...`);
    
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    const timestamp = Math.floor(Date.now() / 1000);
    
    // 步骤1: 获取challenge
    const challengePayload = {
      address: wallet.address,
      timestamp: timestamp
    };
    
    const challengeResponse = await retryOperation(async () => {
      return await http.post('https://legends.saharalabs.ai/api/v1/user/challenge', challengePayload, {
        headers: { 'user-agent': userAgent }
      });
    }, 3, utils);
    
    const challenge = challengeResponse.data.challenge;
    console.log(`🔑 获取到challenge: ${challenge.slice(0, 10)}...`);
    
    // 步骤2: 签名认证
    const signText = `Sign in to Sahara!\nChallenge:${challenge}`;
    const signature = await wallet.signMessage(signText);
    
    const loginPayload = {
      address: wallet.address,
      sig: signature,
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    const loginResponse = await retryOperation(async () => {
      return await http.post('https://legends.saharalabs.ai/api/v1/login/wallet', loginPayload, {
        headers: { 'user-agent': userAgent }
      });
    }, 3, utils);
    
    const accessToken = loginResponse.data.accessToken;
    console.log(`🔐 登录成功，获取到访问令牌`);
    
    // 步骤3: 刷新任务状态
    const taskPayload = {
      taskID: '1004',
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    const authHeaders = {
      'authorization': `Bearer ${accessToken}`,
      'user-agent': userAgent,
      'content-type': 'application/json'
    };
    
    await retryOperation(async () => {
      return await http.post('https://legends.saharalabs.ai/api/v1/task/flush', taskPayload, {
        headers: authHeaders
      });
    }, 3, utils);
    
    console.log(`📋 任务状态已刷新`);
    await utils.delay(5000); // 等待5秒
    
    // 步骤4: 领取奖励
    const claimResponse = await retryOperation(async () => {
      return await http.post('https://legends.saharalabs.ai/api/v1/task/claim', taskPayload, {
        headers: authHeaders
      });
    }, 3, utils);
    
    if (claimResponse.status === 200) {
      console.log('✅ 任务奖励领取成功 (20个碎片)');
      return true;
    } else if (claimResponse.status === 400) {
      const errorData = claimResponse.data;
      if (errorData.message === 'reward of task: 1004 has been claimed') {
        console.log('⚠️ 今日奖励已领取');
      } else if (errorData.message === 'task not finished') {
        console.log('⚠️ 任务未完成，无法领取奖励');
      } else {
        console.log(`⚠️ 领取失败: ${errorData.message}`);
      }
      return false;
    } else {
      console.log(`❌ 奖励领取失败: HTTP ${claimResponse.status}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ 领取任务奖励异常: ${error.message}`);
    return false;
  }
}

async function claimFaucetWithGlobal(wallet, http, globalCaptcha, utils, proxy) {
  try {
    console.log(`💧 水龙头领取流程开始 (使用全局验证码工具)...`);
    
    const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    
    // 检查网络连接
    console.log('🔍 测试Sahara网络连接...');
    const testPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_getBalance',
      params: [wallet.address, 'latest']
    };
    
    try {
      const testResponse = await retryOperation(async () => {
        return await http.post('https://testnet.saharalabs.ai/', testPayload, {
          headers: { 'user-agent': userAgent }
        });
      }, 3, utils);
      
      if (testResponse.status === 200) {
        console.log('✅ Sahara网络连接正常');
      } else {
        console.log(`⚠️ Sahara网络连接异常: HTTP ${testResponse.status}`);
        return false;
      }
    } catch (networkError) {
      console.log(`❌ Sahara网络连接失败: ${networkError.message}`);
      return false;
    }
    
    // 使用全局验证码工具解决验证码
    const captchaToken = await globalCaptcha.solveTurnstile(
      'https://faucet.saharalabs.ai/',
      '0x4AAAAAAA8hNPuIp1dAT_d9',
      userAgent,
      proxy,
      utils
    );
    
    if (!captchaToken) {
      console.log('⚠️ 验证码解决失败，跳过水龙头领取');
      return false;
    }
    
    // 提交水龙头申请
    const claimPayload = {
      address: wallet.address
    };
    
    const claimResponse = await retryOperation(async () => {
      return await http.post('https://faucet-api.saharaa.info/api/claim2', claimPayload, {
        headers: {
          'cf-turnstile-response': captchaToken,
          'user-agent': userAgent,
          'content-type': 'application/json'
        }
      });
    }, 3, utils);
    
    if (claimResponse.status === 200) {
      console.log('✅ 水龙头领取成功');
      return true;
    } else if (claimResponse.status === 429) {
      const errorData = claimResponse.data;
      console.log(`⚠️ 水龙头领取失败: ${errorData.msg || '请求过于频繁'}`);
      return false;
    } else {
      console.log(`❌ 水龙头领取失败: HTTP ${claimResponse.status}`);
      return false;
    }
    
  } catch (error) {
    console.log(`❌ 领取水龙头异常: ${error.message}`);
    return false;
  }
}

async function retryOperation(fn, maxAttempts = 3, utils, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      console.log(`⚠️ 尝试 ${attempt} 失败，${delayMs/1000}秒后重试...`);
      await utils.delay(delayMs);
    }
  }
}

// 3. 模块导出 - 必需
module.exports = {
  getConfig,
  main
}; 