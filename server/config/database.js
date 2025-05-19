module.exports = {
  development: {
    dialect: 'sqlite',
    storage: './database/tutorials.sqlite',
    logging: console.log
  },
  production: {
    dialect: 'sqlite',
    storage: './database/tutorials.sqlite',
    logging: false
  }
}; 