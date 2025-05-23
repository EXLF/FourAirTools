// 批处理脚本类型定义
export const batchScriptTypes = [
    {
        id: 'multi-account-batch',
        name: '多账户批量执行',
        description: '同时在多个账户上执行相同脚本',
        imageUrl: 'https://public.rootdata.com/images/b6/1739179963586.jpg',
        category: '基础功能',
        status: 'active'
    }
];

// 批处理脚本状态定义
export const batchScriptStatuses = [
    { value: '', label: '全部状态' },
    { value: 'active', label: '活跃' },
    { value: 'inactive', label: '未激活' },
    { value: 'testing', label: '测试中' },
    { value: 'maintenance', label: '维护中' },
    { value: 'deprecated', label: '已弃用' }
];

// 模块定义
export const modules = [
    { id: 'simple-config', name: '任务配置', icon: 'fas fa-cogs' }
];

// 模块顺序
export const moduleOrder = [
    'simple-config'
];

// 代理状态样式映射
export const PROXY_STATUS_CLASSES = {
    '可用': 'active',
    'active': 'active',
    'inactive': 'inactive',
    '不可用': 'inactive',
    'testing': 'testing',
    'error': 'error',
    'default': 'unknown'
};

// 代理状态文本映射
export const PROXY_STATUS_TEXT = {
    '可用': '可用',
    'active': '可用',
    'inactive': '不可用',
    '不可用': '不可用',
    'testing': '测试中',
    'error': '错误',
    'default': '未知'
};

// 视图模式
export const VIEW_MODES = {
    CARDS: 'cards',
    MANAGER: 'manager'
};

// 批处理任务配置缓存
export const batchTaskConfigs = {}; 