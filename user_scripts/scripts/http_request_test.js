/**
 * HTTP请求测试脚本
 * 功能：发送HTTP请求获取API响应内容，测试网络连接和数据获取
 */

function getConfig() {
  return {
    id: "http_request_test",
    name: "HTTP请求测试",
    description: "发送HTTP请求获取API响应内容，支持自定义请求参数和头部",
    version: "1.0.0",
    author: "FourAir",
    category: "网络工具",
    icon: "globe",
    imageUrl: "https://public.rootdata.com/images/b6/1739179963586.jpg",
    requires: {
      wallets: false,   // 不需要钱包
      proxy: false      // 不强制需要代理
    },
    // 声明此脚本需要通过沙箱 require() 加载的模块
    requiredModules: ["axios", "https"],
    platforms: ["通用"],
    config: {
      requestUrl: {
        type: "text",
        label: "请求URL",
        placeholder: "输入要请求的URL地址",
        default: "https://httpbin.org/get",
        required: true
      },
      requestMethod: {
        type: "select",
        label: "请求方法",
        options: [
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "DELETE", label: "DELETE" }
        ],
        default: "GET"
      },
      customHeaders: {
        type: "textarea",
        label: "自定义请求头 (JSON格式)",
        placeholder: '{\n  "User-Agent": "Mozilla/5.0...",\n  "Referer": "https://example.com"\n}',
        default: JSON.stringify({
          "sec-ch-ua-platform": "\"Windows\"",
          "Referer": "https://console.brahma.fi/",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
          "sec-ch-ua": "\"Chromium\";v=\"136\", \"Google Chrome\";v=\"136\", \"Not.A/Brand\";v=\"99\"",
          "sec-ch-ua-mobile": "?0"
        }, null, 2)
      },
      requestBody: {
        type: "textarea",
        label: "请求体 (JSON格式，仅POST/PUT)",
        placeholder: '{\n  "key": "value"\n}',
        default: ""
      },
      timeout: {
        type: "number",
        label: "超时时间 (秒)",
        default: 30,
        min: 5,
        max: 300
      },
      maxRetries: {
        type: "number",
        label: "最大重试次数",
        default: 3,
        min: 0,
        max: 10
      },
      retryDelay: {
        type: "number",
        label: "重试间隔 (秒)",
        default: 2,
        min: 1,
        max: 30
      },
      showResponseHeaders: {
        type: "checkbox",
        label: "显示响应头信息",
        default: true
      },
      formatJson: {
        type: "checkbox",
        label: "格式化JSON响应",
        default: true
      }
    }
  };
}

async function execute(context) {
  const axios = require('axios');
  
  // 从context中提取参数
  const wallets = context.wallets || [];
  const config = context.config || {};
  
  // 获取配置参数，提供默认值
  const requestUrl = config.requestUrl || 'https://httpbin.org/get';
  const requestMethod = config.requestMethod || 'GET';
  const timeout = (config.timeout || 30) * 1000; // 转换为毫秒
  const maxRetries = config.maxRetries || 3;
  const retryDelay = (config.retryDelay || 2) * 1000;
  const showResponseHeaders = config.showResponseHeaders !== false;
  const formatJson = config.formatJson !== false;
  
  console.log('🌐 开始HTTP请求测试');
  console.log(`📋 请求配置:`);
  console.log(`   - URL: ${requestUrl}`);
  console.log(`   - 方法: ${requestMethod}`);
  console.log(`   - 超时: ${timeout/1000}秒`);
  console.log(`   - 最大重试: ${maxRetries}次`);
  
  // 如果使用默认配置，显示提示
  if (!config.requestUrl) {
    console.log(`ℹ️ 使用默认测试URL (httpbin.org): ${requestUrl}`);
    console.log(`ℹ️ httpbin.org 是一个专门用于HTTP测试的服务`);
  }
  
  // 解析自定义请求头
  let headers = {};
  if (config.customHeaders) {
    try {
      headers = JSON.parse(config.customHeaders);
      console.log(`   - 自定义请求头: ${Object.keys(headers).length}个`);
    } catch (error) {
      console.log(`⚠️ 自定义请求头JSON格式错误: ${error.message}`);
      headers = {};
    }
  }
  
  // 解析请求体
  let requestBody = null;
  if (config.requestBody && (requestMethod === 'POST' || requestMethod === 'PUT')) {
    try {
      requestBody = JSON.parse(config.requestBody);
      console.log(`   - 请求体: 已设置`);
    } catch (error) {
      console.log(`⚠️ 请求体JSON格式错误: ${error.message}`);
    }
  }
  
  // 配置axios请求选项
  const axiosConfig = {
    method: requestMethod.toLowerCase(),
    url: requestUrl,
    headers: headers,
    timeout: timeout,
    // 添加更多网络配置
    maxRedirects: 5,
    validateStatus: function (status) {
      // 接受所有状态码，我们手动处理
      return true;
    }
  };
  
  // 如果是HTTPS请求，添加SSL配置（在Node.js环境中）
  if (requestUrl.startsWith('https://')) {
    axiosConfig.httpsAgent = require('https').Agent({
      rejectUnauthorized: false, // 在测试环境中允许自签名证书
      keepAlive: true
    });
  }
  
  // 添加请求体（如果有）
  if (requestBody) {
    axiosConfig.data = requestBody;
    if (!headers['Content-Type']) {
      axiosConfig.headers['Content-Type'] = 'application/json';
    }
  }
  
  // 执行请求（带重试机制）
  let lastError = null;
  let response = null;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      console.log(`🚀 发送请求 (第${attempt}次尝试)...`);
      
      const startTime = Date.now();
      response = await axios(axiosConfig);
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      console.log(`✅ 请求成功! 耗时: ${duration}ms`);
      console.log(`📊 响应状态: ${response.status} ${response.statusText}`);
      
      // 显示响应头信息
      if (showResponseHeaders && response.headers) {
        console.log(`📋 响应头信息:`);
        Object.entries(response.headers).forEach(([key, value]) => {
          console.log(`   - ${key}: ${value}`);
        });
      }
      
      // 显示响应内容
      console.log(`📄 响应内容:`);
      
      if (response.data) {
        const contentType = response.headers['content-type'] || '';
        
        if (contentType.includes('application/json') && formatJson) {
          // JSON响应格式化显示
          try {
            const jsonData = typeof response.data === 'string' ? 
              JSON.parse(response.data) : response.data;
            console.log(JSON.stringify(jsonData, null, 2));
            
            // 如果是数组，显示数量信息
            if (Array.isArray(jsonData)) {
              console.log(`📊 数组长度: ${jsonData.length}`);
            } else if (typeof jsonData === 'object') {
              console.log(`📊 对象键数量: ${Object.keys(jsonData).length}`);
            }
          } catch (parseError) {
            console.log(`原始响应: ${response.data}`);
          }
        } else {
          // 非JSON响应或不格式化
          const dataStr = typeof response.data === 'string' ? 
            response.data : JSON.stringify(response.data);
          
          // 限制显示长度，避免日志过长
          if (dataStr.length > 2000) {
            console.log(`${dataStr.substring(0, 2000)}...\n[响应内容过长，已截断。完整长度: ${dataStr.length}字符]`);
          } else {
            console.log(dataStr);
          }
        }
      } else {
        console.log('(空响应)');
      }
      
      // 请求成功，跳出重试循环
      break;
      
    } catch (error) {
      lastError = error;
      
      if (attempt <= maxRetries) {
        console.log(`❌ 请求失败 (第${attempt}次尝试): ${error.message}`);
        console.log(`⏳ ${retryDelay/1000}秒后重试...`);
        await context.utils.delay(retryDelay);
      } else {
        console.log(`❌ 请求最终失败: ${error.message}`);
        
        // 显示详细错误信息
        if (error.response) {
          console.log(`📊 错误状态: ${error.response.status} ${error.response.statusText}`);
          if (error.response.data) {
            console.log(`📄 错误响应: ${JSON.stringify(error.response.data, null, 2)}`);
          }
        } else if (error.request) {
          console.log(`�� 网络错误: 无法连接到服务器`);
          console.log(`🔍 错误详情: ${error.code || error.message}`);
          
          // 提供网络诊断建议
          if (error.code === 'ECONNRESET') {
            console.log(`💡 诊断建议: 连接被重置，可能原因:`);
            console.log(`   - 目标服务器拒绝连接`);
            console.log(`   - 网络防火墙阻止连接`);
            console.log(`   - SSL/TLS握手失败`);
            console.log(`   - 代理服务器问题`);
          } else if (error.code === 'ENOTFOUND') {
            console.log(`💡 诊断建议: DNS解析失败，请检查:`);
            console.log(`   - 网络连接是否正常`);
            console.log(`   - DNS服务器设置`);
            console.log(`   - URL地址是否正确`);
          } else if (error.code === 'ETIMEDOUT') {
            console.log(`💡 诊断建议: 连接超时，可能原因:`);
            console.log(`   - 网络延迟过高`);
            console.log(`   - 目标服务器响应慢`);
            console.log(`   - 防火墙阻止连接`);
          }
        } else {
          console.log(`⚙️ 配置错误: ${error.message}`);
        }
      }
    }
  }
  
  // 总结
  if (response && response.status >= 200 && response.status < 300) {
    console.log(`🎉 HTTP请求测试完成 - 成功`);
    console.log(`✅ 状态码: ${response.status}`);
    console.log(`📏 响应大小: ${JSON.stringify(response.data).length} 字符`);
  } else {
    console.log(`💥 HTTP请求测试完成 - 失败`);
    if (response) {
      console.log(`❌ 最终状态码: ${response.status}`);
    }
    throw lastError || new Error('请求失败');
  }
  
  return {
    success: true,
    data: {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      data: response.data,
      url: requestUrl,
      method: requestMethod
    }
  };
}

// 导出接口
module.exports = {
  getConfig,
  main: execute  // 脚本引擎期望main函数
}; 