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
    allowNull: true, // ✅ এখন central move এ null দেওয়া যাবে
  },
  subcategory_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  rack_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  serial_no: {
    type: DataTypes.INTEGER,
    allowNull: true, // প্রথমে null, পরে generate হবে
  },
  description: {
    type: DataTypes.TEXT,
  },
  closing_date: {
  type: DataTypes.DATEONLY,
  allowNull: true,
},
  added_by: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  // 🟢 Track current status
  status: {
    type: DataTypes.ENUM("active", "central"),
    allowNull: false,
    defaultValue: "active",
  },

  // 🟢 Track previous location info
  previous_section_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  previous_subcategory_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  previous_rack_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  moved_by: {
  type: DataTypes.STRING,
  allowNull: true,
  comment: "User who moved this record to central",
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
