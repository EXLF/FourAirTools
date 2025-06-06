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
    
    // 先更新日期，这个操作很快
    updateDashboardDate(contentArea);
    
    // 设置默认值，这样用户先看到有内容
    updateStatElement(contentArea, 'wallet-count', '加载中...');
    updateStatElement(contentArea, 'social-count', '加载中...');
    updateStatElement(contentArea, 'tutorial-count', '加载中...');
    updateStatElement(contentArea, 'task-count', '0');
    
    // 使用setTimeout异步加载统计数据，避免阻塞UI
    setTimeout(() => {
        loadDashboardStats(contentArea);
    }, 100);
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
        // 并行获取数据，加快加载速度
        Promise.all([
            getWalletCount(),
            getSocialAccountCount(),
            getTutorialCount()
        ]).then(([walletCount, socialCount, tutorialCount]) => {
            // 更新UI
            updateStatElement(contentArea, 'wallet-count', walletCount);
            updateStatElement(contentArea, 'social-count', socialCount);
            updateStatElement(contentArea, 'tutorial-count', tutorialCount);
            updateStatElement(contentArea, 'task-count', 0);
        }).catch(error => {
            console.error('获取数据失败:', error);
            // 设置默认值
            updateStatElement(contentArea, 'wallet-count', 0);
            updateStatElement(contentArea, 'social-count', 0);
            updateStatElement(contentArea, 'tutorial-count', 0);
        });
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
 * 获取教程总数 - 优化版，添加超时控制
 * @returns {Promise<number>} 教程总数
 */
async function getTutorialCount() {
    // 直接使用远程API，添加超时控制
    try {
        // const IS_DEV = process.env.NODE_ENV === 'development'; // 旧方式
        const IS_DEV = window.electronEnvironment && window.electronEnvironment.isDev;
        const API_HOST = IS_DEV ? 'http://localhost:3001' : 'http://106.75.5.215:3001';
        const apiUrl = `${API_HOST}/api/tutorials`;
        
        // 创建超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3秒超时
        
        const response = await fetch(apiUrl, {
            signal: controller.signal,
            cache: 'default'
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP 错误! 状态: ${response.status}`);
        }
        
        const data = await response.json();
        const tutorials = data.tutorials || [];
        
        if (Array.isArray(tutorials)) {
            console.log('教程总数量:', tutorials.length);
            return tutorials.length;
        }
        return 0;
    } catch (error) {
        console.error('获取教程总数失败:', error);
        return 0;
    }
} 