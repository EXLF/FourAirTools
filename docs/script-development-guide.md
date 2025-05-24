# 批量脚本开发格式说明文档

## 概述

本文档详细说明了批量脚本系统中脚本的开发格式、规范和最佳实践。所有脚本都必须遵循这些格式才能在系统中正常运行。

## 基本文件结构

### 1. 文件位置
```
user_scripts/scripts/
├── your_script.js          # 你的脚本文件
├── demo_print_config.js    # 示例脚本
└── http_request_test.js    # HTTP测试脚本
```

### 2. 基本格式
每个脚本文件必须包含以下基本结构：

```javascript
/**
 * 脚本描述注释
 * 功能：描述脚本的主要功能
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

## 详细配置说明

### 1. getConfig() 函数

#### 必需字段
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

#### 依赖声明
```javascript
requires: {
  wallets: true,   // true=需要选择钱包, false=不需要钱包
  proxy: false     // true=强制需要代理, false=代理可选
}
```

#### 模块声明（重要！）
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

#### 配置参数（可选）
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

### 2. main() 函数

#### 函数签名
```javascript
async function main(context) {
  // context 包含所有运行时参数和工具
}
```

#### context 对象结构
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

### 3. 日志输出

#### 使用console.log
```javascript
// 推荐使用console.log进行日志输出
console.log('📋 普通信息日志');
console.log('✅ 成功信息');  
console.log('⚠️ 警告信息');
console.log('❌ 错误信息');

// 系统会自动捕获console输出并显示在界面上
```

#### 格式化输出
```javascript
// 使用emoji和格式化让日志更易读
console.log('🚀 开始执行任务...');
console.log(`📊 处理进度: ${current}/${total}`);
console.log(`✅ 成功处理: ${successCount} 个`);
console.log(`❌ 失败处理: ${failCount} 个`);
```

## 完整示例

### 简单脚本示例
```javascript
/**
 * 简单示例脚本
 * 功能：打印配置信息和钱包列表
 */

function getConfig() {
  return {
    id: "simple_demo",
    name: "简单演示脚本", 
    description: "演示基本的脚本格式",
    version: "1.0.0",
    author: "FourAir",
    category: "演示",
    icon: "code",
    
    requires: {
      wallets: true,    // 需要钱包
      proxy: false
    },
    
    requiredModules: [],  // 不需要额外模块
    
    platforms: ["通用"],
    
    config: {
      message: {
        type: "text",
        label: "自定义消息",
        default: "Hello World!",
        required: true
      },
      count: {
        type: "number", 
        label: "重复次数",
        default: 3,
        min: 1,
        max: 10
      }
    }
  };
}

async function main(context) {
  const { wallets, config } = context;
  
  console.log('🚀 开始执行简单演示脚本');
  console.log(`📋 配置信息:`);
  console.log(`   - 消息: ${config.message}`);
  console.log(`   - 重复次数: ${config.count}`);
  console.log(`   - 钱包数量: ${wallets.length}`);
  
  // 遍历钱包
  for (let i = 0; i < wallets.length; i++) {
    const wallet = wallets[i];
    console.log(`👛 钱包 ${i + 1}: ${wallet.address}`);
    
    // 重复输出消息
    for (let j = 0; j < config.count; j++) {
      console.log(`   📢 ${config.message} (${j + 1})`);
      await context.utils.delay(1000); // 延时1秒
    }
  }
  
  console.log('✅ 脚本执行完成');
  
  return {
    success: true,
    data: {
      processedWallets: wallets.length,
      totalMessages: wallets.length * config.count
    }
  };
}

module.exports = {
  getConfig,
  main
};
```

### HTTP请求脚本示例
```javascript
/**
 * HTTP请求示例脚本
 * 功能：发送HTTP请求并处理响应
 */

function getConfig() {
  return {
    id: "http_example",
    name: "HTTP请求示例",
    description: "演示HTTP请求的处理",
    version: "1.0.0", 
    author: "FourAir",
    category: "网络工具",
    icon: "globe",
    
    requires: {
      wallets: false,   // 不需要钱包
      proxy: false
    },
    
    requiredModules: ["axios", "https"], // 声明需要的模块
    
    platforms: ["通用"],
    
    config: {
      url: {
        type: "text",
        label: "请求URL",
        default: "https://httpbin.org/get",
        required: true
      },
      method: {
        type: "select",
        label: "请求方法",
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" }
        ],
        default: "GET"
      }
    }
  };
}

async function main(context) {
  const { config } = context;
  const axios = require('axios');
  
  console.log('🌐 开始HTTP请求');
  console.log(`📋 URL: ${config.url}`);
  console.log(`📋 方法: ${config.method}`);
  
  try {
    const response = await axios({
      method: config.method.toLowerCase(),
      url: config.url,
      timeout: 30000
    });
    
    console.log(`✅ 请求成功`);
    console.log(`📊 状态码: ${response.status}`);
    console.log(`📄 响应数据: ${JSON.stringify(response.data, null, 2)}`);
    
    return {
      success: true,
      data: response.data
    };
    
  } catch (error) {
    console.log(`❌ 请求失败: ${error.message}`);
    throw error;
  }
}

module.exports = {
  getConfig,
  main
};
```

## 最佳实践

### 1. 错误处理
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

### 2. 进度显示
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

### 3. 配置验证
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

### 4. 资源清理
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

## 注意事项

### 1. 沙箱限制
- 脚本运行在沙箱环境中，无法访问文件系统（除非声明fs模块）
- 无法使用 `setTimeout`，请使用 `context.utils.delay()`
- 所有模块都必须在 `requiredModules` 中声明

### 2. 异步处理
- `main` 函数必须是 `async` 函数
- 使用 `await` 处理异步操作
- 适当添加延时避免请求过快

### 3. 错误处理
- 总是使用 try-catch 包装可能失败的操作
- 提供清晰的错误信息
- 失败时抛出错误而不是返回false

### 4. 性能考虑
- 避免在循环中进行大量同步操作
- 合理使用延时控制请求频率
- 及时清理不需要的资源

## 测试建议

1. **本地测试**：先在本地环境测试脚本逻辑
2. **参数验证**：测试各种参数组合
3. **错误场景**：测试网络错误、参数错误等场景
4. **边界条件**：测试空钱包列表、超大数据等
5. **性能测试**：测试大量钱包的处理性能

## 调试技巧

1. **详细日志**：添加足够的日志信息
2. **分步执行**：将复杂逻辑分解成小步骤
3. **参数打印**：在开始时打印所有输入参数
4. **异常捕获**：捕获并详细输出异常信息
5. **状态检查**：在关键节点检查和输出状态

---

遵循以上格式和最佳实践，您就能开发出稳定、可靠的批量脚本！ 