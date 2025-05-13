/**
 * 简单的打印123示例脚本
 */
function getConfig() {
  return {
    id: "print123",
    name: "打印123",
    description: "简单的测试脚本，用于打印数字123",
    version: "1.0.0",
    author: "FourAir",
    category: "测试",
    icon: "code",  // FontAwesome图标
    requires: {
      wallets: false,  // 不需要钱包
      proxy: false     // 不需要代理
    },
    platforms: [],
    config: {
      delay: {
        type: "number",
        label: "延迟(秒)",
        default: 2,
        min: 1,
        max: 10
      },
      count: {
        type: "number",
        label: "循环次数",
        default: 3,
        min: 1,
        max: 10
      }
    }
  };
}

// 执行函数
async function main(context) {
  const { config, utils } = context;
  
  console.info("开始执行打印123脚本");
  
  try {
    const delaySeconds = config.delay || 2;
    const count = config.count || 3;
    
    console.info(`设置延迟: ${delaySeconds}秒`);
    console.info(`设置循环次数: ${count}次`);
    
    // 循环打印
    for (let i = 1; i <= count; i++) {
      console.info(`第 ${i} 次打印: 123`);
      
      // 等待指定时间
      if (i < count) {
        console.info(`等待 ${delaySeconds} 秒...`);
        await utils.delay(delaySeconds * 1000);
      }
    }
    
    console.success("脚本执行成功");
    return { success: true };
  } catch (error) {
    console.error(`脚本执行失败: ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = { getConfig, main }; 