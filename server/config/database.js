const path = require('path');

// 数据库配置
module.exports = {
  development: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database/tutorials.sqlite'),
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true
    }
  },
  production: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database/tutorials.sqlite'),
    logging: false,
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true
    }
  },
  test: {
    dialect: 'sqlite',
    storage: ':memory:',
    logging: false,
    define: {
      timestamps: true,
      underscored: false,
      freezeTableName: true
    }
  }
}; 