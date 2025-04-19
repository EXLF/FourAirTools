import { setupFilteringAndSearch } from '../components/tableHelper.js';
// import { showModal } from '../components/modal.js'; // Potential future use

/**
 * Initializes the Project Tracking page.
 * Sets up filtering for project cards and basic interaction listeners.
 * @param {HTMLElement} contentArea - The main content area to work within.
 */
export function initProjectsPage(contentArea) {
    console.log("Initializing Project Tracking Page...");

    // Setup filtering for project cards
    // Item selector is '.project-card'
    setupFilteringAndSearch(contentArea, '.filters-bar', '.project-card', filterProjectCard);

    // Add listeners for header buttons
    const refreshBtn = contentArea.querySelector('.header-actions .btn-secondary');
    const addBtn = contentArea.querySelector('.header-actions .btn-primary');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => alert('刷新项目数据 (未实现)'));
    }
    if (addBtn) {
        addBtn.addEventListener('click', () => alert('添加项目/活动 (未实现)'));
    }

    // Setup event delegation for actions within project cards (e.g., activity buttons)
    const projectContainer = contentArea.querySelector('.project-container');
    if (projectContainer) {
        projectContainer.addEventListener('click', handleProjectCardAction);
    }
}

/**
 * Filter function for project cards.
 * @param {HTMLElement} cardElement - The project card element.
 * @param {object} filterValues - Object containing filter values.
 *                                e.g., { search: '...', 'project-chain-filter': 'LayerZero', ... }
 * @returns {boolean} - True if the card should be shown.
 */
function filterProjectCard(cardElement, filterValues) {
    // Extract data from the card (using data-* attributes or text content)
    const chain = cardElement.dataset.chain?.toLowerCase() || '';
    const type = cardElement.dataset.type?.toLowerCase() || '';
    const title = cardElement.querySelector('.project-title h5')?.textContent.toLowerCase() || '';
    const activitiesText = cardElement.querySelector('.activity-list')?.textContent.toLowerCase() || '';
    const searchContent = `${chain} ${type} ${title} ${activitiesText}`;

    // Extract data for activity status filtering (more complex)
    // We need to check if *any* activity matches the status filter
    const activityItems = cardElement.querySelectorAll('.activity-list li');
    let activityStatusMatch = true; // Show if no status filter or if a match is found
    const statusFilter = filterValues['activity-status-filter'] || '';

    if (statusFilter) {
        activityStatusMatch = Array.from(activityItems).some(li => {
            const status = li.dataset.status?.toLowerCase() || '';
            return status === statusFilter;
        });
         // If filtering by status, also hide cards that don't contain *any* activities
         if (activityItems.length === 0) {
             activityStatusMatch = false;
         }
    }

    // Get filter values from the passed object
    const chainFilter = filterValues['project-chain-filter'] || '';
    const typeFilter = filterValues['project-type-filter'] || '';
    const searchTerm = filterValues.search || '';

    // Apply filters
    const chainMatch = !chainFilter || chain.includes(chainFilter.toLowerCase());
    const typeMatch = !typeFilter || type.includes(typeFilter.toLowerCase());
    const searchMatch = !searchTerm || searchContent.includes(searchTerm);

    return chainMatch && typeMatch && searchMatch && activityStatusMatch;
}

/**
 * Handles click events delegated from the project container.
 * Identifies clicks on action buttons within project cards or activity items.
 * @param {Event} e - The click event object.
 */
function handleProjectCardAction(e) {
    const target = e.target;

    // Check for clicks on activity action buttons (inside li > .actions > .btn-icon)
    const activityActionButton = target.closest('.activity-list li .actions .btn-icon');
    if (activityActionButton) {
        const action = activityActionButton.title || 'Unknown Action';
        const activityItem = activityActionButton.closest('li');
        const activityName = activityItem?.querySelector('span:first-child')?.textContent || 'Unknown Activity';
        const projectName = activityActionButton.closest('.project-card')?.querySelector('.project-title h5')?.textContent || 'Unknown Project';

        console.log(`Activity action clicked: ${action} on ${activityName} in project ${projectName}`);

        // Add logic based on action (e.g., '查看详情', '标记完成')
        if (action === '查看详情') {
            alert(`查看 ${activityName} 的详情 (未实现)`);
            // Potentially open a modal or navigate
        } else if (action === '标记完成') {
            if (confirm(`将 ${activityName} 标记为已完成？`)) {
                // Update UI (e.g., add a checkmark, change status)
                activityItem.dataset.status = 'completed'; // Example
                activityItem.querySelector('.status-indicator')?.classList.add('completed');
                 // TODO: Persist this change
                 alert(`${activityName} 已标记为完成 (前端模拟)`);
            }
        }
        // Add other action handlers
    }

    // TODO: Check for clicks on other card elements if needed (e.g., title, expand button)
}
