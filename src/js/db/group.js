// 分组（Groups）相关数据库操作

/**
 * 添加一个新的分组
 * @param {string} name - 分组名称
 * @returns {Promise<number>} - 返回新分组的ID
 */
function addGroup(db, name) {
    return new Promise((resolve, reject) => {
        const sql = 'INSERT INTO groups (name) VALUES (?)';
        db.run(sql, [name], function(err) {
            if (err) {
                console.error('Error adding group:', err.message);
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
    });
}

/**
 * 获取所有分组
 * @returns {Promise<Array<object>>} - 返回所有分组对象数组
 */
function getGroups(db) {
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
 * 更新分组名称
 * @param {number} id - 分组ID
 * @param {string} newName - 新分组名
 * @returns {Promise<number>} - 返回受影响的行数
 */
function updateGroup(db, id, newName) {
    return new Promise((resolve, reject) => {
        const sql = 'UPDATE groups SET name = ? WHERE id = ?';
        db.run(sql, [newName, id], function(err) {
            if (err) {
                console.error('Error updating group:', err.message);
                reject(err);
            } else {
                resolve(this.changes);
            }
        });
    });
}

/**
 * 删除分组（会将关联钱包的groupId设为NULL）
 * @param {number} id - 分组ID
 * @returns {Promise<number>} - 返回受影响的行数
 */
function deleteGroup(db, id) {
    return new Promise((resolve, reject) => {
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

module.exports = {
    addGroup,
    getGroups,
    updateGroup,
    deleteGroup
}; 