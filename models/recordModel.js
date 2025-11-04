const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Section = require("./sectionModel");
const Subcategory = require("./subcategoryModel");
const Rack = require("./rackModel");

const Record = sequelize.define("Record", {
  file_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  bd_no: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  section_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  subcategory_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rack_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
  },
  added_by: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // 🟢 New field to track record location
  status: {
    type: DataTypes.ENUM("active", "central"),
    allowNull: false,
    defaultValue: "active",
  },
});

// 🧩 Relationships
Section.hasMany(Record, { foreignKey: "section_id", onDelete: "CASCADE" });
Record.belongsTo(Section, { foreignKey: "section_id" });

Subcategory.hasMany(Record, { foreignKey: "subcategory_id", onDelete: "SET NULL" });
Record.belongsTo(Subcategory, { foreignKey: "subcategory_id" });

Rack.hasMany(Record, { foreignKey: "rack_id", onDelete: "SET NULL" });
Record.belongsTo(Rack, { foreignKey: "rack_id" });

module.exports = Record;
