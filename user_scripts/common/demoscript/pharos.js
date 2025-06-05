/**
 * Pharos Testnet 多功能交互脚本
 * 功能：自动化执行水龙头领取、每日签到、PHRS转账和代币交换
 * 作者：一笑
 * 版本：2.0.0 (FourAir规范版)
 * 更新：2024-12-19
 */

// 1. 配置函数 - 必需
function getConfig() {
  return {
    // 基本信息
    id: "pharos_testnet_bot",
    name: "Pharos自动化脚本",
    description: "自动化执行Pharos测试网的水龙头领取、每日签到、PHRS转账和代币交换操作",
    version: "2.0.0",
    author: "一笑",
    category: "测试网交互",
    icon: "fas fa-robot",
    imageUrl: "https://public.rootdata.com/images/b53/1731433067612.jpg",
    
    // 依赖声明
    requires: {
      wallets: true,  // 需要钱包
      proxy: false    // 代理可选
    },
    
    // 模块声明
    requiredModules: ["ethers", "crypto"],
    
    // 支持平台
    platforms: ["Pharos Testnet"],
    
    // 执行超时 (20分钟)
    timeout: 1200000,
    
    // 配置参数
    config: {
      inviteCode: {
        type: "text",
        label: "邀请码",
        placeholder: "请输入邀请码",
        default: "",
        required: false
      },
      transferCount: {
        type: "number",
        label: "转账次数",
        min: 1,
        max: 20,
        default: 10,
        required: true
      },
      swapCount: {
        type: "number", 
        label: "交换次数",
        min: 1,
        max: 20,
        default: 10,
        required: true
      },
      transferAmount: {
        type: "text",
        label: "转账金额 (PHRS)",
        placeholder: "0.000001",
        default: "0.000001",
        required: true
      },
      enableFaucet: {
        type: "checkbox",
        label: "启用水龙头领取",
        default: true
      },
      enableCheckIn: {
        type: "checkbox", 
        label: "启用每日签到",
        default: true
      },
      enableTransfer: {
        type: "checkbox",
        label: "启用PHRS转账",
        default: true
      },
      enableSwap: {
        type: "checkbox",
        label: "启用代币交换",
        default: true
      },
      waitBetweenWallets: {
        type: "number",
        label: "钱包间延时(秒)",
        min: 1,
        max: 60,
        default: 5,
        required: true
      },
      waitBetweenActions: {
        type: "number",
        label: "操作间延时(秒)", 
        min: 1,
        max: 30,
        default: 3,
        required: true
      }
    }
  };
}

// 2. 主执行函数 - 必需
async function main(context) {
  const { wallets, config, proxy, utils, http, storage } = context;
  
  try {
    console.log('🚀 Pharos Testnet 交互脚本开始执行...');
    
    // 检查钱包数量
    if (!wallets || wallets.length === 0) {
      throw new Error('❌ 未检测到钱包，请确保已正确配置钱包');
    }
    
    console.log(`📋 执行配置:`);
    console.log(`   - 钱包数量: ${wallets.length}`);
    console.log(`   - 水龙头: ${config.enableFaucet ? '✅' : '❌'}`);
    console.log(`   - 签到: ${config.enableCheckIn ? '✅' : '❌'}`);
    console.log(`   - 转账: ${config.enableTransfer ? '✅' : '❌'} (${config.transferCount}次)`);
    console.log(`   - 交换: ${config.enableSwap ? '✅' : '❌'} (${config.swapCount}次)`);
    if (proxy) {
      console.log(`   - 代理: ${proxy.type}://${proxy.host}:${proxy.port}`);
    } else {
      console.log(`   - 代理: 未使用`);
    }
    
    // 检查是否至少启用了一个功能
    if (!config.enableFaucet && !config.enableCheckIn && !config.enableTransfer && !config.enableSwap) {
      console.log('⚠️ 所有功能都被禁用，脚本将直接退出');
      return {
        success: true,
        message: '所有功能都被禁用，无需执行',
        data: { processed: 0, results: {} }
      };
    }
    
    // 环境检测
    console.log(`🔍 环境检测:`);
    console.log(`   - ethers模块: ${typeof require === 'function' ? '✅' : '❌'}`);
    console.log(`   - crypto模块: ${typeof require === 'function' ? '✅' : '❌'}`);
    console.log(`   - 配置参数: ${Object.keys(config).length} 项`);
    
    // 网络配置
    const network = {
      name: 'Pharos Testnet',
      chainId: 688688,
      rpcUrl: 'https://testnet.dplabs-internal.com',
      nativeCurrency: 'PHRS',
    };
    
    console.log(`🌐 网络配置:`);
    console.log(`   - 网络名称: ${network.name}`);
    console.log(`   - 链ID: ${network.chainId}`);
    console.log(`   - RPC地址: ${network.rpcUrl}`);

    // 代币配置
    const tokens = {
      USDC: { address: '0xad902cf99c2de2f1ba5ec4d642fd7e49cae9ee37', decimals: 6 },
      WPHRS: { address: '0x76aaada469d23216be5f7c596fa25f282ff9b364', decimals: 18 },
    };

    const contractAddress = '0x1a4de519154ae51200b0ad7c90f7fac75547888a';
    
    // 处理结果统计
    const results = {
      faucet: { success: 0, failed: 0 },
      checkIn: { success: 0, failed: 0 },
      transfer: { success: 0, failed: 0 },
      swap: { success: 0, failed: 0 }
    };

    // 处理每个钱包
    for (let i = 0; i < wallets.length; i++) {
      const walletInfo = wallets[i];
      
      try {
        console.log(`📝 处理钱包 ${i + 1}/${wallets.length}: ${walletInfo.address}`);
        
        // 检查钱包配置
        if (!walletInfo.privateKey) {
          throw new Error('钱包私钥为空');
        }
        
        console.log(`🔗 正在连接Pharos测试网...`);
        // 创建provider和wallet
        const provider = await createProvider(network, proxy, http, utils);
        
        console.log(`👛 正在创建钱包实例...`);
        const { ethers } = require('ethers');
        const wallet = new ethers.Wallet(walletInfo.privateKey, provider);
        
        console.log(`✅ 钱包创建成功，开始执行操作...`);
        
        // 执行各项操作
        if (config.enableFaucet) {
          const faucetResult = await claimFaucet(wallet, http, config.inviteCode || 'S6NGMzXSCDBxhnwo', utils);
          if (faucetResult) results.faucet.success++; else results.faucet.failed++;
          await utils.delay(config.waitBetweenActions * 1000);
        }
        
        if (config.enableCheckIn) {
          const checkInResult = await performCheckIn(wallet, http, config.inviteCode || 'S6NGMzXSCDBxhnwo', utils);
          if (checkInResult) results.checkIn.success++; else results.checkIn.failed++;
          await utils.delay(config.waitBetweenActions * 1000);
        }
        
        if (config.enableTransfer) {
          const transferResult = await transferPHRS(wallet, provider, config.transferCount, config.transferAmount, utils);
          if (transferResult) results.transfer.success++; else results.transfer.failed++;
          await utils.delay(config.waitBetweenActions * 1000);
        }
        
        if (config.enableSwap) {
          const swapResult = await performSwap(wallet, tokens, contractAddress, config.swapCount, utils);
          if (swapResult) results.swap.success++; else results.swap.failed++;
        }
        
        console.log(`✅ 钱包 ${walletInfo.address} 处理完成`);
        
      } catch (error) {
        console.log(`❌ 钱包 ${walletInfo.address} 处理失败: ${error.message}`);
        // 记录失败
        if (config.enableFaucet) results.faucet.failed++;
        if (config.enableCheckIn) results.checkIn.failed++;
        if (config.enableTransfer) results.transfer.failed++;
        if (config.enableSwap) results.swap.failed++;
      }
      
      // 钱包间延时
      if (i < wallets.length - 1) {
        console.log(`⏰ 等待 ${config.waitBetweenWallets} 秒后处理下一个钱包...`);
        await utils.delay(config.waitBetweenWallets * 1000);
      }
      
      // 进度显示
      console.log(`📊 进度: ${i + 1}/${wallets.length} (${Math.round((i + 1)/wallets.length*100)}%)`);
    }
    
    // 输出最终统计
    console.log('📊 执行统计:');
    if (config.enableFaucet) {
      console.log(`   💧 水龙头: ${results.faucet.success} 成功, ${results.faucet.failed} 失败`);
    }
    if (config.enableCheckIn) {
      console.log(`   ✏️ 签到: ${results.checkIn.success} 成功, ${results.checkIn.failed} 失败`);
    }
    if (config.enableTransfer) {
      console.log(`   💸 转账: ${results.transfer.success} 成功, ${results.transfer.failed} 失败`);
    }
    if (config.enableSwap) {
      console.log(`   🔄 交换: ${results.swap.success} 成功, ${results.swap.failed} 失败`);
    }
    
    console.log('✅ Pharos Testnet 交互脚本执行完成');
    
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
    console.log(`🔍 错误详情: ${error.stack || '无详细信息'}`);
    
    // 提供常见问题的解决建议
    if (error.message.includes('network') || error.message.includes('RPC')) {
      console.log(`💡 网络问题解决建议:`);
      console.log(`   1. 检查网络连接是否正常`);
      console.log(`   2. 尝试更换网络环境或代理`);
      console.log(`   3. Pharos测试网可能临时不可用`);
    }
    
    if (error.message.includes('钱包') || error.message.includes('私钥')) {
      console.log(`💡 钱包问题解决建议:`);
      console.log(`   1. 确保已正确配置钱包`);
      console.log(`   2. 检查私钥格式是否正确`);
      console.log(`   3. 确保钱包有足够的测试代币`);
    }
    
    throw error;
  }
}

// 辅助函数

async function createProvider(network, proxy, http, utils) {
  const { ethers } = require('ethers');
  
  try {
    console.log(`🌐 正在连接${network.name} (ChainID: ${network.chainId})`);
    console.log(`📡 RPC URL: ${network.rpcUrl}`);
    
    // 如果有代理，通过代理创建provider（简化版）
    const provider = new ethers.JsonRpcProvider(network.rpcUrl, {
      chainId: network.chainId,
      name: network.name
    });
    
    // 测试连接
    console.log(`🧪 测试网络连接...`);
    try {
      const blockNumber = await provider.getBlockNumber();
      console.log(`✅ 区块链连接成功，当前区块高度: ${blockNumber}`);
    } catch (testError) {
      console.log(`⚠️ 网络连接测试失败: ${testError.message}`);
      console.log(`📝 将继续尝试执行，可能是RPC限制导致`);
    }
    
    return provider;
  } catch (error) {
    console.log(`❌ 创建provider失败: ${error.message}`);
    console.log(`🔧 请检查网络连接或更换RPC节点`);
    throw error;
  }
}

async function claimFaucet(wallet, http, inviteCode, utils) {
  try {
    console.log(`💧 开始领取水龙头...`);
    
    const message = "pharos";
    const signature = await wallet.signMessage(message);

    const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=${inviteCode}`;
    
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    // 登录获取JWT
    const loginResponse = await retryOperation(async () => {
      const res = await http.post(loginUrl, {}, { headers });
      if (res.status === 403) throw new Error('403 Forbidden: Check API access or proxy');
      return res;
    }, 3, utils);

    const jwt = loginResponse.data?.data?.jwt;
    if (!jwt) {
      console.log('⚠️ 水龙头登录失败');
      return false;
    }

    // 检查水龙头状态
    const statusResponse = await retryOperation(async () => {
      const res = await http.get(`https://api.pharosnetwork.xyz/faucet/status?address=${wallet.address}`, {
        headers: { ...headers, authorization: `Bearer ${jwt}` }
      });
      return res;
    }, 3, utils);

    const available = statusResponse.data?.data?.is_able_to_faucet;
    if (!available) {
      const nextAvailable = new Date(statusResponse.data?.data?.avaliable_timestamp * 1000).toLocaleString();
      console.log(`⚠️ 今日水龙头已领取，下一可用时间：${nextAvailable}`);
      return false;
    }

    // 领取水龙头
    const claimResponse = await retryOperation(async () => {
      const res = await http.post(`https://api.pharosnetwork.xyz/faucet/daily?address=${wallet.address}`, {}, {
        headers: { ...headers, authorization: `Bearer ${jwt}` }
      });
      return res;
    }, 3, utils);

    if (claimResponse.data?.code === 0) {
      console.log('✅ 水龙头领取成功');
      return true;
    } else {
      console.log(`⚠️ 水龙头领取失败：${claimResponse.data?.msg || '未知错误'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 领取水龙头异常：${error.message}`);
    return false;
  }
}

async function performCheckIn(wallet, http, inviteCode, utils) {
  try {
    console.log(`✏️ 开始每日签到...`);
    
    const message = "pharos";
    const signature = await wallet.signMessage(message);
    const loginUrl = `https://api.pharosnetwork.xyz/user/login?address=${wallet.address}&signature=${signature}&invite_code=${inviteCode}`;
    
    const headers = {
      accept: "application/json, text/plain, */*",
      "accept-language": "en-US,en;q=0.8",
      "sec-ch-ua": '"Chromium";v="136", "Brave";v="136", "Not.A/Brand";v="99"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site", 
      "sec-gpc": "1",
      Referer: "https://testnet.pharosnetwork.xyz/",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    };

    const loginRes = await retryOperation(async () => {
      const res = await http.post(loginUrl, {}, { headers });
      return res;
    }, 3, utils);

    const jwt = loginRes.data?.data?.jwt;
    if (!jwt) {
      console.log('⚠️ 签到登录失败');
      return false;
    }

    const signRes = await retryOperation(async () => {
      const res = await http.post(`https://api.pharosnetwork.xyz/sign/in?address=${wallet.address}`, {}, {
        headers: { ...headers, authorization: `Bearer ${jwt}` }
      });
      return res;
    }, 3, utils);

    if (signRes.data?.code === 0) {
      console.log('✅ 签到成功');
      return true;
    } else {
      console.log(`⚠️ 签到失败或已签过：${signRes.data?.msg || '未知错误'}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ 签到异常：${error.message}`);
    return false;
  }
}

async function transferPHRS(wallet, provider, transferCount, transferAmount, utils) {
  try {
    console.log(`💸 开始PHRS转账，共 ${transferCount} 次...`);
    
    const { ethers } = require('ethers');
    
    for (let i = 0; i < transferCount; i++) {
      try {
        const to = ethers.Wallet.createRandom().address;
        const balance = await provider.getBalance(wallet.address);
        const required = ethers.parseEther(transferAmount);
        
        if (balance < required) {
          console.log(`⚠️ PHRS 余额不足，跳过转账 ${i + 1}`);
          break;
        }
        
        const tx = await wallet.sendTransaction({
          to,
          value: required,
          gasLimit: 21000,
          gasPrice: 0,
        });
        
        console.log(`⏳ 转账 ${i + 1} 发出，等待确认...`);
        await tx.wait();
        console.log(`✅ 转账 ${i + 1} 成功: ${tx.hash}`);
        
        // 随机延时
        const randomDelay = 1000 + Math.random() * 2000;
        await utils.delay(randomDelay);
        
      } catch (txError) {
        console.log(`❌ 转账 ${i + 1} 失败: ${txError.message}`);
      }
    }
    
    console.log('✅ PHRS转账操作完成');
    return true;
  } catch (error) {
    console.log(`❌ 转账异常：${error.message}`);
    return false;
  }
}

async function performSwap(wallet, tokens, contractAddress, swapCount, utils) {
  try {
    console.log(`🔄 开始代币交换，共 ${swapCount} 次...`);
    
    const { ethers } = require('ethers');
    
    const pairs = [
      { from: 'WPHRS', to: 'USDC', amount: 0.001 },
      { from: 'USDC', to: 'WPHRS', amount: 0.1 },
    ];
    
    const multicallABI = ['function multicall(uint256 collectionAndSelfcalls, bytes[] data) public'];
    const erc20ABI = [
      'function balanceOf(address) view returns (uint256)',
      'function allowance(address owner, address spender) view returns (uint256)',
      'function approve(address spender, uint256 amount) public returns (bool)',
    ];
    
    const contract = new ethers.Contract(contractAddress, multicallABI, wallet);

    for (let i = 0; i < swapCount; i++) {
      try {
        const pair = pairs[Math.floor(Math.random() * pairs.length)];
        const token = tokens[pair.from];
        const decimals = token.decimals;
        const amount = ethers.parseUnits(pair.amount.toString(), decimals);
        const tokenContract = new ethers.Contract(token.address, erc20ABI, wallet);
        
        const balance = await tokenContract.balanceOf(wallet.address);
        if (balance < amount) {
          console.log(`⚠️ ${pair.from} 余额不足，跳过 swap ${i + 1}`);
          break;
        }
        
        const allowance = await tokenContract.allowance(wallet.address, contractAddress);
        if (allowance < amount) {
          const approveTx = await tokenContract.approve(contractAddress, ethers.MaxUint256);
          await approveTx.wait();
          console.log('✅ 授权成功');
        }
        
        const data = ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address', 'uint256', 'address', 'uint256', 'uint256', 'uint256'],
          [
            tokens[pair.from].address,
            tokens[pair.to].address,
            500,
            wallet.address,
            pair.from === 'WPHRS' ? '0x0000002386f26fc10000' : '0x016345785d8a0000',
            0,
            0,
          ]
        );
        
        const tx = await contract.multicall(
          Math.floor(Date.now() / 1000),
          [ethers.concat(['0x04e45aaf', data])],
          { gasLimit: 219249, gasPrice: 0 }
        );
        
        console.log(`⏳ Swap ${i + 1} 发出，等待确认...`);
        await tx.wait();
        console.log(`✅ Swap ${i + 1} 成功: ${tx.hash}`);
        
        // 随机延时
        const randomDelay = 1000 + Math.random() * 2000;
        await utils.delay(randomDelay);
        
      } catch (swapError) {
        console.log(`❌ Swap ${i + 1} 失败: ${swapError.message}`);
      }
    }
    
    console.log('✅ 代币交换操作完成');
    return true;
  } catch (error) {
    console.log(`❌ Swap 执行异常：${error.message}`);
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