/**
 * 设置全局事件监听器（从 document 或 body 委托）。
 * 目前为空，根据需要添加监听器（例如，主题更改、全局快捷方式）。
 */
export function initGlobalEventListeners() {
    console.log("Initializing global event listeners..."); // 这条日志可以保留英文，因为它是给开发者看的
    
    // 监听内容加载完成事件，初始化自定义下拉框
    document.addEventListener('content-loaded', () => {
        if (window.initCustomSelects) {
            window.initCustomSelects();
        }
    });

    // 监听模态框显示事件，为模态框中的下拉框设置样式
    document.addEventListener('modal-opened', (event) => {
        if (window.initCustomSelects) {
            setTimeout(() => {
                window.initCustomSelects();
            }, 50); // 短暂延迟确保DOM已完全准备好
        }
    });

    // 监听AJAX请求完成后的内容更新
    document.addEventListener('ajax-content-loaded', (event) => {
        if (window.initCustomSelects) {
            window.initCustomSelects();
        }
    });
} 