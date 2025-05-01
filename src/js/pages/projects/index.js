import { showToast } from '../../components/toast.js';

// --- 模拟数据 ---
const mockProjects = [
    {
        id: 1,
        name: '每日 Rust 学习挑战',
        description: '每日必做任务，坚持学习Rust，参与社区活动获取积分',
        icon: '<div class="project-icon-circle" style="background-color: #fd7e14;"><i class="fas fa-code"></i></div>',
        type: 'daily',
        project_chain: 'Solana',
        tutorial_project_id: null, // 没有关联教程
        start_date: '2024-07-15',
        tasks: [
            {
                id: 101, project_id: 1, title: '每日签到', description: '完成每日签到以保持活跃度和获取积分', type: 'daily', is_recurring: true, status: 'active'
            },
            {
                id: 104, project_id: 1, title: '完成Rust智能合约开发', description: '使用Rust语言编写基础的链上智能合约', type: 'general', status: 'active'
            },
            {
                id: 105, project_id: 1, title: '参与Solana生态任务', description: '完成Solana测试网交互获取积分', type: 'general', status: 'active'
            },
        ],
        timeline: [
            { date: '2024-07-15', title: '项目启动', description: 'Rust学习挑战正式开始', type: 'milestone', status: 'completed' },
            { date: '2024-07-18', title: '第一阶段学习完成', description: '完成Rust基础语法学习', type: 'past', status: 'completed' },
            { date: '2024-07-25', title: '第二阶段学习', description: '学习Rust内存管理与所有权', type: 'current', status: 'active' },
            { date: '2024-08-05', title: '智能合约实战', description: '使用Rust编写Solana链上智能合约', type: 'future', status: 'upcoming' },
            { date: '2024-08-20', title: '项目结束', description: '完成全部学习任务，获取证书', type: 'milestone', status: 'upcoming' }
        ]
    },
    {
        id: 2,
        name: 'Optimism生态空投',
        description: '参与Optimism生态项目互动，积累空投资格',
        icon: '<div class="project-icon-circle" style="background-color: #ff0420;"><i class="fas fa-parachute-box"></i></div>',
        type: 'timed',
        project_chain: 'Optimism',
        tutorial_project_id: 55, // 假设关联教程中心 ID 为 55 的项目
        tutorial_link: '#', // 教程链接（实际应从教程中心获取）
        tutorial_name: 'Optimism桥接与交互教程', // 教程名称
        start_date: '2024-07-01',
        tasks: [
            {
                id: 103, project_id: 2, title: '教程更新：Optimism新协议', description: '关联的教程已更新，学习如何与新协议交互', type: 'tutorial_update', status: 'active', created_by_system: true
            },
            {
                id: 106, project_id: 2, title: '跨链桥接资产', description: '通过官方桥接资产到Optimism网络', type: 'general', status: 'active'
            },
            {
                id: 107, project_id: 2, title: '与DEX交互', description: '在Optimism上与DEX进行交互累积交互次数', type: 'general', status: 'active'
            },
        ],
        timeline: [
            { date: '2024-07-01', title: '空投活动开始', description: 'Optimism生态空投活动正式开始', type: 'milestone', status: 'completed' },
            { date: '2024-07-12', title: '跨链桥交互', description: '完成资产跨链桥接到Optimism网络', type: 'past', status: 'completed' },
            { date: '2024-07-22', title: 'DEX交互截止', description: '与DEX交互任务最后期限', type: 'current', status: 'active' },
            { date: '2024-07-28', title: 'NFT铸造开启', description: 'Optimism生态NFT限时铸造开始', type: 'future', status: 'upcoming' },
            { date: '2024-08-10', title: '快照时间', description: '活动参与资格快照', type: 'milestone', status: 'upcoming' },
            { date: '2024-09-15', title: '空投发放', description: '预计空投代币发放时间', type: 'milestone', status: 'upcoming' }
        ]
    },
    {
        id: 3,
        name: 'Base 生态空投活动',
        description: '参与Base生态项目互动，积累空投资格，限时活动',
        icon: '<div class="project-icon-circle" style="background-color: #0052ff;"><i class="fas fa-rocket"></i></div>',
        type: 'timed',
        project_chain: 'Base',
        tutorial_project_id: null,
        start_date: '2024-07-10',
        tasks: [
            {
                id: 102, project_id: 3, title: '限时活动：Base交互', description: '在截止日期前进行指定次数的链上交互以获取空投资格', type: 'timed', status: 'active', start_time: '2024-08-01 00:00:00', end_time: '2024-08-15 23:59:59'
            },
            {
                id: 109, project_id: 3, title: '交易额达标', description: '累计交易额达到100美元', type: 'general', status: 'active'
            }
        ],
        timeline: [
            { date: '2024-07-10', title: '项目启动', description: 'Base生态空投活动开始', type: 'milestone', status: 'completed' },
            { date: '2024-07-20', title: '首次交互', description: '完成首次链上交互', type: 'past', status: 'completed' },
            { date: '2024-08-01', title: '限时交互活动开始', description: '完成指定次数交互任务开始', type: 'future', status: 'upcoming' },
            { date: '2024-08-15', title: '限时交互活动结束', description: '完成指定次数交互任务截止', type: 'milestone', status: 'upcoming' },
            { date: '2024-09-01', title: '空投资格审核', description: '项目方审核参与资格', type: 'future', status: 'upcoming' },
            { date: '2024-10-15', title: '预计空投', description: '预计代币空投时间', type: 'milestone', status: 'upcoming' }
        ]
    },
    {
        id: 4,
        name: 'Arbitrum NFT铸造',
        description: '参与Arbitrum NFT项目铸造，限时特惠',
        icon: '<div class="project-icon-circle" style="background-color: #28a745;"><i class="fas fa-image"></i></div>',
        type: 'daily',
        project_chain: 'Arbitrum',
        tutorial_project_id: null,
        start_date: '2024-07-25',
        tasks: [
            {
                id: 110, project_id: 4, title: '每日签到', description: '完成每日签到获取积分', type: 'daily', status: 'active'
            },
            {
                id: 111, project_id: 4, title: 'NFT铸造', description: '完成指定NFT的铸造', type: 'general', status: 'active'
            }
        ],
        timeline: [
            { date: '2024-07-25', title: '项目启动', description: 'Arbitrum NFT铸造项目开始', type: 'milestone', status: 'completed' },
            { date: '2024-07-28', title: '白名单开放', description: '白名单用户可以铸造NFT', type: 'current', status: 'active' },
            { date: '2024-08-01', title: '公开铸造', description: '所有用户可以铸造NFT', type: 'future', status: 'upcoming' },
            { date: '2024-08-10', title: '铸造结束', description: 'NFT铸造活动结束', type: 'milestone', status: 'upcoming' },
            { date: '2024-08-15', title: 'NFT交易开放', description: 'NFT可以在二级市场交易', type: 'future', status: 'upcoming' }
        ]
    }
];

// --- 本地打卡记录 (模拟) ---
// 实际应从本地数据库读取
// key: `task_${taskId}_date_${completionDate}` or similar
const mockLocalCheckIns = {
    'task_101_date_2024-07-30': true, // 假设 ID 101 的任务在 7月30号已打卡
    'task_110_date_2024-07-30': true, // 假设 ID 110 的任务在 7月30号已打卡
};

// --- DOM 元素引用 ---
let projectListContainer = null;
let projectDetailPanel = null;
let projectDetailPlaceholder = null;
let projectDetailContent = null;
let detailProjectIcon = null;
let detailProjectName = null;
let detailProjectDescription = null;
let detailTutorialLinkArea = null;
let detailTutorialLink = null;
let taskListContainer = null;
let projectTimelineContainer = null;
let checkInCalendar = null;
let searchInput = null;
let refreshBtn = null;

// --- 初始化函数 ---
document.addEventListener('DOMContentLoaded', () => {
    console.log('项目跟踪页面 DOM 加载完成');
    initializeProjectPage();
});

function initializeProjectPage() {
    // 获取 DOM 元素
    projectListContainer = document.getElementById('project-list-container');
    projectDetailPanel = document.querySelector('.project-detail-panel');
    projectDetailPlaceholder = document.getElementById('project-detail-placeholder');
    projectDetailContent = document.getElementById('project-detail-content');
    detailProjectIcon = document.getElementById('detail-project-icon');
    detailProjectName = document.getElementById('detail-project-name');
    detailProjectDescription = document.getElementById('detail-project-description');
    detailTutorialLinkArea = document.getElementById('detail-tutorial-link-area');
    detailTutorialLink = document.getElementById('detail-tutorial-link');
    taskListContainer = document.getElementById('task-list-container');
    projectTimelineContainer = document.getElementById('project-timeline');
    checkInCalendar = document.getElementById('check-in-calendar');
    searchInput = document.getElementById('project-search-input');
    refreshBtn = document.getElementById('refresh-projects-btn');

    if (!projectListContainer || !projectDetailPanel || !projectDetailPlaceholder || !projectDetailContent || !taskListContainer || !projectTimelineContainer || !checkInCalendar) {
        console.error('项目跟踪页面核心 DOM 元素未能完全加载!');
        showToast('页面加载失败，请尝试刷新', 'error');
        return;
    }

    // 添加事件监听器
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadAndRenderProjects);
    }
    if (searchInput) {
        // 可选: 添加搜索事件监听
        searchInput.addEventListener('input', handleSearch);
    }

    // 绑定项目列表点击事件 (使用事件委托)
    projectListContainer.addEventListener('click', (event) => {
        const listItem = event.target.closest('.project-list-item');
        if (listItem) {
            const projectId = parseInt(listItem.dataset.projectId, 10);
            selectProject(projectId);
        }
    });

    // 绑定任务列表点击事件 (用于打卡按钮)
    taskListContainer.addEventListener('click', (event) => {
        const checkInButton = event.target.closest('.btn-daily-checkin:not(.disabled)');
        if (checkInButton) {
            const taskItem = checkInButton.closest('.task-item');
            const taskId = parseInt(taskItem.dataset.taskId, 10);
            handleDailyCheckIn(taskId, checkInButton);
        }
        // 这里可以添加处理其他任务按钮的逻辑，例如 '标记完成' 等
    });

    // 初始加载数据
    loadAndRenderProjects();

    // 初始化日历 (暂缓)
    initializeCalendarPlaceholder();

    console.log('项目跟踪页面初始化完成');
}

// --- 数据加载与渲染 ---
function loadAndRenderProjects() {
    console.log('加载并渲染项目列表...');
    if (!projectListContainer) {
        console.error('Project list container not found during load/render!');
        return;
    }
    // TODO: 实际应从服务器 API 获取数据
    const projects = mockProjects;
    renderProjectList(projects);
    // 默认不选中任何项目
    showPlaceholder();
}

function renderProjectList(projects) {
    if (!projectListContainer) return;

    projectListContainer.innerHTML = ''; // 清空列表
    if (!projects || projects.length === 0) {
        projectListContainer.innerHTML = '<p class="empty-message">未找到任何跟踪项目。</p>';
        return;
    }

    projects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'project-list-item';
        item.dataset.projectId = project.id;

        // 添加链标识
        const chainBadge = project.project_chain ? 
            `<span class="chain-badge" style="font-size: 11px; margin-left: 5px; background: rgba(0,0,0,0.1); padding: 1px 5px; border-radius: 3px;">${project.project_chain}</span>` : '';

        // 计算状态或任务提示
        let statusIndicator = '';
        let statusBadge = '';
        
        // 根据项目类型添加不同的状态指示器
        if (project.type === 'daily') {
            const dailyTask = project.tasks.find(t => t.type === 'daily');
            if (dailyTask) {
                const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
                const checkInKey = `task_${dailyTask.id}_date_${today}`;
                if (mockLocalCheckIns[checkInKey]) {
                    statusBadge = '<span class="status-badge status-checked">已打卡</span>';
                } else {
                    statusBadge = '<span class="status-badge status-daily">待打卡</span>';
                }
            }
        } else if (project.type === 'timed') {
            const timedTask = project.tasks.find(t => t.type === 'timed');
            if (timedTask && timedTask.end_time) {
                const endDate = new Date(timedTask.end_time);
                const now = new Date();
                const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
                
                if (daysLeft > 0) {
                    statusBadge = `<span class="status-badge" style="background: #fd7e14;">剩${daysLeft}天</span>`;
                } else {
                    statusBadge = '<span class="status-badge" style="background: #868e96;">已结束</span>';
                }
            }
        }
        
        // 检查是否有教程更新
        if (project.tasks.some(t => t.type === 'tutorial_update')) {
            statusBadge = '<span class="status-badge status-update">更新</span>';
        }

        item.innerHTML = `
            <div class="project-info">
                ${project.icon || '<div class="project-icon-circle" style="background-color: #adb5bd;"><i class="fas fa-question-circle"></i></div>'}
                <span class="project-name">${project.name}${chainBadge}</span>
                ${statusBadge}
            </div>
        `;
        projectListContainer.appendChild(item);
    });
}

function selectProject(projectId) {
    console.log(`选择项目 ID: ${projectId}`);
    if (!projectDetailContent || !projectListContainer) return;

    const project = mockProjects.find(p => p.id === projectId);
    if (!project) {
        console.error(`未找到 ID 为 ${projectId} 的项目数据`);
        showPlaceholder();
        return;
    }

    renderProjectDetails(project);

    // 更新选中样式
    const listItems = projectListContainer.querySelectorAll('.project-list-item');
    listItems.forEach(item => {
        const isSelected = parseInt(item.dataset.projectId, 10) === projectId;
        item.classList.toggle('selected', isSelected);
    });

    // 加载日历数据 (暂缓)
    loadCalendarData(projectId);
}

function renderProjectDetails(project) {
    if (!projectDetailPlaceholder || !projectDetailContent || !detailProjectIcon || !detailProjectName || !detailProjectDescription || !detailTutorialLinkArea || !detailTutorialLink) return;

    // 显示详情区域，隐藏占位符
    projectDetailPlaceholder.classList.add('hidden');
    projectDetailContent.classList.remove('hidden');

    // 填充项目信息
    detailProjectIcon.innerHTML = project.icon || '<div class="project-icon-circle" style="background-color: #adb5bd;"><i class="fas fa-question-circle"></i></div>';
    detailProjectName.textContent = project.name;
    detailProjectName.dataset.projectId = project.id;
    detailProjectDescription.textContent = project.description;

    // 如果有链信息，添加标签
    if (project.project_chain) {
        detailProjectName.innerHTML = `${project.name} <span class="chain-tag" style="font-size: 14px; background: #f8f9fa; color: #495057; padding: 3px 8px; border-radius: 4px; margin-left: 10px;">${project.project_chain}</span>`;
    }

    // 处理关联教程链接
    if (project.tutorial_project_id && project.tutorial_name) {
        detailTutorialLinkArea.classList.remove('hidden');
        detailTutorialLink.textContent = project.tutorial_name;
        detailTutorialLink.href = project.tutorial_link || '#'; // 使用模拟链接
    } else {
        detailTutorialLinkArea.classList.add('hidden');
    }

    // 渲染任务列表
    renderTaskList(project.tasks || []);

    // 渲染项目时间轴
    renderProjectTimeline(project.timeline || [], project.start_date);
}

function renderTaskList(tasks) {
    if (!taskListContainer) return;

    taskListContainer.innerHTML = ''; // 清空
    if (!tasks || tasks.length === 0) {
        taskListContainer.innerHTML = '<p class="empty-message">该项目暂无任务。</p>';
        return;
    }

    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        taskItem.dataset.taskId = task.id;
        taskItem.dataset.taskType = task.type;

        let iconHtml = '';
        let taskTypeClass = '';
        let actionButtonHtml = '';

        // 根据任务类型设置不同的图标和样式
        switch (task.type) {
            case 'daily':
                iconHtml = '<div class="task-icon"><i class="fas fa-calendar-day"></i></div>';
                taskTypeClass = 'daily-task';
                const today = new Date().toISOString().split('T')[0];
                const checkInKey = `task_${task.id}_date_${today}`;
                if (mockLocalCheckIns[checkInKey]) {
                    actionButtonHtml = `
                        <button class="btn btn-secondary btn-small btn-daily-checkin disabled" disabled>
                             <i class="fas fa-check-circle"></i> 今日已打卡
                         </button>`;
                } else {
                    actionButtonHtml = `
                        <button class="btn btn-success btn-small btn-daily-checkin">
                             <i class="fas fa-check"></i> 今日打卡
                         </button>`;
                }
                break;
            case 'timed':
                iconHtml = '<div class="task-icon"><i class="fas fa-stopwatch"></i></div>';
                taskTypeClass = 'timed-task';
                actionButtonHtml = '<button class="btn btn-primary btn-small"><i class="fas fa-arrow-right"></i> 查看详情</button>';
                break;
            case 'tutorial_update':
                iconHtml = '<div class="task-icon"><i class="fas fa-book-open"></i></div>';
                taskTypeClass = 'tutorial-update-task';
                actionButtonHtml = '<button class="btn btn-info btn-small"><i class="fas fa-external-link-alt"></i> 查看教程</button>';
                break;
            case 'general':
            default:
                iconHtml = '<div class="task-icon"><i class="fas fa-tasks"></i></div>';
                taskTypeClass = 'general-task';
                actionButtonHtml = '<button class="btn btn-outline-secondary btn-small mark-complete-btn"><i class="far fa-square"></i> 标记完成</button>';
                break;
        }

        taskItem.classList.add(taskTypeClass);

        let deadlineHtml = '';
        if (task.type === 'timed' && task.end_time) {
            const deadline = new Date(task.end_time);
            const now = new Date();
            const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
            
            let deadlineStyle = daysLeft <= 3 ? 'color: #e03131; font-weight: bold;' : '';
            deadlineHtml = `<p class="task-deadline" style="${deadlineStyle}"><i class="fas fa-clock"></i> 截止: ${new Date(task.end_time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'})}</p>`;
        }

        const descriptionHtml = task.description ? `<p class="task-description">${task.description}</p>` : '';

        taskItem.innerHTML = `
            ${iconHtml}
            <div class="task-content">
                <div class="task-title">${task.title}</div>
                ${descriptionHtml}
                ${deadlineHtml}
            </div>
            <div class="task-actions">${actionButtonHtml}</div>
        `;
        taskListContainer.appendChild(taskItem);
    });
}

function showPlaceholder() {
    projectDetailPlaceholder.classList.remove('hidden');
    projectDetailContent.classList.add('hidden');
}

// --- 事件处理 ---
function handleSearch(event) {
    const searchTerm = event.target.value.toLowerCase();
    const projects = mockProjects.filter(p => 
        p.name.toLowerCase().includes(searchTerm) || 
        p.project_chain?.toLowerCase().includes(searchTerm)
    );
    renderProjectList(projects);
}

function handleDailyCheckIn(taskId, buttonElement) {
    console.log(`尝试为任务 ${taskId} 打卡`);
    const today = new Date().toISOString().split('T')[0];
    const checkInKey = `task_${taskId}_date_${today}`;

    if (mockLocalCheckIns[checkInKey]) {
        showToast('今天已经打过卡了', 'warning');
        return;
    }

    // TODO: 实际应写入本地数据库
    mockLocalCheckIns[checkInKey] = true;
    console.log(`任务 ${taskId} 于 ${today} 打卡成功 (模拟)`);
    showToast('打卡成功！', 'success');

    // 更新按钮状态
    buttonElement.classList.remove('btn-success');
    buttonElement.classList.add('btn-secondary', 'disabled');
    buttonElement.disabled = true;
    buttonElement.innerHTML = '<i class="fas fa-check-circle"></i> 今日已打卡';

    // 尝试更新左侧列表状态
    try {
        const taskItem = buttonElement.closest('.task-item');
        const projectId = parseInt(document.getElementById('detail-project-name').dataset.projectId, 10);
        if (projectId) {
             const projectListItem = projectListContainer.querySelector(`.project-list-item[data-project-id="${projectId}"]`);
             if (projectListItem) {
                 const statusBadge = projectListItem.querySelector('.status-badge');
                 if (statusBadge) {
                      statusBadge.className = 'status-badge status-checked';
                      statusBadge.textContent = '已打卡';
                 }
             }
        }
    } catch (error) {
        console.error("更新左侧列表打卡状态时出错:", error);
    }

    // 更新日历 (暂缓)
    updateCalendarMark(taskId, today);
}

// --- 日历相关 (占位符) ---
function initializeCalendarPlaceholder() {
    // TODO: 集成日历库 (如 FullCalendar)
    checkInCalendar.innerHTML = '<p class="placeholder-text">日历功能待实现...</p>';
}

function loadCalendarData(projectId) {
    console.log(`加载项目 ${projectId} 的日历打卡数据...`);
    // TODO: 从本地数据库查询与该项目相关的 'local_task_records'
    // 模拟：假设查询到一些数据
    const projectTasks = mockProjects.find(p => p.id === projectId)?.tasks || [];
    const dailyTaskIds = projectTasks.filter(t => t.type === 'daily').map(t => t.id);

    const checkInDataForCalendar = [];
    for (const key in mockLocalCheckIns) {
        if (mockLocalCheckIns[key]) {
            const parts = key.split('_'); // task_101_date_2024-07-30
            if (parts.length === 4 && parts[0] === 'task' && parts[2] === 'date') {
                const taskId = parseInt(parts[1], 10);
                const date = parts[3];
                if (dailyTaskIds.includes(taskId)) {
                    checkInDataForCalendar.push({ date: date, taskId: taskId });
                }
            }
        }
    }
    console.log('模拟获取到的日历数据:', checkInDataForCalendar);
    // TODO: 使用 checkInDataForCalendar 更新日历显示
}

function updateCalendarMark(taskId, date) {
    console.log(`更新日历标记：任务 ${taskId} 于 ${date} 完成`);
    // TODO: 调用日历库 API 更新指定日期的显示
}

// --- 项目时间轴渲染 ---
function renderProjectTimeline(timelineEvents, startDate) {
    if (!projectTimelineContainer) return;

    projectTimelineContainer.innerHTML = '';
    
    if (!timelineEvents || timelineEvents.length === 0) {
        projectTimelineContainer.innerHTML = '<p class="timeline-empty">该项目暂无时间轴信息</p>';
        return;
    }

    // 如果有开始日期但没有在时间轴中，添加一个项目开始事件
    let hasStartEvent = timelineEvents.some(event => 
        event.type === 'milestone' && event.title.includes('启动') || event.title.includes('开始'));
    
    if (startDate && !hasStartEvent) {
        timelineEvents.unshift({
            date: startDate,
            title: '项目启动',
            description: '项目正式开始',
            type: 'milestone',
            status: 'completed'
        });
    }

    // 按日期排序（倒序 - 最新的在前面）
    timelineEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    timelineEvents.forEach(event => {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';

        // 创建时间轴标记点
        let iconHtml = '';
        let markerClass = '';
        
        // 根据事件类型设置不同的图标和样式
        if (event.type === 'milestone') {
            iconHtml = '<i class="fas fa-flag"></i>';
            markerClass = 'milestone';
        } else if (event.status === 'completed' || event.type === 'past') {
            iconHtml = '<i class="fas fa-check"></i>';
            markerClass = 'completed';
        } else if (event.status === 'active' || event.type === 'current') {
            iconHtml = '<i class="fas fa-circle"></i>';
            markerClass = 'current';
        } else {
            iconHtml = '<i class="fas fa-clock"></i>';
            markerClass = 'future';
        }

        // 获取日期并格式化
        const eventDate = new Date(event.date);
        const formattedDate = eventDate.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // 判断是否是当前日期附近的事件
        const today = new Date();
        const isCurrentPeriod = Math.abs(eventDate - today) / (1000 * 60 * 60 * 24) < 3;
        
        // 创建状态标签
        let statusHtml = '';
        if (event.status) {
            const statusText = {
                'completed': '已完成',
                'active': '进行中',
                'upcoming': '即将开始'
            }[event.status] || event.status;
            
            statusHtml = `<span class="timeline-status ${event.status}">${statusText}</span>`;
        }

        timelineItem.innerHTML = `
            <div class="timeline-marker ${markerClass}">
                ${iconHtml}
            </div>
            <div class="timeline-content">
                <div class="timeline-date">
                    <i class="fas fa-calendar-alt"></i> ${formattedDate}
                </div>
                <div class="timeline-title">${event.title}</div>
                <div class="timeline-description">${event.description}</div>
                ${statusHtml}
            </div>
        `;

        // 突出显示当前/重要事件
        if (isCurrentPeriod || event.type === 'current' || event.status === 'active') {
            timelineItem.classList.add('current-event');
            timelineItem.querySelector('.timeline-content').style.borderColor = '#4dabf7';
            timelineItem.querySelector('.timeline-content').style.boxShadow = '0 0 0 3px rgba(77, 171, 247, 0.1)';
        }

        projectTimelineContainer.appendChild(timelineItem);
    });
}

// 确保在 navigation.js 或类似地方调用了 initProjectsPage
// 如果是直接加载模板，DOMContentLoaded 监听器会生效
// 如果是通过 loadPage 动态加载，需要确保在加载后调用初始化函数
// 假设 navigation.js 会处理页面加载后的初始化调用

// 补充CSS样式，用于项目图标圆圈
const styleElement = document.createElement('style');
styleElement.textContent = `
    .project-icon-circle {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        justify-content: center;
        align-items: center;
        color: white;
        margin-right: 10px;
    }
    
    .chain-tag {
        display: inline-block;
        font-size: 12px;
        font-weight: normal;
    }
`;
document.head.appendChild(styleElement);

// 导出，如果 navigation.js 需要导入并调用
export function initProjectsPage() {
    console.log('尝试初始化项目跟踪页面...');
    initializeProjectPage();
} 