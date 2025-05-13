/**
 * 使用CapSolver API解决reCAPTCHA v3
 * @param {Object} httpClient - 传入的axios实例
 * @param {Class} ProxyAgentConstructor - 传入的HttpsProxyAgent类 (例如: require('https-proxy-agent').HttpsProxyAgent)
 * @param {Object} proxy - 代理配置对象，格式: { host, port, username, password, url }
 * @param {string} clientKey - CapSolver的API密钥（必填）
 * @param {string} websiteURL - 目标网站的URL (必填)
 * @param {string} websiteKey - 目标网站的reCAPTCHA站点密钥 (必填)
 * @param {string} [pageAction=""] - reCAPTCHA的pageAction (可选)
 * @param {string} [anchor=""] - reCAPTCHA的anchor (可选)
 * @param {string} [reload=""] - reCAPTCHA的reload (可选)
 * @returns {Promise<string|null>} - 返回reCAPTCHA token或null
 */
export async function solveRecaptchaV3(
    httpClient,
    ProxyAgentConstructor,
    proxy = null, 
    clientKey,
    websiteURL, 
    websiteKey, 
    pageAction = "", 
    anchor = "",     
    reload = ""      
) {
  if (!clientKey) {
    throw new Error("CapSolver API Key未提供，请在设置中配置有效的API Key");
  }
  if (!httpClient) {
    throw new Error("httpClient (axios instance) 未提供");
  }
  if (!websiteURL || !websiteKey) {
    throw new Error("websiteURL 和 websiteKey 是必需的参数");
  }
  
  const API_URL = "https://api.capsolver.com";
  const CLIENT_KEY = clientKey;
  
  const requestConfig = {
    timeout: 60000, 
  };
  
  if (proxy && proxy.url && ProxyAgentConstructor) {
    // console.log 此处的信息最好由调用方或注入的全局 console 来处理，以保持此工具函数的纯净
    requestConfig.proxy = false;
    requestConfig.httpsAgent = new ProxyAgentConstructor(proxy.url);
  } else if (proxy && proxy.url && !ProxyAgentConstructor) {
    // 尝试 axios 原生 proxy 对象 (可能不支持所有认证方式或代理类型)
    try {
        const parsedUrl = new URL(proxy.url);
        requestConfig.proxy = {
            protocol: parsedUrl.protocol.replace(':', ''),
            host: parsedUrl.hostname,
            port: parseInt(parsedUrl.port),
        };
        if (parsedUrl.username || parsedUrl.password) {
            requestConfig.proxy.auth = {
                username: parsedUrl.username,
                password: parsedUrl.password,
            };
        }
    } catch (e) {
        // console.warn("解析代理URL为axios proxy对象失败，代理可能不会生效", e);
    }
  }
  
  try {
    const createTaskPayload = {
      clientKey: CLIENT_KEY,
      task: {
        type: "ReCaptchaV3EnterpriseTask", 
        websiteURL: websiteURL,
        websiteKey: websiteKey,
      }
    };
    if (pageAction) createTaskPayload.task.pageAction = pageAction;
    if (anchor) createTaskPayload.task.anchor = anchor;
    if (reload) createTaskPayload.task.reload = reload;
    
    if (proxy && proxy.url) {
      let capsolverProxyString = proxy.url; 
      try {
        const parsed = new URL(proxy.url);
        if (parsed.username || parsed.password) {
            capsolverProxyString = `${parsed.protocol}//${parsed.username}:${parsed.password}@${parsed.hostname}:${parsed.port}`;
        } else {
            capsolverProxyString = `${parsed.protocol}//${parsed.hostname}:${parsed.port}`;
        }
        createTaskPayload.task.proxy = capsolverProxyString;
      } catch (e) {
        // console.warn("解析代理URL为CapSolver task.proxy格式失败", e);
      }
    } 
    
    // 使用传入的 httpClient 进行请求
    const response = await httpClient.post(`${API_URL}/createTask`, createTaskPayload, requestConfig);
    const responseData = response.data;
    
    if (responseData.errorId !== 0) {
      const err = new Error(`CapSolver创建任务失败: ${responseData.errorDescription} (Code: ${responseData.errorCode || 'N/A'})`);
      err.capsolverError = responseData; // 附加原始错误信息
      throw err;
    }
    
    const taskId = responseData.taskId;
    const getResultPayload = {
      clientKey: CLIENT_KEY,
      taskId: taskId
    };
    
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); 
      const resultResponse = await httpClient.post(`${API_URL}/getTaskResult`, getResultPayload, requestConfig);
      const resultData = resultResponse.data;
      
      if (resultData.status === "ready") {
        return resultData.solution?.gRecaptchaResponse;
      } else if (resultData.status === "failed" || resultData.errorId !== 0) {
        const err = new Error(`CapSolver解决验证码失败: ${resultData.errorDescription || "未知错误"} (Code: ${resultData.errorCode || 'N/A'})`);
        err.capsolverError = resultData;
        throw err;
      }
    }
    throw new Error("CapSolver等待验证码结果超时");
  } catch (error) {
    if (error.capsolverError) throw error; // 如果是已封装的错误，直接 re-throw
    const newError = new Error(`CapSolver请求处理出错: ${error.message}`);
    newError.originalError = error; // 保留原始错误信息
    throw newError;
  }
} 