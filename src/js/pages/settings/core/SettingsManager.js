/**
 * 设置管理器
 * 统一的设置操作接口，协调各个组件
 */

import { SettingsSchema } from './SettingsSchema.js';
import { SettingsValidator } from './SettingsValidator.js';
import { SETTING_EVENTS, SETTING_ACTIONS } from '../types/settingsTypes.js';
import { showToast } from '../../../components/toast.js';

export class SettingsManager {
    constructor() {
        this.schema = new SettingsSchema();
        this.validator = new SettingsValidator(this.schema);
        this.currentSettings = {};
        this.listeners = new Map();
        this.saveTimeout = null;
        this.isDirty = false;
        
        console.log('[SettingsManager] 核心管理器初始化完成');
    }

    /**
     * 初始化设置管理器
     * @returns {Promise<boolean>} 初始化是否成功
     */
    async initialize() {
        try {
            console.log('[SettingsManager] 开始初始化...');
            
            // 加载设置
            await this.loadSettings();
            
            // 初始化默认值
            this._ensureDefaultValues();
            
            console.log('[SettingsManager] 初始化完成');
            return true;
        } catch (error) {
            console.error('[SettingsManager] 初始化失败:', error);
            return false;
        }
    }

    /**
     * 获取设置值
     * @param {string} key - 设置键名
     * @returns {any} 设置值
     */
    get(key) {
        if (key) {
            return this.currentSettings[key];
        }
        return { ...this.currentSettings };
    }

    /**
     * 设置单个设置项
     * @param {string} key - 设置键名
     * @param {any} value - 设置值
     * @param {boolean} immediate - 是否立即保存
     * @returns {Promise<boolean>} 设置是否成功
     */
    async set(key, value, immediate = false) {
        try {
            // 触发beforeChange事件
            const beforeResult = await this._emit(SETTING_EVENTS.BEFORE_CHANGE, { key, value, oldValue: this.currentSettings[key] });
            if (beforeResult === false) {
                return false;
            }

            // 验证设置值
            const validation = this.validator.validateSetting(key, value);
            if (!validation.valid) {
                await this._emit(SETTING_EVENTS.VALIDATION_ERROR, { key, value, error: validation.error });
                showToast(`设置验证失败: ${validation.error}`, 'error');
                return false;
            }

            // 检查值是否有变化
            const oldValue = this.currentSettings[key];
            if (oldValue === value) {
                return true; // 值没有变化，直接返回成功
            }

            // 更新设置
            this.currentSettings[key] = value;
            this.isDirty = true;

            // 触发afterChange事件
            await this._emit(SETTING_EVENTS.AFTER_CHANGE, { key, value, oldValue });

            // 保存设置
            if (immediate) {
                return await this.save();
            } else {
                this._scheduleSave();
                return true;
            }
        } catch (error) {
            console.error('[SettingsManager] 设置失败:', error);
            showToast(`设置失败: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * 批量设置
     * @param {Object} settings - 设置对象
     * @param {boolean} immediate - 是否立即保存
     * @returns {Promise<boolean>} 设置是否成功
     */
    async setMultiple(settings, immediate = false) {
        try {
            // 批量验证
            const validation = this.validator.validateSettings(settings);
            if (!validation.valid) {
                const firstError = Object.values(validation.errors)[0];
                await this._emit(SETTING_EVENTS.VALIDATION_ERROR, { settings, errors: validation.errors });
                showToast(`设置验证失败: ${firstError}`, 'error');
                return false;
            }

            // 批量更新
            let hasChanges = false;
            for (const [key, value] of Object.entries(settings)) {
                if (this.currentSettings[key] !== value) {
                    const oldValue = this.currentSettings[key];
                    this.currentSettings[key] = value;
                    hasChanges = true;
                    
                    // 触发单个项目的afterChange事件
                    await this._emit(SETTING_EVENTS.AFTER_CHANGE, { key, value, oldValue });
                }
            }

            if (!hasChanges) {
                return true; // 没有变化，直接返回成功
            }

            this.isDirty = true;

            // 保存设置
            if (immediate) {
                return await this.save();
            } else {
                this._scheduleSave();
                return true;
            }
        } catch (error) {
            console.error('[SettingsManager] 批量设置失败:', error);
            showToast(`批量设置失败: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * 重置设置项
     * @param {string|Array<string>} keys - 要重置的设置键名
     * @param {boolean} immediate - 是否立即保存
     * @returns {Promise<boolean>} 重置是否成功
     */
    async reset(keys, immediate = false) {
        try {
            const keysToReset = Array.isArray(keys) ? keys : [keys];
            const defaultValues = this.schema.getDefaultValues();
            const resetSettings = {};

            for (const key of keysToReset) {
                if (defaultValues.hasOwnProperty(key)) {
                    resetSettings[key] = defaultValues[key];
                }
            }

            return await this.setMultiple(resetSettings, immediate);
        } catch (error) {
            console.error('[SettingsManager] 重置设置失败:', error);
            showToast(`重置设置失败: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * 重置所有设置
     * @param {boolean} immediate - 是否立即保存
     * @returns {Promise<boolean>} 重置是否成功
     */
    async resetAll(immediate = true) {
        try {
            const defaultValues = this.schema.getDefaultValues();
            return await this.setMultiple(defaultValues, immediate);
        } catch (error) {
            console.error('[SettingsManager] 重置所有设置失败:', error);
            showToast(`重置所有设置失败: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * 保存设置
     * @returns {Promise<boolean>} 保存是否成功
     */
    async save() {
        try {
            if (!this.isDirty) {
                return true; // 没有变化，不需要保存
            }

            console.log('[SettingsManager] 保存设置...');

            // 使用settingsAPI保存
            if (window.settingsAPI && window.settingsAPI.saveSettings) {
                await window.settingsAPI.saveSettings(this.currentSettings);
            } else {
                // 降级到localStorage
                localStorage.setItem('app_settings', JSON.stringify(this.currentSettings));
            }

            this.isDirty = false;
            await this._emit(SETTING_EVENTS.SAVE_SUCCESS, { settings: { ...this.currentSettings } });
            showToast('设置已保存', 'success');
            
            console.log('[SettingsManager] 设置保存成功');
            return true;
        } catch (error) {
            console.error('[SettingsManager] 保存设置失败:', error);
            await this._emit(SETTING_EVENTS.SAVE_ERROR, { error: error.message });
            showToast(`保存设置失败: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * 加载设置
     * @returns {Promise<boolean>} 加载是否成功
     */
    async loadSettings() {
        try {
            console.log('[SettingsManager] 加载设置...');

            let loadedSettings = null;

            // 尝试从electron存储读取设置
            if (window.settingsAPI && window.settingsAPI.getSettings) {
                loadedSettings = await window.settingsAPI.getSettings();
            } else {
                // 降级到localStorage
                const savedSettings = localStorage.getItem('app_settings');
                if (savedSettings) {
                    loadedSettings = JSON.parse(savedSettings);
                }
            }

            // 合并默认值
            const defaultValues = this.schema.getDefaultValues();
            this.currentSettings = { ...defaultValues, ...loadedSettings };

            console.log('[SettingsManager] 设置加载成功');
            return true;
        } catch (error) {
            console.error('[SettingsManager] 加载设置失败:', error);
            
            // 使用默认值
            this.currentSettings = this.schema.getDefaultValues();
            return false;
        }
    }

    /**
     * 导出设置
     * @returns {Object} 设置对象
     */
    export() {
        return {
            version: '1.0.0',
            timestamp: new Date().toISOString(),
            settings: { ...this.currentSettings }
        };
    }

    /**
     * 导入设置
     * @param {Object} data - 导入的数据
     * @param {boolean} immediate - 是否立即保存
     * @returns {Promise<boolean>} 导入是否成功
     */
    async import(data, immediate = true) {
        try {
            if (!data || !data.settings) {
                throw new Error('无效的设置数据格式');
            }

            return await this.setMultiple(data.settings, immediate);
        } catch (error) {
            console.error('[SettingsManager] 导入设置失败:', error);
            showToast(`导入设置失败: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * 获取设置架构
     * @returns {SettingsSchema} 设置架构
     */
    getSchema() {
        return this.schema;
    }

    /**
     * 获取验证器
     * @returns {SettingsValidator} 验证器
     */
    getValidator() {
        return this.validator;
    }

    /**
     * 添加事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    /**
     * 移除事件监听器
     * @param {string} event - 事件名称
     * @param {Function} callback - 回调函数
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * 检查是否有未保存的更改
     * @returns {boolean} 是否有未保存的更改
     */
    isDirtyState() {
        return this.isDirty;
    }

    /**
     * 私有方法：确保默认值
     * @private
     */
    _ensureDefaultValues() {
        const defaultValues = this.schema.getDefaultValues();
        let hasChanges = false;

        for (const [key, defaultValue] of Object.entries(defaultValues)) {
            if (!this.currentSettings.hasOwnProperty(key)) {
                this.currentSettings[key] = defaultValue;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            this.isDirty = true;
            this._scheduleSave();
        }
    }

    /**
     * 私有方法：安排保存
     * @private
     */
    _scheduleSave() {
        // 防抖保存，500ms后执行
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }

        this.saveTimeout = setTimeout(() => {
            this.save();
        }, 500);
    }

    /**
     * 私有方法：触发事件
     * @private
     */
    async _emit(event, data) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const results = await Promise.all(callbacks.map(callback => {
                try {
                    return callback(data);
                } catch (error) {
                    console.error(`[SettingsManager] 事件回调错误 (${event}):`, error);
                    return null;
                }
            }));

            // 如果有任何回调返回false，则返回false
            return !results.includes(false);
        }
        return true;
    }
} 