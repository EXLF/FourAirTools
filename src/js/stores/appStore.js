/**
 * @fileoverview 应用Store - 管理全局应用状态
 * @module stores/appStore
 */

import { BaseStore } from './BaseStore.js';

/**
 * 应用Store类
 * 管理全局应用状态，如认证状态、设置、通知等
 */
class AppStore extends BaseStore {
    constructor() {
        super({
            // 认证状态
            auth: {
                isUnlocked: false,
                isFirstTime: false,
                lockTime: null
            },
            
            // 应用设置
            settings: {
                language: 'zh-CN',
                theme: 'auto',
                notifications: true,
                autoLockTimeout: 60,
                rpcUrl: '',
                defaultProxyGroup: 'none'
            },
            
            // UI状态
            ui: {
                currentPage: 'dashboard',
                sidebarCollapsed: false,
                activeModal: null,
                loading: false,
                loadingMessage: ''
            },
            
            // 通知
            notifications: [],
            
            // 版本信息
            version: {
                current: '1.1.0',
                latest: null,
                hasUpdate: false,
                updateInfo: null
            },
            
            // 系统信息
            system: {
                platform: null,
                isOnline: true,
                lastSync: null
            }
        });
        
        // 初始化
        this._init();
    }

    /**
     * 初始化Store
     * @private
     */
    _init() {
        // 监听网络状态
        window.addEventListener('online', () => {
            this.set('system.isOnline', true);
        });
        
        window.addEventListener('offline', () => {
            this.set('system.isOnline', false);
        });
        
        // 自动保存设置
        this.subscribe((state) => {
            // 当设置改变时，自动保存到后端
            if (window.electronAPI && window.electronAPI.settings) {
                window.electronAPI.settings.saveSettings(state.settings);
            }
        }, ['settings']);
    }

    /**
     * 设置认证状态
     * @param {boolean} isUnlocked - 是否已解锁
     */
    setAuthStatus(isUnlocked) {
        this.setState({
            auth: {
                ...this.get('auth'),
                isUnlocked,
                lockTime: isUnlocked ? null : Date.now()
            }
        });
    }

    /**
     * 更新设置
     * @param {Object} settings - 设置对象
     */
    updateSettings(settings) {
        this.setState({
            settings: {
                ...this.get('settings'),
                ...settings
            }
        });
    }

    /**
     * 导航到页面
     * @param {string} page - 页面名称
     */
    navigateTo(page) {
        this.set('ui.currentPage', page);
    }

    /**
     * 显示加载状态
     * @param {boolean} show - 是否显示
     * @param {string} [message] - 加载消息
     */
    setLoading(show, message = '') {
        this.setState({
            ui: {
                ...this.get('ui'),
                loading: show,
                loadingMessage: message
            }
        });
    }

    /**
     * 添加通知
     * @param {Object} notification - 通知对象
     * @param {string} notification.type - 类型(success/error/warning/info)
     * @param {string} notification.message - 消息内容
     * @param {number} [notification.duration] - 持续时间(ms)
     * @returns {string} 通知ID
     */
    addNotification(notification) {
        const id = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newNotification = {
            id,
            timestamp: Date.now(),
            ...notification
        };
        
        this.setState({
            notifications: [...this.get('notifications'), newNotification]
        });
        
        // 自动移除通知
        if (notification.duration !== 0) {
            setTimeout(() => {
                this.removeNotification(id);
            }, notification.duration || 5000);
        }
        
        return id;
    }

    /**
     * 移除通知
     * @param {string} id - 通知ID
     */
    removeNotification(id) {
        this.setState({
            notifications: this.get('notifications').filter(n => n.id !== id)
        });
    }

    /**
     * 清除所有通知
     */
    clearNotifications() {
        this.set('notifications', []);
    }

    /**
     * 设置版本信息
     * @param {Object} versionInfo - 版本信息
     */
    setVersionInfo(versionInfo) {
        this.setState({
            version: {
                ...this.get('version'),
                ...versionInfo
            }
        });
    }

    /**
     * 显示模态框
     * @param {string} modalId - 模态框ID
     * @param {Object} [data] - 模态框数据
     */
    showModal(modalId, data = {}) {
        this.set('ui.activeModal', { id: modalId, data });
    }

    /**
     * 隐藏模态框
     */
    hideModal() {
        this.set('ui.activeModal', null);
    }

    /**
     * 切换侧边栏折叠状态
     */
    toggleSidebar() {
        this.set('ui.sidebarCollapsed', !this.get('ui.sidebarCollapsed'));
    }

    /**
     * 记录最后同步时间
     */
    recordLastSync() {
        this.set('system.lastSync', Date.now());
    }

    /**
     * 获取是否需要同步
     * @param {number} [threshold=3600000] - 同步阈值(默认1小时)
     * @returns {boolean} 是否需要同步
     */
    needsSync(threshold = 3600000) {
        const lastSync = this.get('system.lastSync');
        if (!lastSync) return true;
        return Date.now() - lastSync > threshold;
    }
}

// 创建单例实例
const appStore = new AppStore();

// 导出store实例和便捷方法
export { appStore };

// 导出便捷方法
export const getAppState = () => appStore.getState();
export const setAppState = (updates) => appStore.setState(updates);
export const subscribeToApp = (callback, paths) => appStore.subscribe(callback, paths); 