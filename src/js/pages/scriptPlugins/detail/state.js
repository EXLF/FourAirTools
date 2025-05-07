// 脚本详情页面状态管理模块

// 全局变量，保存当前脚本ID
let currentScriptId = null;

// 全局Set记录所有已选钱包ID
if (!window._selectedWalletIds) window._selectedWalletIds = new Set();

/**
 * 设置当前脚本ID
 * @param {string|number} scriptId - 脚本ID
 */
export function setCurrentScriptId(scriptId) {
    currentScriptId = scriptId;
}

/**
 * 获取当前脚本ID
 * @returns {string|number|null} 当前脚本ID
 */
export function getCurrentScriptId() {
    return currentScriptId;
}

/**
 * 获取已选择的钱包ID集合
 * @returns {Set} 已选择的钱包ID集合
 */
export function getSelectedWalletIds() {
    return window._selectedWalletIds;
}

/**
 * 添加选中的钱包ID
 * @param {string} walletId - 钱包ID
 */
export function addSelectedWalletId(walletId) {
    window._selectedWalletIds.add(walletId);
}

/**
 * 移除选中的钱包ID
 * @param {string} walletId - 钱包ID
 */
export function removeSelectedWalletId(walletId) {
    window._selectedWalletIds.delete(walletId);
}

/**
 * 清空选中的钱包ID
 */
export function clearSelectedWalletIds() {
    window._selectedWalletIds.clear();
} 