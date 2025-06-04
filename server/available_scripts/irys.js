/**
 * Irys Faucet 领取脚本
 * 功能：批量领取 Irys 测试网代币
 * 作者：FourAir开发团队
 * 版本：2.0.0
 * 更新：2024-12-19
 */

// 1. 配置函数 - 必需
function getConfig() {
  return {
    // 基本信息
    id: "irys_faucet_claimer",
    name: "Irys Faucet 领取器",
    description: "批量领取 Irys 测试网代币，支持验证码自动识别",
    version: "2.0.0",
    author: "FourAir开发团队",
    category: "Faucet工具",
    icon: "fas fa-faucet",
    imageUrl: "https://public.rootdata.com/images/b6/1738668096621.jpg",
    // 依赖声明
    requires: {
      wallets: true,  // 需要钱包
      proxy: true     // 强制需要代理
    },
    
    // 模块声明
    requiredModules: ["axios"],
    
    // 支持平台
    platforms: ["通用"],
    
    // 执行超时 (30分钟)
    timeout: 1800000,
    
    // 配置参数
    config: {
      yescaptchaApiKey: {
        type: "text",
        label: "YesCaptcha API Key",
        placeholder: "请输入YesCaptcha的API密钥",
        required: true
      },
      delayBetweenRequests: {
        type: "number",
        label: "请求间隔 (秒)",
        min: 5,
        max: 60,
        default: 10,
        required: true
      },
      maxRetries: {
        type: "number",
        label: "最大重试次数",
        min: 1,
        max: 5,
        default: 3,
        required: true
      }
    }
  };
}

// 2. 主执行函数 - 必需
async function main(context) {
  // 从context获取参数
  const { wallets, config, proxy, utils, http } = context;
  
  try {
    console.log('🚀 Irys Faucet 脚本开始执行...');
    console.log(`📋 钱包数量: ${wallets.length}`);
    console.log(`📡 代理设置: ${proxy.type}://${proxy.host}:${proxy.port}`);
    
    // 验证参数
    if (!config.yescaptchaApiKey) {
      throw new Error('YesCaptcha API Key 不能为空');
    }
    
    // 常量配置
    const SITE_KEY = '0x4AAAAAAA6vnrvBCtS4FAl-';
    const WEBSITE_URL = 'https://irys.xyz/faucet';
    
    const results = [];
    let successCount = 0;
    let failCount = 0;
    
    // 处理每个钱包
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      
      try {
        console.log(`📝 处理钱包 ${i + 1}/${wallets.length}: ${wallet.address}`);
        
        // 创建验证码任务
        const taskId = await createCaptchaTask(
          wallet.address, 
          config.yescaptchaApiKey, 
          SITE_KEY, 
          WEBSITE_URL, 
          http
        );
        
        if (!taskId) {
          throw new Error('创建验证码任务失败');
        }
        
        console.log(`🔍 验证码任务已创建: ${taskId}`);
        
        // 获取验证码结果
        const captchaToken = await getCaptchaResult(
          taskId, 
          wallet.address, 
          config.yescaptchaApiKey, 
          http, 
          utils
        );
        
        console.log(`✅ 验证码获取成功: ${wallet.address}`);
        
        // 请求 Faucet
        const result = await requestFaucet(
          wallet.address, 
          captchaToken, 
          WEBSITE_URL, 
          http
        );
        
        results.push({
          wallet: wallet.address,
          name: wallet.name,
          success: true,
          message: result.message || '领取成功'
        });
        
        successCount++;
        console.log(`✅ ${wallet.name} 领取成功: ${result.message || '成功'}`);
        
      } catch (error) {
        console.log(`❌ ${wallet.name} 领取失败: ${error.message}`);
        
        results.push({
          wallet: wallet.address,
          name: wallet.name,
          success: false,
          error: error.message
        });
        
        failCount++;
        
        // 如果是API配额问题，可以考虑停止
        if (error.message.includes('quota') || error.message.includes('limit')) {
          console.log('⚠️ 可能遇到API配额限制，建议稍后重试');
        }
      }
      
      // 进度显示
      console.log(`📊 进度: ${i + 1}/${wallets.length} (${Math.round((i + 1)/wallets.length*100)}%)`);
      
      // 请求间隔延时
      if (i < wallets.length - 1) {
        console.log(`⏰ 等待 ${config.delayBetweenRequests} 秒...`);
        await utils.delay(config.delayBetweenRequests * 1000);
      }
    }
    
    console.log(`📊 执行完成: ${successCount} 成功, ${failCount} 失败`);
    console.log('✅ Irys Faucet 脚本执行完成');
    
    return {
      success: true,
      message: `Faucet领取完成: ${successCount} 成功, ${failCount} 失败`,
      data: {
        results: results,
        summary: {
          total: wallets.length,
          success: successCount,
          failed: failCount
        }
      }
    };
    
  } catch (error) {
    console.log(`❌ 脚本执行失败: ${error.message}`);
    throw error;
  }
}

// 辅助函数：创建验证码任务
async function createCaptchaTask(walletAddress, apiKey, siteKey, websiteUrl, http) {
  try {
    const response = await http.post('https://api.yescaptcha.com/createTask', {
      clientKey: apiKey,
      task: {
        type: 'TurnstileTaskProxyless',
        websiteURL: websiteUrl,
        websiteKey: siteKey
      }
    });
    
    if (!response.data.taskId) {
      console.log(`❌ 创建验证码任务失败 - ${walletAddress}`);
      console.log('返回内容：', response.data);
      return null;
    }
    
    return response.data.taskId;
    
  } catch (error) {
    console.log(`❌ 创建验证码任务出错: ${error.message}`);
    throw new Error(`创建验证码任务失败: ${error.message}`);
  }
}

// 辅助函数：获取验证码结果
async function getCaptchaResult(taskId, walletAddress, apiKey, http, utils) {
  const maxAttempts = 60; // 最多等待5分钟 (60 * 5秒)
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    await utils.delay(5000); // 等待5秒
    attempts++;
    
    try {
      const response = await http.post('https://api.yescaptcha.com/getTaskResult', {
        clientKey: apiKey,
        taskId: taskId
      });
      
      if (response.data.status === 'ready') {
        return response.data.solution.token;
      } else if (response.data.status === 'processing') {
        console.log(`⏳ 等待验证码 (${attempts}/${maxAttempts}): ${walletAddress}`);
      } else {
        throw new Error(`验证码任务状态异常: ${response.data.status}`);
      }
      
    } catch (error) {
      console.log(`❌ 获取验证码结果出错: ${error.message}`);
      if (attempts >= 3) { // 连续失败3次后抛出错误
        throw new Error(`获取验证码结果失败: ${error.message}`);
      }
    }
  }
  
  throw new Error('验证码获取超时');
}

// 辅助函数：请求 Faucet
async function requestFaucet(walletAddress, captchaToken, websiteUrl, http) {
  try {
    const response = await http.post('https://irys.xyz/api/faucet', {
      captchaToken: captchaToken,
      walletAddress: walletAddress
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Origin': websiteUrl,
        'Referer': websiteUrl,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    return response.data;
    
  } catch (error) {
    if (error.response && error.response.data) {
      throw new Error(error.response.data.message || error.response.data.error || '请求失败');
    } else {
      throw new Error(`网络请求失败: ${error.message}`);
    }
  }
}

// 3. 模块导出 - 必需
module.exports = {
  getConfig,
  main
};