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
    updateDashboardDate(contentArea); // 更新日期显示
    loadDashboardStats(contentArea); // 加载核心数据
}

/**
 * 更新仪表板上的当前日期显示。
 * @param {HTMLElement} contentArea
 */
function updateDashboardDate(contentArea) {
    const dateElement = contentArea.querySelector('#current-date');
    if (dateElement) {
        const today = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        dateElement.textContent = today.toLocaleDateString('zh-CN', options);
    } else {
        console.warn('#current-date element not found in dashboard content area.');
    }
}

/**
 * 加载并显示核心数据统计
 * @param {HTMLElement} contentArea
 */
async function loadDashboardStats(contentArea) {
    try {
        // 1. 获取钱包总数
        const walletCount = await getWalletCount();
        updateStatElement(contentArea, 'wallet-count', walletCount);

        // 2. 获取社交账户总数
        const socialCount = await getSocialAccountCount();
        updateStatElement(contentArea, 'social-count', socialCount);

        // 3. 获取教程总数
        const tutorialCount = await getTutorialCount();
        updateStatElement(contentArea, 'tutorial-count', tutorialCount);

        // 4. 默认待办任务为0（可以根据需要实现）
        updateStatElement(contentArea, 'task-count', 0);

    } catch (error) {
        console.error('加载仪表盘数据失败:', error);
        // 显示错误通知或处理异常
    }
}

/**
 * 更新统计元素的值
 * @param {HTMLElement} contentArea - 内容区域
 * @param {string} elementId - 元素ID
 * @param {number|string} value - 要显示的值
 */
function updateStatElement(contentArea, elementId, value) {
    const element = contentArea.querySelector(`#${elementId}`);
    if (element) {
        element.textContent = value;
    }
}

/**
 * 获取钱包总数
 * @returns {Promise<number>} 钱包总数
 */
async function getWalletCount() {
    try {
        // 只查询总数，设置 limit 为 0
        const result = await window.dbAPI.getWallets({ limit: 0 });
        return result.totalCount || 0;
    } catch (error) {
        console.error('获取钱包总数失败:', error);
        return 0;
    }
}

/**
 * 获取社交账户总数
 * @returns {Promise<number>} 社交账户总数
 */
async function getSocialAccountCount() {
    try {
        // 只查询总数，设置 limit 为 0
        const result = await window.dbAPI.getSocialAccounts({ limit: 0 });
        return result.totalCount || 0;
    } catch (error) {
        console.error('获取社交账户总数失败:', error);
        return 0;
    }
}

/**
 * 获取教程总数
 * @returns {Promise<number>} 教程总数
 */
async function getTutorialCount() {
    try {
        // 使用与教程页面相同的API数据源
        const apiUrl = 'http://106.75.5.215:3001/api/tutorials'; 
        console.log('正在从API获取教程数据:', apiUrl);
        
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`HTTP 错误! 状态: ${response.status}`);
        }
        
        const data = await response.json();
        // 从响应中获取教程数组
        const tutorials = data.tutorials || [];
        
        // 计算所有教程
        if (Array.isArray(tutorials)) {
            console.log('教程总数量:', tutorials.length);
            return tutorials.length;
        }
        return 0;
    } catch (error) {
        console.error('获取教程总数失败:', error);
        // 出错时回退到本地数据
        try {
            const tutorials = await window.tutorialAPI.loadTutorials();
            if (tutorials && Array.isArray(tutorials)) {
                console.log('(本地)教程总数量:', tutorials.length);
                return tutorials.length;
            }
        } catch (localError) {
            console.error('获取本地教程数据也失败:', localError);
        }
        return 0;
    }
} 