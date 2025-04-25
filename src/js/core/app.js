// 核心应用入口点

import { setupSidebarNavigation, loadPage } from './navigation.js';
import { initGlobalEventListeners } from './globalListeners.js';

// 初始加载
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM 完全加载并解析完毕。正在初始化应用...");
    try {
        setupSidebarNavigation();
        initGlobalEventListeners();
        loadPage('dashboard');
    } catch (error) {
        console.error("应用初始化期间出错:", error);
        const contentArea = document.querySelector('.content-area');
        if(contentArea) {
            contentArea.innerHTML = '<div class="notice error"><i class="fa fa-exclamation-triangle"></i> 应用程序初始化失败，请检查控制台获取更多信息或尝试刷新。</div>';
        }
    }
}); 