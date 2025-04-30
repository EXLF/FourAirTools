/**
 * 国家/地区名称映射表
 */
const countryMap = {
    'singapore': '新加坡',
    'china': '中国',
    'japan': '日本',
    'united states': '美国',
    'hong kong': '香港',
    'taiwan': '台湾',
    'south korea': '韩国',
    'thailand': '泰国',
    'vietnam': '越南',
    'malaysia': '马来西亚',
    'indonesia': '印度尼西亚',
    'philippines': '菲律宾',
    'india': '印度',
    'russia': '俄罗斯',
    'germany': '德国',
    'france': '法国',
    'united kingdom': '英国',
    'italy': '意大利',
    'spain': '西班牙',
    'netherlands': '荷兰',
    'brazil': '巴西',
    'canada': '加拿大',
    'australia': '澳大利亚',
    'new zealand': '新西兰'
    // 可以根据需要继续添加更多国家
};

/**
 * 将英文地区名称转换为简化的中文显示
 * @param {string} location - 完整的地区信息字符串
 * @returns {string} 简化的中文地区名称
 */
export function translateLocation(location) {
    if (!location) return '-';
    
    // 将地区字符串转换为小写以进行匹配
    const lowerLocation = location.toLowerCase();
    
    // 遍历国家映射表进行匹配
    for (const [eng, chn] of Object.entries(countryMap)) {
        if (lowerLocation.includes(eng)) {
            return chn;
        }
    }
    
    // 如果没有匹配到任何国家，返回第一个逗号前的内容
    const firstPart = location.split(',')[0].trim();
    return firstPart;
} 