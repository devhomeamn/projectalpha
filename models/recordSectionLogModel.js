const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const RecordSectionLog = sequelize.define(
  "RecordSectionLog",
  {
    entry_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    action: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    old_data: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    new_data: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    actor_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "record_section_logs",
    timestamps: false,
  }
);

module.exports = RecordSectionLog;
