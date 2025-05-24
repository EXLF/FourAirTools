# FourAir工具箱 - 架构优化详细计划

## 📅 优化周期
**开始日期**: 2024年12月27日  
**预计完成**: 3-5天  
**版本目标**: v1.1.0 → v1.2.0

## 🎯 优化目标

1. **降低模块耦合度** - 实现高内聚低耦合的模块设计
2. **提升代码可维护性** - 通过服务层抽象简化业务逻辑
3. **统一数据流管理** - 引入状态管理机制
4. **增强代码可测试性** - 便于单元测试和集成测试

## 📁 第一步：目录结构重组 ✅

### 当前结构问题
- 业务逻辑和UI混杂
- 缺少清晰的分层
- 公共代码散落各处

### 新架构设计

```
src/
├── main/                    # 主进程
│   ├── core/               # 核心服务（已有）
│   ├── services/           # 业务服务层（新增）✅
│   │   ├── AuthService.js ✅
│   │   ├── DataService.js ✅
│   │   ├── ScriptService.js ✅
│   │   ├── scriptRunner.js ✅
│   │   └── NetworkService.js
│   ├── handlers/           # IPC处理器（重构）✅
│   │   ├── authHandlers.js ✅
│   │   ├── dataHandlers.js ✅
│   │   └── scriptHandlers.js ✅
│   └── utils/              # 工具函数
│
├── renderer/               # 渲染进程（新增）
│   ├── components/         # UI组件（从js/components迁移）
│   ├── pages/             # 页面模块（从js/pages迁移）
│   ├── services/          # 前端服务
│   ├── stores/            # 状态管理（新增）✅
│   │   ├── BaseStore.js ✅
│   │   ├── appStore.js ✅
│   │   ├── walletStore.js ✅
│   │   ├── scriptStore.js ✅
│   │   └── socialStore.js ✅
│   └── utils/             # 前端工具
│
└── shared/                # 共享代码（新增）✅
    ├── constants/         # 常量定义 ✅
    ├── types/            # 类型定义
    ├── errors/           # 错误定义 ✅
    │   └── AppError.js   # 统一错误类 ✅
    └── validators/       # 验证器
```

## 🔧 第二步：服务层抽象 ✅

### 1. AuthService（认证服务）✅
```javascript
class AuthService {
    constructor(cryptoService, db) {
        this.crypto = cryptoService;
        this.db = db;
    }
    
    async authenticate(password) { } ✅
    async changePassword(oldPassword, newPassword) { } ✅
    async resetApplication() { } ✅
    isUnlocked() { } ✅
}
```

### 2. DataService（数据访问服务）✅
```javascript
class DataService {
    constructor(db, cryptoService) {
        this.db = db;
        this.crypto = cryptoService;
    }
    
    // 钱包相关
    async getWallets(filters) { } ✅
    async addWallet(walletData) { } ✅
    async updateWallet(id, updates) { } ✅
    async deleteWallets(ids) { } ✅
    
    // 统一的数据加密/解密
    async encryptSensitiveData(data) { } ✅
    async decryptSensitiveData(data) { } ✅
}
```

### 3. ScriptService（脚本执行服务）✅
```javascript
class ScriptService {
    constructor() {
        this.executionQueue = new Map();
        this.concurrencyLimit = 3;
    }
    
    async executeScript(scriptPath, params, wallets) { } ✅
    async stopExecution(executionId) { } ✅
    getExecutionStatus(executionId) { } ✅
    setProgressCallback(executionId, callback) { } ✅
}
```

## 🎨 第三步：状态管理引入 ✅

### 使用轻量级状态管理（无需Redux）✅

```javascript
// stores/BaseStore.js ✅
class BaseStore extends EventTarget {
    constructor(initialState) {
        super();
        this.state = initialState;
    }
    
    setState(updates) { } ✅
    subscribe(callback, paths) { } ✅
    getState() { } ✅
}

// stores/appStore.js ✅
const appStore = new AppStore();
appStore.on('change', (state) => {
    // 更新UI
});
```

## 🔨 第四步：模块重构计划

### 1. 拆分大文件
- `src/js/pages/social/table.js` (600+行) → 拆分为：
  - `socialTable.js` - 表格主体
  - `socialTableActions.js` - 操作逻辑
  - `socialTableFilters.js` - 筛选逻辑
  - `socialTableExport.js` - 导出功能

### 2. 提取公共组件
- 创建通用表格组件
- 创建通用表单组件
- 创建通用对话框组件

### 3. 统一错误处理 ✅

```javascript
// shared/errors/AppError.js ✅
class AppError extends Error {
    constructor(message, code, details) {
        super(message);
        this.code = code;
        this.details = details;
    }
}

// 错误码定义 ✅
const ErrorCodes = {
    AUTH_FAILED: 'AUTH_001',
    NETWORK_ERROR: 'NET_001',
    DATA_INVALID: 'DATA_001'
};
```

## 📋 实施步骤

### Day 1: 基础架构搭建 ✅
- [x] 创建新的目录结构
- [x] 创建基础服务类框架
- [ ] 设置模块别名配置

### Day 2: 服务层实现 ✅
- [x] 实现AuthService
- [x] 实现DataService
- [x] 实现ScriptService
- [x] 重构IPC handlers使用服务层

### Day 3: 状态管理集成 ✅
- [x] 创建Store基类
- [x] 实现应用Store
- [x] 实现钱包Store
- [x] 实现脚本Store
- [x] 实现社交账户Store ✅
- [x] 集成到现有页面（75%完成）

### Day 4: 模块重构
- [ ] 拆分大文件
- [ ] 提取公共组件
- [x] 统一错误处理

### Day 5: 测试与优化
- [ ] 功能测试
- [ ] 性能测试
- [ ] 文档更新

## 🎯 预期成果

1. **代码组织改善**
   - 清晰的分层架构
   - 模块职责单一
   - 依赖关系明确

2. **可维护性提升**
   - 业务逻辑集中管理
   - UI与逻辑分离
   - 便于单元测试

3. **开发效率提升**
   - 公共组件复用
   - 统一的错误处理
   - 清晰的数据流

## ⚠️ 风险与挑战

1. **兼容性风险**
   - 需要保持API兼容
   - 渐进式迁移
   - 充分测试

2. **学习曲线**
   - 团队需要适应新架构
   - 编写迁移指南
   - 提供示例代码

## 📈 成功指标

- [ ] 模块耦合度降低50%
- [ ] 代码重复率降低30%
- [ ] 新功能开发时间缩短40%
- [ ] 单元测试覆盖率达到60%

## 📊 当前进度

### 已完成项目
1. **服务层创建** (100%)
   - ✅ AuthService - 认证服务
   - ✅ DataService - 数据访问服务
   - ✅ ScriptService - 脚本执行服务
   - ✅ scriptRunner - 脚本运行器

2. **状态管理** (100%)
   - ✅ BaseStore - 基础Store类
   - ✅ appStore - 应用全局Store
   - ✅ walletStore - 钱包Store
   - ✅ scriptStore - 脚本Store
   - ✅ socialStore - 社交账户Store

3. **错误处理** (100%)
   - ✅ AppError - 统一错误类
   - ✅ ErrorCodes - 错误码定义
   - ✅ ErrorMessages - 用户友好消息

4. **IPC处理器重构** (100%)
   - ✅ authHandlers - 认证处理器
   - ✅ dataHandlers - 数据处理器
   - ✅ scriptHandlers - 脚本处理器

5. **状态管理集成** (75%)
   - ✅ 钱包页面集成 (walletManager, index-v2.js)
   - ✅ 脚本页面集成 (scriptManager, index-v2.js)
   - ✅ 社交账户页面集成 (socialManager, index-v2.js) ✅
   - ✅ 创建集成指南文档
   - ⏳ 项目页面集成 (待实现)
   - ⏳ 设置页面集成 (待实现)
   - ⏳ 其他页面集成 (待实现)

### 下一步任务
1. 继续将状态管理集成到其他页面（项目、设置等）
2. 开始模块重构，拆分大文件（social/table.js）
3. 提取公共组件（表格、表单、对话框）
4. 完善迁移指南和示例代码
5. 进行功能测试和性能优化

---

**创建时间**: 2024-12-27  
**最后更新**: 2024-12-27  
**状态**: 进行中 (85% 完成) 