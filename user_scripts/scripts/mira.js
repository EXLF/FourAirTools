// 模块依赖将通过沙箱的 require 和 context 注入

function getConfig() {
  return {
    id: "mira_chat_bot_v3", // 使用新ID以避免与旧配置冲突
    name: "Mira项目聊天机器人 (项目集成版)",
    description: "与Klokapp AI进行交互，自动聊天并管理会话。此版本已集成到项目脚本框架中。",
    version: "3.0.0",
    author: "Original Author (Adapted for Project)",
    category: "聊天机器人",
    icon: "robot", // 或其他合适的 FontAwesome 图标
    imageUrl: "https://public.rootdata.com/images/b6/1739179963586.jpg",
    requires: {
      wallets: true,
      proxy: true,
      captcha: false,
    },
    // 声明此脚本需要通过沙箱 require() 加载的模块
    requiredModules: ["ethers", "crypto", "https-proxy-agent"],
    config: {
      // --- Klokapp API 和模型配置 ---
      klokapp_api_base_url: {
        type: "string",
        label: "Klokapp API基础URL",
        default: "https://api1-pp.klokapp.ai/v1",
      },
      klokapp_chat_model: {
        type: "string",
        label: "Klokapp 聊天模型",
        default: "gpt-4o-mini",
      },
      // --- 请求和操作延迟 ---
      axios_timeout_ms: {
        type: "number",
        label: "HTTP请求超时 (毫秒)",
        default: 30000,
      },
      main_loop_sleep_minutes: {
        type: "number",
        label: "主聊天循环后休眠 (分钟)",
        default: 1,
      },
      reconnect_delay_seconds: {
        type: "number",
        label: "连接失败后重试延迟 (秒)",
        default: 30,
      },
      chat_message_delay_seconds: {
        type: "number",
        label: "连续发送聊天消息间隔 (秒)",
        default: 6,
      },
      // --- 脚本行为配置 ---
      enable_script_level_proxy: {
        type: "boolean",
        label: "允许脚本使用全局选定的代理",
        default: true,
        description: "如果为true，脚本将尝试使用UI中选择的代理。"
      },
      questions_to_ask: {
        type: "textarea",
        label: "聊天问题列表 (每行一个)",
        default: "3*3=？\n5*5=？\n1+1=？\n2+2=？\n3+3=？\n4+4=？\n5+5=？\n6+6=？\n7+7=？\n8+8=？\n9+9=？\n10+10=？",
        description: "机器人将从中随机选择问题进行提问。"
      },
      klokapp_referral_code: {
        type: "string",
        label: "Klokapp推荐码 (可选)",
        default: "QFPJ2PYE",
      },
      // --- reCAPTCHA (CapSolver) 配置 ---
      enable_captcha_solving_for_login: {
        type: "boolean",
        label: "启用登录时自动解决reCAPTCHA",
        default: true,
      },
      capsolver_api_key: {
        type: "string", // UI上应为 password 类型
        label: "CapSolver API Key",
        default: "YOUR_CAPSOLVER_API_KEY_HERE",
        description: "用于解决Klokapp登录时的reCAPTCHA v3。"
      },
      klokapp_recaptcha_website_url: { // 添加，因为 solveRecaptchaV3 需要它
        type: "string",
        label: "Klokapp reCAPTCHA 网站URL",
        default: "https://klokapp.ai/login", // 通常是登录页面或触发验证码的页面
      },
      klokapp_recaptcha_site_key: {
        type: "string",
        label: "Klokapp reCAPTCHA 网站密钥",
        default: "6LcZrRMrAAAAAKllb4TLb1CWH2LR7iNOKmT7rt3L",
      },
      klokapp_recaptcha_page_action: {
        type: "string",
        label: "Klokapp reCAPTCHA PageAction (可选)",
        default: "WALLET_CONNECT", // 根据原脚本
      },
      // klokapp_recaptcha_anchor: { type: "string", label: "Klokapp reCAPTCHA Anchor (可选)", default: "1" },
      // klokapp_recaptcha_reload: { type: "string", label: "Klokapp reCAPTCHA Reload (可选)", default: "1" },
    },
  };
}

async function main(context) {
  // 从 context 中解构所需的服务和配置
  const { 
    wallets,                   // 选中的钱包数组 (期望包含 privateKey)
    config: userScriptConfig,  // 用户通过UI为此脚本实例配置的参数
    proxy: selectedGlobalProxy,  // 全局UI选中的代理对象 { url, host, port, ... }
    http: axiosInstance,       // 预配置的axios实例 (scriptEngine提供)
    utils                     // 实用函数集合 (scriptEngine提供, 如 delay, solveRecaptchaV3)
  } = context;

  // 获取脚本的默认配置，用于发生用户配置错误时回退
  const defaultConfig = getConfig().config;

  // --- 从 userScriptConfig (用户配置) 中解构参数并进行校验 ---
  let API_BASE_URL = userScriptConfig.klokapp_api_base_url;
  if (!API_BASE_URL || typeof API_BASE_URL !== 'string' || (!API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://'))) {
    console.warn(`警告：Klokapp API基础URL无效 ("${API_BASE_URL}")。将回退到默认值: "${defaultConfig.klokapp_api_base_url.default}"`);
    API_BASE_URL = defaultConfig.klokapp_api_base_url.default;
  }

  const CHAT_MODEL = userScriptConfig.klokapp_chat_model || defaultConfig.klokapp_chat_model.default;

  let AXIOS_TIMEOUT_MS = parseFloat(userScriptConfig.axios_timeout_ms);
  if (isNaN(AXIOS_TIMEOUT_MS) || AXIOS_TIMEOUT_MS <= 0) {
    console.warn(`警告：HTTP请求超时配置无效 ("${userScriptConfig.axios_timeout_ms}")。将回退到默认值: ${defaultConfig.axios_timeout_ms.default}毫秒`);
    AXIOS_TIMEOUT_MS = defaultConfig.axios_timeout_ms.default;
  }

  let MAIN_LOOP_SLEEP_MINUTES = parseFloat(userScriptConfig.main_loop_sleep_minutes);
  if (isNaN(MAIN_LOOP_SLEEP_MINUTES) || MAIN_LOOP_SLEEP_MINUTES < 0) { // 允许0分钟
    console.warn(`警告：主聊天循环后休眠配置无效 ("${userScriptConfig.main_loop_sleep_minutes}")。将回退到默认值: ${defaultConfig.main_loop_sleep_minutes.default}分钟`);
    MAIN_LOOP_SLEEP_MINUTES = defaultConfig.main_loop_sleep_minutes.default;
  }

  let RECONNECT_DELAY_SECONDS = parseFloat(userScriptConfig.reconnect_delay_seconds);
  if (isNaN(RECONNECT_DELAY_SECONDS) || RECONNECT_DELAY_SECONDS <= 0) {
    console.warn(`警告：连接失败后重试延迟配置无效 ("${userScriptConfig.reconnect_delay_seconds}")。将回退到默认值: ${defaultConfig.reconnect_delay_seconds.default}秒`);
    RECONNECT_DELAY_SECONDS = defaultConfig.reconnect_delay_seconds.default;
  }

  let CHAT_MESSAGE_DELAY_SECONDS = parseFloat(userScriptConfig.chat_message_delay_seconds);
  if (isNaN(CHAT_MESSAGE_DELAY_SECONDS) || CHAT_MESSAGE_DELAY_SECONDS < 0) { // 允许0秒
    console.warn(`警告：连续发送聊天消息间隔配置无效 ("${userScriptConfig.chat_message_delay_seconds}")。将回退到默认值: ${defaultConfig.chat_message_delay_seconds.default}秒`);
    CHAT_MESSAGE_DELAY_SECONDS = defaultConfig.chat_message_delay_seconds.default;
  }
  
  const ENABLE_SCRIPT_PROXY_USAGE = typeof userScriptConfig.enable_script_level_proxy === 'boolean' 
    ? userScriptConfig.enable_script_level_proxy 
    : defaultConfig.enable_script_level_proxy.default;
    
  const QUESTIONS_TEXT_AREA = userScriptConfig.questions_to_ask || defaultConfig.questions_to_ask.default;
  const REFERRAL_CODE = userScriptConfig.klokapp_referral_code || defaultConfig.klokapp_referral_code.default;
  
  const ENABLE_CAPTCHA_SOLVING = typeof userScriptConfig.enable_captcha_solving_for_login === 'boolean'
    ? userScriptConfig.enable_captcha_solving_for_login
    : defaultConfig.enable_captcha_solving_for_login.default;

  const CAPSOLVER_API_KEY = userScriptConfig.capsolver_api_key || defaultConfig.capsolver_api_key.default;
  
  let KLOKAPP_RECAPTCHA_WEBSITE_URL = userScriptConfig.klokapp_recaptcha_website_url;
  if (!KLOKAPP_RECAPTCHA_WEBSITE_URL || typeof KLOKAPP_RECAPTCHA_WEBSITE_URL !== 'string' || (!KLOKAPP_RECAPTCHA_WEBSITE_URL.startsWith('http://') && !KLOKAPP_RECAPTCHA_WEBSITE_URL.startsWith('https://'))) {
    console.warn(`警告：Klokapp reCAPTCHA 网站URL无效 ("${KLOKAPP_RECAPTCHA_WEBSITE_URL}")。将回退到默认值: "${defaultConfig.klokapp_recaptcha_website_url.default}"`);
    KLOKAPP_RECAPTCHA_WEBSITE_URL = defaultConfig.klokapp_recaptcha_website_url.default;
  }
  
  const KLOKAPP_RECAPTCHA_SITE_KEY = userScriptConfig.klokapp_recaptcha_site_key || defaultConfig.klokapp_recaptcha_site_key.default;
  const KLOKAPP_RECAPTCHA_PAGE_ACTION = userScriptConfig.klokapp_recaptcha_page_action || defaultConfig.klokapp_recaptcha_page_action.default;

  // 从沙箱的 require 加载声明的模块
  const { ethers } = require('ethers');
  const crypto = require('crypto');
  const { HttpsProxyAgent } = require('https-proxy-agent'); // HttpsProxyAgent 构造函数

  // 使用注入的 console 进行日志记录
  console.info("🚀 Mira项目聊天机器人 (项目集成版) v3.0.0 开始执行...");
  console.info(`使用API基地址: ${API_BASE_URL}`);
  console.info(`重连延迟: ${RECONNECT_DELAY_SECONDS}秒`);

  // 将时间转换为毫秒
  const RECONNECT_DELAY_MS = RECONNECT_DELAY_SECONDS * 1000;
  const CHAT_DELAY_MS = CHAT_MESSAGE_DELAY_SECONDS * 1000;
  const MAIN_LOOP_SLEEP_MS = MAIN_LOOP_SLEEP_MINUTES * 60 * 1000;

  // 从 context.utils 获取 delay 和 solveRecaptchaV3 (已由scriptEngine注入)
  const { delay, solveRecaptchaV3 } = utils;

  // --- 辅助函数区域 ---
  function parseQuestionsFromTextArea(textAreaContent) {
    if (!textAreaContent || typeof textAreaContent !== 'string') {
      console.warn('📜 问题列表内容为空或格式不正确，使用默认问题。');
      return ["以太坊最近有什么更新？", "Web3 有哪些好处？"];
    }
    const lines = textAreaContent.split('\n');
    const parsedQuestions = lines
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#')); // 忽略空行和注释行
    
    if (parsedQuestions.length === 0) {
      console.warn('📜 解析后问题列表为空，使用默认问题。');
      return ["什么是智能合约？", "1+1=?"];
    }
    console.info(`📜 已加载 ${parsedQuestions.length} 个问题从配置。`);
    return parsedQuestions;
  }

  const questionsToAsk = parseQuestionsFromTextArea(QUESTIONS_TEXT_AREA);

  // --- KlokappBot 类定义 (基于原脚本修改) ---
  class KlokappBot {
    constructor(walletInfo, botConfig) { // walletInfo: { address, privateKey }, botConfig: 包含所有需要的配置的对象
      this.baseUrl = botConfig.API_BASE_URL;
      if (!this.baseUrl || typeof this.baseUrl !== 'string' || (!this.baseUrl.startsWith('http://') && !this.baseUrl.startsWith('https://'))) {
        // 这是致命错误，因为没有有效的基础URL，机器人无法工作
        const errorMsg = `KlokappBot初始化错误：API基础URL无效或未提供 ("${this.baseUrl}")。请检查脚本配置。`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      }
      this.chatModel = botConfig.CHAT_MODEL;
      this.axiosTimeout = botConfig.AXIOS_TIMEOUT_MS;
      this.referralCode = botConfig.REFERRAL_CODE;

      if (!walletInfo || !walletInfo.privateKey) {
        throw new Error("KlokappBot初始化错误：钱包信息无效或缺少私钥。");
      }
      this.wallet = new ethers.Wallet(walletInfo.privateKey); // 使用传入的私钥创建钱包实例
      console.info(`🔑 KlokappBot使用钱包: ${this.wallet.address}`);

      this.sessionToken = null;
      this.running = true; // 控制主循环是否继续
      this.apiClient = null; // 将通过 setupApi 初始化

      // 代理决策: 仅当脚本配置允许且全局代理已选择时，才使用代理
      this.activeProxy = (botConfig.ENABLE_SCRIPT_PROXY_USAGE && botConfig.selectedGlobalProxy) 
                          ? botConfig.selectedGlobalProxy 
                          : null;

      if (this.activeProxy && this.activeProxy.url) {
        console.info(`🔌 KlokappBot将尝试通过代理 (${this.activeProxy.host}:${this.activeProxy.port}) 进行连接。`);
      } else {
        console.info("🤖 KlokappBot将不使用代理，直接连接。");
      }
      this.setupApi(); // 必须在构造函数中调用以初始化 apiClient
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

      const axiosConfig = {
        baseURL: this.baseUrl,
        timeout: this.axiosTimeout,
        headers: headers,
      };

      if (this.activeProxy && this.activeProxy.url) {
        try {
          // HttpsProxyAgent 是从沙箱 require 加载的构造函数
          axiosConfig.httpsAgent = new HttpsProxyAgent(this.activeProxy.url);
          axiosConfig.proxy = false; // 当使用 agent 时，axios 的原生 proxy 字段应为 false
          console.info("KlokappBot: HttpsProxyAgent已为axios客户端配置。");
        } catch (proxyError) {
          console.error(`KlokappBot: 创建HttpsProxyAgent失败: ${proxyError.message}。将不使用代理。`);
          this.activeProxy = null; // 代理配置失败，则禁用代理
        }
      }
      
      // axiosInstance 是从 context.http 注入的
      this.apiClient = axiosInstance.create(axiosConfig);

      // 可选: 添加响应拦截器以更好地识别代理/网络错误
      this.apiClient.interceptors.response.use(
        response => response,
        error => {
          const isNetworkOrProxyError = 
            error.code === 'ECONNABORTED' ||  // 超时
            error.code === 'ECONNREFUSED' || // 连接被拒
            error.code === 'ECONNRESET'   || // 连接被重置
            (error.message && error.message.toLowerCase().includes('socket hang up')) ||
            (!error.response && this.activeProxy); // 没有响应且正在使用代理，也可能是代理问题
          
          if (isNetworkOrProxyError) {
            error.isProxyError = true; // 自定义一个标志
            console.warn(`KlokappBot: API请求可能遇到网络或代理问题: ${error.message}`);
          }
          return Promise.reject(error);
        }
      );
      // console.info("KlokappBot: API客户端已设置/更新。");
    }

    async connectWallet(botConfig) { // botConfig包含验证码相关参数
      console.info("🔗 KlokappBot: 正在尝试连接钱包并登录Klokapp...");
      try {
        if (!this.apiClient) this.setupApi(); // 确保API客户端已初始化

        // 签名信息 (根据原mira.js的逻辑)
        const nonce = ethers.hexlify(ethers.randomBytes(48)).substring(2);
        const messageToSign = [
          `klokapp.ai wants you to sign in with your Ethereum account:`,
          this.wallet.address,
          ``,
          ``,
          `URI: https://klokapp.ai/`,
          `Version: 1`,
          `Chain ID: 1`,
          `Nonce: ${nonce}`,
          `Issued At: ${new Date().toISOString()}`,
        ].join("\n");

        console.info("📝 KlokappBot: 正在为登录签名消息...");
        const signature = await this.wallet.signMessage(messageToSign);

        const requestPayload = {
          signedMessage: signature,
          message: messageToSign,
          referral_code: this.referralCode || undefined, // 使用类属性
        };

        // 处理 reCAPTCHA
        if (botConfig.ENABLE_CAPTCHA_SOLVING) {
          if (!botConfig.CAPSOLVER_API_KEY || botConfig.CAPSOLVER_API_KEY === "YOUR_CAPSOLVER_API_KEY_HERE") {
            console.warn("KlokappBot: 已启用验证码解决，但CapSolver API Key未配置或为占位符。将跳过验证码。");
          } else {
            console.info("KlokappBot: 正在尝试解决登录reCAPTCHA...");
            try {
              // 调用注入的 solveRecaptchaV3 函数
              // 它需要 httpClient (我们用 this.apiClient 的一个副本或直接用它，但要注意副作用，最好是独立的axios实例)
              // ProxyAgentConstructor (我们用沙箱 require 的 HttpsProxyAgent)
              // proxy (我们用 this.activeProxy)
              // 和其他 captcha 相关参数
              const recaptchaToken = await solveRecaptchaV3(
                this.apiClient,             // 将当前axios实例传递给solver (它内部会用这个发请求)
                HttpsProxyAgent,           // 传递 HttpsProxyAgent 构造函数
                this.activeProxy,           // 传递当前选定的代理配置
                botConfig.CAPSOLVER_API_KEY,
                botConfig.KLOKAPP_RECAPTCHA_WEBSITE_URL,
                botConfig.KLOKAPP_RECAPTCHA_SITE_KEY,
                botConfig.KLOKAPP_RECAPTCHA_PAGE_ACTION
                // botConfig.KLOKAPP_RECAPTCHA_ANCHOR, // 如果需要，从配置中获取
                // botConfig.KLOKAPP_RECAPTCHA_RELOAD  // 如果需要，从配置中获取
              );

              if (recaptchaToken) {
                requestPayload.recaptcha_token = recaptchaToken;
                console.info("KlokappBot: ✅ reCAPTCHA token已成功获取并添加到登录请求中。");
              } else {
                console.warn("KlokappBot: ⚠️ 未能获取reCAPTCHA token。将尝试无验证码登录。");
              }
            } catch (captchaError) {
              console.error(`KlokappBot: ❌ 解决reCAPTCHA时发生错误: ${captchaError.message}。将尝试无验证码登录。`);
            }
          }
        }

        console.info("🔐 KlokappBot: 正在向Klokapp API发送验证/登录请求...");
        const response = await this.apiClient.post('/verify', requestPayload); // 原脚本的 /verify 端点
        const responseData = response.data;

        if (responseData && responseData.session_token) {
          this.sessionToken = responseData.session_token;
          this.setupApi(); // 使用新的 session_token 更新 apiClient 的 headers
          console.success("✅ KlokappBot: 钱包连接和登录成功! Session token已获取。");
          return true;
        } else {
          console.error("KlokappBot: 登录失败，响应中未找到session_token。响应数据:", responseData);
          return false;
        }
      } catch (error) {
        let errorMessage = error.isProxyError ? `可能的网络/代理错误: ${error.message}` : error.message;
        if (error.response) {
          errorMessage = `Klokapp API错误 ${error.response.status}: ${JSON.stringify(error.response.data || error.message)}`;
        }
        console.error(`KlokappBot: ❌ 连接钱包/登录过程中发生严重错误: ${errorMessage}`);
        this.sessionToken = null; // 清除可能无效的token
        return false;
      }
    }

    async sendMessage(threadId, messageContent) {
      if (!this.sessionToken) {
        console.error("KlokappBot: 无法发送消息，会话Token无效。请先连接钱包。");
        throw new Error("sendMessage错误：会话Token无效");
      }
      console.info(`💬 KlokappBot: 向线程 [${threadId || '新线程'}] 发送消息: "${messageContent.substring(0, 50)}..."`);
      try {
        const requestBody = {
          id: threadId || crypto.randomUUID(), // 如果没有threadId，创建一个新的
          title: "", // Klokapp API 可能需要或忽略
          messages: [{ role: "user", content: messageContent }],
          sources: [],
          model: this.chatModel, // 使用配置的聊天模型
          created_at: new Date().toISOString(),
          language: "english", // 或根据需要配置
        };
        const response = await this.apiClient.post('/chat', requestBody);
        const data = response.data;
        if (data && data.choices && data.choices.length > 0 && data.choices[0].message && data.choices[0].message.content) {
          console.success(`✅ KlokappBot: 收到回复: "${data.choices[0].message.content.substring(0, 100)}..."`);
          return data.choices[0].message; // 返回整个消息对象，可能包含 role 和 content
        } else if (data && data.message) { // 兼容原脚本可能的返回结构
            console.success(`✅ KlokappBot: 收到回复 (简单结构): "${data.message.substring(0,100)}..."`);
            return { content: data.message };
        } else {
          console.warn("KlokappBot: 收到的聊天回复结构未知或不完整。", data);
          return { content: "收到了未知结构的回复。" };
        }
      } catch (error) {
        let errorMessage = error.isProxyError ? `可能的网络/代理错误: ${error.message}` : error.message;
        if (error.response) {
            errorMessage = `Klokapp API错误 ${error.response.status}: ${JSON.stringify(error.response.data || error.message)}`;
        }
        console.error(`KlokappBot: ❌ 发送消息时出错: ${errorMessage}`);
        throw error; // 重新抛出错误，让调用者处理
      }
    }

    async getUserLimits() {
      if (!this.sessionToken) {
        console.warn("KlokappBot: 无法获取用户限制，会话Token无效。");
        return { remainingMessages: 0, totalMessages: 0, isPremium: false, resetTime: null }; 
      }
      try {
        const response = await this.apiClient.get('/rate-limit');
        const rateLimitData = response.data;
        if (rateLimitData && typeof rateLimitData === 'object') {
          console.info(`KlokappBot: 用户限制 - 剩余: ${rateLimitData.remaining}, 总数: ${rateLimitData.limit}`);
          return {
            remainingMessages: rateLimitData.remaining || 0,
            totalMessages: rateLimitData.limit || 0,
            isPremium: (rateLimitData.limit || 0) > 10, // 假设免费版限制为10
            resetTime: rateLimitData.reset_time || null,
          };
        }
        throw new Error("获取速率限制失败: 无效的响应数据");
      } catch (error) {
        // ...错误处理同上...
        console.error(`KlokappBot: ❌ 获取用户速率限制时出错: ${error.message}`);
        return { remainingMessages: 0, totalMessages: 0, isPremium: false, resetTime: null };
      }
    }

    async getUserPoints() {
      if (!this.sessionToken) { /* ... */ return { totalPoints: 0 }; }
      try {
        const response = await this.apiClient.get('/points');
        const pointsData = response.data;
        if (pointsData && typeof pointsData === 'object') {
          console.info(`KlokappBot: 用户积分 - 总积分: ${pointsData.total_points}`);
          return { totalPoints: pointsData.total_points || 0 };
        }
        throw new Error("获取积分失败: 无效的响应数据");
      } catch (error) {
        // ...错误处理同上...
        console.error(`KlokappBot: ❌ 获取用户账户积分时出错: ${error.message}`);
        return { totalPoints: 0 };
      }
    }

    async performSingleChatSession(questions, chatDelayMs) {
      if (!questions || questions.length === 0) { // 检查 questions 是否有效且不为空
        console.info("KlokappBot: 问题列表为空，跳过聊天会话。");
        return;
      }
      let userLimits = await this.getUserLimits();
      console.info(`KlokappBot: 账户状态 - ${userLimits.isPremium ? "⭐ 付费版" : "🔄 免费版"}. 可用消息: ${userLimits.remainingMessages}/${userLimits.totalMessages}.`);
      
      if (userLimits.remainingMessages <= 0) {
        console.info("KlokappBot: ❗ 没有剩余的聊天消息。本次聊天会话将不执行。");
        return;
      }

      const pointsBefore = await this.getUserPoints();
      console.info(`KlokappBot: 💰 开始聊天前账户总积分: ${pointsBefore.totalPoints}`);

      // 目标聊天次数为当前剩余消息数
      const chatsToPerformTarget = userLimits.remainingMessages;
      console.info(`KlokappBot: 🎯 本轮目标执行 ${chatsToPerformTarget} 次聊天交互 (基于剩余消息数)。`);
      let completedChatsThisSession = 0;

      for (let i = 0; i < chatsToPerformTarget; i++) {
        if (!this.running) {
          console.info("KlokappBot: 机器人被外部停止，中断聊天会话。");
          break;
        }
        // 从问题列表中循环选择问题
        const question = questions[i % questions.length]; 
        const threadId = crypto.randomUUID(); // 为每次提问创建一个新线程ID或复用逻辑
        // 日志中显示当前是第几次，总目标是剩余消息数
        console.info(`--- KlokappBot: 聊天 ${i + 1}/${chatsToPerformTarget} (线程: ${threadId.substring(0,8)}) ---`);
        console.info(`❓ KlokappBot: 提问: ${question}`);
        try {
          await this.sendMessage(threadId, question);
          completedChatsThisSession++;
        } catch (sendError) {
          console.error(`KlokappBot: ❌ 发送消息 #${i+1} 时出错，将跳过此条并尝试下一条: ${sendError.message}`);
          if (sendError.isProxyError) { /* 可能需要特殊处理，如提示检查代理 */ }
          // 如果是严重错误（如token失效），可能需要跳出循环或重新连接
          // 为了简单起见，目前仅跳过此条消息
        }
        
        // 每次发送后更新限制信息（如果API实时扣费且此调用不计费，则可以考虑）
        // 为了避免不必要的API调用，可以只在循环开始前获取一次，或在循环结束后获取最终状态
        // userLimits = await this.getUserLimits(); 
        // if (userLimits.remainingMessages <= 0) { // 如果消息在此循环中用完
        //    console.info("KlokappBot: ❗ 消息已用尽，提前结束本轮聊天。");
        //    break;
        // }

        if (i < chatsToPerformTarget - 1 && this.running) { // 确保不是最后一次迭代且机器人仍在运行
          console.info(`KlokappBot: ⏳ 等待 ${chatDelayMs / 1000} 秒进行下一次聊天...`);
          await delay(chatDelayMs); // 使用注入的 delay
        }
      }
      console.info(`KlokappBot: 🎉 本轮聊天会话完成! 共成功执行 ${completedChatsThisSession} 次聊天。`);
      const pointsAfter = await this.getUserPoints();
      const limitsAfter = await this.getUserLimits();
      console.info(`KlokappBot: 💰 聊天后账户总积分: ${pointsAfter.totalPoints} (变化: ${pointsAfter.totalPoints - pointsBefore.totalPoints})`);
      console.info(`KlokappBot: 💬 最终剩余消息: ${limitsAfter.remainingMessages}/${limitsAfter.totalMessages}`);
    }

    // 主执行循环
    async start(botConfig, questions, mainLoopSleepMs, reconnectDelayMs, chatDelayMs) {
      console.info("KlokappBot实例主循环启动...");
      this.running = true;

      while (this.running) {
        try {
          if (!this.sessionToken) {
            const connected = await this.connectWallet(botConfig); // 传递 captcha 相关配置
            if (!connected) {
              console.info(`KlokappBot: 🔄 连接Klokapp失败，将在 ${reconnectDelayMs / 1000} 秒后重试...`);
              await delay(reconnectDelayMs);
              continue; // 跳过本次循环的聊天部分，尝试重新连接
            }
          }
          // 连接成功后，执行聊天会话
          await this.performSingleChatSession(questions, chatDelayMs);

          if (!this.running) break; // 循环中再次检查 running 状态

          console.info(`KlokappBot: 😴 主聊天会话完成，机器人将休眠 ${mainLoopSleepMs / 60000} 分钟...`);
          await delay(mainLoopSleepMs);

        } catch (loopError) {
          console.error(`KlokappBot: ❌ 主执行循环中发生错误: ${loopError.message}`, loopError.stack);
          this.sessionToken = null; // 发生错误时，清除会话token以强制下次重新登录
          if (loopError.isProxyError && this.activeProxy) {
            console.warn("KlokappBot: 错误可能与代理相关。当前脚本不自动切换代理，请检查代理设置。如果问题持续，尝试禁用脚本级代理或更换全局代理。");
          }
          console.info(`KlokappBot: 🔄 等待 ${reconnectDelayMs / 1000} 秒后重试整个循环...`);
          await delay(reconnectDelayMs);
        }
      }
      console.info("🛑 KlokappBot主循环已正常停止。");
    }

    // 外部停止方法
    stop() {
      console.info("KlokappBot: 收到停止信号，将尝试优雅关闭...");
      this.running = false;
      // 这里可以添加其他清理逻辑，例如中断正在进行的API请求（如果axios支持AbortController且已配置）
    }
  } // --- End of KlokappBot Class ---

  // --- main 函数的执行逻辑 ---
  if (!wallets || wallets.length === 0) {
    console.error("Mira脚本执行终止：未选择任何钱包。");
    return { success: false, error: "未选择钱包。脚本需要一个包含私钥的钱包才能运行。" };
  }
  const primaryWallet = wallets[0]; // 默认使用第一个选中的钱包
  if (!primaryWallet || !primaryWallet.privateKey) {
    console.error("Mira脚本执行终止：选中的主钱包无效或缺少私钥信息。");
    return { success: false, error: "主钱包信息无效或缺少私钥。" };
  }

  // 将所有需要的配置整合到一个对象中传递给Bot实例
  const botInternalConfig = {
    API_BASE_URL,
    CHAT_MODEL,
    AXIOS_TIMEOUT_MS,
    REFERRAL_CODE,
    ENABLE_SCRIPT_PROXY_USAGE,
    selectedGlobalProxy, // 从 context 传入
    // Captcha 相关配置也从 userScriptConfig 获取并传入
    ENABLE_CAPTCHA_SOLVING,
    CAPSOLVER_API_KEY,
    KLOKAPP_RECAPTCHA_WEBSITE_URL,
    KLOKAPP_RECAPTCHA_SITE_KEY,
    KLOKAPP_RECAPTCHA_PAGE_ACTION,
    // KLOKAPP_RECAPTCHA_ANCHOR,
    // KLOKAPP_RECAPTCHA_RELOAD,
  };

  const botInstance = new KlokappBot(primaryWallet, botInternalConfig);
  
  // 监听停止信号 (如果scriptEngine支持)
  // context.onStop = () => {
  //   botInstance.stop();
  // };

  try {
    console.info("Mira脚本：即将启动KlokappBot主循环...");
    // 启动机器人主循环，并传递其他操作参数
    await botInstance.start(
      botInternalConfig, // 再次传递包含验证码等配置的对象
      questionsToAsk, 
      MAIN_LOOP_SLEEP_MS, 
      RECONNECT_DELAY_MS, 
      CHAT_DELAY_MS
    );
    console.info("Mira脚本：KlokappBot主循环已结束（可能被外部停止）。");
    return { success: true, message: "机器人主循环已结束。" };
  } catch (executionError) {
    console.error("💥 Mira脚本顶层执行错误:", executionError);
    return { success: false, error: `脚本执行顶层错误: ${executionError.message}` };
  }
}

// 导出 getConfig 和 main 函数，以符合脚本引擎的规范
module.exports = { getConfig, main };
 