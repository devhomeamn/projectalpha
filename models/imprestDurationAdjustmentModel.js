const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ImprestDurationAdjustment = sequelize.define(
  "ImprestDurationAdjustment",
  {
    base_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fiscal_year_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    duration_key: {
      type: DataTypes.STRING(80),
      allowNull: false,
    },
    duration_label: {
      type: DataTypes.STRING(180),
      allowNull: false,
    },
    duration_start: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    duration_end: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    source_financial_code_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    target_financial_code_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    issued_reference_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    adjusted_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
    adjustment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    voucher_no: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "imprest_duration_adjustments",
    indexes: [
      { name: "ix_imp_dur_adj_base_fy", fields: ["base_id", "fiscal_year_id"] },
      { name: "ix_imp_dur_adj_key", fields: ["duration_key"] },
      { name: "ix_imp_dur_adj_range", fields: ["duration_start", "duration_end"] },
      { name: "ix_imp_dur_adj_src", fields: ["source_financial_code_id"] },
      { name: "ix_imp_dur_adj_tgt", fields: ["target_financial_code_id"] },
      { name: "ix_imp_dur_adj_dt", fields: ["adjustment_date"] },
    ],
  }
);

module.exports = ImprestDurationAdjustment;
