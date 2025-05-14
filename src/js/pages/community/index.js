// 页面加载和webview处理
import { showConfirmDialog } from '../../components/modal.js';

// 平台配置
const PLATFORMS = {
    DISCORD: {
        name: 'discord',
        inviteUrl: 'https://discord.com/invite/cTZCaYefPY',
        joinedKey: 'hasJoinedDiscord',
        channelUrlKey: 'discordChannelUrl',
        webviewId: 'discord-webview',
        webviewContainerId: 'discord-webview-container',
        joinSectionId: 'join-discord-section',
        contentId: 'discord-content',
        joinBtnId: 'join-discord-btn',
        toggleBtnId: 'toggle-discord',
        loadingPrefix: 'discord',
        sessionName: 'persist:discord',
        clearSessionEvent: 'clear-discord-session'
    },
    X: {
        name: 'x',
        inviteUrl: 'https://x.com/xiao_yi24405',
        homeUrl: 'https://x.com/home',
        joinedKey: 'hasFollowedX',
        channelUrlKey: 'xProfileUrl',
        webviewId: 'x-webview',
        webviewContainerId: 'x-webview-container',
        joinSectionId: 'join-x-section',
        contentId: 'x-content',
        joinBtnId: 'follow-x-btn',
        toggleBtnId: 'toggle-x',
        loadingPrefix: 'x',
        sessionName: 'persist:x-twitter',
        clearSessionEvent: 'clear-x-session'
    }
};

// 当前活动平台
let activePlatform = PLATFORMS.DISCORD;

document.addEventListener('DOMContentLoaded', () => {
    console.log('Community page DOM loaded');
    
    // 初始化退出按钮
    initLogoutButton();
    
    // 初始化切换按钮
    initPlatformToggle();
    
    // 初始化Discord功能
    initPlatform(PLATFORMS.DISCORD);
    
    // 初始化X（推特）功能
    initPlatform(PLATFORMS.X);

    // 更新退出按钮状态
    updateLogoutButtonVisibility();
});

// 辅助函数：切换平台UI和状态
function handlePlatformSwitch(platformToActivate, platformToDeactivate) {
    if (activePlatform === platformToActivate) return;

    const activateBtn = document.getElementById(platformToActivate.toggleBtnId);
    const deactivateBtn = document.getElementById(platformToDeactivate.toggleBtnId);
    const activateContent = document.getElementById(platformToActivate.contentId);
    const deactivateContent = document.getElementById(platformToDeactivate.contentId);

    if (!activateBtn || !deactivateBtn || !activateContent || !deactivateContent) {
        console.error('Platform toggle elements not found during switch');
        return;
    }

    // 更新激活平台的按钮状态和内容显示
    activateBtn.classList.add('active');
    // 根据平台特定样式调整，这里假设 Discord 是 primary, X 是 dark
    if (platformToActivate.name === 'discord') {
        activateBtn.classList.remove('btn-outline-primary');
        activateBtn.classList.add('btn-primary');
    } else if (platformToActivate.name === 'x') {
        activateBtn.classList.remove('btn-outline-dark');
        activateBtn.classList.add('btn-dark');
    }
    activateContent.classList.remove('hidden');

    // 更新去激活平台的按钮状态和内容显示
    deactivateBtn.classList.remove('active');
    if (platformToDeactivate.name === 'discord') {
        deactivateBtn.classList.remove('btn-primary');
        deactivateBtn.classList.add('btn-outline-primary');
    } else if (platformToDeactivate.name === 'x') {
        deactivateBtn.classList.remove('btn-dark');
        deactivateBtn.classList.add('btn-outline-dark');
    }
    deactivateContent.classList.add('hidden');

    // 更新当前平台
    activePlatform = platformToActivate;

    // 更新退出按钮状态
    updateLogoutButtonVisibility();
}

// 初始化平台切换
function initPlatformToggle() {
    const discordToggleBtn = document.getElementById(PLATFORMS.DISCORD.toggleBtnId);
    const xToggleBtn = document.getElementById(PLATFORMS.X.toggleBtnId);
    
    if (!discordToggleBtn || !xToggleBtn) {
        console.error('Platform toggle buttons not found');
        return;
    }
    
    discordToggleBtn.addEventListener('click', () => {
        handlePlatformSwitch(PLATFORMS.DISCORD, PLATFORMS.X);
    });
    
    xToggleBtn.addEventListener('click', () => {
        handlePlatformSwitch(PLATFORMS.X, PLATFORMS.DISCORD);
    });
}

// 更新退出按钮可见性
function updateLogoutButtonVisibility() {
    const logoutButton = document.getElementById('logout-btn');
    if (!logoutButton) return;

    // 检查当前平台是否已登录
    const hasJoined = localStorage.getItem(activePlatform.joinedKey) === 'true';
    
    // 根据登录状态显示或隐藏退出按钮
    if (hasJoined) {
        logoutButton.classList.remove('hidden');
    } else {
        logoutButton.classList.add('hidden');
    }
}

// 初始化退出按钮功能
function initLogoutButton() {
    const logoutButton = document.getElementById('logout-btn');
    if (!logoutButton) {
        console.error('Logout button not found');
        return;
    }
    
    logoutButton.addEventListener('click', () => {
        console.log(`Logout ${activePlatform.name} button clicked`);
        
        // 使用自定义确认对话框
        showConfirmDialog(
            `确定要退出当前${activePlatform.name === 'discord' ? 'Discord' : 'X'}账户吗？退出后需要重新登录。`,
            // 确认回调
            () => {
                // 清除localStorage中的状态
                localStorage.removeItem(activePlatform.joinedKey);
                localStorage.removeItem(activePlatform.channelUrlKey);
                
                // 显示加入/关注按钮区域
                const joinSection = document.getElementById(activePlatform.joinSectionId);
                if (joinSection) {
                    joinSection.classList.remove('hidden');
                }
                
                // 隐藏webview容器
                const webviewContainer = document.getElementById(activePlatform.webviewContainerId);
                if (webviewContainer) {
                    webviewContainer.classList.add('hidden');
                }
                
                // 清理webview
                const webview = document.getElementById(activePlatform.webviewId);
                if (webview) {
                    webview.src = 'about:blank';
                    
                    // 通过IPC请求主进程清除session数据
                    if (window.electron && window.electron.ipcRenderer) {
                        window.electron.ipcRenderer.send(activePlatform.clearSessionEvent);
                    } else {
                        console.warn(`IPC renderer not available, ${activePlatform.name} session data may not be cleared`);
                    }
                }
                
                // 初始化加入/关注按钮功能
                initPlatformJoin(activePlatform);

                // 更新退出按钮状态
                updateLogoutButtonVisibility();
            },
            // 取消回调
            () => {
                console.log(`User canceled ${activePlatform.name} logout`);
            }
        );
    });
}

// 初始化平台功能
function initPlatform(platform) {
    console.log(`Initializing ${platform.name} functionality`);
    
    // 检查LocalStorage中是否已经加入/关注过
    const hasJoined = localStorage.getItem(platform.joinedKey);
    // 获取保存的频道/主页URL
    const savedUrl = localStorage.getItem(platform.channelUrlKey);
    const joinSection = document.getElementById(platform.joinSectionId);
    const webviewContainer = document.getElementById(platform.webviewContainerId);
    const webview = document.getElementById(platform.webviewId);
    
    if (!joinSection || !webviewContainer || !webview) {
        console.error(`${platform.name} page elements not found`);
        return;
    }
    
    if (hasJoined === 'true') {
        // 如果已经加入/关注过，直接显示webview，不显示加入/关注按钮
        console.log(`User has previously joined ${platform.name}, showing webview directly`);
        
        // 隐藏加入/关注按钮区域
        joinSection.classList.add('hidden');
        
        // 显示webview容器
        webviewContainer.classList.remove('hidden');
        
        // 显示加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = `${platform.loadingPrefix}-loading`;
        loadingIndicator.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
                <p style="margin-top: 10px; color: #6c757d;">正在加载 ${platform.name === 'discord' ? 'Discord' : 'X'}...</p>
            </div>
        `;
        webviewContainer.appendChild(loadingIndicator);
        
        // 使用已保存的URL或邀请/主页链接
        let targetUrl;
        if (platform.name === 'x') {
            // X平台：如果有保存的URL使用它，否则使用主页URL而非邀请页
            targetUrl = savedUrl || platform.homeUrl;
        } else {
            // Discord平台：如果有保存的URL使用它，否则使用邀请URL
            targetUrl = savedUrl || platform.inviteUrl;
        }
        
        // 加载URL
        if (webview.src === 'about:blank' || !webview.src || webview.src === '') {
            console.log(`Loading ${platform.name} URL in webview:`, targetUrl);
            setTimeout(() => {
                try {
                    webview.src = targetUrl;
                } catch (error) {
                    console.error(`Error setting ${platform.name} webview src:`, error);
                    showWebviewError(`加载${platform.name === 'discord' ? 'Discord' : 'X'}时出错: ${error.message}`, platform);
                }
            }, 100);
        } else {
            console.log(`${platform.name} webview already has src:`, webview.src);
            // 移除加载指示器，因为webview已经有内容
            removeLoadingIndicator(platform);
        }

        // 如果当前平台是活动平台，确保退出按钮可见
        if (platform === activePlatform) {
            updateLogoutButtonVisibility();
        }
    } else {
        // 首次访问，初始化加入/关注按钮功能
        initPlatformJoin(platform);
    }

    // 初始化webview事件监听
    initPlatformWebviewEvents(platform);
}

// 初始化平台加入/关注按钮功能
function initPlatformJoin(platform) {
    const joinButton = document.getElementById(platform.joinBtnId);
    const joinSection = document.getElementById(platform.joinSectionId);
    const webviewContainer = document.getElementById(platform.webviewContainerId);
    const webview = document.getElementById(platform.webviewId);
    
    if (!joinButton) {
        console.error(`${platform.name} join button not found`);
        return;
    }
    
    // 加入/关注按钮点击事件
    joinButton.addEventListener('click', () => {
        console.log(`${platform.name} join/follow button clicked`);
        
        // 将加入/关注状态保存到LocalStorage
        localStorage.setItem(platform.joinedKey, 'true');
        
        // 显示加载指示器
        webviewContainer.classList.remove('hidden');
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = `${platform.loadingPrefix}-loading`;
        loadingIndicator.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
                <p style="margin-top: 10px; color: #6c757d;">正在加载 ${platform.name === 'discord' ? 'Discord' : 'X'}...</p>
            </div>
        `;
        webviewContainer.appendChild(loadingIndicator);
        
        // 隐藏加入/关注按钮区域
        joinSection.classList.add('hidden');
        
        // 设置webview源
        if (webview.src === 'about:blank' || !webview.src || webview.src === '') {
            console.log(`Loading ${platform.name} URL in webview:`, platform.inviteUrl);
            
            // 延迟一小段时间再加载URL，确保DOM已完全准备好
            setTimeout(() => {
                try {
                    webview.src = platform.inviteUrl;
                } catch (error) {
                    console.error(`Error setting ${platform.name} webview src:`, error);
                    showWebviewError(`加载${platform.name === 'discord' ? 'Discord' : 'X'}时出错: ${error.message}`, platform);
                }
            }, 100);
        } else {
            console.log(`${platform.name} webview already has src:`, webview.src);
            // 移除加载指示器，因为webview已经有内容
            removeLoadingIndicator(platform);
        }

        // 如果当前平台是活动平台，更新退出按钮状态
        if (platform === activePlatform) {
            updateLogoutButtonVisibility();
        }
    });
}

// 初始化Webview事件监听
function initPlatformWebviewEvents(platform) {
    const webview = document.getElementById(platform.webviewId);
    if (!webview) return;
    
    // Webview事件监听
    webview.addEventListener('dom-ready', () => {
        console.log(`${platform.name} webview DOM ready`);
        
        // Discord平台：隐藏滚动条但保留滚动功能
        if (platform.name === 'discord') {
            webview.insertCSS(`
                ::-webkit-scrollbar {
                    width: 0 !important;
                    height: 0 !important;
                    display: none !important;
                }
                body {
                    scrollbar-width: none !important;
                    -ms-overflow-style: none !important;
                    overflow: auto !important;
                }
            `);
        }
        
        // X平台特殊处理 - 只隐藏不需要的元素，不设置滚动条样式
        if (platform.name === 'x') {
            webview.insertCSS(`
                /* 隐藏X平台上不需要的元素 */
                .r-1upvrn0.r-l5o3uw {
                    display: none !important;
                }
            `);
        }
    });
    
    webview.addEventListener('did-start-loading', () => {
        console.log(`${platform.name} webview started loading`);
    });
    
    webview.addEventListener('did-stop-loading', () => {
        console.log(`${platform.name} webview finished loading`);
        removeLoadingIndicator(platform);
        
        // 保存当前URL
        const currentUrl = webview.getURL();
        console.log(`Current ${platform.name} URL:`, currentUrl);
        
        if (platform.name === 'discord' && currentUrl && currentUrl.includes('discord.com/channels/')) {
            console.log('Saving Discord channel URL for future use');
            localStorage.setItem(platform.channelUrlKey, currentUrl);
            
            // 对Discord再次确保滚动条被隐藏但保留滚动功能
            setTimeout(() => {
                webview.insertCSS(`
                    ::-webkit-scrollbar {
                        width: 0 !important;
                        height: 0 !important;
                        display: none !important;
                    }
                    body {
                        scrollbar-width: none !important;
                        -ms-overflow-style: none !important;
                        overflow: auto !important;
                    }
                `);
            }, 1000);
        } else if (platform.name === 'x' && currentUrl) {
            // 对于X平台，保存非邀请页的URL，以便下次直接访问主页
            if (!currentUrl.includes(platform.inviteUrl)) {
                console.log('Saving X profile URL for future use');
                // 如果是主页或用户资料页，保存为下次访问的URL
                localStorage.setItem(platform.channelUrlKey, 
                    currentUrl.includes('x.com/home') ? platform.homeUrl : currentUrl);
            }
            
            // X平台不再注入滚动条样式，改用HTML/CSS设置的样式
        }
    });
    
    webview.addEventListener('did-fail-load', (event) => {
        console.error(`${platform.name} webview failed to load:`, event);
        let errorMessage = `无法加载${platform.name === 'discord' ? 'Discord' : 'X'}页面`;
        
        // 错误代码解释
        if (event.errorCode === -3) {
            errorMessage += '：已取消';
        } else if (event.errorCode === -2) {
            errorMessage += '：服务器无响应';
        } else if (event.errorCode === -106) {
            errorMessage += '：Internet连接断开';
        } else {
            errorMessage += `：错误代码 ${event.errorCode}`;
        }
        
        showWebviewError(errorMessage, platform);
    });
    
    webview.addEventListener('console-message', (e) => {
        console.log(`[${platform.name} Webview]`, e.message);
    });
    
    // 监听URL变化
    webview.addEventListener('did-navigate', (event) => {
        console.log(`${platform.name} webview navigated to:`, event.url);
        
        if (platform.name === 'discord' && event.url && event.url.includes('discord.com/channels/')) {
            console.log('Saving Discord channel URL for future use');
            localStorage.setItem(platform.channelUrlKey, event.url);
        } else if (platform.name === 'x' && event.url) {
            // 对于X平台，保存非邀请页的URL，以便下次直接访问主页
            if (!event.url.includes(platform.inviteUrl)) {
                console.log('Saving X profile URL for future use');
                // 如果是主页或用户资料页，保存为下次访问的URL
                localStorage.setItem(platform.channelUrlKey, 
                    event.url.includes('x.com/home') ? platform.homeUrl : event.url);
            }
        }
    });
    
    webview.addEventListener('did-navigate-in-page', (event) => {
        console.log(`${platform.name} webview navigated in page to:`, event.url);
        
        if (platform.name === 'discord' && event.url && event.url.includes('discord.com/channels/')) {
            console.log('Saving Discord channel URL for future use');
            localStorage.setItem(platform.channelUrlKey, event.url);
        } else if (platform.name === 'x' && event.url) {
            // 对于X平台，保存非邀请页的URL，以便下次直接访问主页
            if (!event.url.includes(platform.inviteUrl)) {
                console.log('Saving X profile URL for future use');
                // 如果是主页或用户资料页，保存为下次访问的URL
                localStorage.setItem(platform.channelUrlKey, 
                    event.url.includes('x.com/home') ? platform.homeUrl : event.url);
            }
        }
    });
}

// 移除加载指示器
function removeLoadingIndicator(platform) {
    const loadingIndicator = document.getElementById(`${platform.loadingPrefix}-loading`);
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
}

// 显示webview错误
function showWebviewError(message, platform) {
    removeLoadingIndicator(platform);
    
    const webviewContainer = document.getElementById(platform.webviewContainerId);
    // 获取保存的频道URL或使用邀请链接
    const savedUrl = localStorage.getItem(platform.channelUrlKey);
    const url = savedUrl || platform.inviteUrl;
    
    // 创建错误消息元素
    const errorElement = document.createElement('div');
    errorElement.id = `${platform.loadingPrefix}-error`;
    errorElement.innerHTML = `
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
            <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #dc3545;"></i>
            <p style="margin-top: 15px; color: #dc3545; font-weight: bold;">${message}</p>
            <button id="retry-${platform.name}-btn" class="btn btn-outline-primary mt-3">
                <i class="fas fa-sync-alt"></i> 重试
            </button>
        </div>
    `;
    
    webviewContainer.appendChild(errorElement);
    
    // 添加重试按钮事件
    const retryButton = document.getElementById(`retry-${platform.name}-btn`);
    if (retryButton) {
        retryButton.addEventListener('click', () => {
            errorElement.remove();
            const webview = document.getElementById(platform.webviewId);
            if (webview) {
                webview.src = url;
            }
            
            // 添加新的加载指示器
            const loadingIndicator = document.createElement('div');
            loadingIndicator.id = `${platform.loadingPrefix}-loading`;
            loadingIndicator.innerHTML = `
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
                    <p style="margin-top: 10px; color: #6c757d;">重新加载 ${platform.name === 'discord' ? 'Discord' : 'X'}...</p>
                </div>
            `;
            webviewContainer.appendChild(loadingIndicator);
        });
    }
}

// 导出供navigation.js调用的初始化函数
export function initCommunityPage() {
    console.log('Initializing Community Page...');
    
    // 初始化退出按钮
    initLogoutButton();
    
    // 初始化切换按钮
    initPlatformToggle();
    
    // 初始化Discord功能
    initPlatform(PLATFORMS.DISCORD);
    
    // 初始化X（推特）功能
    initPlatform(PLATFORMS.X);

    // 更新退出按钮状态
    updateLogoutButtonVisibility();
}

// 函数：初始化社区页面功能 -- 移除这个未使用的导出
// export function initCommunityPage() {
//     console.log('Community page initialized via export');
//     // 如果需要显式初始化，可以在这里调用主要函数
//     // 例如: initPlatformToggle(), initPlatform(PLATFORMS.DISCORD) 等
//     // 但目前是通过 DOMContentLoaded 自动初始化的
// } 