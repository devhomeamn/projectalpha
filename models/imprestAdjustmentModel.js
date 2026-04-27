const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ImprestAdjustment = sequelize.define(
  "ImprestAdjustment",
  {
    note_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    note_item_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    financial_code_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    adjusted_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    adjustment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    adjustment_ref_no: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    selection_note_ids: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    voucher_no: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "imprest_adjustments",
    indexes: [
      { fields: ["note_id"] },
      { fields: ["note_item_id"] },
      { fields: ["financial_code_id"] },
      { fields: ["adjustment_date"] },
    ],
  }
);

module.exports = ImprestAdjustment;
