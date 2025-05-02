// 社交账户（Social Accounts）相关数据库操作

/**
 * 添加新社交账户 (已更新以适应新表结构)
 * @param {sqlite3.Database} db - 数据库实例
 * @param {object} accountData - 账户信息对象，包含 platform, identifier, password?, notes?, group_id?, twitter_2fa?, twitter_email?, email_recovery_email?, discord_token?, telegram_login_api?
 * @returns {Promise<number>} - 新账户ID
 */
function addSocialAccount(db, accountData) {
    // 注意：加密应该在调用此函数之前完成（例如在IPC Handler中）
    return new Promise((resolve, reject) => {
        const sql = `INSERT INTO social_accounts
                     (platform, identifier, password, notes, group_id, twitter_2fa, twitter_email, email_recovery_email, discord_token, telegram_login_api)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        const params = [
            accountData.platform,
            accountData.identifier, // 使用 identifier
            accountData.password || null,       // 新增: 密码 (应为加密后的)
            accountData.notes || null,
            accountData.group_id || null,     // 使用 group_id
            accountData.twitter_2fa || null,    // 新增: Twitter 2FA (应为加密后的)
            accountData.twitter_email || null,  // 新增: Twitter Email
            accountData.email_recovery_email || null, // 新增: Email Recovery Email
            accountData.discord_token || null,  // 新增: Discord Token (应为加密后的)
            accountData.telegram_login_api || null // 新增: Telegram API Info (应为加密后的)
        ];
        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error adding social account:', err.message);
                // 更新唯一约束检查
                if (err.message.includes('UNIQUE constraint failed: social_accounts.platform, social_accounts.identifier')) {
                    reject(new Error(`平台 "${accountData.platform}" 下已存在标识符 "${accountData.identifier}"`));
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
 * 获取社交账户列表，支持筛选、分页、排序 (已更新以适应新表结构)
 * @param {sqlite3.Database} db - 数据库实例
 * @param {object} [options={}] - 筛选和分页选项
 * @returns {Promise<{accounts: Array<object>, totalCount: number}>}
 */
function getSocialAccounts(db, options = {}) {
    // 注意：这里返回的是数据库中的原始数据，包括加密字段。
    // 解密应在需要显示时进行。
    return new Promise((resolve, reject) => {
        // 更新 SELECT 语句以包含新列，并使用正确的别名
        let baseSql = `SELECT sa.id, sa.platform, sa.identifier, sa.notes, sa.group_id, 
                              sa.password, sa.twitter_2fa, sa.twitter_email, sa.email_recovery_email, 
                              sa.discord_token, sa.telegram_login_api, 
                              sa.createdAt, sa.updatedAt, g.name as groupName
                       FROM social_accounts sa
                       LEFT JOIN groups g ON sa.group_id = g.id`; // 使用 group_id
        const countSql = `SELECT COUNT(*) as count FROM social_accounts sa LEFT JOIN groups g ON sa.group_id = g.id`; // 使用 group_id
        const whereClauses = [];
        const params = [];
        const countParams = [];

        if (options.platform) {
            whereClauses.push('LOWER(sa.platform) = LOWER(?)');
            params.push(options.platform);
            countParams.push(options.platform);
        }
        if (options.group_id) { // 使用 group_id
            whereClauses.push('sa.group_id = ?');
            params.push(options.group_id);
            countParams.push(options.group_id);
        }
         if (options.search) {
            const searchTerm = `%${options.search}%`;
            // 更新搜索字段：platform, identifier, notes, groupName (移除 binding)
            whereClauses.push('(sa.platform LIKE ? OR sa.identifier LIKE ? OR sa.notes LIKE ? OR g.name LIKE ?)');
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        let whereSql = '';
        if (whereClauses.length > 0) {
            whereSql = ` WHERE ${whereClauses.join(' AND ')}`;
        }

        const sortBy = options.sortBy || 'createdAt';
        // 更新允许排序的列 (移除 binding, username -> identifier)
        const allowedSortColumns = ['id', 'platform', 'identifier', 'notes', 'createdAt', 'updatedAt', 'groupName']; 
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
                        results.accounts = rows;
                        resolve(results);
                    }
                });
            });
        });
    });
}

/**
 * 根据ID获取单个社交账户 (已更新以适应新表结构)
 * @param {sqlite3.Database} db - 数据库实例
 * @param {number} id - 账户ID
 * @returns {Promise<object|null>}
 */
function getSocialAccountById(db, id) {
    // 注意：同样返回加密字段
    return new Promise((resolve, reject) => {
        // 更新 SELECT 语句
        const sql = `SELECT sa.id, sa.platform, sa.identifier, sa.notes, sa.group_id, 
                            sa.password, sa.twitter_2fa, sa.twitter_email, sa.email_recovery_email, 
                            sa.discord_token, sa.telegram_login_api, 
                            sa.createdAt, sa.updatedAt, g.name as groupName
                       FROM social_accounts sa
                       LEFT JOIN groups g ON sa.group_id = g.id 
                       WHERE sa.id = ?`; // 使用 group_id
        db.get(sql, [id], (err, row) => {
            if (err) {
                console.error(`Error getting social account by ID ${id}:`, err.message);
                reject(err);
            } else {
                resolve(row || null);
            }
        });
    });
}

/**
 * 更新社交账户信息 (已更新以适应新表结构)
 * @param {sqlite3.Database} db - 数据库实例
 * @param {number} id - 账户ID
 * @param {object} accountData - 要更新的字段对象 (字段名应为新结构)
 * @returns {Promise<number>} - 受影响行数
 */
function updateSocialAccount(db, id, accountData) {
    // 注意：同样，加密应在调用此函数前完成
    return new Promise((resolve, reject) => {
        const fields = [];
        const params = [];
        // 更新允许更新的 key
        const allowedKeys = [
            'platform', 'identifier', 'password', 'notes', 'group_id', 
            'twitter_2fa', 'twitter_email', 'email_recovery_email', 
            'discord_token', 'telegram_login_api'
        ];
        for (const key in accountData) {
            if (allowedKeys.includes(key) && Object.hasOwnProperty.call(accountData, key) && key !== 'id') {
                 const value = accountData[key];
                 // 允许更新为 null
                 if (value !== undefined) { 
                     fields.push(`${key} = ?`);
                     params.push(value);
                 }
            }
        }

        if (fields.length === 0) {
            return resolve(0); // 没有需要更新的字段
        }

        // 确保 updatedAt 会被触发器更新，这里不需要手动加
        params.push(id);
        const sql = `UPDATE social_accounts SET ${fields.join(', ')} WHERE id = ?`;

        db.run(sql, params, function(err) {
            if (err) {
                console.error('Error updating social account:', err.message);
                 // 更新唯一约束检查
                 if (err.message.includes('UNIQUE constraint failed: social_accounts.platform, social_accounts.identifier')) {
                    reject(new Error(`平台 "${accountData.platform}" 下已存在标识符 "${accountData.identifier}"`));
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
 * 删除单个社交账户
 * @param {sqlite3.Database} db - 数据库实例
 * @param {number} id - 账户ID
 * @returns {Promise<number>} - 受影响行数
 */
function deleteSocialAccount(db, id) {
    // 此函数无需修改，因为它只基于 id 操作
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
 * 批量删除社交账户
 * @param {sqlite3.Database} db - 数据库实例
 * @param {Array<number>} ids - 账户ID数组
 * @returns {Promise<number>} - 成功删除数量
 */
function deleteSocialAccountsByIds(db, ids) {
    // 此函数无需修改，因为它只基于 id 操作
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

module.exports = {
    addSocialAccount,
    getSocialAccounts,
    getSocialAccountById,
    updateSocialAccount,
    deleteSocialAccount,
    deleteSocialAccountsByIds
}; 