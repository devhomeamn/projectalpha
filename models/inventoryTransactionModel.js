const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const InventoryTransaction = sequelize.define(
  "InventoryTransaction",
  {
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    transaction_type: {
      type: DataTypes.STRING(40),
      allowNull: false,
    },
    qty: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    balance_after: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    reference_type: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    done_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "inventory_transactions",
  }
);

module.exports = InventoryTransaction;
