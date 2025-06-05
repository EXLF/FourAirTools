# Python脚本转FourAir规范转换指南

## 概述

本文档详细说明如何将Python脚本（如demo/目录下的Sahara AI脚本）转换为符合FourAir脚本开发规范的JavaScript脚本。

## 转换对比分析

### 原始Python脚本结构

原Python脚本包含以下模块：
- `main.py` - 主程序入口，包含交互式配置菜单
- `core/process_wallets.py` - 钱包处理核心逻辑
- `modules/faucet.py` - 水龙头领取功能
- `modules/transaction.py` - 随机转账功能  
- `modules/claim.py` - 任务奖励领取功能
- `core/client.py` - Web3客户端封装
- `core/captcha.py` - 验证码处理
- `settings.py` - 配置参数
- `utils/` - 工具函数

### 转换后FourAir脚本结构

```javascript
// 1. 配置函数 - 替代settings.py和交互式配置
function getConfig() {
  return {
    id: "sahara_ai_bot",
    name: "Sahara AI 自动化机器人",
    // ... 配置参数定义
  };
}

// 2. 主函数 - 替代main.py和process_wallets.py
async function main(context) {
  // 统一的脚本执行逻辑
}

// 3. 辅助函数 - 替代各个模块
async function claimFaucet() {}
async function performRandomTransaction() {}
async function claimTaskReward() {}

// 4. 模块导出
module.exports = { getConfig, main };
```

## 详细转换映射

### 1. 配置管理转换

**Python版本 (settings.py + 交互式配置):**
```python
# settings.py
sleep_wallets = [30,60]
sleep_actions = [10,15]
api_key = ''
Faucet = True
Transaction = True
Claim = True

# main.py中的交互式配置
def configure_settings():
    print("=== Configuration Menu ===")
    # 交互式输入配置
```

**JavaScript版本 (getConfig函数):**
```javascript
function getConfig() {
  return {
    config: {
      twoCaptchaApiKey: {
        type: "text",
        label: "2Captcha API Key",
        required: false
      },
      enableFaucet: {
        type: "checkbox",
        label: "启用水龙头领取",
        default: true
      },
      waitBetweenWallets: {
        type: "number",
        label: "钱包间延时(秒)",
        min: 30, max: 300, default: 60
      }
      // ...其他配置
    }
  };
}
```

### 2. 钱包处理逻辑转换

**Python版本:**
```python
# core/process_wallets.py
async def process_wallets(data, count, private_key, proxy):
    async with semaphore:
        client = Client(private_key=private_key, proxy=proxy)
        
        if settings.Faucet:
            await faucet.faucet(count, proxy, client)
        if settings.Transaction:
            await transaction.transaction(count, private_key, proxy)
        if settings.Claim:
            await claim.claim(count, private_key, proxy, client)
```

**JavaScript版本:**
```javascript
async function main(context) {
  const { wallets, config, utils } = context;
  
  for (let i = 0; i < wallets.length; i++) {
    const walletInfo = wallets[i];
    const { ethers } = require('ethers');
    const wallet = new ethers.Wallet(walletInfo.privateKey, provider);
    
    if (config.enableFaucet) {
      await claimFaucet(wallet, http, config.twoCaptchaApiKey, utils);
    }
    if (config.enableTransaction) {
      await performRandomTransaction(wallet, config, utils);
    }
    if (config.enableClaim) {
      await claimTaskReward(wallet, http, utils);
    }
  }
}
```

### 3. 网络请求转换

**Python版本 (使用aiohttp):**
```python
import aiohttp
from aiohttp_proxy import ProxyConnector

connector = ProxyConnector.from_url(f'http://{proxy}')
async with aiohttp.ClientSession(connector=connector) as session:
    async with session.post(url=api_url, json=payload) as response:
        data = await response.json()
```

**JavaScript版本 (使用context.http):**
```javascript
// 代理会自动通过context.http配置
const response = await context.http.post(api_url, payload, {
  headers: { 'user-agent': userAgent }
});
const data = response.data;
```

### 4. 区块链交互转换

**Python版本 (使用web3.py):**
```python
from web3 import AsyncWeb3
from eth_account.signers.local import LocalAccount

self.w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(endpoint_uri=rpc))
self.account = self.w3.eth.account.from_key(private_key)

# 发送交易
tx_params = {
    'chainId': await self.w3.eth.chain_id,
    'nonce': await self.w3.eth.get_transaction_count(self.account.address),
    # ...
}
sign = self.w3.eth.account.sign_transaction(tx_params, self.private_key)
```

**JavaScript版本 (使用ethers.js):**
```javascript
const { ethers } = require('ethers');
const provider = new ethers.JsonRpcProvider(rpcUrl);
const wallet = new ethers.Wallet(privateKey, provider);

// 发送交易
const tx = await wallet.sendTransaction({
  to: toAddress,
  value: amount
});
const receipt = await tx.wait();
```

### 5. 验证码处理转换

**Python版本:**
```python
# core/captcha.py
import asyncio
payload_create = {
    "clientKey": settings.api_key,
    "task": {
        "type": "TurnstileTask",
        "websiteURL": "https://faucet.saharalabs.ai/",
        # ...
    }
}
async with session.post(url='https://api.2captcha.com/createTask', json=payload_create) as response:
    # 处理响应
```

**JavaScript版本:**
```javascript
async function solveTurnstileCaptcha(apiKey, siteUrl, siteKey, userAgent, proxy, http, utils) {
  const createTaskPayload = {
    clientKey: apiKey,
    task: {
      type: "TurnstileTask",
      websiteURL: siteUrl,
      websiteKey: siteKey,
      userAgent: userAgent
    }
  };
  
  const createResponse = await http.post('https://api.2captcha.com/createTask', createTaskPayload);
  // 处理响应和轮询
}
```

### 6. 异步延时转换

**Python版本:**
```python
import asyncio
await asyncio.sleep(sleep_time)
```

**JavaScript版本:**
```javascript
// ❌ 错误：不能使用setTimeout
// await new Promise(resolve => setTimeout(resolve, ms));

// ✅ 正确：使用context.utils.delay
await utils.delay(ms);
```

### 7. 日志输出转换

**Python版本:**
```python
from utils.logger import get_logger
logger = get_logger()

logger.info('Starting wallet processing')
logger.success('Faucet claim successful')
logger.warning('Balance insufficient')
logger.error('Transaction failed')
```

**JavaScript版本:**
```javascript
// 使用标准console.log，系统会自动处理
console.log('🚀 开始处理钱包');
console.log('✅ 水龙头领取成功');
console.log('⚠️ 余额不足');
console.log('❌ 交易失败');

// 或使用专用日志对象
utils.logger.info('普通信息');
utils.logger.success('成功信息');
utils.logger.warn('警告信息');
utils.logger.error('错误信息');
```

## 转换要点总结

### 必须遵循的规范

1. **脚本结构**：
   - 必须有`getConfig()`和`main(context)`函数
   - 必须有`module.exports`导出

2. **模块声明**：
   - 在`requiredModules`中声明所有使用的模块
   - 只能使用预装模块，不能动态安装

3. **安全限制**：
   - 不能使用`setTimeout`，必须用`context.utils.delay()`
   - 不能访问文件系统（fs模块）
   - 不能使用child_process等危险模块

4. **参数化配置**：
   - 将硬编码配置转为用户可配置参数
   - 通过UI界面让用户设置参数

### 功能增强

1. **错误处理**：
   - 单个钱包失败不影响其他钱包处理
   - 网络请求自动重试机制
   - 详细的错误信息输出

2. **用户体验**：
   - 丰富的emoji图标日志输出
   - 详细的进度显示
   - 完整的执行统计

3. **可配置性**：
   - 所有重要参数都可通过UI配置
   - 功能模块可独立开关
   - 灵活的延时设置

## 转换检查清单

### ✅ 必需项目

- [ ] 实现`getConfig()`函数，包含完整的脚本元数据
- [ ] 实现`main(context)`函数，接收标准context参数
- [ ] 添加`module.exports = { getConfig, main }`导出
- [ ] 在`requiredModules`中声明所有使用的模块
- [ ] 将所有`setTimeout`替换为`context.utils.delay()`
- [ ] 使用`context.http`替代原生HTTP库
- [ ] 将硬编码配置转为`config`参数

### ✅ 优化项目

- [ ] 添加丰富的emoji日志输出
- [ ] 实现重试机制和错误处理
- [ ] 添加详细的进度显示
- [ ] 提供执行统计信息
- [ ] 支持功能模块独立开关
- [ ] 添加参数验证和边界检查

### ✅ 安全检查

- [ ] 确保不使用任何禁用模块（fs、child_process等）
- [ ] 确保不使用原生setTimeout/setInterval
- [ ] 确保敏感信息不在日志中输出
- [ ] 确保所有网络请求都有超时和重试

## 示例对比

### Python原始脚本特点
- 多文件模块化结构
- 交互式命令行配置
- 硬编码的网络和配置参数
- 基于文件的私钥和代理管理
- 同步的错误处理逻辑

### FourAir JavaScript脚本特点
- 单文件包含所有逻辑
- GUI界面参数配置
- 参数化的所有配置项
- 通过钱包管理器管理钱包
- 强大的错误容错和重试机制
- VM2沙箱安全运行
- 标准化的日志和进度输出

通过这种转换，原本需要命令行操作的复杂Python脚本变成了用户友好的GUI脚本，同时保持了所有原有功能，并增强了安全性和用户体验。 