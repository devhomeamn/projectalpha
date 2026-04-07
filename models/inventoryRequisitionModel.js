const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const InventoryRequisition = sequelize.define(
  "InventoryRequisition",
  {
    requisition_no: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    requested_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "Draft",
        "Submitted",
        "Forwarded",
        "Approved",
        "Partially Approved",
        "Rejected",
        "Issued"
      ),
      allowNull: false,
      defaultValue: "Draft",
    },
    submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    forwarded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    forwarded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    issued_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    issued_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "inventory_requisitions",
  }
);

module.exports = InventoryRequisition;
