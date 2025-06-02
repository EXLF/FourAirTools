const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// 文件路径列表
const files = [
  'server/available_scripts/wallet_balance_query_script.js'
];

// 检查文件是否存在
files.forEach(filePath => {
  console.log(`检查文件: ${filePath}`);
  if (fs.existsSync(filePath)) {
    console.log(`文件存在: ${filePath}`);
  } else {
    console.log(`文件不存在: ${filePath}`);
  }
});

console.log('\n开始计算checksum...');

// 计算每个文件的checksum
files.forEach(filePath => {
  try {
    console.log(`处理文件: ${filePath}`);
    const file = fs.readFileSync(filePath);
    console.log(`文件大小: ${file.length} 字节`);
    const hash = crypto.createHash('sha256').update(file).digest('hex');
    console.log(`${path.basename(filePath)}: ${hash}`);
  } catch (error) {
    console.error(`处理文件 ${filePath} 时出错: ${error.message}`);
    console.error(error.stack);
  }
}); 