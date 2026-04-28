const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ImprestNoteItem = sequelize.define(
  "ImprestNoteItem",
  {
    note_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    financial_code_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    khat_name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    budget_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    previous_issued_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    previous_expense: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    current_claim: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    approved_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    issued_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    adjustment_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    unadjusted_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    budget_remaining: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    remaining_balance: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "imprest_note_items",
    charset: "utf8mb4",
    collate: "utf8mb4_unicode_ci",
    indexes: [
      {
        unique: true,
        fields: ["note_id", "financial_code_id"],
      },
      { fields: ["note_id"] },
      { fields: ["financial_code_id"] },
    ],
  }
);

module.exports = ImprestNoteItem;
