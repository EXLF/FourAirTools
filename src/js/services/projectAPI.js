/**
 * @fileoverview 项目API服务
 * @module services/projectAPI
 * @description 提供项目相关的API调用功能
 */

// API配置
const API_CONFIG = {
    baseURL: window.API_BASE_URL || 'https://api.fourair.com/v1',
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    }
};

/**
 * 创建API请求
 * @param {string} endpoint - API端点
 * @param {Object} options - 请求选项
 * @returns {Promise<Response>} 响应对象
 */
async function apiRequest(endpoint, options = {}) {
    const url = `${API_CONFIG.baseURL}${endpoint}`;
    const config = {
        ...options,
        headers: {
            ...API_CONFIG.headers,
            ...options.headers
        }
    };
    
    // 添加认证令牌（如果存在）
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // 设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout);
    
    try {
        const response = await fetch(url, {
            ...config,
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === 'AbortError') {
            throw new Error('请求超时');
        }
        
        throw error;
    }
}

/**
 * 获取项目列表
 * @param {Object} params - 查询参数
 * @returns {Promise<Array>} 项目列表
 */
export async function getProjects(params = {}) {
    try {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = `/projects${queryString ? '?' + queryString : ''}`;
        
        const response = await apiRequest(endpoint);
        const data = await response.json();
        
        return data.projects || [];
    } catch (error) {
        console.error('获取项目列表失败:', error);
        
        // 如果API失败，返回模拟数据
        return getMockProjects();
    }
}

/**
 * 获取模拟项目数据
 * @returns {Array} 模拟项目列表
 */
function getMockProjects() {
    return [
        {
            id: 1,
            name: 'Linea Park',
            description: 'Linea生态活动，每日登录打卡领取积分',
            icon: '<div class="project-icon-circle" style="background-color: #4dabf7;"><i class="fas fa-cube"></i></div>',
            project_chain: 'Linea',
            type: 'daily',
            start_date: '2024-07-01',
            tutorial_project_id: 101,
            tutorial_name: 'Linea Park 详细教程',
            tutorial_link: '#',
            tasks: [
                {
                    id: 101,
                    title: '每日登录打卡',
                    description: '访问Linea Park网站并登录账户，完成每日签到获取积分',
                    type: 'daily',
                    start_time: '2024-07-01',
                    end_time: null
                }
            ],
            timeline: [
                {
                    date: '2024-07-01',
                    title: '活动开始',
                    description: 'Linea Park活动正式启动',
                    type: 'milestone',
                    status: 'completed'
                }
            ]
        }
    ];
} 