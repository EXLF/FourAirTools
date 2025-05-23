// ================= 导航逻辑 =================

// 缓存常用元素
const contentArea = document.querySelector('.content-area');
const sidebarLinks = document.querySelectorAll('.sidebar nav ul li a');

// 不再需要暂时保留的模板映射 - 此对象已移除
// const templates = {}; 

let currentPage = 'dashboard'; // 跟踪当前页面 ID

/**
 * 为侧边栏导航链接设置事件监听器
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
 * 加载指定页面ID的内容
 * 首先尝试获取HTML片段，如果失败则回退到查找<template>标签
 * @param {string} pageId - 要加载的页面的ID
 */
export async function loadPage(pageId) {
    console.log(`正在加载页面: ${pageId}`);

    // 更新侧边栏活动状态
    updateSidebarActiveState(pageId);

    // 清除当前内容并显示加载指示器
    contentArea.innerHTML = '<p class="loading-indicator">加载中...</p>';

    // let loadedViaFetch = false; // 不再需要此变量
    // 选项1: 首先尝试获取HTML片段
    try {
        const response = await fetch(`src/templates/${pageId}.html`);
        if (response.ok) {
            const html = await response.text();
            contentArea.innerHTML = html;
            contentArea.scrollTop = 0;
            // loadedViaFetch = true; // 不再需要
            console.log(`通过fetch成功加载${pageId}。`);
        } else {
            // 如果fetch失败 (例如 404 或其他错误)
            console.error(`获取模板 "${pageId}.html" 失败，状态码: ${response.status}`);
            contentArea.innerHTML = `<div class="notice error"><h2>页面加载失败</h2><p>无法加载页面 ${pageId} 的内容 (状态: ${response.status})。</p></div>`;
            // 初始化特定页面内容的调用不应在此处进行，因为它依赖于成功加载的HTML
            currentPage = 'error'; // 或其他适当的错误页面标识
            return; // 提前返回，不尝试初始化页面内容
        }
    } catch (error) {
        console.error(`获取模板 "${pageId}.html" 时发生网络错误或解析错误:`, error);
        contentArea.innerHTML = `<div class="notice error"><h2>页面加载出错</h2><p>加载页面 ${pageId} 时发生网络或解析错误。</p></div>`;
        currentPage = 'error';
        return; // 提前返回
    }

    // 选项2: 回退到<template>标签 - 此逻辑已移除，因为它不再使用
    // if (!loadedViaFetch) { ... }

    // 动态调用特定页面的初始化函数 (只有在HTML成功加载后才执行)
    try {
        await initializePageContent(pageId);
    } catch(error) {
         console.error(`初始化页面脚本"${pageId}"时出错:`, error);
         const notice = document.createElement('div');
         notice.className = 'notice error';
         notice.innerHTML = `<p>页面脚本初始化失败: ${error.message}</p>`;
         contentArea.appendChild(notice);
    }

    // 更新当前页面跟踪
    currentPage = pageId;
}

/**
 * 根据当前页面ID更新侧边栏中的活动状态
 * @param {string} pageId - 当前活动页面的ID
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
 * 动态导入并调用已加载页面的初始化函数
 * @param {string} pageId - 刚刚加载的页面的ID
 */
async function initializePageContent(pageId) {
    let initFunctionName;
    let modulePath;

    // 根据页面ID确定对应的模块路径和初始化函数名
    switch (pageId) {
        // 仪表盘页面
        case 'dashboard':
            modulePath = '../pages/dashboard/index.js';
            initFunctionName = 'initDashboardPage';
            break;
        // 钱包管理页面
        case 'wallets':
            modulePath = '../pages/wallets/index.js';
            initFunctionName = 'initWalletsPage';
            break;
        // 项目跟踪页面 (New Entry)
        case 'projects':
            modulePath = '../pages/projects/index.js';
            initFunctionName = 'initProjectsPage';
            break;
        // 社交账户管理页面
        case 'social':
            modulePath = '../pages/social/index.js';
            initFunctionName = 'initSocialPage';
            break;
        // 批量脚本管理页面
        case 'batch-scripts':
            modulePath = '../pages/batchScripts/index.js';
            initFunctionName = 'initBatchScriptsPage';
            break;
        // 网络工具页面
        case 'tool-network':
            modulePath = '../pages/network/index.js';
            initFunctionName = 'initNetworkPage';
            break;
        // 教程页面
        case 'tutorials':
            modulePath = '../pages/tutorials/index.js';
            initFunctionName = 'initTutorialsPage';
            break;
        // 社区页面
        case 'community':
            modulePath = '../pages/community/index.js';
            initFunctionName = 'initCommunityPage';
            break;
        // 设置页面
        case 'settings':
            modulePath = '../pages/settings/index.js';
            initFunctionName = 'initSettingsPage';
            break;
        // 工具页面（现在需要初始化）
        case 'tools':
            modulePath = '../pages/tools/index.js';
            break;
        // 未定义的页面
        default:
            console.error(`Unknown page ID: ${pageId}`);
            return;
    }

    try {
        const pageModule = await import(modulePath);
        if (pageModule && typeof pageModule[initFunctionName] === 'function') {
            console.log(`正在从${modulePath}调用${initFunctionName}`);
            pageModule[initFunctionName](contentArea);
        } else {
            console.warn(`初始化函数"${initFunctionName}"在模块${modulePath}中未找到或不是一个函数`);
        }
    } catch (error) {
        console.error(`加载或执行模块${modulePath}失败:`, error);
        throw error;
    }
}

/**
 * 加载页面并传递数据或上下文
 * @param {string} pageId - 要加载的页面的ID
 * @param {any} context - 可选的上下文/数据
 */
export function loadPageWithContext(pageId, context) {
    loadPage(pageId).then(() => {
        console.log(`为${pageId}提供的上下文:`, context);
    }).catch(error => {
         console.error(`加载带上下文的页面${pageId}时出错:`, error);
    });
} 