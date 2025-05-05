/**
 * 简单的打印123示例脚本
 */
module.exports = {
  // 脚本元数据
  metadata: {
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
  },
  
  // 执行函数
  async execute(wallets, config, utils) {
    const { logger } = utils;
    
    logger.info("开始执行打印123脚本");
    
    try {
      const delay = config.delay || 2;
      const count = config.count || 3;
      
      logger.info(`设置延迟: ${delay}秒`);
      logger.info(`设置循环次数: ${count}次`);
      
      // 循环打印
      for (let i = 1; i <= count; i++) {
        logger.info(`第 ${i} 次打印: 123`);
        
        // 等待指定时间
        if (i < count) {
          logger.info(`等待 ${delay} 秒...`);
          await new Promise(resolve => setTimeout(resolve, delay * 1000));
        }
      }
      
      logger.success("脚本执行成功");
      return { success: true };
    } catch (error) {
      logger.error(`脚本执行失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}; 