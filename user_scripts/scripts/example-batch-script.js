/**
 * 示例批量执行脚本
 * 展示如何创建支持批量执行的脚本
 */

/**
 * 获取脚本配置
 * @returns {Object} 脚本配置对象
 */
function getConfig() {
    return {
        name: "示例批量脚本",
        description: "这是一个支持批量执行的示例脚本",
        version: "1.0.0",
        author: "FourAir",
        category: "示例",
        status: "active",
        // 关键配置：表明此脚本支持批量执行
        supportsBatchExecution: true,
        // 脚本执行所需参数
        params: {
            delay: {
                type: "number",
                label: "账户间延迟(秒)",
                description: "每个账户执行之间的延迟时间",
                default: 5,
                min: 1,
                max: 300
            },
            siteUrl: {
                type: "string",
                label: "目标网址",
                description: "要访问的网站URL",
                default: "https://example.com"
            },
            // 更多参数...
        },
        // 脚本图标或预览图
        imageUrl: "https://public.rootdata.com/images/b44/1724770395787.png"
    };
}

/**
 * 批量脚本主执行函数
 * @param {Object} context 执行上下文
 * @param {Object} context.wallet 钱包对象
 * @param {Object} context.params 脚本参数
 * @param {Object} context.utils 工具函数集
 * @param {Object} context.logger 日志记录器
 * @returns {Promise<Object>} 执行结果
 */
async function main(context) {
    const { wallet, params, utils, logger } = context;
    
    // 记录开始执行
    logger.info(`开始执行批量脚本 - 钱包地址: ${wallet.address}`);
    logger.info(`参数配置: 延迟=${params.delay}秒, 目标网址=${params.siteUrl}`);
    
    // 实际执行逻辑
    try {
        // 模拟某些操作
        logger.info("步骤1：初始化...");
        await utils.sleep(1000); // 等待1秒
        
        logger.info("步骤2：连接网络...");
        await utils.sleep(2000); // 等待2秒
        
        // 调用外部API示例
        if (utils.http) {
            logger.info(`尝试访问: ${params.siteUrl}`);
            try {
                const response = await utils.http.get(params.siteUrl);
                logger.info(`网站访问成功，状态码: ${response.status}`);
            } catch (apiError) {
                logger.error(`访问API失败: ${apiError.message}`);
            }
        }
        
        // 模拟执行成功
        logger.success("脚本执行完成!");
        
        return {
            success: true,
            message: "示例批量脚本执行成功",
            data: {
                executionTime: new Date().toISOString(),
                wallet: wallet.address
            }
        };
    } catch (error) {
        // 记录错误
        logger.error(`脚本执行失败: ${error.message}`);
        
        // 返回失败结果
        return {
            success: false,
            error: error.message,
            message: "示例批量脚本执行失败"
        };
    }
}

// 导出函数
module.exports = {
    getConfig,
    main
}; 