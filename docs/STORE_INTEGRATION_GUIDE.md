# 状态管理集成指南

## 概述

本指南介绍如何将现有页面迁移到新的状态管理架构，使用我们自定义的轻量级Store系统。

## 架构概览

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│   UI Components │ ←→  │    Stores    │ ←→  │  IPC/Services│
└─────────────────┘     └──────────────┘     └──────────────┘
        ↑                       ↑                      ↑
        └───────────────────────┴──────────────────────┘
                         订阅/事件系统
```

## Store系统特性

1. **轻量级**：无需Redux等重型框架
2. **响应式**：自动通知订阅者状态变化
3. **路径订阅**：只监听需要的状态路径
4. **历史记录**：支持撤销/重做
5. **批量更新**：优化性能

## 迁移步骤

### 1. 创建Store

```javascript
// stores/yourStore.js
import { BaseStore } from './BaseStore.js';

class YourStore extends BaseStore {
    constructor() {
        super({
            // 初始状态
            items: [],
            filters: {},
            ui: {
                loading: false
            }
        });
    }

    // 业务方法
    setItems(items) {
        this.set('items', items);
    }
}

export const yourStore = new YourStore();
```

### 2. 创建Manager类

Manager类负责连接Store和UI：

```javascript
// pages/your-page/manager.js
import { yourStore } from '../../stores/yourStore.js';

class YourManager {
    constructor() {
        this.unsubscribe = null;
        this.elements = null;
    }

    async initialize(elements) {
        this.elements = elements;
        
        // 订阅store变化
        this.unsubscribe = yourStore.subscribe(
            (state, changes) => this.handleStoreChange(state, changes),
            ['items', 'ui.loading'] // 只监听需要的路径
        );
        
        // 加载初始数据
        await this.loadData();
    }

    handleStoreChange(state, changes) {
        if (changes.items) {
            this.renderItems();
        }
        if (changes.ui?.loading !== undefined) {
            this.updateLoadingUI(state.ui.loading);
        }
    }

    destroy() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }
}
```

### 3. 更新页面初始化

```javascript
// pages/your-page/index.js
import { yourManager } from './manager.js';

export async function initYourPage(contentArea) {
    const elements = {
        // 缓存DOM元素
        container: contentArea.querySelector('.container'),
        // ...
    };

    // 初始化manager
    await yourManager.initialize(elements);
}
```

## 示例：钱包页面迁移

### 迁移前（传统方式）

```javascript
// 直接操作DOM，状态分散
async function loadWallets() {
    const wallets = await api.getWallets();
    renderWalletTable(wallets);
}

function handleFilter(filter) {
    currentFilter = filter; // 全局变量
    loadWallets();
}
```

### 迁移后（使用Store）

```javascript
// 状态集中管理
walletStore.subscribe((state) => {
    renderWalletTable(state.wallets);
}, ['wallets']);

// 更新筛选
walletStore.setFilters({ groupId: 1 });
// Store自动触发重新渲染
```

## 最佳实践

### 1. 状态设计

```javascript
// ✅ 好的状态结构
{
    data: {
        items: [],
        groups: []
    },
    ui: {
        loading: false,
        selectedIds: []
    },
    filters: {
        search: '',
        groupId: null
    }
}

// ❌ 避免深层嵌套
{
    data: {
        items: {
            byId: {
                1: { info: { details: {} } }
            }
        }
    }
}
```

### 2. 订阅优化

```javascript
// ✅ 精确订阅
store.subscribe(callback, ['ui.loading', 'filters']);

// ❌ 订阅整个状态
store.subscribe(callback); // 任何变化都会触发
```

### 3. 批量更新

```javascript
// ✅ 批量更新
store.batch((set) => {
    set('ui.loading', true);
    set('filters.search', 'test');
    set('pagination.page', 1);
});

// ❌ 多次单独更新
store.set('ui.loading', true);
store.set('filters.search', 'test');
store.set('pagination.page', 1);
```

### 4. 异步操作

```javascript
// Manager中处理异步
async loadData() {
    try {
        store.set('ui.loading', true);
        const data = await api.getData();
        store.set('data', data);
    } catch (error) {
        store.set('ui.error', error.message);
    } finally {
        store.set('ui.loading', false);
    }
}
```

## 迁移检查清单

- [ ] 创建对应的Store类
- [ ] 定义初始状态结构
- [ ] 创建Manager类处理业务逻辑
- [ ] 将DOM操作移到Manager
- [ ] 设置状态订阅
- [ ] 处理异步操作
- [ ] 清理全局变量
- [ ] 添加错误处理
- [ ] 实现销毁方法
- [ ] 更新文档

## 常见问题

### Q: 什么时候需要创建新的Store？

A: 当数据需要在多个组件/页面间共享时，或者状态逻辑较复杂时。

### Q: Store和Manager的区别？

A: 
- Store：纯状态管理，不涉及UI
- Manager：连接Store和UI，处理业务逻辑

### Q: 如何处理跨Store通信？

A: 通过事件系统或在Manager层协调：

```javascript
// 在Manager中监听多个Store
walletStore.subscribe(this.handleWalletChange);
appStore.subscribe(this.handleAppChange);
```

### Q: 性能优化建议？

A: 
1. 使用路径订阅减少不必要的更新
2. 批量更新状态
3. 使用防抖/节流处理频繁更新
4. 及时清理订阅

## 迁移示例代码

完整的钱包页面迁移示例：

- 原文件：`src/js/pages/wallets/index.js`
- Store：`src/js/stores/walletStore.js`
- Manager：`src/js/pages/wallets/walletManager.js`
- 新版本：`src/js/pages/wallets/index-v2.js`

## 下一步

1. 选择一个简单页面开始迁移
2. 逐步迁移复杂页面
3. 统一错误处理
4. 添加单元测试

---

**创建时间**: 2024-12-27  
**版本**: 1.0.0 