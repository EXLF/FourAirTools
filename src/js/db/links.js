/**
 * 获取指定钱包关联的所有社交账户信息
 * @param {sqlite3.Database} db - 数据库实例
 * @param {number} walletId - 钱包 ID
 * @returns {Promise<Array<object>>} - 关联的社交账户对象数组
 */
function getLinkedSocialsForWallet(db, walletId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT s.* FROM social_accounts s
            JOIN wallet_social_links l ON s.id = l.socialId
            WHERE l.walletId = ?
            ORDER BY s.platform, s.username;
        `;
        db.all(sql, [walletId], (err, rows) => {
            if (err) {
                console.error(`Error getting linked socials for wallet ${walletId}:`, err.message);
                reject(new Error('查询关联社交账户失败'));
            } else {
                resolve(rows);
            }
        });
    });
}

/**
 * 更新指定钱包的社交账户关联
 * 先删除该钱包所有旧关联，然后插入新关联
 * @param {sqlite3.Database} db - 数据库实例
 * @param {number} walletId - 钱包 ID
 * @param {Array<number>} socialIds - 要关联的社交账户 ID 数组
 * @returns {Promise<void>}
 */
function linkSocialsToWallet(db, walletId, socialIds = []) {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            db.run('BEGIN TRANSACTION;', (errBegin) => {
                if (errBegin) return reject(new Error('开启事务失败: ' + errBegin.message));

                // 1. 删除旧关联
                const deleteSQL = 'DELETE FROM wallet_social_links WHERE walletId = ?';
                db.run(deleteSQL, [walletId], function(errDelete) {
                    if (errDelete) {
                        console.error(`Error deleting old links for wallet ${walletId}:`, errDelete.message);
                        return db.run('ROLLBACK;', () => reject(new Error('删除旧关联失败')));
                    }

                    // 2. 插入新关联 (如果 socialIds 非空)
                    if (socialIds && socialIds.length > 0) {
                        const insertSQL = 'INSERT INTO wallet_social_links (walletId, socialId) VALUES (?, ?)';
                        const stmt = db.prepare(insertSQL, (errPrepare) => {
                           if (errPrepare) return db.run('ROLLBACK;', () => reject(new Error('准备插入语句失败: ' + errPrepare.message)));
                        });

                        let completedInserts = 0;
                        let insertError = null;

                        socialIds.forEach(socialId => {
                            stmt.run(walletId, socialId, function(errInsert) {
                                completedInserts++;
                                if (errInsert) {
                                    console.error(`Error inserting link for wallet ${walletId} and social ${socialId}:`, errInsert.message);
                                    insertError = errInsert; // 记录第一个错误
                                }

                                // 所有插入尝试完成后（无论成功或失败）
                                if (completedInserts === socialIds.length) {
                                    stmt.finalize((errFinalize) => {
                                        if (errFinalize) console.error('Error finalizing insert statement:', errFinalize.message);

                                        if (insertError) {
                                            db.run('ROLLBACK;', () => reject(new Error('插入新关联失败: ' + insertError.message)));
                                        } else {
                                            db.run('COMMIT;', (errCommit) => {
                                                if (errCommit) return reject(new Error('提交事务失败: ' + errCommit.message));
                                                resolve(); // 成功
                                            });
                                        }
                                    });
                                }
                            });
                        });
                    } else {
                        // 如果 socialIds 为空，直接提交事务（仅删除了旧关联）
                         db.run('COMMIT;', (errCommit) => {
                             if (errCommit) return reject(new Error('提交事务失败: ' + errCommit.message));
                             resolve(); // 成功
                         });
                    }
                });
            });
        });
    });
}


/**
 * 获取所有社交账户列表，并标记哪些已与指定钱包关联
 * @param {sqlite3.Database} db - 数据库实例
 * @param {number} walletId - 要检查关联状态的钱包 ID
 * @returns {Promise<Array<object>>} - 包含所有社交账户的对象数组，每个对象增加 `isLinked` 属性 (boolean)
 */
function getAllSocialsWithLinkStatus(db, walletId) {
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT 
                s.*, 
                CASE 
                    WHEN l.walletId IS NOT NULL THEN 1 
                    ELSE 0 
                END AS isLinked
            FROM social_accounts s
            LEFT JOIN wallet_social_links l ON s.id = l.socialId AND l.walletId = ?
            ORDER BY s.platform, s.username;
        `;
        db.all(sql, [walletId], (err, rows) => {
            if (err) {
                console.error(`Error getting all socials with link status for wallet ${walletId}:`, err.message);
                reject(new Error('查询社交账户关联状态失败'));
            } else {
                // 将 isLinked 从 1/0 转换为 true/false
                const results = rows.map(row => ({
                    ...row,
                    isLinked: Boolean(row.isLinked)
                }));
                resolve(results);
            }
        });
    });
}


module.exports = {
    getLinkedSocialsForWallet,
    linkSocialsToWallet,
    getAllSocialsWithLinkStatus
}; 