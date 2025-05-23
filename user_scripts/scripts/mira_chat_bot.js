// const { ethers } = require('ethers'); // 将通过 context.api 提供
// const axios = require('axios');     // 将通过 context.api 提供
// const crypto = require('crypto');   // 将通过 context.api 提供
// const fs = require('fs');
// const path = require('path');
// const { HttpsProxyAgent } = require('https-proxy-agent'); // 将通过 context.api 提供
// const { solveRecaptchaV3 } = require('../common/captcha/recaptchaV3Solver.js'); // 将通过 context.api 提供

// module.exports = {
//   metadata: {
function getConfig() {
  return {
    id: "mira_chat_bot",
    name: "Mira项目聊天机器人",
    description: "与Klokapp AI进行交互，自动聊天并管理会话。",
    version: "1.0.0",
    author: "Original Author & FourAir for adaptation", // 请替换为原作者信息
    category: "聊天机器人", // 或其他合适的分类
    icon: "comments", // FontAwesome 图标
    imageUrl: "https://public.rootdata.com/images/b6/1739179963586.jpg", // 可选：一个代表脚本的图片URL
    requires: {
      wallets: true, // 脚本似乎需要私钥来签名，对应钱包
      proxy: true,   // 脚本支持代理
      captcha: true // 如果验证码是核心功能且总是需要，可以加一个标识
    },
    platforms: [], // 如果特定于某些链或平台
    config: {
      // --- API 和模型配置 ---
      api_base_url: {
        type: "string",
        label: "API基础URL",
        default: "https://api1-pp.klokapp.ai/v1"
      },
      chat_model: {
        type: "string",
        label: "聊天模型",
        default: "gpt-4o-mini"
      },
      axios_timeout_ms: {
        type: "number",
        label: "请求超时 (毫秒)",
        default: 30000
      },
      // --- 循环和延迟 ---
      main_loop_sleep_minutes: {
        type: "number",
        label: "主循环休眠 (分钟)",
        default: 5
      },
      reconnect_delay_seconds: {
        type: "number",
        label: "重连延迟 (秒)",
        default: 60
      },
      chat_delay_seconds: {
        type: "number",
        label: "聊天间隔 (秒)",
        default: 10
      },
      // --- 代理配置 (由 requires.proxy 和 utils.selectedProxy 处理，但可以保留一个开关) ---
      enable_script_proxy: { // 注意：这与全局代理开关不同，这是脚本内部是否尝试使用代理的逻辑
        type: "boolean",
        label: "脚本尝试使用代理 (若全局代理已选)",
        default: true
      },
      // --- 文件内容配置 (替代直接读文件) ---
      questions_content: {
        type: "textarea",
        label: "聊天问题列表 (每行一个, #开头为注释)",
        default: "以太坊最近有什么更新？\n权益证明（Proof of Stake）是如何工作的？\nWeb3 有哪些好处？\n1+1=?\n1+2=?"
      },
      // private_key_override: { // 如果不想使用选择的钱包，允许直接粘贴私钥 (不推荐，但原脚本有此逻辑)
      //   type: "password",
      //   label: "覆盖私钥 (可选, 优先于选定钱包)",
      //   default: ""
      // },
      referral_code: {
        type: "string",
        label: "推荐码 (可选)",
        default: "QFPJ2PYE"
      },
      // --- CAPTCHA 配置 ---
      enable_captcha: {
        type: "boolean",
        label: "启用登录人机验证",
        default: true
      },
      capsolver_api_key: {
        type: "string", // password type for UI
        label: "CapSolver API Key (用于登录验证码)",
        default: "CAP-F637477A7434C3BE9BBCFDE7B3CD94C187C92FC6AA5318F050BD9CB25F2648AD" // 从全局或安全存储获取更佳
      },
      klokappai_recaptcha_site_key: {
        type: "string",
        label: "Klokapp AI reCAPTCHA Site Key",
        default: "6LcZrRMrAAAAAKllb4TLb1CWH2LR7iNOKmT7rt3L" // 更新默认 Site Key
      },
      captcha_anchor: {
        type: "string",
        label: "reCAPTCHA Anchor (可选, Klokapp)",
        default: ""
      },
      captcha_reload: {
        type: "string",
        label: "reCAPTCHA Reload (可选, Klokapp)",
        default: ""
      },
      wallet_concurrency: {
        type: "number",
        label: "钱包并发数",
        default: 3
      }
    }
  };
}

// async execute(wallets, config, utils) {
async function main(context) {
  // 直接从 context 解构所需，移除对 context.api 的依赖
  const { wallets, config: scriptConfig, proxy: selectedProxy, http: httpClient, utils } = context;
  const { ethers } = require('ethers');
  const crypto = require('crypto');
  // const { HttpsProxyAgent } = require('https-proxy-agent'); // 确保已安装并在 allowedModules
  // logger 替换为 console

  console.info("🚀 Mira项目聊天机器人开始执行...");

  // --- 从 scriptConfig 对象中解构配置 ---
  const API_BASE_URL = scriptConfig.api_base_url;
  const CHAT_MODEL = scriptConfig.chat_model;
  const AXIOS_TIMEOUT_MS = scriptConfig.axios_timeout_ms;
  const MAIN_LOOP_SLEEP_MINUTES = scriptConfig.main_loop_sleep_minutes;
  const RECONNECT_DELAY_SECONDS = scriptConfig.reconnect_delay_seconds;
  const CHAT_DELAY_SECONDS = scriptConfig.chat_delay_seconds;
  const ENABLE_SCRIPT_PROXY = scriptConfig.enable_script_proxy;
  const CAPTCHA_KEY = scriptConfig.capsolver_api_key;
  const ENABLE_CAPTCHA = scriptConfig.enable_captcha;
  const KLOKAPPAI_RECAPTCHA_SITE_KEY = scriptConfig.klokappai_recaptcha_site_key;
  const CAPTCHA_ANCHOR = scriptConfig.captcha_anchor;
  const CAPTCHA_RELOAD = scriptConfig.captcha_reload;

  const RECONNECT_DELAY_MS = RECONNECT_DELAY_SECONDS * 1000;
  const CHAT_DELAY_MS = CHAT_DELAY_SECONDS * 1000;
  const MAIN_LOOP_SLEEP_MS = MAIN_LOOP_SLEEP_MINUTES * 60 * 1000;

  // const delay = (ms) => new Promise((res) => setTimeout(res, ms)); // context.utils.delay 已提供

  // --- 加载问题 ---
  async function loadQuestionsFromConfig() {
      try {
        const content = scriptConfig.questions_content || "";
        const questionsList = content.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));

        if (questionsList.length === 0) {
          console.warn('📜 问题配置为空或无效，将使用默认问题');
          return ["以太坊最近有什么更新？", "1+1=?"];
        }
        console.info(`📜 已加载 ${questionsList.length} 个问题从配置`);
        return questionsList;
      } catch (error) {
        console.error(`❌ 加载问题时出错: ${error.message}`);
        return ["出错了，请检查系统", "1+1=?"];
      }
    }
  const questions = await loadQuestionsFromConfig();

    // --- KlokappBot 类定义 (大部分逻辑从原脚本迁移) ---
    class KlokappBotInternal {
      constructor(walletInstance) {
        this.baseUrl = API_BASE_URL;
        this.wallet = walletInstance;
        this.sessionToken = null;
        this.running = true;
        this.apiClient = null; // 将使用 httpClient (从 context 注入的 axios 实例)
        this.currentProxy = ENABLE_SCRIPT_PROXY && selectedProxy ? selectedProxy : null;

        if (this.currentProxy && this.currentProxy.url) { // 假设 selectedProxy 有 url
             console.info(`🔌 Bot将使用代理: ${this.currentProxy.url}`);
        } else {
            console.info("🤖 Bot将不使用代理直接连接");
        }
      }

      setupApi() {
        const headers = {
          'accept': '*/*',
          'accept-language': 'en-US,en;q=0.5',
          'cache-control': 'no-cache',
          'content-type': 'application/json',
          'origin': 'https://klokapp.ai',
          'pragma': 'no-cache',
          'referer': 'https://klokapp.ai/',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-site',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        };
        if (this.sessionToken) {
          headers['x-session-token'] = this.sessionToken;
        }

        let agent = null;
        if (this.currentProxy && this.currentProxy.url) {
            try {
                // const proxyUrl = new URL(this.currentProxy.url);
                // if (proxyUrl.protocol === 'https:' || proxyUrl.protocol === 'http:') {
                //    agent = new HttpsProxyAgent(this.currentProxy.url); // 如果 HttpsProxyAgent 可用
                //    console.info('HttpsProxyAgent已配置');
                // }
                // 简化：axios 内部处理代理，如果 httpClient 支持，或者通过 requestOptions.proxy
            } catch (e) {
                console.error('创建代理agent失败:', e.message);
            }
        }

        this.apiClient = httpClient.create({ // 使用注入的 httpClient (axios) 来创建实例
          baseURL: this.baseUrl,
          headers: headers,
          timeout: AXIOS_TIMEOUT_MS,
          // httpAgent: agent, // 用于HTTP
          // httpsAgent: agent, // 用于HTTPS, axios 会根据 baseURL 的协议选择
        });
        // console.info('Axios API client已设置');
      }

      async getSignature(message) {
        // ... (内部逻辑不变，但确保 this.wallet.privateKey 可用)
        if (!this.wallet || !this.wallet.privateKey) {
            console.error('❌ 钱包或私钥未提供，无法签名');
            throw new Error('Wallet or private key not available for signing.');
        }
        const signer = new ethers.Wallet(this.wallet.privateKey);
        return await signer.signMessage(message);
      }

      async connectWallet() {
        console.info('🔗 正在连接钱包并获取会话token...');
        // ... 其他 connectWallet 逻辑，logger替换为 console
        // 例如: console.info(...); console.error(...);
        this.setupApi(); // 确保 apiClient 先被设置，内部可能不需要token

        const timestamp = Math.floor(Date.now() / 1000);
        const messageToSign = `klokapp.ai#${timestamp}`;
        let signature;
        try {
            signature = await this.getSignature(messageToSign);
        } catch (signError) {
            console.error(`❌ 签名消息失败: ${signError.message}`);
            return false;
        }

        let requestData = {
            address: this.wallet.address,
            sign: signature,
            timestamp: timestamp,
            invite_code: scriptConfig.referral_code || undefined
        };

        // 尝试添加验证码
        // if (ENABLE_CAPTCHA && CAPTCHA_KEY) {
        //     try {
        //         console.info('🔍 正在获取reCAPTCHA token...');
        //         const recaptchaToken = await solveRecaptchaV3(KLOKAPPAI_RECAPTCHA_SITE_KEY, 'https://klokapp.ai/login', CAPTCHA_KEY, CAPTCHA_ANCHOR, CAPTCHA_RELOAD, this.currentProxy);
        //         if (recaptchaToken) {
        //             requestData.captcha = recaptchaToken;
        //             console.info('✅ reCAPTCHA token已获取并添加');
        //         } else {
        //             console.warn('⚠️ 未能获取reCAPTCHA token');
        //         }
        //     } catch (captchaError) {
        //         console.error(`❌ 获取reCAPTCHA token失败: ${captchaError.message}`);
        //     }
        // }

        try {
            const response = await this.apiClient.post('/user/login', requestData);
            if (response.data && response.data.data && response.data.data.session_token) {
                this.sessionToken = response.data.data.session_token;
                this.setupApi(); // 使用新的session token重新配置API client
                console.success('✅ 钱包连接成功，会话token已获取!');
                return true;
            } else {
                console.error('❌ 连接钱包失败: 未找到session_token', response.data);
                return false;
            }
        } catch (error) {
            console.error('❌ 连接钱包请求失败:', error.response ? error.response.data : error.message);
            return false;
        }
      }
      // ... (其他类方法，确保 logger 都替换为 console)
      // 例如：sendMessage, getUserLimits, getUserPoints, performChats, startMainLoop
      // 确保它们内部的 this.apiClient 使用的是配置好的 axios 实例
      // 并且所有日志输出都改为 console.xxx
    }

    // --- 主逻辑 ---
    if (!wallets || wallets.length === 0) {
        console.error("脚本执行终止：未选择任何钱包。");
        return { success: false, error: "未选择钱包" };
    }
    
    // 导入批量处理器
    const { BatchWalletProcessor } = require('../../src/js/utils/batchWalletProcessor.js');
    
    // 创建处理器选项
    const processorOptions = {
        concurrency: scriptConfig.wallet_concurrency || 3, // 可以在配置中添加并发数设置
        maxRetries: 3,
        retryDelay: 2000,
        onProgress: (progress) => {
            const percentage = Math.round((progress.current / progress.total) * 100);
            console.info(`[批量处理] 进度: ${progress.current}/${progress.total} (${percentage}%) - 钱包: ${progress.wallet.address}`);
        },
        onError: (error) => {
            console.error(`[批量处理] 钱包 ${error.wallet.address} 处理失败: ${error.error.message} (重试: ${error.retries})`);
        }
    };
    
    // 创建批量处理器
    const processor = new BatchWalletProcessor(processorOptions);
    
    // 定义单个钱包的任务函数
    const walletTask = async (wallet, taskOptions) => {
        // 检查是否有私钥
        if (!wallet.privateKey) {
            throw new Error("钱包缺少私钥信息");
        }
        
        // 创建机器人实例
        const bot = new KlokappBotInternal(wallet);
        
        // 连接钱包
        const connected = await bot.connectWallet();
        if (!connected) {
            throw new Error("无法连接到Klokapp服务");
        }
        
        console.info(`✅ 钱包 ${wallet.address} 连接成功`);
        
        // 获取用户信息
        const userPoints = await bot.getUserPoints();
        const userLimits = await bot.getUserLimits();
        
        console.info(`📊 钱包 ${wallet.address} - 积分: ${userPoints}, 限制: ${userLimits.current}/${userLimits.max}`);
        
        // 执行聊天任务
        const chatResults = await bot.performChats(questions, CHAT_DELAY_MS, taskOptions.signal);
        
        return {
            address: wallet.address,
            connected: true,
            points: userPoints,
            limits: userLimits,
            chats: chatResults,
            timestamp: Date.now()
        };
    };
    
    // 添加所有钱包任务
    processor.addTask(wallets, walletTask);
    
    console.info(`🚀 开始批量处理 ${wallets.length} 个钱包...`);
    
    // 开始处理
    const results = await processor.start();
    
    // 输出结果摘要
    console.info("="*50);
    console.info("📊 批量处理完成摘要:");
    console.info(`- 总钱包数: ${results.totalTasks}`);
    console.info(`- 成功: ${results.successCount}`);
    console.info(`- 失败: ${results.errorCount}`);
    console.info(`- 耗时: ${(results.duration / 1000).toFixed(2)} 秒`);
    console.info("="*50);
    
    // 输出详细成功结果
    if (results.successCount > 0) {
        console.info("\n✅ 成功的钱包:");
        Object.entries(results.results).forEach(([id, data]) => {
            console.info(`  - ${data.wallet.address}: 积分 ${data.result.points}, 聊天 ${data.result.chats?.length || 0} 条`);
        });
    }
    
    // 输出详细错误信息
    if (results.errorCount > 0) {
        console.error("\n❌ 失败的钱包:");
        Object.entries(results.errors).forEach(([id, data]) => {
            console.error(`  - ${data.wallet.address}: ${data.error}`);
        });
    }
    
    return {
        success: results.success,
        message: `批量处理完成: ${results.successCount}/${results.totalTasks} 成功`,
        summary: {
            total: results.totalTasks,
            success: results.successCount,
            failed: results.errorCount,
            duration: results.duration
        },
        details: results
    };
}

module.exports = { getConfig, main }; 