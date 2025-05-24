/**
 * @fileoverview 忘记密码功能服务
 * @module services/forgotPassword
 * @description 处理忘记密码相关功能，包括数据导出和应用重置
 */

import { showModal, closeModal } from '../components/modal.js';
import { showToast } from '../components/toast.js';

/**
 * 显示忘记密码对话框
 */
export function showForgotPasswordDialog() {
    const template = document.getElementById('tpl-forgot-password');
    if (!template) {
        console.error('忘记密码模板未找到');
        return;
    }
    
    const modalContent = template.content.cloneNode(true);
    const modalId = showModal(modalContent);
    
    // 获取模态框元素
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // 绑定事件处理器
    setupForgotPasswordHandlers(modal, modalId);
}

/**
 * 设置忘记密码对话框的事件处理器
 * @param {HTMLElement} modal - 模态框元素
 * @param {string} modalId - 模态框ID
 */
function setupForgotPasswordHandlers(modal, modalId) {
    // 导出数据按钮
    const exportBtn = modal.querySelector('#export-unencrypted-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => handleExportData());
    }
    
    // 显示重置确认按钮
    const showResetBtn = modal.querySelector('#show-reset-confirm-btn');
    const resetConfirmSection = modal.querySelector('.reset-confirm-section');
    if (showResetBtn && resetConfirmSection) {
        showResetBtn.addEventListener('click', () => {
            resetConfirmSection.style.display = 'block';
            showResetBtn.style.display = 'none';
        });
    }
    
    // 确认复选框
    const confirmCheckbox = modal.querySelector('#confirm-reset-checkbox');
    const confirmResetBtn = modal.querySelector('#confirm-reset-btn');
    if (confirmCheckbox && confirmResetBtn) {
        confirmCheckbox.addEventListener('change', (e) => {
            confirmResetBtn.disabled = !e.target.checked;
        });
    }
    
    // 确认重置按钮
    if (confirmResetBtn) {
        confirmResetBtn.addEventListener('click', () => {
            handleResetApplication(modalId);
        });
    }
}

/**
 * 处理导出未加密数据
 */
async function handleExportData() {
    try {
        showToast('正在准备导出数据...', 'info');
        
        // 收集可导出的数据
        const exportData = await collectExportableData();
        
        // 生成文件名
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `fourair-export-${timestamp}.json`;
        
        // 创建下载
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('数据导出成功', 'success');
        
    } catch (error) {
        console.error('导出数据失败:', error);
        showToast('导出数据失败: ' + error.message, 'error');
    }
}

/**
 * 收集可导出的数据（不包含加密内容）
 * @returns {Promise<Object>} 可导出的数据
 */
async function collectExportableData() {
    const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        data: {}
    };
    
    try {
        // 导出设置
        const settings = await window.electronAPI.settings.getAll();
        exportData.data.settings = settings;
        
        // 导出钱包组信息（不包含私钥）
        const walletGroups = await window.electronAPI.wallets.getGroups();
        exportData.data.walletGroups = walletGroups;
        
        // 导出社交账户组信息
        const socialGroups = await window.electronAPI.social.getGroups();
        exportData.data.socialGroups = socialGroups;
        
        // 导出任务记录（如果有）
        try {
            const taskRecords = await window.electronAPI.tasks.getRecords();
            exportData.data.taskRecords = taskRecords;
        } catch (e) {
            console.warn('无法导出任务记录:', e);
        }
        
    } catch (error) {
        console.error('收集导出数据时出错:', error);
        throw error;
    }
    
    return exportData;
}

/**
 * 处理重置应用
 * @param {string} modalId - 当前模态框ID
 */
async function handleResetApplication(modalId) {
    try {
        // 再次确认
        const confirmMessage = '⚠️ 最后确认\n\n' +
            '您即将重置整个应用，这将：\n' +
            '• 删除所有钱包和私钥\n' +
            '• 删除所有账户信息\n' +
            '• 清除所有设置和数据\n' +
            '• 需要重新设置主密码\n\n' +
            '此操作不可撤销！是否继续？';
        
        if (!confirm(confirmMessage)) {
            return;
        }
        
        showToast('正在重置应用...', 'info');
        
        // 调用主进程重置应用
        const result = await window.electronAPI.app.resetApplication();
        
        if (result.success) {
            closeModal(modalId);
            showToast('应用已重置，即将重启...', 'success');
            
            // 延迟后重启应用
            setTimeout(() => {
                window.electronAPI.app.restart();
            }, 2000);
        } else {
            throw new Error(result.error || '重置失败');
        }
        
    } catch (error) {
        console.error('重置应用失败:', error);
        showToast('重置应用失败: ' + error.message, 'error');
    }
}

/**
 * 初始化忘记密码功能
 */
export function initForgotPassword() {
    // 监听忘记密码链接点击
    document.addEventListener('click', (e) => {
        if (e.target && (e.target.matches('.link-forgot-password') || e.target.matches('#forgot-password-link'))) {
            e.preventDefault();
            showForgotPasswordDialog();
        }
    });
} 