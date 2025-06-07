// 数据库主入口，只负责连接、初始化和模块汇总
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { app } = require('electron'); // <-- 新增：引入 app 模块
const cryptoService = require('../core/cryptoService'); // <-- 导入 cryptoService

// 正确的数据库路径，适用于开发和打包环境
// const dbPath = path.resolve(__dirname, '../../../database.db'); // 指向项目根目录下的 database.db -- 旧路径
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'database.db'); 
console.log('[DB] Using database path:', dbPath); // <-- 新增：打印数据库路径以供调试

// 创建或连接数据库，启动时自动初始化表结构
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initializeDatabase();
    }
});

/**
 * 初始化数据库，创建所有必要的表结构（分组、钱包、社交账户、关联链接）
 * 并插入初始分组数据
 */
function initializeDatabase() {
    // 1. 创建分组表
    const createGroupsTableSQL = `
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
    `;
    db.serialize(() => {
        db.run(createGroupsTableSQL, (err) => {
            if (err) {
                console.error('Error creating groups table:', err.message);
            } else {
                // 插入默认分组
                const groupsStmt = db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)');
                const groupsToInsert = ['默认分组'];
                groupsToInsert.forEach(name => groupsStmt.run(name, (errInsert) => {
                    if (errInsert) console.error(`Error inserting group ${name}:`, errInsert.message);
                }));
                groupsStmt.finalize((errFinalize) => {
                    if (errFinalize) console.error('Error finalizing groups insert statement:', errFinalize.message);
                    else console.log('Initial groups inserted (or ignored if exist).');
                    // 2. 创建钱包表
                    createWalletsTableAndTestData();
                    // 3. 先检查社交账户表并迁移
                    migrateSocialAccountsTable(() => {
                        // 4. 创建/更新社交账户表
                        createSocialAccountsTable();
                        // *** 5. 创建钱包-社交账户关联表 ***
                        createWalletSocialLinksTable();
                        // *** 6. 创建代理表 ***
                        createProxiesTable();
                        // *** 7. 创建商店相关表 ***
                        createShopTables();
                        // *** 8. 插入商店测试数据 ***
                        setTimeout(() => {
                            try {
                                const shopTestData = require('./init_shop_test_data.js');
                                shopTestData.insertTestProducts();
                                
                                // *** 9. 更新商品图片字段 ***
                                setTimeout(() => {
                                    try {
                                        const updateImages = require('./update_product_images.js');
                                        updateImages.updateProductImages();
                                    } catch (err) {
                                        console.log('更新商品图片时出错:', err.message);
                                    }
                                }, 1000); // 延迟1秒确保数据已插入
                            } catch (err) {
                                console.log('插入商店测试数据时出错:', err.message);
                            }
                        }, 2000); // 延迟2秒确保表已创建
                        // *** 调用密码迁移 ***
                        migrateProxyPasswords(); 
                    });
                });
            }
        });
    });
}

/**
 * 创建钱包表和相关触发器（自动更新时间戳）
 */
function createWalletsTableAndTestData() {
    const createWalletsTableSQL = `
        CREATE TABLE IF NOT EXISTS wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL UNIQUE,
            name TEXT,
            notes TEXT,
            groupId INTEGER,
            encryptedPrivateKey TEXT,
            encryptedMnemonic TEXT,
            derivationPath TEXT,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            FOREIGN KEY (groupId) REFERENCES groups(id) ON DELETE SET NULL
        );
    `;
    // 自动更新时间戳的触发器
    const createUpdatedAtTriggerSQL = `
        CREATE TRIGGER IF NOT EXISTS update_wallets_updatedAt
        AFTER UPDATE ON wallets
        FOR EACH ROW
        BEGIN
            UPDATE wallets SET updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
        END;
    `;
    db.run(createWalletsTableSQL, (err) => {
        if (err) {
            console.error('Error creating wallets table:', err.message);
        } else {
            // 尝试重命名旧的 mnemonic 列（如果存在且新列不存在）
            db.all("PRAGMA table_info(wallets)", (pragmaErr, columns) => {
                if (pragmaErr) {
                    console.error("Error getting wallets table info for migration:", pragmaErr);
                    // 继续执行其他操作
                    runRemainingMigrationsAndFinalize();
                    return;
                }

                const hasOldMnemonic = columns.some(col => col.name === 'mnemonic');
                const hasNewEncryptedMnemonic = columns.some(col => col.name === 'encryptedMnemonic');

                if (hasOldMnemonic && !hasNewEncryptedMnemonic) {
                    console.log("Found old 'mnemonic' column, attempting to rename to 'encryptedMnemonic'.");
                    db.run("ALTER TABLE wallets RENAME COLUMN mnemonic TO encryptedMnemonic", (renameErr) => {
                        if (renameErr) {
                            console.error("Error renaming 'mnemonic' column to 'encryptedMnemonic':", renameErr.message);
                            // 如果重命名失败，可能是因为 'encryptedMnemonic' 列已通过其他方式创建
                            // 或者并发修改。可以尝试添加新列（如果它尚不存在）
                            // 但为了简单起见，这里只记录错误。
                            // 在更复杂的场景中，可能需要更健壮的迁移逻辑。
                        } else {
                            console.log("'mnemonic' column successfully renamed to 'encryptedMnemonic'.");
                        }
                        // 无论重命名是否成功，都继续
                        runRemainingMigrationsAndFinalize();
                    });
                } else if (!hasOldMnemonic && !hasNewEncryptedMnemonic) {
                    // 如果两个列都不存在（不太可能，因为CREATE TABLE会创建encryptedMnemonic）
                    // 理论上这里不需要操作，但为了完整性可以考虑添加列
                    console.warn("Neither 'mnemonic' nor 'encryptedMnemonic' column found after CREATE TABLE. This is unexpected.");
                    runRemainingMigrationsAndFinalize();
                }
                 else {
                    // 旧列不存在，或者新列已存在，无需重命名
                    runRemainingMigrationsAndFinalize();
                }
            });
        }
    });
}

// 辅助函数，用于在迁移检查后运行剩余的创建步骤
function runRemainingMigrationsAndFinalize() {
    const createUpdatedAtTriggerSQL = `
        CREATE TRIGGER IF NOT EXISTS update_wallets_updatedAt
        AFTER UPDATE ON wallets
        FOR EACH ROW
        BEGIN
            UPDATE wallets SET updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
        END;
    `;
    db.run(createUpdatedAtTriggerSQL, (errTrigger) => {
        if (errTrigger) {
            console.error('Error creating updatedAt trigger for wallets:', errTrigger.message);
        } else {
            console.log('Wallets表和触发器已准备好。');
        }
    });
    // 此处可以继续其他依赖于 wallets 表已准备好的初始化步骤
}

/**
 * 检查并迁移社交账户表，从旧结构迁移到新结构
 * @param {Function} callback - 完成后的回调函数
 */
function migrateSocialAccountsTable(callback) {
    // 1. 检查表是否存在
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='social_accounts'", (err, result) => {
        if (err) {
            console.error('Error checking social_accounts table:', err.message);
            return callback();
        }
        
        // 如果表不存在，无需迁移
        if (!result) {
            console.log("social_accounts表不存在，将创建新表。");
            return callback();
        }
        
        // 2. 检查表结构
        db.get("PRAGMA table_info(social_accounts)", (err, rows) => {
            if (err) {
                console.error('Error checking social_accounts columns:', err.message);
                return callback();
            }
            
            // 获取所有列名
            db.all("PRAGMA table_info(social_accounts)", (err, columns) => {
                if (err) {
                    console.error('Error getting social_accounts columns:', err.message);
                    return callback();
                }
                
                const columnNames = columns.map(col => col.name);
                
                // 检查是否存在旧结构的特定列（如 username, binding, groupId）
                if (columnNames.includes('username') && 
                    columnNames.includes('groupId') && 
                    !columnNames.includes('identifier') && 
                    !columnNames.includes('group_id')) {
                    
                    console.log("检测到社交账户表使用旧结构，开始迁移数据...");
                    
                    // 3. 创建新表并迁移数据
                    db.serialize(() => {
                        // 创建临时表
                        const createTempTableSQL = `
                            CREATE TABLE social_accounts_new (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                platform TEXT NOT NULL,
                                identifier TEXT NOT NULL,
                                password TEXT,
                                notes TEXT,
                                group_id INTEGER,
                                twitter_2fa TEXT,
                                twitter_email TEXT,
                                email_recovery_email TEXT,
                                discord_token TEXT,
                                telegram_login_api TEXT,
                                createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                                updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                                FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
                                UNIQUE (platform, identifier)
                            );
                        `;
                        
                        db.run(createTempTableSQL, (err) => {
                            if (err) {
                                console.error('Error creating temporary social_accounts table:', err.message);
                                return callback();
                            }
                            
                            // 复制数据，将username映射到identifier, groupId映射到group_id
                            const copyDataSQL = `
                                INSERT INTO social_accounts_new (
                                    id, platform, identifier, notes, group_id, 
                                    twitter_email, email_recovery_email, createdAt, updatedAt
                                )
                                SELECT 
                                    id, platform, username, notes, groupId,
                                    CASE 
                                        WHEN platform = 'Twitter' THEN binding 
                                        ELSE NULL 
                                    END,
                                    CASE 
                                        WHEN platform = 'Email' THEN binding 
                                        ELSE NULL 
                                    END,
                                    createdAt, updatedAt
                                FROM social_accounts;
                            `;
                            
                            db.run(copyDataSQL, (err) => {
                                if (err) {
                                    console.error('Error copying social_accounts data:', err.message);
                                    // 如果复制失败，删除临时表
                                    db.run("DROP TABLE IF EXISTS social_accounts_new", () => callback());
                                    return;
                                }
                                
                                console.log("数据迁移完成，正在替换旧表...");
                                
                                // 删除旧表并重命名新表
                                db.run("DROP TABLE social_accounts", (err) => {
                                    if (err) {
                                        console.error('Error dropping old social_accounts table:', err.message);
                                        return callback();
                                    }
                                    
                                    db.run("ALTER TABLE social_accounts_new RENAME TO social_accounts", (err) => {
                                        if (err) {
                                            console.error('Error renaming social_accounts_new table:', err.message);
                                        } else {
                                            console.log("社交账户表结构更新完成！");
                                        }
                                        callback();
                                    });
                                });
                            });
                        });
                    });
                } else if (columnNames.includes('identifier') && columnNames.includes('group_id')) {
                    console.log("社交账户表已使用新结构，无需迁移。");
                    callback();
                } else {
                    console.log("社交账户表结构不明确，将尝试重新创建表。");
                    // 如果结构不明确，可以选择删除旧表并创建新表
                    // 注意: 这将丢失所有现有数据
                    db.run("DROP TABLE IF EXISTS social_accounts", (err) => {
                        if (err) {
                            console.error('Error dropping social_accounts table:', err.message);
                        }
                        callback();
                    });
                }
            });
        });
    });
}

/**
 * 创建社交账户表和相关触发器（自动更新时间戳）
 */
function createSocialAccountsTable() {
    const createSQL = `
        CREATE TABLE IF NOT EXISTS social_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,
            identifier TEXT NOT NULL,
            password TEXT,
            notes TEXT,
            group_id INTEGER,
            twitter_2fa TEXT,
            twitter_email TEXT,
            email_recovery_email TEXT,
            discord_password TEXT,
            discord_token TEXT,
            telegram_password TEXT,
            telegram_login_api TEXT,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
            UNIQUE (platform, identifier)
        );
    `;
    const createTriggerSQL = `
        CREATE TRIGGER IF NOT EXISTS update_social_accounts_updatedAt
        AFTER UPDATE ON social_accounts
        FOR EACH ROW
        BEGIN
            UPDATE social_accounts SET updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
        END;
    `;
    db.run(createSQL, (err) => {
        if (err) {
            console.error('Error creating social_accounts table:', err.message);
        } else {
            db.run(createTriggerSQL, (errTrigger) => {
                if (errTrigger) {
                    console.error('Error creating updatedAt trigger for social_accounts:', errTrigger.message);
                } else {
                    console.log('Social Accounts表和触发器已准备好。');
                }
            });
        }
    });
}

/**
 * 新增：创建钱包-社交账户关联表 (wallet_social_links)
 */
function createWalletSocialLinksTable() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS wallet_social_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            walletId INTEGER NOT NULL,
            socialId INTEGER NOT NULL,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (walletId) REFERENCES wallets(id) ON DELETE CASCADE,
            FOREIGN KEY (socialId) REFERENCES social_accounts(id) ON DELETE CASCADE,
            UNIQUE(walletId, socialId)
        );
    `;
    const createWalletIdIndexSQL = `CREATE INDEX IF NOT EXISTS idx_wallet_social_links_walletId ON wallet_social_links(walletId);`;
    const createSocialIdIndexSQL = `CREATE INDEX IF NOT EXISTS idx_wallet_social_links_socialId ON wallet_social_links(socialId);`;

    db.serialize(() => {
        db.run(createTableSQL, (err) => {
            if (err) {
                console.error('Error creating wallet_social_links table:', err.message);
            } else {
                console.log('Wallet-Social Links 表已准备好。');
                // 创建索引
                db.run(createWalletIdIndexSQL, (errIndex1) => {
                    if (errIndex1) console.error('Error creating index on walletId for links table:', errIndex1.message);
                    else console.log('Index on walletId created for links table.');
                });
                db.run(createSocialIdIndexSQL, (errIndex2) => {
                    if (errIndex2) console.error('Error creating index on socialId for links table:', errIndex2.message);
                    else console.log('Index on socialId created for links table.');
                });
            }
        });
    });
}

/**
 * 新增：创建代理表 (proxies)
 */
function createProxiesTable() {
    const createTableSQL = `
        CREATE TABLE IF NOT EXISTS proxies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            type TEXT NOT NULL CHECK(type IN ('HTTP', 'HTTPS', 'SOCKS5')), -- 限制类型
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            username TEXT,
            password TEXT, -- 存储加密后的密码 (需要加密服务解锁才能正确读写)
            group_id INTEGER,
            is_enabled BOOLEAN DEFAULT FALSE, -- 是否启用该代理
            status TEXT DEFAULT '未测试' CHECK(status IN ('未测试', '可用', '不可用', '测试中', '信息获取失败')),
            latency INTEGER, -- 毫秒
            exit_ip TEXT,
            country TEXT,
            country_code TEXT,
            region TEXT,
            city TEXT,
            organization TEXT,
            asn INTEGER,
            risk_level TEXT,
            risk_score INTEGER,
            last_checked_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
        );
    `;
    const createUpdatedAtTriggerSQL = `
        CREATE TRIGGER IF NOT EXISTS update_proxies_updatedAt
        AFTER UPDATE ON proxies
        FOR EACH ROW
        BEGIN
            UPDATE proxies SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
        END;
    `;
    // 可以考虑为常用查询字段加索引，例如 group_id, is_enabled, status
    const createGroupIdIndexSQL = `CREATE INDEX IF NOT EXISTS idx_proxies_groupId ON proxies(group_id);`;
    const createStatusIndexSQL = `CREATE INDEX IF NOT EXISTS idx_proxies_status ON proxies(status);`;

    db.serialize(() => {
        db.run(createTableSQL, (err) => {
            if (err) {
                console.error('Error creating proxies table:', err.message);
            } else {
                console.log('Proxies 表已准备好。');
                db.run(createUpdatedAtTriggerSQL, (errTrigger) => {
                    if (errTrigger) console.error('Error creating updatedAt trigger for proxies:', errTrigger.message);
                    else console.log('UpdatedAt trigger for proxies created.');
                });
                db.run(createGroupIdIndexSQL, (errIndex1) => {
                     if (errIndex1) console.error('Error creating index on group_id for proxies:', errIndex1.message);
                    else console.log('Index on group_id created for proxies.');
                });
                db.run(createStatusIndexSQL, (errIndex2) => {
                    if (errIndex2) console.error('Error creating index on status for proxies:', errIndex2.message);
                    else console.log('Index on status created for proxies.');
                });
            }
        });
    });
}

/**
 * 新增：迁移代理密码，将数据库中可能存在的明文密码加密
 */
async function migrateProxyPasswords() {
    if (!cryptoService.isUnlocked()) {
        console.warn('[DB Migration] 应用未解锁，无法迁移代理密码。请解锁后重启应用或手动触发迁移。');
        return;
    }

    console.log('[DB Migration] 开始检查并迁移代理密码...');
    try {
        // 使用 db (sqlite3.Database 实例) 执行查询
        db.all("SELECT id, password FROM proxies WHERE password IS NOT NULL", async (err, rows) => {
            if (err) {
                console.error('[DB Migration] 查询需要迁移的代理密码失败:', err.message);
                return;
            }

            if (!rows || rows.length === 0) {
                console.log('[DB Migration] 没有需要迁移的代理密码。');
                return;
            }

            let migratedCount = 0;
            let errorCount = 0;

            for (const row of rows) {
                // 简单检查密码是否已经是加密格式 (iv:tag:data)
                // 注意：这是一个非常基础的检查，可能误判。更可靠的方式是尝试解密。
                if (typeof row.password === 'string' && row.password.includes(':') && row.password.split(':').length === 3) {
                    continue; // 跳过看起来已加密的
                }
                
                try {
                    console.log(`[DB Migration] Migrating password for proxy ID ${row.id}...`);
                    const encryptedPassword = cryptoService.encryptWithSessionKey(row.password);
                    // 使用 db (sqlite3.Database 实例) 执行更新
                    await new Promise((resolveUpdate, rejectUpdate) => {
                        db.run("UPDATE proxies SET password = ? WHERE id = ?", [encryptedPassword, row.id], function(updateErr) {
                            if (updateErr) {
                                console.error(`[DB Migration] 更新代理 ID ${row.id} 的密码失败:`, updateErr.message);
                                errorCount++;
                                rejectUpdate(updateErr);
                            } else {
                                console.log(`[DB Migration] 代理 ID ${row.id} 的密码已成功迁移加密。`);
                                migratedCount++;
                                resolveUpdate();
                            }
                        });
                    });
                } catch (encError) {
                    console.error(`[DB Migration] 加密代理 ID ${row.id} 的密码失败:`, encError.message);
                    errorCount++;
                }
            }

            if (migratedCount > 0 || errorCount > 0) {
                console.log(`[DB Migration] 代理密码迁移完成。成功迁移: ${migratedCount}，失败: ${errorCount}。`);
            }
        });
    } catch (error) {
        console.error('[DB Migration] 执行代理密码迁移时发生错误:', error);
    }
}

/**
 * 创建商店相关表
 */
function createShopTables() {
    // 1. 创建商品分类表
    const createCategoriesTableSQL = `
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
    `;
    
    // 2. 创建商品表
    const createProductsTableSQL = `
        CREATE TABLE IF NOT EXISTS shop_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id INTEGER NOT NULL,
            name VARCHAR(200) NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            stock_quantity INTEGER DEFAULT 0,
            is_digital BOOLEAN DEFAULT 1,
            product_type VARCHAR(50),
            product_data TEXT,
            image_url VARCHAR(500),
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (category_id) REFERENCES shop_categories (id)
        );
    `;
    
    // 3. 创建订单表
    const createOrdersTableSQL = `
        CREATE TABLE IF NOT EXISTS shop_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id VARCHAR(100) NOT NULL,
            order_no VARCHAR(50) UNIQUE NOT NULL,
            total_amount DECIMAL(10,2) NOT NULL,
            status VARCHAR(20) DEFAULT 'pending',
            payment_method VARCHAR(50),
            payment_status VARCHAR(20) DEFAULT 'unpaid',
            notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;
    
    // 4. 创建订单明细表
    const createOrderItemsTableSQL = `
        CREATE TABLE IF NOT EXISTS shop_order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            product_name VARCHAR(200) NOT NULL,
            product_price DECIMAL(10,2) NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            subtotal DECIMAL(10,2) NOT NULL,
            delivery_data TEXT,
            delivery_status VARCHAR(20) DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES shop_orders (id),
            FOREIGN KEY (product_id) REFERENCES shop_products (id)
        );
    `;
    
    // 执行表创建
    db.serialize(() => {
        db.run(createCategoriesTableSQL, (err) => {
            if (err) {
                console.error('Error creating shop_categories table:', err.message);
            } else {
                console.log('商品分类表已创建或已存在');
                
                // 插入默认分类数据
                const insertCategorySQL = 'INSERT OR IGNORE INTO shop_categories (name, description, icon, sort_order) VALUES (?, ?, ?, ?)';
                const categoryStmt = db.prepare(insertCategorySQL);
                
                const categories = [
                    ['IP代理', '高质量IP代理服务', 'fas fa-globe', 1],
                    ['Twitter账号', '各种类型Twitter账号', 'fab fa-twitter', 2],
                    ['Discord账号', 'Discord社交账号', 'fab fa-discord', 3],
                    ['Telegram账号', 'Telegram通讯账号', 'fab fa-telegram', 4],
                    ['工具软件', '撸毛必备工具软件', 'fas fa-tools', 5],
                    ['付费教程', '高质量撸毛教程', 'fas fa-graduation-cap', 6]
                ];
                
                categories.forEach(category => {
                    categoryStmt.run(...category, (errInsert) => {
                        if (errInsert && !errInsert.message.includes('UNIQUE constraint failed')) {
                            console.error(`Error inserting category ${category[0]}:`, errInsert.message);
                        }
                    });
                });
                
                categoryStmt.finalize();
                console.log('商品分类默认数据已插入');
            }
        });
        
        db.run(createProductsTableSQL, (err) => {
            if (err) {
                console.error('Error creating shop_products table:', err.message);
            } else {
                console.log('商品表已创建或已存在');
            }
        });
        
        db.run(createOrdersTableSQL, (err) => {
            if (err) {
                console.error('Error creating shop_orders table:', err.message);
            } else {
                console.log('订单表已创建或已存在');
            }
        });
        
        db.run(createOrderItemsTableSQL, (err) => {
            if (err) {
                console.error('Error creating shop_order_items table:', err.message);
            } else {
                console.log('订单明细表已创建或已存在');
            }
        });
    });
}

/**
 * 关闭数据库连接（应用退出时调用）
 */
function closeDatabase() {
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err.message);
        } else {
            console.log('Database connection closed.');
        }
    });
}

// 汇总各功能模块的CRUD接口
const group = require('./group');
const wallet = require('./wallet');
const social = require('./social');
const links = require('./links');
const proxy = require('./proxy');

// module.exports 应该聚合各模块的导出以及本地 db 实例
const walletDbFunctions = require('./wallet.js');
const groupDbFunctions = require('./group.js'); // 假设 group.js 存在并导出函数
const socialDbFunctions = require('./social.js'); // 假设 social.js 存在并导出函数
const proxyDbFunctions = require('./proxy.js');
const linksDbFunctions = require('./links.js'); // 假设 links.js 存在并导出函数

module.exports = {
    db, // sqlite3.Database 实例本身
    initializeDatabase, // 如果需要在外部调用初始化
    closeDatabase,      // 关闭数据库连接的函数
    // 可以选择性地导出 migrateProxyPasswords 如果需要外部触发
    // migrateProxyPasswords, 

    // 从各模块展开导入的函数
    ...groupDbFunctions,
    ...walletDbFunctions,
    ...socialDbFunctions,
    ...proxyDbFunctions,
    ...linksDbFunctions
}; 