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

  // ✅ Section/Subcategory/Rack can be NULL after moving to central
  section_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
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
    allowNull: true,
  },

  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  // ✅ New field (OP-1 / OP-2)
  allocate_table: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },

  // 🗓️ Opening date (manual)
  opening_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  closing_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },

  added_by: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  // 📍 Location (previously called status)
  // active = In Section, central = In Central
  status: {
    type: DataTypes.ENUM("active", "central"),
    allowNull: false,
    defaultValue: "active",
  },

  // 🟢 Current workflow status
  record_status: {
    type: DataTypes.ENUM("ongoing", "closed"),
    allowNull: false,
    defaultValue: "ongoing",
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
// ✅ LA/LAO Audit Objection fields
audit_objection: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: false,
},
objection_no: {
  type: DataTypes.STRING,
  allowNull: true,
},
objection_title: {
  type: DataTypes.STRING,
  allowNull: true,
},
objection_details: {
  type: DataTypes.TEXT,
  allowNull: true,
},

// 📎 Attachment fields
attachment_path: {
  type: DataTypes.STRING,
  allowNull: true,
},
attachment_name: {
  type: DataTypes.STRING,
  allowNull: true,
},
attachment_mime: {
  type: DataTypes.STRING,
  allowNull: true,
},
attachment_size: {
  type: DataTypes.INTEGER,
  allowNull: true,
},

ao_status: {
  type: DataTypes.ENUM("open", "requested", "cleared"),
  allowNull: false,
  defaultValue: "open",
},
ao_cleared_by: { type: DataTypes.STRING, allowNull: true },
ao_cleared_at: { type: DataTypes.DATE, allowNull: true },



});





// 🧩 Relationships
Section.hasMany(Record, { foreignKey: "section_id", onDelete: "CASCADE" });
Record.belongsTo(Section, { foreignKey: "section_id" });

Subcategory.hasMany(Record, { foreignKey: "subcategory_id", onDelete: "SET NULL" });
Record.belongsTo(Subcategory, { foreignKey: "subcategory_id" });

Rack.hasMany(Record, { foreignKey: "rack_id", onDelete: "SET NULL" });
Record.belongsTo(Rack, { foreignKey: "rack_id" });

module.exports = Record;
