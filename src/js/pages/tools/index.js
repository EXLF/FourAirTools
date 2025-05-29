let initToolsPageCallCount = 0;
let toolsPageInitialized = false; // 标志位，表示页面是否已初始化

/**
 * 初始化常用工具页面的事件监听器
 * @param {HTMLElement} contentArea - 页面内容区域的容器元素
 */
export function initToolsPage(contentArea) {
    initToolsPageCallCount++;
    console.log(`[Tools Page] initToolsPage called. Count: ${initToolsPageCallCount}`);

    if (toolsPageInitialized) {
        console.warn('[Tools Page] Already initialized. Skipping re-initialization of listeners.');
        return;
    }

    console.log('[Tools Page] Initializing event listeners...');

    const exchangeItems = document.querySelectorAll('.exchange-item');
    console.log(`[Tools Page] Found ${exchangeItems.length} tool items.`);

    if (exchangeItems.length === 0) {
        console.warn('[Tools Page] No tool items found. Listener attachment skipped.');
        toolsPageInitialized = true;
        return;
    }

    exchangeItems.forEach((item, index) => {
        item.addEventListener('click', handleToolItemClick);
        console.log(`[Tools Page] Click listener attached to item index: ${index}`);
    });

    toolsPageInitialized = true;
    console.log('[Tools Page] All click listeners attached successfully and page marked as initialized.');
}

// 将点击处理逻辑提取为单独的函数
function handleToolItemClick(event) {
    const item = event.currentTarget; // 使用 event.currentTarget 来获取附加监听器的元素
    console.log(`[Tools Page] Click detected on item:`, item);

    const url = item.dataset.url;
    const toolName = item.querySelector('h4')?.textContent || '未知工具';
    console.log(`[Tools Page] Extracted URL: ${url}, Tool Name: ${toolName}`);

    if (url) {
        console.log(`[Tools Page] URL is valid, checking IPC availability...`);
        console.log('[Tools Page] Checking window.electron:', window.electron);
        console.log('[Tools Page] Checking window.electron.ipcRenderer:', window.electron?.ipcRenderer);

        if (window.electron && window.electron.ipcRenderer && typeof window.electron.ipcRenderer.send === 'function') {
            const channel = 'open-external-link';
            console.log(`[Tools Page] IPC renderer found. Sending '${channel}' for: ${url}`);
            try {
                window.electron.ipcRenderer.send(channel, url);
                console.log(`[Tools Page] IPC message sent successfully for: ${url}`);
            } catch (error) {
                console.error('[Tools Page] Error sending IPC message:', error);
            }
        } else {
            console.warn('[Tools Page] IPC renderer not available or send method missing. Falling back to window.open.');
            try {
                const newWindow = window.open(url, '_blank');
                if (newWindow) {
                    console.log(`[Tools Page] window.open called successfully for: ${url}`);
                } else {
                    console.error(`[Tools Page] window.open failed for: ${url}. Possible pop-up blocker?`);
                }
            } catch (error) {
                console.error(`[Tools Page] Error calling window.open for ${url}:`, error);
            }
        }
    } else {
        console.error(`[Tools Page] 工具 ${toolName} 的 URL 未在 data-url 属性中定义或为空.`);
    }
}

export function resetToolsPageInitializationState() {
    console.log('[Tools Page] Resetting initialization state.');
    toolsPageInitialized = false;
} 