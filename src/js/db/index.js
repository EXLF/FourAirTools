// 数据库主入口，只负责连接、初始化和模块汇总
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 暂时将数据库文件放在项目根目录的 data 文件夹下
// TODO: 对于 Electron 应用，应使用 app.getPath('userData') 获取更合适的路径
const dbPath = path.resolve(__dirname, '../../../database.db'); // 指向项目根目录下的 database.db

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
                    // 3. 创建社交账户表
                    createSocialAccountsTable();
                    // *** 4. 新增：创建钱包-社交账户关联表 ***
                    createWalletSocialLinksTable();
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
            mnemonic TEXT,
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
            db.run(createUpdatedAtTriggerSQL, (errTrigger) => {
                if (errTrigger) {
                    console.error('Error creating updatedAt trigger for wallets:', errTrigger.message);
                } else {
                    console.log('Wallets表和触发器已准备好。');
                }
            });
        }
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
            username TEXT NOT NULL,
            binding TEXT,
            notes TEXT,
            groupId INTEGER,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            FOREIGN KEY (groupId) REFERENCES groups(id) ON DELETE SET NULL,
            UNIQUE (platform, username)
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

// 导出数据库实例、关闭方法和所有模块接口
module.exports = {
    db,
    closeDatabase,
    ...group,
    ...wallet,
    ...social,
    ...links
}; 