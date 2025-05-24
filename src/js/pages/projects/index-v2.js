/**
 * @fileoverview 项目页面初始化 V2 - 使用projectStore进行状态管理
 * @module pages/projects/index-v2
 */

import { projectManager } from './projectManager.js';
import { projectStore } from '../../stores/projectStore.js';
import { showToast } from '../../components/toast.js';

/**
 * 初始化项目页面（使用Store版本）
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export async function initProjectsPageV2(contentArea) {
    console.log('[ProjectsV2] 开始初始化项目页面...');

    // 渲染初始UI
    renderPageStructure(contentArea);

    // 缓存DOM元素
    const elements = {
        contentArea: contentArea,
        projectListContainer: contentArea.querySelector('#project-list-container'),
        projectDetailPanel: contentArea.querySelector('.project-detail-panel'),
        projectDetailPlaceholder: contentArea.querySelector('#project-detail-placeholder'),
        projectDetailContent: contentArea.querySelector('#project-detail-content'),
        detailProjectIcon: contentArea.querySelector('#detail-project-icon'),
        detailProjectName: contentArea.querySelector('#detail-project-name'),
        detailProjectDescription: contentArea.querySelector('#detail-project-description'),
        detailTutorialLinkArea: contentArea.querySelector('#detail-tutorial-link-area'),
        detailTutorialLink: contentArea.querySelector('#detail-tutorial-link'),
        taskListContainer: contentArea.querySelector('#task-list-container'),
        projectTimelineContainer: contentArea.querySelector('#project-timeline'),
        checkInCalendar: contentArea.querySelector('#check-in-calendar'),
        searchInput: contentArea.querySelector('#project-search-input'),
        refreshBtn: contentArea.querySelector('#refresh-projects-btn'),
        chainFilter: contentArea.querySelector('#chain-filter'),
        typeFilter: contentArea.querySelector('#type-filter')
    };

    // 检查必要元素
    if (!validateElements(elements)) {
        return;
    }

    // 初始化项目管理器
    await projectManager.initialize(elements);

    // 设置事件监听
    setupEventListeners(contentArea, elements);

    // 设置筛选器
    setupFilters(elements);

    console.log('[ProjectsV2] 项目页面初始化完成');
}

/**
 * 渲染页面结构
 */
function renderPageStructure(contentArea) {
    contentArea.innerHTML = `
        <div class="projects-page">
            <div class="page-header">
                <h1>项目跟踪</h1>
                <p>管理您的空投项目，跟踪任务进度和打卡记录</p>
                <div class="header-actions">
                    <button id="refresh-projects-btn" class="btn btn-secondary">
                        <i class="fas fa-sync-alt"></i> 刷新
                    </button>
                </div>
            </div>

            <div class="projects-container">
                <!-- 左侧项目列表 -->
                <div class="project-list-panel">
                    <div class="panel-header">
                        <h3>项目列表</h3>
                        <div class="search-box">
                            <i class="fas fa-search"></i>
                            <input type="text" id="project-search-input" placeholder="搜索项目...">
                        </div>
                    </div>
                    
                    <div class="filter-section">
                        <select id="chain-filter" class="filter-select">
                            <option value="all">所有链</option>
                            <option value="Solana">Solana</option>
                            <option value="Ethereum">Ethereum</option>
                            <option value="Optimism">Optimism</option>
                            <option value="Base">Base</option>
                            <option value="Arbitrum">Arbitrum</option>
                        </select>
                        <select id="type-filter" class="filter-select">
                            <option value="all">所有类型</option>
                            <option value="daily">每日任务</option>
                            <option value="timed">限时任务</option>
                        </select>
                    </div>
                    
                    <div id="project-list-container" class="project-list">
                        <!-- 项目列表将在这里渲染 -->
                    </div>
                </div>

                <!-- 右侧项目详情 -->
                <div class="project-detail-panel">
                    <!-- 占位符 -->
                    <div id="project-detail-placeholder" class="detail-placeholder">
                        <i class="fas fa-folder-open" style="font-size: 48px; color: #dee2e6; margin-bottom: 16px;"></i>
                        <p>选择一个项目查看详情</p>
                    </div>

                    <!-- 项目详情内容 -->
                    <div id="project-detail-content" class="detail-content hidden">
                        <!-- 项目信息 -->
                        <div class="project-info-section">
                            <div class="project-header">
                                <div id="detail-project-icon" class="project-icon"></div>
                                <div class="project-meta">
                                    <h2 id="detail-project-name"></h2>
                                    <p id="detail-project-description"></p>
                                    <div id="detail-tutorial-link-area" class="tutorial-link-area hidden">
                                        <i class="fas fa-book"></i>
                                        <a href="#" id="detail-tutorial-link" target="_blank">查看相关教程</a>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 任务列表 -->
                        <div class="tasks-section">
                            <h3>任务列表</h3>
                            <div id="task-list-container" class="task-list">
                                <!-- 任务列表将在这里渲染 -->
                            </div>
                        </div>

                        <!-- 项目时间轴 -->
                        <div class="timeline-section">
                            <h3>项目时间轴</h3>
                            <div id="project-timeline" class="timeline">
                                <!-- 时间轴将在这里渲染 -->
                            </div>
                        </div>

                        <!-- 打卡日历 -->
                        <div class="calendar-section">
                            <h3>打卡记录</h3>
                            <div id="check-in-calendar" class="calendar-container">
                                <!-- 日历将在这里渲染 -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * 验证必要的DOM元素
 */
function validateElements(elements) {
    const required = [
        'projectListContainer', 
        'projectDetailPanel',
        'projectDetailPlaceholder',
        'projectDetailContent',
        'taskListContainer',
        'projectTimelineContainer',
        'checkInCalendar'
    ];
    
    for (const key of required) {
        if (!elements[key]) {
            console.error(`[ProjectsV2] 缺少必要元素: ${key}`);
            elements.contentArea.innerHTML = `
                <div style="color: red; padding: 20px; text-align: center;">
                    页面加载错误：缺少关键元素
                </div>
            `;
            return false;
        }
    }

    return true;
}

/**
 * 设置事件监听器
 */
function setupEventListeners(contentArea, elements) {
    // 刷新按钮
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', async () => {
            elements.refreshBtn.disabled = true;
            elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 刷新中...';
            
            await projectManager.loadInitialData();
            
            elements.refreshBtn.disabled = false;
            elements.refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新';
            showToast('项目列表已刷新', 'success');
        });
    }

    // 项目列表点击事件（事件委托）
    elements.projectListContainer.addEventListener('click', (e) => {
        const listItem = e.target.closest('.project-list-item');
        if (listItem) {
            const projectId = parseInt(listItem.dataset.projectId, 10);
            projectStore.selectProject(projectId);
        }
    });

    // 任务列表点击事件（事件委托）
    elements.taskListContainer.addEventListener('click', (e) => {
        // 每日打卡按钮
        const checkInBtn = e.target.closest('.btn-daily-checkin:not(.disabled)');
        if (checkInBtn) {
            const taskId = parseInt(checkInBtn.dataset.taskId, 10);
            projectManager.handleDailyCheckIn(taskId);
            return;
        }

        // 标记完成按钮
        const completeBtn = e.target.closest('.mark-complete-btn:not(:disabled)');
        if (completeBtn) {
            const taskId = parseInt(completeBtn.dataset.taskId, 10);
            projectManager.handleTaskComplete(taskId);
            return;
        }

        // 查看详情按钮
        const detailBtn = e.target.closest('.btn-primary[data-task-id]');
        if (detailBtn) {
            const taskId = parseInt(detailBtn.dataset.taskId, 10);
            showTaskDetails(taskId);
            return;
        }
    });

    // 监听自定义事件
    contentArea.addEventListener('project:statsUpdated', (e) => {
        updateProjectStats(e.detail);
    });
}

/**
 * 设置筛选器
 */
function setupFilters(elements) {
    // 搜索框
    if (elements.searchInput) {
        let searchTimer;
        elements.searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                projectStore.setFilters({ search: e.target.value });
            }, 300);
        });
    }

    // 链筛选
    if (elements.chainFilter) {
        elements.chainFilter.addEventListener('change', (e) => {
            projectStore.setFilters({ chain: e.target.value });
        });
    }

    // 类型筛选
    if (elements.typeFilter) {
        elements.typeFilter.addEventListener('change', (e) => {
            projectStore.setFilters({ type: e.target.value });
        });
    }
}

/**
 * 显示任务详情
 */
function showTaskDetails(taskId) {
    // TODO: 实现任务详情弹窗
    showToast('任务详情功能开发中...', 'info');
}

/**
 * 更新项目统计信息
 */
function updateProjectStats(stats) {
    // 可以在页面上显示统计信息
    console.log('[ProjectsV2] 项目统计更新:', stats);
} 