const express = require('express');
const path = require('path');
const fs = require('fs'); // <--- 确保引入 fs 模块
const db = require('./models'); // 引入 Sequelize 实例和模型
const { Op } = require('sequelize'); // 引入 Sequelize 操作符
const multer = require('multer'); // <--- 引入 multer
const crypto = require('crypto'); // <--- 引入 crypto (如果之前没有)

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

// --- 脚本插件 API 端点 ---

// GET /api/scripts/manifest: 获取脚本 manifest
app.get('/api/scripts/manifest', (req, res) => {
  const manifestPath = path.join(__dirname, 'data', 'script_manifest.json');
  fs.readFile(manifestPath, 'utf8', (err, data) => {
    if (err) {
      console.error("读取脚本 manifest 失败:", err);
      return res.status(500).json({ error: '无法获取脚本 manifest' });
    }
    try {
      const manifest = JSON.parse(data);
      res.json(manifest);
    } catch (parseError) {
      console.error("解析脚本 manifest JSON 失败:", parseError);
      return res.status(500).json({ error: '脚本 manifest 格式错误' });
    }
  });
});

// GET /api/scripts/download/:filename: 下载脚本文件
app.get('/api/scripts/download/:filename', (req, res) => {
  const filename = req.params.filename;
  // 安全性：校验文件名，防止路径遍历
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: '无效的文件名' });
  }

  const filePath = path.join(__dirname, 'available_scripts', filename);

  // 检查文件是否存在
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '脚本文件未找到' });
  }

  // 设置正确的 Content-Type 和 Content-Disposition
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // 发送文件
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error(`发送脚本文件 ${filename} 失败:`, err);
      // 确保在出错时也尝试发送错误响应，如果头部尚未发送
      if (!res.headersSent) {
        res.status(500).json({ error: '下载脚本文件失败' });
      }
    }
  });
});

// --- 脚本管理 API 端点 ---

// Multer 配置：用于处理文件上传
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, path.join(__dirname, 'available_scripts/')); // 保存到 available_scripts 目录
    },
    filename: function (req, file, cb) {
        // 使用原始文件名，但可以添加逻辑防止覆盖或处理特殊字符
        // 为简单起见，这里直接使用原始文件名，但要注意潜在的文件名冲突
        // 更好的做法是生成一个唯一的文件名，或者在客户端校验文件名是否已存在
        const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8'); // 处理中文名
        cb(null, originalName);
    }
});
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (path.extname(file.originalname) !== '.js') {
            return cb(new Error('只允许上传 .js 文件'), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 } // 限制文件大小为 5MB
});

// POST /api/scripts/upload: 上传脚本文件
app.post('/api/scripts/upload', upload.single('scriptFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '没有选择文件或文件上传失败' });
    }
    // 文件已保存到 req.file.path (由 multer 处理)
    console.log('[Server] Script uploaded:', req.file.filename);
    res.json({ 
        message: '脚本文件上传成功', 
        filename: req.file.filename, 
        path: req.file.path 
    });
}, (error, req, res, next) => {
    // Multer 的错误处理
    if (error instanceof multer.MulterError) {
        console.error('[Server] Multer上传错误:', error);
        return res.status(400).json({ error: `文件上传错误: ${error.message}` });
    } else if (error) {
        console.error('[Server] 文件上传未知错误:', error);
        return res.status(500).json({ error: `文件上传失败: ${error.message}` });
    }
    next();
});

// 辅助函数：计算文件 checksum (与 scriptUpdaterService 中的类似，但这是服务端的)
async function calculateServerFileChecksum(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', (data) => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

// POST /api/scripts/update_manifest: 更新或添加脚本元数据到 manifest
app.post('/api/scripts/update_manifest', async (req, res) => {
    const { script: newScriptData, isNew, originalId } = req.body;

    if (!newScriptData || !newScriptData.id || !newScriptData.name || !newScriptData.filename || !newScriptData.version) {
        return res.status(400).json({ error: '缺少必要的脚本元数据字段 (id, name, filename, version)' });
    }

    const manifestPath = path.join(__dirname, 'data', 'script_manifest.json');

    try {
        let manifestData;
        try {
            const rawData = await fs.promises.readFile(manifestPath, 'utf8');
            manifestData = JSON.parse(rawData);
        } catch (readError) {
            // 如果 manifest 文件不存在或无法读取/解析，则创建一个新的
            console.warn('[Server] Manifest read/parse error, creating new one:', readError.message);
            manifestData = { scripts: [] };
        }

        if (!Array.isArray(manifestData.scripts)) {
            console.error('[Server] Manifest format error: scripts is not an array.');
            manifestData.scripts = []; // 重置为数组以防万一
        }

        const scriptFilePath = path.join(__dirname, 'available_scripts', newScriptData.filename);
        if (!fs.existsSync(scriptFilePath)) {
             console.error(`[Server] Script file not found for manifest update: ${newScriptData.filename}`);
            return res.status(400).json({ error: `脚本文件 ${newScriptData.filename} 在服务器上不存在。请先上传文件。` });
        }

        // 为脚本生成/更新 checksum 和 lastModified
        newScriptData.checksum = await calculateServerFileChecksum(scriptFilePath);
        const stats = await fs.promises.stat(scriptFilePath);
        newScriptData.lastModified = stats.mtime.toISOString();

        if (isNew) {
            // 检查新脚本的 ID 是否已存在
            if (manifestData.scripts.some(s => s.id === newScriptData.id)) {
                return res.status(400).json({ error: `脚本 ID '${newScriptData.id}' 已存在。请使用唯一的ID。` });
            }
            manifestData.scripts.push(newScriptData);
        } else {
            const scriptIndex = manifestData.scripts.findIndex(s => s.id === originalId);
            if (scriptIndex > -1) {
                // 如果ID被修改，需要检查新ID是否冲突 (仅当 originalId 和 newScriptData.id 不同时)
                if (originalId !== newScriptData.id && manifestData.scripts.some((s, idx) => s.id === newScriptData.id && idx !== scriptIndex)) {
                    return res.status(400).json({ error: `更新后的脚本 ID '${newScriptData.id}' 与其他脚本冲突。` });
                }
                manifestData.scripts[scriptIndex] = { ...manifestData.scripts[scriptIndex], ...newScriptData };
            } else {
                return res.status(404).json({ error: `未找到要更新的脚本 (原始ID: ${originalId})` });
            }
        }

        await fs.promises.writeFile(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
        console.log(`[Server] Script manifest updated. Action: ${isNew ? 'Added' : 'Updated'} script ID: ${newScriptData.id}`);
        res.json({ message: '脚本元数据更新成功', script: newScriptData });

    } catch (error) {
        console.error('[Server] 更新脚本 manifest 失败:', error);
        res.status(500).json({ error: '更新脚本 manifest 失败' });
    }
});

// DELETE /api/scripts/:id: 删除脚本文件和manifest中的记录
app.delete('/api/scripts/:id', async (req, res) => {
    const scriptId = req.params.id;
    const manifestPath = path.join(__dirname, 'data', 'script_manifest.json');

    try {
        // 读取manifest文件
        const manifestData = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
        
        if (!Array.isArray(manifestData.scripts)) {
            return res.status(500).json({ error: 'Manifest格式错误：scripts不是数组' });
        }
        
        // 查找要删除的脚本
        const scriptIndex = manifestData.scripts.findIndex(s => s.id === scriptId);
        if (scriptIndex === -1) {
            return res.status(404).json({ error: `未找到ID为 ${scriptId} 的脚本` });
        }
        
        const scriptToDelete = manifestData.scripts[scriptIndex];
        const scriptFilePath = path.join(__dirname, 'available_scripts', scriptToDelete.filename);
        
        // 在删除前，将脚本标记为已删除并保留在列表中一段时间
        // 这让客户端知道需要删除本地文件
        const deletedScriptManifest = { ...scriptToDelete };
        deletedScriptManifest.isDeleted = true;  // 标记为删除
        deletedScriptManifest.deletedAt = new Date().toISOString(); // 删除时间戳
        
        // 在一个特殊的"已删除脚本"数组中保存一份副本
        // 以便在将来的同步中客户端知道要删除这些脚本
        if (!manifestData.deletedScripts) {
            manifestData.deletedScripts = [];
        }
        manifestData.deletedScripts.push(deletedScriptManifest);
        
        // 仅保留最近30天的删除记录
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        manifestData.deletedScripts = manifestData.deletedScripts.filter(script => {
            if (!script.deletedAt) return true;
            return new Date(script.deletedAt) > thirtyDaysAgo;
        });
        
        // 从活动脚本列表中移除脚本
        manifestData.scripts.splice(scriptIndex, 1);
        
        // 保存更新后的manifest
        await fs.promises.writeFile(manifestPath, JSON.stringify(manifestData, null, 2), 'utf8');
        
        // 尝试删除服务器上的脚本文件
        try {
            if (fs.existsSync(scriptFilePath)) {
                await fs.promises.unlink(scriptFilePath);
                console.log(`[Server] Script file deleted from server: ${scriptToDelete.filename}`);
            } else {
                console.warn(`[Server] Script file not found for deletion: ${scriptToDelete.filename}`);
            }
        } catch (fileError) {
            console.error(`[Server] Error deleting script file: ${fileError.message}`);
            // 即使文件删除失败，我们仍然已从manifest中移除了记录
            return res.status(207).json({ 
                message: '脚本从manifest中移除，但服务器端文件删除失败',
                error: fileError.message,
                script: scriptToDelete,
                deletedScriptManifest: deletedScriptManifest
            });
        }
        
        console.log(`[Server] Script deleted successfully. ID: ${scriptId}, File: ${scriptToDelete.filename}`);
        res.json({ 
            message: '脚本删除成功', 
            deletedScript: scriptToDelete,
            deletedScriptManifest: deletedScriptManifest
        });
        
    } catch (error) {
        console.error('[Server] 删除脚本失败:', error);
        res.status(500).json({ error: `删除脚本失败: ${error.message}` });
    }
});

// 启动服务器
const serverInstance = app.listen(PORT, '0.0.0.0', () => {
  console.log(`教程API服务器运行在 http://0.0.0.0:${PORT}`);
  // 你可以根据需要保留或调整其他日志输出
  console.log(`教程管理界面: http://localhost:${PORT}/manage_tutorials.html`);
  console.log(`脚本管理界面: http://localhost:${PORT}/manage_scripts.html`);
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