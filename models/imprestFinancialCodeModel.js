const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ImprestFinancialCode = sequelize.define(
  "ImprestFinancialCode",
  {
    code: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    khat_name_bn: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    khat_name_en: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "imprest_financial_codes",
    charset: "utf8mb4",
    collate: "utf8mb4_unicode_ci",
    indexes: [
      { fields: ["status"] },
    ],
  }
);

module.exports = ImprestFinancialCode;
