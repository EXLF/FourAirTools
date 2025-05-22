/**
 * 简单测试脚本
 * 用于测试批量脚本模块
 */

// 导出配置函数
exports.getConfig = function() {
    return {
        id: 'simple-test',
        name: '简单测试脚本',
        description: '最简单的测试脚本',
        icon: 'fas fa-check',
        category: '测试工具'
    };
};

// 导出主函数
exports.main = async function(context) {
    console.log('===== 简单测试脚本开始执行 =====');
    console.log('收到的context对象:', Object.keys(context));
    
    if (context.wallets && context.wallets.length > 0) {
        console.log(`收到 ${context.wallets.length} 个钱包`);
        context.wallets.forEach((wallet, index) => {
            console.log(`钱包 ${index + 1}: ${wallet.address}`);
        });
    } else {
        console.log('没有选择任何钱包');
    }
    
    if (context.proxy) {
        console.log('代理配置:', JSON.stringify(context.proxy));
    } else {
        console.log('未使用代理');
    }
    
    console.log('===== 简单测试脚本执行完成 =====');
    
    return {
        success: true,
        message: '测试成功'
    };
}; 