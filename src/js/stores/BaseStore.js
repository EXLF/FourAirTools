/**
 * @fileoverview 基础Store类 - 简单的状态管理
 * @module stores/BaseStore
 */

/**
 * 基础Store类
 * 提供简单的状态管理功能，无需Redux等重型框架
 */
export class BaseStore extends EventTarget {
    /**
     * 创建Store实例
     * @param {Object} initialState - 初始状态
     */
    constructor(initialState = {}) {
        super();
        this._state = { ...initialState };
        this._subscribers = new Map();
        this._history = [];
        this._historyIndex = -1;
        this._maxHistory = 50;
    }

    /**
     * 获取当前状态
     * @returns {Object} 当前状态的副本
     */
    getState() {
        return { ...this._state };
    }

    /**
     * 设置状态
     * @param {Object|Function} updates - 更新对象或更新函数
     */
    setState(updates) {
        const prevState = { ...this._state };
        
        // 支持函数式更新
        const newState = typeof updates === 'function' 
            ? updates(prevState)
            : { ...prevState, ...updates };
        
        // 检查是否有实际变化
        if (this._hasChanged(prevState, newState)) {
            this._state = newState;
            
            // 保存到历史记录
            this._addToHistory(prevState);
            
            // 触发变化事件
            this._notifySubscribers(prevState, newState);
            
            // 分发自定义事件
            this.dispatchEvent(new CustomEvent('statechange', {
                detail: {
                    prevState,
                    newState,
                    changes: this._getChanges(prevState, newState)
                }
            }));
        }
    }

    /**
     * 订阅状态变化
     * @param {Function} callback - 回调函数
     * @param {Array<string>} [paths] - 关注的状态路径
     * @returns {Function} 取消订阅函数
     */
    subscribe(callback, paths = null) {
        const id = Symbol('subscriber');
        this._subscribers.set(id, { callback, paths });
        
        // 立即调用一次
        callback(this.getState(), {});
        
        // 返回取消订阅函数
        return () => {
            this._subscribers.delete(id);
        };
    }

    /**
     * 获取特定路径的值
     * @param {string} path - 点分隔的路径（如 'user.profile.name'）
     * @param {any} defaultValue - 默认值
     * @returns {any} 路径对应的值
     */
    get(path, defaultValue = undefined) {
        const keys = path.split('.');
        let value = this._state;
        
        for (const key of keys) {
            if (value == null || typeof value !== 'object') {
                return defaultValue;
            }
            value = value[key];
        }
        
        return value === undefined ? defaultValue : value;
    }

    /**
     * 设置特定路径的值
     * @param {string} path - 点分隔的路径
     * @param {any} value - 要设置的值
     */
    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        
        const newState = { ...this._state };
        let current = newState;
        
        // 创建路径
        for (const key of keys) {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            } else {
                current[key] = { ...current[key] };
            }
            current = current[key];
        }
        
        // 设置值
        current[lastKey] = value;
        
        this.setState(newState);
    }

    /**
     * 批量更新
     * @param {Function} updater - 批量更新函数
     */
    batch(updater) {
        const updates = [];
        const batchSet = (path, value) => {
            updates.push({ path, value });
        };
        
        // 执行批量更新
        updater(batchSet, this.getState());
        
        // 应用所有更新
        const newState = { ...this._state };
        for (const { path, value } of updates) {
            this._setPath(newState, path, value);
        }
        
        this.setState(newState);
    }

    /**
     * 撤销到上一个状态
     * @returns {boolean} 是否成功撤销
     */
    undo() {
        if (this._historyIndex >= 0 && this._history.length > 0) {
            const prevState = this._history[this._historyIndex];
            this._historyIndex--;
            this._state = { ...prevState };
            this._notifySubscribers(this._state, prevState);
            return true;
        }
        return false;
    }

    /**
     * 重做到下一个状态
     * @returns {boolean} 是否成功重做
     */
    redo() {
        if (this._historyIndex < this._history.length - 2) {
            this._historyIndex++;
            const nextState = this._history[this._historyIndex + 1];
            const prevState = { ...this._state };
            this._state = { ...nextState };
            this._notifySubscribers(prevState, this._state);
            return true;
        }
        return false;
    }

    /**
     * 重置到初始状态
     */
    reset() {
        if (this._history.length > 0) {
            const initialState = this._history[0];
            this.setState(initialState);
            this._history = [initialState];
            this._historyIndex = 0;
        }
    }

    /**
     * 清除Store
     */
    clear() {
        this._state = {};
        this._history = [];
        this._historyIndex = -1;
        this._subscribers.clear();
        this._notifySubscribers({}, {});
    }

    /**
     * 检查状态是否改变
     * @private
     */
    _hasChanged(prevState, newState) {
        return JSON.stringify(prevState) !== JSON.stringify(newState);
    }

    /**
     * 获取变化的字段
     * @private
     */
    _getChanges(prevState, newState) {
        const changes = {};
        const allKeys = new Set([
            ...Object.keys(prevState),
            ...Object.keys(newState)
        ]);
        
        for (const key of allKeys) {
            if (prevState[key] !== newState[key]) {
                changes[key] = {
                    prev: prevState[key],
                    new: newState[key]
                };
            }
        }
        
        return changes;
    }

    /**
     * 添加到历史记录
     * @private
     */
    _addToHistory(state) {
        // 如果在历史中间进行了新操作，删除后面的历史
        if (this._historyIndex < this._history.length - 1) {
            this._history = this._history.slice(0, this._historyIndex + 1);
        }
        
        // 添加新状态
        this._history.push(state);
        this._historyIndex++;
        
        // 限制历史记录长度
        if (this._history.length > this._maxHistory) {
            this._history.shift();
            this._historyIndex--;
        }
    }

    /**
     * 通知订阅者
     * @private
     */
    _notifySubscribers(prevState, newState) {
        const changes = this._getChanges(prevState, newState);
        
        for (const { callback, paths } of this._subscribers.values()) {
            // 如果指定了路径，检查是否有相关变化
            if (paths && paths.length > 0) {
                const hasRelevantChange = paths.some(path => {
                    const prevValue = this._getPath(prevState, path);
                    const newValue = this._getPath(newState, path);
                    return prevValue !== newValue;
                });
                
                if (!hasRelevantChange) {
                    continue;
                }
            }
            
            // 调用回调
            try {
                callback(newState, changes);
            } catch (error) {
                console.error('Store subscriber error:', error);
            }
        }
    }

    /**
     * 获取路径值（内部使用）
     * @private
     */
    _getPath(obj, path) {
        const keys = path.split('.');
        let value = obj;
        
        for (const key of keys) {
            if (value == null) return undefined;
            value = value[key];
        }
        
        return value;
    }

    /**
     * 设置路径值（内部使用）
     * @private
     */
    _setPath(obj, path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = obj;
        
        for (const key of keys) {
            if (!current[key]) {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
    }
} 