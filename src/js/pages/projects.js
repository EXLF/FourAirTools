import { setupFilteringAndSearch } from '../components/tableHelper.js';
// import { showModal } from '../components/modal.js'; // 未来可能使用

/**
 * 初始化项目追踪页面。
 * 设置项目卡片的筛选和基本交互监听器。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export function initProjectsPage(contentArea) {
    console.log("Initializing Project Tracking Page..."); // 保留英文日志

    // 设置项目卡片的筛选
    // 项目选择器是 '.project-card'
    setupFilteringAndSearch(contentArea, '.filters-bar', '.project-card', filterProjectCard);

    // 为头部按钮添加监听器
    const refreshBtn = contentArea.querySelector('.header-actions .btn-secondary');
    const addBtn = contentArea.querySelector('.header-actions .btn-primary');

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => alert('刷新项目数据 (未实现)'));
    }
    if (addBtn) {
        addBtn.addEventListener('click', () => alert('添加项目/活动 (未实现)'));
    }

    // 为项目卡片内的操作（例如，活动按钮）设置事件委托
    const projectContainer = contentArea.querySelector('.project-container');
    if (projectContainer) {
        projectContainer.addEventListener('click', handleProjectCardAction);
    }
}

/**
 * 项目卡片的筛选函数。
 * @param {HTMLElement} cardElement - 项目卡片元素。
 * @param {object} filterValues - 包含筛选值的对象。
 *                                例如，{ search: '...', 'project-chain-filter': 'LayerZero', ... }
 * @returns {boolean} - 如果卡片应显示，则返回 true。
 */
function filterProjectCard(cardElement, filterValues) {
    // 从卡片提取数据（使用 data-* 属性或文本内容）
    const chain = cardElement.dataset.chain?.toLowerCase() || '';
    const type = cardElement.dataset.type?.toLowerCase() || '';
    const title = cardElement.querySelector('.project-title h5')?.textContent.toLowerCase() || '';
    const activitiesText = cardElement.querySelector('.activity-list')?.textContent.toLowerCase() || '';
    const searchContent = `${chain} ${type} ${title} ${activitiesText}`;

    // 提取活动状态筛选的数据（更复杂）
    // 需要检查是否有 *任何* 活动匹配状态筛选器
    const activityItems = cardElement.querySelectorAll('.activity-list li');
    let activityStatusMatch = true; // 如果没有状态筛选器或找到匹配项，则显示
    const statusFilter = filterValues['activity-status-filter'] || '';

    if (statusFilter) {
        activityStatusMatch = Array.from(activityItems).some(li => {
            const status = li.dataset.status?.toLowerCase() || '';
            return status === statusFilter;
        });
         // 如果按状态筛选，同时隐藏不包含 *任何* 活动的卡片
         if (activityItems.length === 0) {
             activityStatusMatch = false;
         }
    }

    // 从传递的对象中获取筛选值
    const chainFilter = filterValues['project-chain-filter'] || '';
    const typeFilter = filterValues['project-type-filter'] || '';
    const searchTerm = filterValues.search || '';

    // 应用筛选器
    const chainMatch = !chainFilter || chain.includes(chainFilter.toLowerCase());
    const typeMatch = !typeFilter || type.includes(typeFilter.toLowerCase());
    const searchMatch = !searchTerm || searchContent.includes(searchTerm);

    return chainMatch && typeMatch && searchMatch && activityStatusMatch;
}

/**
 * 处理从项目容器委托的点击事件。
 * 识别项目卡片或活动项内操作按钮的点击。
 * @param {Event} e - 点击事件对象。
 */
function handleProjectCardAction(e) {
    const target = e.target;

    // 检查活动操作按钮的点击（在 li > .actions > .btn-icon 内）
    const activityActionButton = target.closest('.activity-list li .actions .btn-icon');
    if (activityActionButton) {
        const action = activityActionButton.title || '未知操作'; // 'Unknown Action' -> '未知操作'
        const activityItem = activityActionButton.closest('li');
        const activityName = activityItem?.querySelector('span:first-child')?.textContent || '未知活动'; // 'Unknown Activity' -> '未知活动'
        const projectName = activityActionButton.closest('.project-card')?.querySelector('.project-title h5')?.textContent || '未知项目'; // 'Unknown Project' -> '未知项目'

        console.log(`活动操作点击: ${action} on ${activityName} in project ${projectName}`); // 保留英文日志结构，翻译内容

        // 根据操作添加逻辑（例如，'查看详情', '标记完成'）
        if (action === '查看详情') {
            alert(`查看 ${activityName} 的详情 (未实现)`);
            // 可能打开模态框或导航
        } else if (action === '标记完成') {
            if (confirm(`将 ${activityName} 标记为已完成？`)) {
                // 更新 UI（例如，添加勾选标记，更改状态）
                activityItem.dataset.status = 'completed'; // 示例
                activityItem.querySelector('.status-indicator')?.classList.add('completed');
                 // TODO: 持久化此更改
                 alert(`${activityName} 已标记为完成 (前端模拟)`);
            }
        }
        // 添加其他操作处理程序
    }

    // TODO: 如果需要，检查其他卡片元素的点击（例如，标题，展开按钮）
}
