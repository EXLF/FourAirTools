/**
 * 初始化常用工具页面的事件监听器
 * @param {HTMLElement} contentArea - 页面内容区域的容器元素 (虽然在此特定函数中未使用，但保持接口一致性)
 */
export function initToolsPage(contentArea) {
    console.log('[Tools Page] initToolsPage function called.'); // 确认初始化函数被调用

    // DOMContentLoaded 在这里不再直接需要，因为 initToolsPage 是在 HTML 加载后调用的
    // 但为确保元素确实存在，可以加个小延迟或直接执行

    // 获取所有工具卡片
    const exchangeItems = document.querySelectorAll('.exchange-item');
    console.log(`[Tools Page] Found ${exchangeItems.length} tool items.`); 

    if (exchangeItems.length === 0) {
        console.warn('[Tools Page] No tool items found. Listener attachment skipped.');
        return; // 如果没有找到元素，提前退出
    }
    
    // 为每个工具卡片添加点击事件处理
    exchangeItems.forEach((item, index) => {
        // 清理旧监听器（理论上不必要，因为每次页面加载都是新的 DOM，但以防万一）
        // 注意：需要一个命名函数才能精确移除，这里只是示意
        
        item.addEventListener('click', () => {
            console.log(`[Tools Page] Click detected on item index: ${index}`, item); 
            
            // 从 data-url 属性获取 URL
            const url = item.dataset.url;
            const toolName = item.querySelector('h4')?.textContent || '未知工具'; 
            console.log(`[Tools Page] Extracted URL: ${url}, Tool Name: ${toolName}`);

            if (url) {
                console.log(`[Tools Page] URL is valid, checking IPC availability...`); 
                // 使用Electron的shell.openExternal打开外部链接
                console.log('[Tools Page] Checking window.electron:', window.electron); 
                console.log('[Tools Page] Checking window.electron.ipcRenderer:', window.electron?.ipcRenderer); 
                
                if (window.electron && window.electron.ipcRenderer && typeof window.electron.ipcRenderer.send === 'function') {
                    // 统一事件名称为 'open-external-link'
                    const channel = 'open-external-link'; 
                    console.log(`[Tools Page] IPC renderer found. Sending '${channel}' for: ${url}`); 
                    try {
                        window.electron.ipcRenderer.send(channel, url); // 使用统一的 channel
                        console.log(`[Tools Page] IPC message sent successfully for: ${url}`); 
                    } catch (error) {
                        console.error('[Tools Page] Error sending IPC message:', error); 
                    }
                } else {
                    console.warn('[Tools Page] IPC renderer not available or send method missing. Falling back to window.open.'); 
                    // 备用方案：使用窗口打开
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
        });
        console.log(`[Tools Page] Click listener attached to item index: ${index}`); // 确认监听器附加
    });

    console.log('[Tools Page] All click listeners attached successfully.'); 
} 