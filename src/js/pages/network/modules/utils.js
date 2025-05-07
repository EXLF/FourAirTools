// 工具函数模块

// 获取延迟对应的样式类
export function getLatencyClass(latencyMs) {
    if (latencyMs === null || latencyMs === undefined) return '';
    if (latencyMs < 100) return 'latency-excellent';
    if (latencyMs < 300) return 'latency-good';
    if (latencyMs < 800) return 'latency-fair';
    return 'latency-poor';
}

// 获取风险等级对应的样式类
export function getRiskClass(riskLevel) {
    if (!riskLevel) return 'risk-unknown';
    switch (riskLevel.toLowerCase()) {
        case 'low':
        case '低风险':
            return 'risk-low';
        case 'medium':
        case '中等风险':
            return 'risk-medium';
        case 'high':
        case '高风险':
            return 'risk-high';
        default:
            return 'risk-unknown';
    }
}

// 获取状态对应的样式类
export function getStatusClass(status) {
    switch (status) {
        case '可用': return 'available';
        case '不可用': return 'unavailable';
        case '测试中': return 'testing';
        case '信息获取失败': return 'error';
        case '未测试':
        default: return 'unknown';
    }
}

// 验证IP地址格式
export function isValidIP(ip) {
    const pattern = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!pattern.test(ip)) return false;
    
    const parts = ip.split('.');
    return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
}

// 验证端口号
export function isValidPort(port) {
    return Number.isInteger(port) && port > 0 && port <= 65535;
}

// 下载文本内容为文件
export function downloadTextFile(content, filename) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
} 