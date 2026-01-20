const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const PasswordReset = sequelize.define(
  "PasswordReset",
  {
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    expires_at: { type: DataTypes.DATE, allowNull: false },
    used_at: { type: DataTypes.DATE, allowNull: true },
  },
  { tableName: "password_resets" }
);

module.exports = PasswordReset;
