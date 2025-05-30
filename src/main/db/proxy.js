const cryptoService = require('../core/cryptoService'); // 导入加密服务

/**
 * 检查IP是否已存在于数据库中。
 * @param {sqlite3.Database} db - 数据库实例。
 * @param {string} host - 要检查的IP地址。
 * @returns {Promise<boolean>} 如果IP已存在返回true，否则返回false。
 */
async function checkIPExists(db, host) {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT COUNT(*) as count FROM proxies WHERE host = ?';
        db.get(sql, [host], (err, row) => {
            if (err) {
                reject(new Error(`检查IP是否存在失败: ${err.message}`));
            } else {
                resolve(row.count > 0);
            }
        });
    });
}

/**
 * 添加一个新的代理配置到数据库。
 * @param {sqlite3.Database} db - 数据库实例。
 * @param {object} proxyData - 代理数据对象，包含 name, type, host, port, [username], [password], [group_id]。
 * @returns {Promise<{id: number}>} 插入行的 ID。
 * @throws {Error} 如果插入失败或密码加密失败。
 */
async function addProxy(db, proxyData) {
    return new Promise(async (resolve, reject) => {
        let { type, host, port, username, password, group_id } = proxyData;

        // 检查必填字段
        if (!type || !host || !port) {
            return reject(new Error('缺少必要的代理信息 (type, host, port)'));
        }

        try {
            // 检查IP是否已存在
            const exists = await checkIPExists(db, host);
            if (exists) {
                return reject(new Error(`IP ${host} 已存在，不能重复添加`));
            }

            // 加密密码（如果提供）
            if (password && typeof password === 'string' && password.length > 0) {
                if (!cryptoService.isUnlocked()) {
                    return reject(new Error('应用未解锁，无法加密代理密码。'));
                }
                try {
                    password = cryptoService.encryptWithSessionKey(password);
                } catch (encError) {
                    console.error('加密代理密码失败:', encError);
                    return reject(new Error('加密代理密码失败。'));
                }
            } else {
                password = null; // 确保空密码或无效密码存为 null
            }

            // 获取当前最大ID，用于生成新的name
            db.get('SELECT MAX(id) as maxId FROM proxies', [], function(err, row) {
                if (err) {
                    return reject(new Error(`获取最大ID失败: ${err.message}`));
                }
                
                const nextId = (row.maxId || 0) + 1;
                const name = `#${nextId}`;

                const sql = `INSERT INTO proxies (name, type, host, port, username, password, group_id)
                            VALUES (?, ?, ?, ?, ?, ?, ?)`;
                const params = [name, type, host, port, username || null, password, group_id || null];

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
        } catch (error) {
            reject(error);
        }
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
            const dataSql = `
                SELECT
                    p.id, p.name, p.type, p.host, p.port, p.username, p.password, p.group_id,
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
 * 根据 ID 获取单个代理的详细信息。
 * @param {sqlite3.Database} db - 数据库实例。
 * @param {number} id - 代理 ID。
 * @returns {Promise<object|null>} 代理数据对象或 null。
 * @throws {Error} 如果查询失败。
 */
async function getProxyById(db, id) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT p.*, g.name as group_name
                     FROM proxies p
                     LEFT JOIN groups g ON p.group_id = g.id
                     WHERE p.id = ?`;
        db.get(sql, [id], async (err, proxy) => {
            if (err) {
                console.error(`查询代理 ID ${id} 失败:`, err.message);
                return reject(new Error(`查询代理失败: ${err.message}`));
            }
            // 不再在此处解密，直接返回数据库中的数据 (password 字段现在是加密的)
            // 解密操作将移至 IPC Handler
            resolve(proxy); // proxy 可能为 null 如果未找到
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

        // 处理密码字段的特殊情况：如果密码是 null、空字符串或 'null' 字符串，则设为 NULL
        if (updates.hasOwnProperty('password')) {
            if (updates.password === null || updates.password === '' || updates.password === 'null') {
                updates.password = null; // 清除密码，确保存储的是 NULL
            } else if (typeof updates.password === 'string' && updates.password.length > 0) {
                // 如果提供了新密码，则加密
                if (!cryptoService.isUnlocked()) {
                    return reject(new Error('应用未解锁，无法加密代理密码以进行更新。'));
                }
                try {
                    updates.password = cryptoService.encryptWithSessionKey(updates.password);
                } catch (encError) {
                    console.error('更新时加密代理密码失败:', encError);
                    return reject(new Error('更新时加密代理密码失败。'));
                }
            } else {
                // 如果密码字段存在但不是有效字符串或null/空，则忽略该更新 (不修改密码)
                delete updates.password;
            }
        }

        for (const key of allowedUpdates) {
            if (updates.hasOwnProperty(key)) {
                 // 特殊处理 group_id 为 '' 或 null 的情况，确保存入 NULL
                 if (key === 'group_id' && (updates[key] === '' || updates[key] === null)) {
                    setClauses.push('group_id = ?');
                    params.push(null);
                 } else {
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
    deleteProxiesByIds,
    checkIPExists
}; 