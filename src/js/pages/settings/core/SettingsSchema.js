/**
 * 设置架构定义
 * 统一的设置项定义，消除前后端重复
 */

import { SETTING_GROUPS, INPUT_TYPES, VALIDATION_TYPES } from '../types/settingsTypes.js';

export class SettingsSchema {
    constructor() {
        this.definitions = this._createDefinitions();
        console.log('[SettingsSchema] 架构初始化完成');
    }

    /**
     * 创建设置定义
     * @private
     */
    _createDefinitions() {
        return {
            [SETTING_GROUPS.GENERAL]: {
                notifications: {
                    id: 'notifications',
                    group: SETTING_GROUPS.GENERAL,
                    type: INPUT_TYPES.CHECKBOX,
                    label: '桌面通知',
                    description: '启用桌面通知',
                    defaultValue: true
                },
                autoStart: {
                    id: 'autoStart',
                    group: SETTING_GROUPS.GENERAL,
                    type: INPUT_TYPES.CHECKBOX,
                    label: '开机启动',
                    description: '开机时自动启动',
                    defaultValue: true
                },
                startMinimized: {
                    id: 'startMinimized',
                    group: SETTING_GROUPS.GENERAL,
                    type: INPUT_TYPES.CHECKBOX,
                    label: '最小化到托盘',
                    description: '关闭时最小化而不是退出',
                    defaultValue: true
                }
            },

            [SETTING_GROUPS.SECURITY]: {
                autoCheckUpdate: {
                    id: 'autoCheckUpdate',
                    group: SETTING_GROUPS.SECURITY,
                    type: INPUT_TYPES.CHECKBOX,
                    label: '自动检查更新',
                    description: '定期检查应用程序更新',
                    defaultValue: true
                },
                autoLockTimeout: {
                    id: 'autoLockTimeout',
                    group: SETTING_GROUPS.SECURITY,
                    type: INPUT_TYPES.NUMBER,
                    label: '自动锁定超时时间(分钟)',
                    description: '应用程序空闲多长时间后自动锁定',
                    defaultValue: 60,
                    validation: {
                        [VALIDATION_TYPES.MIN]: 5,
                        [VALIDATION_TYPES.MAX]: 1440
                    },
                    advanced: true
                }
            },

            [SETTING_GROUPS.NETWORK]: {
                rpcUrl: {
                    id: 'rpcUrl',
                    group: SETTING_GROUPS.NETWORK,
                    type: INPUT_TYPES.TEXT,
                    label: 'RPC节点地址',
                    description: '留空使用默认RPC节点，支持HTTP/HTTPS格式的JSON-RPC端点',
                    defaultValue: '',
                    placeholder: 'https://eth-mainnet.g.alchemy.com/v2/...',
                    validation: {
                        [VALIDATION_TYPES.PATTERN]: /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
                    }
                },

                connectionTimeout: {
                    id: 'connectionTimeout',
                    group: SETTING_GROUPS.NETWORK,
                    type: INPUT_TYPES.NUMBER,
                    label: '连接超时时间(秒)',
                    description: '网络请求的超时时间',
                    defaultValue: 30,
                    validation: {
                        [VALIDATION_TYPES.MIN]: 5,
                        [VALIDATION_TYPES.MAX]: 300
                    }
                }
            },

            [SETTING_GROUPS.CAPTCHA_SERVICES]: {
                defaultCaptchaService: {
                    id: 'defaultCaptchaService',
                    group: SETTING_GROUPS.CAPTCHA_SERVICES,
                    type: INPUT_TYPES.SELECT,
                    label: '默认验证码服务',
                    description: '脚本默认使用的验证码解决服务',
                    defaultValue: '2captcha',
                    options: [
                        { value: '2captcha', label: '2Captcha' },
                        { value: 'yescaptcha', label: 'YesCaptcha' }
                    ]
                },
                twoCaptchaApiKey: {
                    id: 'twoCaptchaApiKey',
                    group: SETTING_GROUPS.CAPTCHA_SERVICES,
                    type: INPUT_TYPES.TEXT,
                    label: '2Captcha API Key',
                    description: '2Captcha验证码服务的API密钥',
                    defaultValue: '',
                    placeholder: '请输入2Captcha API Key'
                },
                yescaptchaApiKey: {
                    id: 'yescaptchaApiKey',
                    group: SETTING_GROUPS.CAPTCHA_SERVICES,
                    type: INPUT_TYPES.TEXT,
                    label: 'YesCaptcha API Key',
                    description: 'YesCaptcha验证码服务的API密钥',
                    defaultValue: '',
                    placeholder: '请输入YesCaptcha API Key'
                },
                enableCaptchaFallback: {
                    id: 'enableCaptchaFallback',
                    group: SETTING_GROUPS.CAPTCHA_SERVICES,
                    type: INPUT_TYPES.CHECKBOX,
                    label: '启用验证码服务降级',
                    description: '当主验证码服务失败时，自动切换到备用服务',
                    defaultValue: true
                }
            },

            [SETTING_GROUPS.DATA_BACKUP]: {
                autoBackup: {
                    id: 'autoBackup',
                    group: SETTING_GROUPS.DATA_BACKUP,
                    type: INPUT_TYPES.SELECT,
                    label: '自动备份',
                    description: '设置自动备份频率',
                    defaultValue: 'daily',
                    options: [
                        { value: 'off', label: '关闭' },
                        { value: 'daily', label: '每日' },
                        { value: 'weekly', label: '每周' },
                        { value: 'monthly', label: '每月' }
                    ]
                }
            },


        };
    }

    /**
     * 获取所有设置定义
     */
    getAllDefinitions() {
        return this.definitions;
    }

    /**
     * 获取指定分组的设置定义
     */
    getGroupDefinitions(group) {
        return this.definitions[group] || {};
    }

    /**
     * 获取单个设置定义
     */
    getDefinition(settingId) {
        for (const group of Object.values(this.definitions)) {
            if (group[settingId]) {
                return group[settingId];
            }
        }
        return null;
    }

    /**
     * 获取所有默认值
     */
    getDefaultValues() {
        const defaults = {};
        for (const group of Object.values(this.definitions)) {
            for (const [key, definition] of Object.entries(group)) {
                defaults[key] = definition.defaultValue;
            }
        }
        return defaults;
    }

    /**
     * 获取分组信息
     */
    getGroupInfo() {
        return {
            [SETTING_GROUPS.GENERAL]: {
                id: SETTING_GROUPS.GENERAL,
                label: '通用设置',
                icon: 'fa fa-sliders',
                order: 1
            },
            [SETTING_GROUPS.SECURITY]: {
                id: SETTING_GROUPS.SECURITY,
                label: '安全与隐私',
                icon: 'fa fa-shield',
                order: 2
            },
            [SETTING_GROUPS.NETWORK]: {
                id: SETTING_GROUPS.NETWORK,
                label: '网络设置',
                icon: 'fa fa-network-wired',
                order: 3
            },
            [SETTING_GROUPS.CAPTCHA_SERVICES]: {
                id: SETTING_GROUPS.CAPTCHA_SERVICES,
                label: '验证码服务',
                icon: 'fa fa-shield-check',
                order: 4
            },
            [SETTING_GROUPS.DATA_BACKUP]: {
                id: SETTING_GROUPS.DATA_BACKUP,
                label: '数据与备份',
                icon: 'fa fa-database',
                order: 5
            },

            [SETTING_GROUPS.ABOUT]: {
                id: SETTING_GROUPS.ABOUT,
                label: '关于',
                icon: 'fa fa-info-circle',
                order: 6
            }
        };
    }
} 