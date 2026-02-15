const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const PublicMessageLog = sequelize.define(
  "PublicMessageLog",
  {
    message_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    action: {
      type: DataTypes.ENUM("edit", "delete"),
      allowNull: false,
    },
    actor_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    actor_name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    actor_role: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "General",
    },
    owner_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    owner_name: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    before_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    after_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "public_message_logs",
  }
);

module.exports = PublicMessageLog;
