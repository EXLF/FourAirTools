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
        
        // 更新代理策略详情
        this.updateProxyStrategyDetails(taskInstanceId, taskConfig);
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
        
        // 创建表格形式的代理列表
        const tableHtml = `
            <table class="proxy-table">
                <thead>
                    <tr>
                        <th width="40"><input type="checkbox" id="select-all-proxies-table-${taskInstanceId}"></th>
                        <th width="60">ID</th>
                        <th width="80">类型</th>
                        <th>主机地址</th>
                        <th width="80">端口</th>
                        <th width="100">状态</th>
                        <th>位置</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.availableProxies.map(proxy => {
                        const isSelected = taskConfig.proxyConfig.proxies.includes(this.formatProxy(proxy));
                        const location = proxy.country ? 
                            `${proxy.country}${proxy.city ? ' - ' + proxy.city : ''}` : 
                            '未知';
                        
                        return `
                            <tr class="proxy-row ${isSelected ? 'selected' : ''}">
                                <td><input type="checkbox" 
                                    name="selected-proxies" 
                                    value="${proxy.id}"
                                    ${isSelected ? 'checked' : ''}></td>
                                <td>${proxy.name || proxy.id}</td>
                                <td><span class="proxy-type-badge ${proxy.type ? proxy.type.toLowerCase() : ''}">${proxy.type || 'HTTP'}</span></td>
                                <td>${proxy.host}</td>
                                <td>${proxy.port}</td>
                                <td><span class="proxy-status ${this.getProxyStatusClass(proxy.status)}">${this.getProxyStatusText(proxy.status)}</span></td>
                                <td class="proxy-location">${location}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
        
        proxyListDiv.innerHTML = tableHtml;
        
        // 绑定全选复选框事件
        const selectAllCheckbox = document.getElementById(`select-all-proxies-table-${taskInstanceId}`);
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = proxyListDiv.querySelectorAll('input[name="selected-proxies"]');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = e.target.checked;
                });
                this.updateSelectedProxies(taskInstanceId, taskConfig);
            });
        }
        
        // 绑定单个复选框事件
        const checkboxes = proxyListDiv.querySelectorAll('input[name="selected-proxies"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                this.updateSelectedProxies(taskInstanceId, taskConfig);
                
                // 更新全选复选框状态
                const allChecked = Array.from(checkboxes).every(cb => cb.checked);
                const someChecked = Array.from(checkboxes).some(cb => cb.checked);
                if (selectAllCheckbox) {
                    selectAllCheckbox.checked = allChecked;
                    selectAllCheckbox.indeterminate = someChecked && !allChecked;
                }
            });
        });
        
        // 绑定行点击事件
        const rows = proxyListDiv.querySelectorAll('.proxy-row');
        rows.forEach(row => {
            row.addEventListener('click', (e) => {
                // 如果点击的是复选框本身，不处理
                if (e.target.type === 'checkbox') return;
                
                const checkbox = row.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event('change'));
                }
            });
        });
        
        // 初始化时更新选中的代理
        this.updateSelectedProxies(taskInstanceId, taskConfig);
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
            <div class="proxy-config-section">
                <div class="config-header">
                    <h3><i class="fas fa-globe"></i> 代理配置</h3>
                    <label class="switch">
                        <input type="checkbox" id="proxy-enabled-${taskInstanceId}" ${proxyConfig.enabled ? 'checked' : ''}>
                        <span class="slider"></span>
                    </label>
                </div>
                
                <div class="proxy-config-content" id="proxy-config-content-${taskInstanceId}" style="${proxyConfig.enabled ? '' : 'display: none;'}">
                    <div class="proxy-strategy">
                        <label>代理策略:</label>
                        <select id="proxy-strategy-${taskInstanceId}" class="form-select">
                            <option value="one-to-one" ${proxyConfig.strategy === 'one-to-one' ? 'selected' : ''}>一对一（每个钱包固定代理）</option>
                            <option value="one-to-many" ${proxyConfig.strategy === 'one-to-many' ? 'selected' : ''}>一对多（轮流使用代理池）</option>
                        </select>
                    </div>
                    
                    <div id="proxy-strategy-details-${taskInstanceId}" class="strategy-details"></div>
                    
                    <div class="proxy-list-section">
                        <div class="section-header">
                            <span id="selected-proxy-count-${taskInstanceId}">已选择 ${proxyConfig.proxies.length} 个代理</span>
                            <button class="btn btn-sm" id="refresh-proxy-list-${taskInstanceId}">
                                <i class="fas fa-sync"></i> 刷新列表
                            </button>
                        </div>
                        <div id="proxy-list-${taskInstanceId}" class="proxy-list">
                            <!-- 代理列表将动态加载 -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
} 