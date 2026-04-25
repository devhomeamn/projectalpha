const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");

const ImprestBudgetAllocation = sequelize.define(
  "ImprestBudgetAllocation",
  {
    base_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    fiscal_year_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    financial_code_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    budget_amount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "imprest_budget_allocations",
    indexes: [
      {
        name: "ux_imp_budg_base_fy_code",
        unique: true,
        fields: ["base_id", "fiscal_year_id", "financial_code_id"],
      },
      { name: "ix_imp_budg_base_fy", fields: ["base_id", "fiscal_year_id"] },
      { name: "ix_imp_budg_fin_code", fields: ["financial_code_id"] },
    ],
  }
);

module.exports = ImprestBudgetAllocation;
