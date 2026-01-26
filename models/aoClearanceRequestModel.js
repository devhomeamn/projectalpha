// models/aoClearanceRequestModel.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const AOClearanceRequest = sequelize.define(
  "AOClearanceRequest",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    record_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    bd_no: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    request_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    attachment_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    attachment_path: {
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

    requested_by: {
      type: DataTypes.STRING,
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM("pending", "approved", "rejected"),
      allowNull: false,
      defaultValue: "pending",
    },

    admin_note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    decided_by: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    decided_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "ao_clearance_requests",
    timestamps: true,
  }
);

// ✅ Relationships (needed for include in admin list)
// NOTE: keeping associations here avoids circular imports in Record model.
try {
  const Record = require("./recordModel");
  Record.hasMany(AOClearanceRequest, { foreignKey: "record_id" });
  AOClearanceRequest.belongsTo(Record, { foreignKey: "record_id" });
} catch (e) {
  // If model load order ever changes, app can still run without include.
}

module.exports = AOClearanceRequest;
