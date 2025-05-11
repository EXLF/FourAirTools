import axios from "axios";

/**
 * 使用CapSolver API解决reCAPTCHA v3
 * @param {Object} proxy - 代理配置对象，格式: { host, port, username, password, url }
 * @param {string} clientKey - CapSolver的API密钥（必填）
 * @param {string} websiteURL - 目标网站的URL (必填，从 createTaskPayload 移至函数参数)
 * @param {string} websiteKey - 目标网站的reCAPTCHA站点密钥 (必填，从 createTaskPayload 移至函数参数)
 * @param {string} pageAction - reCAPTCHA的pageAction (可选，从 createTaskPayload 移至函数参数)
 * @param {string} anchor - reCAPTCHA的anchor (可选，从 createTaskPayload 移至函数参数)
 * @param {string} reload - reCAPTCHA的reload (可选，从 createTaskPayload 移至函数参数)
 * @returns {Promise<string|null>} - 返回reCAPTCHA token或null
 */
export async function solveRecaptchaV3(proxy = null, clientKey, websiteURL, websiteKey, pageAction = "", anchor = "", reload = "") {
  // 检查clientKey是否提供
  if (!clientKey) {
    //   throw new Error("CapSolver API Key未提供，请在设置中配置有效的API Key");
    console.error("CapSolver API Key未提供，请在设置中配置有效的API Key");
    return null; // 改为返回null而不是抛出错误，以便调用者处理
  }

  // 检查必填的网站参数
  if (!websiteURL || !websiteKey) {
    console.error("目标网站的URL (websiteURL) 和 reCAPTCHA站点密钥 (websiteKey) 是必填参数。");
    return null;
  }
  
  // API配置
  const API_URL = "https://api.capsolver.com";
  const CLIENT_KEY = clientKey;
  
  // 请求配置
  const config = {
    timeout: 60000, // 60秒超时
  };
  
  // 如果有代理，配置代理
  // 注意：https-proxy-agent 需要在 user_scripts 的执行环境中可用
  if (proxy && proxy.url) {
    console.log(`🔌 使用代理发送验证码请求: ${proxy.host}:${proxy.port}`);
    config.proxy = false; // axios 代理设置应为false，因为我们直接使用agent
    try {
        const { HttpsProxyAgent } = await import('https-proxy-agent'); // 动态导入
        config.httpsAgent = new HttpsProxyAgent(proxy.url);
    } catch (e) {
        console.error("加载 https-proxy-agent 失败。请确保它在环境中可用。", e);
        // 如果代理是必需的，可以选择返回或继续（取决于策略）
        // return null; 
    }
  }
  
  try {
    console.log("正在创建CapSolver reCAPTCHA v3任务...");
    
    // 创建任务的请求体
    const createTaskPayload = {
      clientKey: CLIENT_KEY,
      task: {
        type: "ReCaptchaV3EnterpriseTask", // 或者 ReCaptchaV3TaskProxyLess 如果不总是使用代理
        websiteURL: websiteURL,
        websiteKey: websiteKey,
        // pageAction, anchor, reload 将在下面根据条件添加
      }
    };

    // 根据条件添加可选参数
    if (pageAction) {
      createTaskPayload.task.pageAction = pageAction;
    }
    if (anchor) { // 根据用户请求，添加 anchor (如果提供)
      createTaskPayload.task.anchor = anchor;
    }
    if (reload) { // 根据用户请求，添加 reload (如果提供)
      createTaskPayload.task.reload = reload;
    }
    
    // 如果有代理，添加到任务中 (CapSolver代理格式)
    // 注意：这与 axios 的 httpsAgent 是两种不同的代理方式。
    // CapSolver 的 proxy 字段允许其服务器通过指定的代理访问目标网站。
    // axios 的 httpsAgent 使得你的 createTask / getTaskResult 请求通过代理发出。
    // 通常，如果你的脚本运行环境需要代理才能访问 CapSolver API，你会使用 httpsAgent。
    // 如果你想让 CapSolver 在解决验证码时使用特定代理访问目标网站，你会使用 task.proxy。
    if (proxy && proxy.host && proxy.port) { 
      const proxyString = proxy.username && proxy.password
        ? `http://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`
        : `http://${proxy.host}:${proxy.port}`;
      createTaskPayload.task.proxy = proxyString;
      // 如果使用CapSolver的代理，任务类型可能是 ReCaptchaV3Task
      // createTaskPayload.task.type = "ReCaptchaV3Task"; 
      console.log(`CapSolver任务将尝试使用代理: ${proxyString} 访问目标网站`);
    } else {
      // 未配置代理给CapSolver任务，CapSolver将使用其自己的IP池
      // 任务类型应为 ReCaptchaV3TaskProxyLess
      createTaskPayload.task.type = "ReCaptchaV3TaskProxyLess";
      console.log("CapSolver任务将使用其默认IP池访问目标网站 (ProxyLess)。");
    }
    
    // 发送创建任务请求
    // 注意: axios 需要在 user_scripts 的执行环境中可用
    const response = await axios.post(`${API_URL}/createTask`, createTaskPayload, config);
    const responseData = response.data;
    
    if (responseData.errorId !== 0) {
      console.error(`创建CapSolver任务失败: ${responseData.errorDescription} (Code: ${responseData.errorCode})`);
      return null;
    }
    
    const taskId = responseData.taskId;
    console.log(`CapSolver任务ID: ${taskId}`);
    
    // 获取任务结果的请求体
    const getResultPayload = {
      clientKey: CLIENT_KEY,
      taskId: taskId
    };
    
    console.log("等待获取CapSolver任务结果...");
    
    // 轮询获取结果，最多尝试30次 (总共约60秒)，每次间隔2秒
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 等待2秒
      
      const resultResponse = await axios.post(`${API_URL}/getTaskResult`, getResultPayload, config);
      const resultData = resultResponse.data;
      
      if (resultData.status === "ready") {
        const token = resultData.solution?.gRecaptchaResponse;
        if (token) {
            console.log("成功从CapSolver获取reCAPTCHA token!");
            return token;
        } else {
            console.error("CapSolver任务已准备就绪，但未找到token。 Solution:", resultData.solution);
            return null;
        }
      } else if (resultData.status === "failed" || resultData.errorId !== 0) {
        console.error(`解决验证码失败 (CapSolver): ${resultData.errorDescription || "未知错误"} (Code: ${resultData.errorCode || "N/A"})`);
        return null;
      }
      // "processing" 状态表示仍在处理中
      console.log(`CapSolver任务仍在处理中 (${resultData.status})...`);
    }
    
    // 如果超过最大尝试次数仍未获得结果
    console.error("等待CapSolver验证码结果超时");
    return null;
  } catch (error) {
    if (error.isAxiosError) {
        console.error(`请求CapSolver API出错: ${error.message}`, error.toJSON());
    } else {
        console.error(`处理CapSolver请求时发生未知错误: ${error.message}`, error);
    }
    return null;
  }
}

// 示例: 如果直接运行此文件，执行测试
// 注意：此测试块可能无法在 user_scripts 的典型执行环境中直接运行，
// 特别是如果 \`process\` 或 \`import.meta.url\` 不可用或行为不同。
// 它更适用于标准的Node.js环境进行模块测试。
async function runTest() {
    if (typeof process !== 'undefined' && process.argv && import.meta && import.meta.url && process.argv[1] === import.meta.url.substring(import.meta.url.startsWith('file://') ? 7 : 0)) {
        console.log("测试reCAPTCHA v3求解 (CapSolver)...");

        // 注意：此处需要提供有效的CapSolver API Key
        // 建议从安全的方式获取 API Key，例如环境变量或配置文件，而不是硬编码。
        const apiKey = process.env.CAPSOLVER_API_KEY; // 从环境变量读取API Key for testing

        if (!apiKey) {
            console.error("需要设置 CAPSOLVER_API_KEY 环境变量才能运行测试。");
            // process.exit(1); // 在 user_scripts 中通常不应使用 process.exit
            return;
        }

        // === 测试参数 ===
        // 请替换为有效的测试网站URL和站点密钥
        const testWebsiteURL = "https://your-test-website.com/recaptchav3_page"; 
        const testWebsiteKey = "your_recaptcha_site_key_here"; 
        const testPageAction = "your_page_action"; // 例如: "login", "submit"

        // 可选：测试代理配置 (如果需要)
        const testProxy = null;
        // const testProxy = {
        //   host: "proxy.example.com",
        //   port: "8080",
        //   username: "proxy_user", // 可选
        //   password: "proxy_password", // 可选
        //   url: "http://proxy_user:proxy_password@proxy.example.com:8080" // 确保url正确格式化
        // };
        
        console.log(`测试参数:\\nAPI Key: ${apiKey ? '********' : '未提供'}\\nWebsite URL: ${testWebsiteURL}\\nWebsite Key: ${testWebsiteKey}\\nPage Action: ${testPageAction}`);
        if (testProxy) {
            console.log(`Proxy: ${testProxy.host}:${testProxy.port}`);
        }

        try {
            const token = await solveRecaptchaV3(testProxy, apiKey, testWebsiteURL, testWebsiteKey, testPageAction);
            if (token) {
                console.log("\\n获取的reCAPTCHA v3 token (CapSolver):");
                console.log(token);
            } else {
                console.log("无法从CapSolver获取token。");
            }
        } catch (e) {
            console.error("测试执行期间发生错误:", e);
        }
    }
}

runTest(); // 执行测试（如果适用）

/*
 * 注意事项:
 * 1. 依赖: 此脚本依赖 \`axios\` 和 \`https-proxy-agent\` (如果使用代理)。
 *    请确保这些库在 \`user_scripts\` 的执行环境中可用。
 *    \`axios\` 用于 HTTP 请求。
 *    \`https-proxy-agent\` 用于通过 HTTPS 代理发送请求。
 * 
 * 2. API Key: \`clientKey\` (CapSolver API 密钥) 是必需的。应安全地管理和提供此密钥。
 * 
 * 3. 错误处理: 脚本包含基本的错误处理和日志记录。可以根据需要进行扩展。
 * 
 * 4. CapSolver任务类型: 
 *    - \`ReCaptchaV3EnterpriseTaskProxyLess\`: 如果不通过 CapSolver 的 \`task.proxy\` 字段指定代理，而是让 CapSolver 使用其自己的 IP 池。
 *    - \`ReCaptchaV3EnterpriseTask\` (或 \`ReCaptchaV3Task\`): 如果你通过 \`task.proxy\` 指定了希望 CapSolver 使用的代理来访问目标网站。
 *    脚本中已根据是否存在 \`proxy.host\` 和 \`proxy.port\` 自动调整类型为 \`ReCaptchaV3TaskProxyLess\`。
 * 
 * 5. 网站参数: \`websiteURL\`, \`websiteKey\`, 和可选的 \`pageAction\` 是解决 reCAPTCHA v3 的关键参数，
 *    现在已作为函数参数传入，而不是硬编码。
 *
 * 6. 超时与轮询: 脚本会轮询任务结果，总超时约为60秒。
 */ 