// 脚本详情页面组件
import { showModal } from '../../components/modal.js';

/**
 * 切换标签页
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {string} tabId - 要显示的标签页ID
 */
function switchToTab(container, tabId) {
    if (!container || !tabId) return;
    
    // 获取所有标签按钮和内容面板
    const tabButtons = container.querySelectorAll('.tab-btn, .tab-button');
    const tabPanes = container.querySelectorAll('.tab-pane');
    
    // 更新按钮状态
    tabButtons.forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // 更新面板显示
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
    
    // 渲染脚本详情页面
    container.innerHTML = `
        <div class="script-detail-view">
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
            
            <div class="detail-content">
                <div class="script-list-sidebar">
                    <div class="sidebar-header">
                        <h3>脚本列表</h3>
                        <div class="list-search">
                            <input type="text" placeholder="搜索脚本..." id="scriptListSearch">
                        </div>
                    </div>
                    <ul class="script-list" id="scriptListItems">
                        <!-- 这里将动态填充脚本列表 -->
                    </ul>
                </div>
                
                <div class="script-detail-panel">
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
                    
                    <div class="script-tabs">
                        <div class="tabs-header">
                            <button class="tab-btn active" data-tab="config">配置</button>
                            <button class="tab-btn" data-tab="run">运行</button>
                            <button class="tab-btn" data-tab="log">日志</button>
                        </div>
                        
                        <div class="tab-content">
                            <div class="tab-pane active" id="config-tab">
                                <div class="config-section">
                                    <h4>脚本配置</h4>
                                    <div class="config-form" id="scriptConfigForm">
                                        <!-- 配置选项将根据脚本类型动态生成 -->
                                        <div class="config-form-group">
                                            <label>示例配置项 A:</label>
                                            <input type="text" placeholder="输入值...">
                                        </div>
                                        <div class="config-form-group">
                                            <label>示例配置项 B:</label>
                                            <select><option>选项1</option><option>选项2</option></select>
                                        </div>
                                        <div class="config-form-group">
                                            <label>示例配置项 C:</label>
                                            <input type="checkbox"> 启用此功能
                                        </div>
                                    </div>
                                    
                                    <div class="config-actions">
                                        <button class="btn btn-primary" id="saveScriptConfig">
                                            <i class="fas fa-save"></i> 保存配置
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="tab-pane" id="run-tab">
                                <div class="run-section">
                                    <h4>执行设置</h4>
                                    
                                    <div class="wallet-selection-section">
                                        <h5>选择钱包</h5>
                                        <div class="wallet-selection-controls">
                                            <!-- 钱包选择区域，通过loadWalletList函数填充 -->
                                            <div id="walletSelectionList">
                                                <!-- 钱包列表将在这里动态生成 -->
                                            </div>
                                        </div>
                                    </div>
                                    
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
                                    
                                    <div class="run-actions">
                                        <button class="btn btn-success" id="startExecutionBtn">
                                            <i class="fas fa-play"></i> 开始执行
                                        </button>
                                    </div>
                                </div>
                            </div>
                            
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
                                        <!-- 日志条目将在这里动态生成 -->
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
    
    // 立即加载钱包列表（确保在DOM渲染完成后调用）
    setTimeout(() => {
        console.log('准备加载钱包列表...');
        loadWalletList(container);
        
        // 加载脚本列表
        loadScriptList(container);
        
        // 添加脚本日志监听
        setupScriptLogListener(container);
        
        // 设置当前脚本ID
        setCurrentScriptId(scriptData.id);
        
        // 设置代理选择界面
        setupProxySelection(container);
    }, 0);
}

// 为了向后兼容，提供原始名称的别名
export const initScriptDetailView = renderScriptDetailView;

/**
 * 绑定详情页面的事件处理
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {Object} scriptData - 当前脚本数据
 */
function bindDetailViewEvents(container, scriptData) {
    // 标签切换
    const tabBtns = container.querySelectorAll('.tab-btn');
    const tabPanes = container.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 设置活动按钮
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 显示对应标签内容
            const targetTab = btn.getAttribute('data-tab');
            tabPanes.forEach(pane => {
                if (pane.id === `${targetTab}-tab`) {
                    pane.classList.add('active');
                } else {
                    pane.classList.remove('active');
                }
            });
        });
    });
    
    // 确保默认标签显示正确
    const defaultTabBtn = container.querySelector('.tab-btn.active') || container.querySelector('.tab-btn');
    if (defaultTabBtn) {
        defaultTabBtn.click();
    }
    
    // 返回按钮
    const backBtn = container.querySelector('#backToScriptsList');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            // 返回到卡片视图
            const currentPage = document.querySelector('.main-content');
            currentPage.innerHTML = '';
            loadScriptList(currentPage);
        });
    }
    
    // 运行脚本按钮
    const runBtn = container.querySelector('#startExecutionBtn');
    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            // 禁用按钮并修改状态
            runBtn.disabled = true;
            runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中...';
            
            // 获取所有选中的钱包
            const selectedWallets = Array.from(container.querySelectorAll('#walletSelectionList input[type="checkbox"]:checked'))
                .map(cb => ({
                    id: cb.id,
                    address: cb.dataset.address || cb.getAttribute('data-address') || ''
                }));
            
            // 收集配置参数
            const config = collectConfigFormData(container);
            
            // 添加日志信息
            const logContainer = container.querySelector('#scriptLogContainer');
            if (!logContainer) {
                console.error('日志容器未找到');
                runBtn.disabled = false;
                runBtn.innerHTML = '<i class="fas fa-play"></i> 开始执行';
                return;
            }
            
            addLogEntry('info', '系统', `开始执行脚本 "${scriptData.name}"`, logContainer);
            
            try {
                // 切换到日志标签
                const logTabBtn = container.querySelector('.tab-btn[data-tab="log"]');
                if (logTabBtn) logTabBtn.click();
                
                // 获取选择的代理配置
                let proxyConfig = null;
                const useProxy = container.querySelector('#proxyConnection').checked;
                if (useProxy) {
                    const proxyId = container.querySelector('#proxySelect').value;
                    if (proxyId) {
                        addLogEntry('info', '系统', `使用代理ID: ${proxyId}`, logContainer);
                    } else {
                        addLogEntry('warning', '系统', `未选择代理，将使用直连模式`, logContainer);
                    }
                    proxyConfig = proxyId || null;
                } else {
                    addLogEntry('info', '系统', `使用直连模式`, logContainer);
                }
                
                // 使用scriptAPI执行脚本，传递代理配置
                const result = await window.scriptAPI.executeScript(
                    scriptData.id,
                    selectedWallets,
                    config,
                    proxyConfig
                );
                
                if (result && result.success) {
                    addLogEntry('success', '系统', '脚本执行完成!', logContainer);
                    if (result.data) {
                        addLogEntry('info', '系统', `执行结果: ${JSON.stringify(result.data)}`, logContainer);
                    }
                } else {
                    const errorMsg = result && result.error ? result.error : '未知错误';
                    addLogEntry('error', '系统', `执行失败: ${errorMsg}`, logContainer);
                }
            } catch (error) {
                addLogEntry('error', '系统', `执行出错: ${error.message || error}`, logContainer);
                console.error('脚本执行错误:', error);
            } finally {
                // 恢复按钮状态
                runBtn.disabled = false;
                runBtn.innerHTML = '<i class="fas fa-play"></i> 开始执行';
            }
        });
    }
    
    // 清空日志按钮
    const clearLogBtn = container.querySelector('#clearLogBtn');
    if (clearLogBtn) {
        clearLogBtn.addEventListener('click', () => {
            const logContainer = container.querySelector('#scriptLogContainer');
            if (logContainer) {
                logContainer.innerHTML = '';
            }
        });
    }
    
    // 导出日志按钮
    const exportLogBtn = container.querySelector('#exportLogBtn');
    if (exportLogBtn) {
        exportLogBtn.addEventListener('click', () => {
            const logContainer = container.querySelector('#scriptLogContainer');
            if (!logContainer || !logContainer.textContent.trim()) {
                showModal('tpl-modal-message', (modalElement) => {
                    const messageContainer = modalElement.querySelector('.message-container');
                    messageContainer.classList.add('error');
                    messageContainer.innerHTML = `
                        <i class="fas fa-exclamation-circle"></i>
                        <p>没有可导出的日志内容!</p>
                    `;
                });
                return;
            }
            
            // 收集日志文本
            const logEntries = logContainer.querySelectorAll('.log-entry');
            let logText = '';
            logEntries.forEach(entry => {
                const time = entry.querySelector('.time').textContent;
                const source = entry.querySelector('.source').textContent;
                const message = entry.querySelector('.message').textContent;
                logText += `[${time}] [${source}] ${message}\n`;
            });
            
            // 创建并下载文件
            const blob = new Blob([logText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `script_log_${scriptData.id}_${new Date().toISOString().split('T')[0]}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
    
    // 钱包选择相关事件
    setupWalletSelectionEvents(container);
    
    // 日志筛选按钮
    const logFilterBtns = container.querySelectorAll('.log-filter-btn');
    logFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 更新按钮状态
            logFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // 获取筛选类型
            const filterType = btn.getAttribute('data-filter');
            
            // 应用筛选
            filterLogEntries(container, filterType);
        });
    });
}

/**
 * 设置钱包选择相关事件
 * @param {HTMLElement} container - 详情页面容器元素
 */
function setupWalletSelectionEvents(container) {
    // 全选按钮
    const selectAllBtn = container.querySelector('#selectAllWallets');
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            // 注意：这里只会选择当前页面显示的钱包
            const checkboxes = container.querySelectorAll('#walletSelectionList input[type="checkbox"]');
            const visibleCheckboxes = Array.from(checkboxes).filter(cb => {
                // 检查复选框是否可见
                const cbItem = cb.closest('.wallet-cb-item');
                return cbItem && cbItem.style.display !== 'none';
            });
            
            // 检查当前页面上可见的复选框是否全部选中
            const allChecked = visibleCheckboxes.every(cb => cb.checked);
            
            // 切换选中状态
            visibleCheckboxes.forEach(cb => {
                cb.checked = !allChecked;
            });
            
            // 更新按钮文本
            selectAllBtn.textContent = !allChecked ? '取消全选' : '全选';
            
            // 更新选择计数
            updateSelectedWalletCount(container);
        });
    }
    
    // 反选按钮
    const invertSelectionBtn = container.querySelector('#invertWalletSelection');
    if (invertSelectionBtn) {
        invertSelectionBtn.addEventListener('click', () => {
            // 注意：这里只会反选当前页面显示的钱包
            const checkboxes = container.querySelectorAll('#walletSelectionList input[type="checkbox"]');
            const visibleCheckboxes = Array.from(checkboxes).filter(cb => {
                const cbItem = cb.closest('.wallet-cb-item');
                return cbItem && cbItem.style.display !== 'none';
            });
            
            visibleCheckboxes.forEach(cb => {
                cb.checked = !cb.checked;
            });
            
            // 更新选择计数
            updateSelectedWalletCount(container);
        });
    }
    
    // 搜索钱包
    const searchInput = container.querySelector('#walletSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase().trim();
            const walletItems = container.querySelectorAll('.wallet-cb-item');
            const walletGroups = container.querySelectorAll('.wallet-group-header');
            
            // 隐藏所有组标题，只显示包含匹配项的组
            walletGroups.forEach(group => {
                group.style.display = 'none';
            });
            
            // 用于跟踪每个组是否有可见项目
            const visibleInGroup = {};
            
            // 筛选钱包项
            walletItems.forEach(item => {
                const label = item.querySelector('label').textContent.toLowerCase();
                const isVisible = searchTerm === '' || label.includes(searchTerm);
                item.style.display = isVisible ? '' : 'none';
                
                // 如果此项可见，记录其所属组
                if (isVisible) {
                    // 向上查找最近的组标题
                    let current = item.previousElementSibling;
                    while (current) {
                        if (current.classList.contains('wallet-group-header')) {
                            visibleInGroup[current.textContent] = true;
                            current.style.display = '';
                            break;
                        }
                        current = current.previousElementSibling;
                    }
                }
            });
            
            // 如果搜索框为空，显示所有组标题
            if (searchTerm === '') {
                walletGroups.forEach(group => {
                    group.style.display = '';
                });
            }
            
            // 更新选择计数，因为可见性变化
            updateSelectedWalletCount(container);
        });
    }
    
    // 直接为每个钱包复选框添加事件监听
    const checkboxes = container.querySelectorAll('#walletSelectionList input[type="checkbox"]');
    console.log(`为${checkboxes.length}个钱包复选框添加事件监听`);
    
    checkboxes.forEach(checkbox => {
        // 移除现有的事件监听器避免重复绑定
        checkbox.removeEventListener('change', onCheckboxChange);
        // 添加新的事件监听器
        checkbox.addEventListener('change', onCheckboxChange);
    });
    
    // 初始更新选择计数
    updateSelectedWalletCount(container);
    
    // 为整个钱包列表容器添加事件委托
    const walletList = container.querySelector('#walletsScrollContainer');
    if (walletList) {
        // 移除可能已存在的事件处理器
        walletList.removeEventListener('change', onWalletListChange);
        // 添加新的事件处理器
        walletList.addEventListener('change', onWalletListChange);
    }
    
    // 复选框变化回调函数
    function onCheckboxChange(event) {
        console.log('钱包复选框状态变化:', event.target.checked);
        updateSelectedWalletCount(container);
    }
    
    // 钱包列表变化委托处理函数
    function onWalletListChange(event) {
        if (event.target.type === 'checkbox') {
            console.log('通过事件委托检测到复选框变化');
            updateSelectedWalletCount(container);
        }
    }
}

/**
 * 更新已选钱包数量
 * @param {HTMLElement} container - 详情页面容器元素
 */
function updateSelectedWalletCount(container) {
    const countSpan = container.querySelector('#selectedWalletCount');
    if (!countSpan) {
        console.error('找不到钱包计数元素');
        return;
    }
    
    // 获取所有选中的钱包复选框（不管是否可见）
    const allCheckboxes = container.querySelectorAll('#walletSelectionList input[type="checkbox"]');
    const checkedWallets = Array.from(allCheckboxes).filter(cb => cb.checked);
    const count = checkedWallets.length;
    
    // 更新计数显示
    countSpan.textContent = count;
    
    // 计算当前可见的钱包中有多少被选中
    const visibleCheckboxes = Array.from(allCheckboxes).filter(cb => {
        const cbItem = cb.closest('.wallet-cb-item');
        return cbItem && cbItem.style.display !== 'none';
    });
    const visibleCheckedCount = visibleCheckboxes.filter(cb => cb.checked).length;
    const visibleTotal = visibleCheckboxes.length;
    
    // 更新全选按钮文本
    const selectAllBtn = container.querySelector('#selectAllWallets');
    if (selectAllBtn && visibleTotal > 0) {
        selectAllBtn.textContent = visibleCheckedCount === visibleTotal ? '取消全选' : '全选';
    }
    
    // 调试输出
    console.log(`更新钱包选择计数: ${count} 个已选择，当前页面可见: ${visibleCheckedCount}/${visibleTotal}`);
}

/**
 * 收集配置表单数据
 * @param {HTMLElement} container - 详情页面容器元素
 * @returns {Object} 配置数据对象
 */
function collectConfigFormData(container) {
    const configForm = container.querySelector('#scriptConfigForm');
    if (!configForm) {
        console.log('未找到配置表单元素');
        return {};
    }
    
    const config = {};
    
    // 收集文本和数字输入
    const textInputs = configForm.querySelectorAll('input[type="text"], input[type="number"]');
    textInputs.forEach(input => {
        const name = input.getAttribute('name') || input.id;
        if (name) {
            if (input.type === 'number') {
                config[name] = parseFloat(input.value) || 0;
            } else {
                config[name] = input.value;
            }
        }
    });
    
    // 收集下拉选择
    const selects = configForm.querySelectorAll('select');
    selects.forEach(select => {
        const name = select.getAttribute('name') || select.id;
        if (name) {
            config[name] = select.value;
        }
    });
    
    // 收集复选框
    const checkboxes = configForm.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
        const name = checkbox.getAttribute('name') || checkbox.id;
        if (name) {
            config[name] = checkbox.checked;
        }
    });
    
    // 收集单选按钮
    const checkedRadios = configForm.querySelectorAll('input[type="radio"]:checked');
    checkedRadios.forEach(radio => {
        const name = radio.getAttribute('name');
        if (name) {
            config[name] = radio.value;
        }
    });
    
    // 收集网络连接配置
    try {
        // 添加代理设置到配置中
        const useProxy = container.querySelector('#proxyConnection')?.checked;
        config.useProxy = !!useProxy;
        
        if (useProxy) {
            const proxySelect = container.querySelector('#proxySelect');
            if (proxySelect && proxySelect.value) {
                config.proxyId = proxySelect.value;
            }
        }
    } catch (e) {
        console.error('收集代理配置出错:', e);
    }
    
    console.log('收集的配置数据:', config);
    return config;
}

/**
 * 加载脚本列表
 * @param {HTMLElement} container - 详情页面容器元素
 */
function loadScriptList(container) {
    // 模拟脚本列表数据
    const scripts = [
        { id: 'print123', name: '打印123', type: '本地脚本', status: 'active' },
        { id: 'noimage', name: '无图片脚本', type: '本地脚本', status: 'active' },
        { id: 'script3', name: '示例脚本3', type: '远程脚本', status: 'inactive' },
        { id: 'script4', name: '示例脚本4', type: '本地脚本', status: 'active' }
    ];
    
    const listContainer = container.querySelector('#scriptListItems');
    if (!listContainer) return;
    
    // 渲染脚本列表
    listContainer.innerHTML = scripts.map(script => `
        <li class="script-list-item ${script.id === currentScriptId ? 'active' : ''}" data-script-id="${script.id}">
            <div class="script-list-item-content">
                <span class="script-list-name">${script.name}</span>
                <span class="script-list-type">${script.type}</span>
                <span class="script-list-status ${script.status}">${script.status === 'active' ? '可用' : '不可用'}</span>
            </div>
        </li>
    `).join('');
    
    // 绑定脚本列表项点击事件
    const listItems = container.querySelectorAll('.script-list-item');
    listItems.forEach(item => {
        item.addEventListener('click', () => {
            // 高亮当前选中项
            listItems.forEach(li => li.classList.remove('active'));
            item.classList.add('active');
            
            // 获取脚本ID并加载详情
            const scriptId = item.getAttribute('data-script-id');
            if (scriptId) {
                window.loadScriptDetail(scriptId);
            }
        });
    });
    
    // 脚本列表搜索
    const searchInput = container.querySelector('#scriptListSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const searchTerm = searchInput.value.toLowerCase();
            listItems.forEach(item => {
                const name = item.querySelector('.script-list-name').textContent.toLowerCase();
                const type = item.querySelector('.script-list-type').textContent.toLowerCase();
                const content = name + ' ' + type;
                
                if (content.includes(searchTerm)) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    }
}

/**
 * 添加日志条目
 * @param {string} type - 日志类型 (info, success, error, warning)
 * @param {string} source - 日志来源
 * @param {string} message - 日志消息
 * @param {HTMLElement} container - 日志容器元素
 */
export function addLogEntry(type, source, message, container) {
    if (!container) return;
    
    const time = new Date().toLocaleTimeString();
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    logEntry.setAttribute('data-log-type', type);
    
    logEntry.innerHTML = `
        <span class="time">${time}</span>
        <span class="source">[${source}]</span>
        <span class="message">${message}</span>
    `;
    
    container.appendChild(logEntry);
    container.scrollTop = container.scrollHeight;
}

/**
 * 筛选日志条目
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {string} filterType - 筛选类型 (all, info, success, error, warning)
 */
function filterLogEntries(container, filterType) {
    const logEntries = container.querySelectorAll('.log-entry');
    
    logEntries.forEach(entry => {
        if (filterType === 'all') {
            entry.style.display = '';
        } else {
            const entryType = entry.getAttribute('data-log-type');
            entry.style.display = (entryType === filterType) ? '' : 'none';
        }
    });
}

// 全局变量，保存当前脚本ID
let currentScriptId = null;

// 导出设置当前脚本ID的方法
export function setCurrentScriptId(scriptId) {
    currentScriptId = scriptId;
}

/**
 * 设置脚本日志监听
 * @param {HTMLElement} container - 详情页面容器元素
 */
function setupScriptLogListener(container) {
    const logContainer = container.querySelector('#scriptLogContainer');
    
    if (!logContainer) {
        console.error('日志容器未找到');
        return;
    }
    
    // 注册日志监听器
    const unsubscribe = window.scriptAPI.onLog((logData) => {
        const { level, message } = logData;
        addLogEntry(level, '脚本', message, logContainer);
        
        // 自动滚动到底部
        logContainer.scrollTop = logContainer.scrollHeight;
    });
    
    // 当容器被移除时取消订阅
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.type === 'childList' && mutation.removedNodes.length > 0) {
                for (const node of mutation.removedNodes) {
                    if (node.contains(container)) {
                        unsubscribe();
                        observer.disconnect();
                        return;
                    }
                }
            }
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
}

// 全局Set记录所有已选钱包ID
if (!window._selectedWalletIds) window._selectedWalletIds = new Set();

async function loadWalletList(container) {
    const walletSelectionList = container.querySelector('#walletSelectionList');
    if (!walletSelectionList) {
        console.error('钱包选择列表容器未找到');
        return;
    }
    // 声明变量在 try 块外部，但在函数作用域内
    let selectAllBtn = null;
    let invertBtn = null;
    let searchInput = null;

    try {
        walletSelectionList.innerHTML = '<div class="wallet-loading">加载钱包列表中...</div>';
        const groupsResult = await window.electron.ipcRenderer.invoke('db:getGroups');
        let groups = [];
        if (Array.isArray(groupsResult)) {
            groups = groupsResult;
        } else if (groupsResult && typeof groupsResult === 'object' && groupsResult.data) {
            groups = groupsResult.data;
        }
        if (!groups.some(g => g.id === 'default')) {
            groups.push({ id: 'default', name: '默认分组' });
        }
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
        if (!wallets || wallets.length === 0) {
             wallets = [
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
            if (!groups.some(g => g.id === 'group1')) groups.push({ id: 'group1', name: '测试分组1' });
            if (!groups.some(g => g.id === 'group2')) groups.push({ id: 'group2', name: '测试分组2' });
        }
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
        let totalWallets = wallets.length;
        const walletListHtml = [];
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
        walletListHtml.push(`
            <div class="wallet-list-footer">
                <p class="selected-count">已选: <span id="selectedWalletCount">0</span> 个钱包（共 ${totalWallets} 个）</p>
            </div>
        `);
        // **** 渲染HTML ****
        walletSelectionList.innerHTML = walletListHtml.join('');

        // **** 查询DOM元素 ****
        const tabButtons = container.querySelectorAll('.group-tab-btn');
        const tabContents = container.querySelectorAll('.group-tab-content');
        const checkboxes = container.querySelectorAll('#walletSelectionList input[type="checkbox"]');
        // 在DOM更新后查询按钮
        selectAllBtn = container.querySelector('#selectAllWallets');
        invertBtn = container.querySelector('#invertWalletSelection');
        searchInput = container.querySelector('#walletSearchInput');

        // **** 定义辅助函数 ****
        function updateSelectAllBtnText() {
            if (!selectAllBtn) {
                // console.warn("updateSelectAllBtnText called before selectAllBtn is found");
                return; // 如果按钮不存在，则不执行
            }
            const visibleCheckboxes = Array.from(container.querySelectorAll('.group-tab-content.active input[type="checkbox"]'));
            const allCheckedInGroup = visibleCheckboxes.length > 0 && visibleCheckboxes.every(cb => cb.checked);
            selectAllBtn.textContent = allCheckedInGroup ? '取消全选' : '全选';
        }

        // **** 绑定事件 ****
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
                updateSelectAllBtnText(); // 切换分组后更新按钮状态
            });
        });

        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const walletId = String(checkbox.value);
                if (checkbox.checked) {
                    window._selectedWalletIds.add(walletId);
                } else {
                    window._selectedWalletIds.delete(walletId);
                }
                updateSelectedWalletCount(container);
                updateSelectAllBtnText(); // 单选后也更新按钮状态
            });
        });

        if (selectAllBtn) {
            selectAllBtn.addEventListener('click', () => {
                const activeGroupCheckboxes = Array.from(container.querySelectorAll('.group-tab-content.active input[type="checkbox"]'));
                const allChecked = activeGroupCheckboxes.length > 0 && activeGroupCheckboxes.every(cb => cb.checked);
                activeGroupCheckboxes.forEach(cb => {
                    const walletId = String(cb.value);
                    if (!allChecked) {
                        cb.checked = true;
                        window._selectedWalletIds.add(walletId);
                    } else {
                        cb.checked = false;
                        window._selectedWalletIds.delete(walletId);
                    }
                });
                updateSelectedWalletCount(container);
                updateSelectAllBtnText();
            });
        } else {
             console.error("#selectAllWallets button not found.");
        }

        if (invertBtn) {
            invertBtn.addEventListener('click', () => {
                const activeGroupCheckboxes = Array.from(container.querySelectorAll('.group-tab-content.active input[type="checkbox"]'));
                activeGroupCheckboxes.forEach(cb => {
                    cb.checked = !cb.checked;
                    const walletId = String(cb.value);
                    if (cb.checked) {
                        window._selectedWalletIds.add(walletId);
                    } else {
                        window._selectedWalletIds.delete(walletId);
                    }
                });
                updateSelectedWalletCount(container);
                updateSelectAllBtnText();
            });
        } else {
            console.error("#invertWalletSelection button not found.");
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                const searchTerm = searchInput.value.toLowerCase().trim();
                const walletItems = container.querySelectorAll('.wallet-cb-item');
                const groupTabs = container.querySelector('.wallet-group-tabs');

                if (searchTerm === '') {
                    // 清除搜索，恢复分组视图
                    if (groupTabs) groupTabs.style.display = '';
                    tabButtons.forEach(btn => {
                        if (btn.classList.contains('active')) {
                            const groupId = btn.getAttribute('data-group');
                            tabContents.forEach(content => {
                                content.classList.remove('active');
                                if (content.getAttribute('data-group') === groupId) {
                                    content.classList.add('active');
                                }
                            });
                        }
                    });
                    walletItems.forEach(item => {
                        item.style.display = ''; // 显示所有钱包项
                    });
                    if(selectAllBtn) selectAllBtn.disabled = false;
                    if(invertBtn) invertBtn.disabled = false;
                } else {
                    // 搜索时，隐藏分组tab按钮，显示所有分组内容区域以便搜索
                    if (groupTabs) groupTabs.style.display = 'none';
                    tabContents.forEach(content => {
                        content.classList.add('active');
                    });
                    walletItems.forEach(item => {
                        const labelElement = item.querySelector('label');
                        const label = labelElement ? labelElement.textContent.toLowerCase() : '';
                        const isVisible = label.includes(searchTerm);
                        item.style.display = isVisible ? '' : 'none';
                    });
                    if(selectAllBtn) selectAllBtn.disabled = true;
                    if(invertBtn) invertBtn.disabled = true;
                }
                updateSelectedWalletCount(container);
                updateSelectAllBtnText();
            });
        } else {
            console.error("#walletSearchInput not found.");
        }

        // **** 初始状态更新 ****
        updateSelectedWalletCount(container);
        updateSelectAllBtnText();

    } catch (error) {
        console.error("加载钱包列表时出错:", error);
        walletSelectionList.innerHTML = `<div class="wallet-error">加载钱包数据出错: ${error.message || error}</div>`;
    }
}

/**
 * 执行脚本
 * @param {HTMLElement} container - 详情页面容器元素 
 * @param {Object} scriptInfo - 脚本信息对象
 */
function executeScript(container, scriptInfo) {
    if (!scriptInfo || !scriptInfo.id) {
        addLogEntry('error', '系统', '错误: 脚本信息不完整', container.querySelector('#scriptLogContainer'));
        return;
    }

    // 显示日志面板
    switchToTab(container, 'log');
    const logContainer = container.querySelector('.log-container');
    if (logContainer) {
        logContainer.innerHTML = '';
    }

    // 收集配置和钱包
    const config = collectConfigFormData(container);
    const selectedWallets = getSelectedWallets(container);
    
    console.log('已选择的钱包:', selectedWallets);
    
    if (selectedWallets.length === 0) {
        addLogEntry('error', '系统', '错误: 请至少选择一个钱包', logContainer);
        return;
    }

    addLogEntry('info', '系统', `开始执行脚本: ${scriptInfo.name}`, logContainer);
    addLogEntry('info', '系统', `已选择 ${selectedWallets.length} 个钱包进行操作`, logContainer);
    
    // 更新UI状态
    const executeButton = container.querySelector('#startExecutionBtn');
    if (executeButton) {
        executeButton.disabled = true;
        executeButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中...';
    }

    // 通过IPC调用脚本执行引擎
    try {
        // 实际的脚本执行
        window.scriptAPI.executeScript(
            scriptInfo.id,
            selectedWallets,
            config
        ).then(result => {
            if (result && result.success) {
                addLogEntry('success', '系统', '脚本执行完成!', logContainer);
            } else {
                const errorMsg = result && result.error ? result.error : '未知错误';
                addLogEntry('error', '系统', `执行失败: ${errorMsg}`, logContainer);
            }
        }).catch(error => {
            addLogEntry('error', '系统', `执行出错: ${error.message || error}`, logContainer);
        }).finally(() => {
            // 恢复按钮状态
            if (executeButton) {
                executeButton.disabled = false;
                executeButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
            }
        });
    } catch (error) {
        addLogEntry('error', '系统', `调用执行API失败: ${error.message || error}`, logContainer);
        
        // 恢复按钮状态
        if (executeButton) {
            executeButton.disabled = false;
            executeButton.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        }
    }
}

/**
 * 获取当前选择的钱包列表
 * @param {HTMLElement} container - 详情页面容器元素
 * @returns {Array} 选中的钱包对象数组
 */
function getSelectedWallets(container) {
    const selectedWallets = [];
    // 获取所有选中的钱包复选框，无论它们是否在当前页面可见
    const walletCheckboxes = container.querySelectorAll('#walletSelectionList input[type="checkbox"]:checked');
    
    walletCheckboxes.forEach(checkbox => {
        // 获取钱包信息
        const walletId = checkbox.id.replace('wallet_', '');
        const walletAddress = checkbox.getAttribute('data-address') || '';
        const walletGroup = checkbox.getAttribute('data-group') || 'default';
        
        // 获取标签文本（地址和可能的昵称）
        const labelEl = document.querySelector(`label[for="${checkbox.id}"]`);
        const walletName = labelEl ? labelEl.textContent : '未知钱包';
        
        selectedWallets.push({
            id: walletId,
            address: walletAddress,
            groupId: walletGroup,
            name: walletName
        });
    });
    
    // 日志输出
    console.log(`获取选中钱包: 共选中 ${selectedWallets.length} 个钱包`);
    
    return selectedWallets;
}

/**
 * 停止脚本执行
 * @param {HTMLElement} container - 详情页面容器元素
 */
function stopScriptExecution(container) {
    // 在实际应用中，这里应该调用 window.electron.stopScript

    // 更新UI状态
    const executeButton = container.querySelector('#executeScriptBtn');
    const stopButton = container.querySelector('#stopScriptBtn');
    
    if (executeButton) {
        executeButton.disabled = false;
        executeButton.textContent = '执行';
    }
    
    if (stopButton) {
        stopButton.style.display = 'none';
    }
    
    addLogMessage(container, '脚本执行已停止', 'warning');
    
    // 清除模拟执行的定时器
    if (window._scriptSimulationTimer) {
        clearInterval(window._scriptSimulationTimer);
        window._scriptSimulationTimer = null;
    }
}

/**
 * 添加日志消息
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {string} message - 日志消息
 * @param {string} type - 日志类型 (info, success, warning, error)
 */
function addLogMessage(container, message, type = 'info') {
    const logContainer = container.querySelector('.log-container');
    if (!logContainer) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const logItem = document.createElement('div');
    logItem.className = `log-item log-${type}`;
    
    logItem.innerHTML = `
        <span class="log-time">[${timestamp}]</span>
        <span class="log-message">${message}</span>
    `;
    
    logContainer.appendChild(logItem);
    
    // 自动滚动到底部
    logContainer.scrollTop = logContainer.scrollHeight;
}

/**
 * 模拟脚本执行过程（仅用于开发测试）
 * 实际应用中请替换为真实的IPC调用
 */
function simulateScriptExecution(container, scriptInfo, config, wallets) {
    let step = 0;
    const maxSteps = 8 + Math.floor(Math.random() * 5);
    const scriptDuration = 3000 + Math.floor(Math.random() * 5000);
    
    // 记录开始信息
    addLogMessage(container, `脚本配置: ${JSON.stringify(config)}`, 'info');
    
    // 清除可能存在的旧定时器
    if (window._scriptSimulationTimer) {
        clearInterval(window._scriptSimulationTimer);
    }
    
    // 创建模拟执行的定时器
    window._scriptSimulationTimer = setInterval(() => {
        step++;
        
        if (step <= maxSteps) {
            // 随机选择一个钱包
            const wallet = wallets[Math.floor(Math.random() * wallets.length)];
            
            // 随机选择日志类型
            const types = ['info', 'success', 'warning', 'error'];
            const randomTypeIndex = Math.floor(Math.random() * 20);
            const type = types[randomTypeIndex % 4]; // 使成功和普通信息更常见
            
            // 根据步骤生成不同的消息
            let message = '';
            switch (step) {
                case 1:
                    message = `正在初始化钱包 ${wallet.name}`;
                    break;
                case 2:
                    message = `正在连接到网络 ${wallet.network || 'ETH主网'}`;
                    break;
                case 3:
                    message = `获取钱包 ${wallet.address?.substring(0, 8)}... 的余额`;
                    break;
                case 4:
                    message = `计算最佳Gas价格: ${Math.floor(Math.random() * 200) + 20} Gwei`;
                    break;
                case 5:
                    message = `准备交易参数: ${scriptInfo.name}`;
                    break;
                case 6:
                    if (type === 'error') {
                        message = `钱包 ${wallet.address?.substring(0, 8)}... 余额不足`;
                    } else {
                        message = `发送交易: 0x${Math.random().toString(16).substring(2, 10)}...`;
                    }
                    break;
                case 7:
                    if (type !== 'error') {
                        message = `交易已确认，区块: ${Math.floor(Math.random() * 1000000) + 14000000}`;
                    } else {
                        message = `交易失败: Gas价格过低`;
                    }
                    break;
                default:
                    message = `执行操作 #${step}: ${scriptInfo.name} 处理中...`;
            }
            
            // 添加日志
            addLogMessage(container, message, type);
        } else {
            // 完成执行
            clearInterval(window._scriptSimulationTimer);
            window._scriptSimulationTimer = null;
            
            // 更新UI状态
            const executeButton = container.querySelector('#executeScriptBtn');
            const stopButton = container.querySelector('#stopScriptBtn');
            
            if (executeButton) {
                executeButton.disabled = false;
                executeButton.textContent = '执行';
            }
            
            if (stopButton) {
                stopButton.style.display = 'none';
            }
            
            addLogMessage(container, `脚本 ${scriptInfo.name} 执行完成，用时 ${(scriptDuration/1000).toFixed(1)}秒`, 'success');
        }
    }, scriptDuration / maxSteps);
}

/**
 * 绑定事件处理程序
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {Object} scriptInfo - 脚本信息对象
 */
function bindEvents(container, scriptInfo) {
    // 切换标签事件
    const tabButtons = container.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabId = this.dataset.tab;
            switchToTab(container, tabId);
        });
    });
    
    // 执行脚本按钮
    const executeButton = container.querySelector('#executeScriptBtn');
    if (executeButton) {
        executeButton.addEventListener('click', function() {
            executeScript(container, scriptInfo);
        });
    }
    
    // 停止脚本按钮
    const stopButton = container.querySelector('#stopScriptBtn');
    if (stopButton) {
        stopButton.addEventListener('click', function() {
            stopScriptExecution(container);
        });
    }
    
    // 全选/取消全选钱包
    const selectAllWalletsBtn = container.querySelector('#selectAllWallets');
    if (selectAllWalletsBtn) {
        selectAllWalletsBtn.addEventListener('click', function() {
            const walletCheckboxes = container.querySelectorAll('.wallet-item input[type="checkbox"]');
            const allChecked = Array.from(walletCheckboxes).every(cb => cb.checked);
            
            walletCheckboxes.forEach(checkbox => {
                checkbox.checked = !allChecked;
            });
            
            // 更新按钮文本
            this.textContent = !allChecked ? '取消全选' : '全选';
        });
    }
    
    // 返回按钮
    const backButton = container.querySelector('.script-detail-header .back-to-list');
    if (backButton) {
        backButton.addEventListener('click', function() {
            navigateToScriptList();
        });
    }
}

/**
 * 初始化详情页面
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {Object} scriptInfo - 脚本信息对象
 */
function initDetailPage(container, scriptInfo) {
    // 设置脚本标题和描述
    const titleElement = container.querySelector('.script-detail-title');
    if (titleElement) {
        titleElement.textContent = scriptInfo.name || '未命名脚本';
    }
    
    // 默认显示配置标签
    switchToTab(container, 'config');
    
    // 加载钱包列表
    loadWallets(container);
    
    // 初始化配置表单
    initConfigForm(container, scriptInfo);
    
    // 绑定事件处理程序
    bindEvents(container, scriptInfo);
}

/**
 * 初始化配置表单
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {Object} scriptInfo - 脚本信息对象
 */
function initConfigForm(container, scriptInfo) {
    const configContainer = container.querySelector('#scriptConfigForm');
    if (!configContainer) return;
    
    // 清空容器
    configContainer.innerHTML = '';
    
    // 如果没有配置项，显示提示信息
    if (!scriptInfo.config || Object.keys(scriptInfo.config).length === 0) {
        configContainer.innerHTML = '<div class="empty-config">此脚本没有可配置项</div>';
        return;
    }
    
    // 为每个配置项创建表单元素
    Object.entries(scriptInfo.config).forEach(([key, value]) => {
        // 跳过非必要的内部属性
        if (key.startsWith('_')) return;
        
        // 根据值类型创建不同的表单控件
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        
        // 创建标签
        const label = document.createElement('label');
        label.setAttribute('for', key);
        label.textContent = formatConfigKey(key);
        formGroup.appendChild(label);
        
        // 根据值类型创建控件
        let input;
        
        if (typeof value === 'boolean') {
            // 复选框
            input = document.createElement('input');
            input.type = 'checkbox';
            input.id = key;
            input.name = key;
            input.checked = value;
            
            // 包装在开关样式容器中
            const switchContainer = document.createElement('div');
            switchContainer.className = 'switch-container';
            switchContainer.appendChild(input);
            
            const slider = document.createElement('span');
            slider.className = 'slider';
            switchContainer.appendChild(slider);
            
            formGroup.appendChild(switchContainer);
        } else if (typeof value === 'number') {
            // 数字输入
            input = document.createElement('input');
            input.type = 'number';
            input.id = key;
            input.name = key;
            input.value = value;
            input.step = key.includes('price') || key.includes('amount') ? '0.01' : '1';
            formGroup.appendChild(input);
        } else if (Array.isArray(value)) {
            // 下拉列表（多选值）
            input = document.createElement('select');
            input.id = key;
            input.name = key;
            
            // 添加占位符选项
            const placeholderOption = document.createElement('option');
            placeholderOption.value = '';
            placeholderOption.textContent = `请选择${formatConfigKey(key)}`;
            placeholderOption.disabled = true;
            placeholderOption.selected = true;
            input.appendChild(placeholderOption);
            
            // 添加选项
            value.forEach(option => {
                const optionElement = document.createElement('option');
                optionElement.value = option;
                optionElement.textContent = option;
                input.appendChild(optionElement);
            });
            
            formGroup.appendChild(input);
        } else {
            // 文本输入（默认）
            input = document.createElement('input');
            input.type = 'text';
            input.id = key;
            input.name = key;
            input.value = value || '';
            
            // 地址字段特殊处理
            if (key.includes('address') || key.includes('contract')) {
                input.placeholder = '0x...';
                input.pattern = '^0x[a-fA-F0-9]{40}$';
                
                // 添加验证提示
                const hint = document.createElement('div');
                hint.className = 'form-hint';
                hint.textContent = '请输入有效的以太坊地址';
                formGroup.appendChild(input);
                formGroup.appendChild(hint);
            } else {
                formGroup.appendChild(input);
            }
        }
        
        configContainer.appendChild(formGroup);
    });
    
    // 添加执行选项（如Gas策略、执行间隔等）
    addExecutionOptions(configContainer);
}

/**
 * 添加执行选项
 * @param {HTMLElement} container - 配置表单容器
 */
function addExecutionOptions(container) {
    // 创建执行选项区域
    const executionSection = document.createElement('div');
    executionSection.className = 'execution-options';
    
    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = '执行选项';
    executionSection.appendChild(sectionTitle);
    
    // Gas策略选择
    const gasGroup = document.createElement('div');
    gasGroup.className = 'form-group';
    
    const gasLabel = document.createElement('label');
    gasLabel.setAttribute('for', 'gasStrategy');
    gasLabel.textContent = 'Gas策略';
    gasGroup.appendChild(gasLabel);
    
    const gasSelect = document.createElement('select');
    gasSelect.id = 'gasStrategy';
    gasSelect.name = 'gasStrategy';
    
    const gasOptions = [
        { value: 'economy', text: '经济模式 (较慢)' },
        { value: 'balanced', text: '均衡模式 (推荐)' },
        { value: 'fast', text: '快速模式 (较贵)' },
        { value: 'custom', text: '自定义' }
    ];
    
    gasOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        if (option.value === 'balanced') {
            optionElement.selected = true;
        }
        gasSelect.appendChild(optionElement);
    });
    
    gasGroup.appendChild(gasSelect);
    executionSection.appendChild(gasGroup);
    
    // 执行间隔设置
    const intervalGroup = document.createElement('div');
    intervalGroup.className = 'form-group';
    
    const intervalLabel = document.createElement('label');
    intervalLabel.textContent = '执行间隔 (分钟)';
    intervalGroup.appendChild(intervalLabel);
    
    const intervalContainer = document.createElement('div');
    intervalContainer.className = 'interval-inputs';
    
    const minInput = document.createElement('input');
    minInput.type = 'number';
    minInput.id = 'intervalMin';
    minInput.name = 'intervalMin';
    minInput.value = '1';
    minInput.min = '0.1';
    minInput.step = '0.1';
    
    const maxInput = document.createElement('input');
    maxInput.type = 'number';
    maxInput.id = 'intervalMax';
    maxInput.name = 'intervalMax';
    maxInput.value = '1';
    maxInput.min = '0.1';
    maxInput.step = '0.1';
    
    const intervalText = document.createTextNode(' 至 ');
    
    intervalContainer.appendChild(minInput);
    intervalContainer.appendChild(intervalText);
    intervalContainer.appendChild(maxInput);
    
    intervalGroup.appendChild(intervalContainer);
    
    // 随机间隔选项
    const randomIntervalContainer = document.createElement('div');
    randomIntervalContainer.className = 'form-check mt-2';
    
    const randomCheck = document.createElement('input');
    randomCheck.type = 'checkbox';
    randomCheck.id = 'randomInterval';
    randomCheck.name = 'randomInterval';
    randomCheck.checked = true;
    
    const randomLabel = document.createElement('label');
    randomLabel.setAttribute('for', 'randomInterval');
    randomLabel.textContent = '使用随机间隔（防机器人检测）';
    randomLabel.className = 'form-check-label';
    
    randomIntervalContainer.appendChild(randomCheck);
    randomIntervalContainer.appendChild(randomLabel);
    
    intervalGroup.appendChild(randomIntervalContainer);
    executionSection.appendChild(intervalGroup);
    
    // 添加执行选项区域到容器
    container.appendChild(executionSection);
    
    // 添加执行按钮区域
    const actionGroup = document.createElement('div');
    actionGroup.className = 'execute-actions';
    
    const executeButton = document.createElement('button');
    executeButton.type = 'button';
    executeButton.id = 'executeScriptBtn';
    executeButton.className = 'btn btn-primary';
    executeButton.textContent = '执行';
    
    const stopButton = document.createElement('button');
    stopButton.type = 'button';
    stopButton.id = 'stopScriptBtn';
    stopButton.className = 'btn btn-danger';
    stopButton.textContent = '停止';
    stopButton.style.display = 'none';
    
    actionGroup.appendChild(executeButton);
    actionGroup.appendChild(stopButton);
    
    container.appendChild(actionGroup);
}

/**
 * 将配置键名格式化为用户友好的标签
 * @param {string} key - 配置键名
 * @returns {string} 格式化后的标签文本
 */
function formatConfigKey(key) {
    // 将驼峰命名转换为空格分隔
    const formatted = key.replace(/([A-Z])/g, ' $1').toLowerCase();
    
    // 首字母大写
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

/**
 * 加载钱包列表 - 从loadWalletList重命名
 * @param {HTMLElement} container - 详情页面容器元素
 */
function loadWallets(container) {
    // 调用已有的加载钱包列表函数
    loadWalletList(container);
}

/**
 * 调试函数 - 检查钱包数据
 * 可以在控制台中运行来诊断问题
 */
window.debugWallets = async function() {
    console.group('钱包数据诊断');
    
    try {
        // 检查IPC是否可用
        console.log('检查IPC可用性...');
        if (!window.electron || !window.electron.ipcRenderer) {
            console.error('IPC接口不可用');
            return;
        }
        
        // 尝试获取钱包数据
        console.log('尝试获取钱包数据...');
        const walletsResult = await window.electron.ipcRenderer.invoke('db:getWallets');
        console.log('钱包数据结果:', walletsResult);
        
        // 尝试获取分组数据
        console.log('尝试获取分组数据...');
        const groups = await window.electron.ipcRenderer.invoke('db:getGroups');
        console.log('分组数据:', groups);
        
        // 检查DOM结构
        console.log('检查DOM结构...');
        const container = document.querySelector('.script-detail-view');
        if (!container) {
            console.error('找不到脚本详情页面容器');
            return;
        }
        
        const walletSelectionList = container.querySelector('#walletSelectionList');
        console.log('钱包选择列表容器:', walletSelectionList);
        
    } catch (error) {
        console.error('诊断过程中出错:', error);
    } finally {
        console.groupEnd();
    }
};

// 当页面加载完成后，添加此函数到窗口对象
window.addEventListener('DOMContentLoaded', () => {
    console.log('脚本详情页面已加载，可以使用window.debugWallets()诊断钱包加载问题');
});

// 导出模块函数
window.ScriptDetail = {
    init: initDetailPage,
    switchToTab,
    executeScript,
    stopScriptExecution,
    loadWallets,
    collectConfigFormData
};

/**
 * 设置代理选择界面和交互
 * @param {HTMLElement} container - 详情页面容器元素
 */
function setupProxySelection(container) {
    const directRadio = container.querySelector('#directConnection');
    const proxyRadio = container.querySelector('#proxyConnection');
    const proxySettings = container.querySelector('.proxy-settings');
    const proxySelect = container.querySelector('#proxySelect');
    const proxyInfo = container.querySelector('#proxyInfo');
    
    if (!directRadio || !proxyRadio || !proxySettings || !proxySelect) {
        console.error('代理设置相关元素未找到');
        return;
    }
    
    // 加载代理列表
    loadProxyList(proxySelect, proxyInfo);
    
    // 显示/隐藏代理设置
    directRadio.addEventListener('change', () => {
        if (directRadio.checked) {
            proxySettings.style.display = 'none';
        }
    });
    
    proxyRadio.addEventListener('change', () => {
        if (proxyRadio.checked) {
            proxySettings.style.display = '';
            // 如果列表为空，尝试重新加载
            if (proxySelect.options.length <= 1) {
                loadProxyList(proxySelect, proxyInfo);
            }
        }
    });
    
    // 代理选择变化时更新信息显示
    proxySelect.addEventListener('change', () => {
        const selectedOption = proxySelect.options[proxySelect.selectedIndex];
        if (selectedOption && selectedOption.value) {
            const proxyId = selectedOption.value;
            const proxyData = selectedOption.dataset;
            
            // 显示代理信息
            if (proxyData.host && proxyData.port) {
                let infoHtml = `<div class="proxy-details">`;
                infoHtml += `<span class="proxy-host">${proxyData.host}:${proxyData.port}</span>`;
                
                if (proxyData.type) {
                    infoHtml += `<span class="proxy-type">[${proxyData.type}]</span>`;
                }
                
                if (proxyData.country) {
                    infoHtml += `<span class="proxy-location">${proxyData.country}${proxyData.city ? '-' + proxyData.city : ''}</span>`;
                }
                
                infoHtml += `</div>`;
                proxyInfo.innerHTML = infoHtml;
            } else {
                proxyInfo.innerHTML = '';
            }
        } else {
            proxyInfo.innerHTML = '';
        }
    });
}

/**
 * 从后端加载代理列表
 * @param {HTMLSelectElement} selectElement - 代理选择下拉框元素
 * @param {HTMLElement} infoElement - 代理信息显示元素
 */
async function loadProxyList(selectElement, infoElement) {
    if (!selectElement) return;
    
    // 重置选择框状态
    selectElement.disabled = true;
    selectElement.innerHTML = '<option value="">加载代理列表中...</option>';
    infoElement.innerHTML = '';
    
    try {
        // 调用API获取代理列表
        const options = {
            limit: 100,  // 最多获取100个代理
            sortBy: 'status',
            sortOrder: 'ASC',
            status: '可用'  // 只获取可用的代理
        };
        
        const result = await window.electron.ipcRenderer.invoke('db:getProxies', options);
        
        // 解析结果
        let proxies = [];
        if (result && result.proxies && Array.isArray(result.proxies)) {
            proxies = result.proxies;
        } else if (Array.isArray(result)) {
            proxies = result;
        } else if (result && result.data && Array.isArray(result.data)) {
            proxies = result.data;
        }
        
        // 更新选择框
        if (proxies.length > 0) {
            // 创建选项元素
            const options = proxies.map(proxy => {
                // 格式化显示文本
                const label = `${proxy.name || '#' + proxy.id} - ${proxy.host}:${proxy.port} [${proxy.type}]${proxy.country ? ' - ' + proxy.country : ''}`;
                
                // 创建选项
                const option = document.createElement('option');
                option.value = proxy.id;
                option.textContent = label;
                
                // 存储代理详细信息
                option.dataset.host = proxy.host;
                option.dataset.port = proxy.port;
                option.dataset.type = proxy.type;
                option.dataset.country = proxy.country || '';
                option.dataset.city = proxy.city || '';
                
                return option;
            });
            
            // 添加默认选项
            selectElement.innerHTML = '<option value="">请选择代理</option>';
            
            // 添加代理选项
            options.forEach(option => {
                selectElement.appendChild(option);
            });
            
            console.log(`加载了 ${proxies.length} 个代理`);
        } else {
            selectElement.innerHTML = '<option value="">没有可用代理</option>';
            console.log('没有找到可用的代理');
        }
    } catch (error) {
        console.error('加载代理列表出错:', error);
        selectElement.innerHTML = '<option value="">加载失败</option>';
    } finally {
        selectElement.disabled = false;
    }
} 