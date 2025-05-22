// demo_print_config.js - 演示脚本：打印传入的账户和代理信息

function getConfig() {
    return {
        id: 'demo-print-config',
        name: 'Demo 打印配置',
        description: '打印传入的账户和代理信息',
        // 脚本声明无需额外模块
        requiredModules: []
    };
}

/**
 * 脚本主入口
 * @param {Object} context - 执行上下文，包含 wallets, proxy 等信息
 */
async function main(context) {
    // 打印接收到的账户列表
    console.log('Demo 脚本：接收到的账户列表：', context.wallets);
    // 打印接收到的代理信息
    console.log('Demo 脚本：接收到的代理信息：', context.proxy);

    // 返回给前端或日志查看
    return {
        receivedWallets: context.wallets,
        receivedProxy: context.proxy
    };
}

// 导出接口
module.exports = {
    getConfig,
    main
}; 