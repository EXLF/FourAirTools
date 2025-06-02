/**
 * UI事件管理器
 * 负责UI事件绑定和交互管理，包括返回按钮、开始按钮状态管理、钱包选择监听等
 */

/**
 * UI事件管理器类
 */
export class UIEventManager {
    constructor(pageState) {
        this.pageState = pageState;
        this.walletChangeListeners = [];
        this.boundEventListeners = new Map(); // 存储绑定的事件监听器，便于清理
    }

    /**
     * 绑定所有UI事件
     * @param {string} taskInstanceId - 任务实例ID
     * @param {HTMLElement} managerPage - 管理页面元素
     * @param {Object} dependencies - 依赖的外部函数
     * @param {Function} dependencies.saveCurrentModuleData - 保存当前模块数据
     * @param {Function} dependencies.moveTaskToBackground - 移至后台
     * @param {Function} dependencies.cleanupResources - 清理资源
     * @param {Function} dependencies.renderBatchScriptCardsView - 渲染卡片视图
     * @param {Function} dependencies.handleStartExecution - 处理开始执行
     * @param {Function} dependencies.switchToConfigStage - 切换到配置阶段
     */
    bindAllUIEvents(taskInstanceId, managerPage, dependencies) {
        if (!managerPage) {
            console.error('[UI事件] 管理页面容器未找到');
            return;
        }

        // 绑定返回按钮
        this.bindBackToCardsButton(taskInstanceId, managerPage, dependencies);
        
        // 绑定开始执行按钮
        this.bindStartExecutionButton(taskInstanceId, managerPage, dependencies);
        
        // 绑定返回配置按钮
        this.bindBackToConfigButton(taskInstanceId, managerPage, dependencies);
        
        console.log('[UI事件] 所有UI事件已绑定');
    }

    /**
     * 绑定返回按钮事件
     * @param {string} taskInstanceId - 任务实例ID
     * @param {HTMLElement} managerPage - 管理页面元素
     * @param {Object} dependencies - 依赖函数
     * @private
     */
    bindBackToCardsButton(taskInstanceId, managerPage, dependencies) {
        const backToCardsButton = managerPage.querySelector('#back-to-cards-btn');
        if (!backToCardsButton) {
            console.warn('[UI事件] 返回按钮未找到');
            return;
        }

        const backButtonHandler = (event) => {
            event.preventDefault();
            this.handleBackToCards(taskInstanceId, dependencies);
        };

        backToCardsButton.addEventListener('click', backButtonHandler);
        
        // 存储监听器引用，便于清理
        this.boundEventListeners.set('backToCards', {
            element: backToCardsButton,
            event: 'click',
            handler: backButtonHandler
        });

        console.log('[UI事件] 返回按钮事件已绑定');
    }

    /**
     * 处理返回卡片页面
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} dependencies - 依赖函数
     * @private
     */
    handleBackToCards(taskInstanceId, dependencies) {
        // 保存当前模块数据
        dependencies.saveCurrentModuleData(taskInstanceId);
        
        // 检查是否有正在运行的任务
        const currentExecutionId = window.__currentExecutionId;
        const hasExecutionTimer = !!window.__executionTimer;
        const hasStartTime = !!window.__startTime;
        
        // 智能检测任务运行状态：
        // 1. 有执行ID且有计时器 - 明确运行中
        // 2. 有执行ID且有开始时间但没计时器 - 可能刚开始执行，计时器还没启动
        // 3. 只有执行ID但没有开始时间 - 可能是已完成的任务，不应移至后台
        const isTaskRunning = currentExecutionId && (hasExecutionTimer || hasStartTime);
        
        console.log('[UI事件] 返回按钮点击，任务状态检查:', {
            currentExecutionId,
            hasExecutionTimer,
            hasStartTime,
            isTaskRunning,
            taskInstanceId
        });
        
        if (isTaskRunning) {
            // 如果有正在运行的任务，保存到后台而不是清理
            dependencies.moveTaskToBackground(taskInstanceId);
            console.log('[UI事件] 任务已移至后台运行');
            
            // 添加小延迟，确保后台任务保存完成
            setTimeout(() => {
                dependencies.renderBatchScriptCardsView(this.pageState.contentAreaRef);
            }, 100);
        } else {
            // 没有运行中的任务，正常清理
            dependencies.cleanupResources();
            dependencies.renderBatchScriptCardsView(this.pageState.contentAreaRef);
        }
    }

    /**
     * 绑定开始执行按钮事件
     * @param {string} taskInstanceId - 任务实例ID
     * @param {HTMLElement} managerPage - 管理页面元素
     * @param {Object} dependencies - 依赖函数
     * @private
     */
    bindStartExecutionButton(taskInstanceId, managerPage, dependencies) {
        const startTaskButton = managerPage.querySelector('#start-execution-btn');
        if (!startTaskButton) {
            console.warn('[UI事件] 开始执行按钮未找到');
            return;
        }

        // 创建按钮状态更新函数
        const updateStartButtonState = () => {
            this.updateStartButtonState(startTaskButton);
        };
        
        // 初始检查
        setTimeout(() => {
            updateStartButtonState();
            console.log('[UI事件] 开始按钮状态初始检查完成');
        }, 200);
        
        // 监听钱包选择变化
        const walletChangeHandler = (e) => {
            if (e.target.name === 'selected-wallets') {
                updateStartButtonState();
            }
        };
        
        document.addEventListener('change', walletChangeHandler);
        this.walletChangeListeners.push(walletChangeHandler);
        
        // 绑定开始执行事件
        const startButtonHandler = async (event) => {
            event.preventDefault();
            await dependencies.handleStartExecution(taskInstanceId, startTaskButton);
        };
        
        startTaskButton.addEventListener('click', startButtonHandler);
        
        // 存储监听器引用
        this.boundEventListeners.set('startExecution', {
            element: startTaskButton,
            event: 'click',
            handler: startButtonHandler
        });
        
        this.boundEventListeners.set('walletChange', {
            element: document,
            event: 'change',
            handler: walletChangeHandler
        });

        console.log('[UI事件] 开始执行按钮事件已绑定');
    }

    /**
     * 更新开始按钮状态
     * @param {HTMLElement} startTaskButton - 开始按钮元素
     * @private
     */
    updateStartButtonState(startTaskButton) {
        const selectedWallets = document.querySelectorAll('input[name="selected-wallets"]:checked');
        const walletCount = selectedWallets.length;
        
        // 检查当前脚本是否需要钱包
        const scriptRequires = this.pageState.currentBatchScriptType?.requires;
        const requiresWallets = scriptRequires ? (scriptRequires.wallets !== false) : true; // 默认需要钱包
        
        console.log('[UI事件] 按钮状态检查:', {
            requiresWallets,
            walletCount,
            scriptName: this.pageState.currentBatchScriptType?.name,
            scriptRequires: this.pageState.currentBatchScriptType?.requires
        });
        
        if (requiresWallets) {
            // 需要钱包的脚本，必须选择至少一个钱包
            if (walletCount > 0) {
                startTaskButton.disabled = false;
                console.log('[UI事件] 已选择钱包，启用执行按钮');
            } else {
                startTaskButton.disabled = true;
                console.log('[UI事件] 未选择钱包，禁用执行按钮');
            }
        } else {
            // 不需要钱包的脚本，直接启用按钮
            startTaskButton.disabled = false;
            console.log('[UI事件] 脚本不需要钱包，启用执行按钮');
        }
    }

    /**
     * 绑定返回配置按钮事件
     * @param {string} taskInstanceId - 任务实例ID
     * @param {HTMLElement} managerPage - 管理页面元素
     * @param {Object} dependencies - 依赖函数
     * @private
     */
    bindBackToConfigButton(taskInstanceId, managerPage, dependencies) {
        const backToConfigBtn = managerPage.querySelector('#back-to-config-btn');
        if (!backToConfigBtn) {
            console.warn('[UI事件] 返回配置按钮未找到');
            return;
        }

        const backToConfigHandler = (event) => {
            event.preventDefault();
            this.handleBackToConfig(taskInstanceId, dependencies);
        };

        backToConfigBtn.addEventListener('click', backToConfigHandler);
        
        // 存储监听器引用
        this.boundEventListeners.set('backToConfig', {
            element: backToConfigBtn,
            event: 'click',
            handler: backToConfigHandler
        });

        console.log('[UI事件] 返回配置按钮事件已绑定');
    }

    /**
     * 处理返回配置
     * @param {string} taskInstanceId - 任务实例ID
     * @param {Object} dependencies - 依赖函数
     * @private
     */
    handleBackToConfig(taskInstanceId, dependencies) {
        // 检查是否有正在运行的任务
        const currentExecutionId = window.__currentExecutionId;
        const isTaskRunning = currentExecutionId && window.__executionTimer;
        
        if (isTaskRunning) {
            // 如果有正在运行的任务，保存到后台而不是停止
            dependencies.moveTaskToBackground(taskInstanceId);
            console.log('[UI事件] 任务已移至后台运行（从执行页面返回配置）');
        }
        
        dependencies.switchToConfigStage();
    }

    /**
     * 手动触发按钮状态更新
     * @param {HTMLElement} managerPage - 管理页面元素
     */
    triggerButtonStateUpdate(managerPage) {
        const startTaskButton = managerPage?.querySelector('#start-execution-btn');
        if (startTaskButton) {
            this.updateStartButtonState(startTaskButton);
        }
    }

    /**
     * 获取当前按钮状态
     * @param {HTMLElement} managerPage - 管理页面元素
     * @returns {Object} 按钮状态信息
     */
    getButtonStates(managerPage) {
        const startButton = managerPage?.querySelector('#start-execution-btn');
        const backToCardsButton = managerPage?.querySelector('#back-to-cards-btn');
        const backToConfigButton = managerPage?.querySelector('#back-to-config-btn');
        
        return {
            startButton: {
                element: startButton,
                disabled: startButton?.disabled || false,
                visible: startButton?.style.display !== 'none'
            },
            backToCardsButton: {
                element: backToCardsButton,
                visible: backToCardsButton?.style.display !== 'none'
            },
            backToConfigButton: {
                element: backToConfigButton,
                visible: backToConfigButton?.style.display !== 'none'
            }
        };
    }

    /**
     * 清理所有事件监听器
     */
    cleanup() {
        // 清理绑定的事件监听器
        for (const [key, listenerInfo] of this.boundEventListeners) {
            try {
                listenerInfo.element.removeEventListener(listenerInfo.event, listenerInfo.handler);
                console.log(`[UI事件] 已清理事件监听器: ${key}`);
            } catch (error) {
                console.warn(`[UI事件] 清理事件监听器失败: ${key}`, error);
            }
        }
        this.boundEventListeners.clear();
        
        // 清理钱包变化监听器
        this.walletChangeListeners.forEach(handler => {
            try {
                document.removeEventListener('change', handler);
            } catch (error) {
                console.warn('[UI事件] 清理钱包变化监听器失败', error);
            }
        });
        this.walletChangeListeners = [];
        
        console.log('[UI事件] UIEventManager 已清理');
    }

    /**
     * 获取统计信息
     * @returns {Object} 统计信息
     */
    getStats() {
        return {
            boundEventListeners: this.boundEventListeners.size,
            walletChangeListeners: this.walletChangeListeners.length,
            events: Array.from(this.boundEventListeners.keys())
        };
    }
}

/**
 * 创建UI事件管理器实例并暴露全局函数
 * @param {Object} pageState - 页面状态对象
 * @returns {UIEventManager} UI事件管理器实例
 */
export function setupGlobalUIEventManager(pageState) {
    const uiEventManager = new UIEventManager(pageState);
    
    // 暴露核心功能到全局
    window.FAUIEventManager = uiEventManager;
    
    // 暴露向后兼容的全局函数
    window.bindAllUIEvents = (taskInstanceId, managerPage, dependencies) => {
        return uiEventManager.bindAllUIEvents(taskInstanceId, managerPage, dependencies);
    };
    
    window.updateStartButtonState = (startTaskButton) => {
        return uiEventManager.updateStartButtonState(startTaskButton);
    };
    
    window.triggerButtonStateUpdate = (managerPage) => {
        return uiEventManager.triggerButtonStateUpdate(managerPage);
    };
    
    window.getButtonStates = (managerPage) => {
        return uiEventManager.getButtonStates(managerPage);
    };
    
    // 调试功能
    window.__debugUIEvents = () => {
        console.log('=== UI事件管理器调试信息 ===');
        console.log('统计信息:', uiEventManager.getStats());
        console.log('页面状态:', pageState);
    };
    
    console.log('[UI事件] UIEventManager 全局函数已设置');
    return uiEventManager;
} 