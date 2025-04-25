// 社交账户（Social Accounts）相关数据库操作

/**
 * 添加新社交账户
 * @param {object} accountData - 账户信息对象
 * @returns {Promise<number>} - 新账户ID
 */
function addSocialAccount(db, accountData) {
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
 * 获取社交账户列表，支持筛选、分页、排序
 * @param {object} [options={}] - 筛选和分页选项
 * @returns {Promise<{accounts: Array<object>, totalCount: number}>}
 */
function getSocialAccounts(db, options = {}) {
    return new Promise((resolve, reject) => {
        let baseSql = `SELECT sa.id, sa.platform, sa.username, sa.binding, sa.notes, sa.groupId, sa.createdAt, sa.updatedAt, g.name as groupName
                       FROM social_accounts sa
                       LEFT JOIN groups g ON sa.groupId = g.id`;
        const countSql = `SELECT COUNT(*) as count FROM social_accounts sa LEFT JOIN groups g ON sa.groupId = g.id`;
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
 * 根据ID获取单个社交账户
 * @param {number} id - 账户ID
 * @returns {Promise<object|null>}
 */
function getSocialAccountById(db, id) {
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
                resolve(row || null);
            }
        });
    });
}

/**
 * 更新社交账户信息
 * @param {number} id - 账户ID
 * @param {object} accountData - 要更新的字段对象
 * @returns {Promise<number>} - 受影响行数
 */
function updateSocialAccount(db, id, accountData) {
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
            return resolve(0);
        }

        params.push(id);
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
 * 删除单个社交账户
 * @param {number} id - 账户ID
 * @returns {Promise<number>} - 受影响行数
 */
function deleteSocialAccount(db, id) {
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
 * @param {Array<number>} ids - 账户ID数组
 * @returns {Promise<number>} - 成功删除数量
 */
function deleteSocialAccountsByIds(db, ids) {
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