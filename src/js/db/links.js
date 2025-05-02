/**
 * 获取指定钱包关联的所有社交账户
 * @param {sqlite3.Database} db - 数据库实例
 * @param {number} walletId - 钱包ID
 * @returns {Promise<Array<object>>} - 社交账户数组
 */
function getLinkedSocialsForWallet(db, walletId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT s.* 
            FROM social_accounts s
            JOIN wallet_social_links l ON s.id = l.socialId
            WHERE l.walletId = ?
            ORDER BY s.platform ASC, s.identifier ASC
        `;
        
        db.all(sql, [walletId], (err, rows) => {
            if (err) {
                console.error('Error getting linked socials:', err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * 获取所有社交账户，并标记哪些已与指定钱包关联
 * @param {sqlite3.Database} db - 数据库实例
 * @param {number} walletId - 钱包ID
 * @returns {Promise<Array<object>>} - 带有isLinked标记的社交账户数组
 */
function getAllSocialsWithLinkStatus(db, walletId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT 
                s.*, 
                CASE WHEN l.socialId IS NOT NULL THEN 1 ELSE 0 END as isLinked 
            FROM 
                social_accounts s
            LEFT JOIN 
                wallet_social_links l ON s.id = l.socialId AND l.walletId = ?
            ORDER BY 
                s.platform ASC, s.identifier ASC
        `;
        
        db.all(sql, [walletId], (err, rows) => {
            if (err) {
                console.error('Error getting socials with link status:', err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * 更新钱包与社交账户的关联
 * @param {sqlite3.Database} db - 数据库实例
 * @param {number} walletId - 钱包ID
 * @param {Array<number>} socialIds - 要关联的社交账户ID数组
 * @returns {Promise<{inserted: number, deleted: number}>} - 关联操作结果
 */
function linkSocialsToWallet(db, walletId, socialIds) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION');
            
            // 1. 删除现有关联
            db.run('DELETE FROM wallet_social_links WHERE walletId = ?', [walletId], function(err) {
                if (err) {
                    console.error('Error clearing existing links:', err.message);
                    db.run('ROLLBACK');
                    return reject(err);
                }
                
                const deletedCount = this.changes;
                
                // 如果没有新的关联要添加，则提交事务并返回
                if (!socialIds || socialIds.length === 0) {
                    db.run('COMMIT');
                    return resolve({ inserted: 0, deleted: deletedCount });
                }
                
                // 2. 插入新关联
                const stmt = db.prepare('INSERT INTO wallet_social_links (walletId, socialId) VALUES (?, ?)');
                let insertedCount = 0;
                let errorOccurred = false;
                
                for (const socialId of socialIds) {
                    stmt.run([walletId, socialId], function(err) {
                        if (err) {
                            // 忽略唯一约束错误（可能是重复添加），但记录其他错误
                            if (!err.message.includes('UNIQUE constraint failed')) {
                                console.error(`Error linking wallet ${walletId} to social ${socialId}:`, err.message);
                                errorOccurred = true;
                            }
                        } else {
                            insertedCount += this.changes;
                        }
                    });
                }
                
                stmt.finalize(function(err) {
                    if (err) {
                        console.error('Error finalizing statement:', err.message);
                        db.run('ROLLBACK');
                        reject(err);
                    } else if (errorOccurred) {
                        db.run('ROLLBACK');
                        reject(new Error('One or more errors occurred during linking'));
                    } else {
                        db.run('COMMIT');
                        resolve({ inserted: insertedCount, deleted: deletedCount });
                    }
                });
            });
        });
    });
}

module.exports = {
    getLinkedSocialsForWallet,
    getAllSocialsWithLinkStatus,
    linkSocialsToWallet
}; 