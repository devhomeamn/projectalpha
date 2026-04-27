const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ImprestNote = sequelize.define(
  "ImprestNote",
  {
    note_no: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
    },
    base_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fiscal_year_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    month: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    demand_type: {
      type: DataTypes.ENUM("REGULAR", "COMPLEMENTARY"),
      allowNull: false,
      defaultValue: "REGULAR",
    },
    pakkhik: {
      type: DataTypes.ENUM("FIRST_HALF", "SECOND_HALF", "NONE", "SUPPLEMENTARY"),
      allowNull: false,
    },
    period_start: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    period_end: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "DRAFT",
        "SUBMITTED",
        "APPROVED",
        "FUND_ISSUED",
        "PARTIALLY_ADJUSTED",
        "ADJUSTED",
        "REJECTED",
        "FORWARDED"
      ),
      allowNull: false,
      defaultValue: "DRAFT",
    },
    total_budget: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_previous_expense: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_current_claim: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_remaining: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    submitted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    approved_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    issued_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "imprest_notes",
    indexes: [
      {
        name: "ux_imp_note_base_fy_m_pk_ps",
        unique: true,
        fields: ["base_id", "fiscal_year_id", "month", "pakkhik", "period_start"],
      },
      { name: "ix_imp_note_status", fields: ["status"] },
      { name: "ix_imp_note_base_fy", fields: ["base_id", "fiscal_year_id"] },
      { name: "ix_imp_note_month_pk", fields: ["month", "pakkhik", "demand_type"] },
    ],
  }
);

module.exports = ImprestNote;
