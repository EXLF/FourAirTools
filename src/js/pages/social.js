import { setupFilteringAndSearch, setupCheckAll } from '../components/tableHelper.js';
import { showModal, hideModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';
import { debounce } from '../utils/index.js'; // 确保导入 debounce
// 这个简单的显示表格暂时不需要表格操作

// 缓存 DOM 元素 - 明确初始化为 null
let contentAreaCache = null;
let addAccountBtn = null;
let tableBody = null;
let paginationControls = null; // 添加分页控件缓存
let currentPage = 1; // 当前页码
let itemsPerPage = 10; // 每页项目数
let totalItems = 0; // 总项目数
let currentFilters = {}; // 新增：存储当前筛选条件
let groupFilterSelect = null; // 新增：缓存分组筛选器元素
let searchInput = null; // 新增：缓存搜索输入框元素
// ... 其他元素待添加 (filters, pagination, etc.)

// ================= 分页逻辑 (从 wallets.js 借鉴和修改) =================

let pageSizeContainer = null; // 缓存页面大小选择器的容器
const LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL = 'socialPage_rowsPerPage'; // 定义 localStorage 键

/**
 * 创建并插入页面大小选择器
 */
function createPageSizeSelector() {
    // 直接查找模板中已存在的容器
    pageSizeContainer = contentAreaCache?.querySelector('.page-size-selector');
    
    if (!pageSizeContainer) {
        console.warn("未找到 .page-size-selector 容器 (来自 social.html 模板)，无法创建页面大小选择器。");
        return;
    }
    
    // 清空容器内容，以防重复添加
    pageSizeContainer.innerHTML = '';
    
    // 创建标签
    const label = document.createElement('span');
    label.textContent = '每页显示: ';
    label.style.marginRight = '8px';

    // 创建下拉框
    const select = document.createElement('select');
    select.className = 'page-size-select';
    select.style.cssText = 'padding: 4px 8px; border-radius: 4px; border: 1px solid #ccc;';

    // 添加选项
    const options = [5, 10, 15, 25, 50, 100];
    options.forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = `${size}条`;
        if (size === itemsPerPage) {
            option.selected = true;
        }
        select.appendChild(option);
    });

    // 添加事件监听器
    select.addEventListener('change', async () => {
        const newSize = parseInt(select.value);
        if (newSize !== itemsPerPage) {
            itemsPerPage = newSize;
            currentPage = 1;
            localStorage.setItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL, newSize.toString());
            await loadAndRenderSocialAccounts(); // 使用正确的加载函数
        }
    });

    // 组装元素到已存在的容器中
    pageSizeContainer.appendChild(label);
    pageSizeContainer.appendChild(select);
    
    // --- 移除所有创建/查找/操作 pagination-controls-wrapper 的逻辑 ---
}

/**
 * 渲染分页控件。
 * @param {number} totalItems - 总记录数。
 * @param {number} itemsPerPage - 每页记录数。
 * @param {number} currentPage - 当前页码。
 */
function renderPagination(totalItems, itemsPerPage, currentPage) {
    paginationControls = contentAreaCache?.querySelector('.pagination');
    if (!paginationControls) {
        console.warn("未找到 .pagination 容器，无法渲染分页控件。");
        return;
    }

    // 更新页面大小选择器的值
    const pageSizeSelect = pageSizeContainer?.querySelector('.page-size-select');
    if (pageSizeSelect && parseInt(pageSizeSelect.value) !== itemsPerPage) {
        pageSizeSelect.value = itemsPerPage.toString();
    }

    paginationControls.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    const pageInfo = document.createElement('span');
    pageInfo.className = 'page-info';
    const displayPage = Math.max(1, currentPage);
    const displayTotalPages = Math.max(1, totalPages);
    pageInfo.textContent = `${displayPage}/${displayTotalPages}页 共${totalItems}条`;
    pageInfo.style.marginRight = '15px';
    paginationControls.appendChild(pageInfo);

    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.innerHTML = '&laquo;';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', async () => {
        if (currentPage > 1) {
            await loadAndRenderSocialAccounts(currentPage - 1); // 使用正确的加载函数
        }
    });
    paginationControls.appendChild(prevButton);

    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
     if (startPage > 1) {
        const firstButton = document.createElement('button'); firstButton.textContent = '1';
        firstButton.addEventListener('click', async () => { 
            await loadAndRenderSocialAccounts(1);
        });
        paginationControls.appendChild(firstButton);
        if (startPage > 2) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; ellipsis.style.padding = '0 10px'; paginationControls.appendChild(ellipsis); }
    }
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button'); pageButton.textContent = i;
        if (i === currentPage) { pageButton.classList.add('active'); }
        const pageNumber = i;
        pageButton.addEventListener('click', async () => { 
            await loadAndRenderSocialAccounts(pageNumber);
        });
        paginationControls.appendChild(pageButton);
    }
     if (endPage < totalPages) {
         if (endPage < totalPages - 1) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; ellipsis.style.padding = '0 10px'; paginationControls.appendChild(ellipsis); }
        const lastButton = document.createElement('button'); lastButton.textContent = totalPages;
        lastButton.addEventListener('click', async () => { 
            await loadAndRenderSocialAccounts(totalPages);
        });
        paginationControls.appendChild(lastButton);
    }

    const nextButton = document.createElement('button');
    nextButton.innerHTML = '&raquo;';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', async () => {
        if (currentPage < totalPages) {
            await loadAndRenderSocialAccounts(currentPage + 1);
        }
    });
    paginationControls.appendChild(nextButton);
}

// ========================================================================

/**
 * 新增：设置平台筛选按钮的监听器
 */
function setupPlatformFilterListeners() {
    const platformButtons = contentAreaCache?.querySelectorAll('.platform-filter-btn');
    if (!platformButtons) return;

    platformButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const platform = button.dataset.platform;
            
            // 如果点击的已经是当前激活的，则不处理 (或根据需求决定是否取消筛选)
            // if (button.classList.contains('active')) return;

            // 更新筛选状态
            currentFilters.platform = platform || null; // 如果 platform 是空字符串，则设为 null 以便后端忽略
            currentPage = 1; // 重置到第一页

            // 更新按钮激活状态
            platformButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            // 重新加载数据
            await loadAndRenderSocialAccounts();
        });
    });
}

/**
 * 新增：设置分组筛选下拉框的监听器
 */
function setupGroupFilterListener() {
    groupFilterSelect = contentAreaCache?.querySelector('#social-group-filter');
    if (!groupFilterSelect) return;

    groupFilterSelect.addEventListener('change', async () => {
        const selectedGroupId = groupFilterSelect.value;
        // 如果值为空字符串 (选择了"所有分组"), 则 groupId 设为 null
        currentFilters.groupId = selectedGroupId ? parseInt(selectedGroupId) : null;
        currentPage = 1; // 重置到第一页
        await loadAndRenderSocialAccounts(); // 重新加载数据
    });
}

/**
 * 新增：加载并填充分组筛选器下拉菜单
 */
async function loadGroupFiltersForSocial() {
    const groupFilterSelect = contentAreaCache?.querySelector('#social-group-filter');
    if (!groupFilterSelect) {
        console.warn("未找到分组筛选器 (#social-group-filter)，无法加载分组。");
        return;
    }

    try {
        const groups = await window.dbAPI.getGroups();
        groupFilterSelect.innerHTML = '<option value="">所有分组</option>'; // 保留"所有分组"选项
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id; // 使用分组 ID 作为值
            option.textContent = group.name;
            groupFilterSelect.appendChild(option);
        });
    } catch (error) {
        console.error("加载分组筛选器失败:", error);
        // 可以在下拉框中显示错误或使用 Toast 提示
        groupFilterSelect.innerHTML = '<option value="">加载分组失败</option>';
    }
}

/**
 * 新增：设置搜索框的监听器
 */
function setupSearchListener() {
    searchInput = contentAreaCache?.querySelector('.table-search-input');
    if (!searchInput) return;

    // 使用 debounce 包装实际的搜索逻辑
    const debouncedSearch = debounce(async () => {
        currentFilters.search = searchInput.value.trim();
        currentPage = 1; // 重置到第一页
        await loadAndRenderSocialAccounts(); // 重新加载数据
    }, 300); // 延迟 300 毫秒

    searchInput.addEventListener('input', debouncedSearch);
}

/**
 * 初始化社交账户页面。
 * 设置筛选、全选和头部按钮。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export async function initSocialPage(contentArea) {
    // --- 从 localStorage 加载每页显示条数 (移到这里) ---
    const savedRowsPerPage = localStorage.getItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL);
    if (savedRowsPerPage) {
        itemsPerPage = parseInt(savedRowsPerPage, 10);
        const validOptions = [5, 10, 15, 25, 50, 100];
        if (!validOptions.includes(itemsPerPage)) {
            itemsPerPage = 10; // 如果无效，重置为默认值
            localStorage.removeItem(LOCAL_STORAGE_KEY_ROWS_PER_PAGE_SOCIAL);
        }
    } else {
        itemsPerPage = 10; // 确保在没有 localStorage 值时也有默认值
    }
    // --- ------------------------------------------ ---

    console.log("正在初始化社交账户页面..."); // 控制台日志也中文化
    contentAreaCache = contentArea;

    addAccountBtn = contentArea.querySelector('.header-actions .btn-primary'); // 基于模板结构查找添加按钮
    tableBody = contentArea.querySelector('.social-table tbody');
    paginationControls = contentArea.querySelector('.pagination');

    if (!addAccountBtn || !tableBody) {
        console.error("社交账户页面缺少必要的 DOM 元素！");
        return;
    }

    // 检查 dbAPI
    if (typeof window.dbAPI === 'undefined') {
        console.error("错误: window.dbAPI 未定义!");
        tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px; color: red;">应用程序配置错误，无法访问数据库。</td></tr>'; // Colspan 设为 7 (6 列 + 操作列)
        return;
    }

    // 为添加账户按钮添加监听器 - 调用时不带参数表示添加模式
    addAccountBtn.addEventListener('click', () => openSocialAccountModal());

    // 先加载数据，确保分页控件已创建
    await loadAndRenderSocialAccounts();
    
    // 然后创建页面大小选择器
    createPageSizeSelector();

    // 设置平台筛选监听器
    setupPlatformFilterListeners();

    // 设置分组筛选监听器
    setupGroupFilterListener();

    // 设置搜索监听器
    setupSearchListener();

    // 加载分组过滤器选项
    await loadGroupFiltersForSocial();

    // 设置全选功能
    setupCheckAll(contentAreaCache, '.social-table'); // 添加调用

    // --- 添加：点击行内空白区域切换复选框 (借鉴 wallets.js) ---
    if (tableBody) {
        tableBody.addEventListener('click', (event) => {
            const target = event.target;
            const row = target.closest('tr');
            if (!row || !row.dataset.accountId) return; // 点击的不是包含账户ID的表格行内

            // 检查是否点击在操作按钮、按钮图标、链接或复选框本身
            if (target.tagName === 'BUTTON' || 
                target.closest('button') || 
                target.tagName === 'A' || 
                target.tagName === 'INPUT' && target.type === 'checkbox') {
                return; // 如果是这些元素，则不触发切换
            }
            
            // 找到行内的复选框 (假设类名为 row-checkbox)
            const checkbox = row.querySelector('.row-checkbox');
            if (checkbox) {
                checkbox.checked = !checkbox.checked;
                // 手动触发 change 事件，以更新 setupCheckAll 的状态
                checkbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    }
    // --- -------------------------------------------------- ---

    // TODO: 设置表格操作 (setupTableActions) - 改为直接在 create 中添加监听
    // TODO: 设置筛选器监听 (分组、搜索)
}

/**
 * 打开添加/编辑社交账户模态框。
 * @param {number|null} [accountId=null] - 如果提供 ID，则为编辑模式；否则为添加模式。
 */
async function openSocialAccountModal(accountId = null) {
    const isEditMode = accountId !== null;
    let accountData = {}; // 存储编辑时获取的数据

    // 如果是编辑模式，先获取账户数据
    if (isEditMode) {
        try {
            accountData = await window.dbAPI.getSocialAccountById(accountId);
            if (!accountData) {
                showToast(`错误：找不到 ID 为 ${accountId} 的社交账户。`, 'error');
                return;
            }
        } catch (error) {
            console.error(`IPC: 获取社交账户 ${accountId} 数据失败:`, error);
            showToast(`加载编辑数据失败: ${error.message}`, 'error');
            return;
        }
    }

    showModal('tpl-social-account-form', async (modalElement) => {
        const form = modalElement.querySelector('#social-account-form-actual');
        const groupSelect = modalElement.querySelector('#social-group');
        const saveBtn = modalElement.querySelector('.modal-save-btn');
        const title = modalElement.querySelector('.modal-title');
        const accountIdInput = form.elements['account-id']; // 获取隐藏的 ID 输入框
        // 修改：只获取新的分组输入框
        const newGroupNameInput = modalElement.querySelector('.new-group-name-input'); 
        // 移除旧的按钮/控件引用
        // const addGroupBtn = modalElement.querySelector('.btn-add-group');
        // const newGroupControls = modalElement.querySelector('.new-group-controls');
        // const confirmNewGroupBtn = modalElement.querySelector('.btn-confirm-new-group');
        // const cancelNewGroupBtn = modalElement.querySelector('.btn-cancel-new-group');

        // 调整检查，确保新的输入框存在
        if (!form || !groupSelect || !saveBtn || !title || !accountIdInput || !newGroupNameInput) {
            console.error("添加/编辑社交账户模态框缺少必要的元素。.");
            hideModal();
            showToast("加载分组选项失败", 'error');
            return;
        }

        // 根据模式设置标题和表单默认值
        if (isEditMode) {
            title.textContent = '编辑社交账户';
            accountIdInput.value = accountId; // 设置隐藏 ID
            // 填充表单
            form.elements['social-platform'].value = accountData.platform || '';
            form.elements['social-username'].value = accountData.username || '';
            form.elements['social-binding'].value = accountData.binding || '';
            form.elements['social-notes'].value = accountData.notes || '';
            // 分组将在下面加载后设置
        } else {
            title.textContent = '添加社交账户';
            form.reset(); // 清空表单
            accountIdInput.value = ''; // 清空隐藏 ID
        }

        // 填充分组下拉菜单
        try {
            const groups = await window.dbAPI.getGroups();
            groupSelect.innerHTML = '<option value="">无分组</option>';
            let defaultGroupId = null;
            
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                
                // 保存默认分组ID
                if (group.name === '默认分组') {
                    defaultGroupId = group.id;
                }
                
                // 如果是编辑模式且账户有关联分组，则选中
                if (isEditMode && accountData.groupId === group.id) {
                    option.selected = true;
                }
                groupSelect.appendChild(option);
            });
            
            // 如果是添加模式，自动选择默认分组
            if (!isEditMode && defaultGroupId) {
                // 查找对应的选项并设置为选中
                const defaultOption = groupSelect.querySelector(`option[value="${defaultGroupId}"]`);
                if (defaultOption) {
                    defaultOption.selected = true;
                }
            }
        } catch (error) {
            console.error("加载分组失败:", error);
            showToast("加载分组选项失败", 'error');
        }

        // --- 新增：处理新分组输入框的回车事件 ---
        if (newGroupNameInput) {
            newGroupNameInput.addEventListener('keydown', async (event) => {
                if (event.key === 'Enter') {
                    event.preventDefault(); // 阻止回车键触发表单提交
                    
                    const newGroupName = newGroupNameInput.value.trim();
                    if (!newGroupName) {
                        showToast('请输入新分组名称', 'warning');
                        return;
                    }

                    // 检查分组名是否已存在
                    const existingOptions = Array.from(groupSelect.options).map(opt => opt.textContent.toLowerCase());
                    if (existingOptions.includes(newGroupName.toLowerCase())) {
                        showToast(`分组 "${newGroupName}" 已存在，请直接在下拉框中选择`, 'warning');
                        // 可选：自动选中已存在的分组
                        const existingOption = Array.from(groupSelect.options).find(opt => opt.textContent.toLowerCase() === newGroupName.toLowerCase());
                        if (existingOption) {
                            groupSelect.value = existingOption.value;
                            newGroupNameInput.value = ''; // 清空输入
                        }
                        return;
                    }

                    // 禁用输入框，防止重复提交
                    newGroupNameInput.disabled = true;
                    const originalPlaceholder = newGroupNameInput.placeholder;
                    newGroupNameInput.placeholder = '正在添加...';

                    try {
                        const newGroupId = await window.dbAPI.addGroup(newGroupName);
                        showToast(`分组 "${newGroupName}" 添加成功`, 'success');
                        
                        // 创建新选项并添加到下拉框
                        const newOption = document.createElement('option');
                        newOption.value = newGroupId;
                        newOption.textContent = newGroupName;
                        newOption.selected = true; // 自动选中新分组
                        groupSelect.appendChild(newOption);
                        
                        newGroupNameInput.value = ''; // 清空输入框
                        
                        // 刷新页面顶部的分组筛选器
                        await loadGroupFiltersForSocial(); 
                    } catch (error) {
                        console.error("添加新分组失败:", error);
                        showToast(`添加分组失败: ${error.message}`, 'error');
                    } finally {
                        // 恢复输入框状态
                        newGroupNameInput.disabled = false;
                        newGroupNameInput.placeholder = originalPlaceholder;
                    }
                }
            });
        }
        // --- ------------------------------ ---

        const handleSubmit = async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const dataToSave = {
                platform: formData.get('social-platform'),
                username: formData.get('social-username').trim(),
                binding: formData.get('social-binding').trim() || null,
                notes: formData.get('social-notes').trim() || null,
                groupId: formData.get('social-group') ? parseInt(formData.get('social-group')) : null,
            };

            if (!dataToSave.platform || !dataToSave.username) {
                showToast("平台和用户名不能为空！", 'warning');
                return;
            }

            saveBtn.disabled = true;
            saveBtn.textContent = '保存中...';

            try {
                if (isEditMode) {
                    // 编辑模式：调用更新 API
                    console.log(`准备更新社交账户 ${accountId}:`, dataToSave);
                    const changes = await window.dbAPI.updateSocialAccount(accountId, dataToSave);
                    console.log(`社交账户 ${accountId} 更新成功, 受影响行数:`, changes);
                    if (changes > 0) {
                        showToast('社交账户更新成功', 'success');
                    } else {
                        showToast('未检测到更改', 'info');
                    }
                } else {
                    // 添加模式：调用添加 API
                    console.log("准备保存社交账户:", dataToSave);
                    const newId = await window.dbAPI.addSocialAccount(dataToSave);
                    console.log("社交账户添加成功, ID:", newId);
                    showToast('社交账户添加成功', 'success');
                }
                hideModal();
                await loadAndRenderSocialAccounts(); // 刷新列表
            } catch (error) {
                console.error(`保存社交账户失败 (${isEditMode ? '更新' : '添加'}):`, error);
                showToast(`${isEditMode ? '更新' : '添加'}失败: ${error.message}`, 'error');
            } finally {
                saveBtn.disabled = false;
                saveBtn.textContent = '保存';
            }
        };

        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);
    });
}

/**
 * 加载并渲染社交账户数据到表格。
 * @param {number} page - 要加载的页码 (默认为当前页)。
 * @param {number} limit - 每页的项目数 (默认为当前设置)。
 * @param {object} filters - 包含筛选和排序选项的对象 (待实现)。
 */
async function loadAndRenderSocialAccounts(page = currentPage, limit = itemsPerPage, filters = currentFilters) {
    console.log(`加载社交账户数据: 页码 ${page}, 每页 ${limit}, 筛选:`, filters);
    if (!tableBody || !window.dbAPI) {
        console.error("表格体或 dbAPI 未准备好。");
        return;
    }

    tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> 正在加载...</td></tr>'; // colspan 更新为 7

    try {
        // 构造传递给后端的选项
        const queryOptions = {
            page: page,
            limit: limit,
            ...filters // 直接使用传入的 filters 对象
            // filter: { ... }, // 例如：{ platform: 'twitter', groupId: 5, search: 'test' }
            // sort: { field: 'createdAt', order: 'DESC' }
        };

        const result = await window.dbAPI.getSocialAccounts(queryOptions);
        const accounts = result.accounts;
        totalItems = result.totalCount;
        currentPage = page; // 更新当前页

        tableBody.innerHTML = ''; // 清空表格体

        if (!accounts || accounts.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 20px;">暂无社交账户数据。</td></tr>'; // colspan 更新为 7
        } else {
            accounts.forEach(account => {
                const row = createSocialAccountRowElement(account);
                tableBody.appendChild(row);
            });
        }

        renderPagination(totalItems, itemsPerPage, currentPage);

    } catch (error) {
        console.error("加载社交账户数据失败:", error);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color: red;">加载数据失败: ${error.message}</td></tr>`; // colspan 更新为 7
    }
}

/**
 * 根据社交账户数据创建表格行元素 (<tr>)。
 * @param {object} account - 社交账户对象。
 * @returns {HTMLTableRowElement} - 创建的表格行元素。
 */
function createSocialAccountRowElement(account) {
    const row = document.createElement('tr');
    row.dataset.accountId = account.id; // 用于后续操作

    // 获取平台图标和颜色
    let platformIconClass = 'fas fa-question-circle'; // 默认图标
    let platformColor = '#6c757d'; // 默认颜色 (Bootstrap secondary)
    switch (account.platform?.toLowerCase()) {
        case 'twitter':
            platformIconClass = 'fab fa-twitter'; // Brands 图标保持不变
            platformColor = '#1DA1F2';
            break;
        case 'discord':
            platformIconClass = 'fab fa-discord'; // Brands 图标保持不变
            platformColor = '#5865F2';
            break;
        case 'telegram':
            platformIconClass = 'fab fa-telegram'; // Brands 图标，飞机图标现在是这个
            platformColor = '#2AABEE';
            break;
        case 'email':
            platformIconClass = 'fab fa-google'; // 使用 Gmail 图标
            platformColor = '#DB4437'; // Gmail 红色
            break;
        // 可以添加更多平台
    }

    // 确认使用 account.groupName (由 getSocialAccounts 提供)
    const groupIdText = account.groupName || '无分组'; // 显示分组名称或 '无分组'

    row.innerHTML = `
        <td><input type="checkbox" class="row-checkbox" value="${account.id}"></td>
        <td><i class="${platformIconClass}" style="color: ${platformColor}; font-size: 1.2em;"></i> ${account.platform}</td>
        <td>${account.username}</td>
        <td>${account.binding || '-'}</td>
        <td>${account.notes || '-'}</td>
        <td>${groupIdText}</td>
        <td>
            <button class="btn-icon action-btn" data-action="edit" title="编辑"><i class="fas fa-pencil-alt"></i></button>
            <button class="btn-icon action-btn" data-action="delete" title="删除"><i class="fas fa-trash-alt"></i></button>
        </td>
    `;

    // 添加事件监听器到操作按钮
    const editBtn = row.querySelector('[data-action="edit"]');
    const deleteBtn = row.querySelector('[data-action="delete"]');

    if (editBtn) {
        editBtn.addEventListener('click', () => handleSocialAccountAction('edit', account.id));
    }
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => handleSocialAccountAction('delete', account.id));
    }

    return row;
}

/**
 * 处理社交账户表格行内的操作按钮点击事件。
 * @param {'edit' | 'delete'} action - 操作类型。
 * @param {number} accountId - 社交账户的 ID。
 */
async function handleSocialAccountAction(action, accountId) {
    console.log(`处理操作 "${action}" on 社交账户 ID: ${accountId}`);

    if (action === 'delete') {
        // 获取账户信息用于确认提示
        const accountRow = tableBody.querySelector(`tr[data-account-id="${accountId}"]`);
        const platform = accountRow?.cells[1]?.textContent?.trim() || '未知平台';
        const username = accountRow?.cells[2]?.textContent?.trim() || `ID: ${accountId}`;

        // 使用自定义模态框进行确认
        showModal('tpl-confirm-dialog', (modalElement) => {
            const messageElement = modalElement.querySelector('.confirm-message');
            const confirmBtn = modalElement.querySelector('.modal-confirm-btn');
            const cancelBtn = modalElement.querySelector('.modal-cancel-btn');

            if (!messageElement || !confirmBtn || !cancelBtn) {
                console.error("确认模态框缺少必要的元素。");
                hideModal(); return;
            }

            messageElement.innerHTML = `确定删除 ${platform} 账户 "<b>${username}</b>" 吗？`; // 加粗用户名

            const handleConfirmDelete = async () => {
                confirmBtn.removeEventListener('click', handleConfirmDelete);
                
                confirmBtn.disabled = true;
                confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 删除中...';

                try {
                    const changes = await window.dbAPI.deleteSocialAccount(accountId);
                    if (changes > 0) {
                        showToast(`账户 "${username}" 已删除`, 'success');
                        hideModal();
                        await loadAndRenderSocialAccounts(); // 重新加载数据
                    } else {
                        showToast(`删除账户 "${username}" 操作未执行`, 'warning');
                        hideModal();
                    }
                } catch (error) {
                    console.error(`删除账户 ID ${accountId} 失败:`, error);
                    showToast(`删除失败: ${error.message}`, 'error');
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = '确认';
                }
            };
            confirmBtn.addEventListener('click', handleConfirmDelete);
        });

    } else if (action === 'edit') {
        // 调用模态框函数，并传入 ID 进入编辑模式
        openSocialAccountModal(accountId);
    }
}

/**
 * 社交账户表格行的筛选函数。
 * @param {HTMLElement} rowElement - 表格行元素。
 * @param {object} filterValues - 包含筛选值的对象。
 *                                  例如：{ search: '...', platform: 'twitter', 'social-group-filter': 'group-a' }
 * @returns {boolean} - 如果行应该显示，则返回 true。
 */
function filterSocialRow(rowElement, filterValues) {
    // 从行中提取数据
    const cells = rowElement.cells;
    const platformIconClass = cells[1]?.querySelector('i')?.className || ''; // 例如：'fab fa-twitter'
    const platform = platformIconClass.includes('fa-twitter') ? 'twitter'
                   : platformIconClass.includes('fa-discord') ? 'discord'
                   : platformIconClass.includes('fa-telegram') ? 'telegram'
                   : platformIconClass.includes('fa-envelope') ? 'email'
                   : '';
    const username = cells[2]?.textContent.toLowerCase() || '';
    const emailPhone = cells[3]?.textContent.toLowerCase() || '';
    const notes = cells[4]?.textContent.toLowerCase() || '';
    const group = cells[5]?.textContent.toLowerCase() || '';

    const searchContent = `${platform} ${username} ${emailPhone} ${notes} ${group}`;

    // 获取筛选值
    const platformFilter = filterValues.platform || ''; // 来自平台按钮
    const groupFilter = filterValues['social-group-filter'] || ''; // 来自选择框
    const searchTerm = filterValues.search || '';

    // 应用筛选器
    const platformMatch = !platformFilter || platform === platformFilter;
    const groupMatch = !groupFilter || group.includes(groupFilter); // 假设分组允许部分匹配
    const searchMatch = !searchTerm || searchContent.includes(searchTerm);

    return platformMatch && groupMatch && searchMatch;
}