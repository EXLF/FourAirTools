/**
 * 任务配置管理器
 * 负责脚本任务的配置界面生成、事件绑定和数据管理
 */

import { batchTaskConfigs } from '../config/constants.js';
import { getWallets, getProxies, detectIPC } from './ipcHelper.js';

/**
 * 任务配置管理器类
 */
export class TaskConfigManager {
    constructor(pageState) {
        this.pageState = pageState;
        this.eventListeners = new Map(); // 存储事件监听器便于清理
    }

    /**
     * 初始化任务配置
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} scriptType - 脚本类型数据
     * @returns {Object} 初始化的任务配置
     */
    initializeTaskConfig(taskInstanceId, scriptType) {
        if (!batchTaskConfigs[taskInstanceId]) {
            batchTaskConfigs[taskInstanceId] = {
                scriptTypeId: scriptType.id,
                scriptName: scriptType.name,
                accounts: [],
                proxyConfig: {
                    enabled: false,
                    strategy: 'one-to-one',
                    proxies: []
                }
            };
            console.log(`[任务配置] 初始化配置: ${taskInstanceId}`, batchTaskConfigs[taskInstanceId]);
        }
        return batchTaskConfigs[taskInstanceId];
    }

    /**
     * 加载模块配置内容
     * @param {string} moduleId - 模块ID
     * @param {string} taskInstanceId - 任务实例ID
     * @returns {Promise<boolean>} 加载是否成功
     */
    async loadModuleContent(moduleId, taskInstanceId) {
        const moduleContentDisplay = document.getElementById('moduleContentDisplay');
        if (!moduleContentDisplay) {
            console.error('[任务配置] 配置显示容器未找到');
            return false;
        }
        
        const taskConfig = batchTaskConfigs[taskInstanceId];
        if (!taskConfig) {
            console.error('[任务配置] 任务配置不存在:', taskInstanceId);
            return false;
        }

        try {
            console.log('[任务配置] 开始加载配置内容...');
            
            // 获取钱包和代理数据
            const [availableWallets, availableProxies] = await Promise.all([
                getWallets(),
                getProxies()
            ]);
            
            console.log('[任务配置] 数据加载完成:', {
                wallets: availableWallets.length,
                proxies: availableProxies.length
            });

            // 设置代理管理器数据
            this.pageState.proxyManager.setAvailableProxies(availableProxies);
            
            // 预填充代理配置
            await this._prefillProxyConfig(taskConfig, availableProxies);
            
            // 生成配置界面HTML
            const moduleHtml = await this._generateConfigHTML(taskInstanceId, taskConfig, availableWallets);
            
            // 渲染界面
            moduleContentDisplay.innerHTML = moduleHtml;
            
            // 初始化钱包分组功能
            this._initializeWalletGroups();
            
            // 绑定事件处理器
            this._bindConfigEvents(moduleId, taskInstanceId, availableProxies);
            
            // 添加IPC不可用警告
            this._addIPCWarningIfNeeded(moduleContentDisplay);
            
            // 处理无钱包脚本的按钮状态
            this._handleNoWalletScriptButton(taskConfig);
            
            console.log('[任务配置] 配置界面加载完成');
            return true;
            
        } catch (error) {
            console.error('[任务配置] 加载配置内容失败:', error);
            moduleContentDisplay.innerHTML = '<div class="error-message">加载配置失败，请刷新页面重试</div>';
            return false;
        }
    }

    /**
     * 预填充代理配置
     * @param {Object} taskConfig - 任务配置
     * @param {Array} availableProxies - 可用代理列表
     * @private
     */
    async _prefillProxyConfig(taskConfig, availableProxies) {
        if (taskConfig.proxyConfig.proxies.length === 0 && availableProxies.length > 0) {
            taskConfig.proxyConfig.proxies = availableProxies.map(proxy => 
                this.pageState.proxyManager.formatProxy(proxy)
            );
            console.log('[任务配置] 预填充代理列表:', taskConfig.proxyConfig.proxies.length);
        }
    }

    /**
     * 生成配置界面HTML
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     * @param {Array} availableWallets - 可用钱包列表
     * @returns {string} 配置界面HTML
     * @private
     */
    async _generateConfigHTML(taskInstanceId, taskConfig, availableWallets) {
        // 检查当前脚本是否需要钱包
        const scriptRequires = this.pageState.currentBatchScriptType?.requires;
        const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true;
        
        console.log('[任务配置] 脚本配置检查:', {
            scriptName: this.pageState.currentBatchScriptType?.name,
            requiresWallets,
            scriptRequires
        });

        if (requiresWallets) {
            return this._generateWalletBasedConfigHTML(taskInstanceId, taskConfig, availableWallets);
        } else {
            return this._generateSimpleConfigHTML(taskInstanceId, taskConfig);
        }
    }

    /**
     * 生成需要钱包的脚本配置HTML
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     * @param {Array} availableWallets - 可用钱包列表
     * @returns {string} 配置HTML
     * @private
     */
    _generateWalletBasedConfigHTML(taskInstanceId, taskConfig, availableWallets) {
        const walletGroups = this.pageState.walletGroupManager.groupWallets(availableWallets);
        const walletGroupsHtml = this.pageState.walletGroupManager.generateWalletGroupsHTML(walletGroups, taskInstanceId);
        const proxyConfigHtml = this.pageState.proxyManager.generateProxyConfigHTML(taskInstanceId, taskConfig.proxyConfig);
        
        return `
            <div class="module-section">
                <h2><i class="fas fa-wallet"></i> 选择钱包账户</h2>
                <div class="wallet-selection-section">
                    <div class="section-header">
                        <span id="selected-wallet-count-${taskInstanceId}">已选择 0 个钱包</span>
                        <div class="wallet-actions">
                            <button class="btn btn-sm" id="select-all-wallets-${taskInstanceId}">全选</button>
                            <button class="btn btn-sm" id="deselect-all-wallets-${taskInstanceId}">取消全选</button>
                        </div>
                    </div>
                    <div class="wallet-search-box">
                        <input type="text" id="wallet-search-${taskInstanceId}" placeholder="搜索钱包...">
                        <i class="fas fa-search"></i>
                    </div>
                    <div id="wallet-list-${taskInstanceId}" class="wallet-list">
                        ${walletGroupsHtml}
                    </div>
                </div>
                
                ${proxyConfigHtml}
            </div>
        `;
    }

    /**
     * 生成不需要钱包的脚本配置HTML
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     * @returns {string} 配置HTML
     * @private
     */
    _generateSimpleConfigHTML(taskInstanceId, taskConfig) {
        const proxyConfigHtml = this.pageState.proxyManager.generateProxyConfigHTML(taskInstanceId, taskConfig.proxyConfig);
        
        return `
            <div class="module-section">
                <h2><i class="fas fa-cog"></i> 脚本配置</h2>
                <div class="script-info-section">
                    <div class="info-card">
                        <div class="info-header">
                            <i class="fas fa-info-circle"></i>
                            <span>脚本信息</span>
                        </div>
                        <div class="info-content">
                            <p><strong>脚本名称：</strong>${this.pageState.currentBatchScriptType.name}</p>
                            <p><strong>脚本类型：</strong>通用工具脚本</p>
                            <p><strong>说明：</strong>此脚本不需要钱包账户，可直接执行</p>
                        </div>
                    </div>
                </div>
                
                ${proxyConfigHtml}
            </div>
        `;
    }

    /**
     * 初始化钱包分组功能
     * @private
     */
    _initializeWalletGroups() {
        this.pageState.walletGroupManager.initWalletGroupCollapse();
        
        // 确保在DOM更新后再次初始化折叠功能
        setTimeout(() => {
            this.pageState.walletGroupManager.initWalletGroupCollapse();
        }, 100);
    }

    /**
     * 绑定配置事件
     * @param {string} moduleId - 模块ID
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Array} availableProxies - 可用代理列表
     * @private
     */
    _bindConfigEvents(moduleId, taskInstanceId, availableProxies) {
        console.log('[任务配置] 开始绑定配置事件...');
        
        // 清理旧的事件监听器
        this._cleanupEventListeners(taskInstanceId);
        
        const taskConfig = batchTaskConfigs[taskInstanceId];
        const scriptRequires = this.pageState.currentBatchScriptType?.requires;
        const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true;
        
        // 绑定钱包选择事件（仅对需要钱包的脚本）
        if (requiresWallets) {
            this._bindWalletSelectionEvents(taskInstanceId, taskConfig);
        }
        
        // 绑定代理配置事件
        this._bindProxyConfigEvents(taskInstanceId, taskConfig, availableProxies);
        
        console.log('[任务配置] 配置事件绑定完成');
    }

    /**
     * 绑定钱包选择事件
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     * @private
     */
    _bindWalletSelectionEvents(taskInstanceId, taskConfig) {
        const walletsListDiv = document.getElementById(`wallet-list-${taskInstanceId}`);
        if (!walletsListDiv) return;

        // 更新选中计数的函数
        const updateSelectedCount = () => {
            const selectedWallets = walletsListDiv.querySelectorAll('input[name="selected-wallets"]:checked');
            const countElement = document.getElementById(`selected-wallet-count-${taskInstanceId}`);
            if (countElement) {
                countElement.textContent = `已选择 ${selectedWallets.length} 个钱包`;
            }
            
            // 更新任务配置
            taskConfig.accounts = Array.from(selectedWallets).map(cb => cb.value);
            
            // 更新代理策略详情
            this.pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
        };

        // 钱包选择变化事件
        const walletChangeHandler = (e) => {
            if (e.target.name === 'selected-wallets') {
                updateSelectedCount();
                
                // 更新分组复选框状态
                const group = e.target.dataset.group;
                if (group) {
                    this.pageState.walletGroupManager.updateGroupCheckboxState(group, walletsListDiv);
                }
            }
            
            // 分组复选框
            if (e.target.classList.contains('group-checkbox')) {
                const group = e.target.dataset.group;
                this.pageState.walletGroupManager.handleGroupCheckboxChange(group, e.target.checked, walletsListDiv);
                updateSelectedCount();
            }
        };

        walletsListDiv.addEventListener('change', walletChangeHandler);
        this._addEventListener(taskInstanceId, 'walletChange', walletChangeHandler, walletsListDiv);

        // 全选/取消全选按钮
        this._bindWalletBulkActions(taskInstanceId, walletsListDiv);
        
        // 钱包搜索功能
        this._bindWalletSearch(taskInstanceId, walletsListDiv);
    }

    /**
     * 绑定钱包批量操作按钮
     * @param {string} taskInstanceId - 任务实例ID
     * @param {HTMLElement} walletsListDiv - 钱包列表容器
     * @private
     */
    _bindWalletBulkActions(taskInstanceId, walletsListDiv) {
        const selectAllBtn = document.getElementById(`select-all-wallets-${taskInstanceId}`);
        const deselectAllBtn = document.getElementById(`deselect-all-wallets-${taskInstanceId}`);
        
        if (selectAllBtn) {
            const selectAllHandler = () => {
                walletsListDiv.querySelectorAll('input[name="selected-wallets"]').forEach(cb => {
                    cb.checked = true;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                });
            };
            selectAllBtn.addEventListener('click', selectAllHandler);
            this._addEventListener(taskInstanceId, 'selectAll', selectAllHandler, selectAllBtn);
        }
        
        if (deselectAllBtn) {
            const deselectAllHandler = () => {
                walletsListDiv.querySelectorAll('input[name="selected-wallets"]').forEach(cb => {
                    cb.checked = false;
                    cb.dispatchEvent(new Event('change', { bubbles: true }));
                });
            };
            deselectAllBtn.addEventListener('click', deselectAllHandler);
            this._addEventListener(taskInstanceId, 'deselectAll', deselectAllHandler, deselectAllBtn);
        }
    }

    /**
     * 绑定钱包搜索功能
     * @param {string} taskInstanceId - 任务实例ID
     * @param {HTMLElement} walletsListDiv - 钱包列表容器
     * @private
     */
    _bindWalletSearch(taskInstanceId, walletsListDiv) {
        const walletSearchInput = document.getElementById(`wallet-search-${taskInstanceId}`);
        if (!walletSearchInput) return;

        const searchHandler = (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const walletItems = walletsListDiv.querySelectorAll('.wallet-item');
            
            walletItems.forEach(item => {
                const label = item.querySelector('label').textContent.toLowerCase();
                item.style.display = label.includes(searchTerm) ? '' : 'none';
            });
            
            // 更新分组显示
            const walletGroups = walletsListDiv.querySelectorAll('.wallet-group');
            walletGroups.forEach(group => {
                const visibleItems = group.querySelectorAll('.wallet-item:not([style*="display: none"])');
                group.style.display = visibleItems.length > 0 ? '' : 'none';
            });
        };

        walletSearchInput.addEventListener('input', searchHandler);
        this._addEventListener(taskInstanceId, 'walletSearch', searchHandler, walletSearchInput);
    }

    /**
     * 绑定代理配置事件
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     * @param {Array} availableProxies - 可用代理列表
     * @private
     */
    _bindProxyConfigEvents(taskInstanceId, taskConfig, availableProxies) {
        const proxyEnabledCheckbox = document.getElementById(`proxy-enabled-${taskInstanceId}`);
        const proxyConfigContent = document.getElementById(`proxy-config-content-${taskInstanceId}`);
        const proxyStrategySelect = document.getElementById(`proxy-strategy-${taskInstanceId}`);
        const refreshProxyBtn = document.getElementById(`refresh-proxy-list-${taskInstanceId}`);
        
        // 代理启用/禁用事件
        if (proxyEnabledCheckbox) {
            const proxyEnabledHandler = (e) => {
                taskConfig.proxyConfig.enabled = e.target.checked;
                if (proxyConfigContent) {
                    proxyConfigContent.style.display = e.target.checked ? '' : 'none';
                }
                if (e.target.checked) {
                    this.pageState.proxyManager.reloadProxyList(taskInstanceId, taskConfig);
                    this.pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
                }
            };
            proxyEnabledCheckbox.addEventListener('change', proxyEnabledHandler);
            this._addEventListener(taskInstanceId, 'proxyEnabled', proxyEnabledHandler, proxyEnabledCheckbox);
        }
        
        // 代理策略变更事件
        if (proxyStrategySelect) {
            const proxyStrategyHandler = (e) => {
                taskConfig.proxyConfig.strategy = e.target.value;
                this.pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
            };
            proxyStrategySelect.addEventListener('change', proxyStrategyHandler);
            this._addEventListener(taskInstanceId, 'proxyStrategy', proxyStrategyHandler, proxyStrategySelect);
        }
        
        // 刷新代理列表按钮
        if (refreshProxyBtn) {
            const refreshProxyHandler = async () => {
                try {
                    const proxies = await getProxies();
                    this.pageState.proxyManager.setAvailableProxies(proxies);
                    this.pageState.proxyManager.reloadProxyList(taskInstanceId, taskConfig);
                } catch (error) {
                    console.error('[任务配置] 刷新代理列表失败:', error);
                }
            };
            refreshProxyBtn.addEventListener('click', refreshProxyHandler);
            this._addEventListener(taskInstanceId, 'refreshProxy', refreshProxyHandler, refreshProxyBtn);
        }
        
        // 初始化代理列表显示
        if (taskConfig.proxyConfig.enabled) {
            this.pageState.proxyManager.reloadProxyList(taskInstanceId, taskConfig);
            this.pageState.proxyManager.updateProxyStrategyDetails(taskInstanceId, taskConfig);
        }
    }

    /**
     * 添加IPC不可用警告
     * @param {HTMLElement} moduleContentDisplay - 配置显示容器
     * @private
     */
    _addIPCWarningIfNeeded(moduleContentDisplay) {
        if (!detectIPC()) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'warning-banner';
            warningDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 注意：当前使用的是模拟数据，因为IPC通信未配置。真实数据不可用。';
            moduleContentDisplay.insertBefore(warningDiv, moduleContentDisplay.firstChild);
        }
    }

    /**
     * 处理无钱包脚本的按钮状态
     * @param {Object} taskConfig - 任务配置
     * @private
     */
    _handleNoWalletScriptButton(taskConfig) {
        const scriptRequires = this.pageState.currentBatchScriptType?.requires;
        const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true;
        
        if (!requiresWallets) {
            setTimeout(() => {
                const startTaskButton = document.getElementById('start-execution-btn');
                if (startTaskButton) {
                    startTaskButton.disabled = false;
                    console.log('[任务配置] 不需要钱包的脚本，已启用执行按钮');
                }
            }, 100);
        }
    }

    /**
     * 保存当前模块配置数据
     * @param {string} taskInstanceId - 任务实例ID
     * @returns {Object} 保存的配置数据
     */
    saveCurrentModuleData(taskInstanceId) {
        const taskConfig = batchTaskConfigs[taskInstanceId];
        if (!taskConfig) {
            console.warn('[任务配置] 任务配置不存在，无法保存:', taskInstanceId);
            return null;
        }
        
        try {
            // 保存钱包选择
            const selectedWallets = document.querySelectorAll(`input[name="selected-wallets"]:checked`);
            taskConfig.accounts = Array.from(selectedWallets).map(cb => cb.value);
            
            // 保存代理配置
            const proxyEnabledCheckbox = document.getElementById(`proxy-enabled-${taskInstanceId}`);
            if (proxyEnabledCheckbox) {
                taskConfig.proxyConfig.enabled = proxyEnabledCheckbox.checked;
            }
            
            const proxyStrategySelect = document.getElementById(`proxy-strategy-${taskInstanceId}`);
            if (proxyStrategySelect) {
                taskConfig.proxyConfig.strategy = proxyStrategySelect.value;
            }
            
            console.log(`[任务配置] 保存任务配置 ${taskInstanceId}:`, {
                scriptName: taskConfig.scriptName,
                accountCount: taskConfig.accounts.length,
                proxyEnabled: taskConfig.proxyConfig.enabled,
                proxyStrategy: taskConfig.proxyConfig.strategy
            });
            
            return taskConfig;
        } catch (error) {
            console.error('[任务配置] 保存配置数据失败:', error);
            return null;
        }
    }

    /**
     * 获取任务配置
     * @param {string} taskInstanceId - 任务实例ID
     * @returns {Object|null} 任务配置
     */
    getTaskConfig(taskInstanceId) {
        return batchTaskConfigs[taskInstanceId] || null;
    }

    /**
     * 验证任务配置
     * @param {string} taskInstanceId - 任务实例ID
     * @returns {Object} 验证结果 {valid: boolean, errors: string[]}
     */
    validateTaskConfig(taskInstanceId) {
        const taskConfig = batchTaskConfigs[taskInstanceId];
        const errors = [];
        
        if (!taskConfig) {
            errors.push('任务配置不存在');
            return { valid: false, errors };
        }
        
        // 检查脚本类型是否需要钱包
        const scriptRequires = this.pageState.currentBatchScriptType?.requires;
        const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true;
        
        if (requiresWallets && taskConfig.accounts.length === 0) {
            errors.push('请至少选择一个钱包账户');
        }
        
        if (taskConfig.proxyConfig.enabled) {
            if (taskConfig.proxyConfig.proxies.length === 0) {
                errors.push('已启用代理，但代理列表为空。请添加代理或禁用代理功能');
            }
            
            if (taskConfig.proxyConfig.strategy === 'one-to-one' && 
                taskConfig.proxyConfig.proxies.length < taskConfig.accounts.length) {
                errors.push(`一对一代理策略需要至少与钱包数量相同的代理IP。当前钱包数量: ${taskConfig.accounts.length}，当前代理数量: ${taskConfig.proxyConfig.proxies.length}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * 添加事件监听器到管理列表
     * @param {string} taskInstanceId - 任务实例ID
     * @param {string} eventName - 事件名称
     * @param {Function} handler - 事件处理器
     * @param {HTMLElement} element - 目标元素
     * @private
     */
    _addEventListener(taskInstanceId, eventName, handler, element) {
        if (!this.eventListeners.has(taskInstanceId)) {
            this.eventListeners.set(taskInstanceId, []);
        }
        
        this.eventListeners.get(taskInstanceId).push({
            eventName,
            handler,
            element,
            type: 'change' // 默认事件类型，可以扩展
        });
    }

    /**
     * 清理特定任务的事件监听器
     * @param {string} taskInstanceId - 任务实例ID
     * @private
     */
    _cleanupEventListeners(taskInstanceId) {
        const listeners = this.eventListeners.get(taskInstanceId);
        if (listeners) {
            listeners.forEach(({ handler, element, type }) => {
                try {
                    element.removeEventListener(type, handler);
                } catch (error) {
                    console.warn('[任务配置] 清理事件监听器失败:', error);
                }
            });
            this.eventListeners.delete(taskInstanceId);
            console.log(`[任务配置] 已清理任务 ${taskInstanceId} 的事件监听器`);
        }
    }

    /**
     * 清理所有事件监听器
     */
    cleanup() {
        for (const taskInstanceId of this.eventListeners.keys()) {
            this._cleanupEventListeners(taskInstanceId);
        }
        console.log('[任务配置] 所有事件监听器已清理');
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        const totalConfigs = Object.keys(batchTaskConfigs).length;
        const activeListeners = this.eventListeners.size;
        
        return {
            totalConfigs,
            activeListeners,
            configDetails: Object.keys(batchTaskConfigs).map(id => ({
                id,
                accountCount: batchTaskConfigs[id].accounts?.length || 0,
                proxyEnabled: batchTaskConfigs[id].proxyConfig?.enabled || false
            }))
        };
    }
}

/**
 * 创建任务配置管理器实例并暴露全局函数
 * @param {Object} pageState - 页面状态对象
 * @returns {TaskConfigManager} 任务配置管理器实例
 */
export function setupGlobalTaskConfigManager(pageState) {
    const taskConfigManager = new TaskConfigManager(pageState);
    
    // 暴露核心功能到全局
    window.FATaskConfigManager = taskConfigManager;
    
    // 暴露向后兼容的全局函数
    window.loadModuleContent = (moduleId, taskInstanceId) => {
        return taskConfigManager.loadModuleContent(moduleId, taskInstanceId);
    };
    
    window.saveCurrentModuleData = (taskInstanceId) => {
        return taskConfigManager.saveCurrentModuleData(taskInstanceId);
    };
    
    window.validateTaskConfig = (taskInstanceId) => {
        return taskConfigManager.validateTaskConfig(taskInstanceId);
    };
    
    // 调试功能
    window.__debugTaskConfig = () => {
        console.log('=== 任务配置管理器调试信息 ===');
        console.log('统计信息:', taskConfigManager.getStats());
        console.log('所有配置:', batchTaskConfigs);
        console.log('事件监听器:', taskConfigManager.eventListeners);
    };
    
    console.log('[任务配置] TaskConfigManager 全局函数已设置');
    return taskConfigManager;
} 