# Sahara AI 脚本 YesCaptcha 集成文档

## 概述

本文档记录了将 YesCaptcha 验证码服务集成到 Sahara AI 自动化脚本的过程。现在用户可以在 2Captcha 和 YesCaptcha 之间自由选择验证码解决服务。

## 集成特性

### 1. 验证码服务选择
- 新增 `captchaService` 配置选项
- 支持两种验证码服务：
  - **2Captcha**: 原有服务，支持代理模式和智能降级
  - **YesCaptcha**: 新增服务，使用 TurnstileTaskProxyless 模式

### 2. 配置参数

```javascript
captchaService: {
  type: "select",
  label: "验证码服务选择", 
  options: [
    { value: "2captcha", label: "2Captcha" },
    { value: "yescaptcha", label: "YesCaptcha" }
  ],
  default: "2captcha",
  required: true
},
twoCaptchaApiKey: {
  type: "text",
  label: "2Captcha API Key",
  placeholder: "请输入2Captcha API密钥",
  required: false
},
yescaptchaApiKey: {
  type: "text", 
  label: "YesCaptcha API Key",
  placeholder: "请输入YesCaptcha API密钥",
  required: false
}
```

### 3. API 兼容性

#### YesCaptcha API 端点
- **创建任务**: `POST https://api.yescaptcha.com/createTask`
- **获取结果**: `POST https://api.yescaptcha.com/getTaskResult`

#### 请求格式
```javascript
// 创建任务
{
  clientKey: "API_KEY",
  task: {
    type: "TurnstileTaskProxyless",
    websiteURL: "https://faucet.saharalabs.ai/",
    websiteKey: "0x4AAAAAAA8hNPuIp1dAT_d9"
  }
}

// 获取结果
{
  clientKey: "API_KEY",
  taskId: "TASK_ID"
}
```

#### 响应处理
```javascript
// 创建响应
{
  taskId: "string",
  errorDescription: "string" // 失败时
}

// 结果响应  
{
  status: "ready" | "processing",
  solution: {
    token: "string" // 成功时的验证码token
  }
}
```

## 实现细节

### 1. 智能服务选择
```javascript
async function solveTurnstileCaptcha(captchaService, apiKey, siteUrl, siteKey, userAgent, proxy, http, utils, forceNoProxy = false) {
  if (captchaService === 'yescaptcha') {
    return await solveWithYesCaptcha(apiKey, siteUrl, siteKey, userAgent, http, utils);
  } else {
    return await solveWith2Captcha(apiKey, siteUrl, siteKey, userAgent, proxy, http, utils, forceNoProxy);
  }
}
```

### 2. YesCaptcha 实现
- 使用 `TurnstileTaskProxyless` 类型任务
- 5秒轮询间隔，最多等待5分钟
- 详细的错误日志和状态反馈
- 自动重试机制

### 3. 参数验证
```javascript
const selectedApiKey = config.captchaService === 'yescaptcha' ? config.yescaptchaApiKey : config.twoCaptchaApiKey;
if (config.enableFaucet && !selectedApiKey) {
  const serviceName = config.captchaService === 'yescaptcha' ? 'YesCaptcha' : '2Captcha';
  throw new Error(`启用水龙头功能需要配置${serviceName} API Key`);
}
```

## 使用指南

### 1. 配置步骤
1. 在脚本配置界面选择验证码服务
2. 根据选择的服务配置对应的 API Key：
   - 选择 2Captcha：配置 `2Captcha API Key`
   - 选择 YesCaptcha：配置 `YesCaptcha API Key`
3. 启用水龙头功能
4. 运行脚本

### 2. 服务对比

| 特性 | 2Captcha | YesCaptcha |
|------|----------|------------|
| 代理支持 | ✅ 支持代理和无代理模式 | ❌ 仅支持无代理模式 |
| 智能降级 | ✅ 代理失败自动切换无代理 | ❌ 不适用 |
| API稳定性 | 🟡 较好 | 🟡 待验证 |
| 价格 | 💰 标准定价 | 💰 需要对比 |
| 速度 | ⚡ 中等 | ⚡ 待测试 |

### 3. 最佳实践
- **新用户建议**: 优先选择 2Captcha（更成熟稳定）
- **代理环境**: 必须选择 2Captcha
- **速度优先**: 可以测试 YesCaptcha 性能
- **成本考虑**: 对比两个服务的定价

## 错误处理

### 1. 常见错误
- `YesCaptcha创建任务失败`: API Key 错误或配额不足
- `YesCaptcha验证码任务状态异常`: 服务端问题
- `YesCaptcha验证码获取超时`: 网络或服务问题

### 2. 故障恢复
- YesCaptcha 失败时，脚本会跳过验证码步骤
- 建议配置备用的 2Captcha 服务
- 可以通过日志排查具体问题

## 日志输出示例

```
🔐 开始使用YesCaptcha解决Turnstile验证码...
📋 YesCaptcha任务ID: 12345678
⏳ YesCaptcha验证码解决中... (1/60)
⏳ YesCaptcha验证码解决中... (2/60) 
✅ YesCaptcha验证码解决成功
```

## 技术实现参考

实现参考了 `irys.js` 脚本中的 YesCaptcha 集成方式：
- API 端点和请求格式
- 轮询机制和超时处理  
- 错误处理和日志输出
- 任务状态判断逻辑

## 更新日志

**2024-12-19**
- ✅ 新增 YesCaptcha 验证码服务支持
- ✅ 新增验证码服务选择配置项
- ✅ 实现智能 API Key 验证
- ✅ 完善错误处理和日志输出
- ✅ 更新配置界面显示信息 