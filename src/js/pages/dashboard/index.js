// Import other modules if needed
// import * as table from './table.js';
// import * as modals from './modals.js';
// import * as actions from './actions.js';

/**
 * 初始化仪表板页面。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initDashboardPage(contentArea) {
    console.log("Initializing Dashboard...");
    updateDashboardDate(contentArea); // 将 contentArea 传递给查找元素
    // 为仪表板特定元素（如有）添加事件监听器（例如，小部件链接）
    // 示例：contentArea.querySelector('.some-dashboard-button').addEventListener...

    // 注意：快速操作按钮已有指向 loadPageWithContext（在 navigation.js 中）或 loadPage 的 onclick 属性。
}

/**
 * 更新仪表板上的当前日期显示。
 * 现在需要 contentArea 来限定查询范围。
 * @param {HTMLElement} contentArea
 */
function updateDashboardDate(contentArea) { // Make this function internal to the module
    const dateElement = contentArea.querySelector('#current-date');
    if (dateElement) {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = today.toLocaleDateString('zh-CN', options);
    } else {
        console.warn('#current-date element not found in dashboard content area.'); // 保留英文警告信息
    }
} 