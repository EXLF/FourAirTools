/**
 * 更新现有商品的图片字段
 */

const { db } = require('./index.js');

function updateProductImages() {
    console.log('开始更新商品图片字段...');
    
    // 更新所有现有商品的图片字段
    const updateSQL = `
        UPDATE shop_products 
        SET image_url = 'src/assets/icons/default.svg', 
            updated_at = datetime('now')
        WHERE image_url IS NULL OR image_url = ''
    `;
    
    db.run(updateSQL, (err) => {
        if (err) {
            console.error('更新商品图片字段失败:', err.message);
        } else {
            console.log('商品图片字段更新完成！');
            
            // 验证更新结果
            db.all('SELECT id, name, image_url FROM shop_products', (err, products) => {
                if (err) {
                    console.error('查询商品失败:', err.message);
                } else {
                    console.log('当前商品列表:');
                    products.forEach(product => {
                        console.log(`- ${product.name}: ${product.image_url || '无图片'}`);
                    });
                }
            });
        }
    });
}

module.exports = {
    updateProductImages
}; 