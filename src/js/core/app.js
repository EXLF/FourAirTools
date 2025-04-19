// ================= 核心应用入口点 =================

// 从其他模块导入必要的函数 (路径稍后解析)
// 需要导航设置和初始页面加载函数
import { setupSidebarNavigation, loadPage } from './navigation.js';
// 如果仪表盘日期更新器保持全局性，则可能需要它
import { updateDashboardDate } from '../pages/dashboard.js'; // 假设它移到了仪表盘页面逻辑中
// 全局事件监听器的占位符（如果需要）
import { initGlobalEventListeners } from './globalListeners.js'; // 假设我们创建了这个文件

// ================= 初始加载 =================
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 完全加载并解析完毕。正在初始化应用...");
    try {
        setupSidebarNavigation();
        initGlobalEventListeners(); // 设置非特定页面的监听器
        loadPage('dashboard'); // 加载初始页面
        // updateDashboardDate(); // 这个现在很可能应该在 initDashboardPage 内部调用
    } catch (error) {
        console.error("应用初始化期间出错:", error);
        // 在页面上显示用户友好的错误消息?
        const contentArea = document.querySelector('.content-area');
        if(contentArea) {
            contentArea.innerHTML = '<div class="notice error"><i class="fa fa-exclamation-triangle"></i> 应用程序初始化失败，请检查控制台获取更多信息或尝试刷新。</div>';
        }
    }
});

// globalListeners.js 内容的占位符
// export function initGlobalEventListeners() {
//     console.log("正在初始化全局事件监听器...");
//     // 在此处添加任何真正的全局监听器 (例如, 键盘快捷键, 主题更改)
// } 