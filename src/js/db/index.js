const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 暂时将数据库文件放在项目根目录的 data 文件夹下
// TODO: 对于 Electron 应用，应使用 app.getPath('userData') 获取更合适的路径
const dbPath = path.resolve(__dirname, '../../../database.db'); // 指向项目根目录下的 database.db

// 创建或连接数据库
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // 连接成功后，创建表结构（如果不存在）
        initializeDatabase();
    }
});

/**
 * 初始化数据库，创建必要的表结构和插入初始/测试数据。
 */
function initializeDatabase() {
    const createGroupsTableSQL = `
        CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
        );
    `;

    db.serialize(() => {
        // 创建 Groups 表并插入默认和测试分组
        db.run(createGroupsTableSQL, (err) => {
            if (err) {
                console.error('Error creating groups table:', err.message);
            } else {
                console.log('Groups table is ready.');
                // 使用 INSERT OR IGNORE 插入分组
                const groupsStmt = db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)');
                const groupsToInsert = ['默认分组', 'LayerZero交互', 'zkSync交互', '交易所'];
                groupsToInsert.forEach(name => groupsStmt.run(name, (errInsert) => {
                    if (errInsert) console.error(`Error inserting group ${name}:`, errInsert.message);
                }));
                groupsStmt.finalize((errFinalize) => {
                    if (errFinalize) console.error('Error finalizing groups insert statement:', errFinalize.message);
                    else console.log('Initial groups inserted (or ignored if exist).');

                    // 在 Groups 表和数据准备好之后，创建 Wallets 表并插入测试数据
                    createWalletsTableAndTestData();
                });
            }
        });
    });
}

// 将 Wallets 表创建和测试数据插入分离出来，确保在分组数据插入后执行
function createWalletsTableAndTestData() {
    const createWalletsTableSQL = `
        CREATE TABLE IF NOT EXISTS wallets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            address TEXT NOT NULL UNIQUE,
            name TEXT,
            chain TEXT NOT NULL,
            type TEXT NOT NULL,
            notes TEXT,
            groupId INTEGER,
            isBackedUp INTEGER DEFAULT 0, -- 0 for false, 1 for true
            encryptedPrivateKey TEXT, -- 存储加密后的私钥，必须在应用层加密！
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            FOREIGN KEY (groupId) REFERENCES groups(id) ON DELETE SET NULL -- 稍后创建 groups 表
        );
    `;

    // 创建 wallets 表的触发器，用于自动更新 updatedAt 时间戳
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
            console.log('Wallets table is ready.');
            db.run(createUpdatedAtTriggerSQL, (errTrigger) => {
                if (errTrigger) {
                    console.error('Error creating updatedAt trigger for wallets:', errTrigger.message);
                } else {
                    console.log('UpdatedAt trigger for wallets is ready.');

                    // --- 插入测试钱包数据 ---
                    // 获取分组 ID (更健壮的方式是在 JS 中查询 ID 而不是硬编码)
                    db.all('SELECT id, name FROM groups', [], (errGroups, groups) => {
                        if (errGroups) {
                            console.error("Error getting group IDs for test data:", errGroups.message);
                            return;
                        }

                        const groupMap = groups.reduce((acc, group) => {
                            acc[group.name] = group.id;
                            return acc;
                        }, {});
                        const lzGroupId = groupMap['LayerZero交互'];
                        const zkGroupId = groupMap['zkSync交互'];
                        const exchangeGroupId = groupMap['交易所'];

                        const walletsStmt = db.prepare(`INSERT OR IGNORE INTO wallets
                            (address, name, chain, type, notes, groupId, isBackedUp, encryptedPrivateKey)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

                        const walletsToInsert = [
                            {
                                address: '0x1234567890abcdef1234567890abcdef12345678',
                                name: 'ETH主钱包',
                                chain: 'ETH',
                                type: 'onchain',
                                notes: '主力交互钱包',
                                groupId: lzGroupId,
                                isBackedUp: 1,
                                encryptedPrivateKey: null
                            },
                            {
                                address: '0xabcdef1234567890abcdef1234567890abcdef12',
                                name: 'L0小号01',
                                chain: 'Arbitrum',
                                type: 'onchain',
                                notes: '专门刷L0',
                                groupId: lzGroupId,
                                isBackedUp: 0,
                                encryptedPrivateKey: '加密数据示例1...'
                            }, // 假设已加密
                            {
                                address: 'zkSyncWallet01',
                                name: 'zk交互钱包',
                                chain: 'zkSync Era',
                                type: 'onchain',
                                notes: null,
                                groupId: zkGroupId,
                                isBackedUp: 1,
                                encryptedPrivateKey: null
                            },
                            {
                                address: 'OKX-SubAccount-001',
                                name: 'OKX L0提币',
                                chain: 'OKX',
                                type: 'exchange',
                                notes: '用于L0项目资金归集和提币',
                                groupId: exchangeGroupId,
                                isBackedUp: null,
                                encryptedPrivateKey: null
                            }, // 交易所类型 isBackedUp 无意义
                            {
                                address: '0x9876543210fedcba9876543210fedcba98765432',
                                name: 'SOL钱包',
                                chain: 'Solana',
                                type: 'onchain',
                                notes: 'Solana生态专用',
                                groupId: null,
                                isBackedUp: 0,
                                encryptedPrivateKey: null
                            },
                            {
                                address: 'Binance-Main',
                                name: '币安主账户',
                                chain: 'Binance',
                                type: 'exchange',
                                notes: '大资金存放',
                                groupId: exchangeGroupId,
                                isBackedUp: null,
                                encryptedPrivateKey: null
                            },
                        ];

                        walletsToInsert.forEach(w => {
                            // 查找 groupId，如果分组名不存在则设为 null
                            const finalGroupId = w.groupId || null;
                            walletsStmt.run(
                                w.address,
                                w.name,
                                w.chain,
                                w.type,
                                w.notes,
                                finalGroupId,
                                w.isBackedUp === 1 ? 1 : 0, // 确保是 0 或 1
                                w.encryptedPrivateKey,
                                (errInsert) => {
                                    if (errInsert) console.error(`Error inserting wallet ${w.address}:`, errInsert.message);
                                }
                            );
                        });

                        walletsStmt.finalize((errFinalize) => {
                            if (errFinalize) console.error('Error finalizing wallets insert statement:', errFinalize.message);
                            else console.log('Initial wallets inserted (or ignored if exist).');
                        });
                    });
                }
            });
        }
    });
}

/**
 * 关闭数据库连接。
 * 在应用程序退出时调用。
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

// ================= Groups CRUD =================

/**
 * 添加一个新的分组。
 * @param {string} name - 分组名称。
 * @returns {Promise<number>} - 返回新分组的 ID。
 */
function addGroup(name) {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO groups (name) VALUES (?)';
        db.run(sql, [name], function(err) { // 使用 function 获取 this.lastID
            if (err) {
                console.error('Error adding group:', err.message);
                reject(err);
            } else {
                resolve(this.lastID); // 返回新插入行的 ID
            }
        });
    });
}

/**
 * 获取所有分组。
 * @returns {Promise<Array<object>>} - 返回包含所有分组对象的数组 [{id, name, createdAt}, ...]
 */
function getGroups() {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM groups ORDER BY name';
        db.all(sql, [], (err, rows) => {
            if (err) {
                console.error('Error getting groups:', err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * 更新分组名称。
 * @param {number} id - 要更新的分组 ID。
 * @param {string} newName - 新的分组名称。
 * @returns {Promise<number>} - 返回受影响的行数。
 */
function updateGroup(id, newName) {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE groups SET name = ? WHERE id = ?';
        db.run(sql, [newName, id], function(err) {
            if (err) {
                console.error('Error updating group:', err.message);
                reject(err);
            } else {
                resolve(this.changes); // 返回受影响的行数
            }
        });
    });
}

/**
 * 删除一个分组。
 * 注意：删除分组时，关联钱包的 groupId 会被设为 NULL (根据外键定义)。
 * @param {number} id - 要删除的分组 ID。
 * @returns {Promise<number>} - 返回受影响的行数。
 */
function deleteGroup(id) {
    return new Promise((resolve, reject) => {
        // 可以考虑不允许删除"默认分组"，或者将钱包转移到默认分组
        const sql = 'DELETE FROM groups WHERE id = ?';
        db.run(sql, [id], function(err) {
            if (err) {
                console.error('Error deleting group:', err.message);
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// ================= Wallets CRUD =================

/**
 * 添加一个新钱包。
 * @param {object} walletData - 包含钱包信息的对象。
 *   { address, name?, chain, type, notes?, groupId?, isBackedUp?, encryptedPrivateKey? }
 * @returns {Promise<number>} - 返回新钱包的 ID。
 */
function addWallet(walletData) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO wallets
                     (address, name, chain, type, notes, groupId, isBackedUp, encryptedPrivateKey)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
            walletData.address,
            walletData.name || null, // 可选字段
            walletData.chain,
            walletData.type,
            walletData.notes || null,
            walletData.groupId || null, // 如果未提供，则为 null
            walletData.isBackedUp ? 1 : 0,
            walletData.encryptedPrivateKey || null // 存储加密后的数据
        ];
        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error adding wallet:', err.message);
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

/**
 * 获取钱包列表，支持筛选和排序。
 * @param {object} [options={}] - 筛选和分页选项。
 * @param {string} [options.chain] - 按链筛选。
 * @param {string} [options.type] - 按类型筛选。
 * @param {number} [options.groupId] - 按分组 ID 筛选。
 * @param {string} [options.search] - 搜索地址、名称、备注。
 * @param {string} [options.sortBy='createdAt'] - 排序字段。
 * @param {'ASC'|'DESC'} [options.sortOrder='DESC'] - 排序顺序。
 * @param {number} [options.limit] - 每页记录数。
 * @param {number} [options.offset] - 起始偏移量。
 * @returns {Promise<{wallets: Array<object>, totalCount: number}>} - 返回钱包列表和总记录数。
 */
function getWallets(options = {}) {
    return new Promise((resolve, reject) => {
        let baseSql = `SELECT w.*, g.name as groupName
                       FROM wallets w
                       LEFT JOIN groups g ON w.groupId = g.id`;
        const countSql = `SELECT COUNT(*) as count FROM wallets w LEFT JOIN groups g ON w.groupId = g.id`; // Count也要Join才能筛选groupName
        const whereClauses = [];
        const params = [];
        const countParams = []; // 单独为 COUNT 查询准备参数

        // 构建筛选条件
        if (options.chain) {
            whereClauses.push('w.chain = ?');
            params.push(options.chain);
            countParams.push(options.chain);
        }
        if (options.type) {
            whereClauses.push('w.type = ?');
            params.push(options.type);
            countParams.push(options.type);
        }
        if (options.groupId) {
            whereClauses.push('w.groupId = ?');
            params.push(options.groupId);
            countParams.push(options.groupId);
        }
         if (options.search) {
            const searchTerm = `%${options.search}%`;
             // 增加对 groupName 的搜索
            whereClauses.push('(w.address LIKE ? OR w.name LIKE ? OR w.notes LIKE ? OR g.name LIKE ?)');
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        // 组合 WHERE 子句
        let whereSql = '';
        if (whereClauses.length > 0) {
            whereSql = ` WHERE ${whereClauses.join(' AND ')}`;
        }

        // 排序
        const sortBy = options.sortBy || 'createdAt';
        // 确保 sortBy 是允许的列名，防止 SQL 注入
        const allowedSortColumns = ['id', 'address', 'name', 'chain', 'type', 'createdAt', 'updatedAt', 'groupName'];
        // 需要处理 groupName 这种别名
        const safeSortBy = allowedSortColumns.includes(sortBy) ? (sortBy === 'groupName' ? 'g.name' : `w.${sortBy}`) : 'w.createdAt';
        const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
        const orderBySql = ` ORDER BY ${safeSortBy} ${sortOrder}`; // g.name for groupName

        // 分页
        let limitSql = '';
        if (options.limit !== undefined && options.offset !== undefined) {
            limitSql = ' LIMIT ? OFFSET ?';
            params.push(options.limit, options.offset);
        }

        const finalSql = baseSql + whereSql + orderBySql + limitSql;
        const finalCountSql = countSql + whereSql; // Count SQL 不需要 ORDER BY 或 LIMIT

        // 执行查询
        db.serialize(() => {
            let results = {};
            // 先获取总数
            db.get(finalCountSql, countParams, (errCount, rowCount) => {
                 if (errCount) {
                    console.error('Error counting wallets:', errCount.message);
                    return reject(errCount);
                }
                results.totalCount = rowCount ? rowCount.count : 0;

                 // 再获取分页/筛选后的数据
                db.all(finalSql, params, (err, rows) => {
                    if (err) {
                        console.error('Error getting wallets:', err.message);
                        reject(err);
                    } else {
                        results.wallets = rows;
                        resolve(results);
                    }
                });
            });
        });
    });
}

/**
 * 根据 ID 获取单个钱包信息。
 * @param {number} id - 钱包 ID。
 * @returns {Promise<object|null>} - 返回钱包对象或 null（如果未找到）。
 */
function getWalletById(id) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT w.*, g.name as groupName
                       FROM wallets w
                       LEFT JOIN groups g ON w.groupId = g.id
                       WHERE w.id = ?`;
        db.get(sql, [id], (err, row) => {
            if (err) {
                console.error('Error getting wallet by ID:', err.message);
                reject(err);
            } else {
                resolve(row || null); // 如果没找到则返回 null
            }
        });
    });
}

/**
 * 根据一组 ID 获取多个钱包信息。
 * @param {Array<number>} ids - 钱包 ID 数组。
 * @returns {Promise<Array<object>>} - 返回钱包对象数组。
 */
function getWalletsByIds(ids) {
    return new Promise((resolve, reject) => {
        if (!ids || ids.length === 0) {
            return resolve([]); // 如果没有 ID，返回空数组
        }
        // 使用 SQL 的 IN 操作符和占位符 '?'
        const placeholders = ids.map(() => '?').join(',');
        const sql = `SELECT w.*, g.name as groupName
                       FROM wallets w
                       LEFT JOIN groups g ON w.groupId = g.id
                       WHERE w.id IN (${placeholders})`;

        db.all(sql, ids, (err, rows) => {
            if (err) {
                console.error('Error getting wallets by IDs:', err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * 更新一个钱包信息。
 * @param {number} id - 要更新的钱包 ID。
 * @param {object} walletData - 包含要更新字段的对象。允许部分更新。
 *   { address?, name?, chain?, type?, notes?, groupId?, isBackedUp?, encryptedPrivateKey? }
 * @returns {Promise<number>} - 返回受影响的行数。
 */
function updateWallet(id, walletData) {
    return new Promise((resolve, reject) => {
        const fields = [];
        const params = [];
        // 动态构建 SET 子句
        for (const key in walletData) {
            if (Object.hasOwnProperty.call(walletData, key) && key !== 'id') {
                 // 注意 isBackedUp 需要转换
                const value = (key === 'isBackedUp') ? (walletData[key] ? 1 : 0) : walletData[key];
                // 允许将 groupId 或 notes 设为 null
                 if (value !== undefined) {
                     // 处理将 groupId 设为 null 的情况
                     if (key === 'groupId' && (value === null || value === '' || value === 0)) {
                         fields.push(`groupId = ?`);
                         params.push(null);
                     } else {
                         fields.push(`${key} = ?`);
                         params.push(value);
                     }
                 }
            }
        }

        if (fields.length === 0) {
            return resolve(0); // 没有要更新的字段
        }

        params.push(id); // 添加 ID 到参数末尾
        const sql = `UPDATE wallets SET ${fields.join(', ')} WHERE id = ?`;

        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error updating wallet:', err.message);
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

/**
 * 删除一个钱包。
 * @param {number} id - 要删除的钱包 ID。
 * @returns {Promise<number>} - 返回受影响的行数。
 */
function deleteWallet(id) {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM wallets WHERE id = ?';
        db.run(sql, [id], function(err) {
            if (err) {
                console.error('Error deleting wallet:', err.message);
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// 导出所有函数
module.exports = {
    db,
    closeDatabase,
    // Groups
    addGroup,
    getGroups,
    updateGroup,
    deleteGroup,
    // Wallets
    addWallet,
    getWallets,
    getWalletById,
    getWalletsByIds,
    updateWallet,
    deleteWallet
}; 