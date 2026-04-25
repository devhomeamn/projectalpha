const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ImprestFiscalYear = sequelize.define(
  "ImprestFiscalYear",
  {
    name: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "imprest_fiscal_years",
    indexes: [
      { fields: ["status"] },
      { fields: ["start_date", "end_date"] },
    ],
  }
);

module.exports = ImprestFiscalYear;
