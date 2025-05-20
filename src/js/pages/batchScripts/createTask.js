/**
 * 批量脚本任务创建模块
 * 负责创建批量脚本任务的表单和逻辑
 */

import { showModal, closeModal } from '../../components/modal.js';
import { TaskLogger } from './logger.js';

// 当前模态框ID
let currentModalId = null;

/**
 * 显示创建批量任务模态框
 * @param {Function} onTaskCreated - 任务创建成功回调
 */
export function createBatchTask(onTaskCreated) {
    try {
        // 获取创建任务模板
        const template = document.getElementById('tpl-create-batch-task-modal');
        if (!template) {
            console.error('未找到创建批量任务模板');
            return;
        }
        
        // 克隆模板内容
        const modalContent = template.content.cloneNode(true);
        
        // 显示模态框
        currentModalId = showModal(modalContent);
        
        // 获取模态框元素
        const modal = document.getElementById(currentModalId);
        if (!modal) return;
        
        // 加载脚本列表
        loadScriptOptions(modal);
        
        // 加载钱包列表
        loadWalletList(modal);
        
        // 绑定事件
        bindFormEvents(modal, onTaskCreated);
    } catch (error) {
        console.error('创建批量任务模态框失败:', error);
        TaskLogger.logError(`创建批量任务模态框失败: ${error.message}`);
    }
}

/**
 * 加载脚本选项
 * @param {HTMLElement} modal - 模态框元素
 */
async function loadScriptOptions(modal) {
    const scriptSelect = modal.querySelector('#batch-script-select');
    if (!scriptSelect) return;
    
    try {
        // 显示加载中
        scriptSelect.innerHTML = '<option value="">加载中...</option>';
        
        // 获取脚本列表
        const response = await window.scriptAPI.getAllScripts();
        
        if (response.success && Array.isArray(response.data)) {
            const scripts = response.data;
            
            if (scripts.length === 0) {
                scriptSelect.innerHTML = '<option value="">-- 没有可用脚本 --</option>';
                return;
            }
            
            // 创建选项
            const options = scripts.map(script => `
                <option value="${script.id}" data-params="${script.params ? encodeURIComponent(JSON.stringify(script.params)) : ''}">
                    ${script.name}
                </option>
            `);
            
            // 添加默认选项
            options.unshift('<option value="">-- 请选择脚本 --</option>');
            
            // 设置选项
            scriptSelect.innerHTML = options.join('');
            
            // 绑定脚本选择事件
            scriptSelect.addEventListener('change', () => {
                loadScriptParams(modal, scriptSelect.value);
            });
        } else {
            scriptSelect.innerHTML = '<option value="">-- 加载脚本失败 --</option>';
            console.error('加载脚本列表失败:', response.error);
        }
    } catch (error) {
        console.error('获取脚本列表失败:', error);
        scriptSelect.innerHTML = '<option value="">-- 加载失败 --</option>';
    }
}

/**
 * 加载脚本参数
 * @param {HTMLElement} modal - 模态框元素
 * @param {string} scriptId - 脚本ID
 */
async function loadScriptParams(modal, scriptId) {
    const paramsContainer = modal.querySelector('#script-params-container');
    if (!paramsContainer) return;
    
    // 清空参数容器
    paramsContainer.innerHTML = '';
    
    if (!scriptId) return;
    
    try {
        // 获取选中的脚本选项
        const scriptOption = modal.querySelector(`#batch-script-select option[value="${scriptId}"]`);
        if (!scriptOption) return;
        
        // 获取脚本参数定义
        const paramsData = scriptOption.getAttribute('data-params');
        if (!paramsData) {
            paramsContainer.innerHTML = '<p>此脚本没有可配置参数</p>';
            return;
        }
        
        // 解析参数定义
        const params = JSON.parse(decodeURIComponent(paramsData));
        
        // 创建参数表单
        let paramsHTML = '<h5>脚本参数</h5>';
        
        for (const [paramName, paramDef] of Object.entries(params)) {
            const inputId = `script-param-${paramName}`;
            const isRequired = paramDef.required ? '<span class="required">*</span>' : '';
            
            paramsHTML += `<div class="option-group">
                <label for="${inputId}">${paramDef.label || paramName} ${isRequired}</label>`;
            
            // 根据参数类型创建不同的输入控件
            switch (paramDef.type) {
                case 'select':
                    paramsHTML += `<select id="${inputId}" name="params.${paramName}" ${paramDef.required ? 'required' : ''}>`;
                    if (paramDef.options && Array.isArray(paramDef.options)) {
                        paramDef.options.forEach(option => {
                            const selected = option.value === paramDef.default ? 'selected' : '';
                            paramsHTML += `<option value="${option.value}" ${selected}>${option.label}</option>`;
                        });
                    }
                    paramsHTML += '</select>';
                    break;
                
                case 'checkbox':
                    const checked = paramDef.default ? 'checked' : '';
                    paramsHTML += `
                        <div class="checkbox-group">
                            <input type="checkbox" id="${inputId}" name="params.${paramName}" ${checked}>
                            <label for="${inputId}">${paramDef.description || ''}</label>
                        </div>`;
                    break;
                
                case 'number':
                    paramsHTML += `<input type="number" id="${inputId}" name="params.${paramName}" 
                        value="${paramDef.default || ''}" 
                        ${paramDef.min !== undefined ? `min="${paramDef.min}"` : ''} 
                        ${paramDef.max !== undefined ? `max="${paramDef.max}"` : ''} 
                        ${paramDef.step ? `step="${paramDef.step}"` : ''}
                        ${paramDef.required ? 'required' : ''}>`;
                    break;
                
                case 'textarea':
                    paramsHTML += `<textarea id="${inputId}" name="params.${paramName}" 
                        placeholder="${paramDef.placeholder || ''}"
                        ${paramDef.required ? 'required' : ''}>${paramDef.default || ''}</textarea>`;
                    break;
                
                default: // text
                    paramsHTML += `<input type="text" id="${inputId}" name="params.${paramName}" 
                        value="${paramDef.default || ''}" 
                        placeholder="${paramDef.placeholder || ''}"
                        ${paramDef.required ? 'required' : ''}>`;
            }
            
            // 添加描述（如果有）
            if (paramDef.description && paramDef.type !== 'checkbox') {
                paramsHTML += `<p class="option-description">${paramDef.description}</p>`;
            }
            
            paramsHTML += '</div>';
        }
        
        // 设置参数表单
        paramsContainer.innerHTML = paramsHTML;
    } catch (error) {
        console.error('加载脚本参数失败:', error);
        paramsContainer.innerHTML = `<p class="error-message">加载参数失败: ${error.message}</p>`;
    }
}

/**
 * 加载钱包列表
 * @param {HTMLElement} modal - 模态框元素
 */
async function loadWalletList(modal) {
    const walletsContainer = modal.querySelector('#walletsContainer');
    const groupTabsContainer = modal.querySelector('#walletGroupTabs');
    
    if (!walletsContainer || !groupTabsContainer) return;
    
    try {
        // 显示加载中状态
        walletsContainer.innerHTML = '<div class="loading-indicator">加载钱包列表中...</div>';
        groupTabsContainer.innerHTML = '';
        
        // 获取分组数据
        const groupsResult = await window.electron.ipcRenderer.invoke('db:getGroups');
        let groups = [];
        
        if (Array.isArray(groupsResult)) {
            groups = groupsResult;
        } else if (groupsResult && typeof groupsResult === 'object' && groupsResult.data) {
            groups = groupsResult.data;
        }
        
        // 确保有默认分组
        if (!groups.some(g => g.id === 'default')) {
            groups.push({ id: 'default', name: '默认分组' });
        }
        
        // 获取钱包数据
        const walletsResult = await window.electron.ipcRenderer.invoke('db:getWallets');
        let wallets = [];
        
        if (walletsResult && Array.isArray(walletsResult.wallets)) {
            wallets = walletsResult.wallets;
        } else if (Array.isArray(walletsResult)) {
            wallets = walletsResult;
        } else if (walletsResult && typeof walletsResult === 'object' && walletsResult.data) {
            wallets = walletsResult.data;
        } else if (walletsResult && typeof walletsResult === 'object' && walletsResult.wallets) {
            wallets = Array.isArray(walletsResult.wallets) 
                ? walletsResult.wallets 
                : Object.values(walletsResult.wallets);
        }
        
        // 如果没有钱包，显示提示
        if (!wallets || wallets.length === 0) {
            walletsContainer.innerHTML = '<div class="empty-message">没有可用的钱包</div>';
            return;
        }
        
        // 按分组组织钱包
        const walletsByGroup = {};
        groups.forEach(group => {
            walletsByGroup[group.id] = {
                name: group.name,
                wallets: []
            };
        });
        
        wallets.forEach(wallet => {
            const groupId = wallet.groupId || 'default';
            if (walletsByGroup[groupId]) {
                walletsByGroup[groupId].wallets.push({
                    id: wallet.id,
                    address: wallet.address || '',
                    groupId
                });
            } else {
                if (!walletsByGroup['default']) {
                    walletsByGroup['default'] = { name: '默认分组', wallets: [] };
                }
                walletsByGroup['default'].wallets.push({
                    id: wallet.id,
                    address: wallet.address || '',
                    groupId: 'default'
                });
            }
        });
        
        // 渲染分组标签
        let groupTabsHTML = '';
        let firstTab = true;
        
        for (const [groupId, group] of Object.entries(walletsByGroup)) {
            if (group.wallets.length > 0) {
                const isActive = firstTab ? 'active' : '';
                groupTabsHTML += `
                    <button class="group-tab-btn ${isActive}" data-group-id="${groupId}">
                        ${group.name} <span class="wallet-count">(${group.wallets.length})</span>
                    </button>
                `;
                firstTab = false;
            }
        }
        
        groupTabsContainer.innerHTML = groupTabsHTML;
        
        // 渲染钱包列表
        let walletsHTML = '';
        firstTab = true;
        
        for (const [groupId, group] of Object.entries(walletsByGroup)) {
            if (group.wallets.length > 0) {
                const isActive = firstTab ? 'active' : 'hidden';
                
                walletsHTML += `<div class="group-tab-content ${isActive}" data-group-id="${groupId}">`;
                
                group.wallets.forEach(wallet => {
                    let displayAddress = wallet.address;
                    if (displayAddress && displayAddress.length > 12) {
                        displayAddress = displayAddress.substring(0, 6) + '...' + displayAddress.substring(displayAddress.length - 4);
                    }
                    
                    walletsHTML += `
                        <div class="wallet-cb-item">
                            <input type="checkbox" id="wallet_${wallet.id}" name="accountIds" value="${wallet.id}">
                            <label for="wallet_${wallet.id}">${displayAddress}</label>
                        </div>
                    `;
                });
                
                walletsHTML += `</div>`;
                firstTab = false;
            }
        }
        
        walletsContainer.innerHTML = walletsHTML;
        
        // 绑定分组标签切换事件
        const groupTabs = modal.querySelectorAll('.group-tab-btn');
        groupTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const groupId = tab.getAttribute('data-group-id');
                
                // 更新标签激活状态
                groupTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // 更新内容显示
                const contents = modal.querySelectorAll('.group-tab-content');
                contents.forEach(content => {
                    const contentGroupId = content.getAttribute('data-group-id');
                    if (contentGroupId === groupId) {
                        content.classList.remove('hidden');
                    } else {
                        content.classList.add('hidden');
                    }
                });
            });
        });
        
        // 绑定全选/反选按钮
        setupSelectionButtons(modal);
        
        // 绑定搜索功能
        setupWalletSearch(modal);
        
        // 绑定复选框变化事件
        setupCheckboxEvents(modal);
    } catch (error) {
        console.error('加载钱包列表失败:', error);
        walletsContainer.innerHTML = `<div class="error-message">加载钱包失败: ${error.message}</div>`;
    }
}

/**
 * 设置选择按钮功能
 * @param {HTMLElement} modal - 模态框元素
 */
function setupSelectionButtons(modal) {
    // 全选按钮
    const selectAllBtn = modal.querySelector('#selectAllWallets');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            // 获取当前可见的分组
            const activeContent = modal.querySelector('.group-tab-content:not(.hidden)');
            if (!activeContent) return;
            
            // 选中所有可见复选框
            const checkboxes = activeContent.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
            
            // 更新选择计数
            updateSelectedCount(modal);
        });
    }
    
    // 反选按钮
    const invertSelectBtn = modal.querySelector('#invertWalletSelection');
    if (invertSelectBtn) {
        invertSelectBtn.addEventListener('click', () => {
            // 获取当前可见的分组
            const activeContent = modal.querySelector('.group-tab-content:not(.hidden)');
            if (!activeContent) return;
            
            // 反选所有可见复选框
            const checkboxes = activeContent.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(checkbox => {
                checkbox.checked = !checkbox.checked;
            });
            
            // 更新选择计数
            updateSelectedCount(modal);
        });
    }
}

/**
 * 设置钱包搜索功能
 * @param {HTMLElement} modal - 模态框元素
 */
function setupWalletSearch(modal) {
    const searchInput = modal.querySelector('#walletSearchInput');
    if (!searchInput) return;
    
    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value.toLowerCase().trim();
        
        // 获取当前可见的分组
        const activeContent = modal.querySelector('.group-tab-content:not(.hidden)');
        if (!activeContent) return;
        
        // 筛选钱包项
        const walletItems = activeContent.querySelectorAll('.wallet-cb-item');
        walletItems.forEach(item => {
            const label = item.querySelector('label');
            if (!label) return;
            
            const text = label.textContent.toLowerCase();
            
            if (searchTerm === '' || text.includes(searchTerm)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    });
}

/**
 * 设置复选框事件
 * @param {HTMLElement} modal - 模态框元素
 */
function setupCheckboxEvents(modal) {
    const checkboxes = modal.querySelectorAll('input[name="accountIds"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            updateSelectedCount(modal);
        });
    });
}

/**
 * 更新已选择的钱包数量
 * @param {HTMLElement} modal - 模态框元素
 */
function updateSelectedCount(modal) {
    const selectedCount = modal.querySelectorAll('input[name="accountIds"]:checked').length;
    const countElement = modal.querySelector('#selectedWalletCount');
    
    if (countElement) {
        countElement.textContent = selectedCount;
    }
}

/**
 * 绑定表单事件
 * @param {HTMLElement} modal - 模态框元素
 * @param {Function} onTaskCreated - 任务创建成功回调
 */
function bindFormEvents(modal, onTaskCreated) {
    const form = modal.querySelector('#create-batch-task-form');
    if (!form) return;
    
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        try {
            // 验证表单
            if (!validateForm(form)) {
                return;
            }
            
            // 获取表单数据
            const formData = new FormData(form);
            const taskData = {
                name: formData.get('taskName'),
                description: formData.get('taskDescription') || '',
                scriptId: formData.get('scriptId'),
                accountIds: Array.from(formData.getAll('accountIds')),
                maxConcurrency: parseInt(formData.get('maxConcurrency'), 10) || 5,
                errorStrategy: formData.get('errorStrategy') || 'continue',
                intervalSettings: {
                    min: parseInt(formData.get('intervalMin'), 10) || 3,
                    max: parseInt(formData.get('intervalMax'), 10) || 10,
                    random: formData.get('randomInterval') === 'on'
                },
                params: getScriptParams(formData)
            };
            
            // 获取脚本名称
            const scriptOption = form.querySelector(`#batch-script-select option[value="${taskData.scriptId}"]`);
            if (scriptOption) {
                taskData.scriptName = scriptOption.textContent.trim();
            }
            
            // 关闭模态框
            closeModal(currentModalId);
            
            // 调用创建成功回调
            if (typeof onTaskCreated === 'function') {
                onTaskCreated(taskData);
            }
        } catch (error) {
            console.error('创建批量任务失败:', error);
            TaskLogger.logError(`创建批量任务失败: ${error.message}`);
        }
    });
    
    // 取消按钮
    const cancelBtn = modal.querySelector('.modal-cancel-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            closeModal(currentModalId);
        });
    }
    
    // 关闭按钮
    const closeBtn = modal.querySelector('.modal-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeModal(currentModalId);
        });
    }
}

/**
 * 验证表单数据
 * @param {HTMLFormElement} form - 表单元素
 * @returns {boolean} 是否验证通过
 */
function validateForm(form) {
    // 检查任务名称
    const taskName = form.querySelector('#batch-task-name');
    if (!taskName || !taskName.value.trim()) {
        alert('请输入任务名称');
        if (taskName) taskName.focus();
        return false;
    }
    
    // 检查脚本选择
    const scriptSelect = form.querySelector('#batch-script-select');
    if (!scriptSelect || !scriptSelect.value) {
        alert('请选择要执行的脚本');
        if (scriptSelect) scriptSelect.focus();
        return false;
    }
    
    // 检查是否选择了账户
    const selectedAccounts = form.querySelectorAll('input[name="accountIds"]:checked');
    if (selectedAccounts.length === 0) {
        alert('请至少选择一个账户');
        return false;
    }
    
    // 检查参数值（如果有必填参数）
    const requiredParams = form.querySelectorAll('[name^="params."][required]');
    for (const param of requiredParams) {
        if (!param.value.trim()) {
            alert(`请填写必填参数: ${param.closest('.option-group').querySelector('label').textContent}`);
            param.focus();
            return false;
        }
    }
    
    // 检查执行间隔
    const minInterval = parseInt(form.querySelector('#task-interval-min').value, 10);
    const maxInterval = parseInt(form.querySelector('#task-interval-max').value, 10);
    
    if (isNaN(minInterval) || minInterval < 1) {
        alert('最小执行间隔必须大于等于1秒');
        form.querySelector('#task-interval-min').focus();
        return false;
    }
    
    if (isNaN(maxInterval) || maxInterval < minInterval) {
        alert('最大执行间隔必须大于等于最小执行间隔');
        form.querySelector('#task-interval-max').focus();
        return false;
    }
    
    // 检查并发数
    const concurrency = parseInt(form.querySelector('#max-concurrency').value, 10);
    if (isNaN(concurrency) || concurrency < 1) {
        alert('最大并行数必须大于等于1');
        form.querySelector('#max-concurrency').focus();
        return false;
    }
    
    return true;
}

/**
 * 获取脚本参数
 * @param {FormData} formData - 表单数据
 * @returns {Object} 脚本参数对象
 */
function getScriptParams(formData) {
    const params = {};
    
    for (const [key, value] of formData.entries()) {
        if (key.startsWith('params.')) {
            const paramName = key.substring(7); // 移除 'params.' 前缀
            params[paramName] = value;
        }
    }
    
    return params;
} 