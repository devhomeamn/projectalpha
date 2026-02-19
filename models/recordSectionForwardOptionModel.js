const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const RecordSectionForwardOption = sequelize.define(
  "RecordSectionForwardOption",
  {
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "record_section_forward_options",
  }
);

module.exports = RecordSectionForwardOption;
