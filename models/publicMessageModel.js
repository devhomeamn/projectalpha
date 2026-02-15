const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const PublicMessage = sequelize.define(
  "PublicMessage",
  {
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    author_name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    author_role: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "General",
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "public_messages",
  }
);

module.exports = PublicMessage;
