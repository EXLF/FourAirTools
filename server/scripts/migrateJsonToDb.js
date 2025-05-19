const fs = require('fs');
const path = require('path');
const { sequelize, Tutorial } = require('../models');

async function migrateData() {
  try {
    // 创建数据库表
    await sequelize.sync({ force: true }); // 警告：这会删除现有的表并重新创建
    
    // 读取JSON文件
    const tutorialsFilePath = path.join(__dirname, '../../src/data/tutorials.json');
    const jsonData = fs.readFileSync(tutorialsFilePath, 'utf8');
    const tutorials = JSON.parse(jsonData);
    
    if (!Array.isArray(tutorials)) {
      console.error('JSON文件不包含数组格式的教程数据');
      process.exit(1);
    }
    
    // 在数据库中创建记录
    const createdTutorials = await Tutorial.bulkCreate(tutorials);
    
    console.log(`成功迁移 ${createdTutorials.length} 条教程数据到数据库`);
    process.exit(0);
  } catch (err) {
    console.error('迁移失败:', err);
    process.exit(1);
  }
}

// 执行迁移
migrateData(); 