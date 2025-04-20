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
                // 只保留 '默认分组'
                const groupsToInsert = ['默认分组']; 
                groupsToInsert.forEach(name => groupsStmt.run(name, (errInsert) => {
                    if (errInsert) console.error(`Error inserting group ${name}:`, errInsert.message);
                }));
                groupsStmt.finalize((errFinalize) => {
                    if (errFinalize) console.error('Error finalizing groups insert statement:', errFinalize.message);
                    else console.log('Initial groups inserted (or ignored if exist).');

                    // 在 Groups 表和数据准备好之后，创建 Wallets 表并插入测试数据
                    createWalletsTableAndTestData();
                    // 创建 SocialAccounts 表
                    createSocialAccountsTable(); 
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
            notes TEXT,
            groupId INTEGER,
            encryptedPrivateKey TEXT, -- 现在临时存储明文私钥
            mnemonic TEXT,            -- 新增：助记词
            derivationPath TEXT,      -- 新增：派生路径
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
                    console.log('Skipping insertion of initial test wallets.'); 
                }
            });
        }
    });
}

/**
 * 创建 social_accounts 表 (如果不存在)
 */
function createSocialAccountsTable() {
    const createSQL = `
        CREATE TABLE IF NOT EXISTS social_accounts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            platform TEXT NOT NULL,    -- e.g., 'Twitter', 'Discord', 'Email'
            username TEXT NOT NULL,    -- e.g., '@handle', 'user#1234', 'email@example.com'
            binding TEXT,              -- 绑定的邮箱/手机等
            notes TEXT,
            groupId INTEGER,           -- 外键关联 groups 表
            createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
            FOREIGN KEY (groupId) REFERENCES groups(id) ON DELETE SET NULL,
            UNIQUE (platform, username) -- 同一平台下用户名唯一
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
            console.log('Social Accounts table is ready.');
            db.run(createTriggerSQL, (errTrigger) => {
                if (errTrigger) {
                    console.error('Error creating updatedAt trigger for social_accounts:', errTrigger.message);
                } else {
                    console.log('UpdatedAt trigger for social_accounts is ready.');
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
 *   { address, name?, notes?, groupId?, isBackedUp?, encryptedPrivateKey? }
 * @returns {Promise<number>} - 返回新钱包的 ID。
 */
function addWallet(walletData) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO wallets
                     (address, name, notes, groupId, encryptedPrivateKey, mnemonic, derivationPath)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const params = [
            walletData.address,
            walletData.name || null,
            walletData.notes || null,
            walletData.groupId || null,
            walletData.encryptedPrivateKey || null,
            walletData.mnemonic || null,
            walletData.derivationPath || null
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
 * @param {string} [options.groupId] - 按分组 ID 筛选。
 * @param {string} [options.search] - 搜索地址、名称、备注。
 * @param {string} [options.sortBy='createdAt'] - 排序字段。
 * @param {'ASC'|'DESC'} [options.sortOrder='DESC'] - 排序顺序。
 * @param {number} [options.limit] - 每页记录数。
 * @param {number} [options.page] - 页码。
 * @returns {Promise<{wallets: Array<object>, totalCount: number}>} - 返回钱包列表和总记录数。
 */
function getWallets(options = {}) {
    return new Promise((resolve, reject) => {
        let baseSql = `SELECT w.id, w.address, w.name, w.notes, w.groupId, w.encryptedPrivateKey, w.mnemonic, w.derivationPath, w.createdAt, w.updatedAt, g.name as groupName
                       FROM wallets w
                       LEFT JOIN groups g ON w.groupId = g.id`;
        const countSql = `SELECT COUNT(*) as count FROM wallets w LEFT JOIN groups g ON w.groupId = g.id`;
        const whereClauses = [];
        const params = [];
        const countParams = [];

        if (options.groupId) {
            whereClauses.push('w.groupId = ?');
            params.push(options.groupId);
            countParams.push(options.groupId);
        }
         if (options.search) {
            const searchTerm = `%${options.search}%`;
            whereClauses.push('(w.address LIKE ? OR w.name LIKE ? OR w.notes LIKE ? OR g.name LIKE ?)');
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        let whereSql = '';
        if (whereClauses.length > 0) {
            whereSql = ` WHERE ${whereClauses.join(' AND ')}`;
        }

        const sortBy = options.sortBy || 'createdAt';
        const allowedSortColumns = ['id', 'address', 'name', 'createdAt', 'updatedAt', 'groupName', 'mnemonic', 'derivationPath'];
        const safeSortBy = allowedSortColumns.includes(sortBy) ? (sortBy === 'groupName' ? 'g.name' : `w.${sortBy}`) : 'w.createdAt';
        const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
        const orderBySql = ` ORDER BY ${safeSortBy} ${sortOrder}`;

        let limitSql = '';
        if (options.limit !== undefined && options.page !== undefined && options.page > 0) {
            const offset = (options.page - 1) * options.limit;
            limitSql = ' LIMIT ? OFFSET ?';
            params.push(options.limit, offset);
        } else if (options.limit !== undefined) {
            limitSql = ' LIMIT ?';
            params.push(options.limit);
        }

        const finalSql = baseSql + whereSql + orderBySql + limitSql;
        const finalCountSql = countSql + whereSql;

        db.serialize(() => {
            let results = {};
            db.get(finalCountSql, countParams, (errCount, rowCount) => {
                 if (errCount) {
                    console.error('Error counting wallets:', errCount.message);
                    return reject(errCount);
                }
                results.totalCount = rowCount ? rowCount.count : 0;

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
        const sql = `SELECT w.id, w.address, w.name, w.notes, w.groupId, w.encryptedPrivateKey, w.mnemonic, w.derivationPath, w.createdAt, w.updatedAt, g.name as groupName
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
        const placeholders = ids.map(() => '?').join(',');
        const sql = `SELECT w.id, w.address, w.name, w.notes, w.groupId, w.encryptedPrivateKey, w.mnemonic, w.derivationPath, w.createdAt, w.updatedAt, g.name as groupName
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
 *   { address?, name?, notes?, groupId?, isBackedUp?, encryptedPrivateKey? }
 * @returns {Promise<number>} - 返回受影响的行数。
 */
function updateWallet(id, walletData) {
    return new Promise((resolve, reject) => {
        const fields = [];
        const params = [];
        const allowedKeys = ['address', 'name', 'notes', 'groupId', 'encryptedPrivateKey', 'mnemonic', 'derivationPath'];
        for (const key in walletData) {
            if (allowedKeys.includes(key) && Object.hasOwnProperty.call(walletData, key) && key !== 'id') {
                 const value = walletData[key];
                 if (value !== undefined) {
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

/**
 * 批量删除钱包。
 * @param {Array<number>} ids - 要删除的钱包 ID 数组。
 * @returns {Promise<number>} - 返回成功删除的钱包数量。
 */
function deleteWalletsByIds(ids) {
    console.log(`[${Date.now()}] [DB Module] deleteWalletsByIds: Start for ${ids.length} IDs`);
    return new Promise((resolve, reject) => {
        if (!Array.isArray(ids) || ids.length === 0) {
            console.warn(`[${Date.now()}] [DB Module] deleteWalletsByIds: Invalid input`);
            return reject(new Error("Invalid input: IDs array cannot be empty."));
        }

        // 构建占位符 (?, ?, ?...)
        const placeholders = ids.map(() => '?').join(',');
        const sql = `DELETE FROM wallets WHERE id IN (${placeholders})`;
        console.log(`[${Date.now()}] [DB Module] deleteWalletsByIds: Executing SQL: ${sql} with IDs:`, ids);
        const startTime = Date.now();
        db.run(sql, ids, function(err) {
            const duration = Date.now() - startTime;
            if (err) {
                console.error(`[${Date.now()}] [DB Module] deleteWalletsByIds: SQL Error after ${duration}ms: ${err.message}`, err);
                reject(err);
            } else {
                console.log(`[${Date.now()}] [DB Module] deleteWalletsByIds: SQL Success after ${duration}ms. Deleted ${this.changes} rows.`);
                resolve(this.changes);
            }
        });
    });
}

// ================= Social Accounts CRUD =================

/**
 * 添加一个新的社交账户。
 * @param {object} accountData - { platform, username, binding?, notes?, groupId? }
 * @returns {Promise<number>} - 返回新账户的 ID。
 */
function addSocialAccount(accountData) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO social_accounts
                     (platform, username, binding, notes, groupId)
                     VALUES (?, ?, ?, ?, ?)`;
        const params = [
            accountData.platform,
            accountData.username,
            accountData.binding || null,
            accountData.notes || null,
            accountData.groupId || null
        ];
        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error adding social account:', err.message);
                // 检查是否是唯一约束错误
                if (err.message.includes('UNIQUE constraint failed: social_accounts.platform, social_accounts.username')) {
                    reject(new Error(`平台 "${accountData.platform}" 下已存在用户名 "${accountData.username}"`));
                } else {
                    reject(err);
                }
            } else {
                resolve(this.lastID);
            }
        });
    });
}

/**
 * 获取社交账户列表，支持筛选和排序。
 * @param {object} [options={}] - 筛选和分页选项。
 * @param {string} [options.platform] - 按平台筛选。
 * @param {string} [options.groupId] - 按分组 ID 筛选。
 * @param {string} [options.search] - 搜索平台、用户名、绑定信息、备注、分组名。
 * @param {string} [options.sortBy='createdAt'] - 排序字段。
 * @param {'ASC'|'DESC'} [options.sortOrder='DESC'] - 排序顺序。
 * @param {number} [options.limit] - 每页记录数。
 * @param {number} [options.page] - 页码。
 * @returns {Promise<{accounts: Array<object>, totalCount: number}>} - 返回账户列表和总记录数。
 */
function getSocialAccounts(options = {}) {
    return new Promise((resolve, reject) => {
        let baseSql = `SELECT sa.id, sa.platform, sa.username, sa.binding, sa.notes, sa.groupId, sa.createdAt, sa.updatedAt, g.name as groupName
                       FROM social_accounts sa
                       LEFT JOIN groups g ON sa.groupId = g.id`;
        const countSql = `SELECT COUNT(*) as count FROM social_accounts sa LEFT JOIN groups g ON sa.groupId = g.id`;
        const whereClauses = [];
        const params = [];
        const countParams = [];

        if (options.platform) {
            whereClauses.push('sa.platform = ?');
            params.push(options.platform);
            countParams.push(options.platform);
        }
        if (options.groupId) {
            whereClauses.push('sa.groupId = ?');
            params.push(options.groupId);
            countParams.push(options.groupId);
        }
         if (options.search) {
            const searchTerm = `%${options.search}%`;
            whereClauses.push('(sa.platform LIKE ? OR sa.username LIKE ? OR sa.binding LIKE ? OR sa.notes LIKE ? OR g.name LIKE ?)');
            params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        }

        let whereSql = '';
        if (whereClauses.length > 0) {
            whereSql = ` WHERE ${whereClauses.join(' AND ')}`;
        }

        const sortBy = options.sortBy || 'createdAt';
        const allowedSortColumns = ['id', 'platform', 'username', 'binding', 'notes', 'createdAt', 'updatedAt', 'groupName'];
        const safeSortBy = allowedSortColumns.includes(sortBy) ? (sortBy === 'groupName' ? 'g.name' : `sa.${sortBy}`) : 'sa.createdAt';
        const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
        const orderBySql = ` ORDER BY ${safeSortBy} ${sortOrder}`;

        let limitSql = '';
        if (options.limit !== undefined && options.page !== undefined && options.page > 0) {
            const offset = (options.page - 1) * options.limit;
            limitSql = ' LIMIT ? OFFSET ?';
            params.push(options.limit, offset);
        } else if (options.limit !== undefined) {
            limitSql = ' LIMIT ?';
            params.push(options.limit);
        }

        const finalSql = baseSql + whereSql + orderBySql + limitSql;
        const finalCountSql = countSql + whereSql;

        db.serialize(() => {
            let results = {};
            db.get(finalCountSql, countParams, (errCount, rowCount) => {
                 if (errCount) {
                    console.error('Error counting social accounts:', errCount.message);
                    return reject(errCount);
                }
                results.totalCount = rowCount ? rowCount.count : 0;

                db.all(finalSql, params, (err, rows) => {
                    if (err) {
                        console.error('Error getting social accounts:', err.message);
                        reject(err);
                    } else {
                        results.accounts = rows; // 注意键名为 accounts
                        resolve(results);
                    }
                });
            });
        });
    });
}

/**
 * 根据 ID 获取单个社交账户。
 * @param {number} id - 要获取的账户 ID。
 * @returns {Promise<object|null>} - 返回账户对象，如果未找到则返回 null。
 */
function getSocialAccountById(id) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT sa.id, sa.platform, sa.username, sa.binding, sa.notes, sa.groupId, sa.createdAt, sa.updatedAt, g.name as groupName
                       FROM social_accounts sa
                       LEFT JOIN groups g ON sa.groupId = g.id
                       WHERE sa.id = ?`;
        db.get(sql, [id], (err, row) => {
            if (err) {
                console.error(`Error getting social account by ID ${id}:`, err.message);
                reject(err);
            } else {
                resolve(row || null); // 如果找不到，返回 null
            }
        });
    });
}

/**
 * 更新一个社交账户信息。
 * @param {number} id - 要更新的账户 ID。
 * @param {object} accountData - 包含要更新字段的对象。允许部分更新。
 *   { platform?, username?, binding?, notes?, groupId? }
 * @returns {Promise<number>} - 返回受影响的行数。
 */
function updateSocialAccount(id, accountData) {
    return new Promise((resolve, reject) => {
        const fields = [];
        const params = [];
        const allowedKeys = ['platform', 'username', 'binding', 'notes', 'groupId'];
        for (const key in accountData) {
            if (allowedKeys.includes(key) && Object.hasOwnProperty.call(accountData, key) && key !== 'id') {
                 const value = accountData[key];
                 if (value !== undefined) {
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
        const sql = `UPDATE social_accounts SET ${fields.join(', ')} WHERE id = ?`;

        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error updating social account:', err.message);
                 if (err.message.includes('UNIQUE constraint failed: social_accounts.platform, social_accounts.username')) {
                    reject(new Error(`平台 "${accountData.platform}" 下已存在用户名 "${accountData.username}"`));
                } else {
                    reject(err);
                }
            } else {
                resolve(this.changes);
            }
        });
    });
}

/**
 * 删除一个社交账户。
 * @param {number} id - 要删除的账户 ID。
 * @returns {Promise<number>} - 返回受影响的行数。
 */
function deleteSocialAccount(id) {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM social_accounts WHERE id = ?';
        db.run(sql, [id], function(err) {
            if (err) {
                console.error('Error deleting social account:', err.message);
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

/**
 * 批量删除社交账户。
 * @param {Array<number>} ids - 要删除的账户 ID 数组。
 * @returns {Promise<number>} - 返回成功删除的账户数量。
 */
function deleteSocialAccountsByIds(ids) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(ids) || ids.length === 0) {
            return reject(new Error("Invalid input: IDs array cannot be empty."));
        }
        const placeholders = ids.map(() => '?').join(',');
        const sql = `DELETE FROM social_accounts WHERE id IN (${placeholders})`;
        db.run(sql, ids, function(err) {
            if (err) {
                console.error('Error deleting social accounts by IDs:', err.message);
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

// 导出所有函数 (包括新增的社交账户函数)
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
    deleteWallet,
    deleteWalletsByIds,
    // Social Accounts
    addSocialAccount,
    getSocialAccounts,
    getSocialAccountById,
    updateSocialAccount,
    deleteSocialAccount,
    deleteSocialAccountsByIds
}; 