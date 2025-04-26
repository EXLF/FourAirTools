// Import other modules if needed
// import * as table from './table.js';
// import * as modals from './modals.js';
// import * as actions from './actions.js';

let tutorialsData = []; // 存储从 JSON 加载的教程数据
let currentWebview = null; // 存储当前活动的 webview 元素

/**
 * 初始化教程中心页面。
 * 加载教程数据，渲染列表，并设置事件监听。
 * @param {HTMLElement} contentArea - 教程页面的主容器。
 */
export async function initTutorialsPage(contentArea) {
    console.log("Initializing Tutorials Page...");

    const categoryLinks = contentArea.querySelectorAll('.tutorial-categories a');
    const tutorialListContainer = contentArea.querySelector('#tutorial-list-container');
    const webviewContainer = contentArea.querySelector('#webview-container');
    const closeWebviewBtn = contentArea.querySelector('#close-webview-btn');
    const refreshWebviewBtn = contentArea.querySelector('#refresh-webview-btn');

    if (!tutorialListContainer || !webviewContainer || !closeWebviewBtn || !refreshWebviewBtn) {
        console.error("Tutorials page is missing required elements!");
        contentArea.innerHTML = '<p style="color: red; padding: 20px;">教程页面加载错误。</p>';
        return;
    }

    // --- 加载教程数据 --- 
    try {
        // 使用 preload 暴露的 API
        const data = await window.tutorialAPI.loadTutorials(); 
        if (data && Array.isArray(data)) {
            tutorialsData = data;
            renderTutorialList(tutorialsData, tutorialListContainer); // 初始渲染所有教程
        } else {
            console.error("Loaded tutorials data is invalid or empty.");
            tutorialListContainer.innerHTML = '<p style="color: orange; padding: 20px;">无法加载教程列表。</p>';
        }
    } catch (error) {
        console.error("Error loading tutorials data:", error);
        tutorialListContainer.innerHTML = '<p style="color: red; padding: 20px;">加载教程数据时出错。</p>';
    }

    // --- 事件监听 --- 

    // 1. 分类点击事件
    categoryLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            handleCategoryClick(e, categoryLinks, tutorialListContainer, webviewContainer);
        });
    });

    // 2. 教程项点击事件 (使用事件委托)
    tutorialListContainer.addEventListener('click', (e) => {
        const itemButton = e.target.closest('.tutorial-item a.btn, .tutorial-item h4'); // 点击标题或按钮
        if (itemButton) {
            e.preventDefault();
            const tutorialItem = itemButton.closest('.tutorial-item');
            const url = tutorialItem.dataset.url;
            const title = tutorialItem.dataset.title;
            if (url) {
                 showTutorialInWebview(url, title, webviewContainer, tutorialListContainer, refreshWebviewBtn);
            } else {
                console.warn("教程 URL 为空，无法打开：", title);
                // 可以显示一个提示信息给用户
            }
        }
    });

    // 3. 关闭 WebView 按钮
    closeWebviewBtn.addEventListener('click', () => {
        closeWebview(webviewContainer, tutorialListContainer);
    });

    // 4. 刷新 WebView 按钮 (事件监听在 showTutorialInWebview 中动态添加)

    console.log("Tutorials Page Initialized.");
}

/**
 * 根据提供的教程数据渲染列表。
 * @param {Array} tutorials - 教程对象数组。
 * @param {HTMLElement} container - 列表容器。
 */
function renderTutorialList(tutorials, container) {
    container.innerHTML = ''; // 清空旧内容或加载提示
    if (!tutorials || tutorials.length === 0) {
        container.innerHTML = '<p style="padding: 20px; text-align: center;">暂无教程。</p>';
        return;
    }

    tutorials.forEach(tutorial => {
        const item = document.createElement('div');
        item.className = 'tutorial-item';
        item.dataset.url = tutorial.url; // 存储 URL
        item.dataset.title = tutorial.title; // 存储标题
        item.dataset.category = tutorial.category; // 存储分类，用于筛选

        // 根据 Notion URL 判断是否可点击
        const isClickable = tutorial.url && tutorial.url.startsWith('http');
        const buttonText = isClickable ? "开始学习" : "敬请期待";
        const buttonClass = isClickable ? "btn-primary" : "btn-disabled"; // 可以添加不同样式

        item.innerHTML = `
            <div class="item-icon"><i class="fa ${getIconForCategory(tutorial.category)}"></i></div> 
            <div class="item-details">
                <h4>${tutorial.title}</h4>
                <p>${tutorial.description}</p>
                <div class="item-meta"><span>分类: ${tutorial.category}</span></div>
            </div>
            <a href="#" class="btn ${buttonClass} btn-small" ${!isClickable ? 'aria-disabled="true"' : ''}>${buttonText}</a>
        `;
        container.appendChild(item);
    });
}

/**
 * 处理分类点击。
 */
function handleCategoryClick(event, categoryLinks, listContainer, webviewContainer) {
    const clickedLink = event.target.closest('a');
    if (!clickedLink) return;

    // 更新 active 状态
    categoryLinks.forEach(l => l.closest('li').classList.remove('active'));
    clickedLink.closest('li').classList.add('active');

    const selectedCategory = clickedLink.textContent.trim();
    console.log(`切换到分类: ${selectedCategory}`);

    // 筛选教程
    let filteredTutorials;
    if (selectedCategory === '全部教程' || clickedLink.closest('li').classList.contains('category-all')) { // 假设有一个"全部"分类
        filteredTutorials = tutorialsData;
    } else {
        filteredTutorials = tutorialsData.filter(t => t.category === selectedCategory);
    }
    
    renderTutorialList(filteredTutorials, listContainer);

    // 确保 WebView 是隐藏的
    closeWebview(webviewContainer, listContainer); 
}

/**
 * 显示指定 URL 的教程于 WebView 中。
 */
function showTutorialInWebview(url, title, webviewContainer, listContainer, refreshBtn) {
    console.log(`Opening tutorial in webview: ${title} (${url})`);
    const webviewContentArea = webviewContainer.querySelector('#webview-content');
    const webviewTitleElement = webviewContainer.querySelector('#webview-title');

    if (!webviewContentArea || !webviewTitleElement) {
        console.error("Webview container internal elements not found!");
        return;
    }

    // 尝试使用页面中已有的 webview 元素
    let webview = webviewContainer.querySelector('#test-webview');
    let isExistingWebview = !!webview;
    
    // 如果页面中没有 webview 或者 webview 被标记为删除，则创建新的
    if (!isExistingWebview) {
        console.log("Creating new webview element dynamically");
        
        // 清除可能存在的旧 WebView
        if (currentWebview) {
            currentWebview.remove();
            currentWebview = null;
        }

        // 创建新的 WebView
        webview = document.createElement('webview');
        webview.setAttribute('nodeintegration', 'false'); // 安全设置
        webview.setAttribute('webpreferences', 'contextIsolation=true'); // 安全设置
        webview.setAttribute('allowpopups', ''); // 允许可能需要的弹出窗口
    } else {
        console.log("Using existing webview element in the page");
        // webview.style.display = 'block'; // 不再需要，由 CSS 控制
    }
    
    // 设置/更新 webview 属性
    webview.setAttribute('src', url);
    // webview.setAttribute('style', 'width: 100%; height: 100%; border: none; display: block;'); // 不再需要，由 CSS 控制
    webview.setAttribute('useragent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36');
    
    // 保存引用
    currentWebview = webview;

    // 更新标题
    webviewTitleElement.textContent = `加载中: ${title}`;

    // 添加事件监听
    webview.addEventListener('dom-ready', () => {
        console.log('Webview DOM ready for ' + url);
        
        // --- 尝试注入 CSS ---
        // 更新注入的 CSS，尝试强制内容宽度并移除限制
        const cssToInject = `
            body {
                width: 100% !important;
                min-width: initial !important; /* 覆盖之前的注入 */
                box-sizing: border-box !important;
            }
            /* 尝试针对 Notion 的常用容器类名 */
            .notion-frame, .notion-page-content {
                max-width: none !important; /* 移除最大宽度限制 */
                width: 100% !important;
                padding-left: 10px !important; /* 减少可能的内边距 */
                padding-right: 10px !important;
                box-sizing: border-box !important;
            }
            /* 可能还有其他内部元素需要调整 */
        `;
        webview.insertCSS(cssToInject).then(() => {
            console.log('Injected custom CSS into webview.');
        }).catch(err => {
            console.error('Failed to inject CSS:', err);
        });
        // --- 结束注入 CSS ---

        // 尝试显示 webview 中加载的 HTML (用于调试)
        webview.executeJavaScript(`
            document.documentElement.innerHTML;
        `).then(html => {
            console.log('WebView loaded HTML (first 100 chars):', html.substring(0, 100) + '...');
        }).catch(err => {
            console.error('Failed to get WebView HTML:', err);
        });
        
        // 可以尝试打开开发者工具进行调试
        if (url === 'https://www.baidu.com') {
            console.log('Opening DevTools for test page');
            webview.openDevTools();
        }
    });

    webview.addEventListener('did-start-loading', () => {
        console.log('Webview started loading:', url);
        webviewTitleElement.textContent = `加载中: ${title}`;
        refreshBtn.disabled = true; // 加载时禁用刷新
    });

    webview.addEventListener('did-stop-loading', () => {
        console.log('Webview finished loading:', url);
        webviewTitleElement.textContent = title; // 加载完成显示标题
        refreshBtn.disabled = false; // 加载完成启用刷新
    });

    webview.addEventListener('did-fail-load', (event) => {
        console.error('Webview load failed:', event);
        webviewTitleElement.textContent = `加载失败: ${title}`;
        
        // 记录更详细的错误信息
        const { errorCode, errorDescription, validatedURL } = event;
        console.error(`Load failed for ${validatedURL}. Error ${errorCode}: ${errorDescription}`);
        
        webviewContentArea.innerHTML = `
            <p style="color: red; padding: 20px; text-align: center;">
                无法加载教程页面 (错误 ${errorCode}): ${errorDescription}<br>
                URL: ${validatedURL}<br>
                请检查网络连接或链接是否有效。
            </p>
        `;
        refreshBtn.disabled = false; // 失败也启用刷新
    });
    
    // 如果是新创建的 webview，需要添加到 DOM
    if (!isExistingWebview) {
        webviewContentArea.innerHTML = ''; // 清空可能存在的错误信息
        webviewContentArea.appendChild(webview);
    }

    // 设置刷新按钮功能
    refreshBtn.onclick = () => {
        if (currentWebview && typeof currentWebview.reload === 'function') {
            console.log('Reloading webview...');
            currentWebview.reload();
        } else {
            console.error('Cannot reload: currentWebview reference is invalid or missing reload method.');
            refreshBtn.disabled = true;
        }
    };

    // 切换视图
    listContainer.style.display = 'none';
    webviewContainer.style.display = 'flex'; // 使用 flex 布局
}

/**
 * 关闭 WebView 并返回列表视图。
 */
function closeWebview(webviewContainer, listContainer) {
     if (webviewContainer.style.display !== 'none') {
        webviewContainer.style.display = 'none';
        listContainer.style.display = 'block';
        // 清理 webview 内容并移除元素
        const webviewContentArea = webviewContainer.querySelector('#webview-content');
        if (webviewContentArea) {
            webviewContentArea.innerHTML = ''; // 清空
        }
        if (currentWebview) {
            // 尝试停止加载并移除
            try {
                // stop() 是 webview 标签的有效方法
                currentWebview.stop(); 
            } catch (e) {
                 console.warn("Error calling webview.stop():", e.message);
                 // 即使 stop 出错，也继续尝试移除
            }
            currentWebview.remove(); // 从 DOM 移除
            currentWebview = null; // 清除引用
        }
        console.log("Webview closed.");
    }
}

/**
 * 根据分类返回 Font Awesome 图标类名 (示例)
 */
function getIconForCategory(category) {
    switch (category) {
        case '新手入门': return 'fa-star';
        case '钱包使用': return 'fa-google-wallet'; // 需要确认是否为 fab
        case '安全防范': return 'fa-shield-alt'; // 可能需要 'fa-shield-halved'
        case '工具技巧': return 'fa-cogs';
        case '特定项目教程': return 'fa-rocket';
        case '进阶策略': return 'fa-level-up-alt'; // 可能需要 'fa-arrow-up-right-dots'
        default: return 'fa-file-alt'; // 默认图标 (可能需要 'fa-file-lines')
    }
}

// --- Wrappers and old internal functions are no longer needed and will be removed below --- 