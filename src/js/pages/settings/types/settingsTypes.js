/**
 * 设置类型定义
 * 统一管理所有设置相关的类型和常量
 */

// 设置分组类型
export const SETTING_GROUPS = {
    GENERAL: 'general',
    SECURITY: 'security',
    NETWORK: 'network',
    DATA_BACKUP: 'dataBackup',
    ABOUT: 'about'
};

// 设置输入类型
export const INPUT_TYPES = {
    TEXT: 'text',
    NUMBER: 'number',
    SELECT: 'select',
    CHECKBOX: 'checkbox',
    TEXTAREA: 'textarea',
    FILE: 'file',
    PASSWORD: 'password'
};

// 设置验证规则类型
export const VALIDATION_TYPES = {
    REQUIRED: 'required',
    MIN: 'min',
    MAX: 'max',
    PATTERN: 'pattern',
    CUSTOM: 'custom'
};

// 设置项配置结构
export const SETTING_ITEM_STRUCTURE = {
    id: 'string',
    group: 'string',
    type: 'string',
    label: 'string',
    description: 'string',
    defaultValue: 'any',
    options: 'array',
    validation: 'object',
    hidden: 'boolean',
    disabled: 'boolean',
    requiresRestart: 'boolean',
    advanced: 'boolean'
};

// 设置操作类型
export const SETTING_ACTIONS = {
    GET: 'get',
    SET: 'set',
    RESET: 'reset',
    EXPORT: 'export',
    IMPORT: 'import',
    VALIDATE: 'validate'
};

// 设置变更事件类型
export const SETTING_EVENTS = {
    BEFORE_CHANGE: 'beforeChange',
    AFTER_CHANGE: 'afterChange',
    VALIDATION_ERROR: 'validationError',
    SAVE_SUCCESS: 'saveSuccess',
    SAVE_ERROR: 'saveError'
}; 