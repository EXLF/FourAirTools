/**
 * 设置表单组件
 * 根据schema动态生成表单UI
 */

import { INPUT_TYPES, SETTING_GROUPS } from '../types/settingsTypes.js';
import { showToast } from '../../../components/toast.js';

export class SettingsForm {
    constructor(container, settingsManager) {
        this.container = container;
        this.settingsManager = settingsManager;
        this.schema = settingsManager.getSchema();
        this.validator = settingsManager.getValidator();
        this.boundHandlers = new Map();
        
        console.log('[SettingsForm] 表单组件初始化完成');
    }

    /**
     * 渲染表单
     */
    render() {
        try {
            console.log('[SettingsForm] 开始渲染表单...');
            
            const groupInfo = this.schema.getGroupInfo();
            const definitions = this.schema.getAllDefinitions();
            const currentSettings = this.settingsManager.get();

            let html = '<div class="page-header"><h2>软件设置</h2></div>';
            html += '<div class="settings-layout">';

            // 渲染各个分组
            for (const [groupId, groupData] of Object.entries(groupInfo)) {
                if (groupId === SETTING_GROUPS.ABOUT) {
                    html += this._renderAboutSection();
                    continue;
                }

                const groupDefinitions = definitions[groupId];
                if (!groupDefinitions || Object.keys(groupDefinitions).length === 0) {
                    continue;
                }

                html += this._renderGroup(groupId, groupData, groupDefinitions, currentSettings);
            }

            html += '</div>';
            
            this.container.innerHTML = html;
            this._bindEvents();
            
            console.log('[SettingsForm] 表单渲染完成');
        } catch (error) {
            console.error('[SettingsForm] 渲染表单失败:', error);
            this.container.innerHTML = '<div class="error-message">设置页面加载失败</div>';
        }
    }

    /**
     * 渲染设置分组
     * @private
     */
    _renderGroup(groupId, groupData, groupDefinitions, currentSettings) {
        let html = `<div class="card" data-group="${groupId}">`;
        html += `<h4><i class="${groupData.icon}"></i> ${groupData.label}</h4>`;

        // 渲染普通设置项
        for (const [settingId, definition] of Object.entries(groupDefinitions)) {
            html += this._renderSettingItem(settingId, definition, currentSettings);
        }

        // 添加分组特有的按钮
        html += this._renderGroupActions(groupId);

        html += '</div>';
        return html;
    }

    /**
     * 渲染单个设置项
     * @private
     */
    _renderSettingItem(settingId, definition, currentSettings) {
        const currentValue = currentSettings[settingId];
        const validationSummary = this.validator.getValidationSummary(settingId);
        
        let html = `<div class="option-group" data-setting="${settingId}">`;
        
        // 标签
        const requiredMark = definition.validation?.required ? '<span class="required">*</span>' : '';
        html += `<label for="setting-${settingId}">${definition.label} ${requiredMark}</label>`;

        // 输入控件
        html += this._renderInput(settingId, definition, currentValue);

        // 对于checkbox类型，不显示下方描述，描述已经在checkbox旁边
        if (definition.type !== INPUT_TYPES.CHECKBOX && definition.description) {
            html += `<p class="option-description">${definition.description}</p>`;
        }
        
        if (validationSummary) {
            html += `<p class="validation-hint">${validationSummary}</p>`;
        }

        // 需要重启提示
        if (definition.requiresRestart) {
            html += '<p class="restart-hint"><i class="fa fa-info-circle"></i> 此设置需要重启应用程序后生效</p>';
        }

        html += '</div>';
        return html;
    }

    /**
     * 渲染输入控件
     * @private
     */
    _renderInput(settingId, definition, currentValue) {
        const inputId = `setting-${settingId}`;
        const disabled = definition.disabled ? 'disabled' : '';
        const placeholder = definition.placeholder ? `placeholder="${definition.placeholder}"` : '';

        switch (definition.type) {
            case INPUT_TYPES.SELECT:
                return this._renderSelect(inputId, definition, currentValue, disabled);

            case INPUT_TYPES.CHECKBOX:
                const checked = currentValue ? 'checked' : '';
                return `
                    <div class="checkbox-group">
                        <input type="checkbox" id="${inputId}" name="${settingId}" ${checked} ${disabled}>
                        <label for="${inputId}">${definition.description || definition.label}</label>
                    </div>
                `;

            case INPUT_TYPES.NUMBER:
                const min = definition.validation?.min !== undefined ? `min="${definition.validation.min}"` : '';
                const max = definition.validation?.max !== undefined ? `max="${definition.validation.max}"` : '';
                const step = definition.step ? `step="${definition.step}"` : '';
                return `<input type="number" id="${inputId}" name="${settingId}" value="${currentValue || ''}" ${min} ${max} ${step} ${placeholder} ${disabled}>`;

            case INPUT_TYPES.TEXTAREA:
                const rows = definition.rows || 3;
                return `<textarea id="${inputId}" name="${settingId}" rows="${rows}" ${placeholder} ${disabled}>${currentValue || ''}</textarea>`;

            case INPUT_TYPES.PASSWORD:
                return `<input type="password" id="${inputId}" name="${settingId}" value="${currentValue || ''}" ${placeholder} ${disabled}>`;

            case INPUT_TYPES.TEXT:
            default:
                return `<input type="text" id="${inputId}" name="${settingId}" value="${currentValue || ''}" ${placeholder} ${disabled}>`;
        }
    }

    /**
     * 渲染下拉选择框
     * @private
     */
    _renderSelect(inputId, definition, currentValue, disabled) {
        let html = `<select id="${inputId}" name="${definition.id}" ${disabled}>`;
        
        if (definition.options && Array.isArray(definition.options)) {
            for (const option of definition.options) {
                const selected = option.value === currentValue ? 'selected' : '';
                html += `<option value="${option.value}" ${selected}>${option.label}</option>`;
            }
        }
        
        html += '</select>';
        return html;
    }

    /**
     * 渲染分组操作按钮
     * @private
     */
    _renderGroupActions(groupId) {
        let html = '';

        switch (groupId) {
            case SETTING_GROUPS.SECURITY:
                html += `
                    <div class="option-group">
                        <label>应用安全:</label>
                        <button class="btn btn-primary" id="manual-lock">
                            <i class="fa fa-lock"></i> 手动锁定应用
                        </button>
                        <small class="hint">快捷键: Ctrl+L (Windows) / Cmd+L (Mac)</small>
                    </div>
                    <div class="option-group">
                        <button class="btn btn-warning" id="clear-cache">
                            <i class="fa fa-broom"></i> 清除缓存数据
                        </button>
                    </div>
                `;
                break;

            case SETTING_GROUPS.DATA_BACKUP:
                html += `
                    <div class="option-group">
                        <label>数据存储位置:</label>
                        <div class="path-display" id="data-location">${this._getDefaultDataPath()}</div>
                    </div>
                    <div class="option-group">
                        <button class="btn btn-primary" id="backup-now">
                            <i class="fa fa-download"></i> 立即备份数据
                        </button>
                    </div>
                    <p class="note">自动备份会将钱包和社交账户的明文数据备份到应用数据目录下的 <code>backups</code> 文件夹。请妥善保管！</p>
                `;
                break;


        }

        return html;
    }

    /**
     * 渲染关于部分
     * @private
     */
    _renderAboutSection() {
        return `
            <div class="card">
                <h4><i class="fa fa-info-circle"></i> 关于</h4>
                <div class="about-content">
                    <div class="app-info">
                        <h3>FourAir社区撸毛工具箱</h3>
                        <p class="version">Version: v1.3.2</p>
                        <p>构建日期: 2025年6月2日</p>
                        <p class="copyright">© 2025 FourAir Team</p>
                    </div>
                </div>
                <div class="option-group">
                    <button class="btn btn-primary" id="check-update">
                        <i class="fa fa-sync"></i> 检查更新
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * 绑定事件处理器
     * @private
     */
    _bindEvents() {
        try {
            console.log('[SettingsForm] 绑定事件处理器...');

            // 清理旧的事件处理器
            this._unbindEvents();

            // 绑定设置项变更事件
            this._bindSettingChangeEvents();

            // 绑定按钮事件
            this._bindButtonEvents();

            console.log('[SettingsForm] 事件绑定完成');
        } catch (error) {
            console.error('[SettingsForm] 绑定事件失败:', error);
        }
    }

    /**
     * 绑定设置项变更事件
     * @private
     */
    _bindSettingChangeEvents() {
        const settingElements = this.container.querySelectorAll('[name]');
        
        settingElements.forEach(element => {
            const settingId = element.name;
            const handler = async (event) => {
                await this._handleSettingChange(settingId, event.target);
            };

            element.addEventListener('change', handler);
            this.boundHandlers.set(element, handler);
        });
    }

    /**
     * 绑定按钮事件
     * @private
     */
    _bindButtonEvents() {
        const buttonMappings = {
            'manual-lock': this._handleManualLock,
            'clear-cache': this._handleClearCache,
            'backup-now': this._handleBackupNow,
            'check-update': this._handleCheckUpdate
        };

        for (const [buttonId, handler] of Object.entries(buttonMappings)) {
            const button = this.container.querySelector(`#${buttonId}`);
            if (button) {
                const boundHandler = handler.bind(this);
                button.addEventListener('click', boundHandler);
                this.boundHandlers.set(button, boundHandler);
            }
        }
    }



    /**
     * 处理设置项变更
     * @private
     */
    async _handleSettingChange(settingId, element) {
        try {
            let value;
            
            switch (element.type) {
                case 'checkbox':
                    value = element.checked;
                    break;
                case 'number':
                    value = parseFloat(element.value) || 0;
                    break;
                default:
                    value = element.value;
            }

            await this.settingsManager.set(settingId, value);
        } catch (error) {
            console.error('[SettingsForm] 处理设置变更失败:', error);
        }
    }



    /**
     * 获取默认数据路径
     * @private
     */
    _getDefaultDataPath() {
        if (window.electron && window.electron.appDataPath) {
            return window.electron.appDataPath;
        }
        return 'C:/Users/用户/AppData/Roaming/fouair-toolbox';
    }

    /**
     * 解绑事件处理器
     * @private
     */
    _unbindEvents() {
        this.boundHandlers.forEach((handler, element) => {
            element.removeEventListener('change', handler);
            element.removeEventListener('click', handler);
        });
        this.boundHandlers.clear();
    }

    /**
     * 销毁组件
     */
    destroy() {
        this._unbindEvents();
        this.container.innerHTML = '';
    }

    // ===========================================
    // 按钮处理方法（与原版保持兼容）
    // ===========================================

    async _handleManualLock() {
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

    async _handleClearCache() {
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

    async _handleBackupNow() {
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

    async _handleCheckUpdate() {
        // 这里保持原有的复杂更新检查逻辑
        try {
            if (window.appAPI && window.appAPI.checkForUpdates) {
                showToast('正在检查更新...', 'info');
                const result = await window.appAPI.checkForUpdates();
                
                if (result.error) {
                    showToast(`检查更新失败: ${result.error}`, 'error');
                    return;
                }
                
                if (result.hasUpdate) {
                    // 这里可以触发更新对话框的显示
                    console.log('发现新版本:', result);
                    showToast(`发现新版本 v${result.latestVersion}`, 'info');
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


} 