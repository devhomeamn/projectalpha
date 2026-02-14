const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Section = require("./sectionModel");

const SectionRule = sequelize.define(
  "SectionRule",
  {
    section_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
    },
    rules: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: "section_rules",
  }
);

Section.hasOne(SectionRule, {
  foreignKey: "section_id",
  as: "FormRule",
  onDelete: "CASCADE",
});
SectionRule.belongsTo(Section, { foreignKey: "section_id" });

module.exports = SectionRule;
