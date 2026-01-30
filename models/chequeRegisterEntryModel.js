const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ChequeRegisterEntry = sequelize.define(
  "ChequeRegisterEntry",
  {
    entry_no: { type: DataTypes.INTEGER, allowNull: false },
    bill_ref_no: { type: DataTypes.STRING, allowNull: true },
    origin_section_id: { type: DataTypes.INTEGER, allowNull: false },
    received_date: { type: DataTypes.DATEONLY, allowNull: false },
    token_no: { type: DataTypes.STRING, allowNull: false },
    amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
    remarks: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.ENUM("received", "processing", "returned"),
      allowNull: false,
      defaultValue: "received",
    },
    returned_to_section_id: { type: DataTypes.INTEGER, allowNull: true },
    returned_date: { type: DataTypes.DATEONLY, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
    deleted_by: { type: DataTypes.INTEGER, allowNull: true },
    delete_reason: { type: DataTypes.STRING(255), allowNull: true },
  },
  { tableName: "cheque_register_entries" }
);

module.exports = ChequeRegisterEntry;
