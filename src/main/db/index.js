const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// 将 db 变量提升到模块作用域
let db;
let dbPath; // 存储数据库路径，以便 closeDatabase 使用

/**
 * 初始化数据库连接。必须在应用准备就绪后调用。
 * @param {Electron.App} app - Electron 的 app 对象。
 */
function initializeDatabaseConnection(app) {
    // 使用 app.getPath('userData') 获取应用数据目录
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'database.db'); // 将数据库放在应用数据目录下

    console.log(`Database path set to: ${dbPath}`);

    return new Promise((resolve, reject) => {
        // 创建或连接数据库
        db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                console.error('Error opening database:', err.message);
                reject(err); // 初始化失败时 reject Promise
            } else {
                console.log('Connected to the SQLite database.');
                // 连接成功后，创建表结构（如果不存在）
                initializeDatabaseSchema()
                    .then(() => resolve()) // Schema 初始化成功后 resolve
                    .catch(schemaErr => reject(schemaErr)); // Schema 初始化失败时 reject
            }
        });
    });
}

/**
 * 初始化数据库表结构。
 * 返回一个 Promise，在所有表和触发器创建完成后解析。
 */
function initializeDatabaseSchema() {
    return new Promise((resolve, reject) => {
        const createGroupsTableSQL = `
            CREATE TABLE IF NOT EXISTS groups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            );
        `;

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
                FOREIGN KEY (groupId) REFERENCES groups(id) ON DELETE SET NULL
            );
        `;
        const createWalletsUpdatedAtTriggerSQL = `
            CREATE TRIGGER IF NOT EXISTS update_wallets_updatedAt
            AFTER UPDATE ON wallets
            FOR EACH ROW
            BEGIN
                UPDATE wallets SET updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
            END;
        `;

        const createSocialAccountsTableSQL = `
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
        const createSocialAccountsUpdatedAtTriggerSQL = `
            CREATE TRIGGER IF NOT EXISTS update_social_accounts_updatedAt
            AFTER UPDATE ON social_accounts
            FOR EACH ROW
            BEGIN
                UPDATE social_accounts SET updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
            END;
        `;

        const createProxyConfigsTableSQL = `
            CREATE TABLE IF NOT EXISTS proxy_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT,                 -- 用户定义的名称/标识
                type TEXT NOT NULL,        -- 'http', 'https', 'socks5'
                host TEXT NOT NULL,        -- IP 地址或域名
                port INTEGER NOT NULL,     -- 端口号
                username TEXT,             -- 可选的用户名
                password TEXT,             -- 可选的密码
                ipProtocol TEXT DEFAULT 'ipv4', -- 'ipv4' or 'ipv6'
                ipQueryChannel TEXT DEFAULT 'ip-api', -- 用于测试的渠道
                status TEXT DEFAULT 'unknown', -- 'active', 'inactive', 'error', 'unknown'
                lastTestedAt TEXT,         -- 上次测试时间
                groupId INTEGER,           -- 外键关联 groups 表
                createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                updatedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                FOREIGN KEY (groupId) REFERENCES groups(id) ON DELETE SET NULL
            );
        `;
        const createProxyConfigsUpdatedAtTriggerSQL = `
            CREATE TRIGGER IF NOT EXISTS update_proxy_configs_updatedAt
            AFTER UPDATE ON proxy_configs
            FOR EACH ROW
            BEGIN
                UPDATE proxy_configs SET updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = OLD.id;
            END;
        `;

        db.serialize(() => {
            db.run(createGroupsTableSQL, handleSchemaError('groups table'))
              .run(createWalletsTableSQL, handleSchemaError('wallets table'))
              .run(createWalletsUpdatedAtTriggerSQL, handleSchemaError('wallets updatedAt trigger'))
              .run(createSocialAccountsTableSQL, handleSchemaError('social_accounts table'))
              .run(createSocialAccountsUpdatedAtTriggerSQL, handleSchemaError('social_accounts updatedAt trigger'))
              .run(createProxyConfigsTableSQL, handleSchemaError('proxy_configs table'))
              .run(createProxyConfigsUpdatedAtTriggerSQL, handleSchemaError('proxy_configs updatedAt trigger'))
              .run('SELECT 1', (err) => { // Dummy query to ensure serialization completes
                  if (err) {
                     console.error('Error during schema finalization check:', err.message);
                     return reject(err); // Reject if final check fails
                  }
                  console.log('Database schema initialized successfully.');
                  insertInitialData().then(resolve).catch(reject); // Insert initial data after schema is ready
              });
        });

        // Helper to handle schema creation errors
        function handleSchemaError(tableName) {
            return function(err) {
                if (err) {
                    console.error(`Error creating ${tableName}:`, err.message);
                    // Decide if we should reject the whole initialization or just log
                    // For now, log and continue, assuming IF NOT EXISTS handles it mostly
                    // reject(err); // Uncomment to make schema errors fatal
                } else {
                    console.log(`${tableName} is ready.`);
                }
            };
        }
    });
}

/**
 * 插入初始数据 (例如默认分组)。
 * 返回一个 Promise。
 */
function insertInitialData() {
    return new Promise((resolve, reject) => {
        const groupsStmt = db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)');
        const groupsToInsert = ['默认分组'];
        let completed = 0;
        let errors = [];

        groupsToInsert.forEach(name => groupsStmt.run(name, (errInsert) => {
            completed++;
            if (errInsert) {
                console.error(`Error inserting initial group ${name}:`, errInsert.message);
                errors.push(errInsert);
            }
            if (completed === groupsToInsert.length) {
                groupsStmt.finalize((errFinalize) => {
                    if (errFinalize) {
                        console.error('Error finalizing initial groups insert statement:', errFinalize.message);
                        errors.push(errFinalize);
                    }
                    if (errors.length > 0) {
                        console.warn('Errors occurred during initial data insertion.');
                        // Decide if this should cause a rejection
                        // reject(errors[0]); // Reject on first error
                    } else {
                        console.log('Initial groups inserted (or ignored if exist).');
                    }
                    resolve(); // Resolve even if there were non-fatal errors
                });
            }
        }));
    });
}


/**
 * 关闭数据库连接。
 * 在应用程序退出时调用。
 */
function closeDatabase() {
    // 检查 db 实例是否存在且已打开
    if (db && db.open) {
        console.log(`Closing database connection: ${dbPath}`);
        db.close((err) => {
            if (err) {
                console.error('Error closing database:', err.message);
            } else {
                console.log('Database connection closed successfully.');
            }
        });
    } else {
         console.log('Database connection already closed or not initialized.');
    }
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
 * 添加一个新的钱包记录。
 * @param {object} walletData - 包含钱包信息的对象。
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
 * 获取钱包列表，支持分页、排序和过滤。
 * @param {object} options - 查询选项 { limit, offset, sortBy, sortOrder, filterText, groupId }
 * @returns {Promise<{wallets: Array<object>, totalCount: number}>} - 返回钱包列表和总数。
 */
async function getWallets(options = {}) {
    let baseSql = `SELECT w.id, w.address, w.name, w.notes, w.groupId, w.encryptedPrivateKey, w.mnemonic, w.derivationPath, w.createdAt, w.updatedAt, g.name as groupName
                   FROM wallets w
                   LEFT JOIN groups g ON w.groupId = g.id`;
    const countSqlBase = `SELECT COUNT(*) as count FROM wallets w LEFT JOIN groups g ON w.groupId = g.id`;
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
    let offset = 0;
    if (options.limit !== undefined && options.offset !== undefined) {
        limitSql = ' LIMIT ? OFFSET ?';
        offset = options.offset;
    } else if (options.limit !== undefined) {
        limitSql = ' LIMIT ?';
    }

    const finalCountSql = countSqlBase + whereSql;
    const finalSql = baseSql + whereSql + orderBySql + limitSql;
    
    try {
        const countResult = await new Promise((resolveCount, rejectCount) => {
            db.get(finalCountSql, countParams, (errCount, rowCount) => {
                if (errCount) {
                    console.error('Error counting wallets:', errCount.message);
                    rejectCount(errCount);
                } else {
                    resolveCount(rowCount ? rowCount.count : 0);
                }
            });
        });
        const totalCount = countResult;

        const finalParams = [...params];
        if (limitSql === ' LIMIT ? OFFSET ?') {
            finalParams.push(options.limit, offset);
        } else if (limitSql === ' LIMIT ?') {
            finalParams.push(options.limit);
        }

        const wallets = await new Promise((resolveWallets, rejectWallets) => {
            db.all(finalSql, finalParams, (err, rows) => {
                if (err) {
                    console.error('Error getting wallets:', err.message);
                    rejectWallets(err);
                } else {
                    resolveWallets(rows);
                }
            });
        });
        
        return { wallets, totalCount };

    } catch (error) {
        console.error('Error in getWallets sequence:', error);
        throw error;
    }
}

/**
 * 根据 ID 获取单个钱包的详细信息。
 * @param {number} id - 钱包 ID。
 * @returns {Promise<object | null>} - 返回钱包对象或 null。
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
 * 根据 ID 列表获取多个钱包的详细信息。
 * @param {Array<number>} ids - 钱包 ID 列表。
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
 * 更新钱包信息。
 * @param {number} id - 要更新的钱包 ID。
 * @param {object} walletData - 包含要更新字段的对象。
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
 * 根据 ID 删除钱包。
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
 * 根据 ID 列表批量删除钱包。
 * @param {Array<number>} ids - 要删除的钱包 ID 列表。
 * @returns {Promise<number>} - 返回成功删除的行数。
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
 * @param {object} accountData - 包含账户信息的对象。
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
 * 获取社交账户列表，支持分页、排序和过滤。
 * @param {object} options - 查询选项 { limit, offset, sortBy, sortOrder, filterText, groupId }
 * @returns {Promise<{accounts: Array<object>, totalCount: number}>} - 返回账户列表和总数。
 */
async function getSocialAccounts(options = {}) {
    let baseSql = `SELECT sa.id, sa.platform, sa.username, sa.binding, sa.notes, sa.groupId, sa.createdAt, sa.updatedAt, g.name as groupName
                   FROM social_accounts sa
                   LEFT JOIN groups g ON sa.groupId = g.id`;
    const countSqlBase = `SELECT COUNT(*) as count FROM social_accounts sa LEFT JOIN groups g ON sa.groupId = g.id`;
    const whereClauses = [];
    const params = [];
    const countParams = [];

    if (options.platform) {
        whereClauses.push('LOWER(sa.platform) = LOWER(?)');
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
    let finalParams = [...params]; // Use separate params for the main query
    if (options.limit !== undefined && options.page !== undefined && options.page > 0) {
        const offset = (options.page - 1) * options.limit;
        limitSql = ' LIMIT ? OFFSET ?';
        finalParams.push(options.limit, offset);
    } else if (options.limit !== undefined) {
        limitSql = ' LIMIT ?';
        finalParams.push(options.limit);
    }

    const finalSql = baseSql + whereSql + orderBySql + limitSql;
    const finalCountSql = countSqlBase + whereSql;

    try {
        // 并行执行计数查询和数据查询
        const [countResult, accounts] = await Promise.all([
            new Promise((resolveCount, rejectCount) => {
                db.get(finalCountSql, countParams, (errCount, rowCount) => {
                    if (errCount) {
                        console.error('Error counting social accounts:', errCount.message);
                        rejectCount(errCount);
                    } else {
                        resolveCount(rowCount ? rowCount.count : 0);
                    }
                });
            }),
            new Promise((resolveAccounts, rejectAccounts) => {
                db.all(finalSql, finalParams, (err, rows) => {
                    if (err) {
                        console.error('Error getting social accounts:', err.message);
                        rejectAccounts(err);
                    } else {
                        resolveAccounts(rows);
                    }
                });
            })
        ]);

        return { accounts, totalCount: countResult };

    } catch (error) {
        console.error('Error in getSocialAccounts sequence:', error);
        throw error; // 将错误向上抛出，由调用者处理
    }
}

/**
 * 根据 ID 获取单个社交账户。
 * @param {number} id - 账户 ID。
 * @returns {Promise<object | null>} - 返回账户对象或 null。
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
 * 更新社交账户信息。
 * @param {number} id - 要更新的账户 ID。
 * @param {object} accountData - 包含要更新字段的对象。
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
 * 根据 ID 删除社交账户。
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
 * 根据 ID 列表批量删除社交账户。
 * @param {Array<number>} ids - 要删除的账户 ID 列表。
 * @returns {Promise<number>} - 返回成功删除的行数。
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

/**
 * 获取钱包总数。
 * @returns {Promise<number>} - 返回钱包总数。
 */
function countWallets() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT COUNT(*) as count FROM wallets`;
        db.get(sql, [], (err, row) => {
            if (err) {
                console.error('Error counting wallets:', err.message);
                reject(err);
            } else {
                resolve(row ? row.count : 0);
            }
        });
    });
}

/**
 * 获取社交账户总数。
 * @returns {Promise<number>} - 返回社交账户总数。
 */
function countSocialAccounts() {
    return new Promise((resolve, reject) => {
        const sql = `SELECT COUNT(*) as count FROM social_accounts`;
        db.get(sql, [], (err, row) => {
            if (err) {
                console.error('Error counting social accounts:', err.message);
                reject(err);
            } else {
                resolve(row ? row.count : 0);
            }
        });
    });
}

// ================= Proxy Configs CRUD ================

/**
 * 添加一个新的代理配置。
 * @param {object} configData - 包含代理配置信息的对象。
 * @returns {Promise<number>} - 返回新配置的 ID。
 */
function addProxyConfig(configData) {
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO proxy_configs
                     (name, type, host, port, username, password, ipProtocol, ipQueryChannel, groupId)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
            configData.name || null,
            configData.type,
            configData.host,
            configData.port,
            configData.username || null,
            configData.password || null,
            configData.ipProtocol || 'ipv4',
            configData.ipQueryChannel || 'ip-api',
            configData.groupId || null
        ];
        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error adding proxy config:', err.message);
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

/**
 * 获取代理配置列表，支持分页、排序和过滤。
 * @param {object} options - 查询选项 { limit, offset, sortBy, sortOrder, filterText, groupId }
 * @returns {Promise<{configs: Array<object>, totalCount: number}>} - 返回配置列表和总数。
 */
async function getProxyConfigs(options = {}) {
    let baseSql = `SELECT p.id, p.name, p.type, p.host, p.port, p.username, p.password, p.ipProtocol, p.ipQueryChannel, p.status, p.lastTestedAt, p.groupId, p.createdAt, p.updatedAt, g.name as groupName
                   FROM proxy_configs p
                   LEFT JOIN groups g ON p.groupId = g.id`;
    const countSqlBase = `SELECT COUNT(*) as count FROM proxy_configs p LEFT JOIN groups g ON p.groupId = g.id`;
    const whereClauses = [];
    const params = [];
    const countParams = [];

    if (options.type) {
        whereClauses.push('LOWER(p.type) = LOWER(?)');
        params.push(options.type);
        countParams.push(options.type);
    }
    if (options.groupId) {
        whereClauses.push('p.groupId = ?');
        params.push(options.groupId);
        countParams.push(options.groupId);
    }
    if (options.search) {
        const searchTerm = `%${options.search}%`;
        whereClauses.push('(p.name LIKE ? OR p.host LIKE ? OR p.port LIKE ? OR p.username LIKE ? OR g.name LIKE ?)');
        params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
        countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    let whereSql = '';
    if (whereClauses.length > 0) {
        whereSql = ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const sortBy = options.sortBy || 'createdAt';
    const allowedSortColumns = ['id', 'name', 'type', 'host', 'port', 'status', 'lastTestedAt', 'createdAt', 'updatedAt', 'groupName'];
    const safeSortBy = allowedSortColumns.includes(sortBy) ? (sortBy === 'groupName' ? 'g.name' : `p.${sortBy}`) : 'p.createdAt';
    const sortOrder = options.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const orderBySql = ` ORDER BY ${safeSortBy} ${sortOrder}`;

    let limitSql = '';
    let finalParams = [...params]; // Use separate params for the main query
    if (options.limit !== undefined && options.page !== undefined && options.page > 0) {
        const offset = (options.page - 1) * options.limit;
        limitSql = ' LIMIT ? OFFSET ?';
        finalParams.push(options.limit, offset);
    } else if (options.limit !== undefined) {
        limitSql = ' LIMIT ?';
        finalParams.push(options.limit);
    }

    const finalSql = baseSql + whereSql + orderBySql + limitSql;
    const finalCountSql = countSqlBase + whereSql;

    try {
        // 并行执行计数查询和数据查询
        const [countResult, configs] = await Promise.all([
            new Promise((resolveCount, rejectCount) => {
                db.get(finalCountSql, countParams, (errCount, rowCount) => {
                    if (errCount) {
                        console.error('Error counting proxy configs:', errCount.message);
                        rejectCount(errCount);
                    } else {
                        resolveCount(rowCount ? rowCount.count : 0);
                    }
                });
            }),
            new Promise((resolveConfigs, rejectConfigs) => {
                db.all(finalSql, finalParams, (err, rows) => {
                    if (err) {
                        console.error('Error getting proxy configs:', err.message);
                        rejectConfigs(err);
                    } else {
                        resolveConfigs(rows);
                    }
                });
            })
        ]);

        return { configs, totalCount: countResult };

    } catch (error) {
        console.error('Error in getProxyConfigs sequence:', error);
        throw error; // 将错误向上抛出
    }
}

// 导出需要在其他模块中使用的函数
module.exports = {
    initializeDatabaseConnection,
    closeDatabase,
    addGroup,
    getGroups,
    updateGroup,
    deleteGroup,
    addWallet,
    getWallets,
    getWalletById,
    getWalletsByIds,
    updateWallet,
    deleteWallet,
    deleteWalletsByIds,
    addSocialAccount,
    getSocialAccounts,
    getSocialAccountById,
    updateSocialAccount,
    deleteSocialAccount,
    deleteSocialAccountsByIds,
    countWallets,
    countSocialAccounts,
    addProxyConfig,
    getProxyConfigs
}; 