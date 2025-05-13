/**
 * HTTP请求工具模块
 * 提供统一的HTTP请求接口，支持代理设置
 */
const axios = require('axios');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

/**
 * 格式化代理配置URL
 * @param {Object} proxy - 代理配置对象
 * @returns {string} 格式化后的代理URL
 */
function formatProxyUrl(proxy) {
  if (!proxy || !proxy.host || !proxy.port) {
    return null;
  }

  const protocol = proxy.type === 'SOCKS5' ? 'socks5://' : 
                   proxy.type === 'HTTPS' ? 'https://' : 'http://';
  
  let auth = '';
  if (proxy.username) {
    auth = proxy.password 
      ? `${encodeURIComponent(proxy.username)}:${encodeURIComponent(proxy.password)}@` 
      : `${encodeURIComponent(proxy.username)}@`;
  }
  
  return `${protocol}${auth}${proxy.host}:${proxy.port}`;
}

/**
 * 根据代理类型创建代理代理
 * @param {Object} proxy - 代理配置对象
 * @returns {Object} 创建的代理代理
 */
function createProxyAgent(proxy) {
  const proxyUrl = formatProxyUrl(proxy);
  if (!proxyUrl) return null;
  
  if (proxy.type === 'SOCKS5') {
    return new SocksProxyAgent(proxyUrl);
  } else if (proxy.type === 'HTTPS') {
    return new HttpsProxyAgent(proxyUrl);
  } else {
    return new HttpProxyAgent(proxyUrl);
  }
}

/**
 * 创建一个带有代理配置的axios实例
 * @param {Object} proxy - 代理配置对象
 * @param {Object} options - 额外的axios配置选项
 * @returns {Object} 配置好的axios实例
 */
function createClient(proxy = null, options = {}) {
  const config = { ...options };
  
  if (proxy) {
    const agent = createProxyAgent(proxy);
    if (agent) {
      config.httpAgent = agent;
      config.httpsAgent = agent;
    }
  }
  
  return axios.create(config);
}

/**
 * 发送GET请求
 * @param {string} url - 请求URL
 * @param {Object} proxy - 代理配置
 * @param {Object} options - 请求选项
 * @returns {Promise} 请求的Promise
 */
async function get(url, proxy = null, options = {}) {
  const client = createClient(proxy, options);
  return await client.get(url);
}

/**
 * 发送POST请求
 * @param {string} url - 请求URL
 * @param {Object} data - 请求数据
 * @param {Object} proxy - 代理配置
 * @param {Object} options - 请求选项
 * @returns {Promise} 请求的Promise
 */
async function post(url, data, proxy = null, options = {}) {
  const client = createClient(proxy, options);
  return await client.post(url, data);
}

/**
 * 发送PUT请求
 * @param {string} url - 请求URL
 * @param {Object} data - 请求数据
 * @param {Object} proxy - 代理配置
 * @param {Object} options - 请求选项
 * @returns {Promise} 请求的Promise
 */
async function put(url, data, proxy = null, options = {}) {
  const client = createClient(proxy, options);
  return await client.put(url, data);
}

/**
 * 发送DELETE请求
 * @param {string} url - 请求URL
 * @param {Object} proxy - 代理配置
 * @param {Object} options - 请求选项
 * @returns {Promise} 请求的Promise
 */
async function del(url, proxy = null, options = {}) {
  const client = createClient(proxy, options);
  return await client.delete(url);
}

module.exports = {
  get,
  post,
  put,
  delete: del,
  createClient,
  formatProxyUrl
}; 