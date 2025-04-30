const cryptoService = require('../core/cryptoService'); // 导入加密服务

/**
 * 添加一个新的代理配置到数据库。
 * @param {sqlite3.Database} db - 数据库实例。
 * @param {object} proxyData - 代理数据对象，包含 name, type, host, port, [username], [password], [group_id]。
 * @returns {Promise<{id: number}>} 插入行的 ID。
 * @throws {Error} 如果插入失败或密码加密失败。
 */
async function addProxy(db, proxyData) {
    return new Promise(async (resolve, reject) => {
        const { name, type, host, port, username, password, group_id } = proxyData;

        // 检查必填字段
        if (!name || !type || !host || !port) {
            return reject(new Error('缺少必要的代理信息 (name, type, host, port)'));
        }

        // 加密密码（如果存在）
        let encryptedPassword = null;
        if (password) {
            try {
                if (!cryptoService.isUnlocked()) {
                    return reject(new Error('加密服务未解锁，无法添加带密码的代理'));
                }
                encryptedPassword = await cryptoService.encryptWithSessionKey(password);
            } catch (error) {
                console.error('加密代理密码失败:', error);
                return reject(new Error('加密代理密码失败'));
            }
        }

        const sql = `INSERT INTO proxies (name, type, host, port, username, password, group_id)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const params = [name, type, host, port, username || null, encryptedPassword, group_id || null];

        db.run(sql, params, function(err) {
            if (err) {
                console.error('添加代理到数据库失败:', err.message);
                reject(new Error(`添加代理失败: ${err.message}`));
            } else {
                console.log(`添加代理成功，ID: ${this.lastID}`);
                resolve({ id: this.lastID });
            }
        });
    });
}

/**
 * 查询代理列表，支持分页、筛选和排序。
 * @param {sqlite3.Database} db - 数据库实例。
 * @param {object} options - 查询选项。
 * @param {number} [options.page=1] - 当前页码。
 * @param {number} [options.limit=10] - 每页数量。
 * @param {string} [options.sortBy='created_at'] - 排序字段。
 * @param {string} [options.sortOrder='DESC'] - 排序顺序 ('ASC' 或 'DESC')。
 * @param {number} [options.groupId] - 按分组 ID 筛选。
 * @param {string} [options.type] - 按代理类型筛选。
 * @param {string} [options.status] - 按状态筛选。
 * @param {string} [options.search] - 搜索关键字 (匹配 name, host, exit_ip, organization)。
 * @returns {Promise<{proxies: object[], total: number}>} 代理列表和总数。
 */
async function getProxies(db, options = {}) {
    return new Promise((resolve, reject) => {
        const {
            page = 1,
            limit = 10,
            sortBy = 'created_at',
            sortOrder = 'DESC',
            groupId,
            type,
            status,
            search
        } = options;

        const offset = (page - 1) * limit;
        const validSortColumns = ['id', 'name', 'type', 'host', 'port', 'status', 'latency', 'risk_score', 'last_checked_at', 'created_at', 'updated_at'];
        const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'created_at';
        const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

        let whereClauses = [];
        let params = [];
        let countParams = [];

        if (groupId !== undefined && groupId !== null && groupId !== 'all') {
            whereClauses.push('p.group_id = ?');
            params.push(groupId);
            countParams.push(groupId);
        }
        if (type && type !== 'all') {
            whereClauses.push('p.type = ?');
            params.push(type);
            countParams.push(type);
        }
        if (status && status !== 'all') {
            whereClauses.push('p.status = ?');
            params.push(status);
            countParams.push(status);
        }
         if (search) {
            const searchTerm = `%${search}%`;
            whereClauses.push('(p.name LIKE ? OR p.host LIKE ? OR p.exit_ip LIKE ? OR p.organization LIKE ?)');
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
            countParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // 查询总数
        const countSql = `SELECT COUNT(*) as total FROM proxies p ${whereSql}`;
        db.get(countSql, countParams, (err, row) => {
            if (err) {
                console.error('查询代理总数失败:', err.message);
                return reject(new Error(`查询代理总数失败: ${err.message}`));
            }
            const total = row ? row.total : 0;

            // 查询分页数据
            // 注意：不直接选择 password 字段
            const dataSql = `
                SELECT
                    p.id, p.name, p.type, p.host, p.port, p.username, p.group_id,
                    p.is_enabled, p.status, p.latency, p.exit_ip, p.country, p.country_code,
                    p.region, p.city, p.organization, p.asn, p.risk_level, p.risk_score,
                    p.last_checked_at, p.created_at, p.updated_at,
                    g.name as group_name
                FROM proxies p
                LEFT JOIN groups g ON p.group_id = g.id
                ${whereSql}
                ORDER BY p.${sortColumn} ${sortDirection}
                LIMIT ? OFFSET ?
            `;
            const dataParams = [...params, limit, offset];

            db.all(dataSql, dataParams, (err, proxies) => {
                if (err) {
                    console.error('查询代理列表失败:', err.message);
                    reject(new Error(`查询代理列表失败: ${err.message}`));
                } else {
                    resolve({ proxies, total });
                }
            });
        });
    });
}

/**
 * 根据 ID 获取单个代理的详细信息，包括解密后的密码。
 * @param {sqlite3.Database} db - 数据库实例。
 * @param {number} id - 代理 ID。
 * @returns {Promise<object|null>} 代理数据对象或 null。
 * @throws {Error} 如果查询失败或密码解密失败。
 */
async function getProxyById(db, id) {
    return new Promise((resolve, reject) => {
        // 查询时包含加密的密码字段
        const sql = `SELECT p.*, g.name as group_name
                     FROM proxies p
                     LEFT JOIN groups g ON p.group_id = g.id
                     WHERE p.id = ?`;
        db.get(sql, [id], async (err, proxy) => {
            if (err) {
                console.error(`查询代理 ID ${id} 失败:`, err.message);
                return reject(new Error(`查询代理失败: ${err.message}`));
            }
            if (!proxy) {
                return resolve(null); // 未找到
            }

            // 解密密码（如果存在且加密服务已解锁）
            if (proxy.password && cryptoService.isUnlocked()) {
                try {
                    proxy.decryptedPassword = await cryptoService.decryptWithSessionKey(proxy.password);
                } catch (error) {
                    console.error(`解密代理 ID ${id} 的密码失败:`, error);
                    // 不应直接拒绝，可能只是解密服务问题，返回不带解密密码的数据
                    // return reject(new Error('解密代理密码失败'));
                    console.warn(`代理 ID ${id} 的密码无法解密，可能加密服务未正确初始化或密码已损坏`);
                    proxy.decryptedPassword = null; // 或标记为解密失败
                }
            } else if (proxy.password && !cryptoService.isUnlocked()) {
                 console.warn(`加密服务未解锁，无法解密代理 ID ${id} 的密码`);
                 proxy.decryptedPassword = null;
            }

            resolve(proxy);
        });
    });
}

/**
 * 更新指定 ID 的代理信息。
 * @param {sqlite3.Database} db - 数据库实例。
 * @param {number} id - 要更新的代理 ID。
 * @param {object} updates - 包含要更新字段的对象。例如 { name, host, port, status, latency, exit_ip, ... }。
 *                           如果包含 password 字段，将加密后更新。
 * @returns {Promise<{changes: number}>} 更新的行数。
 * @throws {Error} 如果更新失败或密码加密失败。
 */
async function updateProxy(db, id, updates) {
    return new Promise(async (resolve, reject) => {
        const allowedUpdates = [
            'name', 'type', 'host', 'port', 'username', 'password', 'group_id',
            'is_enabled', 'status', 'latency', 'exit_ip', 'country', 'country_code',
            'region', 'city', 'organization', 'asn', 'risk_level', 'risk_score',
            'last_checked_at'
        ];
        let setClauses = [];
        let params = [];

        // 处理密码加密
        if (updates.password !== undefined) {
            if (updates.password === null || updates.password === '') {
                // 清除密码
                 updates.password = null; // 确保存储的是 NULL
            } else if (typeof updates.password === 'string' && updates.password.length > 0) {
                // 加密新密码
                try {
                    if (!cryptoService.isUnlocked()) {
                         return reject(new Error('加密服务未解锁，无法更新密码'));
                    }
                    updates.password = await cryptoService.encryptWithSessionKey(updates.password);
                } catch (error) {
                    console.error(`加密代理 ID ${id} 的新密码失败:`, error);
                    return reject(new Error('加密代理密码失败'));
                }
            } else {
                // 如果密码字段存在但不是有效字符串或null/空，则忽略该更新
                delete updates.password;
            }
        }


        for (const key of allowedUpdates) {
            if (updates.hasOwnProperty(key)) {
                 // 特殊处理 group_id 为 '' 或 null 的情况，确保存入 NULL
                 if (key === 'group_id' && (updates[key] === '' || updates[key] === null)) {
                    setClauses.push('group_id = ?');
                    params.push(null);
                 } else if (key === 'password') {
                    setClauses.push('password = ?');
                    params.push(updates.password); // 使用上面处理过的加密密码或 null
                 }
                 else {
                     setClauses.push(`${key} = ?`);
                     params.push(updates[key]);
                 }
            }
        }

        // 如果没有有效更新，则直接返回
        if (setClauses.length === 0) {
            return resolve({ changes: 0 });
        }

        // 自动更新 updated_at (触发器处理)
        const sql = `UPDATE proxies SET ${setClauses.join(', ')} WHERE id = ?`;
        params.push(id);

        db.run(sql, params, function(err) {
            if (err) {
                console.error(`更新代理 ID ${id} 失败:`, err.message);
                reject(new Error(`更新代理失败: ${err.message}`));
            } else {
                console.log(`更新代理 ID ${id} 成功，影响行数: ${this.changes}`);
                resolve({ changes: this.changes });
            }
        });
    });
}

/**
 * 根据 ID 删除单个代理。
 * @param {sqlite3.Database} db - 数据库实例。
 * @param {number} id - 要删除的代理 ID。
 * @returns {Promise<{changes: number}>} 删除的行数。
 */
async function deleteProxy(db, id) {
    return new Promise((resolve, reject) => {
        const sql = 'DELETE FROM proxies WHERE id = ?';
        db.run(sql, [id], function(err) {
            if (err) {
                console.error(`删除代理 ID ${id} 失败:`, err.message);
                reject(new Error(`删除代理失败: ${err.message}`));
            } else {
                console.log(`删除代理 ID ${id} 成功，影响行数: ${this.changes}`);
                resolve({ changes: this.changes });
            }
        });
    });
}

/**
 * 根据 ID 列表批量删除代理。
 * @param {sqlite3.Database} db - 数据库实例。
 * @param {number[]} ids - 要删除的代理 ID 数组。
 * @returns {Promise<{deletedCount: number}>} 实际删除的数量。
 */
async function deleteProxiesByIds(db, ids) {
    return new Promise((resolve, reject) => {
        if (!Array.isArray(ids) || ids.length === 0) {
            return resolve({ deletedCount: 0 });
        }
        const placeholders = ids.map(() => '?').join(',');
        const sql = `DELETE FROM proxies WHERE id IN (${placeholders})`;

        db.run(sql, ids, function(err) {
            if (err) {
                console.error('批量删除代理失败:', err.message);
                reject(new Error(`批量删除代理失败: ${err.message}`));
            } else {
                console.log(`批量删除代理成功，影响行数: ${this.changes}`);
                resolve({ deletedCount: this.changes });
            }
        });
    });
}


module.exports = {
    addProxy,
    getProxies,
    getProxyById,
    updateProxy,
    deleteProxy,
    deleteProxiesByIds
}; 