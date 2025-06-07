/**
 * 插入商店测试数据
 */

const db = require('./index.js');

function insertTestProducts() {
    console.log('开始插入商店测试数据...');
    
    // 测试商品数据
    const products = [
        {
            category_id: 1,
            name: '美国高匿IP代理 (1天)',
            description: '美国高匿名IP代理，支持HTTP/HTTPS/SOCKS5协议，99.9%稳定性保证',
            price: 15.00,
            stock_quantity: 100,
            is_digital: 1,
            product_type: 'ip_proxy',
            image_url: 'src/assets/icons/default.svg',
            product_data: JSON.stringify({
                is_hot: true,
                is_new: false,
                is_promo: false,
                features: ['HTTP/HTTPS/SOCKS5支持', '99.9%稳定性', '24小时有效期', '无限带宽'],
                specifications: ['地区: 美国', '协议: HTTP/HTTPS/SOCKS5', '有效期: 1天', '并发: 无限制'],
                delivery_info: '购买后5分钟内自动发货'
            })
        },
        {
            category_id: 2,
            name: 'Twitter白号 - 高质量',
            description: '注册时间超过1年的Twitter白号，无任何违规记录，安全可靠',
            price: 25.00,
            stock_quantity: 200,
            is_digital: 1,
            product_type: 'twitter_account',
            image_url: 'src/assets/icons/default.svg',
            product_data: JSON.stringify({
                is_hot: false,
                is_new: false,
                is_promo: false,
                features: ['注册1年+', '无违规记录', '已验证邮箱', '随机头像昵称'],
                specifications: ['注册时长: 1年+', '粉丝数: 0-10', '状态: 正常', '验证: 邮箱已验证'],
                delivery_info: '购买后1小时内发货'
            })
        },
        {
            category_id: 2,
            name: 'Twitter老号有粉丝',
            description: '注册3年以上的Twitter老号，500-2000粉丝，活跃度高',
            price: 180.00,
            stock_quantity: 30,
            is_digital: 1,
            product_type: 'twitter_account',
            image_url: 'src/assets/icons/default.svg',
            product_data: JSON.stringify({
                is_hot: true,
                is_new: false,
                is_promo: false,
                features: ['注册3年+', '500-2000粉丝', '活跃度高', '真实互动'],
                specifications: ['注册时长: 3年+', '粉丝数: 500-2000', '状态: 活跃', '互动: 真实'],
                delivery_info: '购买后24小时内发货'
            })
        },
        {
            category_id: 5,
            name: 'VMLogin指纹浏览器 - 1个月',
            description: '专业指纹浏览器，支持多环境管理，防关联检测，撸毛必备',
            price: 120.00,
            stock_quantity: 20,
            is_digital: 1,
            product_type: 'tool',
            image_url: 'src/assets/icons/default.svg',
            product_data: JSON.stringify({
                is_hot: true,
                is_new: false,
                is_promo: false,
                features: ['防指纹检测', '多环境管理', '代理集成', '自动化支持'],
                specifications: ['有效期: 1个月', '环境数: 100个', '系统: Windows/Mac', '支持: 技术支持'],
                delivery_info: '购买后立即发送激活码'
            })
        }
    ];
    
    // 插入商品数据
    const insertSQL = `
        INSERT OR IGNORE INTO shop_products (
            category_id, name, description, price, stock_quantity, 
            is_digital, product_type, product_data, image_url, is_active,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
    `;
    
    db.db.serialize(() => {
        const stmt = db.db.prepare(insertSQL);
        
        products.forEach((product, index) => {
            stmt.run([
                product.category_id,
                product.name,
                product.description,
                product.price,
                product.stock_quantity,
                product.is_digital,
                product.product_type,
                product.product_data,
                product.image_url
            ], (err) => {
                if (err && !err.message.includes('UNIQUE constraint failed')) {
                    console.error(`插入商品 ${product.name} 失败:`, err.message);
                } else {
                    console.log(`商品 ${product.name} 插入成功`);
                }
            });
        });
        
        stmt.finalize((err) => {
            if (err) {
                console.error('完成商品插入时出错:', err);
            } else {
                console.log('商店测试数据插入完成！');
            }
        });
    });
}

module.exports = {
    insertTestProducts
}; 