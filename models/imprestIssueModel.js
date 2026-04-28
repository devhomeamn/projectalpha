const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ImprestIssue = sequelize.define(
  "ImprestIssue",
  {
    note_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    issue_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    dispatch_no: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    voucher_no: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    total_issued_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    issued_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "imprest_issues",
    charset: "utf8mb4",
    collate: "utf8mb4_unicode_ci",
    indexes: [
      { fields: ["note_id"] },
      { fields: ["issue_date"] },
    ],
  }
);

module.exports = ImprestIssue;
