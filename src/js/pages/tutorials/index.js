// const { ipcRenderer } = require('electron'); // 移除此行

let tutorialsData = []; // 存储从服务器获取的教程数据
let currentWebview = null; // 存储当前活动的 webview 元素
let currentCategory = 'all'; // 当前选中的分类

// 新增：分页状态变量
let currentPage = 1;
let totalPages = 1;
let itemsPerPage = 5; // 修改为每页5条

// 添加当前搜索词变量
let currentSearchTerm = '';

// 新增：防重复初始化标志
let isInitialized = false;

// 新增：重置初始化状态函数
export function resetTutorialsPage() {
    console.log("重置教程页面初始化状态");
    isInitialized = false;
    
    // 重置全局变量
    currentWebview = null;
    currentCategory = 'all';
    currentPage = 1;
    totalPages = 1;
    currentSearchTerm = '';
    
    // 清空缓存
    tutorialsCache.clear('all');
}

// 缓存系统
const tutorialsCache = {
    data: {}, // 按照"分类-页码-搜索词"形式存储
    timestamp: {}, // 记录每个缓存的时间戳
    ttl: 5 * 60 * 1000, // 缓存有效期: 5分钟
    
    // 生成缓存键
    getKey(category, page, searchTerm = '') {
        return `${category}-${page}-${searchTerm}`;
    },
    
    // 获取缓存
    get(category, page, searchTerm = '') {
        const key = this.getKey(category, page, searchTerm);
        const cacheEntry = this.data[key];
        
        // 检查缓存是否存在且未过期
        if (cacheEntry && (Date.now() - this.timestamp[key] < this.ttl)) {
            console.log(`使用缓存数据: ${key}`);
            return cacheEntry;
        }
        
        return null;
    },
    
    // 设置缓存
    set(category, page, searchTerm = '', data) {
        const key = this.getKey(category, page, searchTerm);
        this.data[key] = data;
        this.timestamp[key] = Date.now();
        console.log(`缓存数据: ${key}`);
    },
    
    // 清除特定分类的缓存
    clear(category) {
        const keysToDelete = [];
        for (const key in this.data) {
            if (category === 'all' || key.startsWith(`${category}-`)) {
                keysToDelete.push(key);
            }
        }
        
        keysToDelete.forEach(key => {
            delete this.data[key];
            delete this.timestamp[key];
        });
        
        console.log(`清除缓存: ${category === 'all' ? '所有' : category} (${keysToDelete.length}个条目)`);
    }
};

// 根据环境确定 API 地址
// const IS_DEV = process.env.NODE_ENV === 'development'; // 旧方式，将被替换
const IS_DEV = window.electronEnvironment && window.electronEnvironment.isDev;
const API_HOST = IS_DEV ? 'http://localhost:3001' : 'http://106.75.5.215:3001';
const apiUrl = `${API_HOST}/api/tutorials`; // 服务器API地址，这是我们将使用的

// 从服务器获取教程数据的函数
async function fetchTutorialsFromServer(page = 1, limit = itemsPerPage, category = currentCategory, searchTerm = '', fetchAll = false) {
    // const apiUrl = 'http://106.75.5.215:3001/api/tutorials'; // 服务器API地址 -->> 移除这一行，使用外部定义的 apiUrl
    
    // 构建查询参数
    const params = new URLSearchParams();
    params.append('page', page);
    
    // 如果fetchAll为true，使用较大的limit值
    if (fetchAll) {
        params.append('limit', 1000); // 获取所有数据
    } else {
        params.append('limit', limit);
    }
    
    // 添加分类筛选参数
    if (category && category !== 'all') {
        params.append('category', category);
    }
    
    // 添加搜索参数
    if (searchTerm) {
        params.append('search', searchTerm);
    }
    
    // 使用外部 apiUrl
    const fullApiUrl = `${apiUrl}?${params.toString()}`;
    console.log(`获取教程数据: ${fullApiUrl} (fetchAll: ${fetchAll}, 当前分类: ${currentCategory}, IS_DEV: ${IS_DEV})`);
    
    try {
        let response;
        let data;
        
        // 🔒 尝试使用全局安全HTTP客户端（如果可用）
        if (typeof window !== 'undefined' && window.__FA_GlobalSecurity) {
            const secureHttpClient = window.__FA_GlobalSecurity.getSecureHttpClient();
            if (secureHttpClient) {
                console.log('[教程页面] 🛡️ 使用安全HTTP客户端获取数据');
                try {
                    const secureResponse = await secureHttpClient.get(fullApiUrl);
                    console.log('[教程页面] ✅ 安全请求完成');
                    // SecureHttpClient返回的是包含data属性的响应对象
                    if (secureResponse && secureResponse.data) {
                        // 如果响应数据是字符串，需要解析为JSON
                        if (typeof secureResponse.data === 'string') {
                            data = JSON.parse(secureResponse.data);
                        } else {
                            data = secureResponse.data;
                        }
                    } else {
                        data = null;
                    }
                } catch (secureError) {
                    console.warn('[教程页面] 安全HTTP客户端失败，回退到标准fetch:', secureError.message);
                    // 回退到标准fetch
                    data = null;
                }
            }
        }
        
        // 如果安全客户端不可用或失败，使用标准fetch
        if (!data) {
            console.log('[教程页面] 使用标准fetch获取数据');
            // 添加超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            response = await fetch(fullApiUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                // 尝试解析错误信息
                let errorMsg = `HTTP error! status: ${response.status}`;
                try {
                     const errorData = await response.json();
                     errorMsg = errorData.error || errorMsg;
                } catch (e) { /* 忽略解析错误 */ }
                throw new Error(errorMsg);
            }
            
            data = await response.json();
        }
        
        if (!Array.isArray(data.tutorials)) {
            console.error("获取的教程数据不是数组格式:", data.tutorials);
            return { tutorials: [], totalPages: 0, currentPage: 1 };
        }
        
        console.log(`成功获取 ${data.tutorials.length} 个教程, 总页数: ${data.totalPages || 1}`);
        return { 
            tutorials: data.tutorials, 
            totalPages: data.totalPages || 1, 
            currentPage: data.currentPage || 1,
            totalItems: data.totalItems || 0
        };
    } catch (error) {
        console.error("无法从服务器获取教程:", error);
        // 返回空数组和默认分页信息
        return { tutorials: [], totalPages: 0, currentPage: 1, totalItems: 0 }; 
    }
}

// 显示加载状态
function showLoadingState(container) {
    container.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>正在加载教程列表...</p>
        </div>
    `;
}

// 显示空状态
function showEmptyState(container, message) {
    container.innerHTML = `
        <div class="empty-state">
            <div style="margin-bottom: 15px; color: #999; font-size: 48px;">📚</div>
            <p>${message}</p>
        </div>
    `;
}

// 显示错误状态
function showErrorState(container, message) {
    container.innerHTML = `
        <div class="error-state">
            <div style="margin-bottom: 15px; color: #e74c3c; font-size: 48px;">⚠️</div>
            <p>${message}</p>
            <button id="retry-btn" class="retry-button" style="background: #007bff; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 15px;">重试</button>
        </div>
    `;
    
    const retryBtn = container.querySelector('#retry-btn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            loadPage(document.querySelector('.content-area'), container, currentPage);
        });
    }
}

// 检查是否离线
function isOffline() {
    return !navigator.onLine;
}

// 显示离线提示
function showOfflineWarning(contentArea) {
    // 如果已经存在提示，不重复显示
    if (contentArea.querySelector('.offline-warning')) return;
    
    const warningDiv = document.createElement('div');
    warningDiv.className = 'offline-warning';
    warningDiv.style.cssText = 'background-color: #f8d7da; color: #721c24; padding: 10px; margin-bottom: 15px; border-radius: 4px; text-align: center;';
    warningDiv.innerHTML = '您当前处于离线状态，显示的是缓存数据';
    
    // 插入到内容区顶部
    contentArea.insertBefore(warningDiv, contentArea.firstChild);
    
    // 5秒后自动隐藏
    setTimeout(() => {
        if (warningDiv.parentNode) {
            warningDiv.parentNode.removeChild(warningDiv);
        }
    }, 5000);
}

/**
 * 添加教程中心相关样式
 */
function addTutorialStyles() {
    // 检查样式是否已存在
    const styleId = 'tutorial-center-styles';
    if (document.getElementById(styleId)) return;
    
    // 创建样式标签
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
        /* 加载状态样式 */
        .loading-state, .empty-state, .error-state {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }
        
        .spinner {
            display: inline-block;
            width: 40px;
            height: 40px;
            border: 3px solid rgba(0, 123, 255, 0.2);
            border-radius: 50%;
            border-top-color: #007bff;
            animation: spin 1s linear infinite;
            margin-bottom: 15px;
        }
        
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        
        .empty-state, .error-state {
            font-size: 1.1rem;
        }
        
        .retry-button {
            background: #007bff;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 15px;
            font-size: 14px;
        }
        
        .retry-button:hover {
            background: #0069d9;
        }
        
        .offline-warning {
            background-color: #f8d7da;
            color: #721c24;
            padding: 12px;
            margin-bottom: 15px;
            border-radius: 4px;
            text-align: center;
            animation: fadeIn 0.3s ease;
        }
        
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    
    // 添加到文档头部
    document.head.appendChild(style);
}

/**
 * 初始化教程中心页面。
 * 加载教程数据，渲染列表，并设置事件监听。
 * @param {HTMLElement} contentArea - 教程页面的主容器。
 */
export async function initTutorialsPage(contentArea) {
    console.log("Initializing Tutorials Page...");
    
    // 防重复初始化检查
    if (isInitialized) {
        console.log("教程页面已经初始化过了，跳过重复初始化");
        return;
    }

    // 添加CSS样式
    addTutorialStyles();

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

    // --- 显示加载提示 ---
    showLoadingState(tutorialListContainer);

    // --- 初始化页码和分类 ---
    currentPage = 1;
    currentCategory = 'all'; // 默认显示所有教程
    currentSearchTerm = ''; // 默认无搜索词
    
    // --- 初始加载第一页数据 ---
    loadPage(contentArea, tutorialListContainer, currentPage);

    // --- 事件监听 --- 

    // 1. 分类点击事件 - 先清除旧的监听器
    categoryLinks.forEach(link => {
        // 移除可能存在的旧监听器
        link.removeEventListener('click', link._tutorialClickHandler);
        // 创建新的处理函数并保存引用
        link._tutorialClickHandler = (e) => {
            e.preventDefault();
            handleCategoryClick(e, categoryLinks, tutorialListContainer, webviewContainer, contentArea);
        };
        link.addEventListener('click', link._tutorialClickHandler);
    });

    // 2. 教程项点击事件 (使用事件委托) - 先移除旧监听器
    if (tutorialListContainer._tutorialItemClickHandler) {
        tutorialListContainer.removeEventListener('click', tutorialListContainer._tutorialItemClickHandler);
    }
    tutorialListContainer._tutorialItemClickHandler = (e) => {
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
    };
    tutorialListContainer.addEventListener('click', tutorialListContainer._tutorialItemClickHandler);

    // 3. 关闭 WebView 按钮 - 先移除旧监听器
    if (closeWebviewBtn._closeHandler) {
        closeWebviewBtn.removeEventListener('click', closeWebviewBtn._closeHandler);
    }
    closeWebviewBtn._closeHandler = () => {
        closeWebview(webviewContainer, tutorialListContainer, contentArea);
    };
    closeWebviewBtn.addEventListener('click', closeWebviewBtn._closeHandler);

    // 4. 刷新 WebView 按钮 (事件监听在 showTutorialInWebview 中动态添加)

    // 设置初始化标志
    isInitialized = true;
    
    console.log("Tutorials Page Initialized.");
}

/**
 * 渲染分页控件。
 * @param {HTMLElement} contentArea - 教程页面的主容器。
 * @param {HTMLElement} listContainer - 教程列表容器。
 * @param {number} totalPages - 总页数。
 * @param {number} currentPage - 当前页码。
 */
function renderPagination(contentArea, listContainer, totalPages, currentPage) {
    // 添加分页样式
    const styleId = 'pagination-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            .pagination-container {
                margin: 20px 0;
                text-align: center;
            }
            .pagination {
                display: flex;
                justify-content: center;
                align-items: center;
                gap: 5px;
                margin-bottom: 10px;
            }
            .pagination-btn {
                padding: 5px 10px;
                border: 1px solid #ddd;
                background: #f8f9fa;
                cursor: pointer;
                border-radius: 4px;
                min-width: 35px;
            }
            .pagination-btn:hover:not([disabled]) {
                background: #e9ecef;
            }
            .pagination-btn.active {
                background: #007bff;
                color: white;
                border-color: #007bff;
            }
            .pagination-btn[disabled] {
                opacity: 0.5;
                cursor: not-allowed;
            }
            .pagination-ellipsis {
                margin: 0 5px;
            }
            .pagination-info {
                color: #666;
                font-size: 0.9em;
            }
        `;
        document.head.appendChild(style);
    }

    // 查找已有的分页容器或创建新的
    let paginationContainer = contentArea.querySelector('.pagination-container');
    if (!paginationContainer) {
        paginationContainer = document.createElement('div');
        paginationContainer.className = 'pagination-container';
        // 将分页容器插入到列表容器之后
        listContainer.parentNode.insertBefore(paginationContainer, listContainer.nextSibling);
    }

    // 如果只有一页，不显示分页控件
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }

    let paginationHTML = '<div class="pagination">';
    
    // 上一页按钮
    paginationHTML += `<button class="pagination-btn prev-btn" ${currentPage <= 1 ? 'disabled' : ''}>上一页</button>`;
    
    // 页码按钮 (最多显示5个页码)
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);
    
    // 第一页按钮
    if (startPage > 1) {
        paginationHTML += `<button class="pagination-btn page-btn" data-page="1">1</button>`;
        if (startPage > 2) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
    }
    
    // 中间页码按钮
    for (let i = startPage; i <= endPage; i++) {
        paginationHTML += `<button class="pagination-btn page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    // 最后页按钮
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            paginationHTML += `<span class="pagination-ellipsis">...</span>`;
        }
        paginationHTML += `<button class="pagination-btn page-btn" data-page="${totalPages}">${totalPages}</button>`;
    }
    
    // 下一页按钮
    paginationHTML += `<button class="pagination-btn next-btn" ${currentPage >= totalPages ? 'disabled' : ''}>下一页</button>`;
    
    paginationHTML += '</div>';
    
    // 添加页码信息
    paginationHTML += `<div class="pagination-info">第 ${currentPage} 页，共 ${totalPages} 页</div>`;
    
    paginationContainer.innerHTML = paginationHTML;
    paginationContainer.style.display = 'block';
    
    // 添加分页事件监听
    const prevBtn = paginationContainer.querySelector('.prev-btn');
    const nextBtn = paginationContainer.querySelector('.next-btn');
    const pageButtons = paginationContainer.querySelectorAll('.page-btn');
    
    if (prevBtn) {
        prevBtn.addEventListener('click', async () => {
            if (currentPage > 1) {
                await loadPage(contentArea, listContainer, currentPage - 1);
            }
        });
    }
    
    if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
            if (currentPage < totalPages) {
                await loadPage(contentArea, listContainer, currentPage + 1);
            }
        });
    }
    
    pageButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const page = parseInt(btn.dataset.page, 10);
            if (page !== currentPage) {
                await loadPage(contentArea, listContainer, page);
            }
        });
    });
}

/**
 * 加载特定页码的数据
 * @param {HTMLElement} contentArea - 教程页面的主容器。
 * @param {HTMLElement} listContainer - 教程列表容器。
 * @param {number} page - 要加载的页码。
 */
async function loadPage(contentArea, listContainer, page) {
    console.log(`开始加载页面: 页码=${page}, 当前分类=${currentCategory}, 搜索词=${currentSearchTerm}`);
    
    // 显示加载状态
    showLoadingState(listContainer);
    
    try {
        // 检查离线状态
        if (isOffline()) {
            showOfflineWarning(contentArea);
        }
        
        // 更新当前页码
        currentPage = page;
        
        // 尝试从缓存获取数据
        const cachedData = tutorialsCache.get(currentCategory, page, currentSearchTerm);
        
        // 用于保存数据的变量
        let result;
        
        if (cachedData) {
            // 使用缓存数据
            result = cachedData;
            console.log(`使用缓存数据: 分类=${currentCategory}, 页码=${page}, 总页数=${result.totalPages}`);
        } else {
            // 从服务器获取数据
            result = await fetchTutorialsFromServer(page, itemsPerPage, currentCategory, currentSearchTerm);
            
            // 缓存获取的数据
            if (result.tutorials.length > 0) {
                tutorialsCache.set(currentCategory, page, currentSearchTerm, result);
            }
        }
        
        // 更新全局变量
        tutorialsData = result.tutorials;
        totalPages = result.totalPages;
        
        // 渲染教程列表
        if (result.tutorials.length > 0) {
            renderTutorialList(result.tutorials, listContainer);
        } else {
            let emptyMessage = '暂无教程数据';
            if (currentCategory !== 'all') {
                emptyMessage = `"${currentCategory}"分类暂无教程`;
            } else if (currentSearchTerm) {
                emptyMessage = `没有找到与"${currentSearchTerm}"匹配的教程`;
            }
            showEmptyState(listContainer, emptyMessage);
        }
        
        // 更新分页控件
        renderPagination(contentArea, listContainer, result.totalPages, currentPage);
        
    } catch (error) {
        console.error('加载页面失败:', error);
        showErrorState(listContainer, '加载数据失败，请稍后重试');
    }
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

    const defaultImageUrl = 'https://www.rootdata.com/default7.png'; // 示例图片 URL

    tutorials.forEach(tutorial => {
        const item = document.createElement('div');
        item.className = 'tutorial-item';
        item.dataset.url = tutorial.url; // 存储 URL
        item.dataset.title = tutorial.title; // 存储标题
        item.dataset.category = tutorial.category; // 存储分类，用于筛选
        
        // 为item添加flex布局样式
        // 设置教程项为弹性布局，使内容水平排列
        item.style.display = 'flex';
        // 垂直居中对齐所有子元素
        item.style.alignItems = 'center';
        // 设置内边距，使内容与边框有一定间距
        item.style.padding = '10px';
        // 添加浅灰色边框，增加视觉分隔
        item.style.border = '1px solid #eee';
        // 设置圆角边框，使外观更现代
        item.style.borderRadius = '8px';
        // 设置底部外边距，使每个教程项之间有间隔
        item.style.marginBottom = '15px';
        // 设置白色背景，确保内容清晰可见
        item.style.backgroundColor = '#fff';

        // 根据 Notion URL 判断是否可点击
        const isClickable = tutorial.url && tutorial.url.startsWith('http');
        const buttonText = isClickable ? "查看教程" : "敬请期待";
        const buttonClass = isClickable ? "btn-primary" : "btn-disabled"; // 可以添加不同样式

        // 新增: 添加图片元素
        // 如果教程数据中有 imageUrl 字段，优先使用，否则使用默认图片
        const imageUrl = tutorial.imageUrl || defaultImageUrl; 
        
        item.innerHTML = `
            <img src="${imageUrl}" alt="${tutorial.title}" class="tutorial-item-image" style="width: 100px; height: 100px; object-fit: cover; border-radius: 4px; margin-right: 15px; flex-shrink: 0;">
            <div class="item-details" style="flex: 1; max-width: 85%; min-width: 0;">
                <h4 style="margin-top: 0; margin-bottom: 5px;">${tutorial.title}</h4>
                <p style="display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; margin-bottom: 5px; color: #666;">${tutorial.description}</p>
                <div class="item-meta"><span style="font-size: 0.9em; color: #888;">分类: ${tutorial.category}</span></div>
            </div>
            <a href="#" class="btn ${buttonClass} btn-small" style="margin-left: auto; flex-shrink: 0; padding: 7px 18px; background-color: #6c5ce7; color: white; text-decoration: none; border-radius: 4px;" ${!isClickable ? 'aria-disabled="true"' : ''}>${buttonText}</a>
        `;
        container.appendChild(item);
    });
}

/**
 * 处理分类点击。
 */
function handleCategoryClick(event, categoryLinks, listContainer, webviewContainer, contentArea) {
    const clickedLink = event.target.closest('a');
    if (!clickedLink) return;

    // 更新UI状态
    categoryLinks.forEach(l => l.closest('li').classList.remove('active'));
    clickedLink.closest('li').classList.add('active');

    // 确定选中的分类
    const selectedCategoryText = clickedLink.textContent.trim();
    const isAllCategory = clickedLink.dataset.category === 'all' || selectedCategoryText === '所有教程'; 
    
    // 记录切换前的分类
    const previousCategory = currentCategory;
    const newCategory = isAllCategory ? 'all' : selectedCategoryText;
    
    // 如果分类没变，不做任何操作
    if (previousCategory === newCategory) return;
    
    // 更新当前分类
    currentCategory = newCategory;
    
    console.log(`切换分类: 从 "${previousCategory}" 到 "${currentCategory}"`);

    // 关闭WebView（如果打开）
    closeWebview(webviewContainer, listContainer, contentArea); 
    
    // 重置搜索和页码
    currentSearchTerm = '';
    currentPage = 1;
    
    // 显示加载提示
    showLoadingState(listContainer);
    
    // 加载新分类的数据
    loadPage(contentArea, listContainer, 1);
}

/**
 * 在WebView中显示教程内容
 */
function showTutorialInWebview(url, title, webviewContainer, listContainer, refreshBtn) {
    setTimeout(() => {
        console.log(`Opening tutorial in webview: ${title} (${url})`);
        
        // 清空现有webview
        const webviewContentArea = webviewContainer.querySelector('#webview-content');
        if (webviewContentArea) {
            webviewContentArea.innerHTML = '';
        }
        
        // 重置状态
        currentWebview = null;
        refreshBtn.disabled = true;
        
        // 1. 创建新的 webview 元素
        console.log('Creating new webview element');
        const webview = document.createElement('webview');
        webview.src = url;
        webview.style.width = '100%';
        webview.style.height = '100%';
        webview.style.border = 'none';
        
        // 添加加载超时控制
        let loadTimeoutId = null;
        let isLoaded = false;
        let loadAttempts = 0;
        const maxLoadAttempts = 2;
        const loadTimeout = 30000; // 30秒超时
        
        // 获取标题元素
        const webviewTitleElement = webviewContainer.querySelector('#webview-title');
        
        // 2. 设置webview属性 - 针对教程场景优化
        webview.nodeintegration = false; // 禁用Node集成以提高安全性
        webview.webSecurity = false; // 对于教程内容，暂时放宽网络安全限制
        webview.contextIsolation = true; // 启用上下文隔离
        webview.allowpopups = false; // 禁止弹出窗口
        
        // 设置用户代理字符串，提高兼容性
        webview.useragent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FourAir-Tutorial/1.0';
        
        // 设置分区，隔离教程会话
        webview.partition = 'persist:tutorials';
        
        // 设置预加载脚本，用于拦截外部链接
        webview.preload = 'preload/webview-preload.js';
        
        const openLinkInBrowser = (url) => {
            console.log(`Opening external link in browser: ${url}`);
            if (window.electronAPI && window.electronAPI.openExternal) {
                window.electronAPI.openExternal(url);
            } else {
                console.warn('electronAPI.openExternal 不可用');
            }
        };
        
        // 3. 事件监听器设置
        
        // 处理页面内链接导航
        const handleNavigation = (e) => {
            // 首次加载教程内容时不拦截
            const currentUrl = currentWebview ? currentWebview.getURL() : url;
            
            // 检查是否是同一个教程页面的内部导航（允许Notion的重定向）
            const isInitialLoad = e.url === url || e.url === currentUrl;
            const isNotionRedirect = (
                (e.url.includes('notion.so') || e.url.includes('notion.site')) &&
                (url.includes('notion.so') || url.includes('notion.site'))
            );
            
            // 如果是初始加载或Notion内部重定向，允许导航
            if (isInitialLoad || isNotionRedirect) {
                console.log(`[Webview] 允许导航: ${e.url}`);
                return; // 允许导航继续
            }
            
            // 其他情况下拦截导航并在外部浏览器打开
            e.preventDefault();
            console.log(`[Webview] 拦截外部链接: ${e.url}`);
            openLinkInBrowser(e.url);
        };
        
        // will-navigate 事件处理
        webview.addEventListener('will-navigate', handleNavigation);
        
        // 处理新窗口请求
        webview.addEventListener('new-window', (e) => {
            e.preventDefault();
            console.log(`[Webview] 拦截新窗口请求: ${e.url}`);
            openLinkInBrowser(e.url);
        });
        
        // 处理来自webview的IPC消息
        webview.addEventListener('ipc-message', (e) => {
            console.log('Received IPC message from webview:', e.channel, e.args);
            
            // 处理链接点击事件
            if ((e.channel === 'open-external-link' || e.channel === 'link-click') && e.args && e.args[0]) {
                const url = e.args[0];
                console.log(`[Webview IPC] Received open link request for: ${url}`);
                openLinkInBrowser(url);
            }
        });
        
        // 添加console-message事件监听，显示webview内部的日志
        webview.addEventListener('console-message', (e) => {
            console.log(`[Webview Console] ${e.message}`);
        });
        
        // 添加DOM就绪事件处理
        webview.addEventListener('dom-ready', () => {
            console.log('Webview DOM ready for ' + url);
            
            // 尝试注入 CSS
            const cssToInject = `
                body {
                    width: 100% !important;
                    min-width: initial !important;
                    box-sizing: border-box !important;
                }
                .notion-frame, .notion-page-content {
                    max-width: none !important;
                    width: 100% !important;
                    padding-left: 10px !important;
                    padding-right: 10px !important;
                    box-sizing: border-box !important;
                }
            `;
            webview.insertCSS(cssToInject).then(() => {
                console.log('Injected custom CSS into webview.');
            }).catch(err => {
                console.error('Failed to inject CSS:', err);
            });
            
            // 显示加载的HTML用于调试
            webview.executeJavaScript(`
                document.documentElement.innerHTML;
            `).then(html => {
                console.log('WebView loaded HTML (first 100 chars):', html.substring(0, 100) + '...');
            }).catch(err => {
                console.error('Failed to get WebView HTML:', err);
            });
        });
        
        // 加载开始事件
        webview.addEventListener('did-start-loading', () => {
            console.log('Webview started loading:', url);
            webviewTitleElement.textContent = `加载中: ${title}`;
            refreshBtn.disabled = true;
            
            // 设置加载超时
            if (loadTimeoutId) {
                clearTimeout(loadTimeoutId);
            }
            loadTimeoutId = setTimeout(() => {
                if (!isLoaded && loadAttempts < maxLoadAttempts) {
                    console.warn(`Webview加载超时，尝试重新加载 (${loadAttempts + 1}/${maxLoadAttempts})`);
                    loadAttempts++;
                    webview.reload();
                } else if (!isLoaded) {
                    console.error('Webview加载超时，已达到最大重试次数');
                    webviewTitleElement.textContent = `加载超时: ${title}`;
                    refreshBtn.disabled = false;
                }
            }, loadTimeout);
        });

        // 加载完成事件
        webview.addEventListener('did-stop-loading', () => {
            console.log('Webview finished loading:', url);
            isLoaded = true;
            if (loadTimeoutId) {
                clearTimeout(loadTimeoutId);
                loadTimeoutId = null;
            }
            webviewTitleElement.textContent = title;
            refreshBtn.disabled = false;
        });
        
        // 加载失败处理
        webview.addEventListener('did-fail-load', (event) => {
            console.error('Webview load failed:', event);
            isLoaded = false;
            if (loadTimeoutId) {
                clearTimeout(loadTimeoutId);
                loadTimeoutId = null;
            }
            
            const { errorCode, errorDescription, validatedURL } = event;
            console.error(`Load failed for ${validatedURL}. Error ${errorCode}: ${errorDescription}`);
            
            // 对于某些可恢复的错误，尝试重新加载
            const recoverableErrors = [-3, -7, -21, -105, -106]; // 常见的网络连接错误
            if (recoverableErrors.includes(errorCode) && loadAttempts < maxLoadAttempts) {
                console.log(`尝试从错误中恢复，重新加载 (${loadAttempts + 1}/${maxLoadAttempts})`);
                loadAttempts++;
                setTimeout(() => {
                    webview.reload();
                }, 2000); // 2秒后重试
                return;
            }
            
            // 显示错误信息
            webviewTitleElement.textContent = `加载失败: ${title}`;
            webviewContentArea.innerHTML = `
                <div style="padding: 20px; text-align: center; color: #666;">
                    <h3 style="color: #d73527;">无法加载教程页面</h3>
                    <p>错误代码: ${errorCode}</p>
                    <p>错误描述: ${errorDescription}</p>
                    <p>URL: ${validatedURL}</p>
                    <p>请检查网络连接或稍后重试。</p>
                    <div style="margin-top: 20px;">
                        <button onclick="window.electronAPI && window.electronAPI.openExternal('${url}')" 
                                style="padding: 10px 20px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            在浏览器中打开教程
                        </button>
                    </div>
                </div>
            `;
            refreshBtn.disabled = false;
        });
        
        // 设置刷新按钮功能
        refreshBtn.onclick = () => {
            if (currentWebview && typeof currentWebview.reload === 'function') {
                console.log('Reloading webview...');
                isLoaded = false;
                loadAttempts = 0;
                currentWebview.reload();
            } else {
                console.error('Cannot reload: currentWebview reference is invalid or missing reload method.');
                refreshBtn.disabled = true;
            }
        };
        
        // 4. 保存引用并添加到 DOM
        currentWebview = webview;
        webviewContentArea.appendChild(webview);
        
        // 切换视图
        listContainer.style.display = 'none';

        // 隐藏分页控件
        const paginationContainer = listContainer.parentNode.querySelector('.pagination-container');
        if (paginationContainer) {
            paginationContainer.style.display = 'none';
        }

        webviewContainer.style.display = 'flex';
        
        // 更新标题
        webviewTitleElement.textContent = `加载中: ${title}`;
    }, 100); // 短暂延迟，确保系统有时间清理
}

/**
 * 关闭 WebView 并返回列表视图。
 * 确保彻底清理webview及相关资源
 */
function closeWebview(webviewContainer, listContainer, contentArea) {
    if (webviewContainer.style.display !== 'none') {
        console.log("正在关闭webview...");
        
        // 1. 先隐藏webview容器
        webviewContainer.style.display = 'none';
        
        const webviewContentArea = webviewContainer.querySelector('#webview-content');
        if (webviewContentArea) {
            const webviews = webviewContentArea.querySelectorAll('webview');
            webviews.forEach(wv => {
                try { 
                    if (typeof wv.stop === 'function') {
                        wv.stop(); 
                    }
                } catch (e) { 
                    console.warn(`停止webview失败: ${e.message}`); 
                }
                try {
                    // 移除事件监听器
                    const events = ['will-navigate', 'new-window', 'console-message', 'dom-ready', 
                                   'did-start-loading', 'did-stop-loading', 'did-fail-load', 'ipc-message'];
                    events.forEach(eventName => {
                        if (typeof wv.removeAllListeners === 'function') {
                            wv.removeAllListeners(eventName);
                        }
                    });
                } catch (e) { 
                    console.warn(`移除webview事件监听器失败: ${e.message}`);
                }
                
                // 安全地移除DOM元素
                try {
                    if (wv.parentNode) {
                        wv.parentNode.removeChild(wv);
                    }
                } catch (e) {
                    console.warn(`移除webview DOM元素失败: ${e.message}`);
                }
            });
            webviewContentArea.innerHTML = '';
        }
        
        if (currentWebview) {
            try {
                if (typeof currentWebview.stop === 'function') {
                    currentWebview.stop();
                }
            } catch (e) {
                console.warn(`停止当前webview失败: ${e.message}`);
            }
            currentWebview = null;
        }
        
        // 2. 显示列表容器
        listContainer.style.display = 'block';

        // 3. 显示分页控件
        const paginationContainer = listContainer.parentNode.querySelector('.pagination-container');
        if (paginationContainer) {
            paginationContainer.style.display = 'flex';
        }

        // 4. 重新加载当前页的列表和分页
        if (contentArea) {
             console.log(`关闭WebView后，重新加载页面: 页码=${currentPage}, 分类=${currentCategory}`);
             loadPage(contentArea, listContainer, currentPage);
        } else {
            console.error("closeWebview: contentArea 未提供或无效，无法刷新分页");
        }
        
        // 5. 尝试垃圾回收（在Node.js环境中）
        try {
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.gc) {
                window.electronAPI.gc();
            } else if (typeof global !== 'undefined' && global.gc) {
                global.gc();
            }
        } catch (e) {
            // 忽略垃圾回收错误，这不是关键功能
        }
        
        console.log("Webview已关闭并清理完毕，列表和分页已刷新。");
    }
}

/**
 * 根据分类返回 Font Awesome 图标类名 (示例)
 */
function getIconForCategory(category) {
    switch (category) {
        case '空投教程':
            return 'fas fa-rocket'; // Font Awesome 图标
        case '新手入门':
            return 'fas fa-star';
        case '工具技巧':
            return 'fas fa-tools';
        case '安全知识':
            return 'fas fa-shield-alt';
        default:
            return 'fas fa-book-open'; // 默认图标
    }
}

// --- Wrappers and old internal functions are no longer needed and will be removed below --- 
// --- Wrappers and old internal functions are no longer needed and will be removed below --- 