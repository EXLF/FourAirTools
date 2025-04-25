import { initSocialTable } from './table.js';
import { initActionElements, handleBulkDeleteSocialAccounts } from './actions.js';
import { initSocialModals } from './modals.js'; // Assuming modals.js exports an init function

/**
 * Initializes the entire Social Accounts page.
 * This function is called by navigation.js when the page loads.
 * @param {HTMLElement} contentArea - The main content area element.
 */
export function initSocialPage(contentArea) {
    console.log("Initializing Social Accounts Page...");

    if (!contentArea) {
        console.error("Social Page Init Error: contentArea is missing!");
        return;
    }

    // 1. Initialize the table (handles rendering, pagination, filtering, etc.)
    initSocialTable(contentArea);

    // 2. Initialize modals (sets up 'Add Account' button listener inside)
    initSocialModals(contentArea);

    // 3. Initialize actions (passes necessary elements like tableBody)
    //    Cache elements needed by actions module here.
    const tableBody = contentArea.querySelector('.social-table tbody');
    const bulkDeleteBtn = contentArea.querySelector('#bulk-delete-social-btn'); // Example ID

    if (tableBody) {
        initActionElements({ tableBody: tableBody, contentAreaCache: contentArea });
    } else {
        console.error("Social Page Init Warning: Table body not found for actions module.");
    }

    // 4. Setup listeners for header actions (if any managed by index)
    if (bulkDeleteBtn) {
        bulkDeleteBtn.addEventListener('click', handleBulkDeleteSocialAccounts);
    } else {
         console.warn("Bulk delete button (#bulk-delete-social-btn) not found.");
    }

    // Check dbAPI availability (redundant if table init checks, but good practice)
    if (typeof window.dbAPI === 'undefined') {
        console.error("Error: window.dbAPI is undefined! Cannot interact with database.");
        // Optionally display a more prominent error to the user
        const errorDiv = document.createElement('div');
        errorDiv.className = 'notice error p-4 mb-4';
        errorDiv.textContent = '错误：无法连接到数据库。应用功能将受限。';
        contentArea.prepend(errorDiv);
    }

    console.log("Social Accounts Page Initialized.");
} 