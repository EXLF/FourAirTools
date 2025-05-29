console.log('This is sample script version 1!');

function greet(name) {
  console.log(`Hello, ${name}! This is version 1.`);
}

greet('User');

function getConfig() {
  return {
    id: "sample_script", // 与 manifest 中的 id 一致
    name: "示例脚本V1",
    description: "一个简单的示例脚本，演示基本功能。",
    version: "1.0.0",
    author: "TestUser",
    category: "示例",
    icon: "code", // FontAwesome 图标
    requires: {
      wallets: false,
      proxy: false
    },
    platforms: ["all"],
    config: {
      message: {
        type: "text",
        label: "显示消息",
        default: "Hello from Sample Script V1!",
        placeholder: "输入要显示的消息"
      }
    }
  };
}

function main(context) {
  const { config, utils } = context;
  const message = config.message || 'Default message: Sample Script V1 executed!';
  
  console.log(`[Sample Script V1] Executing with message: "${message}"`);
  utils.logToUI(`示例脚本V1: ${message}`);
  
  // 模拟一些操作
  return new Promise(resolve => {
    setTimeout(() => {
      console.log("[Sample Script V1] Finished execution.");
      resolve({ success: true, data: `Message shown: ${message}` });
    }, 1000);
  });
}

module.exports = { getConfig, main }; 
// // 如果在 Node.js 环境直接运行，需要这个
// 在 Electron 脚本引擎中，通常不需要显式导出，引擎会查找这些函数 