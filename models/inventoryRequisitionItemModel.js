const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const InventoryRequisitionItem = sequelize.define(
  "InventoryRequisitionItem",
  {
    requisition_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    item_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    requested_qty: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    approved_qty: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    issued_qty: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    line_status: {
      type: DataTypes.ENUM("Pending", "Approved", "Partially Approved", "Rejected", "Issued"),
      allowNull: false,
      defaultValue: "Pending",
    },
  },
  {
    tableName: "inventory_requisition_items",
  }
);

module.exports = InventoryRequisitionItem;
