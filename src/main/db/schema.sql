-- 撸毛商店相关表
-- 商品分类表
CREATE TABLE IF NOT EXISTS shop_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 商品表
CREATE TABLE IF NOT EXISTS shop_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INTEGER DEFAULT 0,
    is_digital BOOLEAN DEFAULT 1,
    product_type VARCHAR(50), -- 'ip_proxy', 'twitter_account', 'discord_account', 'telegram_account', 'tool', 'tutorial'
    product_data TEXT, -- JSON格式存储商品详细信息
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES shop_categories (id)
);

-- 订单表
CREATE TABLE IF NOT EXISTS shop_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id VARCHAR(100) NOT NULL, -- 关联用户系统
    order_no VARCHAR(50) UNIQUE NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'paid', 'delivered', 'cancelled', 'refunded'
    payment_method VARCHAR(50),
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'paid', 'failed', 'refunded'
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 订单商品明细表
CREATE TABLE IF NOT EXISTS shop_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    product_price DECIMAL(10,2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    subtotal DECIMAL(10,2) NOT NULL,
    delivery_data TEXT, -- JSON格式存储交付信息（账号密码等）
    delivery_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'delivered', 'failed'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES shop_orders (id),
    FOREIGN KEY (product_id) REFERENCES shop_products (id)
);

-- 插入默认分类数据
INSERT OR IGNORE INTO shop_categories (name, description, icon, sort_order) VALUES
('IP代理', '高质量IP代理服务', 'fas fa-globe', 1),
('Twitter账号', '各种类型Twitter账号', 'fab fa-twitter', 2),
('Discord账号', 'Discord社交账号', 'fab fa-discord', 3),
('Telegram账号', 'Telegram通讯账号', 'fab fa-telegram', 4),
('工具软件', '撸毛必备工具软件', 'fas fa-tools', 5),
('付费教程', '高质量撸毛教程', 'fas fa-graduation-cap', 6); 