// models/SiteNotice.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const SiteNotice = sequelize.define(
  "SiteNotice",
  {
    title: { type: DataTypes.STRING(200), allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    type: {
      type: DataTypes.ENUM("info", "warn", "urgent"),
      allowNull: false,
      defaultValue: "info",
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    created_by: { type: DataTypes.STRING(100), allowNull: true },
    updated_by: { type: DataTypes.STRING(100), allowNull: true },
  },
  { tableName: "site_notices" }
);

module.exports = SiteNotice;
