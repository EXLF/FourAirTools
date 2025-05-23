// 格式化地址，截取显示
export function formatAddress(address) {
    if (!address) return '未配置';
    if (address.length <= 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
}

// 格式化代理信息
export function formatProxy(proxy) {
    if (!proxy) return '无代理';
    
    // 如果代理对象有name属性，优先显示
    if (proxy.name) return proxy.name;
    
    // 否则尝试从字符串解析
    if (typeof proxy === 'string') {
        // 简单展示IP:端口格式
        const parts = proxy.split(':');
        if (parts.length >= 2) {
            return `${parts[0]}:${parts[1]}`;
        }
    }
    
    return String(proxy);
}

// 格式化任务状态
export function formatTaskStatus(status) {
    const statusMap = {
        'pending': '待执行',
        'running': '运行中',
        'completed': '已完成',
        'failed': '失败',
        'paused': '已暂停'
    };
    return statusMap[status] || status;
}

// 格式化时间戳
export function formatTimestamp(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// 格式化持续时间
export function formatDuration(milliseconds) {
    if (!milliseconds) return '-';
    
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
        return `${hours}小时${minutes % 60}分钟`;
    } else if (minutes > 0) {
        return `${minutes}分钟${seconds % 60}秒`;
    } else {
        return `${seconds}秒`;
    }
} 