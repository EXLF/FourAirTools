// 核心应用入口点

import { setupSidebarNavigation, loadPage } from './navigation.js';
import { initGlobalEventListeners } from './globalListeners.js';
import { showSetupPasswordModal } from './authSetup.js'; // 导入设置密码函数
import { showUnlockModal } from './authUnlock.js'; // 导入解锁函数
import { initForgotPassword } from '../services/forgotPassword.js'; // 导入忘记密码功能

/**
 * 全局安全基础设施初始化
 */
async function initGlobalSecurity() {
    try {
        console.log('[全局安全] 🔒 开始初始化全局安全基础设施...');
        
        // 动态导入安全管理器
        const { initializeSecurity } = await import('../pages/batchScripts/infrastructure/SecurityManager.js');
        const securityResult = await initializeSecurity();
        
        if (securityResult.success) {
            console.log('[全局安全] 🛡️ 全局安全基础设施初始化成功');
            console.log('[全局安全] ✅ 所有页面现在都受到安全保护');
            
            // 将安全实例挂载到全局，供其他页面使用
            if (typeof window !== 'undefined') {
                window.__FA_GlobalSecurity = securityResult.security;
                console.log('[全局安全] 🌐 安全模块已挂载到全局作用域');
            }
            
            return securityResult;
        } else {
            console.warn('[全局安全] ⚠️ 全局安全基础设施初始化失败:', securityResult.message);
            return null;
        }
    } catch (securityError) {
        console.warn('[全局安全] ❌ 安全模块加载失败:', securityError);
        return null;
    }
}

// 初始加载
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM 完全加载并解析完毕。正在初始化应用...");
    try {
        // 首先初始化全局安全基础设施
        await initGlobalSecurity();
        
        setupSidebarNavigation();
        initGlobalEventListeners();
        initForgotPassword(); // 初始化忘记密码功能

        // --- 监听来自主进程的认证消息 --- 
        if (window.electron && window.electron.ipcRenderer) {
            console.log("Setting up IPC listeners for auth...");

            window.electron.ipcRenderer.on('show-setup-password', () => {
                 console.log('[Renderer] Received show-setup-password message.');
                 showSetupPasswordModal();
            });

            window.electron.ipcRenderer.on('show-unlock-screen', () => {
                console.log('[Renderer] Received show-unlock-screen message.');
                showUnlockModal();
            });

            // 添加对auth:needs-setup消息的处理
            window.electron.ipcRenderer.on('auth:needs-setup', () => {
                console.log('[Renderer] Received auth:needs-setup message.');
                showSetupPasswordModal();
            });

            // 添加对auth:needs-unlock消息的处理
            window.electron.ipcRenderer.on('auth:needs-unlock', () => {
                console.log('[Renderer] Received auth:needs-unlock message.');
                showUnlockModal();
            });

            // Optional: Listen for unlock status changes from main process
             window.electron.ipcRenderer.on('app-unlocked-status', (data) => {
                 // 假设 preload 可能只传递了 args 而没有 event
                 // 或者 event 就是 data 本身
                 // 我们直接检查收到的第一个参数是否包含 unlocked 属性
                 if (data && typeof data.unlocked !== 'undefined') {
                     const unlocked = data.unlocked;
                     console.log(`[Renderer] Received app-unlocked-status: ${unlocked}`);
                     // You might want to update UI elements based on the unlocked status here
                     // For example, enable/disable certain features or show an indicator.
                     if (unlocked) {
                        // Maybe reload the current page or trigger data loading
                        // location.reload(); // Or a less disruptive update
                     }
                 } else {
                      // 如果收到的参数不是预期的格式，打印警告
                      console.warn('[Renderer] Received app-unlocked-status message with unexpected data:', data);
                      // 也可以尝试检查 event 参数（如果 preload 传递了 event）
                      // const event = data; // 如果假设第一个参数是 event
                      // const actualData = arguments[1]; // 获取第二个参数
                      // if (actualData && typeof actualData.unlocked !== 'undefined') { ... }
                 }
             });

        } else {
             console.error("window.electron.ipcRenderer not available! Cannot receive auth messages.");
             // Consider showing a persistent error to the user
        }
        // ------------------------------------

        // Load the initial page (e.g., dashboard)
        // 移动到后面，确保监听器先设置好
        const initialPage = window.location.hash.substring(1) || 'dashboard';
        loadPage(initialPage);

        console.log("App initialized."); // 移到最后

    } catch (error) {
        console.error("应用初始化期间出错:", error);
        const contentArea = document.querySelector('.content-area');
        if(contentArea) {
            contentArea.innerHTML = '<div class="notice error"><i class="fa fa-exclamation-triangle"></i> 应用程序初始化失败，请检查控制台获取更多信息或尝试刷新。</div>';
        }
    }
}); 