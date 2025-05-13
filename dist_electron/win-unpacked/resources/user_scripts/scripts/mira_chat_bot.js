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
    
    // 假设我们只使用第一个选定的钱包进行演示
    const selectedWalletInfo = wallets[0]; 
    // TODO: 如果脚本需要处理多个钱包，这里需要循环或不同的逻辑
    // 注意：selectedWalletInfo 需要包含地址和私钥。当前从前端传来的钱包对象结构未知，假设它有 address 和 privateKey
    if (!selectedWalletInfo.privateKey) {
      console.error("选中的钱包缺少私钥信息，无法执行此脚本。");
      return { success: false, error: "钱包缺少私钥" };
    }

    const bot = new KlokappBotInternal(selectedWalletInfo); // 将选中的钱包信息传给机器人

    if (await bot.connectWallet()) {
        // await bot.startMainLoop(questions, CHAT_DELAY_MS, MAIN_LOOP_SLEEP_MS); // 主循环暂时注释，先测试连接和单次交互
        console.info("连接成功，可以尝试调用其他bot方法，如 performChats。主循环已注释。");
        // 示例：进行一次聊天
        const threads = await bot.apiClient.get('/chat/threads').then(r => r.data.data.threads).catch(() => []);
        if (threads.length > 0) {
            await bot.sendMessage(threads[0].id, questions[0] || "你好");
        } else {
            console.warn("没有找到聊天会话，无法发送消息。");
        }

    } else {
        console.error("无法连接到Klokapp服务，请检查配置和网络。");
    }

    console.info("Mira聊天机器人脚本执行流程结束（部分功能已注释，请逐步恢复测试）。");
    return { success: true, message: "脚本流程已执行，详情请看日志" }; 
}

module.exports = { getConfig, main }; 