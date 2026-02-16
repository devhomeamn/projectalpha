require("dotenv").config();
const { Sequelize } = require("sequelize");

const dbDialect = process.env.DB_DIALECT || "mysql";
const dbHost = process.env.DB_HOST || "127.0.0.1";
const dbPort = Number(process.env.DB_PORT || 3306);

// SSL toggle (default: false)
const useSSL = String(process.env.DB_SSL || "false").toLowerCase() === "true";

// Optional: if your host needs this (some cPanel do)
const dbTimezone = process.env.DB_TIMEZONE || "+00:00";

const sequelizeOptions = {
  host: dbHost,
  port: dbPort,
  dialect: dbDialect,
  logging: false,
  timezone: dbTimezone, // safe; MySQL will handle
  dialectOptions: {
    connectTimeout: 10000,
    ...(useSSL
      ? {
          ssl: {
            require: true,
            rejectUnauthorized:
              String(process.env.DB_SSL_REJECT_UNAUTHORIZED || "false").toLowerCase() ===
              "true",
          },
        }
      : {}),
  },
  pool: {
    max: Number(process.env.DB_POOL_MAX || 10),
    min: Number(process.env.DB_POOL_MIN || 0),
    acquire: Number(process.env.DB_POOL_ACQUIRE || 30000),
    idle: Number(process.env.DB_POOL_IDLE || 10000),
  },
};

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  sequelizeOptions
);

sequelize
  .authenticate()
  .then(() =>
    console.log(
      ` Database Connected Successfully (dialect=${dbDialect}, host=${dbHost}, ssl=${useSSL})`
    )
  )
  .catch((err) => console.error("❌ Database Connection Failed:", err));

module.exports = sequelize;
