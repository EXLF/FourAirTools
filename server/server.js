const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3'); // 引入 SQLite 库

const app = express();
const PORT = 3001; // API 服务器端口

// --- 中间件 ---
// 托管 public 目录下的静态文件 (如 admin.html)
app.use(express.static(path.join(__dirname, 'public'))); 
// 解析 JSON 格式的请求体
app.use(express.json()); 
// 解析 URL 编码的请求体 (如果表单用传统方式提交)
app.use(express.urlencoded({ extended: true }));

// 数据库文件路径
const dbPath = path.join(__dirname, 'tutorials.db');

// 初始化数据库连接
let db;
try {
  db = new Database(dbPath);
  console.log(`成功连接数据库: ${dbPath}`);
} catch (err) {
  console.error(`连接数据库失败: ${err.message}`);
  process.exit(1); // 如果数据库连接失败，则退出程序
}

// 确保数据库表存在
function initDatabase() {
  try {
    // 创建教程表
    db.exec(`
      CREATE TABLE IF NOT EXISTS tutorials (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        url TEXT,
        imageUrl TEXT,
        createdAt TEXT DEFAULT (datetime('now')),
        updatedAt TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('数据库表初始化成功');
    return true;
  } catch (err) {
    console.error('数据库表初始化失败:', err);
    return false;
  }
}

// 启动时初始化数据库
initDatabase();

// --- API 端点 --- 

// GET /api/tutorials: 获取教程列表 (支持分页和搜索)
app.get('/api/tutorials', (req, res) => {
  try {
    // 分页参数 (来自查询字符串)
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10; // 默认每页 10 条
    const searchTerm = (req.query.search || '').toLowerCase().trim();
    const category = req.query.category || ''; // 新增：分类筛选
    const offset = (page - 1) * limit;

    let totalCount;
    let tutorials;
    let params = [];
    let whereClause = '';

    // 构建查询条件
    if (searchTerm && category && category !== 'all') {
      // 同时有搜索词和分类
      whereClause = 'WHERE (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(id) LIKE ?) AND category = ?';
      const searchPattern = `%${searchTerm}%`;
      params = [searchPattern, searchPattern, searchPattern, category];
    } else if (searchTerm) {
      // 只有搜索词
      whereClause = 'WHERE LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(id) LIKE ?';
      const searchPattern = `%${searchTerm}%`;
      params = [searchPattern, searchPattern, searchPattern];
    } else if (category && category !== 'all') {
      // 只有分类
      whereClause = 'WHERE category = ?';
      params = [category];
    }

    // 获取总数
    const countQuery = `SELECT COUNT(*) as count FROM tutorials ${whereClause}`;
    totalCount = db.prepare(countQuery).get(...params).count;
    
    // 获取分页数据
    const dataQuery = `
      SELECT * FROM tutorials 
      ${whereClause}
      ORDER BY updatedAt DESC
      LIMIT ? OFFSET ?
    `;
    
    params.push(limit, offset);
    tutorials = db.prepare(dataQuery).all(...params);

    // 计算分页信息
    const totalPages = Math.ceil(totalCount / limit);

    // 返回分页结果
    res.json({
      tutorials: tutorials,
      totalItems: totalCount,
      totalPages: totalPages,
      currentPage: page,
      limit: limit
    });
  } catch (err) {
    console.error("获取教程列表失败:", err);
    res.status(500).json({ error: `获取教程列表失败: ${err.message}` });
  }
});

// POST /api/tutorials: 新增教程 (自动生成 ID)
app.post('/api/tutorials', (req, res) => {
  try {
    const tutorialData = req.body; // 获取请求体

    // 基本验证
    if (!tutorialData || !tutorialData.title || !tutorialData.category || !tutorialData.description) {
      return res.status(400).json({ error: '缺少必要的教程字段 (title, category, description)' });
    }
    
    // 生成新的 UUID
    const newTutorialId = uuidv4();
    const now = new Date().toISOString();

    // 插入数据
    const stmt = db.prepare(`
      INSERT INTO tutorials (id, title, description, category, url, imageUrl, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const info = stmt.run(
      newTutorialId,
      tutorialData.title,
      tutorialData.description,
      tutorialData.category,
      tutorialData.url || '',
      tutorialData.imageUrl || '',
      now,
      now
    );

    if (info.changes !== 1) {
      throw new Error('插入数据失败');
    }

    // 查询新插入的数据
    const newTutorial = db.prepare('SELECT * FROM tutorials WHERE id = ?').get(newTutorialId);
    
    console.log("新教程已添加:", newTutorial);
    res.status(201).json(newTutorial);
  } catch (err) {
    console.error("添加教程失败:", err);
    res.status(500).json({ error: `添加教程失败: ${err.message}` });
  }
});

// DELETE /api/tutorials/:id : 删除教程
app.delete('/api/tutorials/:id', (req, res) => {
  try {
    const tutorialIdToDelete = req.params.id;
    console.log('请求删除教程 ID:', tutorialIdToDelete);

    // 检查教程是否存在
    const tutorial = db.prepare('SELECT id FROM tutorials WHERE id = ?').get(tutorialIdToDelete);
    if (!tutorial) {
      return res.status(404).json({ error: `教程 ID '${tutorialIdToDelete}' 未找到` });
    }

    // 删除教程
    const info = db.prepare('DELETE FROM tutorials WHERE id = ?').run(tutorialIdToDelete);
    
    if (info.changes !== 1) {
      throw new Error('删除失败');
    }

    console.log(`教程 ID '${tutorialIdToDelete}' 已删除`);
    res.status(200).json({ message: '教程删除成功' });
  } catch (err) {
    console.error("删除教程失败:", err);
    res.status(500).json({ error: `删除教程失败: ${err.message}` });
  }
});

// PUT /api/tutorials/:id : 更新教程
app.put('/api/tutorials/:id', (req, res) => {
  try {
    const tutorialIdToUpdate = req.params.id;
    const updatedData = req.body;
    console.log(`请求更新教程 ID '${tutorialIdToUpdate}' 的数据`);

    // 基本验证
    if (!updatedData || !updatedData.title || !updatedData.category || !updatedData.description) {
      return res.status(400).json({ error: '缺少必要的教程字段 (title, category, description)' });
    }

    // 检查教程是否存在
    const tutorial = db.prepare('SELECT id FROM tutorials WHERE id = ?').get(tutorialIdToUpdate);
    if (!tutorial) {
      return res.status(404).json({ error: `教程 ID '${tutorialIdToUpdate}' 未找到` });
    }

    // 更新教程
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE tutorials 
      SET title = ?, description = ?, category = ?, url = ?, imageUrl = ?, updatedAt = ?
      WHERE id = ?
    `);

    const info = stmt.run(
      updatedData.title,
      updatedData.description, 
      updatedData.category,
      updatedData.url || '',
      updatedData.imageUrl || '',
      now,
      tutorialIdToUpdate
    );

    if (info.changes !== 1) {
      throw new Error('更新失败');
    }

    // 获取更新后的数据
    const updatedTutorial = db.prepare('SELECT * FROM tutorials WHERE id = ?').get(tutorialIdToUpdate);
    
    console.log(`教程 ID '${tutorialIdToUpdate}' 已更新`);
    res.status(200).json(updatedTutorial);
  } catch (err) {
    console.error("更新教程失败:", err);
    res.status(500).json({ error: `更新教程失败: ${err.message}` });
  }
});

// 增加一个API端点用于获取单个教程详情
app.get('/api/tutorials/:id', (req, res) => {
  try {
    const tutorialId = req.params.id;
    
    // 查询教程
    const tutorial = db.prepare('SELECT * FROM tutorials WHERE id = ?').get(tutorialId);
    
    if (!tutorial) {
      return res.status(404).json({ error: `教程 ID '${tutorialId}' 未找到` });
    }
    
    res.json(tutorial);
  } catch (err) {
    console.error("获取教程详情失败:", err);
    res.status(500).json({ error: `获取教程详情失败: ${err.message}` });
  }
});

// 启动服务器
app.listen(PORT, '0.0.0.0', () => {
  console.log(`教程API服务器运行在 http://0.0.0.0:${PORT}`);
  console.log(`对外服务地址: http://106.75.5.215:${PORT}`);
  console.log(`管理界面地址: http://106.75.5.215:${PORT}/admin.html`);
});

// 优雅退出时关闭数据库连接
process.on('SIGINT', () => {
  if (db) {
    console.log('关闭数据库连接...');
    db.close();
  }
  console.log('服务器已关闭');
  process.exit(0);
}); 