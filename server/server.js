const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // 引入 uuid

const app = express();
const PORT = 3001; // API 服务器端口

// --- 中间件 ---
// 托管 public 目录下的静态文件 (如 admin.html)
app.use(express.static(path.join(__dirname, 'public'))); 
// 解析 JSON 格式的请求体
app.use(express.json()); 
// 解析 URL 编码的请求体 (如果表单用传统方式提交)
app.use(express.urlencoded({ extended: true }));

// 定义教程数据文件路径
// 使用相对路径
const tutorialsFilePath = path.join(__dirname, '../src/data/tutorials.json');

// 确保数据目录和文件存在
function ensureDirectoryAndFileExist() {
  const dirPath = path.dirname(tutorialsFilePath);
  
  // 检查并创建目录
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`创建目录成功: ${dirPath}`);
    } catch (err) {
      console.error(`创建目录失败: ${dirPath}`, err);
      return false;
    }
  }
  
  // 检查并创建文件(如果不存在)
  if (!fs.existsSync(tutorialsFilePath)) {
    try {
      fs.writeFileSync(tutorialsFilePath, '[]', 'utf8');
      console.log(`创建文件成功: ${tutorialsFilePath}`);
    } catch (err) {
      console.error(`创建文件失败: ${tutorialsFilePath}`, err);
      return false;
    }
  }
  
  return true;
}

// 启动时确保数据目录和文件存在
ensureDirectoryAndFileExist();

// --- API 端点 --- 

// GET /api/tutorials: 获取教程列表 (支持分页和搜索)
app.get('/api/tutorials', (req, res) => {
  // 确保目录和文件存在
  if (!ensureDirectoryAndFileExist()) {
    return res.status(500).json({ error: '无法创建或访问教程数据文件' });
  }

  // 分页参数 (来自查询字符串)
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10; // 默认每页 10 条
  const searchTerm = (req.query.search || '').toLowerCase().trim();

  fs.readFile(tutorialsFilePath, 'utf8', (err, data) => {
    if (err) {
      console.error("读取教程文件失败:", err);
      if (err.code === 'ENOENT') {
        // 如果文件不存在，返回空列表和分页信息
        return res.json({ tutorials: [], totalItems: 0, totalPages: 0, currentPage: 1, limit });
      }
      return res.status(500).json({ error: '无法读取教程数据' });
    }
    
    let allTutorials = [];
    try {
      allTutorials = JSON.parse(data);
      if (!Array.isArray(allTutorials)) {
          console.error("教程数据文件格式错误，不是一个数组。");
          // 即使格式错误，也尝试返回空列表
          return res.json({ tutorials: [], totalItems: 0, totalPages: 0, currentPage: 1, limit });
      }
    } catch (parseErr) {
      console.error("解析 JSON 数据失败:", parseErr);
       // 即使解析错误，也尝试返回空列表
      return res.json({ tutorials: [], totalItems: 0, totalPages: 0, currentPage: 1, limit });
    }

    // 搜索过滤 (如果提供了 searchTerm)
    let filteredTutorials = allTutorials;
    if (searchTerm) {
        filteredTutorials = allTutorials.filter(tutorial => {
            return (
                tutorial.title.toLowerCase().includes(searchTerm) ||
                tutorial.description.toLowerCase().includes(searchTerm) ||
                tutorial.id.toLowerCase().includes(searchTerm)
            );
        });
    }

    // 计算分页
    const totalItems = filteredTutorials.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedTutorials = filteredTutorials.slice(startIndex, endIndex);

    // 返回分页结果
    res.json({
      tutorials: paginatedTutorials,
      totalItems: totalItems,
      totalPages: totalPages,
      currentPage: page,
      limit: limit
    });
  });
});

// POST /api/tutorials: 新增教程 (自动生成 ID)
app.post('/api/tutorials', (req, res) => {
  // 确保目录和文件存在
  if (!ensureDirectoryAndFileExist()) {
    return res.status(500).json({ error: '无法创建或访问教程数据文件' });
  }

  const tutorialData = req.body; // 获取请求体

  // 基本验证 (移除对 id 的验证)
  if (!tutorialData || !tutorialData.title || !tutorialData.category || !tutorialData.description) {
    return res.status(400).json({ error: '缺少必要的教程字段 (title, category, description)' });
  }
  // URL 可以是空字符串
  if (typeof tutorialData.url === 'undefined') {
    tutorialData.url = ""; // 确保有 url 字段
  }

  // 生成新的 UUID
  const newTutorialId = uuidv4();
  const newTutorial = {
    ...tutorialData,
    id: newTutorialId // 使用生成的 ID
  };

  console.log('准备添加新教程 (自动生成 ID):', newTutorial);

  // 1. 读取现有数据
  fs.readFile(tutorialsFilePath, 'utf8', (readErr, data) => {
    if (readErr && readErr.code !== 'ENOENT') { 
      console.error("读取教程文件失败 (POST):", readErr);
      return res.status(500).json({ error: '无法读取现有教程数据' });
    }

    let tutorials = [];
    if (!readErr && data) {
      try {
        tutorials = JSON.parse(data);
        if (!Array.isArray(tutorials)) {
             console.error("教程数据文件格式错误，不是一个数组。");
             return res.status(500).json({ error: '教程数据格式错误' });
        }
      } catch (parseErr) {
        console.error("解析现有 JSON 数据失败 (POST):", parseErr);
        return res.status(500).json({ error: '现有教程数据格式错误' });
      }
    }

    // ID 已由 UUID 生成，理论上无需检查重复，但以防万一可以保留
    // if (tutorials.some(t => t.id === newTutorial.id)) {
    //     console.warn(`UUID collision occurred? ID: ${newTutorial.id}`);
    //     // 可以选择重新生成或直接报错
    //     return res.status(500).json({ error: '生成ID时发生冲突，请重试' });
    // }

    // 2. 添加新数据
    tutorials.push(newTutorial);

    // 3. 写回文件
    fs.writeFile(tutorialsFilePath, JSON.stringify(tutorials, null, 2), 'utf8', (writeErr) => {
      if (writeErr) {
        console.error("写入教程文件失败 (POST):", writeErr);
        return res.status(500).json({ error: '无法保存新教程数据' });
      }
      console.log("教程数据已更新:", tutorialsFilePath);
      res.status(201).json(newTutorial); // 返回成功创建的教程 (包含生成的 ID)
    });
  });
});

// DELETE /api/tutorials/:id : 删除教程
app.delete('/api/tutorials/:id', (req, res) => {
  // 确保目录和文件存在
  if (!ensureDirectoryAndFileExist()) {
    return res.status(500).json({ error: '无法创建或访问教程数据文件' });
  }

  const tutorialIdToDelete = req.params.id;
  console.log('请求删除教程 ID:', tutorialIdToDelete);

  fs.readFile(tutorialsFilePath, 'utf8', (readErr, data) => {
    if (readErr) {
      console.error("读取教程文件失败 (DELETE):", readErr);
      // 如果文件本身就找不到，也算作找不到该教程
      if (readErr.code === 'ENOENT') {
           return res.status(404).json({ error: `教程 ID '${tutorialIdToDelete}' 未找到` });
      }
      return res.status(500).json({ error: '无法读取现有教程数据' });
    }

    let tutorials = [];
    try {
      tutorials = JSON.parse(data);
      if (!Array.isArray(tutorials)) throw new Error('数据格式非数组');
    } catch (parseErr) {
      console.error("解析现有 JSON 数据失败 (DELETE):", parseErr);
      return res.status(500).json({ error: '现有教程数据格式错误' });
    }

    const initialLength = tutorials.length;
    tutorials = tutorials.filter(t => t.id !== tutorialIdToDelete);

    if (tutorials.length === initialLength) {
      // 如果数组长度没变，说明没找到
      return res.status(404).json({ error: `教程 ID '${tutorialIdToDelete}' 未找到` });
    }

    // 写回文件
    fs.writeFile(tutorialsFilePath, JSON.stringify(tutorials, null, 2), 'utf8', (writeErr) => {
      if (writeErr) {
        console.error("写入教程文件失败 (DELETE):", writeErr);
        return res.status(500).json({ error: '无法保存更新后的教程数据' });
      }
      console.log(`教程 ID '${tutorialIdToDelete}' 已删除，文件已更新.`);
      res.status(200).json({ message: '教程删除成功' }); // 或返回 204 No Content
    });
  });
});

// PUT /api/tutorials/:id : 更新教程
app.put('/api/tutorials/:id', (req, res) => {
    // 确保目录和文件存在
    if (!ensureDirectoryAndFileExist()) {
      return res.status(500).json({ error: '无法创建或访问教程数据文件' });
    }
    
    const tutorialIdToUpdate = req.params.id;
    const updatedData = req.body;
    console.log(`请求更新教程 ID '${tutorialIdToUpdate}' 的数据为:`, updatedData);

    // 基础验证 (确保请求体包含必要字段，但不允许修改 ID)
    if (!updatedData || !updatedData.title || !updatedData.category || !updatedData.description || typeof updatedData.url === 'undefined') {
        return res.status(400).json({ error: '缺少必要的教程字段 (title, category, description, url)' });
    }
    // 确保 ID 不会被修改
    if (updatedData.id && updatedData.id !== tutorialIdToUpdate) {
         return res.status(400).json({ error: '不允许通过此接口修改教程 ID' });
    }

    fs.readFile(tutorialsFilePath, 'utf8', (readErr, data) => {
        if (readErr) {
            console.error("读取教程文件失败 (PUT):", readErr);
            if (readErr.code === 'ENOENT') {
                return res.status(404).json({ error: `教程 ID '${tutorialIdToUpdate}' 未找到` });
            }
            return res.status(500).json({ error: '无法读取现有教程数据' });
        }

        let tutorials = [];
        try {
            tutorials = JSON.parse(data);
            if (!Array.isArray(tutorials)) throw new Error('数据格式非数组');
        } catch (parseErr) {
            console.error("解析现有 JSON 数据失败 (PUT):", parseErr);
            return res.status(500).json({ error: '现有教程数据格式错误' });
        }

        const tutorialIndex = tutorials.findIndex(t => t.id === tutorialIdToUpdate);

        if (tutorialIndex === -1) {
            return res.status(404).json({ error: `教程 ID '${tutorialIdToUpdate}' 未找到` });
        }

        // 更新教程数据 (保留原始 ID)
        tutorials[tutorialIndex] = {
            ...tutorials[tutorialIndex], // 保留可能存在的其他字段
            ...updatedData,            // 应用更新的数据
            id: tutorialIdToUpdate     // 强制使用原始 ID
        };

        // 写回文件
        fs.writeFile(tutorialsFilePath, JSON.stringify(tutorials, null, 2), 'utf8', (writeErr) => {
            if (writeErr) {
                console.error("写入教程文件失败 (PUT):", writeErr);
                return res.status(500).json({ error: '无法保存更新后的教程数据' });
            }
            console.log(`教程 ID '${tutorialIdToUpdate}' 已更新，文件已更新.`);
            res.status(200).json(tutorials[tutorialIndex]); // 返回更新后的教程数据
        });
    });
});

// --- 启动服务器 ---
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API 服务器正在运行在 http://0.0.0.0:${PORT}`);
}); 