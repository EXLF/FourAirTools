// 钱包相关模块
import { addSelectedWalletId, removeSelectedWalletId } from './state.js';

/**
 * 加载钱包列表
 * @param {HTMLElement} container - 详情页面容器元素
 */
export async function loadWalletList(container) {
    const walletSelectionList = container.querySelector('#walletSelectionList');
    if (!walletSelectionList) {
        console.error('钱包选择列表容器未找到');
        return;
    }
    
    try {
        walletSelectionList.innerHTML = '<div class="wallet-loading">加载钱包列表中...</div>';
        
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
            wallets = Array.isArray(walletsResult.wallets) ? walletsResult.wallets : Object.values(walletsResult.wallets);
        }
        
        // 如果没有钱包数据，使用测试数据
        if (!wallets || wallets.length === 0) {
            wallets = generateTestWallets();
            if (!groups.some(g => g.id === 'group1')) groups.push({ id: 'group1', name: '测试分组1' });
            if (!groups.some(g => g.id === 'group2')) groups.push({ id: 'group2', name: '测试分组2' });
        }
        
        // 按分组组织钱包
        const walletsByGroup = organizeWalletsByGroup(wallets, groups);
        
        // 渲染钱包列表
        renderWalletList(container, walletsByGroup, wallets.length);
        
        // 绑定事件
        setupWalletSelectionEvents(container);
        
    } catch (error) {
        console.error("加载钱包列表时出错:", error);
        walletSelectionList.innerHTML = `<div class="wallet-error">加载钱包数据出错: ${error.message || error}</div>`;
    }
}

/**
 * 生成测试钱包数据
 * @returns {Array} 测试钱包数组
 */
function generateTestWallets() {
    return [
        { id: 1, address: '0x7fa092e525b65416305601e1', groupId: 'default' },
        { id: 2, address: '0x9b1000eef33b3ed723641e0b', groupId: 'default' },
        { id: 3, address: '0xb5ce6ddd55674c05dd3576', groupId: 'group1' },
        { id: 4, address: '0x4403c9610f64d4', groupId: 'group1' },
        { id: 5, address: '0x5078cda55e3fc', groupId: 'group1' },
        { id: 6, address: '0x6a1b2c3d4e5f6a7b8c9d', groupId: 'default' },
        { id: 7, address: '0x7b2c3d4e5f6a7b8c9d0e', groupId: 'default' },
        { id: 8, address: '0x8c3d4e5f6a7b8c9d0e1f', groupId: 'default' },
        { id: 9, address: '0x9d4e5f6a7b8c9d0e1f2g', groupId: 'default' },
        { id: 10, address: '0x0e5f6a7b8c9d0e1f2g3h', groupId: 'default' },
        { id: 11, address: '0x1f6a7b8c9d0e1f2g3h4i', groupId: 'group2' },
        { id: 12, address: '0x2g7b8c9d0e1f2g3h4i5j', groupId: 'group2' },
        { id: 13, address: '0x3h8c9d0e1f2g3h4i5j6k', groupId: 'group2' },
        { id: 14, address: '0x4i9d0e1f2g3h4i5j6k7l', groupId: 'group2' },
        { id: 15, address: '0x5j0e1f2g3h4i5j6k7l8m', groupId: 'group2' }
    ];
}

/**
 * 按分组组织钱包数据
 * @param {Array} wallets - 钱包数组
 * @param {Array} groups - 分组数组
 * @returns {Object} 按分组组织的钱包数据
 */
function organizeWalletsByGroup(wallets, groups) {
    const walletsByGroup = {};
    groups.forEach(group => {
        walletsByGroup[group.id] = {
            name: group.name,
            wallets: []
        };
    });
    
    wallets.forEach(wallet => {
        let groupId = wallet.groupId || 'default';
        if (!walletsByGroup[groupId]) groupId = 'default';
        if (walletsByGroup[groupId]) {
            walletsByGroup[groupId].wallets.push({
                id: wallet.id,
                address: wallet.address || '',
                groupId: groupId
            });
        }
    });
    
    return walletsByGroup;
}

/**
 * 渲染钱包列表
 * @param {HTMLElement} container - 容器元素
 * @param {Object} walletsByGroup - 按分组组织的钱包数据
 * @param {number} totalWallets - 钱包总数
 */
function renderWalletList(container, walletsByGroup, totalWallets) {
    const walletListHtml = [];
    
    // 添加控制按钮
    walletListHtml.push(`
        <div class="selection-actions">
            <button class="btn-link" id="selectAllWallets">全选</button>
            <button class="btn-link" id="invertWalletSelection">反选</button>
            <div class="wallet-search-container">
                <i class="fas fa-search search-icon"></i>
                <input type="search" placeholder="搜索钱包..." id="walletSearchInput">
            </div>
        </div>
    `);
    
    // 添加分组标签
    walletListHtml.push(`<div class="wallet-group-tabs">`);
    walletListHtml.push(`<div class="group-tab-buttons">`);
    
    const groupIds = Object.keys(walletsByGroup);
    groupIds.forEach((groupId, index) => {
        const group = walletsByGroup[groupId];
        if (group.wallets.length > 0) {
            const isActive = index === 0 ? 'active' : '';
            walletListHtml.push(`
                <button class="group-tab-btn ${isActive}" data-group="${groupId}">
                    ${group.name} <span class="wallet-count">(${group.wallets.length})</span>
                </button>
            `);
        }
    });
    
    walletListHtml.push(`</div>`);
    walletListHtml.push(`<div class="wallets-scroll-container" id="walletsScrollContainer">`);
    
    // 添加分组内容
    let firstTabSet = false;
    groupIds.forEach((groupId, index) => {
        const group = walletsByGroup[groupId];
        if (group.wallets.length > 0) {
            const isActive = !firstTabSet ? 'active' : '';
            if (!firstTabSet) firstTabSet = true;
            
            walletListHtml.push(`<div class="group-tab-content ${isActive}" data-group="${groupId}">`);
            
            group.wallets.forEach(wallet => {
                let displayAddress = wallet.address;
                if (displayAddress && displayAddress.length > 12) {
                    displayAddress = displayAddress.substring(0, 6) + '...' + displayAddress.substring(displayAddress.length - 4);
                }
                
                const checked = window._selectedWalletIds.has(String(wallet.id)) ? 'checked' : '';
                walletListHtml.push(`
                    <div class="wallet-cb-item">
                        <input type="checkbox" id="wallet_${wallet.id}" data-address="${wallet.address}" data-group="${groupId}" value="${wallet.id}" ${checked}>
                        <label for="wallet_${wallet.id}">${displayAddress}</label>
                    </div>
                `);
            });
            
            walletListHtml.push(`</div>`);
        }
    });
    
    walletListHtml.push(`</div>`);
    walletListHtml.push(`</div>`);
    
    // 添加底部统计
    walletListHtml.push(`
        <div class="wallet-list-footer">
            <p class="selected-count">已选: <span id="selectedWalletCount">0</span> 个钱包（共 ${totalWallets} 个）</p>
        </div>
    `);
    
    // 渲染HTML
    const walletSelectionList = container.querySelector('#walletSelectionList');
    if (walletSelectionList) {
        walletSelectionList.innerHTML = walletListHtml.join('');
    }
}

/**
 * 设置钱包选择相关事件
 * @param {HTMLElement} container - 详情页面容器元素
 */
export function setupWalletSelectionEvents(container) {
    // 全选按钮
    const selectAllBtn = container.querySelector('#selectAllWallets');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => handleSelectAll(container, selectAllBtn));
    }
    
    // 反选按钮
    const invertBtn = container.querySelector('#invertWalletSelection');
    if (invertBtn) {
        invertBtn.addEventListener('click', () => handleInvertSelection(container));
    }
    
    // 搜索钱包
    const searchInput = container.querySelector('#walletSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => handleWalletSearch(container, searchInput));
    }
    
    // 为每个钱包复选框添加事件监听
    const checkboxes = container.querySelectorAll('#walletSelectionList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', () => handleCheckboxChange(checkbox));
    });
    
    // 为整个钱包列表容器添加事件委托
    const walletList = container.querySelector('#walletsScrollContainer');
    if (walletList) {
        walletList.addEventListener('change', (event) => {
            if (event.target.type === 'checkbox') {
                handleCheckboxChange(event.target);
            }
        });
    }
    
    // 分组标签切换
    const tabButtons = container.querySelectorAll('.group-tab-btn');
    const tabContents = container.querySelectorAll('.group-tab-content');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.getAttribute('data-group');
            tabButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.getAttribute('data-group') === group) {
                    content.classList.add('active');
                }
            });
            updateSelectAllButtonText(container);
        });
    });
    
    // 初始更新选择计数
    updateSelectedWalletCount(container);
}

/**
 * 处理全选按钮点击
 * @param {HTMLElement} container - 容器元素
 * @param {HTMLButtonElement} selectAllBtn - 全选按钮元素
 */
function handleSelectAll(container, selectAllBtn) {
    const activeGroupCheckboxes = Array.from(container.querySelectorAll('.group-tab-content.active input[type="checkbox"]'));
    const allChecked = activeGroupCheckboxes.length > 0 && activeGroupCheckboxes.every(cb => cb.checked);
    
    activeGroupCheckboxes.forEach(cb => {
        cb.checked = !allChecked;
        handleCheckboxChange(cb);
    });
    
    selectAllBtn.textContent = !allChecked ? '取消全选' : '全选';
}

/**
 * 处理反选按钮点击
 * @param {HTMLElement} container - 容器元素
 */
function handleInvertSelection(container) {
    const activeGroupCheckboxes = Array.from(container.querySelectorAll('.group-tab-content.active input[type="checkbox"]'));
    activeGroupCheckboxes.forEach(cb => {
        cb.checked = !cb.checked;
        handleCheckboxChange(cb);
    });
}

/**
 * 处理钱包搜索
 * @param {HTMLElement} container - 容器元素
 * @param {HTMLInputElement} searchInput - 搜索输入框元素
 */
function handleWalletSearch(container, searchInput) {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const walletItems = container.querySelectorAll('.wallet-cb-item');
    const groupTabs = container.querySelector('.wallet-group-tabs');
    const selectAllBtn = container.querySelector('#selectAllWallets');
    const invertBtn = container.querySelector('#invertWalletSelection');
    
    if (searchTerm === '') {
        // 清除搜索，恢复分组视图
        if (groupTabs) groupTabs.style.display = '';
        const activeTab = container.querySelector('.group-tab-btn.active');
        if (activeTab) {
            const groupId = activeTab.getAttribute('data-group');
            container.querySelectorAll('.group-tab-content').forEach(content => {
                content.classList.remove('active');
                if (content.getAttribute('data-group') === groupId) {
                    content.classList.add('active');
                }
            });
        }
        walletItems.forEach(item => item.style.display = '');
        if (selectAllBtn) selectAllBtn.disabled = false;
        if (invertBtn) invertBtn.disabled = false;
    } else {
        // 搜索模式
        if (groupTabs) groupTabs.style.display = 'none';
        container.querySelectorAll('.group-tab-content').forEach(content => {
            content.classList.add('active');
        });
        walletItems.forEach(item => {
            const label = item.querySelector('label')?.textContent.toLowerCase() || '';
            item.style.display = label.includes(searchTerm) ? '' : 'none';
        });
        if (selectAllBtn) selectAllBtn.disabled = true;
        if (invertBtn) invertBtn.disabled = true;
    }
    
    updateSelectedWalletCount(container);
}

/**
 * 处理复选框变化
 * @param {HTMLInputElement} checkbox - 复选框元素
 */
function handleCheckboxChange(checkbox) {
    const walletId = String(checkbox.value);
    if (checkbox.checked) {
        addSelectedWalletId(walletId);
    } else {
        removeSelectedWalletId(walletId);
    }
    
    const container = checkbox.closest('.script-detail-view');
    if (container) {
        updateSelectedWalletCount(container);
        updateSelectAllButtonText(container);
    }
}

/**
 * 更新已选钱包数量显示
 * @param {HTMLElement} container - 容器元素
 */
export function updateSelectedWalletCount(container) {
    const countSpan = container.querySelector('#selectedWalletCount');
    if (!countSpan) return;
    
    const checkedWallets = container.querySelectorAll('#walletSelectionList input[type="checkbox"]:checked');
    countSpan.textContent = checkedWallets.length;
}

/**
 * 更新全选按钮文本
 * @param {HTMLElement} container - 容器元素
 */
function updateSelectAllButtonText(container) {
    const selectAllBtn = container.querySelector('#selectAllWallets');
    if (!selectAllBtn) return;
    
    const visibleCheckboxes = Array.from(container.querySelectorAll('.group-tab-content.active input[type="checkbox"]'));
    const allChecked = visibleCheckboxes.length > 0 && visibleCheckboxes.every(cb => cb.checked);
    
    selectAllBtn.textContent = allChecked ? '取消全选' : '全选';
} 