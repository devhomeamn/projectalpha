const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const RecordSectionEntry = sequelize.define(
  "RecordSectionEntry",
  {
    received_from_office_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    received_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    diary_sl_no: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    memo_no: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    memo_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    topic: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    record_section_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    current_section_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    forward_to_section_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    forward_to_type: {
      type: DataTypes.ENUM("section", "custom"),
      allowNull: true,
    },
    forward_to_custom_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    forward_to_label: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    forward_to_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    forwarded_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    forwarded_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    received_by_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    received_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("received", "forwarded", "forward_received"),
      allowNull: false,
      defaultValue: "received",
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "record_section_entries",
  }
);

module.exports = RecordSectionEntry;
