/**
 * 清理商店测试数据
 */

const { db } = require('./index.js');

function clearShopData() {
    console.log('开始清理商店测试数据...');
    
    // 清理订单明细
    db.run('DELETE FROM shop_order_items', (err) => {
        if (err) {
            console.error('清理订单明细失败:', err.message);
        } else {
            console.log('订单明细数据已清理');
        }
    });
    
    // 清理订单
    db.run('DELETE FROM shop_orders', (err) => {
        if (err) {
            console.error('清理订单失败:', err.message);
        } else {
            console.log('订单数据已清理');
        }
    });
    
    // 清理商品
    db.run('DELETE FROM shop_products', (err) => {
        if (err) {
            console.error('清理商品失败:', err.message);
        } else {
            console.log('商品数据已清理');
            
            // 验证清理结果
            db.get('SELECT COUNT(*) as count FROM shop_products', (err, result) => {
                if (err) {
                    console.error('验证清理结果失败:', err.message);
                } else {
                    console.log(`商品表剩余数据: ${result.count} 条`);
                }
            });
        }
    });
    
    console.log('商店测试数据清理完成！');
}

module.exports = {
    clearShopData
}; 