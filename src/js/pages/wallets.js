import { setupTableActions, setupFilteringAndSearch, setupCheckAll } from '../components/tableHelper.js';
// import { truncateAddress } from '../utils/index.js'; // 可能需要用于某些操作

// 导入数据库操作函数和工具函数
// 注意：这里使用了 require，假设运行环境支持 (如 Electron Renderer with nodeIntegration)
// 如果是纯浏览器环境，DB 交互需要通过 IPC 发送到主进程处理
// const {
//     getWallets, deleteWallet, getGroups, addWallet, updateWallet, getWalletById,
//     addGroup, updateGroup, deleteGroup, getWalletsByIds // 导入所有需要的函数
// } = require('../db');
import { truncateAddress } from '../utils/index.js';
import { debounce } from '../utils/index.js';
import { showModal, hideModal } from '../components/modal.js'; // 导入模态框函数

// 存储当前筛选和分页状态
let currentFilters = {};
let currentPage = 1;
const rowsPerPage = 15; // 每页显示多少行

// 缓存 DOM 元素
let tableBody;
let groupFilterSelect;
let chainFilterSelect;
let typeFilterSelect;
let searchInput;
let paginationContainer;
let contentAreaCache; // 缓存 contentArea

/**
 * 初始化钱包页面。
 * 设置表格操作、筛选、全选和头部按钮。
 * 从数据库加载初始数据。
 * @param {HTMLElement} contentArea - 要操作的主要内容区域。
 */
export async function initWalletsPage(contentArea) {
    console.log("正在初始化钱包页面 (IPC 版本)...");
    contentAreaCache = contentArea; // 缓存供其他函数使用

    // 缓存页面元素
    tableBody = contentArea.querySelector('.wallet-table tbody');
    groupFilterSelect = contentArea.querySelector('#wallet-group-filter');
    chainFilterSelect = contentArea.querySelector('#wallet-chain-filter');
    typeFilterSelect = contentArea.querySelector('#wallet-type-filter');
    searchInput = contentArea.querySelector('.table-search-input');
    paginationContainer = contentArea.querySelector('.pagination'); // 假设有一个分页容器

    if (!tableBody || !groupFilterSelect || !chainFilterSelect || !typeFilterSelect || !searchInput || !paginationContainer) {
        console.error("钱包页面缺少必要的 DOM 元素！");
        return;
    }

    // 检查 dbAPI 是否通过 preload 脚本成功注入
    if (typeof window.dbAPI === 'undefined') {
        console.error("错误: window.dbAPI 未定义! Preload 脚本可能未正确加载或配置。");
        tableBody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px; color: red;">应用程序配置错误，无法访问数据库。</td></tr>';
        return;
    }

    // 设置表格通用功能
    setupTableActions(contentArea, '.wallet-table', handleWalletAction);
    setupCheckAll(contentArea, '.wallet-table');

    // 设置筛选和搜索的事件监听器
    setupFilterListeners();

    // 为头部按钮添加监听器 (保留占位符)
    const addBtn = contentArea.querySelector('.header-actions .btn-primary'); // "批量生成钱包"
    const importBtn = contentArea.querySelector('.header-actions .btn-secondary:nth-of-type(1)'); // 导入
    const exportBtn = contentArea.querySelector('.header-actions .btn-secondary:nth-of-type(2)'); // 导出
    const manageGroupsBtn = contentArea.querySelector('.header-actions .btn-secondary:nth-of-type(3)'); // 管理分组

    if (addBtn) {
        // 点击"批量生成钱包"按钮 -> 打开添加钱包模态框
        addBtn.addEventListener('click', () => openWalletModal());
    }
    if (importBtn) {
        // 点击"导入钱包"按钮 -> 触发文件选择
        importBtn.addEventListener('click', handleImportWallets);
    }
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportWallets);
    }
    if (manageGroupsBtn) {
        // 点击"管理分组"按钮 -> 打开分组管理模态框
        manageGroupsBtn.addEventListener('click', openManageGroupsModal);
    }

    // 加载分组过滤器选项
    await loadGroupFilters();

    // 加载并渲染初始钱包数据
    await loadAndRenderWallets();
}

/**
 * 设置筛选器和搜索框的事件监听器。
 * 当筛选条件改变时，重置页码并重新加载数据。
 */
function setupFilterListeners() {
    const applyFiltersAndReload = debounce(async () => {
        currentPage = 1; // 筛选条件改变，回到第一页
        currentFilters = {
            chain: chainFilterSelect.value,
            type: typeFilterSelect.value,
            groupId: groupFilterSelect.value ? parseInt(groupFilterSelect.value) : null,
            search: searchInput.value.trim()
        };
        await loadAndRenderWallets(currentFilters);
    }, 300); // 防抖处理

    chainFilterSelect.addEventListener('change', applyFiltersAndReload);
    typeFilterSelect.addEventListener('change', applyFiltersAndReload);
    groupFilterSelect.addEventListener('change', applyFiltersAndReload);
    searchInput.addEventListener('input', applyFiltersAndReload);
}

/**
 * 从数据库加载分组数据并填充到筛选器下拉菜单中。
 */
async function loadGroupFilters() {
    try {
        // 使用 IPC 调用
        const groups = await window.dbAPI.getGroups();
        groupFilterSelect.innerHTML = '<option value="">所有分组</option>';
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupFilterSelect.appendChild(option);
        });
    } catch (error) {
        console.error("IPC: 加载分组筛选器失败:", error);
        // 可以在界面上显示错误提示
    }
}

/**
 * 从数据库加载钱包数据并渲染到表格中。
 * @param {object} [filters={}] - 当前应用的筛选条件。
 */
async function loadAndRenderWallets(filters = currentFilters) {
    console.log("IPC: 加载钱包数据，筛选条件:", filters, "页码:", currentPage);
    try {
        const offset = (currentPage - 1) * rowsPerPage;
        const options = {
            ...filters,
            limit: rowsPerPage,
            offset: offset,
            sortBy: 'createdAt', // 或根据需要添加排序选项
            sortOrder: 'DESC'
        };

        // 使用 IPC 调用
        const { wallets, totalCount } = await window.dbAPI.getWallets(options);

        // 清空当前表格体
        tableBody.innerHTML = '';

        // 渲染数据行
        if (wallets && wallets.length > 0) {
            wallets.forEach(wallet => {
                const rowElement = createWalletRowElement(wallet);
                tableBody.appendChild(rowElement);
            });
        } else {
            // 显示无数据提示
            tableBody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px;">没有找到匹配的钱包。</td></tr>';
        }

        // 更新分页控件
        renderPagination(totalCount, rowsPerPage, currentPage);

        // 数据加载后可能需要重新初始化全选状态
        setupCheckAll(contentAreaCache, '.wallet-table');

    } catch (error) {
        console.error("IPC: 加载或渲染钱包数据失败:", error);
        tableBody.innerHTML = '<tr><td colspan="11" style="text-align:center; padding: 20px; color: red;">加载钱包数据时出错。</td></tr>';
    }
}

/**
 * 根据钱包数据对象创建一个表格行 (<tr>) HTML 元素。
 * @param {object} wallet - 从数据库获取的钱包对象。
 * @returns {HTMLElement} - 创建的 <tr> 元素。
 */
function createWalletRowElement(wallet) {
    const tr = document.createElement('tr');
    tr.dataset.id = wallet.id; // 将数据库 ID 存储在行上

    // 风险和状态的简单映射 (后续可以扩展)
    const backupStatusMap = {
        0: '<span class="status pending">待备份</span>',
        1: '<span class="status success">已备份</span>',
        default: '<span class="status na">N/A</span>'
    };
    const riskMap = { // 简单示例，后续可根据逻辑调整
        low: '<span class="risk low">低</span>',
        medium: '<span class="risk medium">中</span>',
        high: '<span class="risk high">高</span>',
        default: '<span class="risk na">N/A</span>'
    };

    // 链图标处理 (简化版，后续可完善)
    let chainIconHtml = `<i class="fa fa-question-circle chain-icon unknown"></i>`; // 默认图标
    if (wallet.type === 'exchange') {
        // 尝试根据 chain 名称显示交易所 Logo (需要实际图片或更好的映射)
        chainIconHtml = `<img src="https://via.placeholder.com/16/grey/white?text=${wallet.chain.substring(0, 1)}" alt="${wallet.chain}" class="exchange-icon">`;
    } else if (wallet.chain) {
         const chainLower = wallet.chain.toLowerCase();
         // 简单的 FontAwesome 映射
         const faMap = { 'ethereum': 'fa-ethereum', 'eth': 'fa-ethereum', 'solana': 'fa-btc', 'sol': 'fa-btc', 'bsc': 'fa-btc' };
         const iconClass = faMap[chainLower] || 'fa-link'; // 默认链图标
         chainIconHtml = `<i class="fa ${iconClass} chain-icon ${chainLower}"></i>`;
    }

    tr.innerHTML = `
        <td><input type="checkbox"></td>
        <td class="wallet-address-cell">
            ${chainIconHtml}
            <span>${truncateAddress(wallet.address)}</span>
            ${wallet.name ? `<small style="display: block; color: #888;">(${wallet.name})</small>` : ''}
        </td>
        <td>${wallet.chain || 'N/A'}</td>
        <td>${wallet.type === 'onchain' ? '链上钱包' : (wallet.type === 'exchange' ? '交易所子账户' : wallet.type)}</td>
        <td>${wallet.notes || ''}</td>
        <td>${wallet.groupName || ''}</td>
        <td>--</td> <!-- 余额占位符 -->
        <td>--</td> <!-- Tx数占位符 -->
        <td>${backupStatusMap[wallet.isBackedUp] || backupStatusMap.default}</td>
        <td>${riskMap.default}</td> <!-- 风险占位符 -->
        <td class="actions-cell">
            <button class="btn-icon" title="查看详情"><i class="fa fa-eye"></i></button>
            <button class="btn-icon" title="编辑"><i class="fa fa-edit"></i></button>
            <button class="btn-icon" title="删除"><i class="fa fa-trash"></i></button>
        </td>
    `;
    return tr;
}

/**
 * 处理钱包表格行内的操作按钮点击事件。
 * @param {string} action - 操作名称 ('查看详情', '编辑', '删除')。
 * @param {HTMLElement} rowElement - 表格行元素 (<tr>)。
 * @param {Array<string>} rowData - (可选，但我们现在用 rowElement.dataset.id)
 */
async function handleWalletAction(action, rowElement, rowData) {
    const walletId = parseInt(rowElement.dataset.id);
    if (!walletId) {
        console.error("无法从表格行获取钱包 ID");
        return;
    }
    // 使用数据库 ID 获取更可靠的地址信息
    const walletAddress = rowElement.querySelector('.wallet-address-cell span')?.textContent || `ID: ${walletId}`;

    console.log(`IPC: 钱包操作: "${action}" on Wallet ID: ${walletId} (${walletAddress})`);

    if (action === '删除') {
        if (confirm(`确定删除钱包 ${walletAddress}?`)) {
            try {
                // 使用 IPC 调用
                const changes = await window.dbAPI.deleteWallet(walletId);
                if (changes > 0) {
                    console.log(`IPC: 钱包 ${walletId} 已删除。`);
                    // 从界面移除行 (或者重新加载整个表格 loadAndRenderWallets())
                    // rowElement.remove();
                     // 重新加载以更新分页等
                    await loadAndRenderWallets();
                } else {
                     console.warn(`IPC: 删除钱包 ${walletId} 未报告更改。`);
                }
            } catch (error) {
                console.error(`IPC: 删除钱包 ${walletId} 失败:`, error);
                alert(`删除钱包失败: ${error.message}`);
            }
        }
    } else if (action === '编辑') {
        // --- 实现编辑 ---
        openWalletModal(walletId); // 传递 ID 以表示编辑模式
    } else if (action === '查看详情') {
         alert(`查看钱包 ID: ${walletId} 详情 (未实现)`);
        // TODO: 实现详情模态框或面板
    }
}

/**
 * 打开钱包添加/编辑模态框。
 * @param {number} [walletId=null] - 如果提供 ID，则为编辑模式；否则为添加模式。
 */
async function openWalletModal(walletId = null) {
    const isEditMode = walletId !== null;
    let walletData = {}; // 存储编辑时获取的数据

    if (isEditMode) {
        try {
            // 使用 IPC 调用
            walletData = await window.dbAPI.getWalletById(walletId);
            if (!walletData) {
                alert(`错误：找不到 ID 为 ${walletId} 的钱包。`);
                return;
            }
        } catch (error) {
            console.error(`IPC: 获取钱包 ${walletId} 数据失败:`, error);
            alert(`加载编辑数据失败: ${error.message}`);
            return;
        }
    }

    // 使用 showModal 显示表单模态框 (假设模板 ID 为 tpl-wallet-form)
    showModal('tpl-wallet-form', async (modalElement) => {
        // --- 模态框设置函数 ---
        const form = modalElement.querySelector('form'); // 假设模态框内有 form
        const title = modalElement.querySelector('.modal-title'); // 假设有标题元素
        const saveBtn = modalElement.querySelector('.modal-save-btn'); // 假设有保存按钮
        const groupSelect = modalElement.querySelector('#wallet-group'); // 组下拉菜单

        if (!form || !title || !saveBtn || !groupSelect) {
            console.error("钱包表单模态框缺少必要的元素 (form, .modal-title, .modal-save-btn, #wallet-group)。");
            hideModal(); // 关闭无效模态框
            return;
        }

        // 设置标题
        title.textContent = isEditMode ? `编辑钱包 (ID: ${walletId})` : '添加新钱包';

        // 填充分组下拉菜单
        try {
            // 使用 IPC 调用
            const groups = await window.dbAPI.getGroups();
            groupSelect.innerHTML = '<option value="">无分组</option>'; // 默认无分组
            groups.forEach(group => {
                const option = document.createElement('option');
                option.value = group.id;
                option.textContent = group.name;
                // 如果是编辑模式且钱包有分组，则选中
                if (isEditMode && walletData.groupId === group.id) {
                    option.selected = true;
                }
                groupSelect.appendChild(option);
            });
        } catch (error) {
            console.error("IPC: 填充分组下拉菜单失败:", error);
            // 可以添加一个提示
        }

        // 填充表单 (编辑模式)
        if (isEditMode) {
            form.elements['wallet-id'].value = walletId; // 隐藏字段存储 ID
            form.elements['wallet-address'].value = walletData.address || '';
            form.elements['wallet-name'].value = walletData.name || '';
            form.elements['wallet-chain'].value = walletData.chain || '';
            form.elements['wallet-type'].value = walletData.type || '';
            form.elements['wallet-notes'].value = walletData.notes || '';
            form.elements['wallet-backup-status'].checked = walletData.isBackedUp === 1;
            // !! 安全警告: 这里仅为演示目的填充了加密字段，实际应用中不应直接显示 !!
            form.elements['wallet-encrypted-key'].value = walletData.encryptedPrivateKey || '';
        } else {
             form.elements['wallet-id'].value = ''; // 清空 ID 字段
             // 清空其他字段 (防止上次打开模态框的数据残留)
             form.reset();
             // 重置分组下拉菜单到 "无分组"
             groupSelect.value = '';
        }

        // --- 表单提交处理 ---
        const handleSubmit = async (event) => {
            event.preventDefault();
            saveBtn.disabled = true; // 防止重复提交
            saveBtn.textContent = '保存中...';

            const formData = new FormData(form);
            const dataToSave = {
                address: formData.get('wallet-address').trim(),
                name: formData.get('wallet-name').trim() || null,
                chain: formData.get('wallet-chain').trim(),
                type: formData.get('wallet-type'),
                notes: formData.get('wallet-notes').trim() || null,
                groupId: formData.get('wallet-group') ? parseInt(formData.get('wallet-group')) : null,
                isBackedUp: formData.get('wallet-backup-status') === 'on', // 复选框的值是 'on'
                // !! 安全警告: 直接从表单获取，实际应从安全输入或内存中获取并加密 !!
                encryptedPrivateKey: formData.get('wallet-encrypted-key').trim() || null
            };

             // 基本验证 (可以做得更完善)
            if (!dataToSave.address || !dataToSave.chain || !dataToSave.type) {
                alert("钱包地址、链和类型不能为空！");
                saveBtn.disabled = false;
                saveBtn.textContent = '保存';
                return;
            }

            try {
                if (isEditMode) {
                    // --- 更新钱包 ---
                    const changes = await window.dbAPI.updateWallet(walletId, dataToSave);
                    console.log(`IPC: 更新钱包 ${walletId} 结果: ${changes} 行受影响`);
                    alert('钱包更新成功！');
                } else {
                    // --- 添加钱包 ---
                    const newId = await window.dbAPI.addWallet(dataToSave);
                    console.log(`IPC: 添加新钱包成功，ID: ${newId}`);
                    alert('钱包添加成功！');
                }
                hideModal(); // 关闭模态框
                await loadAndRenderWallets(); // 刷新表格
            } catch (error) {
                 console.error("IPC: 保存钱包失败:", error);
                 // 检查是否是唯一约束错误 (地址重复)
                 if (error.message && error.message.includes('UNIQUE constraint failed: wallets.address')) {
                     alert(`保存失败：钱包地址 "${dataToSave.address}" 已存在！`);
                 } else {
                    alert(`保存钱包失败: ${error.message}`);
                 }
                 saveBtn.disabled = false;
                 saveBtn.textContent = '保存';
            }
        };

        // 移除旧监听器（如果存在），然后添加新监听器
        form.removeEventListener('submit', handleSubmit);
        form.addEventListener('submit', handleSubmit);
    });
}

/**
 * 处理导入钱包按钮点击事件。
 */
function handleImportWallets() {
    // 1. 创建一个隐藏的文件输入元素
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json'; // 限制只接受 JSON 文件
    fileInput.style.display = 'none';

    // 2. 处理文件选择
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) {
            return; // 用户取消选择
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            let successCount = 0, errorCount = 0; const errors = [];
            const importBtn = contentAreaCache?.querySelector('.header-actions .btn-secondary:nth-of-type(1)');
            try {
                const walletsToImport = JSON.parse(e.target.result);
                if (!Array.isArray(walletsToImport)) { throw new Error("导入文件需为钱包对象数组。"); }
                if(importBtn) importBtn.disabled = true;

                for (const walletData of walletsToImport) {
                    if (!walletData.address || !walletData.chain || !walletData.type) {
                        errors.push(`跳过无效条目: ${JSON.stringify(walletData)}`); errorCount++; continue;
                    }
                    try {
                         walletData.isBackedUp = walletData.isBackedUp ? 1 : 0;
                         walletData.groupId = walletData.groupId ? parseInt(walletData.groupId) : null;
                         // 使用 IPC 调用
                         await window.dbAPI.addWallet(walletData);
                         successCount++;
                    } catch (error) {
                        errorCount++;
                        if (error.message && error.message.includes('UNIQUE constraint failed: wallets.address')) {
                            errors.push(`地址 ${walletData.address} 已存在，跳过。`);
                        } else { errors.push(`导入 ${walletData.address} 失败: ${error.message}`); }
                    }
                }
                let message = `导入完成！成功 ${successCount}，失败 ${errorCount}。`;
                if (errors.length > 0) { message += "\n\n错误详情:\n" + errors.join('\n'); console.warn("导入错误:", errors); }
                alert(message);
                if(importBtn) importBtn.disabled = false;
                await loadAndRenderWallets();

            } catch (error) { console.error("解析或导入失败:", error); alert(`导入失败: ${error.message}`); if(importBtn) importBtn.disabled = false; }
        };
        reader.onerror = (e) => { console.error("读取文件失败:", e); alert("读取文件错误。"); };
        reader.readAsText(file);
    });

    // 5. 触发文件选择对话框
    document.body.appendChild(fileInput); // 需要添加到 DOM 才能点击
    fileInput.click();
    document.body.removeChild(fileInput); // 用完后移除
}

/**
 * 修改 handleExportWallets 实现导出
 */
async function handleExportWallets() {
     if (!contentAreaCache) return;
     const checkedRows = contentAreaCache.querySelectorAll('.wallet-table tbody input[type="checkbox"]:checked');
     if (checkedRows.length === 0) {
         alert("请先选择要导出的钱包！"); return;
     }
     const walletIdsToExport = Array.from(checkedRows)
         .map(cb => cb.closest('tr')?.dataset.id)
         .filter(id => id)
         .map(id => parseInt(id));
     if (walletIdsToExport.length === 0) { console.error("无法从选中的行获取钱包 ID。"); return; }

    try {
        // 使用 IPC 调用
        const walletsToExport = await window.dbAPI.getWalletsByIds(walletIdsToExport);

        if (!walletsToExport || walletsToExport.length === 0) {
            alert("错误：无法获取选定钱包的数据。"); return;
        }

        // 2. 准备 JSON 数据 (移除 groupName, 因为它是 join 来的)
        // 同时，将 isBackedUp 从 0/1 转回 true/false 以方便阅读
        const exportData = walletsToExport.map(({ groupName, isBackedUp, ...rest }) => ({ ...rest, isBackedUp: isBackedUp === 1 }));
        const jsonString = JSON.stringify(exportData, null, 2); // 格式化 JSON

        // 3. 创建下载链接并触发下载
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        a.download = `four-air-wallets-export-${timestamp}.json`;
        document.body.appendChild(a); // 需要添加到 DOM
        a.click();
        document.body.removeChild(a); // 清理
        URL.revokeObjectURL(url); // 释放内存

        // 4. 提示用户
        alert(`已成功导出 ${walletsToExport.length} 个钱包。\n\n**重要提示：** 导出的 JSON 文件可能包含"加密后"的私钥数据（如果已存储）。请妥善保管此文件，并考虑使用密码保护！`);

    } catch (error) {
        console.error("IPC: 导出钱包失败:", error);
        alert(`导出钱包失败: ${error.message}`);
    }
}

/**
 * 打开分组管理模态框。
 */
async function openManageGroupsModal() {
     // 使用 showModal 显示分组管理模态框 (假设 ID 为 tpl-manage-groups)
     showModal('tpl-manage-groups', async (modalElement) => {
        const groupListElement = modalElement.querySelector('.group-list'); // 显示分组的列表
        const newGroupNameInput = modalElement.querySelector('#new-group-name'); // 添加分组的输入框
        const addGroupBtn = modalElement.querySelector('.add-group-btn'); // 添加按钮

        if (!groupListElement || !newGroupNameInput || !addGroupBtn) {
            console.error("分组管理模态框缺少必要的元素 (.group-list, #new-group-name, .add-group-btn)。");
            hideModal(); return;
        }

        // 加载并显示现有分组
        const renderGroupList = async () => {
            groupListElement.innerHTML = '加载中...'; // 清空并显示加载状态
            try {
                // 使用 IPC 调用
                const groups = await window.dbAPI.getGroups();
                groupListElement.innerHTML = ''; // 清空加载状态
                if (groups.length === 0) {
                    groupListElement.innerHTML = '<li>暂无分组。</li>';
                    return;
                }
                groups.forEach(group => {
                    const li = document.createElement('li');
                    li.dataset.id = group.id;

                    const nameSpan = document.createElement('span');
                    nameSpan.textContent = group.name;

                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'group-actions';

                    // 编辑按钮
                    const editBtn = document.createElement('button');
                    editBtn.innerHTML = '<i class="fa fa-edit"></i>';
                    editBtn.title = '重命名';
                    editBtn.className = 'btn-icon';
                    editBtn.addEventListener('click', async () => {
                        const newName = prompt(`输入分组 "${group.name}" 的新名称:`, group.name);
                        if (newName && newName.trim() !== '' && newName !== group.name) {
                            try {
                                // 使用 IPC 调用
                                await window.dbAPI.updateGroup(group.id, newName.trim());
                                await renderGroupList(); // 刷新列表
                                await loadGroupFilters(); // 刷新筛选器
                            } catch (error) {
                                 if (error.message && error.message.includes('UNIQUE constraint failed: groups.name')) {
                                     alert(`重命名失败：分组名称 "${newName.trim()}" 已存在！`);
                                 } else {
                                     alert(`重命名分组失败: ${error.message}`);
                                 }
                            }
                        }
                    });

                    // 删除按钮 (不允许删除默认分组 - 假设其 ID 为 1 或名称为'默认分组')
                    const deleteBtn = document.createElement('button');
                    deleteBtn.innerHTML = '<i class="fa fa-trash"></i>';
                    deleteBtn.title = '删除';
                    deleteBtn.className = 'btn-icon';
                     if (group.name === '默认分组' /* ID 判断可能不可靠，用名称更稳妥 */) {
                         deleteBtn.disabled = true;
                         deleteBtn.title = '不能删除默认分组';
                     } else {
                         deleteBtn.addEventListener('click', async () => {
                             if (confirm(`确定删除分组 "${group.name}"？\n与此分组关联的钱包将变为"无分组"。`)) {
                                 try {
                                     // 使用 IPC 调用
                                     await window.dbAPI.deleteGroup(group.id);
                                     await renderGroupList(); // 刷新列表
                                     await loadGroupFilters(); // 刷新筛选器
                                     await loadAndRenderWallets(); // 刷新钱包列表以更新分组显示
                                 } catch (error) {
                                     alert(`删除分组失败: ${error.message}`);
                                 }
                             }
                         });
                     }

                    actionsDiv.appendChild(editBtn);
                    actionsDiv.appendChild(deleteBtn);
                    li.appendChild(nameSpan);
                    li.appendChild(actionsDiv);
                    groupListElement.appendChild(li);
                });
            } catch (error) {
                console.error("IPC: 加载分组列表失败:", error);
                groupListElement.innerHTML = '<li style="color:red;">加载分组失败。</li>';
            }
        };

        // 添加新分组的处理
        const handleAddGroup = async () => {
            const name = newGroupNameInput.value.trim();
            if (name) {
                addGroupBtn.disabled = true;
                try {
                    // 使用 IPC 调用
                    await window.dbAPI.addGroup(name);
                    newGroupNameInput.value = ''; // 清空输入框
                    await renderGroupList(); // 刷新列表
                    await loadGroupFilters(); // 刷新筛选器
                } catch (error) {
                     if (error.message && error.message.includes('UNIQUE constraint failed: groups.name')) {
                         alert(`添加失败：分组名称 "${name}" 已存在！`);
                     } else {
                        alert(`添加分组失败: ${error.message}`);
                     }
                } finally {
                    addGroupBtn.disabled = false;
                }
            }
        };

         // 使用事件委托优化添加按钮的监听
        const groupAddContainer = addGroupBtn.closest('.group-add-form'); // 假设按钮和输入框在一个 form 或 div 内
        if (groupAddContainer) {
             // 防止 form 提交刷新页面 (如果它是 form)
             groupAddContainer.addEventListener('submit', (e) => e.preventDefault());

            groupAddContainer.addEventListener('click', (e) => {
                if (e.target === addGroupBtn || e.target.closest('.add-group-btn')) { // 处理点击图标的情况
                    handleAddGroup();
                }
            });
            // 监听输入框的回车键
            newGroupNameInput.addEventListener('keypress', (e) => {
                 if (e.key === 'Enter') {
                     e.preventDefault(); // 阻止默认的回车行为（如果在一个 form 内）
                     handleAddGroup();
                 }
            });
        } else {
             // 备用方案，直接监听按钮
             addGroupBtn.addEventListener('click', handleAddGroup);
        }


        // 初始加载分组列表
        await renderGroupList();
     });
}

/**
 * 渲染分页控件。
 * @param {number} totalItems - 总记录数。
 * @param {number} itemsPerPage - 每页记录数。
 * @param {number} currentPage - 当前页码。
 */
function renderPagination(totalItems, itemsPerPage, currentPage) {
    paginationContainer.innerHTML = '';
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return;

    // 上一页
    const prevButton = document.createElement('button');
    prevButton.innerHTML = '&laquo;';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', async () => {
        if (currentPage > 1) { currentPage--; await loadAndRenderWallets(); }
    });
    paginationContainer.appendChild(prevButton);

    // 页码 (保持之前的逻辑)
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, currentPage + 2);
     if (startPage > 1) {
        const firstButton = document.createElement('button'); firstButton.textContent = '1';
        firstButton.addEventListener('click', async () => { currentPage = 1; await loadAndRenderWallets(); });
        paginationContainer.appendChild(firstButton);
        if (startPage > 2) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; ellipsis.style.padding = '0 10px'; paginationContainer.appendChild(ellipsis); }
    }
    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement('button'); pageButton.textContent = i;
        if (i === currentPage) { pageButton.classList.add('active'); }
        pageButton.addEventListener('click', async () => { currentPage = i; await loadAndRenderWallets(); });
        paginationContainer.appendChild(pageButton);
    }
     if (endPage < totalPages) {
         if (endPage < totalPages - 1) { const ellipsis = document.createElement('span'); ellipsis.textContent = '...'; ellipsis.style.padding = '0 10px'; paginationContainer.appendChild(ellipsis); }
        const lastButton = document.createElement('button'); lastButton.textContent = totalPages;
        lastButton.addEventListener('click', async () => { currentPage = totalPages; await loadAndRenderWallets(); });
        paginationContainer.appendChild(lastButton);
    }

    // 下一页
    const nextButton = document.createElement('button');
    nextButton.innerHTML = '&raquo;';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', async () => {
        if (currentPage < totalPages) { currentPage++; await loadAndRenderWallets(); }
    });
    paginationContainer.appendChild(nextButton);
}