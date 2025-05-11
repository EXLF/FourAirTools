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
  const { wallets, params: config, api } = context;
  const { logger, proxy: selectedProxy, ethers, axios, crypto, HttpsProxyAgent, solveRecaptchaV3 } = api;

  // const { logger, http /*, proxy: selectedProxy */ } = utils; // selectedProxy 从 utils 中获取
  // let selectedProxy = utils.proxy; // 确保正确获取 // 已从 context.api 获取

    logger.info("🚀 Mira项目聊天机器人开始执行...");

    // --- 从 config 对象中解构配置 ---
    const API_BASE_URL = config.api_base_url;
    const CHAT_MODEL = config.chat_model;
    const AXIOS_TIMEOUT_MS = config.axios_timeout_ms;
    const MAIN_LOOP_SLEEP_MINUTES = config.main_loop_sleep_minutes;
    const RECONNECT_DELAY_SECONDS = config.reconnect_delay_seconds;
    const CHAT_DELAY_SECONDS = config.chat_delay_seconds;
    const ENABLE_SCRIPT_PROXY = config.enable_script_proxy;
    const CAPTCHA_KEY = config.capsolver_api_key;
    const ENABLE_CAPTCHA = config.enable_captcha;
    const KLOKAPPAI_RECAPTCHA_SITE_KEY = config.klokappai_recaptcha_site_key;
    const CAPTCHA_ANCHOR = config.captcha_anchor;
    const CAPTCHA_RELOAD = config.captcha_reload;


    const RECONNECT_DELAY_MS = RECONNECT_DELAY_SECONDS * 1000;
    const CHAT_DELAY_MS = CHAT_DELAY_SECONDS * 1000;
    const MAIN_LOOP_SLEEP_MS = MAIN_LOOP_SLEEP_MINUTES * 60 * 1000;

    const delay = (ms) => new Promise((res) => setTimeout(res, ms));

    // --- 加载问题 ---
  async function loadQuestionsFromConfig() {
      try {
        const content = config.questions_content || "";
        const questionsList = content.split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.startsWith('#'));

        if (questionsList.length === 0) {
          logger.warn('📜 问题配置为空或无效，将使用默认问题');
          return ["以太坊最近有什么更新？", "1+1=?"];
        }
        logger.info(`📜 已加载 ${questionsList.length} 个问题从配置`);
        return questionsList;
      } catch (error) {
        logger.error(`❌ 加载问题时出错: ${error.message}`);
        return ["出错了，请检查系统", "1+1=?"];
      }
    }
  const questions = await loadQuestionsFromConfig();

    // --- KlokappBot 类定义 (大部分逻辑从原脚本迁移) ---
    class KlokappBotInternal {
      constructor(walletInstance) {
        this.baseUrl = API_BASE_URL;
        this.wallet = walletInstance; // 从 execute 参数传入选中的钱包
        this.sessionToken = null;
        this.running = true; // 控制机器人主循环
      this.apiClient = null; // 将使用 context.api.axios 创建
        this.currentProxy = ENABLE_SCRIPT_PROXY && selectedProxy ? selectedProxy : null; // 使用传入的代理

        if (this.currentProxy) {
             logger.info(`🔌 Bot将使用代理: ${this.currentProxy.host}:${this.currentProxy.port}`);
        } else {
            logger.info("🤖 Bot将不使用代理直接连接");
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
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36' // 可以考虑配置化
        };
        if (this.sessionToken) {
          headers['x-session-token'] = this.sessionToken;
        }

        const axiosConfig = {
          baseURL: this.baseUrl,
          timeout: AXIOS_TIMEOUT_MS,
          headers
        };

        if (this.currentProxy && this.currentProxy.url) {
          try {
          const httpsAgent = new HttpsProxyAgent(this.currentProxy.url); // 使用 context.api.HttpsProxyAgent
            axiosConfig.httpsAgent = httpsAgent;
            axiosConfig.proxy = false;
            logger.info(` axios instance setup with proxy: ${this.currentProxy.host}`);
          } catch(agentError){
            logger.error(`创建HttpsProxyAgent失败: ${agentError.message}. 将不使用代理。`);
            this.currentProxy = null; // 代理创建失败，则不使用
          }
        }

      this.apiClient = axios.create(axiosConfig); // 使用 context.api.axios

      this.apiClient.interceptors.response.use(response => response, error => {
          if (error.code === 'ECONNABORTED' || error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET' ||
              (error.message && error.message.includes('socket hang up')) ||
              (error.message && error.message.includes('Proxy')) || !error.response) {
            error.isProxyError = true; // 标记为可能的代理错误
             logger.warn(`⚠️ 可能的代理或网络问题: ${error.message}`);
          }
          return Promise.reject(error);
        });
      }

      async connectWallet() {
        logger.info("🤝 KlokappBot: connectWallet 开始");
        if (!this.wallet) {
            logger.error("❌ 钱包实例未提供，无法连接。");
            throw new Error("钱包实例未提供");
        }
        try {
          this.setupApi(); // 确保API实例已为本次连接设置（可能无代理或有代理）

        const nonce = ethers.hexlify(ethers.randomBytes(48)).substring(2); // 使用 context.api.ethers
          const messageToSign = [
            `klokapp.ai wants you to sign in with your Ethereum account:`,
            this.wallet.address,
            ``,
            ``,
            `URI: https://klokapp.ai/`,
            `Version: 1`,
            `Chain ID: 1`, // 假设主网，如果Klokapp支持其他链，可能需要配置
            `Nonce: ${nonce}`,
            `Issued At: ${new Date().toISOString()}`,
          ].join("\n");

          logger.info("📝 正在签名认证消息...");
          const signature = await this.wallet.signMessage(messageToSign);
          logger.info(`✍️ 签名完成: ${signature.substring(0,15)}...`);

          let recaptchaToken = null;
          if (ENABLE_CAPTCHA) {
            logger.info("🛡️ 正在获取reCAPTCHA token...");
            const klokappWebsiteURL = "https://klokapp.ai/"; // 登录/验证码发生的页面

            if (!CAPTCHA_KEY) {
                logger.warn("🔑 CapSolver API Key 未配置，跳过 reCAPTCHA。");
            } else if (!KLOKAPPAI_RECAPTCHA_SITE_KEY || KLOKAPPAI_RECAPTCHA_SITE_KEY === "6LdRJIEpAAAAAM_YOUR_SITE_KEY_HERE" || KLOKAPPAI_RECAPTCHA_SITE_KEY === "") {
                logger.error("❗ Klokapp AI 的 reCAPTCHA V3 Site Key 未在脚本配置中正确提供或仍为占位符。");
                throw new Error("Klokapp reCAPTCHA V3 Site Key 未配置或为占位符");
            }
            else {
               recaptchaToken = await solveRecaptchaV3( // 使用 context.api.solveRecaptchaV3
                    this.currentProxy, // 使用当前bot实例的代理
                    CAPTCHA_KEY,
                    klokappWebsiteURL, // 这已经是 "https://klokapp.ai/"
                    KLOKAPPAI_RECAPTCHA_SITE_KEY,
                    "WALLET_CONNECT", // 更新 pageAction
                    CAPTCHA_ANCHOR, // 传递 anchor
                    CAPTCHA_RELOAD  // 传递 reload
                 );

                if (!recaptchaToken) {
                    logger.warn("😟 未能获取 reCAPTCHA token，将尝试无 token 连接。");
                } else {
                    logger.success(`✅ 成功获取 reCAPTCHA token: ${recaptchaToken.substring(0,10)}...`);
                }
            }
          }


          const verifyBody = {
            signedMessage: signature,
            message: messageToSign,
            referral_code: config.referral_code || "QFPJ2PYE",
          };

          if (recaptchaToken) {
            verifyBody.recaptcha_token = recaptchaToken;
          }

          logger.info("🔐 正在验证钱包到 Klokapp...");
        const response = await this.apiClient.post('/verify', verifyBody);
          const verifyData = response.data;

          if (!verifyData || !verifyData.session_token) {
            logger.error(`❌ 验证响应无效: ${JSON.stringify(verifyData)}`);
            throw new Error("验证响应中没有 session_token 或响应无效");
          }

          this.sessionToken = verifyData.session_token;
          this.setupApi(); // 使用新的session token重新配置API
          logger.success("✅ 钱包连接成功! Session token 已获取。");

        } catch (error) {
          let errorMessage = error.message;
          if (error.isProxyError) { // 优先判断自定义的isProxyError
            errorMessage = `钱包连接可能的代理问题: ${error.message}`;
          } else if (error.response) {
            errorMessage = `钱包验证API错误: ${error.response.status} - ${JSON.stringify(error.response.data) || error.message}`;
          } else if (error.request) {
            errorMessage = `钱包验证请求无响应: ${error.message}`;
            error.isProxyError = true; // 也标记为可能的代理问题
          }
          logger.error(`❌ 钱包连接失败: ${errorMessage}`);
          this.sessionToken = null;
          throw error; // 重新抛出，让上层处理重连/代理切换
        }
      }

      async sendMessage(threadId, messageContent) {
        if (!this.sessionToken) {
           logger.error("无法发送消息：sessionToken 无效");
           throw new Error("sessionToken 无效，请先连接钱包");
        }
        this.setupApi(); // 确保api实例是最新的

        try {
           const requestBody = {
              id: threadId,
              title: "", // 如果需要标题，可以从问题或配置生成
              messages: [{ role: "user", content: messageContent }],
              sources: [],
              model: CHAT_MODEL,
              created_at: new Date().toISOString(),
              language: "english",
            };
            logger.info(`💬 发送消息到线程 ${threadId}: "${messageContent.substring(0,30)}..."`);
          const response = await this.apiClient.post('/chat', requestBody);
            const data = response.data;

            if (data.choices && data.choices.length > 0 && data.choices[0].message) {
                return data.choices[0].message;
            } else if (data.message) { // 兼容可能的简单回复结构
                return { content: data.message };
            } else {
                logger.warn(`📝 收到未知聊天响应结构: ${JSON.stringify(data)}`);
                return { content: "收到未知响应结构" };
            }
        } catch (error) {
            let errorMessage = error.message;
            if (error.isProxyError) {
                errorMessage = `发送消息可能的代理问题: ${error.message}`;
            } else if (error.response) {
                errorMessage = `发送消息API错误: ${error.response.status} - ${JSON.stringify(error.response.data) || error.message}`;
            } else if (error.request) {
                errorMessage = `发送消息请求无响应: ${error.message}`;
                error.isProxyError = true;
            }
            logger.error(`❌ 发送消息失败: ${errorMessage}`);
            throw error;
        }
      }

      async getUserLimits() {
        if (!this.sessionToken) {
            logger.warn("无法获取用户限制：sessionToken 无效，返回默认值");
            return { remainingMessages: 1, totalMessages: 1, isPremium: false, resetTime: null }; // 返回少量消息以尝试一次
        }
        this.setupApi();
        try {
            logger.info("📊 正在获取用户速率限制...");
          const response = await this.apiClient.get('/rate-limit');
            const rateLimitData = response.data;
            if (rateLimitData === null || typeof rateLimitData !== 'object') {
                throw new Error(`无效的速率限制响应: ${JSON.stringify(rateLimitData)}`);
            }
            logger.info(`📊 限制: 剩余 ${rateLimitData.remaining}, 总共 ${rateLimitData.limit}`);
            return {
                remainingMessages: rateLimitData.remaining || 0,
                totalMessages: rateLimitData.limit || 0,
                isPremium: (rateLimitData.limit || 0) > 10, // 假设免费版限制为10
                resetTime: rateLimitData.reset_time || null,
            };
        } catch (error) {
            logger.error(`❌ 获取速率限制失败: ${error.message}. 返回默认值。`);
            return { remainingMessages: 1, totalMessages: 1, isPremium: false, resetTime: null };
        }
      }
      
      async getUserPoints() {
        if (!this.sessionToken) {
            logger.warn("无法获取用户积分：sessionToken 无效，返回默认值");
            return { totalPoints: 0 };
        }
        this.setupApi();
        try {
            logger.info("💰 正在获取用户积分...");
          const response = await this.apiClient.get('/points');
            const pointsData = response.data;
            if (pointsData === null || typeof pointsData !== 'object') {
                throw new Error(`无效的积分响应: ${JSON.stringify(pointsData)}`);
            }
            logger.info(`💰 积分: ${pointsData.total_points || 0}`);
            return { totalPoints: pointsData.total_points || 0 };
        } catch (error) {
            logger.error(`❌ 获取用户积分失败: ${error.message}. 返回0。`);
            return { totalPoints: 0 };
        }
      }

      async performChats() {
        logger.info("💬 开始聊天会话循环...");
        let userLimits = await this.getUserLimits();
        logger.info(`👤 账户状态: ${userLimits.isPremium ? "⭐ 付费版" : "🔄 免费版"}`);
        
        const userPoints = await this.getUserPoints(); // 获取积分
        logger.info(`💰 当前账号总积分: ${userPoints.totalPoints}`);

        logger.info(`💬 可用消息数: ${userLimits.remainingMessages}/${userLimits.totalMessages}`);
        if (userLimits.resetTime) {
            const resetDate = typeof userLimits.resetTime === "number" ? new Date(Date.now() + userLimits.resetTime * 1000) : new Date(userLimits.resetTime);
            logger.info(`⏰ 消息限制重置时间: ${resetDate.toLocaleString()}`);
        }


        let chatCount = userLimits.remainingMessages;
        if (chatCount <= 0) {
            logger.info("❗ 没有剩余的聊天消息。");
            this.running = false; 
            return;
        }
        logger.info(`🎯 将执行 ${chatCount} 次聊天。`);
        let completedChats = 0;

        while (completedChats < chatCount && this.running) {
            if (completedChats > 0) { 
                userLimits = await this.getUserLimits();
                if (userLimits.remainingMessages <= 0) {
                    logger.info("⛔ 中途检查发现已无剩余消息，停止。");
                    break;
                }
                 logger.info(`💬 更新后剩余消息: ${userLimits.remainingMessages}`);
            }

          const threadId = crypto.randomUUID(); // 使用 context.api.crypto
            const question = questions[Math.floor(Math.random() * questions.length)];
            logger.info(`\n📝 聊天 [${completedChats + 1}/${chatCount}] (线程ID: ${threadId.substring(0,8)})`);
            logger.info(`❓ 问题: ${question}`);

            try {
                const response = await this.sendMessage(threadId, question);
                logger.success(`✅ 回复: ${response.content.substring(0, 100)}...`);
                completedChats++;
            } catch (error) {
                logger.error(`❌ 当前聊天发送失败，将尝试继续: ${error.message}`);
            }
            
            logger.info(`📊 进度: ${completedChats}/${chatCount} 已完成`);

            if (completedChats < chatCount && this.running) {
                logger.info(`⏳ 等待 ${CHAT_DELAY_SECONDS} 秒进行下一次聊天...`);
                await delay(CHAT_DELAY_MS);
            }
        }
        if (this.running) {
            logger.info("\n🎉 所有计划的聊天会话已完成!");
            userLimits = await this.getUserLimits(); 
            logger.info(`💬 最终剩余消息数: ${userLimits.remainingMessages}`);
        }
      }

      async startMainLoop() {
        logger.info("🤖 KlokappBot 实例启动");

        if (!this.wallet) {
            logger.error("❌ 启动失败：钱包未初始化。");
            return { success: false, error: "钱包未初始化" };
        }
        logger.info(`🔑 使用钱包: ${this.wallet.address}`);

        while (this.running) {
            try {
                if (!this.sessionToken) {
                    await this.connectWallet(); 
                }
                await this.performChats(); 

                if (!this.running) break; 

                logger.info(`😴 主循环休眠 ${MAIN_LOOP_SLEEP_MINUTES} 分钟...`);
                await delay(MAIN_LOOP_SLEEP_MS);

            } catch (error) {
                logger.error(`❌ 主循环发生错误: ${error.message}`);
                this.sessionToken = null; 
                
                if (ENABLE_SCRIPT_PROXY && selectedProxy && error.isProxyError) {
                    logger.warn("🔄 发生代理相关错误，此脚本实例不处理自动切换。如果问题持续，请尝试更换全局代理设置。");
                }

                logger.info(`🔄 等待 ${RECONNECT_DELAY_SECONDS} 秒后重试...`);
                await delay(RECONNECT_DELAY_MS);
            }
        }
        logger.info("🛑 KlokappBot 主循环已停止。");
        return { success: true, data: "机器人正常停止" };
      }
    } // End of KlokappBotInternal class

    // --- 执行脚本 ---
    if (!wallets || wallets.length === 0) {
      logger.error("❌ 请至少选择一个钱包来运行此脚本。");
      return { success: false, error: "未选择钱包" };
    }
    
    const firstWalletInfo = wallets[0];
    let activeWalletInstance;

    try {
      if (firstWalletInfo.privateKey) {
        activeWalletInstance = new ethers.Wallet(firstWalletInfo.privateKey);
    } else if (firstWalletInfo instanceof api.ethers.Wallet) {
        activeWalletInstance = firstWalletInfo;
      } else {
        // 尝试通过 utils 调用主进程获取私钥 (如果您的框架支持)
        // const pk = await utils.getPrivateKeyForWallet(firstWalletInfo.address);
        // if (pk) activeWalletInstance = new ethers.Wallet(pk);
        // else throw new Error("无法获取私钥");
        logger.error(`❌ 选定的钱包 ${firstWalletInfo.address} 没有提供私钥或不是有效的ethers.Wallet实例。您可能需要调整脚本或钱包提供方式。`);
        return { success: false, error: "钱包私钥不可用或钱包实例无效" };
      }
    } catch (e) {
        logger.error(`❌ 初始化钱包失败: ${e.message}`);
        return { success: false, error: `钱包初始化失败: ${e.message}`};
    }


    const botInstance = new KlokappBotInternal(activeWalletInstance);
    
    try {
        const result = await botInstance.startMainLoop();
        logger.info("Mira聊天机器人执行完毕。");
        return result; 
    } catch (mainError) {
        logger.error(`💥 Mira聊天机器人执行过程中发生顶层错误: ${mainError.message}`);
        return { success: false, error: `机器人执行顶层错误: ${mainError.message}` };
    }
  }

module.exports = { getConfig, main }; 