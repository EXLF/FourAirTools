/**
 * 设置验证器
 * 统一的设置项验证逻辑
 */

import { VALIDATION_TYPES } from '../types/settingsTypes.js';

export class SettingsValidator {
    constructor(schema) {
        this.schema = schema;
        console.log('[SettingsValidator] 验证器初始化完成');
    }

    /**
     * 验证单个设置项
     * @param {string} settingId - 设置ID
     * @param {any} value - 设置值
     * @returns {Object} 验证结果 { valid: boolean, error: string }
     */
    validateSetting(settingId, value) {
        const definition = this.schema.getDefinition(settingId);
        if (!definition) {
            return {
                valid: false,
                error: `未知的设置项: ${settingId}`
            };
        }

        return this._validateValue(value, definition);
    }

    /**
     * 批量验证设置
     * @param {Object} settings - 设置对象
     * @returns {Object} 验证结果 { valid: boolean, errors: Object }
     */
    validateSettings(settings) {
        const errors = {};
        let valid = true;

        for (const [settingId, value] of Object.entries(settings)) {
            const result = this.validateSetting(settingId, value);
            if (!result.valid) {
                errors[settingId] = result.error;
                valid = false;
            }
        }

        return { valid, errors };
    }

    /**
     * 验证设置值
     * @private
     */
    _validateValue(value, definition) {
        const { validation = {}, type } = definition;

        // 类型验证
        const typeValidation = this._validateType(value, type);
        if (!typeValidation.valid) {
            return typeValidation;
        }

        // 必填验证
        if (validation[VALIDATION_TYPES.REQUIRED] && this._isEmpty(value)) {
            return {
                valid: false,
                error: `${definition.label} 不能为空`
            };
        }

        // 数值范围验证
        if (type === 'number' && value !== null && value !== undefined && value !== '') {
            if (validation[VALIDATION_TYPES.MIN] !== undefined && value < validation[VALIDATION_TYPES.MIN]) {
                return {
                    valid: false,
                    error: `${definition.label} 不能小于 ${validation[VALIDATION_TYPES.MIN]}`
                };
            }

            if (validation[VALIDATION_TYPES.MAX] !== undefined && value > validation[VALIDATION_TYPES.MAX]) {
                return {
                    valid: false,
                    error: `${definition.label} 不能大于 ${validation[VALIDATION_TYPES.MAX]}`
                };
            }
        }

        // 字符串长度验证
        if (type === 'text' && typeof value === 'string') {
            if (validation[VALIDATION_TYPES.MIN] !== undefined && value.length < validation[VALIDATION_TYPES.MIN]) {
                return {
                    valid: false,
                    error: `${definition.label} 长度不能少于 ${validation[VALIDATION_TYPES.MIN]} 个字符`
                };
            }

            if (validation[VALIDATION_TYPES.MAX] !== undefined && value.length > validation[VALIDATION_TYPES.MAX]) {
                return {
                    valid: false,
                    error: `${definition.label} 长度不能超过 ${validation[VALIDATION_TYPES.MAX]} 个字符`
                };
            }
        }

        // 正则表达式验证
        if (validation[VALIDATION_TYPES.PATTERN] && value) {
            const pattern = validation[VALIDATION_TYPES.PATTERN];
            if (!pattern.test(value)) {
                return {
                    valid: false,
                    error: `${definition.label} 格式不正确`
                };
            }
        }

        // 选项验证
        if (definition.options && !this._isEmpty(value)) {
            const validValues = definition.options.map(opt => opt.value);
            if (!validValues.includes(value)) {
                return {
                    valid: false,
                    error: `${definition.label} 包含无效选项`
                };
            }
        }

        // 自定义验证
        if (validation[VALIDATION_TYPES.CUSTOM] && typeof validation[VALIDATION_TYPES.CUSTOM] === 'function') {
            try {
                const customResult = validation[VALIDATION_TYPES.CUSTOM](value, definition);
                if (customResult !== true) {
                    return {
                        valid: false,
                        error: typeof customResult === 'string' ? customResult : `${definition.label} 验证失败`
                    };
                }
            } catch (error) {
                return {
                    valid: false,
                    error: `${definition.label} 验证过程中发生错误: ${error.message}`
                };
            }
        }

        return { valid: true };
    }

    /**
     * 验证数据类型
     * @private
     */
    _validateType(value, type) {
        // 空值检查交给required验证
        if (this._isEmpty(value)) {
            return { valid: true };
        }

        switch (type) {
            case 'text':
            case 'textarea':
            case 'password':
                if (typeof value !== 'string') {
                    return {
                        valid: false,
                        error: '值必须是字符串类型'
                    };
                }
                break;

            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    return {
                        valid: false,
                        error: '值必须是有效数字'
                    };
                }
                break;

            case 'checkbox':
                if (typeof value !== 'boolean') {
                    return {
                        valid: false,
                        error: '值必须是布尔类型'
                    };
                }
                break;

            case 'select':
                // select的具体值验证在后面的选项验证中处理
                break;

            default:
                // 未知类型，通过验证
                break;
        }

        return { valid: true };
    }

    /**
     * 检查值是否为空
     * @private
     */
    _isEmpty(value) {
        return value === null || value === undefined || value === '';
    }

    /**
     * 获取设置项的验证规则摘要
     * @param {string} settingId - 设置ID
     * @returns {string} 验证规则描述
     */
    getValidationSummary(settingId) {
        const definition = this.schema.getDefinition(settingId);
        if (!definition || !definition.validation) {
            return '';
        }

        const rules = [];
        const { validation, type } = definition;

        if (validation[VALIDATION_TYPES.REQUIRED]) {
            rules.push('必填');
        }

        if (type === 'number') {
            if (validation[VALIDATION_TYPES.MIN] !== undefined) {
                rules.push(`最小值: ${validation[VALIDATION_TYPES.MIN]}`);
            }
            if (validation[VALIDATION_TYPES.MAX] !== undefined) {
                rules.push(`最大值: ${validation[VALIDATION_TYPES.MAX]}`);
            }
        }

        if (type === 'text') {
            if (validation[VALIDATION_TYPES.MIN] !== undefined) {
                rules.push(`最小长度: ${validation[VALIDATION_TYPES.MIN]}`);
            }
            if (validation[VALIDATION_TYPES.MAX] !== undefined) {
                rules.push(`最大长度: ${validation[VALIDATION_TYPES.MAX]}`);
            }
        }

        if (validation[VALIDATION_TYPES.PATTERN]) {
            rules.push('格式验证');
        }

        return rules.join(', ');
    }
} 