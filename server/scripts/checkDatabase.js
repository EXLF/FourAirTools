const { sequelize, Tutorial } = require('../models');

async function checkDatabase() {
  try {
    // 连接数据库
    await sequelize.authenticate();
    console.log('数据库连接成功');
    
    // 查询记录总数
    const count = await Tutorial.count();
    console.log(`数据库中共有 ${count} 条教程记录`);
    
    // 查询一些示例记录
    if (count > 0) {
      const examples = await Tutorial.findAll({ limit: 3 });
      console.log('示例记录:');
      examples.forEach(example => {
        console.log(`- ${example.title} (${example.category})`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('检查数据库失败:', err);
    process.exit(1);
  }
}

checkDatabase(); 