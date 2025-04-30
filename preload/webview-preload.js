// webview-preload.js - 为webview内的页面提供与主进程通信的能力

// 导入必要的Electron模块
const { ipcRenderer } = require('electron');

// 定义在控制台中显示的消息
console.log('[Preload] Webview preload script loaded');

// 设置一个变量以防止重复处理同一个链接
let isProcessingLink = false;
let lastProcessedLink = '';
let lastProcessTime = 0;

// 处理外部链接的函数
function handleExternalLink(url) {
  // 防止同一时间内重复处理相同的链接
  const now = Date.now();
  if (isProcessingLink || (url === lastProcessedLink && now - lastProcessTime < 1000)) {
    console.log('[Preload] Skipping duplicate link handling:', url);
    return;
  }
  
  isProcessingLink = true;
  lastProcessedLink = url;
  lastProcessTime = now;
  
  console.log('[Preload] Processing external link:', url);
  
  // 发送到主进程，使用系统浏览器打开
  ipcRenderer.send('open-external-link', url);
  
  // 重置处理状态
  setTimeout(() => {
    isProcessingLink = false;
  }, 500);
}

// 在DOM加载完成后执行
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Preload] DOM content loaded in webview');
  
  // 拦截所有外部链接点击 - 这是第一道防线
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="http"]');
    if (link) {
      const href = link.getAttribute('href');
      const currentUrl = window.location.href.split('#')[0];
      const clickedUrl = href.split('#')[0];
      
      // 如果不是指向当前页面的链接，拦截并处理
      if (clickedUrl !== currentUrl) {
        console.log('[Preload] Intercepted link click:', href);
        e.preventDefault();
        e.stopPropagation();
        
        // 处理外部链接
        handleExternalLink(href);
        
        return false;
      }
    }
  }, true);
});

// 拦截window.open调用 - 这是第二道防线
const originalWindowOpen = window.open;
window.open = function(url, target, features) {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    console.log('[Preload] Intercepted window.open:', url);
    
    // 处理外部链接
    handleExternalLink(url);
    
    // 返回一个空对象，避免页面报错
    return { 
      closed: true,
      close: function() {} 
    };
  }
  
  // 对于其他类型的链接，使用原始的window.open
  return originalWindowOpen.call(window, url, target, features);
}; 