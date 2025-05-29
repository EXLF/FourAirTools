const path = require('path');

module.exports = {
  development: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database/tutorials.sqlite'),
    logging: console.log
  },
  production: {
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database/tutorials.sqlite'),
    logging: false
  }
}; 