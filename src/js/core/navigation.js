// ================= 导航逻辑 =================

// 缓存常用元素
const contentArea = document.querySelector('.content-area');
const sidebarLinks = document.querySelectorAll('.sidebar nav ul li a');

// 存储模板映射 (仅适用于尚未移动到单独文件的模板)
const templates = {
    // dashboard: document.getElementById('tpl-dashboard'), // 已移除
    // projects: document.getElementById('tpl-projects'), // 已移除
    // wallets: document.getElementById('tpl-wallets'), // 已移除
    // social: document.getElementById('tpl-social'), // 已移除
    // 'script-plugins': document.getElementById('tpl-script-plugins'), // 已移除
    // 'tool-network': document.getElementById('tpl-network'), // 已移除
    // tutorials: document.getElementById('tpl-tutorials'), // 已移除
    // community: document.getElementById('tpl-community'), // 已移除
    // settings: document.getElementById('tpl-settings'), // 已移除
    // 别名或已弃用的模板
    toolBridge: document.getElementById('tpl-tool-bridge'), // 暂时保留
    toolGas: document.getElementById('tpl-tool-gas'),       // 暂时保留
    // 随着模板移至文件而移除条目
};

let currentPage = 'dashboard'; // 跟踪当前页面 ID

/**
 * 为侧边栏导航链接设置事件监听器。
 */
export function setupSidebarNavigation() {
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const pageId = link.getAttribute('href')?.substring(1);
            if (pageId && !link.parentElement.classList.contains('disabled')) {
                e.preventDefault();
                loadPage(pageId);
            }
        });
    });
}

/**
 * 加载指定页面 ID 的内容。
 * 首先尝试获取 HTML 片段，如果失败则回退到查找 <template> 标签。
 * 清除先前的内容，加载新内容，并调用特定页面的初始化函数。
 * @param {string} pageId - 要加载的页面的 ID。
 */
export async function loadPage(pageId) {
    console.log(`正在加载页面: ${pageId}`);

    // 更新侧边栏活动状态
    updateSidebarActiveState(pageId);

    // 清除当前内容并显示加载指示器
    contentArea.innerHTML = '<p class="loading-indicator">加载中...</p>';

    let loadedViaFetch = false;
    // --- 选项 1: 首先尝试获取 HTML 片段 ---
    try {
        const response = await fetch(`src/templates/${pageId}.html`);
        if (response.ok) {
            const html = await response.text();
            contentArea.innerHTML = html; // 替换加载指示器
            contentArea.scrollTop = 0;
            loadedViaFetch = true;
            console.log(`通过 fetch 成功加载 ${pageId}。`);
        } else {
            // 仅记录非 404 错误，因为 404 意味着我们应该尝试模板方法
            if (response.status !== 404) {
                 console.warn(`获取 ${pageId}.html 失败，状态码: ${response.status}`);
            }
             // 如果 fetch 失败 (例如 404)，则继续进行模板回退
        }
    } catch (error) {
        console.error(`获取模板 "${pageId}.html" 时出错:`, error);
        // 不要立即显示错误，先尝试模板回退
    }

    // --- 选项 2: 回退到 <template> 标签 (适用于尚未迁移的页面) ---
    if (!loadedViaFetch) {
        const template = templates[pageId];
        if (template && template.content) {
            try {
                const templateContent = template.content.cloneNode(true);
                contentArea.innerHTML = ''; // 清除加载指示器或先前的错误
                contentArea.appendChild(templateContent);
                contentArea.scrollTop = 0; // 滚动到顶部
                console.log(`通过 <template> 标签成功加载 ${pageId}。`);
            } catch (error) {
                console.error(`克隆/附加模板 "${pageId}" 时出错:`, error);
                contentArea.innerHTML = `<div class="notice error"><h2>页面加载出错</h2><p>加载模板 ${pageId} 时发生错误。</p></div>`;
                return; // 如果模板失败则停止
            }
        } else {
            // 仅当 fetch *也* 失败（或未尝试）时才显示"未找到"
            console.error(`未找到页面 ID 的内容: ${pageId} (fetch 失败/跳过且未找到模板)`);
            contentArea.innerHTML = `<div class="notice error"><h2>页面不存在</h2><p>无法找到 ID 为 "${pageId}" 的页面内容。</p></div>`;
            return; // 如果未找到内容则停止
        }
    }

    // 动态调用特定页面的初始化函数
    try {
        await initializePageContent(pageId);
    } catch(error) {
         console.error(`初始化页面脚本 "${pageId}" 时出错:`, error);
         // 可选：在内容区域显示错误
         const notice = document.createElement('div');
         notice.className = 'notice error';
         notice.innerHTML = `<p>页面脚本初始化失败: ${error.message}</p>`;
         contentArea.appendChild(notice);
    }

    // 更新当前页面跟踪
    currentPage = pageId;
}

/**
 * 根据当前页面 ID 更新侧边栏中的活动状态。
 * @param {string} pageId - 当前活动页面的 ID。
 */
function updateSidebarActiveState(pageId) {
    sidebarLinks.forEach(link => {
        const linkPageId = link.getAttribute('href')?.substring(1);
        const parentLi = link.parentElement;
        if (parentLi) {
            parentLi.classList.toggle('active', linkPageId === pageId);
        }
    });
}

/**
 * 动态导入并调用已加载页面的初始化函数。
 * @param {string} pageId - 刚刚加载的页面的 ID。
 */
async function initializePageContent(pageId) {
    let initFunctionName;
    let modulePath;

    // 将 pageId 映射到模块路径和函数名称
    // (此映射可以更动态或基于约定)
    switch (pageId) {
        case 'dashboard':
            modulePath = '../pages/dashboard.js';
            initFunctionName = 'initDashboardPage';
            break;
        case 'wallets':
            modulePath = '../pages/wallets.js';
            initFunctionName = 'initWalletsPage';
            break;
        case 'social':
            modulePath = '../pages/social.js';
            initFunctionName = 'initSocialPage';
            break;
        case 'script-plugins':
            modulePath = '../pages/scriptPlugins.js';
            initFunctionName = 'initScriptPluginPage';
            break;
        case 'tool-network':
            modulePath = '../pages/network.js';
            initFunctionName = 'initNetworkPage';
            break;
        case 'tutorials':
            modulePath = '../pages/tutorials.js';
            initFunctionName = 'initTutorialsPage';
            break;
        case 'community':
            modulePath = '../pages/community.js';
            initFunctionName = 'initCommunityPage';
            break;
        case 'settings':
            modulePath = '../pages/settings.js';
            initFunctionName = 'initSettingsPage';
            break;
        case 'tools':
            console.log("正在加载常用工具页面 (静态内容，无特定 JS 初始化)");
            return; // 无需加载模块
        // 处理其他情况，例如 tool-gas, tool-bridge (如果它们有 JS)
        case 'tool-gas':
            console.log("正在初始化 Gas 追踪页面 (占位符 - 尚无专用 JS 模块)");
            return; // 无需加载模块
        case 'tool-bridge':
             console.log("正在初始化跨链桥工具页面 (占位符 - 尚无专用 JS 模块)");
             return; // 无需加载模块
        default:
            console.log(`未为页面定义特定的 JS 模块: ${pageId}`);
            return; // 无需初始化
    }

    try {
        // 动态导入页面模块
        const pageModule = await import(modulePath);
        // 检查初始化函数是否存在于模块中
        if (pageModule && typeof pageModule[initFunctionName] === 'function') {
            console.log(`正在从 ${modulePath} 调用 ${initFunctionName}`);
            // 调用初始化函数，如果需要则传递 contentArea
            pageModule[initFunctionName](contentArea);
            
            // 在页面初始化完成后，初始化自定义下拉框
            if (window.initCustomSelects) {
                window.initCustomSelects();
            }
        } else {
            console.warn(`初始化函数 "${initFunctionName}" 在模块 ${modulePath} 中未找到或不是一个函数`);
        }
    } catch (error) {
        console.error(`加载或执行模块 ${modulePath} 失败:`, error);
        // 重新抛出或适当处理错误
        throw error;
    }
}

/**
 * 加载页面并可能传递数据或上下文的辅助函数。
 * (示例: 在 script-plugins 页面上预选过滤器)
 * @param {string} pageId - 要加载的页面的 ID。
 * @param {any} context - 可选的上下文/数据，在页面加载后传递。
 */
export function loadPageWithContext(pageId, context) {
    loadPage(pageId).then(() => {
        // 这段代码在页面模板加载*之后*以及页面的主初始化函数
        // (initializePageContent -> dynamic import -> initXYZPage) 完成*之后*运行。
        // 如果需要立即使用由 initXYZPage 创建的 DOM 元素，请使用轻微的延迟。
        setTimeout(() => {
            console.log(`为 ${pageId} 提供的上下文:`, context);
            if (pageId === 'script-plugins' && typeof context === 'string') {
                 // 示例：根据上下文（interactionType）预选过滤器
                const functionFilter = contentArea.querySelector('#plugin-function-filter');
                if (functionFilter) {
                    const typeLower = context.toLowerCase();
                    if ([...functionFilter.options].some(opt => opt.value === typeLower)) {
                        functionFilter.value = typeLower;
                        functionFilter.dispatchEvent(new Event('change'));
                        console.log(`已将插件功能过滤器预选为: ${typeLower}`);
                    }
                }
            }
            // 在此处添加其他上下文处理逻辑
        }, 50); // 短暂延迟以确保在动态脚本执行后 DOM 完全就绪
    }).catch(error => {
         console.error(`加载带上下文的页面 ${pageId} 时出错:`, error);
    });
} 