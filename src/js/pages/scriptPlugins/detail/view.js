// 脚本详情页面视图模块
import { showModal } from '../../../components/modal.js';
import { bindDetailViewEvents } from './events.js';
import { loadWalletList } from './wallets.js';
import { loadScriptList } from './scripts.js';
import { setupScriptLogListener } from './logger.js';
import { setCurrentScriptId } from './state.js';
import { setupProxySelection } from './proxy.js';

/**
 * 切换标签页
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {string} tabId - 要显示的标签页ID
 */
export function switchToTab(container, tabId) {
    if (!container || !tabId) return;
    
    const tabButtons = container.querySelectorAll('.tab-btn, .tab-button');
    const tabPanes = container.querySelectorAll('.tab-pane');
    
    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    tabPanes.forEach(pane => {
        if (pane.id === `${tabId}-tab`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
}

/**
 * 初始化脚本详情页面
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {Object} scriptData - 脚本数据
 */
export function renderScriptDetailView(container, scriptData) {
    if (!container || !scriptData) return;
    
    console.log('初始化脚本详情页面:', scriptData);
    
    // 渲染基础HTML结构
    container.innerHTML = `
        <div class="script-detail-view">
            <!-- 头部区域 -->
            <div class="detail-header">
                <div class="back-to-list">
                    <button class="btn btn-link" id="backToScriptsList">
                        <i class="fas fa-arrow-left"></i> 返回
                    </button>
                </div>
                <div class="detail-title">
                    <h2>${scriptData.name}</h2>
                    <span class="script-status ${scriptData.status || 'active'}">${scriptData.status === 'active' ? '可用' : '不可用'}</span>
                </div>
            </div>
            
            <!-- 主要内容区域 -->
            <div class="detail-content">
                <!-- 脚本列表侧边栏 -->
                <div class="script-list-sidebar">
                    <div class="sidebar-header">
                        <h3>脚本列表</h3>
                        <div class="list-search">
                            <input type="text" placeholder="搜索脚本..." id="scriptListSearch">
                        </div>
                    </div>
                    <ul class="script-list" id="scriptListItems">
                        <!-- 脚本列表将动态填充 -->
                    </ul>
                </div>
                
                <!-- 脚本详情面板 -->
                <div class="script-detail-panel">
                    <!-- 脚本信息区域 -->
                    <div class="script-info-section">
                        <div class="script-preview">
                            ${scriptData.imageUrl 
                                ? `<img src="${scriptData.imageUrl}" alt="${scriptData.name}" class="script-detail-image">`
                                : `<div class="script-icon-large"><i class="fas fa-code"></i></div>`
                            }
                        </div>
                        
                        <div class="script-info">
                            <p class="script-description">${scriptData.description || '无描述'}</p>
                            <div class="script-meta-info">
                                <div class="meta-item">
                                    <span class="meta-label">类型:</span>
                                    <span class="meta-value">${scriptData.type || '本地脚本'}</span>
                                </div>
                                <div class="meta-item">
                                    <span class="meta-label">创建日期:</span>
                                    <span class="meta-value">${scriptData.createdAt || '未知'}</span>
                                </div>
                                <div class="meta-item">
                                    <span class="meta-label">最后更新:</span>
                                    <span class="meta-value">${scriptData.updatedAt || '未知'}</span>
                                </div>
                                <div class="meta-item">
                                    <span class="meta-label">作者:</span>
                                    <span class="meta-value">${scriptData.author || '未知'}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 标签页区域 -->
                    <div class="script-tabs">
                        <div class="tabs-header">
                            <button class="tab-btn active" data-tab="config">配置</button>
                            <button class="tab-btn" data-tab="run">运行</button>
                            <button class="tab-btn" data-tab="log">日志</button>
                        </div>
                        
                        <div class="tab-content">
                            <!-- 配置标签页 -->
                            <div class="tab-pane active" id="config-tab">
                                <div class="config-section">
                                    <h4>脚本配置</h4>
                                    <div class="config-form" id="scriptConfigForm">
                                        <!-- 配置表单将动态生成 -->
                                    </div>
                                    <div class="config-actions">
                                        <button class="btn btn-primary" id="saveScriptConfig">
                                            <i class="fas fa-save"></i> 保存配置
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 运行标签页 -->
                            <div class="tab-pane" id="run-tab">
                                <div class="run-section">
                                    <h4>执行设置</h4>
                                    
                                    <!-- 钱包选择区域 -->
                                    <div class="wallet-selection-section">
                                        <h5>选择钱包</h5>
                                        <div class="wallet-selection-controls">
                                            <div id="walletSelectionList">
                                                <!-- 钱包列表将动态生成 -->
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- 执行设置区域 -->
                                    <div class="execution-settings">
                                        <h5>执行设置</h5>
                                        <div class="setting-group">
                                            <label>网络连接:</label>
                                            <div class="network-option">
                                                <input type="radio" name="networkConnection" id="directConnection" value="direct" checked>
                                                <label for="directConnection">直连</label>
                                            </div>
                                            <div class="network-option">
                                                <input type="radio" name="networkConnection" id="proxyConnection" value="proxy">
                                                <label for="proxyConnection">使用IP代理</label>
                                            </div>
                                        </div>
                                        <div class="setting-group proxy-settings" style="display: none;">
                                            <label>选择代理:</label>
                                            <select id="proxySelect" disabled>
                                                <option value="">加载代理列表中...</option>
                                            </select>
                                            <div class="proxy-info" id="proxyInfo"></div>
                                        </div>
                                    </div>
                                    
                                    <!-- 执行按钮区域 -->
                                    <div class="run-actions">
                                        <button class="btn btn-success" id="startExecutionBtn">
                                            <i class="fas fa-play"></i> 开始执行
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- 日志标签页 -->
                            <div class="tab-pane" id="log-tab">
                                <div class="log-section">
                                    <h4>执行日志</h4>
                                    <div class="log-filter-controls">
                                        <label>筛选:</label>
                                        <button class="log-filter-btn active" data-filter="all">全部</button>
                                        <button class="log-filter-btn" data-filter="info">信息</button>
                                        <button class="log-filter-btn" data-filter="success">成功</button>
                                        <button class="log-filter-btn" data-filter="error">错误</button>
                                        <button class="log-filter-btn" data-filter="warning">警告</button>
                                    </div>
                                    <div class="log-container" id="scriptLogContainer">
                                        <!-- 日志条目将动态生成 -->
                                    </div>
                                    <div class="log-actions">
                                        <button class="btn btn-outline-secondary" id="clearLogBtn">
                                            <i class="fas fa-trash"></i> 清空日志
                                        </button>
                                        <button class="btn btn-outline-secondary" id="exportLogBtn">
                                            <i class="fas fa-download"></i> 导出日志
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // 绑定事件处理
    bindDetailViewEvents(container, scriptData);
    
    // 初始化各个模块
    setTimeout(() => {
        console.log('准备加载钱包列表...');
        loadWalletList(container);
        loadScriptList(container);
        setupScriptLogListener(container);
        setCurrentScriptId(scriptData.id);
        setupProxySelection(container);
    }, 0);
}

// 为了向后兼容，提供原始名称的别名
export const initScriptDetailView = renderScriptDetailView; 