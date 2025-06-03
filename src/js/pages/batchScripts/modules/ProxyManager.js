/**
 * 代理管理模块
 */

import { PROXY_STATUS_CLASSES, PROXY_STATUS_TEXT } from '../config/constants.js';

export class ProxyManager {
    constructor() {
        this.availableProxies = [];
    }

    /**
     * 设置可用代理列表
     * @param {Array} proxies - 代理列表
     */
    setAvailableProxies(proxies) {
        this.availableProxies = proxies;
    }

    /**
     * 格式化代理对象为字符串
     * @param {Object|string} proxy - 代理对象或字符串
     * @returns {string} 格式化后的代理字符串
     */
    formatProxy(proxy) {
        if (!proxy) return '无代理';
        
        // 如果是对象形式的代理
        if (typeof proxy === 'object') {
            // 获取协议类型 - 支持 protocol 或 type 字段
            const protocol = (proxy.protocol || proxy.type || '').toLowerCase();
            
            // 标准格式
            if (protocol && proxy.host && proxy.port) {
                // 优先使用解密后的密码
                const password = proxy.decryptedPassword || proxy.password;
                if (proxy.username && password) {
                    return `${protocol}://${proxy.username}:${password}@${proxy.host}:${proxy.port}`;
                }
                return `${protocol}://${proxy.host}:${proxy.port}`;
            }
            // URL格式
            if (proxy.url) {
                return proxy.url;
            }
            // proxy_url格式
            if (proxy.proxy_url) {
                return proxy.proxy_url;
            }
            // 如果有name属性，但没有完整的代理信息，才返回name
            if (proxy.name && (!protocol || !proxy.host || !proxy.port)) {
                return proxy.name;
            }
        }
        
        // 字符串格式
        if (typeof proxy === 'string') {
            return proxy;
        }
        
        // 其他情况
        return JSON.stringify(proxy);
    }

    /**
     * 获取代理状态样式类
     * @param {string} status - 代理状态
     * @returns {string} CSS类名
     */
    getProxyStatusClass(status) {
        return PROXY_STATUS_CLASSES[status] || PROXY_STATUS_CLASSES.default;
    }

    /**
     * 获取代理状态文本
     * @param {string} status - 代理状态
     * @returns {string} 状态文本
     */
    getProxyStatusText(status) {
        return PROXY_STATUS_TEXT[status] || PROXY_STATUS_TEXT.default;
    }

    /**
     * 更新选中的代理
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     */
    updateSelectedProxies(taskInstanceId, taskConfig) {
        const proxyListDiv = document.getElementById(`proxy-list-${taskInstanceId}`);
        if (!proxyListDiv) return;
        
        const selectedProxies = [];
        const checkboxes = proxyListDiv.querySelectorAll('input[name="selected-proxies"]:checked');
        
        checkboxes.forEach(checkbox => {
            const proxyId = checkbox.value;
            // 确保ID比较时类型一致
            const proxy = this.availableProxies.find(p => String(p.id) === String(proxyId));
            if (proxy) {
                selectedProxies.push(this.formatProxy(proxy));
            }
        });
        
        taskConfig.proxyConfig.proxies = selectedProxies;
        
        // 更新选中计数
        const selectedCountElement = document.getElementById(`selected-proxy-count-${taskInstanceId}`);
        if (selectedCountElement) {
            selectedCountElement.textContent = `已选择 ${selectedProxies.length} 个代理`;
        }
        
        // 更新切换按钮状态
        this.updateToggleButtonState(taskInstanceId);
        
        // 更新代理策略详情
        this.updateProxyStrategyDetails(taskInstanceId, taskConfig);
    }

    /**
     * 更新切换按钮状态
     * @param {string} taskInstanceId - 任务实例ID
     */
    updateToggleButtonState(taskInstanceId) {
        const toggleAllBtn = document.getElementById(`toggle-all-proxies-${taskInstanceId}`);
        const proxyListDiv = document.getElementById(`proxy-list-${taskInstanceId}`);
        
        if (!toggleAllBtn || !proxyListDiv) return;
        
        const checkboxes = proxyListDiv.querySelectorAll('input[name="selected-proxies"]');
        const checkedCount = proxyListDiv.querySelectorAll('input[name="selected-proxies"]:checked').length;
        const totalCount = checkboxes.length;
        
        if (checkedCount === 0) {
            toggleAllBtn.textContent = '全选';
            toggleAllBtn.className = 'btn-toggle';
        } else if (checkedCount === totalCount) {
            toggleAllBtn.textContent = '全不选';
            toggleAllBtn.className = 'btn-toggle active';
        } else {
            toggleAllBtn.textContent = '全选';
            toggleAllBtn.className = 'btn-toggle partial';
        }
    }

    /**
     * 重新加载代理列表
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     */
    reloadProxyList(taskInstanceId, taskConfig) {
        const proxyListDiv = document.getElementById(`proxy-list-${taskInstanceId}`);
        if (!proxyListDiv) return;
        
        proxyListDiv.innerHTML = '';
        
        if (this.availableProxies.length === 0) {
            proxyListDiv.innerHTML = '<div class="no-data-message">暂无可用代理</div>';
            return;
        }
        
        // 创建代理列表容器
        const listHtml = `
            <div class="proxy-list-container">
                ${this.availableProxies.map(proxy => {
                    const isSelected = taskConfig.proxyConfig.proxies.includes(this.formatProxy(proxy));
                    const location = proxy.country ? 
                        `${proxy.country}${proxy.city ? ' - ' + proxy.city : ''}` : 
                        '未知';
                    
                    return `
                        <div class="proxy-item ${isSelected ? 'selected' : ''}">
                            <label>
                                <input type="checkbox" 
                                    name="selected-proxies" 
                                    value="${proxy.id}"
                                    ${isSelected ? 'checked' : ''}>
                                <div class="proxy-info">
                                    <span class="proxy-address">${proxy.host}:${proxy.port}</span>
                                    <span class="proxy-location">${location}</span>
                                </div>
                            </label>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
        
        proxyListDiv.innerHTML = listHtml;
        
        // 绑定复选框事件
        const checkboxes = proxyListDiv.querySelectorAll('input[name="selected-proxies"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedProxies(taskInstanceId, taskConfig);
            });
        });
        
        // 绑定全选/反选按钮事件
        this.bindProxyBulkActions(taskInstanceId, taskConfig);
        
        // 初始化时更新选中的代理
        this.updateSelectedProxies(taskInstanceId, taskConfig);
    }

    /**
     * 绑定代理批量操作按钮事件
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     */
    bindProxyBulkActions(taskInstanceId, taskConfig) {
        const toggleAllBtn = document.getElementById(`toggle-all-proxies-${taskInstanceId}`);
        const proxyListDiv = document.getElementById(`proxy-list-${taskInstanceId}`);
        
        if (!proxyListDiv || !toggleAllBtn) return;
        
        // 智能切换全选/反选
        toggleAllBtn.addEventListener('click', () => {
            const checkboxes = proxyListDiv.querySelectorAll('input[name="selected-proxies"]');
            const checkedCount = proxyListDiv.querySelectorAll('input[name="selected-proxies"]:checked').length;
            const shouldSelectAll = checkedCount < checkboxes.length;
            
            checkboxes.forEach(checkbox => {
                const shouldCheck = shouldSelectAll;
                if (checkbox.checked !== shouldCheck) {
                    checkbox.checked = shouldCheck;
                    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });
            
            // 手动触发更新，确保状态同步
            this.updateSelectedProxies(taskInstanceId, taskConfig);
            
            const action = shouldSelectAll ? '全选' : '全不选';
            console.log(`[代理管理] ${action}所有代理 (${checkboxes.length} 个)`);
        });
        
        // 初始化按钮状态
        setTimeout(() => this.updateToggleButtonState(taskInstanceId), 100);
    }

    /**
     * 更新代理策略详情显示
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} taskConfig - 任务配置
     */
    updateProxyStrategyDetails(taskInstanceId, taskConfig) {
        const strategyDetailsDiv = document.getElementById(`proxy-strategy-details-${taskInstanceId}`);
        if (!strategyDetailsDiv) return;
        
        const { strategy, proxies } = taskConfig.proxyConfig;
        const accountCount = taskConfig.accounts.length;
        
        let detailsHtml = '';
        if (strategy === 'one-to-one') {
            const isValid = proxies.length >= accountCount;
            detailsHtml = `
                <div class="strategy-info ${isValid ? 'valid' : 'invalid'}">
                    <i class="fas fa-${isValid ? 'check-circle' : 'exclamation-triangle'}"></i>
                    一对一模式需要至少 ${accountCount} 个代理（当前: ${proxies.length} 个）
                </div>
            `;
        } else if (strategy === 'one-to-many') {
            detailsHtml = `
                <div class="strategy-info valid">
                    <i class="fas fa-info-circle"></i>
                    一对多模式将在 ${proxies.length} 个代理间轮流使用
                </div>
            `;
        }
        
        strategyDetailsDiv.innerHTML = detailsHtml;
    }

    /**
     * 生成代理配置HTML
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} proxyConfig - 代理配置
     * @returns {string} HTML字符串
     */
    generateProxyConfigHTML(taskInstanceId, proxyConfig) {
        return `
            <div class="proxy-section">
                <div class="proxy-header">
                    <label>
                        <input type="checkbox" id="proxy-enabled-${taskInstanceId}" ${proxyConfig.enabled ? 'checked' : ''}>
                        <i class="fas fa-globe"></i> 启用代理
                    </label>
                </div>
                
                <div class="proxy-config-content" id="proxy-config-content-${taskInstanceId}" style="${proxyConfig.enabled ? '' : 'display: none;'}">
                    <div class="proxy-strategy">
                        <label>代理策略:</label>
                        <select id="proxy-strategy-${taskInstanceId}">
                            <option value="one-to-one" ${proxyConfig.strategy === 'one-to-one' ? 'selected' : ''}>一对一（每个钱包固定代理）</option>
                            <option value="one-to-many" ${proxyConfig.strategy === 'one-to-many' ? 'selected' : ''}>一对多（轮流使用代理池）</option>
                        </select>
                    </div>
                    
                    <div id="proxy-strategy-details-${taskInstanceId}" class="proxy-strategy-details"></div>
                    
                    <div class="proxy-list-header">
                        <span class="proxy-list-title" id="selected-proxy-count-${taskInstanceId}">已选择 ${proxyConfig.proxies.length} 个代理</span>
                        <div class="proxy-actions">
                            <button class="btn-toggle" id="toggle-all-proxies-${taskInstanceId}">全选</button>
                            <button class="btn-refresh" id="refresh-proxy-list-${taskInstanceId}">
                                <i class="fas fa-sync-alt"></i>
                                <span>刷新</span>
                            </button>
                        </div>
                    </div>
                    <div id="proxy-list-${taskInstanceId}" class="proxy-list">
                        <!-- 代理列表将动态加载 -->
                    </div>
                </div>
            </div>
        `;
    }
} 