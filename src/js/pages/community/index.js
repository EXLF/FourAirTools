// 页面加载和webview处理
import { showConfirmDialog } from '../../components/modal.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('Community page DOM loaded');
    
    // 检查LocalStorage中是否已经加入过Discord
    const hasJoinedDiscord = localStorage.getItem('hasJoinedDiscord');
    // 获取保存的Discord频道URL
    const savedDiscordUrl = localStorage.getItem('discordChannelUrl');
    const joinSection = document.getElementById('join-discord-section');
    const webviewContainer = document.getElementById('discord-webview-container');
    const webview = document.getElementById('discord-webview');
    const discordActions = document.getElementById('discord-actions');
    
    if (!joinSection || !webviewContainer || !webview) {
        console.error('Community page elements not found');
        return;
    }
    
    // 初始化退出按钮功能
    initLogoutButton();
    
    // Discord邀请链接
    const discordInviteUrl = 'https://discord.com/invite/cTZCaYefPY';
    
    if (hasJoinedDiscord === 'true') {
        // 如果已经加入过，直接显示Discord webview，不显示加入按钮
        console.log('User has previously joined Discord, showing webview directly');
        
        // 隐藏加入按钮区域
        joinSection.classList.add('hidden');
        
        // 显示webview容器和操作按钮
        webviewContainer.classList.remove('hidden');
        if (discordActions) {
            discordActions.classList.remove('hidden');
        }
        
        // 显示加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'discord-loading';
        loadingIndicator.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
                <p style="margin-top: 10px; color: #6c757d;">正在加载 Discord...</p>
            </div>
        `;
        webviewContainer.appendChild(loadingIndicator);
        
        // 使用已保存的频道URL或邀请链接
        const discordUrl = savedDiscordUrl || discordInviteUrl;
        
        // 加载Discord URL
        if (webview.src === 'about:blank' || !webview.src || webview.src === '') {
            console.log('Loading Discord URL in webview:', discordUrl);
            setTimeout(() => {
                try {
                    webview.src = discordUrl;
                } catch (error) {
                    console.error('Error setting webview src:', error);
                    showWebviewError('加载Discord时出错: ' + error.message);
                }
            }, 100);
        } else {
            console.log('Webview already has src:', webview.src);
            // 移除加载指示器，因为webview已经有内容
            removeLoadingIndicator();
        }
    } else {
        // 首次访问，初始化加入按钮功能
        initJoinButton();
    }

    // 初始化webview事件监听
    initWebviewEvents(webview);
});

// 初始化退出按钮功能
function initLogoutButton() {
    const logoutButton = document.getElementById('logout-discord-btn');
    if (!logoutButton) {
        console.error('Logout button not found');
        return;
    }
    
    logoutButton.addEventListener('click', () => {
        console.log('Logout Discord button clicked');
        
        // 使用自定义确认对话框替代原生confirm
        showConfirmDialog(
            '确定要退出当前Discord账户吗？退出后需要重新登录。',
            // 确认回调
            () => {
                // 清除localStorage中的Discord状态
                localStorage.removeItem('hasJoinedDiscord');
                localStorage.removeItem('discordChannelUrl');
                
                // 显示加入按钮区域
                const joinSection = document.getElementById('join-discord-section');
                if (joinSection) {
                    joinSection.classList.remove('hidden');
                }
                
                // 隐藏webview容器和操作按钮
                const webviewContainer = document.getElementById('discord-webview-container');
                const discordActions = document.getElementById('discord-actions');
                if (webviewContainer) {
                    webviewContainer.classList.add('hidden');
                }
                if (discordActions) {
                    discordActions.classList.add('hidden');
                }
                
                // 清理webview
                const webview = document.getElementById('discord-webview');
                if (webview) {
                    webview.src = 'about:blank';
                    
                    // 通过IPC请求主进程清除session数据
                    // 在渲染进程中不能直接引用Electron API，需要通过preload和IPC
                    if (window.electron && window.electron.ipcRenderer) {
                        window.electron.ipcRenderer.send('clear-discord-session');
                    } else {
                        console.warn('IPC renderer not available, session data may not be cleared');
                    }
                }
                
                // 初始化加入按钮功能
                initJoinButton();
            },
            // 取消回调
            () => {
                console.log('User canceled Discord logout');
            }
        );
    });
}

// 初始化加入按钮功能
function initJoinButton() {
    const joinButton = document.getElementById('join-discord-btn');
    const joinSection = document.getElementById('join-discord-section');
    const webviewContainer = document.getElementById('discord-webview-container');
    const webview = document.getElementById('discord-webview');
    const discordActions = document.getElementById('discord-actions');
    
    if (!joinButton) {
        console.error('Join button not found');
        return;
    }
    
    // Discord邀请链接
    const discordInviteUrl = 'https://discord.com/invite/cTZCaYefPY';
    
    // 加入按钮点击事件
    joinButton.addEventListener('click', () => {
        console.log('Join Discord button clicked');
        
        // 将加入状态保存到LocalStorage
        localStorage.setItem('hasJoinedDiscord', 'true');
        
        // 显示加载指示器
        webviewContainer.classList.remove('hidden');
        // 显示操作按钮
        if (discordActions) {
            discordActions.classList.remove('hidden');
        }
        
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'discord-loading';
        loadingIndicator.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
                <p style="margin-top: 10px; color: #6c757d;">正在加载 Discord...</p>
            </div>
        `;
        webviewContainer.appendChild(loadingIndicator);
        
        // 隐藏加入按钮区域
        joinSection.classList.add('hidden');
        
        // 设置webview源
        if (webview.src === 'about:blank' || !webview.src || webview.src === '') {
            console.log('Loading Discord URL in webview:', discordInviteUrl);
            
            // 延迟一小段时间再加载URL，确保DOM已完全准备好
            setTimeout(() => {
                try {
                    webview.src = discordInviteUrl;
                } catch (error) {
                    console.error('Error setting webview src:', error);
                    showWebviewError('加载Discord时出错: ' + error.message);
                }
            }, 100);
        } else {
            console.log('Webview already has src:', webview.src);
            // 移除加载指示器，因为webview已经有内容
            removeLoadingIndicator();
        }
    });
}

// 初始化Webview事件监听
function initWebviewEvents(webview) {
    if (!webview) return;
    
    // Webview事件监听
    webview.addEventListener('dom-ready', () => {
        console.log('Discord webview DOM ready');
        // 有些情况下，这个事件比did-finish-loading更早触发
        
        // 注入CSS以隐藏Discord中的滚动条但保留滚动功能
        webview.insertCSS(`
            ::-webkit-scrollbar {
                width: 0 !important;
                height: 0 !important;
                display: none !important;
            }
            body, #app-mount, .app-1q1i1E, .container-2lgNY8 {
                scrollbar-width: none !important;
                -ms-overflow-style: none !important;
                overflow: auto !important;
            }
        `);
    });
    
    webview.addEventListener('did-start-loading', () => {
        console.log('Discord webview started loading');
    });
    
    webview.addEventListener('did-stop-loading', () => {
        console.log('Discord webview finished loading');
        removeLoadingIndicator();
        
        // 保存当前URL，如果是频道URL而非邀请链接
        const currentUrl = webview.getURL();
        console.log('Current Discord URL:', currentUrl);
        
        if (currentUrl && currentUrl.includes('discord.com/channels/')) {
            console.log('Saving Discord channel URL for future use');
            localStorage.setItem('discordChannelUrl', currentUrl);
        }
        
        // 再次确保滚动条被隐藏但保留滚动功能
        setTimeout(() => {
            webview.insertCSS(`
                ::-webkit-scrollbar {
                    width: 0 !important;
                    height: 0 !important;
                    display: none !important;
                }
                body, #app-mount, .app-1q1i1E, .container-2lgNY8 {
                    scrollbar-width: none !important;
                    -ms-overflow-style: none !important;
                    overflow: auto !important;
                }
            `);
        }, 1000);
    });
    
    webview.addEventListener('did-fail-load', (event) => {
        console.error('Discord webview failed to load:', event);
        let errorMessage = '无法加载Discord页面';
        
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
        
        showWebviewError(errorMessage);
    });
    
    webview.addEventListener('console-message', (e) => {
        console.log('[Discord Webview]', e.message);
    });
    
    // 监听URL变化
    webview.addEventListener('did-navigate', (event) => {
        console.log('Discord webview navigated to:', event.url);
        if (event.url && event.url.includes('discord.com/channels/')) {
            console.log('Saving Discord channel URL for future use');
            localStorage.setItem('discordChannelUrl', event.url);
        }
    });
    
    webview.addEventListener('did-navigate-in-page', (event) => {
        console.log('Discord webview navigated in page to:', event.url);
        if (event.url && event.url.includes('discord.com/channels/')) {
            console.log('Saving Discord channel URL for future use');
            localStorage.setItem('discordChannelUrl', event.url);
        }
    });
}

// 移除加载指示器
function removeLoadingIndicator() {
    const loadingIndicator = document.getElementById('discord-loading');
    if (loadingIndicator) {
        loadingIndicator.remove();
    }
}

// 显示webview错误
function showWebviewError(message) {
    removeLoadingIndicator();
    
    const webviewContainer = document.getElementById('discord-webview-container');
    // 获取保存的Discord频道URL或使用邀请链接
    const savedDiscordUrl = localStorage.getItem('discordChannelUrl');
    const discordUrl = savedDiscordUrl || 'https://discord.com/invite/cTZCaYefPY';
    
    // 创建错误消息元素
    const errorElement = document.createElement('div');
    errorElement.id = 'discord-error';
    errorElement.innerHTML = `
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
            <i class="fas fa-exclamation-circle" style="font-size: 3rem; color: #dc3545;"></i>
            <p style="margin-top: 15px; color: #dc3545; font-weight: bold;">${message}</p>
            <button id="retry-discord-btn" class="btn btn-outline-primary mt-3">
                <i class="fas fa-sync-alt"></i> 重试
            </button>
        </div>
    `;
    
    webviewContainer.appendChild(errorElement);
    
    // 添加重试按钮事件
    const retryButton = document.getElementById('retry-discord-btn');
    if (retryButton) {
        retryButton.addEventListener('click', () => {
            errorElement.remove();
            const webview = document.getElementById('discord-webview');
            if (webview) {
                webview.src = discordUrl;
            }
            
            // 添加新的加载指示器
            const loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'discord-loading';
            loadingIndicator.innerHTML = `
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
                    <p style="margin-top: 10px; color: #6c757d;">重新加载 Discord...</p>
                </div>
            `;
            webviewContainer.appendChild(loadingIndicator);
        });
    }
}

// 导出供navigation.js调用的初始化函数
export function initCommunityPage() {
    console.log('Initializing Community Page...');
    
    // 检查LocalStorage中是否已经加入过Discord
    const hasJoinedDiscord = localStorage.getItem('hasJoinedDiscord');
    // 获取保存的Discord频道URL
    const savedDiscordUrl = localStorage.getItem('discordChannelUrl');
    const joinSection = document.getElementById('join-discord-section');
    const webviewContainer = document.getElementById('discord-webview-container');
    const webview = document.getElementById('discord-webview');
    const discordActions = document.getElementById('discord-actions');
    
    if (!joinSection || !webviewContainer || !webview) {
        console.error('Community page elements not found');
        return;
    }

    // 初始化退出按钮功能
    initLogoutButton();
    
    // Discord邀请链接
    const discordInviteUrl = 'https://discord.com/invite/cTZCaYefPY';
    
    if (hasJoinedDiscord === 'true') {
        // 如果已经加入过，直接显示Discord webview，不显示加入按钮
        console.log('User has previously joined Discord, showing webview directly');
        
        // 隐藏加入按钮区域
        joinSection.classList.add('hidden');
        
        // 显示webview容器和操作按钮
        webviewContainer.classList.remove('hidden');
        if (discordActions) {
            discordActions.classList.remove('hidden');
        }
        
        // 显示加载指示器
        const loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'discord-loading';
        loadingIndicator.innerHTML = `
            <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center;">
                <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;"></div>
                <p style="margin-top: 10px; color: #6c757d;">正在加载 Discord...</p>
            </div>
        `;
        webviewContainer.appendChild(loadingIndicator);
        
        // 使用已保存的频道URL或邀请链接
        const discordUrl = savedDiscordUrl || discordInviteUrl;
        
        // 加载Discord URL
        if (webview.src === 'about:blank' || !webview.src || webview.src === '') {
            console.log('Loading Discord URL in webview:', discordUrl);
            setTimeout(() => {
                try {
                    webview.src = discordUrl;
                } catch (error) {
                    console.error('Error setting webview src:', error);
                    showWebviewError('加载Discord时出错: ' + error.message);
                }
            }, 100);
        } else {
            console.log('Webview already has src:', webview.src);
            // 移除加载指示器，因为webview已经有内容
            removeLoadingIndicator();
        }
    } else {
        // 首次访问，初始化加入按钮功能
        initJoinButton();
    }

    // 初始化webview事件监听
    initWebviewEvents(webview);
} 