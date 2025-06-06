/**
 * 全局验证码配置使用示例脚本
 * 功能：展示如何在脚本中使用全局验证码配置
 * 作者：FourAir开发团队
 * 版本：1.0.0
 * 更新：2024-12-19
 */

// 1. 配置函数 - 必需
function getConfig() {
  return {
    // 基本信息
    id: "global_captcha_example",
    name: "全局验证码配置示例",
    description: "展示如何使用全局验证码配置的示例脚本",
    version: "1.0.0",
    author: "FourAir开发团队",
    category: "示例脚本",
    icon: "fas fa-shield-check",
    
    // 依赖声明
    requires: {
      wallets: true,  // 需要钱包
      proxy: false    // 代理可选
    },
    
    // 模块声明
    requiredModules: ["axios"],
    
    // 支持平台
    platforms: ["通用"],
    
    // 执行超时 (5分钟)
    timeout: 300000,
    
    // 配置参数
    config: {
      useGlobalCaptcha: {
        type: "checkbox",
        label: "使用全局验证码配置",
        description: "推荐启用，将使用全局设置中的验证码服务",
        default: true
      },
      // 备用配置（仅在全局未配置时使用）
      backupCaptchaService: {
        type: "select",
        label: "备用验证码服务",
        description: "当全局验证码未配置时的服务选择（仅作演示，实际需要全局配置）",
        options: [
          { value: "2captcha", label: "2Captcha" },
          { value: "yescaptcha", label: "YesCaptcha" }
        ],
        default: "2captcha",
        required: false
      }
    }
  };
}

// 2. 主执行函数 - 必需
async function main(context) {
  // 从context获取参数
  const { wallets, config, proxy, utils, http, globalCaptcha } = context;
  
  try {
    console.log('🛡️ 全局验证码配置示例脚本开始执行...');
    console.log(`📋 钱包数量: ${wallets.length}`);
    
    // 检查全局验证码配置状态
    console.log('\n🔍 检查验证码配置状态:');
    
    if (globalCaptcha) {
      console.log(`   - 全局验证码模块: ✅ 可用`);
      console.log(`   - 默认服务: ${globalCaptcha.defaultService}`);
      console.log(`   - 是否配置: ${globalCaptcha.isConfigured() ? '✅ 是' : '❌ 否'}`);
      console.log(`   - 降级启用: ${globalCaptcha.enableFallback ? '✅ 是' : '❌ 否'}`);
      
      if (globalCaptcha.isConfigured()) {
        const apiKey = globalCaptcha.getApiKey();
        console.log(`   - API Key: ${apiKey ? apiKey.substring(0, 8) + '...' : '未配置'}`);
      }
    } else {
      console.log(`   - 全局验证码模块: ❌ 不可用`);
    }
    
    // 示例1: 检查验证码配置并决定处理策略
    console.log('\n🔧 验证码配置策略:');
    
    let captchaStrategy = {
      useGlobal: false,
      service: null,
      apiKey: null,
      available: false
    };
    
    if (config.useGlobalCaptcha && globalCaptcha && globalCaptcha.isConfigured()) {
      // 使用全局配置
      captchaStrategy = {
        useGlobal: true,
        service: globalCaptcha.defaultService,
        apiKey: globalCaptcha.getApiKey(),
        available: true
      };
      console.log(`   ✅ 使用全局验证码配置: ${captchaStrategy.service}`);
    } else {
      // 全局未配置的情况
      console.log(`   ❌ 全局验证码服务未配置`);
      console.log(`   💡 请在设置页面配置验证码服务以使用相关功能`);
      
      captchaStrategy = {
        useGlobal: false,
        service: config.backupCaptchaService || '2captcha',
        apiKey: null,
        available: false
      };
    }
    
    // 示例2: 使用全局验证码工具解决Turnstile验证码
    if (captchaStrategy.available && captchaStrategy.useGlobal) {
      console.log('\n🔐 验证码解决示例 (使用全局工具):');
      
      try {
        // 模拟解决Turnstile验证码
        const siteUrl = 'https://example.com';
        const siteKey = '0x4AAAAAAA6vnrvBCtS4FAl-';
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
        
        console.log(`   - 网站: ${siteUrl}`);
        console.log(`   - 站点密钥: ${siteKey}`);
        console.log(`   - 开始解决验证码...`);
        
        // 注意：这里只是示例，实际使用时请使用真实的站点信息
        // const captchaToken = await globalCaptcha.solveTurnstile(siteUrl, siteKey, userAgent, proxy, utils);
        
        // 为了演示，我们模拟一个成功的响应
        await utils.delay(2000); // 模拟等待时间
        const mockToken = 'mock_token_' + Date.now();
        
        console.log(`   ✅ 验证码解决成功: ${mockToken.substring(0, 20)}...`);
        
      } catch (error) {
        console.log(`   ❌ 验证码解决失败: ${error.message}`);
      }
    }
    
    // 示例3: 展示不同验证码服务的API Key管理
    console.log('\n🗝️ 全局API Key管理示例:');
    
    if (globalCaptcha) {
      console.log(`   - 2Captcha API Key: ${globalCaptcha.twoCaptchaApiKey ? '已配置' : '未配置'}`);
      console.log(`   - YesCaptcha API Key: ${globalCaptcha.yescaptchaApiKey ? '已配置' : '未配置'}`);
      
      // 演示获取特定服务的API Key
      const twoCaptchaKey = globalCaptcha.getApiKey('2captcha');
      const yesCaptchaKey = globalCaptcha.getApiKey('yescaptcha');
      
      console.log(`   - 获取2Captcha密钥: ${twoCaptchaKey ? '✅' : '❌'}`);
      console.log(`   - 获取YesCaptcha密钥: ${yesCaptchaKey ? '✅' : '❌'}`);
      
      // 演示检查特定服务是否配置
      console.log(`   - 2Captcha是否可用: ${globalCaptcha.isConfigured('2captcha') ? '✅' : '❌'}`);
      console.log(`   - YesCaptcha是否可用: ${globalCaptcha.isConfigured('yescaptcha') ? '✅' : '❌'}`);
      
      if (!globalCaptcha.isConfigured()) {
        console.log(`   💡 提示: 请在设置页面的"验证码服务"分组中配置API Key`);
      }
    } else {
      console.log(`   ❌ 全局验证码模块不可用`);
    }
    
    // 示例4: 模拟处理钱包
    console.log('\n👛 钱包处理示例:');
    let processedCount = 0;
    
    for (let i = 0; i < Math.min(wallets.length, 3); i++) { // 最多处理3个钱包作为示例
      const wallet = wallets[i];
      
      try {
        console.log(`   📝 处理钱包 ${i + 1}: ${wallet.address}`);
        
        // 在这里可以添加需要验证码的实际操作
        // 例如：水龙头领取、空投申请等
        
        // 模拟操作
        await utils.delay(1000);
        
        console.log(`   ✅ 钱包 ${wallet.address} 处理完成`);
        processedCount++;
        
      } catch (error) {
        console.log(`   ❌ 钱包 ${wallet.address} 处理失败: ${error.message}`);
      }
    }
    
    console.log('\n📊 执行总结:');
    console.log(`   - 验证码配置: ${captchaStrategy.available ? '✅ 可用' : '❌ 不可用'}`);
    console.log(`   - 使用策略: ${captchaStrategy.useGlobal ? '全局配置' : '备用配置'}`);
    console.log(`   - 处理钱包: ${processedCount}/${wallets.length}`);
    console.log('   - 脚本状态: ✅ 示例执行完成');
    
    return {
      success: true,
      message: `全局验证码示例执行完成: ${processedCount} 个钱包`,
      data: {
        captchaStrategy: captchaStrategy,
        processedWallets: processedCount,
        totalWallets: wallets.length
      }
    };
    
  } catch (error) {
    console.log(`❌ 脚本执行失败: ${error.message}`);
    throw error;
  }
}

// 3. 模块导出 - 必需
module.exports = {
  getConfig,
  main
}; 