require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3306,
    dialect: process.env.DB_DIALECT || 'mysql',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false, // 👈 Change to true if you’re using a CA certificate
      },
      connectTimeout: 10000, // 10s timeout
    },
  }
);

sequelize
  .authenticate()
  .then(() => console.log('✅ Database Connected Successfully'))
  .catch((err) => console.error('❌ Database Connection Failed:', err));

module.exports = sequelize;
