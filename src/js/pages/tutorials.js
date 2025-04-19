// src/js/pages/tutorials.js

// May need showModal if articles open in modal, or navigation if links load sub-pages
// import { showModal } from '../components/modal.js';

/**
 * Initializes the Tutorials page.
 * Sets up category navigation and handles tutorial item clicks.
 * @param {HTMLElement} contentArea - The main content area to work within.
 */
export function initTutorialsPage(contentArea) {
    console.log("Initializing Tutorials Page...");

    // Setup category navigation
    const categoryLinks = contentArea.querySelectorAll('.tutorial-categories ul li a');
    categoryLinks.forEach(link => {
        link.addEventListener('click', (e) => handleCategoryClick(e, contentArea, categoryLinks));
    });

    // Setup event delegation for tutorial item clicks (buttons)
    const listContainer = contentArea.querySelector('#tutorial-list-container');
    const articleContainer = contentArea.querySelector('#article-view-container'); // For showing single article

    if (listContainer) {
        listContainer.addEventListener('click', (e) => handleTutorialItemClick(e, listContainer, articleContainer));
    }

    // Setup back button if viewing an article
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
 * Handles clicks on category links in the sidebar.
 * Updates active state and potentially filters the tutorial list.
 * @param {Event} e - The click event.
 * @param {HTMLElement} contentArea - The main content area.
 * @param {NodeListOf<Element>} categoryLinks - All category links.
 */
function handleCategoryClick(e, contentArea, categoryLinks) {
    e.preventDefault();
    const clickedLink = e.target.closest('a');
    if (!clickedLink) return;

    // Remove active class from all links and their parent li
    categoryLinks.forEach(link => {
         link.parentElement.classList.remove('active');
         // Handle nested lists if needed
         const subUl = link.parentElement.querySelector('ul');
         if (subUl) {
             subUl.querySelectorAll('li a').forEach(subLink => subLink.parentElement.classList.remove('active'));
         }
    });

    // Add active class to the clicked link's parent li
    clickedLink.parentElement.classList.add('active');

    const categoryName = clickedLink.textContent.trim();
    console.log(`Category selected: ${categoryName}`);

    // TODO: Implement filtering logic based on categoryName
    // For now, just log it. This would likely involve hiding/showing tutorial items
    // or re-fetching tutorials for the selected category.
    filterTutorialsByCategory(contentArea, categoryName);

    // Ensure the list view is shown if an article was open
    const listContainer = contentArea.querySelector('#tutorial-list-container');
    const articleContainer = contentArea.querySelector('#article-view-container');
    if (listContainer && articleContainer) {
         showTutorialList(listContainer, articleContainer);
    }
}

/**
 * Filters tutorial items based on the selected category. (Placeholder)
 * @param {HTMLElement} contentArea
 * @param {string} categoryName
 */
function filterTutorialsByCategory(contentArea, categoryName) {
    console.log(`Filtering tutorials by category: ${categoryName} (Not implemented)`);
    const items = contentArea.querySelectorAll('#tutorial-list-container .tutorial-item');
    // Example filtering logic (replace with actual logic based on data attributes or fetched data)
    items.forEach(item => {
        const itemCategory = item.querySelector('.item-meta span:first-child')?.textContent.split(':')[1]?.trim().toLowerCase() || '';
        const parentCategoryLi = item.closest('.tutorial-categories')?.querySelector('li.active > a'); // Get main category
        const parentCategoryName = parentCategoryLi?.textContent.trim().toLowerCase() || '';

         // Basic logic: show if category matches or if '新手入门' etc. is clicked (or a sub-category matches)
         // This needs to be more robust based on actual data structure.
        const shouldShow = categoryName.toLowerCase() === 'all' || // Assuming an "All" category exists
                           itemCategory.includes(categoryName.toLowerCase()) ||
                           parentCategoryName.includes(categoryName.toLowerCase());

        // item.style.display = shouldShow ? '' : 'none';
        // For now, just log:
        // console.log(`Item: ${item.querySelector('h4').textContent}, Category: ${itemCategory}, Show: ${shouldShow}`);
    });
     alert(`分类 "${categoryName}" 的教程筛选功能待实现。`);
}


/**
 * Handles clicks within the tutorial list container.
 * Primarily looks for clicks on "Start Learning" or "Read Article" buttons.
 * @param {Event} e
 * @param {HTMLElement} listContainer
 * @param {HTMLElement} articleContainer
 */
function handleTutorialItemClick(e, listContainer, articleContainer) {
    const button = e.target.closest('.tutorial-item .btn');
    if (!button) return;

    e.preventDefault();
    const tutorialItem = button.closest('.tutorial-item');
    const title = tutorialItem?.querySelector('h4')?.textContent || 'Unknown Tutorial';

    console.log(`Button clicked for tutorial: ${title}`);
    // Placeholder: Load and display the article content
    loadAndShowArticle(title, listContainer, articleContainer);
}

/**
 * Placeholder function to load and display a single article.
 * Hides the list and shows the article view.
 * @param {string} articleTitle
 * @param {HTMLElement} listContainer
 * @param {HTMLElement} articleContainer
 */
function loadAndShowArticle(articleTitle, listContainer, articleContainer) {
    if (!listContainer || !articleContainer) return;

    console.log(`Loading article: ${articleTitle} (Placeholder)`);
    // In real app, fetch article content based on title or an ID
    articleContainer.innerHTML = `
        <button class="btn btn-secondary btn-small back-to-list-btn"><i class="fas fa-arrow-left"></i> 返回列表</button>
        <h2>${articleTitle}</h2>
        <p>这是教程 <strong>${articleTitle}</strong> 的详细内容。</p>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
        <p>Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.</p>
        <!-- More article content -->
    `;

    listContainer.style.display = 'none';
    articleContainer.style.display = 'block';
    articleContainer.scrollTop = 0; // Scroll to top of article
}

/**
 * Shows the tutorial list and hides the article view.
 * @param {HTMLElement} listContainer
 * @param {HTMLElement} articleContainer
 */
function showTutorialList(listContainer, articleContainer) {
     if (!listContainer || !articleContainer) return;
     articleContainer.style.display = 'none';
     listContainer.style.display = 'block';
} 