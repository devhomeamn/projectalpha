const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const InventoryItem = sequelize.define(
  "InventoryItem",
  {
    item_code: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },
    item_name: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    unit: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    current_stock: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    minimum_stock: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "inventory_items",
  }
);

module.exports = InventoryItem;
