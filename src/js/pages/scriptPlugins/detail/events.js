// 脚本详情页面事件处理模块
import { switchToTab } from './view.js';
import { addLogEntry } from './logger.js';
import { collectConfigFormData } from './config.js';
import { setupWalletSelectionEvents, updateSelectedWalletCount } from './wallets.js';

/**
 * 绑定详情页面的事件处理
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {Object} scriptData - 当前脚本数据
 */
export function bindDetailViewEvents(container, scriptData) {
    // 标签切换
    const tabBtns = container.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchToTab(container, targetTab);
        });
    });
    
    // 返回按钮
    const backBtn = container.querySelector('#backToScriptsList');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            if (window.navigateToScriptCards) {
                window.navigateToScriptCards();
            } else {
                console.error('navigateToScriptCards 函数未找到');
            }
        });
    }
    
    // 运行脚本按钮
    const runBtn = container.querySelector('#startExecutionBtn');
    if (runBtn) {
        runBtn.addEventListener('click', async () => {
            await handleScriptExecution(container, scriptData, runBtn);
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
            handleLogExport(container, scriptData);
        });
    }
    
    // 钱包选择相关事件
    setupWalletSelectionEvents(container);
    
    // 日志筛选按钮
    const logFilterBtns = container.querySelectorAll('.log-filter-btn');
    logFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            logFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filterType = btn.getAttribute('data-filter');
            filterLogEntries(container, filterType);
        });
    });
}

/**
 * 处理脚本执行
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {Object} scriptData - 脚本数据
 * @param {HTMLButtonElement} runBtn - 执行按钮元素
 */
async function handleScriptExecution(container, scriptData, runBtn) {
    // 禁用按钮并修改状态
    runBtn.disabled = true;
    runBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 执行中...';
    
    const logContainer = container.querySelector('#scriptLogContainer');
    if (!logContainer) {
        console.error('日志容器未找到');
        runBtn.disabled = false;
        runBtn.innerHTML = '<i class="fas fa-play"></i> 开始执行';
        return;
    }
    
    try {
        // 切换到日志标签
        const logTabBtn = container.querySelector('.tab-btn[data-tab="log"]');
        if (logTabBtn) logTabBtn.click();
        
        // 获取配置和代理设置
        const config = collectConfigFormData(container);
        let proxyConfig = null;
        const useProxy = container.querySelector('#proxyConnection').checked;
        
        if (useProxy) {
            const proxyId = container.querySelector('#proxySelect').value;
            if (proxyId) {
                addLogEntry('info', '系统', `使用代理ID: ${proxyId}`, logContainer);
                proxyConfig = proxyId;
            } else {
                addLogEntry('warning', '系统', `未选择代理，将使用直连模式`, logContainer);
            }
        } else {
            addLogEntry('info', '系统', `使用直连模式`, logContainer);
        }
        
        // 获取选中的钱包
        const selectedWallets = Array.from(container.querySelectorAll('#walletSelectionList input[type="checkbox"]:checked'))
            .map(cb => ({
                id: parseInt(cb.value, 10),
                address: cb.dataset.address || cb.getAttribute('data-address') || ''
            }));
        
        // 执行脚本
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
}

/**
 * 处理日志导出
 * @param {HTMLElement} container - 详情页面容器元素
 * @param {Object} scriptData - 脚本数据
 */
function handleLogExport(container, scriptData) {
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
} 