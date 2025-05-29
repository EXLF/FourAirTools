const express = require('express');
const path = require('path');
const db = require('./models'); // 引入 Sequelize 实例和模型
const { Op } = require('sequelize'); // 引入 Sequelize 操作符

const app = express();
const PORT = 3001; // API 服务器端口

// --- 中间件 ---
// 托管 public 目录下的静态文件 (如 admin.html)
app.use(express.static(path.join(__dirname, 'public'))); 
// 解析 JSON 格式的请求体
app.use(express.json()); 
// 解析 URL 编码的请求体 (如果表单用传统方式提交)
app.use(express.urlencoded({ extended: true }));

// 数据库初始化函数 (使用 Sequelize)
async function initDatabase() {
  try {
    // await db.sequelize.sync({ force: true }); // 开发时：删除并重建表
    await db.sequelize.sync(); // 生产或日常：创建表（如果不存在）并应用模型中的索引
    console.log('数据库表初始化/同步成功 (Sequelize)');
    return true;
  } catch (err) {
    console.error('数据库表初始化/同步失败 (Sequelize):', err);
    return false;
  }
}

// 启动时初始化数据库
initDatabase().then(success => {
  if (!success) {
    console.error("关键：数据库未能成功初始化，服务可能无法正常工作。");
    // 考虑是否在数据库初始化失败时退出程序
    // process.exit(1);
  }
});

// --- API 端点 (使用 Sequelize 重写) --- 

// GET /api/tutorials: 获取教程列表 (支持分页和搜索)
app.get('/api/tutorials', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const searchTerm = (req.query.search || '').toLowerCase().trim();
    const category = req.query.category || '';
    const offset = (page - 1) * limit;

    let whereClause = {};
    const searchConditions = [];

    if (searchTerm) {
      const searchPattern = `%${searchTerm}%`;
      searchConditions.push(
        { title: { [Op.like]: searchPattern } },
        { description: { [Op.like]: searchPattern } }
        // 如果 id 是 UUID 字符串，并且希望按部分 UUID 搜索，可以取消下面的注释
        // { id: { [Op.like]: searchPattern } }
      );
    }

    if (searchConditions.length > 0) {
        whereClause[Op.or] = searchConditions;
    }
    
    if (category && category !== 'all') {
      whereClause.category = category;
    }

    const { count, rows } = await db.Tutorial.findAndCountAll({
      where: whereClause,
      limit: limit,
      offset: offset,
      order: [['updatedAt', 'DESC']],
    });

    const totalPages = Math.ceil(count / limit);

    res.json({
      tutorials: rows,
      totalItems: count,
      totalPages: totalPages,
      currentPage: page,
      limit: limit
    });
  } catch (err) {
    console.error("获取教程列表失败 (Sequelize):", err);
    res.status(500).json({ error: `获取教程列表失败: ${err.message}` });
  }
});

// POST /api/tutorials: 新增教程
app.post('/api/tutorials', async (req, res) => {
  try {
    const { title, category, description, url, imageUrl } = req.body;
    if (!title || !category || !description) {
      return res.status(400).json({ error: '缺少必要的教程字段 (title, category, description)' });
    }
    
    const newTutorial = await db.Tutorial.create({
      title,
      description,
      category,
      url: url || null,
      imageUrl: imageUrl || null,
    });
    console.log("新教程已添加 (Sequelize):", newTutorial.toJSON());
    res.status(201).json(newTutorial);
  } catch (err) {
    console.error("添加教程失败 (Sequelize):", err);
    if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ error: `添加教程失败: ${err.message}` });
  }
});

// DELETE /api/tutorials/:id : 删除教程
app.delete('/api/tutorials/:id', async (req, res) => {
  try {
    const tutorialIdToDelete = req.params.id;
    const tutorial = await db.Tutorial.findByPk(tutorialIdToDelete);
    if (!tutorial) {
      return res.status(404).json({ error: `教程 ID '${tutorialIdToDelete}' 未找到` });
    }
    await tutorial.destroy();
    console.log(`教程 ID '${tutorialIdToDelete}' 已删除 (Sequelize)`);
    res.status(200).json({ message: '教程删除成功' });
  } catch (err) {
    console.error("删除教程失败 (Sequelize):", err);
    res.status(500).json({ error: `删除教程失败: ${err.message}` });
  }
});

// PUT /api/tutorials/:id : 更新教程
app.put('/api/tutorials/:id', async (req, res) => {
  try {
    const tutorialIdToUpdate = req.params.id;
    const { title, category, description, url, imageUrl } = req.body;

    if (!title || !category || !description) {
      return res.status(400).json({ error: '缺少必要的教程字段 (title, category, description)' });
    }

    const tutorial = await db.Tutorial.findByPk(tutorialIdToUpdate);
    if (!tutorial) {
      return res.status(404).json({ error: `教程 ID '${tutorialIdToUpdate}' 未找到` });
    }

    tutorial.title = title;
    tutorial.description = description;
    tutorial.category = category;
    tutorial.url = url || null;
    tutorial.imageUrl = imageUrl || null;
    await tutorial.save();
    
    console.log(`教程 ID '${tutorialIdToUpdate}' 已更新 (Sequelize)`);
    res.status(200).json(tutorial);
  } catch (err) {
    console.error("更新教程失败 (Sequelize):", err);
     if (err.name === 'SequelizeValidationError') {
        return res.status(400).json({ error: err.errors.map(e => e.message).join(', ') });
    }
    res.status(500).json({ error: `更新教程失败: ${err.message}` });
  }
});

// GET /api/tutorials/:id 获取单个教程详情
app.get('/api/tutorials/:id', async (req, res) => {
  try {
    const tutorialId = req.params.id;
    const tutorial = await db.Tutorial.findByPk(tutorialId);
    if (!tutorial) {
      return res.status(404).json({ error: `教程 ID '${tutorialId}' 未找到` });
    }
    res.json(tutorial);
  } catch (err) {
    console.error("获取教程详情失败 (Sequelize):", err);
    res.status(500).json({ error: `获取教程详情失败: ${err.message}` });
  }
});

// 启动服务器
const serverInstance = app.listen(PORT, '0.0.0.0', () => {
  console.log(`教程API服务器运行在 http://0.0.0.0:${PORT}`);
  // 你可以根据需要保留或调整其他日志输出
  // console.log(`对外服务地址: http://106.75.5.215:${PORT}`); 
  // console.log(`管理界面地址: http://106.75.5.215:${PORT}/admin.html`);
});

// 优雅退出时关闭数据库连接
process.on('SIGINT', async () => {
  console.log('收到 SIGINT. 关闭服务器和数据库连接...');
  serverInstance.close(async () => {
    console.log('HTTP 服务器已关闭.');
    if (db && db.sequelize) {
      try {
        await db.sequelize.close();
        console.log('Sequelize 数据库连接已关闭.');
      } catch (error) {
        console.error('关闭 Sequelize 连接时出错:', error);
      }
    }
    process.exit(0);
  });
}); 