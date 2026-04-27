const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const { DataTypes } = require('sequelize');
const sequelize = require('./config/db');
const User = require('./models/userModel');

// Ensure preference models are registered before sync
require('./models/userPreferredRackModel');
require('./models/sectionRuleModel');
require('./models/publicMessageModel');
require('./models/publicMessageLogModel');
require('./models/recordSectionEntryModel');
require('./models/recordSectionLogModel');
require('./models/recordSectionOfficeOptionModel');
require('./models/recordSectionForwardOptionModel');
require("./models/inventoryItemModel");
require("./models/inventoryRequisitionModel");
require("./models/inventoryRequisitionItemModel");
require("./models/inventoryTransactionModel");
require("./models/imprestBaseModel");
require("./models/imprestFinancialCodeModel");
require("./models/imprestFiscalYearModel");
require("./models/imprestBudgetAllocationModel");
require("./models/imprestNoteModel");
require("./models/imprestNoteItemModel");
require("./models/imprestIssueModel");
require("./models/imprestAdjustmentModel");
require("./models/imprestDurationAdjustmentModel");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log('->', req.method, req.originalUrl);
  next();
});

// Import routes
const authRoutes = require('./routes/authRoutes');
const sectionRoutes = require('./routes/sectionRoutes');
const recordRoutes = require('./routes/recordRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const aoClearanceRoutes = require('./routes/aoClearanceRoutes');
const chequeRegisterRoutes = require('./routes/chequeRegisterRoutes');
const recordSectionRoutes = require('./routes/recordSectionRoutes');
const inventoryRoutes = require("./routes/inventoryRoutes");
const imprestRoutes = require("./routes/imprestRoutes");

app.use('/api/reports', require('./routes/reportsRoutes'));
app.use('/api/notices', require('./routes/noticeRoutes'));
app.use('/api/password', require('./routes/passwordRoutes'));
app.use('/api/public-messages', require('./routes/publicMessageRoutes'));
app.use('/api/ao-clearance-requests', aoClearanceRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/cheque-register', chequeRegisterRoutes);
app.use('/api/record-sections', recordSectionRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/imprest", imprestRoutes);

// Static serve
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

app.get('/api/config', (req, res) => {
  res.json({ apiBase: process.env.API_BASE });
});

async function ensureUserMobileColumn() {
  const qi = sequelize.getQueryInterface();
  const tableName = User.getTableName();
  const columns = await qi.describeTable(tableName);

  if (!columns.mobile) {
    await qi.addColumn(tableName, 'mobile', {
      type: DataTypes.STRING(15),
      allowNull: true,
    });
    console.log('Added missing Users.mobile column');
  }
}

async function ensureUserRoleEnum() {
  const qi = sequelize.getQueryInterface();
  const tableName = User.getTableName();

  try {
    await qi.changeColumn(tableName, "role", {
      type: DataTypes.ENUM("Admin", "Master", "General", "Inventory Manager"),
      allowNull: false,
      defaultValue: "General",
    });
  } catch (err) {
    console.warn("Could not update Users.role enum:", err.message);
  }
}

async function ensureRecordSectionEntryColumns() {
  const qi = sequelize.getQueryInterface();
  let columns;

  try {
    columns = await qi.describeTable("record_section_entries");
  } catch {
    return;
  }

  if (!columns.forward_to_type) {
    await qi.addColumn("record_section_entries", "forward_to_type", {
      type: DataTypes.ENUM("section", "custom"),
      allowNull: true,
    });
  }
  if (!columns.forward_to_custom_id) {
    await qi.addColumn("record_section_entries", "forward_to_custom_id", {
      type: DataTypes.INTEGER,
      allowNull: true,
    });
  }
  if (!columns.forward_to_label) {
    await qi.addColumn("record_section_entries", "forward_to_label", {
      type: DataTypes.STRING(120),
      allowNull: true,
    });
  }
}

async function ensureImprestNoteIndexes() {
  const qi = sequelize.getQueryInterface();
  const tableName = "imprest_notes";

  let indexes;
  try {
    indexes = await qi.showIndex(tableName);
  } catch {
    return;
  }

  const legacyUnique = (indexes || []).find((idx) => {
    if (!idx?.unique) return false;
    const fields = (idx.fields || []).map((f) => String(f.attribute || f.name || ""));
    return (
      fields.length === 4 &&
      fields[0] === "base_id" &&
      fields[1] === "fiscal_year_id" &&
      fields[2] === "month" &&
      fields[3] === "pakkhik"
    );
  });

  if (legacyUnique?.name) {
    try {
      await qi.removeIndex(tableName, legacyUnique.name);
      console.log(`Removed legacy index ${legacyUnique.name} from ${tableName}`);
    } catch (err) {
      console.warn(`Could not remove legacy index ${legacyUnique.name}:`, err.message);
    }
  }

  indexes = await qi.showIndex(tableName);
  const hasCurrentIndex = (indexes || []).some((idx) => idx?.name === "ux_imp_note_base_fy_m_pk_ps");
  if (!hasCurrentIndex) {
    try {
      await qi.addIndex(tableName, ["base_id", "fiscal_year_id", "month", "pakkhik", "period_start"], {
        name: "ux_imp_note_base_fy_m_pk_ps",
        unique: true,
      });
      console.log(`Added index ux_imp_note_base_fy_m_pk_ps on ${tableName}`);
    } catch (err) {
      console.warn("Could not add current imprest note unique index:", err.message);
    }
  }
}

async function ensureImprestWorkflowColumns() {
  const qi = sequelize.getQueryInterface();

  try {
    const noteCols = await qi.describeTable("imprest_notes");
    if (!noteCols.demand_type) {
      await qi.addColumn("imprest_notes", "demand_type", {
        type: DataTypes.ENUM("REGULAR", "COMPLEMENTARY"),
        allowNull: false,
        defaultValue: "REGULAR",
      });
    }

    try {
      await qi.changeColumn("imprest_notes", "pakkhik", {
        type: DataTypes.ENUM("FIRST_HALF", "SECOND_HALF", "NONE", "SUPPLEMENTARY"),
        allowNull: false,
      });
    } catch (err) {
      console.warn("Could not update imprest_notes.pakkhik enum:", err.message);
    }

    try {
      await qi.changeColumn("imprest_notes", "status", {
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
      });
    } catch (err) {
      console.warn("Could not update imprest_notes.status enum:", err.message);
    }

    await sequelize.query(`
      UPDATE imprest_notes
      SET demand_type = CASE
        WHEN UPPER(COALESCE(pakkhik, '')) IN ('SUPPLEMENTARY', 'NONE') THEN 'COMPLEMENTARY'
        ELSE 'REGULAR'
      END
      WHERE demand_type IS NULL OR demand_type = ''
    `);
    await sequelize.query(`
      UPDATE imprest_notes
      SET pakkhik = 'NONE'
      WHERE UPPER(COALESCE(pakkhik, '')) = 'SUPPLEMENTARY'
    `);
    await sequelize.query(`
      UPDATE imprest_notes
      SET status = 'SUBMITTED'
      WHERE UPPER(COALESCE(status, '')) = 'FORWARDED'
    `);
  } catch (err) {
    console.warn("Could not align imprest_notes workflow columns:", err.message);
  }

  try {
    const itemCols = await qi.describeTable("imprest_note_items");
    if (!itemCols.previous_issued_amount) {
      await qi.addColumn("imprest_note_items", "previous_issued_amount", {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!itemCols.unadjusted_amount) {
      await qi.addColumn("imprest_note_items", "unadjusted_amount", {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!itemCols.budget_remaining) {
      await qi.addColumn("imprest_note_items", "budget_remaining", {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
      });
    }

    await sequelize.query(`
      UPDATE imprest_note_items
      SET previous_issued_amount = COALESCE(previous_issued_amount, previous_expense, 0),
          previous_expense = COALESCE(previous_issued_amount, previous_expense, 0),
          unadjusted_amount = GREATEST(COALESCE(issued_amount, 0) - COALESCE(adjustment_amount, 0), 0),
          budget_remaining = COALESCE(budget_amount, 0) - COALESCE(previous_issued_amount, previous_expense, 0) - COALESCE(issued_amount, 0)
    `);
  } catch (err) {
    console.warn("Could not align imprest_note_items workflow columns:", err.message);
  }

  try {
    const adjCols = await qi.describeTable("imprest_adjustments");
    if (!adjCols.note_item_id) {
      await qi.addColumn("imprest_adjustments", "note_item_id", {
        type: DataTypes.INTEGER,
        allowNull: true,
      });
    }
    if (!adjCols.adjustment_ref_no) {
      await qi.addColumn("imprest_adjustments", "adjustment_ref_no", {
        type: DataTypes.STRING(120),
        allowNull: true,
      });
    }
    if (!adjCols.selection_note_ids) {
      await qi.addColumn("imprest_adjustments", "selection_note_ids", {
        type: DataTypes.TEXT,
        allowNull: true,
      });
    }
    await sequelize.query(`
      UPDATE imprest_adjustments
      SET adjustment_ref_no = COALESCE(adjustment_ref_no, voucher_no)
    `);
    await sequelize.query(`
      UPDATE imprest_adjustments
      SET selection_note_ids = COALESCE(selection_note_ids, CAST(note_id AS CHAR))
      WHERE selection_note_ids IS NULL OR selection_note_ids = ''
    `);
    await sequelize.query(`
      UPDATE imprest_adjustments a
      JOIN imprest_note_items i
        ON i.note_id = a.note_id
       AND i.financial_code_id = a.financial_code_id
      SET a.note_item_id = i.id
      WHERE a.note_item_id IS NULL
    `);
  } catch (err) {
    console.warn("Could not align imprest_adjustments workflow columns:", err.message);
  }

  try {
    const issueCols = await qi.describeTable("imprest_issues");
    if (!issueCols.dispatch_no) {
      await qi.addColumn("imprest_issues", "dispatch_no", {
        type: DataTypes.STRING(120),
        allowNull: true,
      });
    }
    await sequelize.query(`
      UPDATE imprest_issues
      SET dispatch_no = COALESCE(dispatch_no, voucher_no)
    `);
  } catch (err) {
    console.warn("Could not align imprest_issues workflow columns:", err.message);
  }
}

async function startServer() {
  try {
    // Legacy database hotfix: ensure newly introduced imprest columns exist
    // before sequelize.sync() attempts to add indexes on them.
    await ensureImprestWorkflowColumns();

    await sequelize.sync();
    await ensureUserMobileColumn();
    await ensureUserRoleEnum();
    await ensureRecordSectionEntryColumns();
    await ensureImprestNoteIndexes();
    await ensureImprestWorkflowColumns();
    console.log('Database synced with approval system');

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

startServer();
