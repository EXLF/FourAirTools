/**
 * 显示消息通知
 * @param {string} message - 要显示的消息内容
 * @param {string} type - 消息类型，可选值: 'success', 'error', 'info', 'warning'
 * @param {number} duration - 通知显示的持续时间(毫秒)，默认3000毫秒
 */
export function showMessage(message, type = 'info', duration = 3000) {
    // 检查消息容器是否存在，如果不存在则创建
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }

    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.style.marginBottom = '10px';
    notification.style.padding = '12px 15px';
    notification.style.borderRadius = '4px';
    notification.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    notification.style.minWidth = '250px';
    notification.style.animation = 'fadeIn 0.3s';
    notification.style.transition = 'all 0.3s';

    // 根据消息类型设置样式
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#4caf50';
            notification.style.color = 'white';
            break;
        case 'error':
            notification.style.backgroundColor = '#f44336';
            notification.style.color = 'white';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ff9800';
            notification.style.color = 'white';
            break;
        case 'info':
        default:
            notification.style.backgroundColor = '#2196f3';
            notification.style.color = 'white';
            break;
    }

    // 设置通知内容
    notification.textContent = message;

    // 添加关闭按钮
    const closeBtn = document.createElement('span');
    closeBtn.innerHTML = '&times;';
    closeBtn.style.marginLeft = '10px';
    closeBtn.style.float = 'right';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontWeight = 'bold';
    closeBtn.addEventListener('click', () => {
        removeNotification(notification);
    });
    notification.appendChild(closeBtn);

    // 添加通知到容器
    container.appendChild(notification);

    // 设置自动消失
    setTimeout(() => {
        removeNotification(notification);
    }, duration);
}

/**
 * 移除通知元素
 * @param {HTMLElement} notification - 要移除的通知元素
 */
function removeNotification(notification) {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-10px)';
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.parentElement.removeChild(notification);
        }
    }, 300);
} 