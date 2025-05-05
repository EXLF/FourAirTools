/**
 * 日志工具模块
 * 用于统一处理脚本执行过程中的日志记录
 */

class Logger {
  constructor(options = {}) {
    this.logCallbacks = [];
    this.prefix = options.prefix || '';
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
    const formattedMessage = `[${timestamp}] ${this.prefix}${message}`;
    
    // 控制台输出
    switch (level) {
      case 'success':
        console.log(`✅ ${formattedMessage}`);
        break;
      case 'warning':
        console.warn(`⚠️ ${formattedMessage}`);
        break;
      case 'error':
        console.error(`❌ ${formattedMessage}`);
        break;
      default:
        console.log(`ℹ️ ${formattedMessage}`);
    }

    // 触发回调
    this.logCallbacks.forEach(callback => {
      try {
        callback(level, formattedMessage);
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
  warning(message) {
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