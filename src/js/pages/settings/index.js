// Import other modules if needed
// import * as table from './table.js';
// import * as modals from './modals.js';
// import * as actions from './actions.js';

// 设置功能实现
import { showToast } from '../../components/toast.js';

// 默认设置对象
const defaultSettings = {
    // 通用设置
    language: 'zh-CN',
    theme: 'auto',
    notifications: true,
    autoStart: true,
    startMinimized: true,
    
    // 安全与隐私
    autoCheckUpdate: true,
    
    // 网络设置
    rpcUrl: '',  // 空字符串表示使用默认RPC
    connectionTimeout: 30,
    
    // 数据与备份
    dataLocation: '',
    autoBackup: 'daily',
};

// 当前设置
let currentSettings = {};

/**
 * 初始化设置页面。
 * @param {HTMLElement} contentArea - 主要的内容区域。
 */
export function initSettingsPage(contentArea) {
    console.log("Initializing Settings Page...");

    // 加载当前设置
    loadSettings().then(settings => {
        currentSettings = settings;
        updateUIWithSettings(contentArea, settings);
        setupEventListeners(contentArea);
    });
}

/**
 * 加载设置
 * @returns {Promise<Object>} 设置对象
 */
async function loadSettings() {
    try {
        // 尝试从electron存储读取设置
        if (window.settingsAPI && window.settingsAPI.getSettings) {
            const settings = await window.settingsAPI.getSettings();
            return { ...defaultSettings, ...settings };
        }

        // 如果没有settingsAPI，则尝试从localStorage读取
        const savedSettings = localStorage.getItem('app_settings');
        return savedSettings ? { ...defaultSettings, ...JSON.parse(savedSettings) } : { ...defaultSettings };
    } catch (error) {
        console.error('加载设置失败:', error);
        return { ...defaultSettings };
    }
}

/**
 * 保存设置
 * @param {Object} settings - 设置对象
 * @returns {Promise<boolean>} 是否保存成功
 */
async function saveSettings(settings) {
    try {
        // 如果有settingsAPI，则使用它保存
        if (window.settingsAPI && window.settingsAPI.saveSettings) {
            await window.settingsAPI.saveSettings(settings);
        } else {
            // 否则保存到localStorage
            localStorage.setItem('app_settings', JSON.stringify(settings));
        }
        return true;
    } catch (error) {
        console.error('保存设置失败:', error);
        return false;
    }
}

/**
 * 根据设置更新UI
 * @param {HTMLElement} contentArea - 内容区域
 * @param {Object} settings - 设置对象
 */
function updateUIWithSettings(contentArea, settings) {
    // 通用设置
    setSelectValue(contentArea, '#language-select', settings.language);
    setSelectValue(contentArea, '#theme-select', settings.theme);
    setCheckboxValue(contentArea, '#enable-notifications', settings.notifications);
    setCheckboxValue(contentArea, '#auto-start', settings.autoStart);
    setCheckboxValue(contentArea, '#start-minimized', settings.startMinimized);
    
    // 安全与隐私
    setCheckboxValue(contentArea, '#auto-check-update', settings.autoCheckUpdate);
    
    // 网络设置
    setInputValue(contentArea, '#rpc-url', settings.rpcUrl);
    setSelectValue(contentArea, '#default-proxy-group', settings.defaultProxyGroup);
    setInputValue(contentArea, '#connection-timeout', settings.connectionTimeout);
    
    // 数据与备份
    if (contentArea.querySelector('#data-location')) {
        contentArea.querySelector('#data-location').textContent = settings.dataLocation || getDefaultDataPath();
    }
    setSelectValue(contentArea, '#auto-backup', settings.autoBackup);
    
    // 开发者选项
    setCheckboxValue(contentArea, '#dev-mode', settings.devMode);
    setSelectValue(contentArea, '#log-level', settings.logLevel);
    
    // 更新开发者选项可见性
    updateDevOptionsVisibility(contentArea, settings.devMode);
}

/**
 * 设置选择框的值
 */
function setSelectValue(contentArea, selector, value) {
    const select = contentArea.querySelector(selector);
    if (select && value !== undefined) select.value = value;
}

/**
 * 设置复选框的值
 */
function setCheckboxValue(contentArea, selector, checked) {
    const checkbox = contentArea.querySelector(selector);
    if (checkbox && checked !== undefined) checkbox.checked = checked;
}

/**
 * 设置输入框的值
 */
function setInputValue(contentArea, selector, value) {
    const input = contentArea.querySelector(selector);
    if (input && value !== undefined) input.value = value;
}

/**
 * 获取默认的数据路径
 */
function getDefaultDataPath() {
    if (window.electron && window.electron.appDataPath) {
        return window.electron.appDataPath;
    }
    return 'C:/Users/用户/AppData/Roaming/fouair-toolbox';
}

/**
 * 从UI获取设置值
 */
function getSettingsFromUI(contentArea) {
    const settings = { ...currentSettings };
    
    // 通用设置
    settings.language = getSelectValue(contentArea, '#language-select');
    settings.theme = getSelectValue(contentArea, '#theme-select');
    settings.notifications = getCheckboxValue(contentArea, '#enable-notifications');
    settings.autoStart = getCheckboxValue(contentArea, '#auto-start');
    settings.startMinimized = getCheckboxValue(contentArea, '#start-minimized');
    
    // 安全与隐私
    settings.autoCheckUpdate = getCheckboxValue(contentArea, '#auto-check-update');
    
    // 网络设置
    settings.rpcUrl = getInputValue(contentArea, '#rpc-url');
    settings.defaultProxyGroup = getSelectValue(contentArea, '#default-proxy-group');
    settings.connectionTimeout = parseInt(getInputValue(contentArea, '#connection-timeout'), 10) || 30;
    
    // 数据与备份
    settings.autoBackup = getSelectValue(contentArea, '#auto-backup');
    
    // 开发者选项
    settings.devMode = getCheckboxValue(contentArea, '#dev-mode');
    settings.logLevel = getSelectValue(contentArea, '#log-level');
    
    return settings;
}

/**
 * 获取选择框的值
 */
function getSelectValue(contentArea, selector) {
    const select = contentArea.querySelector(selector);
    return select ? select.value : '';
}

/**
 * 获取复选框的值
 */
function getCheckboxValue(contentArea, selector) {
    const checkbox = contentArea.querySelector(selector);
    return checkbox ? checkbox.checked : false;
}

/**
 * 获取输入框的值
 */
function getInputValue(contentArea, selector) {
    const input = contentArea.querySelector(selector);
    return input ? input.value : '';
}

/**
 * 设置事件监听器
 */
function setupEventListeners(contentArea) {
    // 通用设置变更
    setupChangeListeners(contentArea, [
        '#language-select', 
        '#theme-select',
        '#enable-notifications',
        '#auto-start',
        '#start-minimized'
    ], handleSettingChange);
    
    // 安全设置变更
    setupChangeListeners(contentArea, [
        '#auto-check-update'
    ], handleSettingChange);
    
    // 网络设置变更
    setupChangeListeners(contentArea, [
        '#rpc-url',
        '#default-proxy-group',
        '#connection-timeout'
    ], handleSettingChange);
    
    // 数据设置变更
    setupChangeListeners(contentArea, [
        '#auto-backup'
    ], handleSettingChange);
    
    // 开发者设置变更
    setupChangeListeners(contentArea, [
        '#dev-mode',
        '#log-level'
    ], handleSettingChange);
    
    // 开发者模式切换
    const devModeCheckbox = contentArea.querySelector('#dev-mode');
    if (devModeCheckbox) {
        devModeCheckbox.addEventListener('change', () => {
            updateDevOptionsVisibility(contentArea, devModeCheckbox.checked);
        });
    }
    
    // 按钮点击事件
    setupButtonHandlers(contentArea);
}

/**
 * 设置多个元素的变更监听器
 */
function setupChangeListeners(contentArea, selectors, handler) {
    selectors.forEach(selector => {
        const element = contentArea.querySelector(selector);
        if (element) {
            element.addEventListener('change', () => handler(contentArea));
        }
    });
}

/**
 * 处理设置变更
 */
async function handleSettingChange(contentArea) {
    console.log("Settings changed, saving...");
    
    // 获取新的设置值
    const newSettings = getSettingsFromUI(contentArea);
    
    // 检查"关闭时最小化到托盘"选项是否更改
    let minimizeToTrayChanged = false;
    if (newSettings.startMinimized !== currentSettings.startMinimized) {
        minimizeToTrayChanged = true;
        console.log("关闭时最小化到托盘选项已更改:", newSettings.startMinimized);
    }
    
    // 只有在设置有变化时才保存
    if (JSON.stringify(newSettings) !== JSON.stringify(currentSettings)) {
        currentSettings = newSettings;
        
        // 保存设置
        if (await saveSettings(newSettings)) {
            showToast('设置已保存', 'success');
            applySettings(newSettings);
            
            // 如果"关闭时最小化到托盘"选项已更改，则直接通知主进程
            if (minimizeToTrayChanged && window.electron && window.electron.ipcRenderer) {
                try {
                    console.log("发送关闭行为更改通知到主进程");
                    // 使用特定通道通知主进程立即更新窗口关闭行为
                    window.electron.ipcRenderer.send('settings:updateTrayOption', newSettings.startMinimized);
                    // 再发送一个备用通道消息，确保消息能被接收
                    window.electron.ipcRenderer.send('direct:updateCloseHandler', newSettings.startMinimized);
                } catch (error) {
                    console.error("通知主进程更新关闭行为失败:", error);
                }
            }
        } else {
            showToast('保存设置失败', 'error');
        }
    }
}

/**
 * 更新开发者选项可见性
 */
function updateDevOptionsVisibility(contentArea, visible) {
    const devOptions = contentArea.querySelectorAll('.dev-option');
    devOptions.forEach(option => {
        option.style.display = visible ? 'block' : 'none';
    });
}

/**
 * 应用设置到应用程序
 */
function applySettings(settings) {
    // 应用主题
    applyTheme(settings.theme);
    
    // 其他设置应用...
    if (window.settingsAPI && window.settingsAPI.applySettings) {
        window.settingsAPI.applySettings(settings);
    }
}

/**
 * 设置按钮处理器
 */
function setupButtonHandlers(contentArea) {
    // 手动锁定应用
    const manualLockBtn = contentArea.querySelector('#manual-lock');
    if (manualLockBtn) {
        manualLockBtn.addEventListener('click', handleManualLock);
    }
    
    // 备份数据
    const backupNowBtn = contentArea.querySelector('#backup-now');
    if (backupNowBtn) {
        backupNowBtn.addEventListener('click', handleBackupNow);
    }
    
    // 清除缓存
    const clearCacheBtn = contentArea.querySelector('#clear-cache');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', handleClearCache);
    }
    
    // 检查更新
    const updateBtn = contentArea.querySelector('#check-update');
    if (updateBtn) {
        updateBtn.addEventListener('click', handleCheckUpdate);
    }
    
    // 打开开发者工具
    const devToolsBtn = contentArea.querySelector('#open-devtools');
    if (devToolsBtn) {
        devToolsBtn.addEventListener('click', handleOpenDevTools);
    }
    
    // 生成调试报告
    const debugBtn = contentArea.querySelector('#debug-report');
    if (debugBtn) {
        debugBtn.addEventListener('click', handleDebugReport);
    }
}

/**
 * 应用主题
 */
function applyTheme(theme) {
    const html = document.querySelector('html');
    
    // 移除旧主题类
    html.classList.remove('theme-light', 'theme-dark');
    
    // 应用选择的主题或自动主题
    if (theme === 'auto') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        html.classList.add(prefersDark ? 'theme-dark' : 'theme-light');
    } else {
        html.classList.add(`theme-${theme}`);
    }
}

// 按钮处理函数
async function handleBackupNow() {
    try {
        if (window.dataAPI && window.dataAPI.backup) {
            await window.dataAPI.backup();
            showToast('数据备份成功', 'success');
        } else {
            showToast('备份功能尚未实现', 'info');
        }
    } catch (error) {
        console.error('备份数据失败:', error);
        showToast('备份数据失败', 'error');
    }
}

async function handleClearCache() {
    try {
        if (confirm('确定要清除缓存数据吗？这不会删除您的设置和钱包数据。')) {
            if (window.appAPI && window.appAPI.clearCache) {
                await window.appAPI.clearCache();
                showToast('缓存数据已清除', 'success');
            } else {
                showToast('清除缓存功能尚未实现', 'info');
            }
        }
    } catch (error) {
        console.error('清除缓存失败:', error);
        showToast('清除缓存失败: ' + error.message, 'error');
    }
}

async function handleCheckUpdate() {
    try {
        if (window.appAPI && window.appAPI.checkForUpdates) {
            showToast('正在检查更新...', 'info');
            const result = await window.appAPI.checkForUpdates();
            
            // 处理错误情况
            if (result.error) {
                showToast(`检查更新失败: ${result.error}`, 'error');
                return;
            }
            
            if (result.hasUpdate) {
                // 创建更新对话框
                const updateModal = document.createElement('div');
                updateModal.className = 'modal update-modal';
                updateModal.innerHTML = `
                    <div class="modal-content" style="max-width: 500px;">
                        <div class="modal-header">
                            <h4>发现新版本</h4>
                            <button class="modal-close-btn">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="modal-body">
                            <p><strong>当前版本:</strong> v${result.currentVersion}</p>
                            <p><strong>最新版本:</strong> v${result.latestVersion}</p>
                            <div class="release-notes" style="margin-top: 16px;">
                                <strong>更新内容:</strong>
                                <div style="max-height: 200px; overflow-y: auto; margin-top: 8px; padding: 12px; background: #f8f9fa; border-radius: 4px;">
                                    ${result.releaseNotes.replace(/\n/g, '<br>')}
                                </div>
                            </div>
                            <div id="download-progress" style="display: none; margin-top: 16px;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                                    <span>下载进度:</span>
                                    <span id="progress-text">0%</span>
                                </div>
                                <div style="background: #e9ecef; height: 20px; border-radius: 4px; overflow: hidden;">
                                    <div id="progress-bar" style="background: #6c5ce7; height: 100%; width: 0%; transition: width 0.3s;"></div>
                                </div>
                                <div id="progress-details" style="font-size: 12px; color: #666; margin-top: 4px;"></div>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" id="cancel-update">稍后更新</button>
                            <button class="btn btn-primary" id="download-update">
                                ${result.downloadUrl ? '立即下载' : '前往下载页面'}
                            </button>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(updateModal);
                
                // 绑定事件
                const closeBtn = updateModal.querySelector('.modal-close-btn');
                const cancelBtn = updateModal.querySelector('#cancel-update');
                const downloadBtn = updateModal.querySelector('#download-update');
                
                const closeModal = () => {
                    updateModal.remove();
                    // 移除下载进度监听器
                    if (window.electron && window.electron.ipcRenderer) {
                        window.electron.ipcRenderer.removeAllListeners('update-download-progress');
                    }
                };
                
                closeBtn.onclick = closeModal;
                cancelBtn.onclick = closeModal;
                
                downloadBtn.onclick = async () => {
                    if (!result.downloadUrl) {
                        // 如果没有下载链接，打开GitHub发布页面
                        if (window.electron && window.electron.shell) {
                            window.electron.shell.openExternal('https://github.com/fourair/toolbox/releases');
                        }
                        closeModal();
                        return;
                    }
                    
                    // 开始下载
                    downloadBtn.disabled = true;
                    downloadBtn.textContent = '下载中...';
                    document.getElementById('download-progress').style.display = 'block';
                    
                    // 监听下载进度
                    if (window.electron && window.electron.ipcRenderer) {
                        window.electron.ipcRenderer.on('update-download-progress', (event, data) => {
                            const progressBar = document.getElementById('progress-bar');
                            const progressText = document.getElementById('progress-text');
                            const progressDetails = document.getElementById('progress-details');
                            
                            if (progressBar) progressBar.style.width = `${data.progress}%`;
                            if (progressText) progressText.textContent = `${data.progress}%`;
                            if (progressDetails) {
                                const received = (data.receivedBytes / 1024 / 1024).toFixed(2);
                                const total = (data.totalBytes / 1024 / 1024).toFixed(2);
                                progressDetails.textContent = `${received} MB / ${total} MB`;
                            }
                        });
                    }
                    
                    try {
                        const downloadResult = await window.appAPI.downloadUpdate(result.downloadUrl);
                        if (downloadResult.success) {
                            showToast('更新包下载成功，已打开下载目录', 'success');
                            closeModal();
                        } else {
                            showToast(`下载失败: ${downloadResult.message}`, 'error');
                            downloadBtn.disabled = false;
                            downloadBtn.textContent = '重新下载';
                        }
                    } catch (error) {
                        showToast(`下载失败: ${error.message}`, 'error');
                        downloadBtn.disabled = false;
                        downloadBtn.textContent = '重新下载';
                    }
                };
                
                // 显示模态框
                requestAnimationFrame(() => {
                    updateModal.classList.add('visible');
                });
            } else {
                showToast('您已经使用最新版本', 'success');
            }
        } else {
            showToast('检查更新功能尚未实现', 'info');
        }
    } catch (error) {
        console.error('检查更新失败:', error);
        showToast('检查更新失败: ' + error.message, 'error');
    }
}

async function handleOpenDevTools() {
    try {
        if (window.appAPI && window.appAPI.openDevTools) {
            window.appAPI.openDevTools();
        } else {
            console.log('请求打开开发者工具');
        }
    } catch (error) {
        console.error('打开开发者工具失败:', error);
    }
}

async function handleDebugReport() {
    try {
        if (window.appAPI && window.appAPI.generateDebugReport) {
            const report = await window.appAPI.generateDebugReport();
            // 可以在这里打开一个模态框显示报告内容
            console.log('调试报告:', report);
            showToast('调试报告已生成', 'success');
        } else {
            showToast('生成调试报告功能尚未实现', 'info');
        }
    } catch (error) {
        console.error('生成调试报告失败:', error);
        showToast('生成调试报告失败: ' + error.message, 'error');
    }
}

// 处理手动锁定应用
async function handleManualLock() {
    try {
        if (window.electron && window.electron.ipcRenderer) {
            const result = await window.electron.ipcRenderer.invoke('app:lock');
            if (result.success) {
                showToast('应用已锁定', 'info');
            } else {
                showToast(`锁定应用失败：${result.error || '未知错误'}`, 'error');
            }
        } else {
            showToast('锁定功能不可用：IPC未初始化', 'error');
        }
    } catch (error) {
        console.error('锁定应用失败:', error);
        showToast('锁定应用失败: ' + error.message, 'error');
    }
} 