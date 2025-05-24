/**
 * @fileoverview 社交账户页面初始化 V2 - 使用socialStore进行状态管理
 * @module pages/social/index-v2
 */

import { socialManager } from './socialManager.js';
import { socialStore } from '../../stores/socialStore.js';
import { showToast } from '../../components/toast.js';
import { initSocialModals } from './modals.js';

/**
 * 初始化社交账户页面（使用Store版本）
 * @param {HTMLElement} contentArea - 内容区域元素
 */
export async function initSocialPageV2(contentArea) {
    console.log('[SocialV2] 开始初始化社交账户页面...');

    // 渲染初始UI
    renderPageStructure(contentArea);

    // 缓存DOM元素
    const elements = {
        contentArea: contentArea,
        tableBody: contentArea.querySelector('.social-table tbody'),
        paginationContainer: contentArea.querySelector('#paginationContainer'),
        searchInput: contentArea.querySelector('#searchInput'),
        platformFilter: contentArea.querySelector('#platformFilter'),
        statusFilter: contentArea.querySelector('#statusFilter'),
        selectAllCheckbox: contentArea.querySelector('#selectAllCheckbox'),
        selectedCount: contentArea.querySelector('#selectedCount'),
        bulkDeleteBtn: contentArea.querySelector('#bulk-delete-social-btn'),
        bulkImportBtn: contentArea.querySelector('#bulk-import-social-btn'),
        exportSelectedBtn: contentArea.querySelector('#export-selected-social-btn'),
        addAccountBtn: contentArea.querySelector('#add-social-account-btn'),
        refreshBtn: contentArea.querySelector('#refreshBtn')
    };

    // 检查必要元素
    if (!validateElements(elements)) {
        return;
    }

    // 初始化社交账户管理器
    await socialManager.initialize(elements);

    // 初始化模态框
    initSocialModals(contentArea);

    // 设置事件监听
    setupEventListeners(contentArea, elements);

    // 设置筛选器
    setupFilters(elements);

    console.log('[SocialV2] 社交账户页面初始化完成');
}

/**
 * 渲染页面结构
 */
function renderPageStructure(contentArea) {
    contentArea.innerHTML = `
        <div class="social-accounts-page">
            <div class="page-header">
                <h1>社交账户管理</h1>
                <p>管理您的社交媒体账户，支持批量导入导出</p>
                <div class="header-actions">
                    <span class="selected-info" style="display: none;">
                        已选择 <span id="selectedCount">0</span> 个账户
                    </span>
                    <button id="add-social-account-btn" class="btn btn-primary">
                        <i class="fas fa-plus"></i> 添加账户
                    </button>
                    <button id="refreshBtn" class="btn btn-secondary">
                        <i class="fas fa-sync-alt"></i> 刷新
                    </button>
                </div>
            </div>

            <div class="toolbar">
                <div class="toolbar-left">
                    <div class="search-box">
                        <i class="fas fa-search"></i>
                        <input type="text" id="searchInput" placeholder="搜索用户名、邮箱、手机号...">
                    </div>
                    <select id="platformFilter" class="filter-select">
                        <option value="all">所有平台</option>
                        <option value="Twitter">Twitter</option>
                        <option value="Facebook">Facebook</option>
                        <option value="Instagram">Instagram</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="TikTok">TikTok</option>
                        <option value="Discord">Discord</option>
                        <option value="Telegram">Telegram</option>
                    </select>
                    <select id="statusFilter" class="filter-select">
                        <option value="all">所有状态</option>
                        <option value="active">正常</option>
                        <option value="inactive">未激活</option>
                        <option value="banned">已封禁</option>
                        <option value="pending">待验证</option>
                    </select>
                </div>
                <div class="toolbar-right">
                    <button id="bulk-import-social-btn" class="btn btn-secondary">
                        <i class="fas fa-file-import"></i> 批量导入
                    </button>
                    <button id="export-selected-social-btn" class="btn btn-secondary">
                        <i class="fas fa-file-export"></i> 导出选中
                    </button>
                    <button id="bulk-delete-social-btn" class="btn btn-danger">
                        <i class="fas fa-trash"></i> 批量删除
                    </button>
                </div>
            </div>

            <div class="table-container">
                <table class="social-table">
                    <thead>
                        <tr>
                            <th width="40">
                                <input type="checkbox" id="selectAllCheckbox">
                            </th>
                            <th>平台</th>
                            <th>用户名</th>
                            <th>邮箱</th>
                            <th>手机号</th>
                            <th>状态</th>
                            <th>备注</th>
                            <th width="100">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- 表格内容将在这里渲染 -->
                    </tbody>
                </table>
            </div>

            <div class="pagination-wrapper" id="paginationContainer">
                <!-- 分页控件将在这里渲染 -->
            </div>
        </div>
    `;
}

/**
 * 验证必要的DOM元素
 */
function validateElements(elements) {
    const required = ['tableBody', 'paginationContainer'];
    
    for (const key of required) {
        if (!elements[key]) {
            console.error(`[SocialV2] 缺少必要元素: ${key}`);
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
    // 全选/取消全选
    if (elements.selectAllCheckbox) {
        elements.selectAllCheckbox.addEventListener('change', (e) => {
            socialStore.selectAll(e.target.checked);
        });
    }

    // 批量删除
    if (elements.bulkDeleteBtn) {
        elements.bulkDeleteBtn.addEventListener('click', () => {
            socialManager.deleteSelectedAccounts();
        });
    }

    // 批量导入
    if (elements.bulkImportBtn) {
        elements.bulkImportBtn.addEventListener('click', () => {
            handleBulkImport();
        });
    }

    // 导出选中
    if (elements.exportSelectedBtn) {
        elements.exportSelectedBtn.addEventListener('click', () => {
            handleExportSelected();
        });
    }

    // 刷新按钮
    if (elements.refreshBtn) {
        elements.refreshBtn.addEventListener('click', async () => {
            elements.refreshBtn.disabled = true;
            elements.refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 刷新中...';
            
            await socialManager.loadInitialData();
            
            elements.refreshBtn.disabled = false;
            elements.refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> 刷新';
            showToast('数据已刷新', 'success');
        });
    }

    // 监听自定义事件
    contentArea.addEventListener('social:edit', (e) => {
        const account = e.detail.account;
        showEditModal(account);
    });

    contentArea.addEventListener('social:added', (e) => {
        socialManager.loadInitialData();
    });

    contentArea.addEventListener('social:updated', (e) => {
        socialManager.loadInitialData();
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
                socialStore.setFilters({ search: e.target.value });
            }, 300);
        });
    }

    // 平台筛选
    if (elements.platformFilter) {
        elements.platformFilter.addEventListener('change', (e) => {
            socialStore.setFilters({ platform: e.target.value });
        });
    }

    // 状态筛选
    if (elements.statusFilter) {
        elements.statusFilter.addEventListener('change', (e) => {
            socialStore.setFilters({ status: e.target.value });
        });
    }
}

/**
 * 处理批量导入
 */
async function handleBulkImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.txt,.json';
    
    input.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const content = await file.text();
            const extension = file.name.split('.').pop().toLowerCase();
            
            let accounts = [];
            
            if (extension === 'json') {
                accounts = JSON.parse(content);
            } else if (extension === 'csv') {
                accounts = parseCSV(content);
            } else if (extension === 'txt') {
                accounts = parseTXT(content);
            }

            if (!Array.isArray(accounts) || accounts.length === 0) {
                throw new Error('无效的文件格式或内容为空');
            }

            // 批量添加账户
            let successCount = 0;
            for (const account of accounts) {
                try {
                    const result = await window.dbAPI.addSocialAccount(account);
                    if (result.success) successCount++;
                } catch (error) {
                    console.error('添加账户失败:', error);
                }
            }

            showToast(`成功导入 ${successCount}/${accounts.length} 个账户`, 'success');
            socialManager.loadInitialData();

        } catch (error) {
            console.error('[SocialV2] 导入失败:', error);
            showToast('导入失败: ' + error.message, 'error');
        }
    });

    input.click();
}

/**
 * 处理导出选中
 */
async function handleExportSelected() {
    const selectedIds = Array.from(socialStore.get('ui.selectedAccounts'));
    if (selectedIds.length === 0) {
        showToast('请先选择要导出的账户', 'warning');
        return;
    }

    const accounts = socialStore.get('accounts').filter(acc => 
        selectedIds.includes(acc.id)
    );

    // 创建导出数据
    const exportData = accounts.map(acc => ({
        platform: acc.platform,
        username: acc.username,
        email: acc.email,
        phone: acc.phone,
        password: acc.password,
        status: acc.status,
        notes: acc.notes,
        tags: acc.tags
    }));

    // 下载JSON文件
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `social_accounts_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showToast(`成功导出 ${accounts.length} 个账户`, 'success');
}

/**
 * 解析CSV内容
 */
function parseCSV(content) {
    const lines = content.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const accounts = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        const account = {};
        
        headers.forEach((header, index) => {
            account[header] = values[index] || '';
        });

        if (account.platform && (account.username || account.email)) {
            accounts.push(account);
        }
    }

    return accounts;
}

/**
 * 解析TXT内容（每行一个账户，格式：平台:用户名:密码）
 */
function parseTXT(content) {
    const lines = content.trim().split('\n');
    const accounts = [];

    for (const line of lines) {
        const parts = line.split(':');
        if (parts.length >= 3) {
            accounts.push({
                platform: parts[0].trim(),
                username: parts[1].trim(),
                password: parts[2].trim()
            });
        }
    }

    return accounts;
}

/**
 * 显示编辑模态框
 */
function showEditModal(account) {
    // 触发模态框显示事件
    const event = new CustomEvent('showEditSocialModal', { detail: { account } });
    document.dispatchEvent(event);
} 