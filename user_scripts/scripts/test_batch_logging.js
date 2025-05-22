/**
 * 日志测试脚本
 * 用于测试批量脚本模块的日志系统
 */

exports.getConfig = function() {
    return {
        id: 'test-batch-logging',
        name: '日志系统测试脚本',
        description: '测试批量脚本模块的日志显示功能',
        icon: 'fas fa-vial',
        category: '测试工具',
        requiredModules: []
    };
};

exports.main = async function(context) {
    const { wallets, config, proxy, utils } = context;
    
    console.log('========== 开始日志系统测试 ==========');
    
    // 测试各种日志级别
    console.log('📝 这是一条普通日志消息 (INFO)');
    console.info('ℹ️ 这是一条信息日志消息 (INFO)');
    console.warn('⚠️ 这是一条警告日志消息 (WARNING)');
    console.error('❌ 这是一条错误日志消息 (ERROR)');
    
    // 测试中文字符
    console.log('🇨🇳 测试中文字符输出：你好世界！');
    console.log('📚 测试专业术语：脚本执行、钱包地址、代理配置、初始化完成');
    
    // 测试特殊符号
    console.log('🎯 测试特殊符号：♠♥♦♣ ★☆○● ←↑→↓');
    
    // 测试表情符号
    console.log('😀 测试表情：😊😎🤔💪👍🎉✨🚀');
    
    // 测试钱包信息
    if (wallets && wallets.length > 0) {
        console.log(`💼 收到 ${wallets.length} 个钱包账户`);
        wallets.forEach((wallet, index) => {
            console.log(`  📋 钱包 ${index + 1}: ${wallet.name || '未命名'} - ${wallet.address}`);
        });
    } else {
        console.log('📭 没有选择任何钱包');
    }
    
    // 测试代理信息
    if (proxy) {
        console.log(`🌐 代理配置: ${proxy.protocol}://${proxy.host}:${proxy.port}`);
    } else {
        console.log('🚫 未使用代理');
    }
    
    // 测试延时日志
    console.log('⏱️ 将在1秒后显示下一条日志...');
    await utils.delay(1000);
    console.log('⏰ 1秒延时完成！');
    
    // 测试JSON格式输出
    console.log('📊 测试JSON数据输出:', {
        timestamp: new Date().toISOString(),
        config: config,
        walletsCount: wallets?.length || 0,
        proxyEnabled: !!proxy
    });
    
    // 测试长文本
    console.log('📜 测试长文本输出: ' + 'A'.repeat(50) + '...' + 'Z'.repeat(50));
    
    // 测试多行文本
    console.log(`📄 测试多行文本:
    第一行
    第二行
    第三行`);
    
    console.log('========== 日志系统测试完成 ==========');
    
    return {
        success: true,
        message: '日志测试脚本执行完成',
        timestamp: new Date().toISOString()
    };
}; 