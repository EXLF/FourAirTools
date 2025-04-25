// Import other modules if needed
// import * as table from './table.js';
// import * as modals from './modals.js';
// import * as actions from './actions.js';

let contentAreaCache = null; // Cache contentArea for internal functions

/**
 * 初始化教程页面。
 * 设置分类导航并处理教程项点击事件。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initTutorialsPage(contentArea) {
    console.log("正在初始化教程页面...");
    contentAreaCache = contentArea;

    // --- 设置分类导航 --- 
    const categoryLinks = contentArea.querySelectorAll('.tutorial-categories ul li a');
    categoryLinks.forEach(link => {
        // Remove potential old listeners before adding new ones
        link.removeEventListener('click', handleCategoryClickWrapper);
        link.addEventListener('click', handleCategoryClickWrapper);
    });

    // --- 设置教程项点击（按钮）事件委托 --- 
    const listContainer = contentArea.querySelector('#tutorial-list-container');
    const articleContainer = contentArea.querySelector('#article-view-container');

    if (listContainer) {
        listContainer.removeEventListener('click', handleTutorialItemClickWrapper);
        listContainer.addEventListener('click', handleTutorialItemClickWrapper);
    }

    // --- 设置文章返回按钮事件委托 --- 
    if (articleContainer) {
        articleContainer.removeEventListener('click', handleArticleBackClickWrapper);
        articleContainer.addEventListener('click', handleArticleBackClickWrapper);
    }
}

// --- Wrappers to pass necessary context to handlers --- 
function handleCategoryClickWrapper(e) {
    const categoryLinks = contentAreaCache?.querySelectorAll('.tutorial-categories ul li a');
    if (contentAreaCache && categoryLinks) {
        handleCategoryClick(e, contentAreaCache, categoryLinks);
    }
}

function handleTutorialItemClickWrapper(e) {
    const listContainer = contentAreaCache?.querySelector('#tutorial-list-container');
    const articleContainer = contentAreaCache?.querySelector('#article-view-container');
    if (listContainer && articleContainer) {
        handleTutorialItemClick(e, listContainer, articleContainer);
    }
}

function handleArticleBackClickWrapper(e) {
    if (e.target.matches('.back-to-list-btn')) {
        const listContainer = contentAreaCache?.querySelector('#tutorial-list-container');
        const articleContainer = contentAreaCache?.querySelector('#article-view-container');
        if (listContainer && articleContainer) {
            e.preventDefault();
            showTutorialList(listContainer, articleContainer);
        }
    }
}

// --- Internal functions (moved from global scope) --- 

/**
 * 处理侧边栏分类链接的点击事件。
 * 更新活动状态并可能筛选教程列表。
 */
function handleCategoryClick(e, contentArea, categoryLinks) {
    e.preventDefault();
    const clickedLink = e.target.closest('a');
    if (!clickedLink) return;

    categoryLinks.forEach(link => {
         link.parentElement.classList.remove('active');
         const subUl = link.parentElement.querySelector('ul');
         if (subUl) {
             subUl.querySelectorAll('li a').forEach(subLink => subLink.parentElement.classList.remove('active'));
         }
    });

    clickedLink.parentElement.classList.add('active');
    const categoryName = clickedLink.textContent.trim();
    console.log(`已选择分类: ${categoryName}`);

    // TODO: Implement filtering
    filterTutorialsByCategory(contentArea, categoryName);

    const listContainer = contentArea.querySelector('#tutorial-list-container');
    const articleContainer = contentArea.querySelector('#article-view-container');
    if (listContainer && articleContainer) {
         showTutorialList(listContainer, articleContainer);
    }
}

/**
 * 根据所选分类筛选教程项。（占位符）
 */
function filterTutorialsByCategory(contentArea, categoryName) {
    console.log(`按分类筛选教程: ${categoryName} (未实现)`);
    // const items = contentArea.querySelectorAll('#tutorial-list-container .tutorial-item');
    // Implement actual filtering logic here
     alert(`分类 "${categoryName}" 的教程筛选功能待实现。`);
}

/**
 * 处理教程列表容器内的点击事件。
 */
function handleTutorialItemClick(e, listContainer, articleContainer) {
    const button = e.target.closest('.tutorial-item .btn');
    if (!button) return;
    e.preventDefault();
    const tutorialItem = button.closest('.tutorial-item');
    const title = tutorialItem?.querySelector('h4')?.textContent || '未知教程';
    console.log(`教程按钮被点击: ${title}`);
    loadAndShowArticle(title, listContainer, articleContainer);
}

/**
 * 加载并显示单篇文章的占位符函数。
 */
function loadAndShowArticle(articleTitle, listContainer, articleContainer) {
    if (!listContainer || !articleContainer) return;
    console.log(`正在加载文章: ${articleTitle} (占位符)`);
    // Fetch or generate article content here
    articleContainer.innerHTML = `
        <button class="btn btn-secondary btn-small back-to-list-btn"><i class="fas fa-arrow-left"></i> 返回列表</button>
        <h2>${articleTitle}</h2>
        <p>这是教程 <strong>${articleTitle}</strong> 的详细内容。</p>
        <p>Lorem ipsum dolor sit amet...</p>
        <!-- More content -->
    `;
    listContainer.style.display = 'none';
    articleContainer.style.display = 'block';
    articleContainer.scrollTop = 0;
}

/**
 * 显示教程列表并隐藏文章视图。
 */
function showTutorialList(listContainer, articleContainer) {
     if (!listContainer || !articleContainer) return;
     articleContainer.style.display = 'none';
     listContainer.style.display = 'block';
} 