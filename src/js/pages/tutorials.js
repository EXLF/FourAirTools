// src/js/pages/tutorials.js

// 如果文章在模态框中打开，可能需要 showModal；如果链接加载子页面，则可能需要导航
// import { showModal } from '../components/modal.js'; // 引入模态框组件（如果需要）

/**
 * 初始化教程页面。
 * 设置分类导航并处理教程项点击事件。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initTutorialsPage(contentArea) {
    console.log("正在初始化教程页面..."); // 控制台日志也中文化

    // 设置分类导航
    const categoryLinks = contentArea.querySelectorAll('.tutorial-categories ul li a');
    categoryLinks.forEach(link => {
        link.addEventListener('click', (e) => handleCategoryClick(e, contentArea, categoryLinks));
    });

    // 为教程项点击（按钮）设置事件委托
    const listContainer = contentArea.querySelector('#tutorial-list-container');
    const articleContainer = contentArea.querySelector('#article-view-container'); // 用于显示单个文章

    if (listContainer) {
        listContainer.addEventListener('click', (e) => handleTutorialItemClick(e, listContainer, articleContainer));
    }

    // 如果正在查看文章，则设置返回按钮
    if (articleContainer) {
        articleContainer.addEventListener('click', (e) => {
            if (e.target.matches('.back-to-list-btn')) {
                e.preventDefault();
                showTutorialList(listContainer, articleContainer);
            }
        });
    }
}

/**
 * 处理侧边栏分类链接的点击事件。
 * 更新活动状态并可能筛选教程列表。
 * @param {Event} e - 点击事件对象。
 * @param {HTMLElement} contentArea - 主要内容区域。
 * @param {NodeListOf<Element>} categoryLinks - 所有分类链接。
 */
function handleCategoryClick(e, contentArea, categoryLinks) {
    e.preventDefault();
    const clickedLink = e.target.closest('a');
    if (!clickedLink) return;

    // 从所有链接及其父 li 元素移除 active 类
    categoryLinks.forEach(link => {
         link.parentElement.classList.remove('active');
         // 如果需要，处理嵌套列表
         const subUl = link.parentElement.querySelector('ul');
         if (subUl) {
             subUl.querySelectorAll('li a').forEach(subLink => subLink.parentElement.classList.remove('active'));
         }
    });

    // 为被点击链接的父 li 元素添加 active 类
    clickedLink.parentElement.classList.add('active');

    const categoryName = clickedLink.textContent.trim();
    console.log(`已选择分类: ${categoryName}`); // 控制台日志中文化

    // TODO: 实现基于 categoryName 的筛选逻辑
    // 目前仅记录日志。这可能涉及隐藏/显示教程项
    // 或重新获取所选分类的教程。
    filterTutorialsByCategory(contentArea, categoryName);

    // 如果之前打开了文章视图，确保显示列表视图
    const listContainer = contentArea.querySelector('#tutorial-list-container');
    const articleContainer = contentArea.querySelector('#article-view-container');
    if (listContainer && articleContainer) {
         showTutorialList(listContainer, articleContainer);
    }
}

/**
 * 根据所选分类筛选教程项。（占位符）
 * @param {HTMLElement} contentArea - 主要内容区域。
 * @param {string} categoryName - 分类名称。
 */
function filterTutorialsByCategory(contentArea, categoryName) {
    console.log(`按分类筛选教程: ${categoryName} (未实现)`); // 控制台日志中文化
    const items = contentArea.querySelectorAll('#tutorial-list-container .tutorial-item');
    // 示例筛选逻辑（请替换为基于数据属性或获取数据的实际逻辑）
    items.forEach(item => {
        const itemCategory = item.querySelector('.item-meta span:first-child')?.textContent.split(':')[1]?.trim().toLowerCase() || '';
        const parentCategoryLi = item.closest('.tutorial-categories')?.querySelector('li.active > a'); // 获取主分类
        const parentCategoryName = parentCategoryLi?.textContent.trim().toLowerCase() || '';

         // 基本逻辑：如果分类匹配，或者点击了“新手入门”等（或子分类匹配），则显示
         // 这需要根据实际数据结构进行更健壮的处理。
        const shouldShow = categoryName.toLowerCase() === 'all' || // 假设存在“全部”分类
                           itemCategory.includes(categoryName.toLowerCase()) ||
                           parentCategoryName.includes(categoryName.toLowerCase());

        // item.style.display = shouldShow ? '' : 'none'; // 根据 shouldShow 设置显示或隐藏
        // 目前仅记录日志：
        // console.log(`项目: ${item.querySelector('h4').textContent}, 分类: ${itemCategory}, 显示: ${shouldShow}`);
    });
     alert(`分类 "${categoryName}" 的教程筛选功能待实现。`);
}


/**
 * 处理教程列表容器内的点击事件。
 * 主要查找对“开始学习”或“阅读文章”按钮的点击。
 * @param {Event} e - 点击事件对象。
 * @param {HTMLElement} listContainer - 列表容器元素。
 * @param {HTMLElement} articleContainer - 文章容器元素。
 */
function handleTutorialItemClick(e, listContainer, articleContainer) {
    const button = e.target.closest('.tutorial-item .btn');
    if (!button) return;

    e.preventDefault();
    const tutorialItem = button.closest('.tutorial-item');
    const title = tutorialItem?.querySelector('h4')?.textContent || '未知教程'; // 文本中文化

    console.log(`教程按钮被点击: ${title}`); // 控制台日志中文化
    // 占位符：加载并显示文章内容
    loadAndShowArticle(title, listContainer, articleContainer);
}

/**
 * 加载并显示单篇文章的占位符函数。
 * 隐藏列表并显示文章视图。
 * @param {string} articleTitle - 文章标题。
 * @param {HTMLElement} listContainer - 列表容器元素。
 * @param {HTMLElement} articleContainer - 文章容器元素。
 */
function loadAndShowArticle(articleTitle, listContainer, articleContainer) {
    if (!listContainer || !articleContainer) return;

    console.log(`正在加载文章: ${articleTitle} (占位符)`); // 控制台日志中文化
    // 在实际应用中，根据标题或 ID 获取文章内容
    articleContainer.innerHTML = `
        <button class="btn btn-secondary btn-small back-to-list-btn"><i class="fas fa-arrow-left"></i> 返回列表</button>
        <h2>${articleTitle}</h2>
        <p>这是教程 <strong>${articleTitle}</strong> 的详细内容。</p>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
        <!-- 更多文章内容 -->
    `;

    listContainer.style.display = 'none';
    articleContainer.style.display = 'block';
    articleContainer.scrollTop = 0; // 滚动到文章顶部
}

/**
 * 显示教程列表并隐藏文章视图。
 * @param {HTMLElement} listContainer - 列表容器元素。
 * @param {HTMLElement} articleContainer - 文章容器元素。
 */
function showTutorialList(listContainer, articleContainer) {
     if (!listContainer || !articleContainer) return;
     articleContainer.style.display = 'none';
     listContainer.style.display = 'block';
}