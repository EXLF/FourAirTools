/**
 * 综合示例脚本 v2.0 - 完整功能演示
 * 功能：演示FourAir v2.0脚本格式规范的所有主要特性
 * 作者：FourAir开发团队
 * 版本：2.0.0
 * 更新：2024-12-19
 * 
 * 本脚本展示以下功能：
 * 1. 完整的配置参数定义
 * 2. Context对象的所有属性使用
 * 3. 安全的模块加载和使用
 * 4. 标准化的日志输出
 * 5. 网络请求处理（含代理）
 * 6. 存储和状态管理
 * 7. 错误处理和资源清理
 * 8. 性能优化和并发控制
 */

// ==================== 1. 配置函数 ====================
function getConfig() {
  return {
    // 基本信息
    id: "comprehensive_demo_v2",
    name: "综合功能演示脚本",
    description: "演示FourAir v2.0脚本格式规范的所有主要特性，包括参数处理、模块使用、日志输出、网络请求、存储管理等",
    version: "2.0.0",
    author: "FourAir开发团队",
    category: "开发工具",
    icon: "fas fa-cogs",
    
    // 依赖声明
    requires: {
      wallets: true,  // 需要钱包
      proxy: false    // 代理可选
    },
    
    // 模块声明 - 演示各种安全模块的使用
    requiredModules: [
      "axios",    // HTTP请求
      "crypto",   // 加密功能
      "url",      // URL处理
      "util",     // 工具函数
      "path"      // 路径处理
    ],
    
    // 支持平台
    platforms: ["通用"],
    
    // 执行超时 (10分钟)
    timeout: 600000,
    
    // 配置参数 - 演示所有参数类型
    config: {
      // 文本输入
      apiEndpoint: {
        type: "text",
        label: "API端点",
        placeholder: "请输入API地址，如 https://api.example.com",
        default: "https://jsonplaceholder.typicode.com",
        required: true
      },
      
      // 数字输入
      batchSize: {
        type: "number",
        label: "批处理大小",
        min: 1,
        max: 10,
        default: 3,
        required: true
      },
      
      // 数字输入 - 延时设置
      delayMs: {
        type: "number", 
        label: "延时间隔(毫秒)",
        min: 500,
        max: 10000,
        default: 2000,
        required: true
      },
      
      // 多行文本
      description: {
        type: "textarea",
        label: "执行描述",
        rows: 3,
        placeholder: "请输入本次执行的描述信息（可选）",
        default: "综合功能演示执行"
      },
      
      // 复选框
      enableAdvancedFeatures: {
        type: "checkbox",
        label: "启用高级功能",
        default: true
      },
      
      // 复选框 - 详细日志
      verboseLogging: {
        type: "checkbox",
        label: "详细日志输出",
        default: false
      },
      
      // 下拉选择
      operationMode: {
        type: "select",
        label: "操作模式",
        options: [
          { value: "demo", label: "演示模式" },
          { value: "test", label: "测试模式" },
          { value: "production", label: "生产模式" }
        ],
        default: "demo"
      },
      
      // 下拉选择 - 网络设置
      networkType: {
        type: "select",
        label: "网络类型",
        options: [
          { value: "mainnet", label: "主网" },
          { value: "testnet", label: "测试网" },
          { value: "local", label: "本地网络" }
        ],
        default: "testnet"
      }
    }
  };
}

// ==================== 2. 主执行函数 ====================
async function main(context) {
  // 解构context对象，演示所有可用属性
  const { 
    scriptId, 
    executionId, 
    wallets, 
    config, 
    proxy, 
    utils, 
    storage, 
    secrets, 
    http,
    onStop 
  } = context;
  
  try {
    console.log('🚀 综合功能演示脚本开始执行...');
    console.log('=' .repeat(50));
    
    // ==================== 3. Context信息展示 ====================
    await displayContextInfo(context);
    
    // ==================== 4. 参数验证 ====================
    validateConfiguration(config);
    
    // ==================== 5. 存储系统演示 ====================
    await demonstrateStorage(storage, executionId);
    
    // ==================== 6. 模块使用演示 ====================
    await demonstrateModules();
    
    // ==================== 7. 网络请求演示 ====================
    await demonstrateNetworkRequests(http, config, proxy);
    
    // ==================== 8. 密钥管理演示 ====================
    if (config.enableAdvancedFeatures) {
      await demonstrateSecrets(secrets);
    }
    
    // ==================== 9. 钱包批处理演示 ====================
    const results = await processWalletsInBatches(wallets, config, utils);
    
    // ==================== 10. 性能统计和结果汇总 ====================
    const summary = await generateExecutionSummary(results, storage, executionId);
    
    console.log('=' .repeat(50));
    console.log('✅ 综合功能演示脚本执行完成！');
    
    return {
      success: true,
      message: '所有功能演示完成',
      data: {
        executionId,
        config: {
          mode: config.operationMode,
          network: config.networkType,
          batchSize: config.batchSize,
          advancedFeatures: config.enableAdvancedFeatures
        },
        results: summary
      }
    };
    
  } catch (error) {
    console.log(`❌ 脚本执行失败: ${error.message}`);
    await handleExecutionError(error, storage, executionId);
    throw error;
  } finally {
    // 资源清理
    await cleanupResources(storage, executionId);
  }
}

// ==================== 辅助函数 ====================

/**
 * 显示Context信息
 */
async function displayContextInfo(context) {
  const { scriptId, executionId, wallets, config, proxy, utils } = context;
  
  console.log('📋 Context信息展示:');
  console.log(`   🔖 脚本ID: ${scriptId}`);
  console.log(`   🆔 执行ID: ${executionId}`);
  console.log(`   👛 钱包数量: ${wallets.length}`);
  console.log(`   ⚙️  配置参数数量: ${Object.keys(config).length}`);
  console.log(`   🌐 代理设置: ${proxy ? `${proxy.type}://${proxy.host}:${proxy.port}` : '未设置'}`);
  
  if (config.verboseLogging) {
    console.log('🔍 详细配置信息:');
    for (const [key, value] of Object.entries(config)) {
      console.log(`   📝 ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
    }
    
    console.log('🔍 钱包详情:');
    wallets.forEach((wallet, index) => {
      console.log(`   💳 钱包${index + 1}: ${wallet.name || '未命名'} (${wallet.address})`);
    });
  }
  
  // 演示专用日志对象
  if (utils.logger) {
    utils.logger.info('专用日志对象测试 - 信息级别');
    utils.logger.success('专用日志对象测试 - 成功级别');
    utils.logger.warn('专用日志对象测试 - 警告级别');
  }
  
  await utils.delay(1000);
}

/**
 * 验证配置参数
 */
function validateConfiguration(config) {
  console.log('🔍 参数验证中...');
  
  // 验证必需参数
  if (!config.apiEndpoint) {
    const error = new Error('API端点不能为空');
    error.name = 'ValidationError';
    throw error;
  }
  
  // 验证数字范围
  if (config.batchSize < 1 || config.batchSize > 10) {
    const error = new Error('批处理大小必须在1-10之间');
    error.name = 'ValidationError';
    throw error;
  }
  
  if (config.delayMs < 500 || config.delayMs > 10000) {
    const error = new Error('延时间隔必须在500-10000毫秒之间');
    error.name = 'ValidationError';
    throw error;
  }
  
  // 验证URL格式
  try {
    new URL(config.apiEndpoint);
  } catch (urlError) {
    const error = new Error(`API端点URL格式错误: ${config.apiEndpoint}`);
    error.name = 'ValidationError';
    throw error;
  }
  
  console.log('✅ 参数验证通过');
}

/**
 * 演示存储系统
 */
async function demonstrateStorage(storage, executionId) {
  console.log('💾 存储系统演示:');
  
  // 获取历史执行记录
  const executionHistory = storage.getItem('executionHistory') || [];
  console.log(`   📚 历史执行记录: ${executionHistory.length} 条`);
  
  // 保存当前执行信息
  const currentExecution = {
    executionId,
    startTime: Date.now(),
    status: 'running'
  };
  
  executionHistory.push(currentExecution);
  storage.setItem('executionHistory', executionHistory);
  storage.setItem('currentExecutionId', executionId);
  storage.setItem('lastExecutionTime', Date.now());
  
  // 演示数据更新
  let counter = storage.getItem('executionCounter') || 0;
  counter++;
  storage.setItem('executionCounter', counter);
  
  console.log(`   📊 执行计数器: ${counter}`);
  console.log(`   🕐 上次执行: ${new Date(storage.getItem('lastExecutionTime')).toLocaleString()}`);
  
  // 清理旧记录（保持最多10条）
  if (executionHistory.length > 10) {
    const cleanedHistory = executionHistory.slice(-10);
    storage.setItem('executionHistory', cleanedHistory);
    console.log('   🧹 清理了过期的执行记录');
  }
}

/**
 * 演示模块使用
 */
async function demonstrateModules() {
  console.log('📦 模块使用演示:');
  
  // 演示crypto模块
  const crypto = require('crypto');
  const randomBytes = crypto.randomBytes(16).toString('hex');
  const hash = crypto.createHash('sha256').update('demo-data').digest('hex');
  console.log(`   🔐 随机字节: ${randomBytes}`);
  console.log(`   #️⃣  SHA256哈希: ${hash.substring(0, 16)}...`);
  
  // 演示url模块
  const url = require('url');
  const parsedUrl = new url.URL('https://api.example.com/v1/data?param=value');
  console.log(`   🔗 URL解析: ${parsedUrl.hostname}${parsedUrl.pathname}`);
  
  // 演示util模块
  const util = require('util');
  const formattedString = util.format('演示格式化: %s = %d', 'count', 42);
  console.log(`   📝 ${formattedString}`);
  
  // 演示path模块
  const path = require('path');
  const joinedPath = path.join('/scripts', 'demo', 'file.js');
  console.log(`   📁 路径拼接: ${joinedPath}`);
}

/**
 * 演示网络请求
 */
async function demonstrateNetworkRequests(http, config, proxy) {
  console.log('🌐 网络请求演示:');
  
  if (proxy) {
    console.log(`   📡 使用代理: ${proxy.type}://${proxy.host}:${proxy.port}`);
  } else {
    console.log('   🌍 直接网络连接');
  }
  
  try {
    // GET请求演示
    console.log('   📥 执行GET请求...');
    const getResponse = await http.get(`${config.apiEndpoint}/posts/1`);
    console.log(`   ✅ GET请求成功: ${getResponse.status} - ${getResponse.data.title?.substring(0, 30)}...`);
    
    // POST请求演示  
    console.log('   📤 执行POST请求...');
    const postData = {
      title: 'FourAir Demo Post',
      body: 'This is a demo post from FourAir script',
      userId: 1
    };
    
    const postResponse = await http.post(`${config.apiEndpoint}/posts`, postData);
    console.log(`   ✅ POST请求成功: ${postResponse.status} - ID: ${postResponse.data.id}`);
    
    // 带请求头的请求演示
    console.log('   📋 执行带请求头的请求...');
    const headersResponse = await http.get(`${config.apiEndpoint}/users/1`, {
      headers: {
        'User-Agent': 'FourAir-Script/2.0',
        'Accept': 'application/json'
      }
    });
    console.log(`   ✅ 带请求头请求成功: ${headersResponse.data.name}`);
    
  } catch (networkError) {
    console.log(`   ⚠️ 网络请求失败: ${networkError.message}`);
    // 继续执行，不中断整个流程
  }
}

/**
 * 演示密钥管理
 */
async function demonstrateSecrets(secrets) {
  console.log('🔑 密钥管理演示:');
  
  try {
    // 获取演示密钥
    const demoApiKey = await secrets.get('demoApiKey');
    const demoSecret = await secrets.get('demoSecret');
    
    console.log('   ✅ 成功获取演示API密钥');
    console.log('   ✅ 成功获取演示密钥');
    console.log('   🔒 密钥内容已隐藏，长度分别为:', demoApiKey?.length || 0, demoSecret?.length || 0);
    
  } catch (secretError) {
    console.log(`   ⚠️ 密钥获取失败: ${secretError.message}`);
  }
}

/**
 * 批处理钱包
 */
async function processWalletsInBatches(wallets, config, utils) {
  console.log('👛 钱包批处理演示:');
  console.log(`   📊 总钱包数: ${wallets.length}, 批大小: ${config.batchSize}`);
  
  const results = [];
  let successCount = 0;
  let failCount = 0;
  
  // 按批次处理钱包
  for (let i = 0; i < wallets.length; i += config.batchSize) {
    const batch = wallets.slice(i, i + config.batchSize);
    const batchNumber = Math.floor(i / config.batchSize) + 1;
    const totalBatches = Math.ceil(wallets.length / config.batchSize);
    
    console.log(`   📦 处理批次 ${batchNumber}/${totalBatches}: ${batch.length} 个钱包`);
    
    // 并发处理批次中的钱包
    const batchPromises = batch.map((wallet, index) => 
      processSingleWallet(wallet, i + index + 1, wallets.length, config)
    );
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    // 统计批次结果
    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
        if (result.value.success) {
          successCount++;
        } else {
          failCount++;
        }
      } else {
        results.push({ 
          success: false, 
          error: result.reason?.message || '未知错误',
          wallet: 'unknown'
        });
        failCount++;
      }
    }
    
    // 批次间延时
    if (i + config.batchSize < wallets.length) {
      console.log(`   ⏳ 批次间延时 ${config.delayMs}ms...`);
      await utils.delay(config.delayMs);
    }
  }
  
  console.log(`   📊 处理完成: ${successCount} 成功, ${failCount} 失败`);
  return { results, successCount, failCount };
}

/**
 * 处理单个钱包
 */
async function processSingleWallet(wallet, index, total, config) {
  try {
    console.log(`   📝 处理钱包 ${index}/${total}: ${wallet.name || '未命名'} (${wallet.address})`);
    
    // 模拟钱包处理逻辑
    const processingTime = Math.random() * 1000 + 500; // 0.5-1.5秒随机处理时间
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // 模拟处理结果
    const mockBalance = (Math.random() * 10).toFixed(4);
    const mockTransactionCount = Math.floor(Math.random() * 100);
    
    // 根据配置决定处理深度
    const result = {
      wallet: wallet.address,
      name: wallet.name,
      balance: `${mockBalance} ETH`,
      transactionCount: mockTransactionCount,
      processingTime: Math.round(processingTime),
      success: true
    };
    
    if (config.enableAdvancedFeatures) {
      result.advanced = {
        lastActivity: new Date(Date.now() - Math.random() * 86400000).toISOString(),
        riskScore: Math.random() * 100,
        categories: ['DeFi', 'NFT', 'Gaming'][Math.floor(Math.random() * 3)]
      };
    }
    
    // 显示进度
    const progress = Math.round((index / total) * 100);
    console.log(`   ✅ ${wallet.name || wallet.address.substring(0, 8)}: ${mockBalance} ETH, ${mockTransactionCount} 笔交易 [${progress}%]`);
    
    return result;
    
  } catch (error) {
    console.log(`   ❌ 处理失败 ${wallet.address}: ${error.message}`);
    return {
      wallet: wallet.address,
      name: wallet.name,
      error: error.message,
      success: false
    };
  }
}

/**
 * 生成执行摘要
 */
async function generateExecutionSummary(processResults, storage, executionId) {
  console.log('📊 生成执行摘要:');
  
  const endTime = Date.now();
  const startTime = storage.getItem('lastExecutionTime');
  const duration = endTime - startTime;
  
  const summary = {
    executionId,
    duration: Math.round(duration / 1000), // 转换为秒
    totalWallets: processResults.results.length,
    successCount: processResults.successCount,
    failCount: processResults.failCount,
    successRate: Math.round((processResults.successCount / processResults.results.length) * 100),
    timestamp: new Date().toISOString()
  };
  
  // 更新存储中的执行记录
  const executionHistory = storage.getItem('executionHistory') || [];
  const currentExecution = executionHistory.find(exec => exec.executionId === executionId);
  if (currentExecution) {
    currentExecution.status = 'completed';
    currentExecution.endTime = endTime;
    currentExecution.summary = summary;
    storage.setItem('executionHistory', executionHistory);
  }
  
  console.log(`   ⏱️  执行时长: ${summary.duration} 秒`);
  console.log(`   📈 成功率: ${summary.successRate}%`);
  console.log(`   🎯 总处理: ${summary.totalWallets} 个钱包`);
  
  return summary;
}

/**
 * 处理执行错误
 */
async function handleExecutionError(error, storage, executionId) {
  console.log('🚨 错误处理流程:');
  
  // 更新执行状态
  const executionHistory = storage.getItem('executionHistory') || [];
  const currentExecution = executionHistory.find(exec => exec.executionId === executionId);
  if (currentExecution) {
    currentExecution.status = 'failed';
    currentExecution.error = error.message;
    currentExecution.endTime = Date.now();
    storage.setItem('executionHistory', executionHistory);
  }
  
  // 错误分类处理
  if (error.name === 'ValidationError') {
    console.log(`   📋 参数验证错误: ${error.message}`);
  } else if (error.name === 'NetworkError') {
    console.log(`   🌐 网络请求错误: ${error.message}`);
  } else {
    console.log(`   ❓ 未知错误类型: ${error.message}`);
  }
  
  // 保存错误信息以供调试
  storage.setItem('lastError', {
    message: error.message,
    name: error.name,
    timestamp: Date.now(),
    executionId
  });
}

/**
 * 清理资源
 */
async function cleanupResources(storage, executionId) {
  console.log('🧹 资源清理:');
  
  // 清理当前执行相关的临时数据
  storage.removeItem('currentExecutionId');
  
  // 检查存储使用情况
  const storageKeys = ['executionHistory', 'executionCounter', 'lastError'];
  let totalItems = 0;
  
  storageKeys.forEach(key => {
    const item = storage.getItem(key);
    if (item) totalItems++;
  });
  
  console.log(`   📦 存储项目: ${totalItems} 个`);
  console.log(`   🗑️  临时数据已清理`);
  console.log('   ✨ 资源清理完成');
}

// ==================== 本地测试代码 ====================
/**
 * 生成测试Context对象
 */
function generateTestContext() {
  return {
    scriptId: "comprehensive_demo_v2",
    executionId: "test_exec_" + Date.now(),
    wallets: [
      { 
        id: "wallet_1", 
        address: "0x1234567890123456789012345678901234567890", 
        name: "测试钱包1" 
      },
      { 
        id: "wallet_2", 
        address: "0x2345678901234567890123456789012345678901", 
        name: "测试钱包2" 
      },
      { 
        id: "wallet_3", 
        address: "0x3456789012345678901234567890123456789012", 
        name: "测试钱包3" 
      }
    ],
    config: {
      apiEndpoint: "https://jsonplaceholder.typicode.com",
      batchSize: 2,
      delayMs: 1000,
      description: "本地测试执行",
      enableAdvancedFeatures: true,
      verboseLogging: true,
      operationMode: "demo",
      networkType: "testnet"
    },
    proxy: null, // 测试时不使用代理
    utils: {
      delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
      logger: {
        info: (msg) => console.log(`[INFO] ${msg}`),
        success: (msg) => console.log(`[SUCCESS] ${msg}`),
        warn: (msg) => console.log(`[WARN] ${msg}`),
        error: (msg) => console.log(`[ERROR] ${msg}`)
      }
    },
    storage: {
      _data: {},
      setItem: function(k, v) { this._data[k] = v; },
      getItem: function(k) { return this._data[k]; },
      removeItem: function(k) { delete this._data[k]; },
      clear: function() { this._data = {}; }
    },
    secrets: {
      get: async (key) => `test_secret_${key}_${Math.random().toString(36).substring(2, 8)}`
    },
    http: require('axios'), // 在实际环境中这会是配置好代理的axios实例
    onStop: null
  };
}

// 本地测试入口
if (require.main === module) {
  console.log('🧪 本地测试模式');
  console.log('================');
  
  (async () => {
    try {
      const testContext = generateTestContext();
      console.log('🔧 测试Context已生成');
      console.log(`📋 测试钱包数量: ${testContext.wallets.length}`);
      console.log(`⚙️  测试配置: ${JSON.stringify(testContext.config, null, 2)}`);
      console.log('================');
      
      const result = await main(testContext);
      
      console.log('================');
      console.log('🎉 本地测试完成！');
      console.log('📊 测试结果:', JSON.stringify(result, null, 2));
      
    } catch (error) {
      console.error('💥 本地测试失败:', error.message);
      console.error('📍 错误堆栈:', error.stack);
    }
  })();
}

// ==================== 模块导出 ====================
module.exports = {
  getConfig,
  main
}; 