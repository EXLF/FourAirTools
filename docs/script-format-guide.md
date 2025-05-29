# FourAir脚本开发规范文档

## 1. 概述

本文档详细说明了FourAir应用中脚本插件的开发格式、规范和最佳实践。所有脚本都必须遵循这些格式才能在系统中正常运行。

## 2. 脚本文件结构


### 2.2 基本结构
每个脚本文件必须包含以下基本结构：

```javascript
/**
 * 脚本描述注释
 * 功能：描述脚本的主要功能
 * 作者：作者名称
 * 版本：1.0.0
 * 日期：YYYY-MM-DD
 */

// 1. 配置函数 - 必需
function getConfig() {
  return {
    // 脚本元数据
    id: "unique_script_id",
    name: "脚本显示名称",
    description: "脚本功能描述",
    version: "1.0.0",
    author: "作者名",
    category: "分类名称",
    icon: "图标名",
    
    // 依赖声明
    requires: {
      wallets: true,  // 是否需要钱包 (true/false)
      proxy: false    // 是否强制需要代理 (true/false)  
    },
    
    // 模块声明 - 重要！
    requiredModules: ["axios", "crypto", "https"],
    
    // 支持平台
    platforms: ["通用"],
    
    // 配置参数（可选）
    config: {
      // 配置项定义
    }
  };
}

// 2. 主执行函数 - 必需
async function main(context) {
  // 脚本执行逻辑
  // 从context中获取参数和工具
}

// 3. 模块导出 - 必需
module.exports = {
  getConfig,
  main
};
```

## 3. 配置函数详解

### 3.1 必需字段
```javascript
{
  id: "unique_script_id",        // 唯一标识符，不能重复
  name: "用户友好的脚本名称",      // 在界面上显示的名称
  description: "详细的功能描述",   // 脚本功能说明
  version: "1.0.0",             // 版本号
  author: "作者名",              // 作者信息
  category: "工具分类",          // 脚本分类
  icon: "fas-icon-name",        // FontAwesome图标名
}
```

### 3.2 依赖声明
```javascript
requires: {
  wallets: true,   // true=需要选择钱包, false=不需要钱包
  proxy: false     // true=强制需要代理, false=代理可选
}
```

### 3.3 模块声明
```javascript
// 必须声明脚本中使用的所有Node.js模块
requiredModules: [
  "axios",        // HTTP请求库
  "crypto",       // 加密模块  
  "https",        // HTTPS模块
  "fs",           // 文件系统
  "path",         // 路径处理
  "url",          // URL处理
  "util"          // 工具函数
]
```

### 3.4 配置参数
```javascript
config: {
  paramName: {
    type: "text",                    // 参数类型
    label: "参数显示名称",            // 界面标签
    placeholder: "输入提示",         // 占位符
    default: "默认值",               // 默认值
    required: true,                  // 是否必需
    min: 1,                         // 最小值（数字类型）
    max: 100                        // 最大值（数字类型）
  }
}
```

支持的参数类型：
- `"text"` - 文本输入框
- `"textarea"` - 多行文本框
- `"number"` - 数字输入框
- `"checkbox"` - 复选框
- `"select"` - 下拉选择框（需要options数组）

## 4. 主执行函数

### 4.1 函数签名
```javascript
async function main(context) {
  // context 包含所有运行时参数和工具
}
```

### 4.2 context 对象结构
```javascript
context = {
  // 基本信息
  scriptId: "script_id",           // 脚本ID
  executionId: "exec_id",          // 执行ID
  
  // 数据
  wallets: [],                     // 选中的钱包列表
  config: {},                      // 用户配置参数
  proxy: null,                     // 代理信息
  
  // 工具函数
  utils: {
    delay: (ms) => Promise,        // 延时函数，替代setTimeout
    randomSleep: (minMs, maxMs) => Promise, // 随机延时函数
    logToUI: (message) => void,    // 向UI输出日志
  },
  
  // 存储
  storage: {
    setItem: (key, value) => {},   // 存储数据
    getItem: (key) => value,       // 获取数据
    removeItem: (key) => {},       // 删除数据
    clear: () => {}                // 清空存储
  },
  
  // 密钥管理
  secrets: {
    get: async (key) => string     // 获取密钥
  },
  
  // HTTP客户端
  http: axios,                     // axios实例
  
  // 停止处理
  onStop: null                     // 停止回调
}
```

## 5. 日志输出

### 5.1 使用console.log
```javascript
// 推荐使用console.log进行日志输出
console.log('📋 普通信息日志');
console.log('✅ 成功信息');  
console.log('⚠️ 警告信息');
console.log('❌ 错误信息');

// 系统会自动捕获console输出并显示在界面上
```

### 5.2 格式化输出
```javascript
// 使用emoji和格式化让日志更易读
console.log('🚀 开始执行任务...');
console.log(`📊 处理进度: ${current}/${total}`);
console.log(`✅ 成功处理: ${successCount} 个`);
console.log(`❌ 失败处理: ${failCount} 个`);
```

## 6. 最佳实践

### 6.1 错误处理
```javascript
async function main(context) {
  try {
    // 主要逻辑
    console.log('🚀 开始执行...');
    
    // 验证参数
    if (!config.requiredParam) {
      throw new Error('缺少必需参数');
    }
    
    // 执行操作
    const result = await someOperation();
    
    console.log('✅ 执行成功');
    return { success: true, data: result };
    
  } catch (error) {
    console.log(`❌ 执行失败: ${error.message}`);
    throw error; // 重新抛出错误
  }
}
```

### 6.2 进度显示
```javascript
async function main(context) {
  const { wallets } = context;
  const total = wallets.length;
  
  for (let i = 0; i < total; i++) {
    console.log(`📊 进度: ${i + 1}/${total} (${Math.round((i + 1) / total * 100)}%)`);
    
    // 处理单个钱包
    await processWallet(wallets[i]);
    
    // 适当延时
    await context.utils.delay(1000);
  }
}
```

### 6.3 配置验证
```javascript
async function main(context) {
  const { config, wallets } = context;
  
  // 验证配置
  if (!config.apiKey) {
    throw new Error('API密钥不能为空');
  }
  
  // 验证钱包（如果需要）
  if (wallets.length === 0) {
    throw new Error('请至少选择一个钱包');
  }
  
  console.log('✅ 配置验证通过');
}
```

### 6.4 资源清理
```javascript
async function main(context) {
  let connection = null;
  
  try {
    connection = await createConnection();
    // 使用连接...
    
  } finally {
    // 清理资源
    if (connection) {
      await connection.close();
      console.log('🧹 连接已关闭');
    }
  }
}
```

## 7. 注意事项

### 7.1 沙箱限制
- 脚本运行在沙箱环境中，无法访问文件系统（除非声明fs模块）
- 无法使用 `setTimeout`，请使用 `context.utils.delay()`
- 所有模块都必须在 `requiredModules` 中声明
- 脚本不能访问DOM或窗口对象

### 7.2 异步处理
- `main` 函数必须是 `async` 函数
- 使用 `await` 处理异步操作
- 适当添加延时避免请求过快

### 7.3 安全考虑
- 不要在脚本中硬编码敏感信息（密码、API密钥等）
- 使用 `context.secrets` 获取敏感信息
- 处理敏感信息时不要记录到日志

### 7.4 性能考虑
- 避免在循环中进行大量同步操作
- 合理使用延时控制请求频率
- 及时清理不需要的资源

## 8. 网络请求处理

### 8.1 使用内置HTTP客户端
```javascript
async function main(context) {
  const { http, proxy } = context;
  
  try {
    // 使用内置的axios实例
    const response = await http.get('https://api.example.com/data');
    console.log(`✅ 请求成功: ${response.status}`);
    return response.data;
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    throw error;
  }
}
```

### 8.2 处理代理设置
```javascript
async function main(context) {
  const { http, proxy } = context;
  
  if (!proxy) {
    console.log('⚠️ 未设置代理');
  } else {
    console.log(`📋 使用代理: ${proxy.host}:${proxy.port}`);
  }
  
  // 系统会自动配置代理到http客户端
}
```

## 9. 调试技巧

1. **详细日志**：添加足够的日志信息
2. **分步执行**：将复杂逻辑分解成小步骤
3. **参数打印**：在开始时打印所有输入参数
4. **异常捕获**：捕获并详细输出异常信息
5. **状态检查**：在关键节点检查和输出状态

---

遵循以上格式和最佳实践，您就能开发出稳定、可靠的脚本插件！ 