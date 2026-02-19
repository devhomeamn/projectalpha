const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const RecordSectionOfficeOption = sequelize.define(
  "RecordSectionOfficeOption",
  {
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
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
    tableName: "record_section_office_options",
  }
);

module.exports = RecordSectionOfficeOption;
