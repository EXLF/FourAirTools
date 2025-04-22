// ================= 仪表板页面初始化 =================

// 基础初始化不需要直接导入，假设 loadPageWithContext 处理快捷方式

/**
 * 初始化仪表板页面。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export async function initDashboardPage(contentArea) {
    console.log("初始化仪表盘页面...");
    updateDashboardDate(contentArea); // 保持日期更新

    // 获取用于显示核心数据的元素
    const walletCountElement = contentArea.querySelector('#dashboard-wallet-count');
    const socialCountElement = contentArea.querySelector('#dashboard-social-count');

    // 检查 dbAPI 是否可用
    if (typeof window.dbAPI === 'undefined') {
        console.error("错误: window.dbAPI 未定义! 无法加载核心数据。");
        if (walletCountElement) walletCountElement.textContent = '错误';
        if (socialCountElement) socialCountElement.textContent = '错误';
        return; // 无法继续加载数据
    }

    // 获取钱包总数并更新UI
    if (walletCountElement) {
        try {
            console.log("正在获取钱包总数...");
            const count = await window.dbAPI.countWallets();
            console.log("获取到钱包总数:", count);
            walletCountElement.textContent = count;
        } catch (error) {
            console.error("获取钱包总数失败:", error);
            walletCountElement.textContent = 'N/A'; // 出错时显示 N/A
        }
    } else {
        console.warn('#dashboard-wallet-count 元素未找到。');
    }

    // 获取社交账户总数并更新UI
    if (socialCountElement) {
        try {
            console.log("正在获取社交账户总数...");
            const count = await window.dbAPI.countSocialAccounts();
            console.log("获取到社交账户总数:", count);
            socialCountElement.textContent = count;
        } catch (error) {
            console.error("获取社交账户总数失败:", error);
            socialCountElement.textContent = 'N/A'; // 出错时显示 N/A
        }
    } else {
        console.warn('#dashboard-social-count 元素未找到。');
    }

    // 为仪表板特定元素（如有）添加事件监听器（例如，小部件链接）
    // 示例：contentArea.querySelector('.some-dashboard-button').addEventListener...

    // 注意：快速操作按钮已有指向 loadPageWithContext（在 navigation.js 中）或 loadPage 的 onclick 属性。
}

/**
 * 更新仪表板上的当前日期显示。
 * 现在需要 contentArea 来限定查询范围。
 * @param {HTMLElement} contentArea
 */
export function updateDashboardDate(contentArea) {
    const dateElement = contentArea.querySelector('#current-date');
    if (dateElement) {
        const today = new Date();
        // const options = { year: 'numeric', month: 'long', day: 'numeric' };
        // dateElement.textContent = today.toLocaleDateString('zh-CN', options);
        // 改为 YYYY年M月D日 格式
        const year = today.getFullYear();
        const month = today.getMonth() + 1; // 月份从 0 开始
        const day = today.getDate();
        dateElement.textContent = `${year}年${month}月${day}日`;
    } else {
        console.warn('#current-date element not found in dashboard content area.');
    }
} 