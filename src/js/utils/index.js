/**
 * 防抖函数，用于限制函数触发的频率。
 * @param {function} func - 需要防抖的函数。
 * @param {number} wait - 延迟的毫秒数。
 * @returns {function} - 经过防抖处理的函数。
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func.apply(this, args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 截断钱包地址以便显示。
 * @param {string} address - 完整的钱包地址。
 * @returns {string} - 截断后的地址，如果地址过短或无效则返回原地址。
 */
export function truncateAddress(address) {
    if (!address || typeof address !== 'string' || address.length < 10) return address;
    return address.substring(0, 6) + '...' + address.substring(address.length - 4);
}

// 从脚本插件的日志模块导入
import { addLogEntry } from '../pages/scriptPlugins/detail/logger.js';

// 导出所有工具函数
export {
    addLogEntry
    // ... 其他工具函数
}; 