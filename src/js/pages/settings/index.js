/**
 * 重构后的设置页面
 * 使用新的架构：SettingsManager + SettingsForm
 */

import { SettingsManager } from './core/SettingsManager.js';
import { SettingsForm } from './components/SettingsForm.js';
import { showToast } from '../../components/toast.js';
import { initializeSettingsDebug } from './utils/settingsDebug.js';

// 全局设置管理器实例
let settingsManager = null;
let settingsForm = null;

/**
 * 初始化设置页面
 * @param {HTMLElement} contentArea - 主要的内容区域
 */
export async function initSettingsPage(contentArea) {
    console.log("[Settings] 初始化重构后的设置页面...");

    try {
        // 初始化设置管理器
        if (!settingsManager) {
            settingsManager = new SettingsManager();
            await settingsManager.initialize();
            
            // 暴露到全局作为调试接口
            window.FA_SettingsManager = settingsManager;
        }

        // 初始化设置表单
        if (settingsForm) {
            settingsForm.destroy();
        }
        settingsForm = new SettingsForm(contentArea, settingsManager);

        // 渲染表单
        settingsForm.render();

        // 设置事件监听器
        setupGlobalEventListeners();

        // 初始化调试功能
        initializeSettingsDebug(settingsManager, settingsForm);

        console.log("[Settings] 设置页面初始化完成");
    } catch (error) {
        console.error("[Settings] 初始化设置页面失败:", error);
        contentArea.innerHTML = '<div class="error-message">设置页面加载失败，请重试</div>';
        showToast('设置页面加载失败', 'error');
    }
}

/**
 * 设置全局事件监听器
 * 处理跨组件的设置相关事件
 */
function setupGlobalEventListeners() {
    if (!settingsManager) return;

    // 监听设置变更事件
    settingsManager.on('afterChange', (data) => {
        console.log(`[Settings] 设置已变更: ${data.key} = ${data.value}`);
        
        // 处理特殊设置项的副作用
        handleSettingSideEffects(data.key, data.value, data.oldValue);
    });

    // 监听保存成功事件
    settingsManager.on('saveSuccess', () => {
        console.log('[Settings] 设置保存成功');
    });

    // 监听验证错误事件
    settingsManager.on('validationError', (data) => {
        console.warn('[Settings] 设置验证失败:', data);
    });
}

/**
 * 处理设置变更的副作用
 * @param {string} key - 设置键名
 * @param {any} newValue - 新值
 * @param {any} oldValue - 旧值
 */
function handleSettingSideEffects(key, newValue, oldValue) {
    switch (key) {
        case 'autoStart':
            // 处理开机启动设置
            if (window.appAPI && window.appAPI.setAutoLaunch) {
                window.appAPI.setAutoLaunch(newValue);
            }
            break;
    }
}

/**
 * 获取设置管理器实例（供外部使用）
 * @returns {SettingsManager|null} 设置管理器实例
 */
export function getSettingsManager() {
    return settingsManager;
}

/**
 * 获取设置表单实例（供外部使用）
 * @returns {SettingsForm|null} 设置表单实例
 */
export function getSettingsForm() {
    return settingsForm;
}

/**
 * 重新渲染设置表单
 * @returns {boolean} 渲染是否成功
 */
export function refreshSettingsUI() {
    if (settingsForm) {
        try {
            settingsForm.render();
            return true;
        } catch (error) {
            console.error('[Settings] 重新渲染失败:', error);
            return false;
        }
    }
    return false;
}

// ===========================================
// 工具函数（保留用于兼容性和功能支持）
// ===========================================

/**
 * 应用主题（导出供外部使用）
 * @param {string} theme - 主题名称: 'auto', 'light', 'dark'
 */
export function applyTheme(theme) {
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