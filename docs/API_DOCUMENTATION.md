# FourAir工具箱 API文档

## 概述

FourAir工具箱是一个基于Electron的桌面应用，提供了丰富的API用于管理钱包、社交账户、代理和执行脚本等功能。

## 目录

- [核心服务](#核心服务)
  - [加密服务 (cryptoService)](#加密服务)
  - [数据库服务 (dbAPI)](#数据库服务)
- [前端组件](#前端组件)
  - [模态框 (modal)](#模态框)
  - [提示框 (toast)](#提示框)
- [脚本API](#脚本api)
  - [脚本执行](#脚本执行)
  - [脚本管理](#脚本管理)

## 核心服务

### 加密服务

加密服务提供应用程序的核心加密功能。

#### `cryptoService.isConfigured()`

检查加密配置是否已存在。

**返回值:**
- `Promise<boolean>` - 如果配置已存在则返回 true

**示例:**
```javascript
const isConfigured = await cryptoService.isConfigured();
if (!isConfigured) {
    // 需要初始化配置
}
```

#### `cryptoService.generateSalt()`

生成一个新的随机盐值。

**返回值:**
- `Buffer` - 16字节的随机盐值

#### `cryptoService.deriveKey(password, salt)`

使用PBKDF2从密码派生密钥。

**参数:**
- `password` (string) - 用户密码
- `salt` (Buffer) - 盐值

**返回值:**
- `Promise<Buffer>` - 派生的32字节密钥

#### `cryptoService.encrypt(plainText, key)`

使用AES-256-GCM加密文本。

**参数:**
- `plainText` (string) - 要加密的明文
- `key` (Buffer) - 32字节的加密密钥

**返回值:**
- `string` - Base64编码的加密数据（格式：`iv:authTag:encrypted`）

**异常:**
- `Error` - 如果加密失败

### 数据库服务

数据库服务通过IPC提供数据访问功能。

#### 钱包管理

##### `dbAPI.addWallet(walletData)`

添加新钱包。

**参数:**
- `walletData` (Object) - 钱包数据
  - `address` (string) - 钱包地址
  - `name` (string) - 钱包名称
  - `encryptedPrivateKey` (string) - 加密的私钥
  - `encryptedMnemonic` (string) - 加密的助记词
  - `groupId` (number) - 分组ID

**返回值:**
- `Promise<Object>` - 添加的钱包信息

##### `dbAPI.getWallets(options)`

获取钱包列表。

**参数:**
- `options` (Object) - 查询选项
  - `groupId` (number) - 按分组筛选
  - `search` (string) - 搜索关键词

**返回值:**
- `Promise<Array>` - 钱包列表

## 前端组件

### 模态框

模态框组件提供灵活的对话框功能。

#### `showModal(options)`

显示模态框。

**参数:**
- `options` (ModalOptions) - 配置选项
  - `title` (string) - 标题
  - `content` (string) - HTML内容
  - `size` (string) - 大小：'small' | 'medium' | 'large'
  - `persistent` (boolean) - 是否持久化（不可关闭）
  - `onShow` (Function) - 显示回调
  - `onClose` (Function) - 关闭回调

**返回值:**
- `HTMLElement` - 模态框元素

**示例:**
```javascript
showModal({
    title: '确认操作',
    content: '<p>确定要执行此操作吗？</p>',
    size: 'small',
    onClose: () => {
        console.log('模态框已关闭');
    }
});
```

### 提示框

#### `showToast(message, type, duration)`

显示提示消息。

**参数:**
- `message` (string) - 消息内容
- `type` (string) - 类型：'success' | 'error' | 'warning' | 'info'
- `duration` (number) - 显示时长（毫秒）

**示例:**
```javascript
showToast('操作成功', 'success', 3000);
```

## 脚本API

### 脚本执行

#### `scriptAPI.executeScript(scriptId, wallets, config, proxyConfig)`

执行脚本。

**参数:**
- `scriptId` (string) - 脚本ID
- `wallets` (Array) - 钱包ID列表
- `config` (Object) - 脚本配置
- `proxyConfig` (Object) - 代理配置

**返回值:**
- `Promise<Object>` - 执行结果
  - `success` (boolean) - 是否成功
  - `data.executionId` (string) - 执行ID
  - `error` (string) - 错误信息（如果失败）

#### `scriptAPI.stopScript(executionId)`

停止正在执行的脚本。

**参数:**
- `executionId` (string) - 执行ID

**返回值:**
- `Promise<Object>` - 操作结果

### 脚本管理

#### `scriptAPI.getAllScripts()`

获取所有可用脚本。

**返回值:**
- `Promise<Object>` - 脚本列表
  - `success` (boolean) - 是否成功
  - `data` (Array) - 脚本信息数组

## 错误处理

所有API调用都遵循统一的错误处理模式：

```javascript
try {
    const result = await someAPI.method();
    if (result.success) {
        // 处理成功情况
    } else {
        // 处理失败情况
        console.error(result.error);
    }
} catch (error) {
    // 处理异常
    console.error('API调用失败:', error);
}
```

## 安全注意事项

1. **敏感数据加密** - 所有敏感数据（私钥、密码等）必须加密存储
2. **会话管理** - 使用会话密钥，避免明文密码在内存中长期存储
3. **输入验证** - 所有用户输入必须经过验证和清理
4. **权限控制** - 通过IPC白名单限制可调用的API

---

更新时间：2024-12-27
版本：1.0.0 