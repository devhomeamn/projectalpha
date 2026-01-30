// models/chequeRegisterLogModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

/**
 * TEXT-based audit log (DB has no JSON type)
 * old_data/new_data store JSON string
 */
const ChequeRegisterLog = sequelize.define(
  "ChequeRegisterLog",
  {
    entry_id: { type: DataTypes.INTEGER, allowNull: false },
    action: { type: DataTypes.STRING(32), allowNull: false }, // create|update|return|delete
    old_data: { type: DataTypes.TEXT, allowNull: true },      // JSON string
    new_data: { type: DataTypes.TEXT, allowNull: true },      // JSON string
    note: { type: DataTypes.TEXT, allowNull: true },
    actor_id: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "cheque_register_logs",
    timestamps: false,
  }
);

module.exports = ChequeRegisterLog;
