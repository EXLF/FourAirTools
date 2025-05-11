// 脚本列表相关模块
import { getCurrentScriptId } from './state.js';

/**
 * 加载脚本列表
 * @param {HTMLElement} container - 详情页面容器元素
 */
export async function loadScriptList(container) {
    const listContainer = container.querySelector('#scriptListItems');
    if (!listContainer) return;
    
    try {
        // 显示加载提示
        listContainer.innerHTML = '<li class="loading-item">正在加载脚本列表...</li>';
        
        // 从后端获取脚本列表
        const result = await window.scriptAPI.getAllScripts();
        
        if (result && result.success && Array.isArray(result.data)) {
            const scripts = result.data;
            
            if (scripts.length === 0) {
                listContainer.innerHTML = '<li class="empty-item">未找到可用脚本</li>';
                return;
            }
            
            // 渲染脚本列表
            listContainer.innerHTML = scripts.map(script => `
                <li class="script-list-item ${script.id === getCurrentScriptId() ? 'active' : ''}" data-script-id="${script.id}">
                    <div class="script-list-item-content">
                        <span class="script-list-name">${script.name}</span>
                        <span class="script-list-type">${script.category || '未分类'}</span>
                        <span class="script-list-status active">可用</span>
                    </div>
                </li>
            `).join('');
            
            // 绑定脚本列表项点击事件
            const listItems = container.querySelectorAll('.script-list-item');
            listItems.forEach(item => {
                item.addEventListener('click', () => {
                    // 高亮当前选中项
                    listItems.forEach(li => li.classList.remove('active'));
                    item.classList.add('active');
                    
                    // 获取脚本ID并加载详情
                    const scriptId = item.getAttribute('data-script-id');
                    if (scriptId) {
                        window.loadScriptDetail(scriptId);
                    }
                });
            });
        } else {
            listContainer.innerHTML = `<li class="error-item">加载脚本列表失败: ${result ? result.error : '未知错误'}</li>`;
        }
    } catch (error) {
        console.error("加载脚本列表出错:", error);
        listContainer.innerHTML = `<li class="error-item">加载脚本列表时出错: ${error.message}</li>`;
    }
    
    // 脚本列表搜索
    const searchInput = container.querySelector('#scriptListSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            const listItems = container.querySelectorAll('.script-list-item');
            
            listItems.forEach(item => {
                const name = item.querySelector('.script-list-name').textContent.toLowerCase();
                const type = item.querySelector('.script-list-type').textContent.toLowerCase();
                const content = name + ' ' + type;
                
                if (content.includes(searchTerm)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
} 