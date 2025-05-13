/**
 * 用户脚本公共工具模块
 * 此模块会被主应用程序注入到脚本的 context.api 对象中
 */

/**
 * 等待指定时间
 * @param {number} ms - 等待毫秒数
 * @returns {Promise<void>} Promise
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 格式化日期时间
 * @param {Date} date - 日期对象
 * @param {string} format - 格式字符串
 * @returns {string} 格式化后的字符串
 */
function formatDateTime(date = new Date(), format = 'YYYY-MM-DD HH:mm:ss') {
  const pad = (num, size = 2) => String(num).padStart(size, '0');
  
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  
  return format
    .replace('YYYY', year)
    .replace('MM', pad(month))
    .replace('DD', pad(day))
    .replace('HH', pad(hours))
    .replace('mm', pad(minutes))
    .replace('ss', pad(seconds));
}

/**
 * 创建限速器
 * @param {number} maxCalls - 最大调用次数
 * @param {number} interval - 间隔时间（毫秒）
 * @returns {function} 接受函数作为参数并返回限速版本的函数
 */
function createRateLimiter(maxCalls, interval) {
  const queue = [];
  let currentCalls = 0;
  let timer = null;
  
  const processQueue = () => {
    if (queue.length === 0) {
      timer = null;
      return;
    }
    
    if (currentCalls < maxCalls) {
      const { fn, args, resolve, reject } = queue.shift();
      currentCalls++;
      
      Promise.resolve()
        .then(() => fn(...args))
        .then(resolve)
        .catch(reject)
        .finally(() => {
          setTimeout(() => {
            currentCalls--;
            processQueue();
          }, interval);
        });
      
      processQueue();
    }
    
    if (timer === null) {
      timer = setTimeout(processQueue, interval);
    }
  };
  
  return (fn) => {
    return (...args) => {
      return new Promise((resolve, reject) => {
        queue.push({ fn, args, resolve, reject });
        processQueue();
      });
    };
  };
}

/**
 * 随机睡眠
 * @param {number} minMs - 最小睡眠时间（毫秒）
 * @param {number} maxMs - 最大睡眠时间（毫秒）
 * @returns {Promise<number>} 实际睡眠时间
 */
async function randomSleep(minMs = 1000, maxMs = 5000) {
  const sleepTime = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  await delay(sleepTime);
  return sleepTime;
}

/**
 * 生成随机字符串
 * @param {number} length - 字符串长度
 * @param {string} charset - 字符集
 * @returns {string} 随机字符串
 */
function randomString(length = 10, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
  let result = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }
  return result;
}

/**
 * 简单的重试机制
 * @param {Function} fn - 要重试的函数
 * @param {Object} options - 重试选项
 * @param {number} options.maxAttempts - 最大尝试次数
 * @param {number} options.delay - 重试前延迟（毫秒）
 * @param {Function} options.shouldRetry - 判断是否应该重试的函数
 * @returns {Promise<any>} 函数执行结果
 */
async function retry(fn, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const retryDelay = options.delay || 1000;
  const shouldRetry = options.shouldRetry || (() => true);
  
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      
      // 判断是否应该重试
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }
      
      // 延迟后重试
      await delay(retryDelay);
    }
  }
  
  throw lastError;
}

/**
 * 批处理工具 - 将数组分批处理
 * @param {Array} items - 要处理的数组
 * @param {number} batchSize - 每批大小
 * @param {Function} processFn - 处理函数，接收一批项目和索引
 * @param {number} delayBetweenBatches - 批次间延迟（毫秒）
 * @returns {Promise<Array>} 所有批次处理结果的数组
 */
async function processBatches(items, batchSize, processFn, delayBetweenBatches = 0) {
  const batches = [];
  
  // 分批
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }
  
  const results = [];
  
  // 逐批处理
  for (let i = 0; i < batches.length; i++) {
    const batchResult = await processFn(batches[i], i);
    results.push(batchResult);
    
    // 批次间延迟
    if (i < batches.length - 1 && delayBetweenBatches > 0) {
      await delay(delayBetweenBatches);
    }
  }
  
  return results;
}

/**
 * 移动平均线计算器
 * @param {number} windowSize - 窗口大小
 * @returns {Object} 带有 add 和 getAverage 方法的对象
 */
function createMovingAverage(windowSize = 10) {
  const values = [];
  let sum = 0;
  
  return {
    /**
     * 添加新值
     * @param {number} value - 要添加的值
     * @returns {number} 当前平均值
     */
    add(value) {
      // 添加新值
      values.push(value);
      sum += value;
      
      // 如果超出窗口大小，移除最早的值
      if (values.length > windowSize) {
        sum -= values.shift();
      }
      
      return this.getAverage();
    },
    
    /**
     * 获取当前平均值
     * @returns {number} 当前平均值
     */
    getAverage() {
      return values.length > 0 ? sum / values.length : 0;
    },
    
    /**
     * 获取当前窗口中的所有值
     * @returns {Array<number>} 当前值数组
     */
    getValues() {
      return [...values];
    },
    
    /**
     * 清空数据
     */
    clear() {
      values.length = 0;
      sum = 0;
    }
  };
}

/**
 * 解析URL参数
 * @param {string} url - 要解析的URL
 * @returns {Object} 参数对象
 */
function parseUrlParams(url) {
  try {
    const params = {};
    const urlObj = new URL(url);
    
    for (const [key, value] of urlObj.searchParams) {
      params[key] = value;
    }
    
    return params;
  } catch (error) {
    // 如果输入的不是有效URL，尝试解析查询字符串部分
    try {
      const queryStr = url.includes('?') ? url.split('?')[1] : url;
      return Object.fromEntries(new URLSearchParams(queryStr));
    } catch (e) {
      return {};
    }
  }
}

/**
 * 构建带参数的URL
 * @param {string} baseUrl - 基础URL
 * @param {Object} params - 参数对象
 * @returns {string} 完整URL
 */
function buildUrl(baseUrl, params = {}) {
  const url = new URL(baseUrl);
  
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value);
    }
  }
  
  return url.toString();
}

/**
 * 截断文本
 * @param {string} text - 要截断的文本
 * @param {number} maxLength - 最大长度
 * @param {string} ellipsis - 省略号
 * @returns {string} 截断后的文本
 */
function truncateText(text, maxLength = 100, ellipsis = '...') {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}

// 导出工具函数
module.exports = {
  delay,
  formatDateTime,
  createRateLimiter,
  randomSleep,
  randomString,
  retry,
  processBatches,
  createMovingAverage,
  parseUrlParams,
  buildUrl,
  truncateText
}; 