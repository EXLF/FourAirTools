/**
 * 钱包分组管理模块
 */

export class WalletGroupManager {
    constructor() {
        this.groupHeaders = null;
        this.boundHandleGroupHeaderClick = this.handleGroupHeaderClick.bind(this);
    }

    /**
     * 初始化钱包分组折叠功能
     */
    initWalletGroupCollapse() {
        this.groupHeaders = document.querySelectorAll('.wallet-group-header');
        
        // 移除可能存在的旧的事件监听器
        this.groupHeaders.forEach((header, index) => {
            header.removeEventListener('click', this.boundHandleGroupHeaderClick);
            
            // 添加新的事件监听器
            header.addEventListener('click', this.boundHandleGroupHeaderClick);
            
            // 设置默认状态：第一个组展开，其他组折叠
            const groupContent = header.nextElementSibling;
            const icon = header.querySelector('i');
            
            if (groupContent && groupContent.classList.contains('wallet-group-content')) {
                if (index === 0) {
                    // 第一个分组默认展开
                    groupContent.style.display = 'block';
                    if (icon) icon.classList.add('rotated');
                } else {
                    // 其他分组默认折叠
                    groupContent.style.display = 'none';
                    if (icon) icon.classList.remove('rotated');
                }
            }
        });
        
        console.log(`初始化了 ${this.groupHeaders.length} 个钱包分组的折叠功能`);
    }

    /**
     * 处理分组头部点击事件
     * @param {Event} event - 点击事件
     */
    handleGroupHeaderClick(event) {
        const header = event.currentTarget;
        const icon = header.querySelector('i');
        const groupContent = header.nextElementSibling;
        
        // 如果点击的是复选框或标签，不折叠
        if (event.target.type === 'checkbox' || 
            event.target.classList.contains('group-checkbox') ||
            event.target.tagName === 'LABEL') {
            return;
        }
        
        // 只有点击图标或分组名称时才折叠
        if (event.target === icon || 
            event.target.classList.contains('group-name') ||
            event.target === header) {
            
            if (groupContent && groupContent.classList.contains('wallet-group-content')) {
                const isVisible = groupContent.style.display !== 'none' && groupContent.style.display !== '';
                
                if (isVisible) {
                    groupContent.style.display = 'none';
                    if (icon) icon.classList.remove('rotated');
                } else {
                    groupContent.style.display = 'block';
                    if (icon) icon.classList.add('rotated');
                }
            }
        }
    }

    /**
     * 处理分组复选框变化
     * @param {string} group - 分组名称
     * @param {boolean} checked - 是否选中
     * @param {HTMLElement} walletsListDiv - 钱包列表容器
     */
    handleGroupCheckboxChange(group, checked, walletsListDiv) {
        const groupWallets = walletsListDiv.querySelectorAll(`input[name="selected-wallets"][data-group="${group}"]`);
        groupWallets.forEach(walletCheckbox => {
            walletCheckbox.checked = checked;
            // 触发change事件以更新选中计数等
            walletCheckbox.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    /**
     * 更新分组复选框状态
     * @param {string} group - 分组名称
     * @param {HTMLElement} walletsListDiv - 钱包列表容器
     */
    updateGroupCheckboxState(group, walletsListDiv) {
        const groupCheckbox = walletsListDiv.querySelector(`input[type="checkbox"].group-checkbox[data-group="${group}"]`);
        const groupWallets = walletsListDiv.querySelectorAll(`input[name="selected-wallets"][data-group="${group}"]`);
        const checkedGroupWallets = Array.from(groupWallets).filter(cb => cb.checked);
        
        if (groupCheckbox) {
            groupCheckbox.indeterminate = false;
            
            if (checkedGroupWallets.length === 0) {
                groupCheckbox.checked = false;
            } else if (checkedGroupWallets.length === groupWallets.length) {
                groupCheckbox.checked = true;
            } else {
                groupCheckbox.checked = false;
                groupCheckbox.indeterminate = true;
            }
        }
    }

    /**
     * 分组钱包数据
     * @param {Array} wallets - 钱包列表
     * @returns {Object} 分组后的钱包数据
     */
    groupWallets(wallets) {
        const walletGroups = {};
        wallets.forEach(wallet => {
            const group = wallet.group || wallet.groupName || '默认分组';
            if (!walletGroups[group]) {
                walletGroups[group] = [];
            }
            walletGroups[group].push(wallet);
        });
        return walletGroups;
    }

    /**
     * 生成钱包分组HTML
     * @param {Object} walletGroups - 分组后的钱包数据
     * @param {string} taskInstanceId - 任务实例ID
     * @returns {string} HTML字符串
     */
    generateWalletGroupsHTML(walletGroups, taskInstanceId) {
        return Object.keys(walletGroups).length > 0
            ? Object.entries(walletGroups).map(([group, wallets]) => `
                <div class="wallet-group">
                    <div class="wallet-group-header" data-group="${group}">
                        <i class="fas fa-chevron-right"></i>
                        <input type="checkbox" class="group-checkbox" data-group="${group}">
                        <span class="group-name">${group} (${wallets.length})</span>
                    </div>
                    <div class="wallet-group-content">
                        ${wallets.map(wallet => `
                            <div class="wallet-item">
                                <input type="checkbox" 
                                    id="wallet-${wallet.id}-${taskInstanceId}" 
                                    name="selected-wallets" 
                                    value="${wallet.id}"
                                    data-group="${group}">
                                <label for="wallet-${wallet.id}-${taskInstanceId}">
                                    ${wallet.name || '未命名钱包'} ${wallet.group ? `(${wallet.group})` : ''} ${wallet.address}
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')
            : '<div class="no-wallets-message">暂无可用钱包</div>';
    }

    /**
     * 清理资源
     */
    destroy() {
        if (this.groupHeaders) {
            this.groupHeaders.forEach(header => {
                header.removeEventListener('click', this.boundHandleGroupHeaderClick);
            });
        }
    }
} 