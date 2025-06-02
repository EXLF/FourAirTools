/**
 * 日志工具模块
 * 用于统一处理脚本执行过程中的日志记录
 */

class Logger {
  constructor(options = {}) {
    this.logCallbacks = [];
    this.prefix = options.prefix || '';
    this.sendFunction = options.sendFunction;
  }

  /**
   * 添加日志监听器
   * @param {Function} callback - 日志回调函数，接收 level, message 作为参数
   */
  addListener(callback) {
    if (typeof callback === 'function') {
      this.logCallbacks.push(callback);
    }
  }

  /**
   * 移除日志监听器
   * @param {Function} callback - 要移除的回调函数
   */
  removeListener(callback) {
    const index = this.logCallbacks.indexOf(callback);
    if (index !== -1) {
      this.logCallbacks.splice(index, 1);
    }
  }

  /**
   * 触发日志事件
   * @param {string} level - 日志级别 (info, success, warning, error)
   * @param {string} message - 日志消息
   */
  _log(level, message) {
    const timestamp = new Date().toLocaleTimeString();
    const originalFormattedMessage = `[${timestamp}] ${this.prefix}${message}`;
    let messageWithIcon = originalFormattedMessage;

    // 根据级别添加图标，用于后续的 sendFunction 或 console 输出
    switch (level) {
      case 'success':
        messageWithIcon = `✅ ${originalFormattedMessage}`;
        break;
      case 'warning':
        messageWithIcon = `⚠️ ${originalFormattedMessage}`;
        break;
      case 'error':
        messageWithIcon = `❌ ${originalFormattedMessage}`;
        break;
      default: // info
        messageWithIcon = `ℹ️ ${originalFormattedMessage}`;
        break;
    }

    if (typeof this.sendFunction === 'function') {
      // 如果提供了 sendFunction，则使用它发送带图标的日志
      try {
        this.sendFunction(level, messageWithIcon);
      } catch (e) {
        // 如果 sendFunction 本身出错，回退到全局 console 打印错误和原始日志
        console.error('Logger sendFunction 执行错误:', e);
        console.log(`[FALLBACK LOG][${level}] ${messageWithIcon}`);
      }
    } else {
      // 否则，回退到原来的控制台输出逻辑 (这里已经包含了图标)
      switch (level) {
        case 'success':
          console.log(messageWithIcon);
          break;
        case 'warning':
          console.warn(messageWithIcon);
          break;
        case 'error':
          console.error(messageWithIcon);
          break;
        default:
          console.log(messageWithIcon);
      }
    }

    // 触发回调 (传递原始格式化消息，不带图标，回调方可自行处理)
    this.logCallbacks.forEach(callback => {
      try {
        callback(level, originalFormattedMessage);
      } catch (error) {
        console.error('日志回调函数执行错误:', error);
      }
    });
  }

  /**
   * 记录信息级日志
   * @param {string} message - 日志消息
   */
  info(message) {
    this._log('info', message);
  }

  /**
   * 记录成功级日志
   * @param {string} message - 日志消息
   */
  success(message) {
    this._log('success', message);
  }

  /**
   * 记录警告级日志
   * @param {string} message - 日志消息
   */
  warn(message) {
    this._log('warning', message);
  }

  /**
   * 记录错误级日志
   * @param {string} message - 日志消息
   */
  error(message) {
    this._log('error', message);
  }
}

/**
 * 创建新的日志记录器实例
 * @param {Object} options - 日志配置选项
 * @returns {Logger} 日志记录器实例
 */
function createLogger(options = {}) {
  return new Logger(options);
}

// 导出默认日志记录器和创建函数
module.exports = {
  defaultLogger: new Logger(),
  createLogger
}; 