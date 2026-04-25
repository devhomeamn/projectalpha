const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ImprestBase = sequelize.define(
  "ImprestBase",
  {
    base_name: {
      type: DataTypes.STRING(140),
      allowNull: false,
      unique: true,
    },
    base_code: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "imprest_bases",
    indexes: [
      { fields: ["status"] },
    ],
  }
);

module.exports = ImprestBase;
