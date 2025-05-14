// 钱包（Wallets）相关数据库操作

/**
 * 添加新钱包
 * @param {object} walletData - 钱包信息对象
 * @returns {Promise<number>} - 返回新钱包ID
 */
function addWallet(db, walletData) {
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
 * 获取钱包列表，支持筛选、分页、排序
 * @param {object} [options={}] - 筛选和分页选项
 * @returns {Promise<{wallets: Array<object>, totalCount: number}>}
 */
async function getWallets(db, options = {}) {
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
 * 根据ID获取单个钱包
 * @param {number} id - 钱包ID
 * @returns {Promise<object|null>} - 钱包对象或null
 */
function getWalletById(db, id) {
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
                resolve(row || null);
            }
        });
    });
}

/**
 * 根据ID数组批量获取钱包
 * @param {Array<number>} ids - 钱包ID数组
 * @returns {Promise<Array<object>>}
 */
function getWalletsByIds(db, ids) {
    return new Promise((resolve, reject) => {
        if (!ids || ids.length === 0) {
            return resolve([]);
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
 * 更新钱包信息（部分字段可选）
 * @param {number} id - 钱包ID
 * @param {object} walletData - 要更新的字段对象
 * @returns {Promise<number>} - 受影响行数
 */
function updateWallet(db, id, walletData) {
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
            return resolve(0);
        }

        params.push(id);
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
 * 删除单个钱包
 * @param {number} id - 钱包ID
 * @returns {Promise<number>} - 受影响行数
 */
function deleteWallet(db, id) {
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
 * 批量删除钱包
 * @param {Array<number>} ids - 钱包ID数组
 * @returns {Promise<number>} - 成功删除数量
 */
function deleteWalletsByIds(db, ids) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(ids) || ids.length === 0) {
            return reject(new Error("Invalid input: IDs array cannot be empty."));
        }
        const placeholders = ids.map(() => '?').join(',');
        const sql = `DELETE FROM wallets WHERE id IN (${placeholders})`;
        db.run(sql, ids, function(err) {
            if (err) {
                console.error('Error deleting wallets by IDs:', err.message);
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

module.exports = {
    addWallet,
    getWallets,
    getWalletById,
    getWalletsByIds,
    updateWallet,
    deleteWallet,
    deleteWalletsByIds
}; 