/**
 * 商店相关的IPC处理器
 * 处理前端与数据库的通信
 */

const { ipcMain } = require('electron');
const { db } = require('../db/index.js');

/**
 * 初始化数据库连接
 */
function initDatabase() {
    try {
        // 使用项目现有的数据库连接
        console.log('商店数据库连接成功 - 使用现有连接');
        return true;
    } catch (error) {
        console.error('商店数据库连接失败:', error);
        return false;
    }
}

/**
 * 注册商店相关的IPC处理器
 */
function registerShopHandlers() {
    if (!initDatabase()) {
        console.error('无法初始化商店数据库');
        return;
    }

    // 获取商品分类
    ipcMain.handle('shop:getCategories', async () => {
        try {
            return new Promise((resolve, reject) => {
                db.all(`
                    SELECT id, name, description, icon, sort_order, is_active, created_at, updated_at
                    FROM shop_categories
                    WHERE is_active = 1
                    ORDER BY sort_order ASC
                `, [], (err, categories) => {
                    if (err) {
                        console.error('获取商品分类失败:', err);
                        resolve({ success: false, error: err.message });
                    } else {
                        resolve({ success: true, data: categories || [] });
                    }
                });
            });
        } catch (error) {
            console.error('获取商品分类失败:', error);
            return { success: false, error: error.message };
        }
    });

    // 获取商品列表
    ipcMain.handle('shop:getProducts', async (event, params = {}) => {
        try {
            const {
                category,
                search = '',
                sort = 'newest',
                page = 1,
                pageSize = 12
            } = params;

            return new Promise((resolve, reject) => {
                let whereConditions = ['p.is_active = 1'];
                let queryParams = [];

                // 分类筛选
                if (category && category !== 'all') {
                    whereConditions.push('p.category_id = ?');
                    queryParams.push(parseInt(category));
                }

                // 搜索筛选
                if (search) {
                    whereConditions.push('(p.name LIKE ? OR p.description LIKE ? OR c.name LIKE ?)');
                    const searchPattern = `%${search}%`;
                    queryParams.push(searchPattern, searchPattern, searchPattern);
                }

                // 构建排序
                let orderBy = 'p.created_at DESC';
                switch (sort) {
                    case 'price-low':
                        orderBy = 'p.price ASC';
                        break;
                    case 'price-high':
                        orderBy = 'p.price DESC';
                        break;
                    case 'popular':
                        orderBy = 'p.stock_quantity DESC';  // 简化排序，因为JSON_EXTRACT在sqlite3中可能有兼容性问题
                        break;
                    case 'newest':
                    default:
                        orderBy = 'p.created_at DESC';
                        break;
                }

                // 先计算总数
                const countQuery = `
                    SELECT COUNT(*) as total
                    FROM shop_products p
                    LEFT JOIN shop_categories c ON p.category_id = c.id
                    WHERE ${whereConditions.join(' AND ')}
                `;
                
                db.get(countQuery, queryParams, (err, totalResult) => {
                    if (err) {
                        console.error('获取商品总数失败:', err);
                        resolve({ success: false, error: err.message });
                        return;
                    }

                    const totalCount = totalResult ? totalResult.total : 0;

                    // 获取分页数据
                    const offset = (page - 1) * pageSize;
                    const dataQuery = `
                        SELECT 
                            p.id, p.category_id, p.name, p.description, p.price, 
                            p.stock_quantity, p.is_digital, p.product_type, 
                            p.product_data, p.image_url, p.is_active,
                            p.created_at, p.updated_at,
                            c.name as category_name
                        FROM shop_products p
                        LEFT JOIN shop_categories c ON p.category_id = c.id
                        WHERE ${whereConditions.join(' AND ')}
                        ORDER BY ${orderBy}
                        LIMIT ? OFFSET ?
                    `;
                    
                    const finalParams = [...queryParams, pageSize, offset];
                    
                    db.all(dataQuery, finalParams, (err, products) => {
                        if (err) {
                            console.error('获取商品数据失败:', err);
                            resolve({ success: false, error: err.message });
                            return;
                        }

                        resolve({
                            success: true,
                            data: {
                                products: products || [],
                                totalCount,
                                pagination: {
                                    currentPage: page,
                                    pageSize,
                                    totalPages: Math.ceil(totalCount / pageSize),
                                    total: totalCount
                                }
                            }
                        });
                    });
                });
            });
        } catch (error) {
            console.error('获取商品列表失败:', error);
            return { success: false, error: error.message };
        }
    });

    // 获取单个商品详情
    ipcMain.handle('shop:getProduct', async (event, productId) => {
        try {
            return new Promise((resolve, reject) => {
                db.get(`
                    SELECT 
                        p.id, p.category_id, p.name, p.description, p.price, 
                        p.stock_quantity, p.is_digital, p.product_type, 
                        p.product_data, p.image_url, p.is_active,
                        p.created_at, p.updated_at,
                        c.name as category_name
                    FROM shop_products p
                    LEFT JOIN shop_categories c ON p.category_id = c.id
                    WHERE p.id = ? AND p.is_active = 1
                `, [productId], (err, product) => {
                    if (err) {
                        console.error('获取商品详情失败:', err);
                        resolve({ success: false, error: err.message });
                    } else if (!product) {
                        resolve({ success: false, error: '商品不存在' });
                    } else {
                        resolve({ success: true, data: product });
                    }
                });
            });
        } catch (error) {
            console.error('获取商品详情失败:', error);
            return { success: false, error: error.message };
        }
    });

    // 创建订单
    ipcMain.handle('shop:createOrder', async (event, orderData) => {
        try {
            const {
                productId,
                quantity = 1,
                contactInfo,
                notes = '',
                userId
            } = orderData;

            return new Promise((resolve, reject) => {
                // 首先验证商品
                db.get(`
                    SELECT id, name, price, stock_quantity, is_active
                    FROM shop_products
                    WHERE id = ? AND is_active = 1
                `, [productId], (err, product) => {
                    if (err) {
                        console.error('验证商品失败:', err);
                        resolve({ success: false, error: err.message });
                        return;
                    }

                    if (!product) {
                        resolve({ success: false, error: '商品不存在' });
                        return;
                    }

                    if (product.stock_quantity < quantity) {
                        resolve({ success: false, error: '库存不足' });
                        return;
                    }

                    // 计算订单金额
                    const unitPrice = parseFloat(product.price);
                    const totalAmount = unitPrice * quantity;

                    // 生成订单号
                    const orderNo = generateOrderNo();

                    // 创建订单（简化版，不使用事务）
                    db.run(`
                        INSERT INTO shop_orders (
                            user_id, order_no, total_amount, status, 
                            payment_status, notes, created_at, updated_at
                        ) VALUES (?, ?, ?, 'pending', 'unpaid', ?, datetime('now'), datetime('now'))
                    `, [userId, orderNo, totalAmount, notes], function(err) {
                        if (err) {
                            console.error('创建订单失败:', err);
                            resolve({ success: false, error: err.message });
                            return;
                        }

                        const orderId = this.lastID;

                        // 创建订单明细
                        db.run(`
                            INSERT INTO shop_order_items (
                                order_id, product_id, product_name, product_price, 
                                quantity, subtotal, delivery_status, created_at
                            ) VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
                        `, [orderId, productId, product.name, unitPrice, quantity, totalAmount], (err) => {
                            if (err) {
                                console.error('创建订单明细失败:', err);
                                resolve({ success: false, error: err.message });
                                return;
                            }

                            // 更新库存
                            db.run(`
                                UPDATE shop_products 
                                SET stock_quantity = stock_quantity - ?, updated_at = datetime('now')
                                WHERE id = ?
                            `, [quantity, productId], (err) => {
                                if (err) {
                                    console.error('更新库存失败:', err);
                                    resolve({ success: false, error: err.message });
                                    return;
                                }

                                console.log('订单创建成功:', orderNo);
                                resolve({
                                    success: true,
                                    orderId,
                                    orderNo,
                                    totalAmount
                                });
                            });
                        });
                    });
                });
            });
        } catch (error) {
            console.error('创建订单失败:', error);
            return { success: false, error: error.message };
        }
    });

    // 获取用户订单列表 (简化版)
    ipcMain.handle('shop:getUserOrders', async (event, params = {}) => {
        try {
            const { userId } = params;
            
            return new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        id, user_id, order_no, total_amount, status, 
                        payment_method, payment_status, notes, 
                        created_at, updated_at
                    FROM shop_orders
                    WHERE user_id = ?
                    ORDER BY created_at DESC
                    LIMIT 50
                `, [userId], (err, orders) => {
                    if (err) {
                        console.error('获取用户订单失败:', err);
                        resolve({ success: false, error: err.message });
                    } else {
                        resolve({
                            success: true,
                            data: {
                                orders: orders || [],
                                totalCount: orders ? orders.length : 0,
                                pagination: {
                                    currentPage: 1,
                                    pageSize: 50,
                                    totalPages: 1,
                                    total: orders ? orders.length : 0
                                }
                            }
                        });
                    }
                });
            });
        } catch (error) {
            console.error('获取用户订单失败:', error);
            return { success: false, error: error.message };
        }
    });

    // 更新支付状态
    ipcMain.handle('shop:updatePaymentStatus', async (event, orderNo, paymentStatus, paymentMethod = null) => {
        try {
            return new Promise((resolve, reject) => {
                const status = paymentStatus === 'paid' ? 'paid' : 'pending';
                
                db.run(`
                    UPDATE shop_orders 
                    SET payment_status = ?, payment_method = ?, status = ?, updated_at = datetime('now')
                    WHERE order_no = ?
                `, [paymentStatus, paymentMethod, status, orderNo], function(err) {
                    if (err) {
                        console.error('更新支付状态失败:', err);
                        resolve({ success: false, error: err.message });
                    } else if (this.changes === 0) {
                        resolve({ success: false, error: '订单不存在' });
                    } else {
                        resolve({ success: true });
                    }
                });
            });
        } catch (error) {
            console.error('更新支付状态失败:', error);
            return { success: false, error: error.message };
        }
    });

    console.log('商店IPC处理器注册完成');
}

/**
 * 生成订单号
 */
function generateOrderNo() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().slice(0, 8).replace(/:/g, '');
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `LM${date}${time}${random}`;
}

module.exports = {
    registerShopHandlers
}; 