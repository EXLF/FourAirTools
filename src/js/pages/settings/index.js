// Import other modules if needed
// import * as table from './table.js';
// import * as modals from './modals.js';
// import * as actions from './actions.js';

// 设置功能实现
import { showMessage } from '../../utils/notifications.js';

// 默认设置对象
const defaultSettings = {
    // 通用设置
    language: 'zh-CN',
    theme: 'auto',
    notifications: true,
    autoStart: false,
    startMinimized: false,
    
    // 安全与隐私
    autoCheckUpdate: true,
    
    // 网络设置
    rpcUrl: '',
    defaultProxyGroup: 'none',
    connectionTimeout: 30,
    
    // 数据与备份
    dataLocation: '',
    autoBackup: 'daily',
    
    // 开发者选项
    devMode: false,
    logLevel: 'info'
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
    const newSettings = getSettingsFromUI(contentArea);
    currentSettings = newSettings;
    
    // 保存设置
    if (await saveSettings(newSettings)) {
        showMessage('设置已保存', 'success');
        applySettings(newSettings);
    } else {
        showMessage('保存设置失败', 'error');
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
    const backupBtn = contentArea.querySelector('#backup-now');
    if (backupBtn) {
        backupBtn.addEventListener('click', handleBackupNow);
    }
    
    // 导出数据
    const exportBtn = contentArea.querySelector('#export-data');
    if (exportBtn) {
        exportBtn.addEventListener('click', handleExportData);
    }
    
    // 导入数据
    const importBtn = contentArea.querySelector('#import-data');
    if (importBtn) {
        importBtn.addEventListener('click', handleImportData);
    }
    
    // 更改数据位置
    const locationBtn = contentArea.querySelector('#change-data-location');
    if (locationBtn) {
        locationBtn.addEventListener('click', handleChangeDataLocation);
    }
    
    // 清除缓存
    const cacheBtn = contentArea.querySelector('#clear-cache');
    if (cacheBtn) {
        cacheBtn.addEventListener('click', handleClearCache);
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
            showMessage('数据备份成功', 'success');
        } else {
            showMessage('备份功能尚未实现', 'info');
        }
    } catch (error) {
        console.error('备份数据失败:', error);
        showMessage('备份数据失败', 'error');
    }
}

async function handleExportData() {
    try {
        if (window.dataAPI && window.dataAPI.exportData) {
            const result = await window.dataAPI.exportData();
            if (result.success) {
                showMessage(`数据已导出至: ${result.path}`, 'success');
            } else {
                showMessage('导出数据已取消', 'info');
            }
        } else {
            showMessage('导出功能尚未实现', 'info');
        }
    } catch (error) {
        console.error('导出数据失败:', error);
        showMessage('导出数据失败: ' + error.message, 'error');
    }
}

async function handleImportData() {
    try {
        if (window.dataAPI && window.dataAPI.importData) {
            if (confirm('导入数据会覆盖当前设置，确定继续吗？')) {
                const result = await window.dataAPI.importData();
                if (result.success) {
                    showMessage('数据导入成功，应用将重启', 'success');
                    setTimeout(() => {
                        if (window.appAPI && window.appAPI.restart) {
                            window.appAPI.restart();
                        }
                    }, 2000);
                } else if (!result.canceled) {
                    showMessage('导入数据失败: ' + (result.error || '未知错误'), 'error');
                }
            }
        } else {
            showMessage('导入功能尚未实现', 'info');
        }
    } catch (error) {
        console.error('导入数据失败:', error);
        showMessage('导入数据失败: ' + error.message, 'error');
    }
}

async function handleChangeDataLocation() {
    try {
        if (window.dataAPI && window.dataAPI.changeDataLocation) {
            const result = await window.dataAPI.changeDataLocation();
            if (result.success) {
                document.querySelector('#data-location').textContent = result.path;
                currentSettings.dataLocation = result.path;
                await saveSettings(currentSettings);
                showMessage('数据存储位置已更改，应用将重启', 'success');
                setTimeout(() => {
                    if (window.appAPI && window.appAPI.restart) {
                        window.appAPI.restart();
                    }
                }, 2000);
            } else if (!result.canceled) {
                showMessage('更改数据位置失败: ' + (result.error || '未知错误'), 'error');
            }
        } else {
            showMessage('更改数据位置功能尚未实现', 'info');
        }
    } catch (error) {
        console.error('更改数据位置失败:', error);
        showMessage('更改数据位置失败: ' + error.message, 'error');
    }
}

async function handleClearCache() {
    try {
        if (confirm('确定要清除缓存数据吗？这不会删除您的设置和钱包数据。')) {
            if (window.appAPI && window.appAPI.clearCache) {
                await window.appAPI.clearCache();
                showMessage('缓存数据已清除', 'success');
            } else {
                showMessage('清除缓存功能尚未实现', 'info');
            }
        }
    } catch (error) {
        console.error('清除缓存失败:', error);
        showMessage('清除缓存失败: ' + error.message, 'error');
    }
}

async function handleCheckUpdate() {
    try {
        if (window.appAPI && window.appAPI.checkForUpdates) {
            showMessage('正在检查更新...', 'info');
            const result = await window.appAPI.checkForUpdates();
            if (result.hasUpdate) {
                if (confirm(`发现新版本: ${result.version}。是否现在更新？`)) {
                    await window.appAPI.downloadUpdate();
    }
            } else {
                showMessage('您已经使用最新版本', 'success');
            }
        } else {
            showMessage('检查更新功能尚未实现', 'info');
        }
    } catch (error) {
        console.error('检查更新失败:', error);
        showMessage('检查更新失败: ' + error.message, 'error');
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
            showMessage('调试报告已生成', 'success');
        } else {
            showMessage('生成调试报告功能尚未实现', 'info');
        }
    } catch (error) {
        console.error('生成调试报告失败:', error);
        showMessage('生成调试报告失败: ' + error.message, 'error');
    }
}

// 处理手动锁定应用
async function handleManualLock() {
    try {
        if (window.electron && window.electron.ipcRenderer) {
            const result = await window.electron.ipcRenderer.invoke('app:lock');
            if (result.success) {
                showMessage('应用已锁定', 'info');
            } else {
                showMessage(`锁定应用失败：${result.error || '未知错误'}`, 'error');
            }
        } else {
            showMessage('锁定功能不可用：IPC未初始化', 'error');
        }
    } catch (error) {
        console.error('锁定应用失败:', error);
        showMessage('锁定应用失败: ' + error.message, 'error');
    }
} 