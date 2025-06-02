/**
 * 样式管理器
 * 负责批量脚本页面的所有CSS样式管理，包括添加、移除和更新样式
 */

/**
 * 样式管理器类
 */
export class StyleManager {
    constructor() {
        this.injectedStyles = new Map(); // 存储已注入的样式元素
        this.styleCache = new Map(); // 样式内容缓存
        
        // 初始化样式定义
        this.initializeStyles();
    }

    /**
     * 初始化所有样式定义
     * @private
     */
    initializeStyles() {
        // 紧凑任务管理器样式
        this.styleCache.set('compact-task-styles', this.getCompactTaskStyles());
        
        // 可以在这里添加其他样式定义
        // this.styleCache.set('other-styles', this.getOtherStyles());
    }

    /**
     * 获取紧凑任务管理器样式
     * @returns {string} CSS样式字符串
     * @private
     */
    getCompactTaskStyles() {
        return `
        /* 基础样式重置 - 限定在脚本插件页面 */
        .plugin-page * {
            box-sizing: border-box;
        }
        
        /* 页面基础样式 - 限定在脚本插件页面 */
        .plugin-page .page-header {
            margin-bottom: 20px;
        }
        
        .plugin-page .header-actions {
            display: flex;
            gap: 12px;
            align-items: center;
        }
        
        /* 以下为 .batch-task-container 内部的样式，它们已经有较好的作用域，保持不变 */
        .batch-task-container .btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 8px 16px;
            border: 1px solid #dee2e6;
            border-radius: 6px;
            background: #fff;
            color: #495057;
            text-decoration: none;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        
        .batch-task-container .btn:hover {
            border-color: #6c5ce7;
            color: #6c5ce7;
        }
        
        .batch-task-container .btn.btn-secondary {
            border-color: #6c757d;
            color: #6c757d;
        }
        
        .batch-task-container .btn.btn-secondary:hover {
            background: #6c757d;
            color: #fff;
        }
        
        /* 主容器 */
        .batch-task-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            background: #f8f9fa;
        }
        
        /* 顶部栏 */
        .task-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            background: #fff;
            border-bottom: 1px solid #e9ecef;
        }
        
        .header-nav {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .back-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            color: #666;
            transition: all 0.2s;
        }
        
        .back-btn:hover {
            background: #f0f0f0;
            color: #333;
        }
        
        .header-nav h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 500;
            color: #1a1a1a;
        }
        
        .header-status {
            display: flex;
            align-items: center;
            gap: 16px;
            font-size: 14px;
        }
        
        .status-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .status-text {
            color: #666;
        }
        
        .timer {
            font-family: monospace;
            color: #666;
        }
        
        /* 头部控制按钮 */
        .header-controls {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .control-btn {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: #fff;
            color: #666;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
            text-decoration: none;
        }
        
        .control-btn:hover {
            border-color: #bbb;
            color: #333;
            background: #f8f9fa;
        }
        
        .control-btn.btn-secondary {
            border-color: #6c757d;
            color: #6c757d;
        }
        
        .control-btn.btn-secondary:hover {
            background: #6c757d;
            color: #fff;
        }
        
        .control-btn.btn-danger {
            border-color: #dc3545;
            color: #dc3545;
        }
        
        .control-btn.btn-danger:hover {
            background: #dc3545;
            color: #fff;
        }
        
        .control-btn i {
            font-size: 12px;
        }
        
        /* 主体区域 */
        .task-body {
            flex: 1;
            overflow: hidden;
        }
        
        /* 配置区域 */
        .config-section {
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        
        .config-content {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }
        
        .action-bar {
            padding: 16px 20px;
            background: #fff;
            border-top: 1px solid #e9ecef;
            text-align: center;
        }
        
        /* 日志区域 */
        .log-section {
            height: 100%;
            display: flex;
            flex-direction: column;
            background: #fff;
        }
        
        .log-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px 20px;
            border-bottom: 1px solid #e9ecef;
        }
        
        .log-info {
            font-size: 14px;
        }
        
        .log-title {
            font-weight: 500;
            color: #1a1a1a;
            margin-right: 16px;
        }
        
        .log-stats {
            color: #666;
        }
        
        .log-stats span {
            font-weight: 500;
            color: #1a1a1a;
        }
        
        .log-actions {
            display: flex;
            gap: 8px;
        }
        
        .tool-btn {
            width: 32px;
            height: 32px;
            border: none;
            background: transparent;
            border-radius: 6px;
            cursor: pointer;
            color: #666;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .tool-btn:hover {
            background: #f0f0f0;
            color: #333;
        }
        
        .tool-btn.active {
            background: #6c5ce7;
            color: #fff;
        }
        
        .log-container {
            flex: 1;
            padding: 16px;
            overflow-y: auto;
            font-family: 'SF Mono', Monaco, monospace;
            font-size: 13px;
            line-height: 1.6;
            background: #1e1e1e;
            color: #d4d4d4;
        }
        
        .log-entry {
            margin-bottom: 4px;
            display: flex;
            align-items: flex-start;
        }
        
        .log-time {
            color: #858585;
            margin-right: 12px;
            flex-shrink: 0;
        }
        
        .log-message {
            flex: 1;
            word-break: break-word;
        }
        
        .log-type-info .log-message { color: #d4d4d4; }
        .log-type-success .log-message { color: #4ec9b0; }
        .log-type-warning .log-message { color: #dcdcaa; }
        .log-type-error .log-message { color: #f48771; }
        
        .log-footer {
            padding: 16px 20px;
            background: #fff;
            border-top: 1px solid #e9ecef;
            text-align: center;
        }
        
        /* 模块内容样式 */
        .module-section {
            background: #fff;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 16px;
        }
        
        .module-section h2 {
            margin: 0 0 16px;
            font-size: 16px;
            font-weight: 500;
            color: #1a1a1a;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        /* 钱包选择 */
        .wallet-selection-section {
            border: 1px solid #e9ecef;
            border-radius: 6px;
            overflow: hidden;
        }
        
        /* 脚本信息卡片 */
        .script-info-section {
            margin-bottom: 20px;
        }
        
        .info-card {
            border: 1px solid #e9ecef;
            border-radius: 6px;
            overflow: hidden;
            background: #fff;
        }
        
        .info-header {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 12px 16px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            font-size: 14px;
            font-weight: 500;
            color: #495057;
        }
        
        .info-header i {
            color: #6c757d;
        }
        
        .info-content {
            padding: 16px;
        }
        
        .info-content p {
            margin: 0 0 8px 0;
            font-size: 14px;
            line-height: 1.5;
        }
        
        .info-content p:last-child {
            margin-bottom: 0;
        }
        
        .info-content strong {
            color: #495057;
        }
        
        .section-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
            font-size: 13px;
        }
        
        .wallet-actions {
            display: flex;
            gap: 6px;
        }
        
        .wallet-actions .btn {
            padding: 3px 8px;
            font-size: 12px;
        }
        
        .wallet-search-box {
            padding: 8px 12px;
            border-bottom: 1px solid #e9ecef;
            position: relative;
        }
        
        .wallet-search-box input {
            width: 100%;
            padding: 5px 8px;
            padding-right: 28px;
            font-size: 12px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
        }
        
        .wallet-search-box i {
            position: absolute;
            right: 20px;
            top: 50%;
            transform: translateY(-50%);
            color: #999;
            font-size: 12px;
        }
        
        .wallet-list {
            max-height: 250px;
            overflow-y: auto;
        }
        
        /* 钱包分组样式 */
        .wallet-group {
            border-bottom: 1px solid #f0f0f0;
        }
        
        .wallet-group:last-child {
            border-bottom: none;
        }
        
        .wallet-group-header {
            display: flex;
            align-items: center;
            padding: 6px 12px;
            background: #fafafa;
            cursor: pointer;
            font-size: 13px;
            user-select: none;
        }
        
        .wallet-group-header:hover {
            background: #f5f5f5;
        }
        
        .group-toggle {
            margin-right: 6px;
            color: #666;
            font-size: 10px;
            transition: transform 0.2s;
        }
        
        .group-toggle.collapsed {
            transform: rotate(-90deg);
        }
        
        .group-checkbox {
            margin-right: 8px;
        }
        
        .group-name {
            flex: 1;
            font-weight: 500;
            color: #333;
        }
        
        .group-count {
            font-size: 12px;
            color: #666;
        }
        
        .wallet-group-content {
            display: block;
        }
        
        .wallet-group-content.collapsed {
            display: none;
        }
        
        .wallet-item {
            display: flex;
            align-items: center;
            padding: 6px 12px 6px 32px;
            font-size: 12px;
            transition: background 0.2s;
        }
        
        .wallet-item:hover {
            background: #f8f9fa;
        }
        
        .wallet-item input[type="checkbox"] {
            margin-right: 8px;
        }
        
        .wallet-item label {
            flex: 1;
            cursor: pointer;
            display: flex;
            align-items: center;
            margin: 0;
        }
        
        .wallet-address {
            font-family: monospace;
            font-size: 11px;
            color: #666;
            margin-left: 8px;
        }
        
        /* 代理配置样式优化 */
        .proxy-section {
            margin-top: 20px;
        }
        
        .proxy-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
        }
        
        .proxy-header label {
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 14px;
            cursor: pointer;
        }
        
        .proxy-config-content {
            padding: 16px;
            background: #f8f9fa;
            border-radius: 6px;
        }
        
        .proxy-strategy {
            margin-bottom: 16px;
        }
        
        .proxy-strategy label {
            font-size: 13px;
            color: #666;
            margin-bottom: 6px;
            display: block;
        }
        
        .proxy-strategy select {
            padding: 6px 10px;
            font-size: 13px;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            background: #fff;
        }
        
        .proxy-list-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
        }
        
        .proxy-list-title {
            font-size: 13px;
            color: #666;
        }
        
        .refresh-proxy-btn {
            padding: 4px 10px;
            font-size: 12px;
            background: transparent;
            border: 1px solid #dee2e6;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .refresh-proxy-btn:hover {
            border-color: #6c5ce7;
            color: #6c5ce7;
        }
        
        /* 代理列表样式 */
        .proxy-list-container {
            border: 1px solid #e9ecef;
            border-radius: 6px;
            background: #fff;
            max-height: 200px;
            overflow-y: auto;
        }
        
        .proxy-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 16px;
            border-bottom: 1px solid #f0f0f0;
            font-size: 13px;
            transition: background 0.2s;
        }
        
        .proxy-item:last-child {
            border-bottom: none;
        }
        
        .proxy-item:hover {
            background: #f8f9fa;
        }
        
        .proxy-item input[type="checkbox"] {
            margin-right: 10px;
        }
        
        .proxy-item label {
            flex: 1;
            display: flex;
            align-items: center;
            cursor: pointer;
        }
        
        .proxy-info {
            flex: 1;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .proxy-address {
            color: #1a1a1a;
            font-family: monospace;
        }
        
        .proxy-location {
            color: #666;
            font-size: 12px;
        }
        
        .proxy-strategy-details {
            margin-top: 12px;
            padding: 12px;
            background: #e9ecef;
            border-radius: 4px;
            font-size: 13px;
            color: #666;
        }
        
        /* 按钮样式 */
        .batch-task-container .btn.btn-primary,
        .background-tasks-panel .btn.btn-primary {
            background: #6c5ce7;
            color: #fff;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .batch-task-container .btn.btn-primary:hover:not(:disabled),
        .background-tasks-panel .btn.btn-primary:hover:not(:disabled) {
            background: #5a4cdb;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(108, 92, 231, 0.3);
        }
        
        .batch-task-container .btn.btn-primary:disabled,
        .background-tasks-panel .btn.btn-primary:disabled {
            background: #e9ecef;
            color: #adb5bd;
            cursor: not-allowed;
            transform: none;
            box-shadow: none;
        }
        
        .batch-task-container .btn.btn-secondary,
        .background-tasks-panel .btn.btn-secondary {
            background: transparent;
            color: #666;
            border: 1px solid #dee2e6;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .batch-task-container .btn.btn-secondary:hover,
        .background-tasks-panel .btn.btn-secondary:hover {
            border-color: #6c5ce7;
            color: #6c5ce7;
        }
        
        .batch-task-container .btn.btn-danger,
        .background-tasks-panel .btn.btn-danger {
            background: #dc3545;
            color: #fff;
            border: none;
            padding: 8px 20px;
            border-radius: 6px;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
        }
        
        .batch-task-container .btn.btn-danger:hover,
        .background-tasks-panel .btn.btn-danger:hover {
            background: #c82333;
        }
        
        .btn-sm {
            padding: 4px 10px;
            font-size: 12px;
        }
        
        /* 后台任务相关样式 */
        .has-background-tasks {
            background: #27ae60 !important;
            color: #fff !important;
            border-color: #27ae60 !important;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }
        
        .background-tasks-panel {
            position: fixed;
            top: 80px;
            right: 20px;
            width: 400px;
            max-height: 500px;
            background: #fff;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.15);
            z-index: 1000;
            overflow: hidden;
        }
        
        .background-tasks-panel .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 20px;
            background: #f8f9fa;
            border-bottom: 1px solid #e9ecef;
        }
        
        .background-tasks-panel .panel-header h3 {
            margin: 0;
            font-size: 16px;
            font-weight: 500;
            color: #1a1a1a;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .background-tasks-panel .close-btn {
            width: 28px;
            height: 28px;
            border: none;
            background: transparent;
            border-radius: 4px;
            cursor: pointer;
            color: #666;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .background-tasks-panel .close-btn:hover {
            background: #e9ecef;
            color: #333;
        }
        
        .background-tasks-panel .panel-content {
            max-height: 400px;
            overflow-y: auto;
            padding: 12px;
        }
        
        .background-task-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 12px;
            margin-bottom: 8px;
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            transition: all 0.2s;
        }
        
        .background-task-item:hover {
            border-color: #6c5ce7;
            background: #fff;
        }
        
        .background-task-item:last-child {
            margin-bottom: 0;
        }
        
        .task-info {
            flex: 1;
        }
        
        .task-name {
            font-size: 14px;
            font-weight: 500;
            color: #1a1a1a;
            margin-bottom: 4px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        
        .task-details {
            font-size: 12px;
            color: #666;
            display: flex;
            gap: 12px;
        }
        
        .task-status.running {
            color: #27ae60;
            font-weight: 500;
        }
        
        .task-duration {
            color: #666;
        }
        
        .task-actions {
            display: flex;
            gap: 6px;
        }
        
        .action-btn {
            width: 32px;
            height: 32px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }
        
        .action-btn.resume-btn {
            background: #6c5ce7;
            color: #fff;
        }
        
        .action-btn.resume-btn:hover {
            background: #5a4cdb;
        }
        
        .action-btn.stop-btn {
            background: #dc3545;
            color: #fff;
        }
        
        .action-btn.stop-btn:hover {
            background: #c82333;
        }
        
        .empty-state {
            text-align: center;
            padding: 40px 20px;
            color: #666;
        }
        
        .empty-state i {
            font-size: 48px;
            margin-bottom: 16px;
            opacity: 0.3;
        }
        
        .empty-state p {
            margin: 0;
            font-size: 14px;
        }
        
        .text-success {
            color: #27ae60 !important;
        }`;
    }

    /**
     * 注入样式到页面
     * @param {string} styleId - 样式ID
     * @param {string} [customStyles] - 自定义样式内容，如果不提供则使用缓存中的样式
     * @returns {boolean} 是否成功注入
     */
    injectStyles(styleId, customStyles = null) {
        // 检查是否已经注入
        if (this.injectedStyles.has(styleId)) {
            console.log(`[样式管理] 样式 ${styleId} 已存在，跳过注入`);
            return true;
        }

        // 获取样式内容
        const styleContent = customStyles || this.styleCache.get(styleId);
        if (!styleContent) {
            console.error(`[样式管理] 样式 ${styleId} 未找到`);
            return false;
        }

        // 创建并注入样式元素
        const styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.textContent = styleContent;
        document.head.appendChild(styleElement);

        // 记录已注入的样式
        this.injectedStyles.set(styleId, styleElement);
        
        console.log(`[样式管理] 已注入样式: ${styleId}`);
        return true;
    }

    /**
     * 移除样式
     * @param {string} styleId - 样式ID
     * @returns {boolean} 是否成功移除
     */
    removeStyles(styleId) {
        const styleElement = this.injectedStyles.get(styleId);
        if (!styleElement) {
            console.warn(`[样式管理] 样式 ${styleId} 未找到或未注入`);
            return false;
        }

        // 从DOM中移除
        if (styleElement.parentNode) {
            styleElement.parentNode.removeChild(styleElement);
        }

        // 从记录中移除
        this.injectedStyles.delete(styleId);
        
        console.log(`[样式管理] 已移除样式: ${styleId}`);
        return true;
    }

    /**
     * 更新样式
     * @param {string} styleId - 样式ID
     * @param {string} newStyles - 新的样式内容
     * @returns {boolean} 是否成功更新
     */
    updateStyles(styleId, newStyles) {
        const styleElement = this.injectedStyles.get(styleId);
        if (!styleElement) {
            console.warn(`[样式管理] 样式 ${styleId} 未找到，将创建新样式`);
            return this.injectStyles(styleId, newStyles);
        }

        // 更新样式内容
        styleElement.textContent = newStyles;
        
        // 更新缓存
        this.styleCache.set(styleId, newStyles);
        
        console.log(`[样式管理] 已更新样式: ${styleId}`);
        return true;
    }

    /**
     * 检查样式是否已注入
     * @param {string} styleId - 样式ID
     * @returns {boolean} 是否已注入
     */
    isStyleInjected(styleId) {
        return this.injectedStyles.has(styleId);
    }

    /**
     * 添加紧凑任务样式（向后兼容函数）
     * @returns {boolean} 是否成功添加
     */
    addCompactTaskStyles() {
        return this.injectStyles('compact-task-styles');
    }

    /**
     * 移除紧凑任务样式（向后兼容函数）
     * @returns {boolean} 是否成功移除
     */
    removeCompactTaskStyles() {
        return this.removeStyles('compact-task-styles');
    }

    /**
     * 获取已注入的样式列表
     * @returns {string[]} 已注入的样式ID列表
     */
    getInjectedStyles() {
        return Array.from(this.injectedStyles.keys());
    }

    /**
     * 获取样式统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            injectedCount: this.injectedStyles.size,
            cachedCount: this.styleCache.size,
            injectedStyles: this.getInjectedStyles(),
            cachedStyles: Array.from(this.styleCache.keys())
        };
    }

    /**
     * 清理所有注入的样式
     */
    cleanup() {
        const styleIds = Array.from(this.injectedStyles.keys());
        
        for (const styleId of styleIds) {
            this.removeStyles(styleId);
        }
        
        console.log(`[样式管理] 已清理 ${styleIds.length} 个样式`);
    }
}

/**
 * 创建样式管理器实例并暴露全局函数
 * @returns {StyleManager} 样式管理器实例
 */
export function setupGlobalStyleManager() {
    const styleManager = new StyleManager();
    
    // 暴露核心功能到全局
    window.FAStyleManager = styleManager;
    
    // 暴露向后兼容的全局函数
    window.addCompactTaskStyles = () => {
        return styleManager.addCompactTaskStyles();
    };
    
    window.removeCompactTaskStyles = () => {
        return styleManager.removeCompactTaskStyles();
    };
    
    window.injectStyles = (styleId, customStyles) => {
        return styleManager.injectStyles(styleId, customStyles);
    };
    
    window.removeStyles = (styleId) => {
        return styleManager.removeStyles(styleId);
    };
    
    window.updateStyles = (styleId, newStyles) => {
        return styleManager.updateStyles(styleId, newStyles);
    };
    
    // 调试功能
    window.__debugStyles = () => {
        console.log('=== 样式管理器调试信息 ===');
        console.log('统计信息:', styleManager.getStats());
        console.log('样式管理器实例:', styleManager);
    };
    
    console.log('[样式管理] StyleManager 全局函数已设置');
    return styleManager;
} 