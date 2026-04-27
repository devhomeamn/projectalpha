const { Op, col } = require("sequelize");
const sequelize = require("../config/db");

const User = require("../models/userModel");
const ImprestBase = require("../models/imprestBaseModel");
const ImprestFinancialCode = require("../models/imprestFinancialCodeModel");
const ImprestFiscalYear = require("../models/imprestFiscalYearModel");
const ImprestBudgetAllocation = require("../models/imprestBudgetAllocationModel");
const ImprestNote = require("../models/imprestNoteModel");
const ImprestNoteItem = require("../models/imprestNoteItemModel");
const ImprestIssue = require("../models/imprestIssueModel");
const ImprestAdjustment = require("../models/imprestAdjustmentModel");
const ImprestDurationAdjustment = require("../models/imprestDurationAdjustmentModel");

const NOTE_ISSUED_STATUSES = ["FUND_ISSUED", "PARTIALLY_ADJUSTED", "ADJUSTED"];
const NOTE_ALLOWED_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "FUND_ISSUED",
  "PARTIALLY_ADJUSTED",
  "ADJUSTED",
  "REJECTED",
];
const MONTH_NAMES_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

let assocInit = false;
function ensureAssociations() {
  if (assocInit) return;
  assocInit = true;

  if (!ImprestBase.associations?.budgets) {
    ImprestBase.hasMany(ImprestBudgetAllocation, {
      foreignKey: "base_id",
      as: "budgets",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestBudgetAllocation.associations?.base) {
    ImprestBudgetAllocation.belongsTo(ImprestBase, {
      foreignKey: "base_id",
      as: "base",
    });
  }

  if (!ImprestFiscalYear.associations?.budgets) {
    ImprestFiscalYear.hasMany(ImprestBudgetAllocation, {
      foreignKey: "fiscal_year_id",
      as: "budgets",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestBudgetAllocation.associations?.fiscalYear) {
    ImprestBudgetAllocation.belongsTo(ImprestFiscalYear, {
      foreignKey: "fiscal_year_id",
      as: "fiscalYear",
    });
  }

  if (!ImprestFinancialCode.associations?.budgets) {
    ImprestFinancialCode.hasMany(ImprestBudgetAllocation, {
      foreignKey: "financial_code_id",
      as: "budgets",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestBudgetAllocation.associations?.financialCode) {
    ImprestBudgetAllocation.belongsTo(ImprestFinancialCode, {
      foreignKey: "financial_code_id",
      as: "financialCode",
    });
  }

  if (!ImprestBase.associations?.notes) {
    ImprestBase.hasMany(ImprestNote, {
      foreignKey: "base_id",
      as: "notes",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestNote.associations?.base) {
    ImprestNote.belongsTo(ImprestBase, {
      foreignKey: "base_id",
      as: "base",
    });
  }

  if (!ImprestFiscalYear.associations?.notes) {
    ImprestFiscalYear.hasMany(ImprestNote, {
      foreignKey: "fiscal_year_id",
      as: "notes",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestNote.associations?.fiscalYear) {
    ImprestNote.belongsTo(ImprestFiscalYear, {
      foreignKey: "fiscal_year_id",
      as: "fiscalYear",
    });
  }

  if (!ImprestNote.associations?.items) {
    ImprestNote.hasMany(ImprestNoteItem, {
      foreignKey: "note_id",
      as: "items",
      onDelete: "CASCADE",
    });
  }
  if (!ImprestNoteItem.associations?.note) {
    ImprestNoteItem.belongsTo(ImprestNote, {
      foreignKey: "note_id",
      as: "note",
    });
  }

  if (!ImprestFinancialCode.associations?.noteItems) {
    ImprestFinancialCode.hasMany(ImprestNoteItem, {
      foreignKey: "financial_code_id",
      as: "noteItems",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestNoteItem.associations?.financialCode) {
    ImprestNoteItem.belongsTo(ImprestFinancialCode, {
      foreignKey: "financial_code_id",
      as: "financialCode",
    });
  }

  if (!ImprestNote.associations?.issues) {
    ImprestNote.hasMany(ImprestIssue, {
      foreignKey: "note_id",
      as: "issues",
      onDelete: "CASCADE",
    });
  }
  if (!ImprestIssue.associations?.note) {
    ImprestIssue.belongsTo(ImprestNote, {
      foreignKey: "note_id",
      as: "note",
    });
  }

  if (!ImprestNote.associations?.adjustments) {
    ImprestNote.hasMany(ImprestAdjustment, {
      foreignKey: "note_id",
      as: "adjustments",
      onDelete: "CASCADE",
    });
  }
  if (!ImprestAdjustment.associations?.note) {
    ImprestAdjustment.belongsTo(ImprestNote, {
      foreignKey: "note_id",
      as: "note",
    });
  }

  if (!ImprestNoteItem.associations?.adjustments) {
    ImprestNoteItem.hasMany(ImprestAdjustment, {
      foreignKey: "note_item_id",
      as: "adjustments",
      onDelete: "CASCADE",
    });
  }
  if (!ImprestAdjustment.associations?.noteItem) {
    ImprestAdjustment.belongsTo(ImprestNoteItem, {
      foreignKey: "note_item_id",
      as: "noteItem",
    });
  }

  if (!ImprestFinancialCode.associations?.adjustments) {
    ImprestFinancialCode.hasMany(ImprestAdjustment, {
      foreignKey: "financial_code_id",
      as: "adjustments",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestAdjustment.associations?.financialCode) {
    ImprestAdjustment.belongsTo(ImprestFinancialCode, {
      foreignKey: "financial_code_id",
      as: "financialCode",
    });
  }

  if (!ImprestBase.associations?.durationAdjustments) {
    ImprestBase.hasMany(ImprestDurationAdjustment, {
      foreignKey: "base_id",
      as: "durationAdjustments",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestDurationAdjustment.associations?.base) {
    ImprestDurationAdjustment.belongsTo(ImprestBase, {
      foreignKey: "base_id",
      as: "base",
    });
  }

  if (!ImprestFiscalYear.associations?.durationAdjustments) {
    ImprestFiscalYear.hasMany(ImprestDurationAdjustment, {
      foreignKey: "fiscal_year_id",
      as: "durationAdjustments",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestDurationAdjustment.associations?.fiscalYear) {
    ImprestDurationAdjustment.belongsTo(ImprestFiscalYear, {
      foreignKey: "fiscal_year_id",
      as: "fiscalYear",
    });
  }

  if (!ImprestFinancialCode.associations?.sourceDurationAdjustments) {
    ImprestFinancialCode.hasMany(ImprestDurationAdjustment, {
      foreignKey: "source_financial_code_id",
      as: "sourceDurationAdjustments",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestDurationAdjustment.associations?.sourceFinancialCode) {
    ImprestDurationAdjustment.belongsTo(ImprestFinancialCode, {
      foreignKey: "source_financial_code_id",
      as: "sourceFinancialCode",
    });
  }

  if (!ImprestFinancialCode.associations?.targetDurationAdjustments) {
    ImprestFinancialCode.hasMany(ImprestDurationAdjustment, {
      foreignKey: "target_financial_code_id",
      as: "targetDurationAdjustments",
      onDelete: "RESTRICT",
    });
  }
  if (!ImprestDurationAdjustment.associations?.targetFinancialCode) {
    ImprestDurationAdjustment.belongsTo(ImprestFinancialCode, {
      foreignKey: "target_financial_code_id",
      as: "targetFinancialCode",
    });
  }

  if (!ImprestNote.associations?.creator) {
    ImprestNote.belongsTo(User, {
      foreignKey: "created_by",
      as: "creator",
    });
  }
  if (!ImprestNote.associations?.submitter) {
    ImprestNote.belongsTo(User, {
      foreignKey: "submitted_by",
      as: "submitter",
    });
  }
  if (!ImprestNote.associations?.approver) {
    ImprestNote.belongsTo(User, {
      foreignKey: "approved_by",
      as: "approver",
    });
  }
  if (!ImprestNote.associations?.issuer) {
    ImprestNote.belongsTo(User, {
      foreignKey: "issued_by",
      as: "issuer",
    });
  }

  if (!ImprestIssue.associations?.issuer) {
    ImprestIssue.belongsTo(User, {
      foreignKey: "issued_by",
      as: "issuer",
    });
  }

  if (!ImprestAdjustment.associations?.creator) {
    ImprestAdjustment.belongsTo(User, {
      foreignKey: "created_by",
      as: "creator",
    });
  }

  if (!ImprestDurationAdjustment.associations?.creator) {
    ImprestDurationAdjustment.belongsTo(User, {
      foreignKey: "created_by",
      as: "creator",
    });
  }
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getActorUserId(req) {
  const n = Number(req.user?.id || 0);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function getAssignedBaseId(req) {
  const n = Number(req.user?.section_id || 0);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function toSafeInt(value, fallback = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function toMoney(value, fallback = 0) {
  if (value === null || value === undefined || String(value).trim() === "") return fallback;

  const safe = String(value)
    .replace(/[\u09e6-\u09ef]/g, (d) => String(d.charCodeAt(0) - 0x09e6))
    .replace(/,/g, "")
    .trim();

  const n = Number(safe);
  if (!Number.isFinite(n)) return fallback;
  return Number(n.toFixed(2));
}

function roundMoney(value) {
  return Number(toMoney(value, 0).toFixed(2));
}

function cleanText(value, maxLength = 2000) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function toDateOnly(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function todayDateOnly() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parsePagination(req, defaultLimit = 20) {
  const page = Math.max(1, toSafeInt(req.query.page, 1));
  const limit = Math.min(100, Math.max(5, toSafeInt(req.query.limit, defaultLimit)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function parseMonth(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;

  const n = toSafeInt(text, null);
  if (n && n >= 1 && n <= 12) return n;

  const idx = MONTH_NAMES_EN.findIndex((x) => x.toLowerCase() === text.toLowerCase());
  if (idx >= 0) return idx + 1;

  return null;
}

function parsePakkhik(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return null;
  if (["FIRST_HALF", "FIRST", "1", "H1", "1ST", "1ST_HALF"].includes(text)) return "FIRST_HALF";
  if (["SECOND_HALF", "SECOND", "2", "H2", "2ND", "2ND_HALF"].includes(text)) return "SECOND_HALF";
  if (["NONE", "NA", "N/A", "0"].includes(text)) return "NONE";
  if (["SUPPLEMENTARY", "SUPP", "SUP", "EXTRA", "COMPLEMENTARY", "COMP"].includes(text)) return "NONE";
  return null;
}

function parseDemandType(value) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return null;
  if (["REGULAR", "NORMAL"].includes(text)) return "REGULAR";
  if (["COMPLEMENTARY", "SUPPLEMENTARY", "COMP", "SUPP", "EXTRA"].includes(text)) return "COMPLEMENTARY";
  return null;
}

function normalizeDemandType(rawDemandType, rawPakkhik) {
  const demandType = parseDemandType(rawDemandType);
  if (demandType) return demandType;

  const pakkhik = parsePakkhik(rawPakkhik);
  if (pakkhik === "NONE") return "COMPLEMENTARY";
  return "REGULAR";
}

function normalizePakkhik(rawPakkhik, demandType) {
  if (demandType === "COMPLEMENTARY") return "NONE";
  const pakkhik = parsePakkhik(rawPakkhik);
  if (pakkhik === "FIRST_HALF" || pakkhik === "SECOND_HALF") return pakkhik;
  return null;
}

function normalizeStoredDemandType(note) {
  const demandType = parseDemandType(note?.demand_type);
  if (demandType) return demandType;
  return parsePakkhik(note?.pakkhik) === "NONE" ? "COMPLEMENTARY" : "REGULAR";
}

function normalizeStoredPakkhik(note) {
  const demandType = normalizeStoredDemandType(note);
  if (demandType === "COMPLEMENTARY") return "NONE";
  const pakkhik = parsePakkhik(note?.pakkhik);
  return pakkhik === "FIRST_HALF" || pakkhik === "SECOND_HALF" ? pakkhik : "NONE";
}

function normalizeNoteStatus(status) {
  const text = String(status || "").trim().toUpperCase();
  if (!text) return "DRAFT";
  if (text === "FORWARDED") return "SUBMITTED";
  if (NOTE_ALLOWED_STATUSES.includes(text)) return text;
  return text;
}

function parseCodeIdList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  value.forEach((raw) => {
    const id = toPositiveInt(raw);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  return out;
}

function pickFirstPositive(...values) {
  for (const raw of values) {
    const n = toMoney(raw, 0);
    if (n > 0) return n;
  }
  return 0;
}

function computeRemaining(budgetAmount, previousExpense, currentClaim) {
  return roundMoney(toMoney(budgetAmount, 0) - toMoney(previousExpense, 0) - toMoney(currentClaim, 0));
}

function monthName(month) {
  const n = toSafeInt(month, null);
  if (!n || n < 1 || n > 12) return "-";
  return MONTH_NAMES_EN[n - 1];
}

function pakkhikNameEn(pakkhik) {
  const text = String(pakkhik || "").toUpperCase();
  if (text === "FIRST_HALF") return "1st Half";
  if (text === "SECOND_HALF") return "2nd Half";
  if (text === "NONE") return "None";
  if (text === "SUPPLEMENTARY") return "Complementary";
  return text || "-";
}

function formatDateOnly(value) {
  if (!value) return null;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildPreviousPeriodCondition(periodStart) {
  return {
    period_start: { [Op.lt]: periodStart },
  };
}

function isGeneralUser(req) {
  return normalizeRole(req.user?.role) === "general";
}

function isMasterUser(req) {
  return normalizeRole(req.user?.role) === "master";
}

function isAdminUser(req) {
  return normalizeRole(req.user?.role) === "admin";
}

function assertGeneralBaseAccess(req, baseId) {
  if (!isGeneralUser(req)) return null;

  const assignedBaseId = getAssignedBaseId(req);
  if (!assignedBaseId) {
    return {
      status: 403,
      message: "Your account has no assigned base/section",
    };
  }

  if (Number(assignedBaseId) !== Number(baseId)) {
    return {
      status: 403,
      message: "You can only access your assigned base/section",
    };
  }

  return null;
}

function canViewNote(req, note) {
  if (isAdminUser(req) || isMasterUser(req)) return true;
  if (!isGeneralUser(req)) return false;

  const assignedBaseId = getAssignedBaseId(req);
  if (!assignedBaseId) return false;

  return Number(note.base_id) === Number(assignedBaseId);
}

function canEditDraft(req, note) {
  if (note.status !== "DRAFT") return false;
  if (isAdminUser(req)) return true;

  if (isGeneralUser(req)) {
    const assignedBaseId = getAssignedBaseId(req);
    if (!assignedBaseId) return false;
    return Number(note.base_id) === Number(assignedBaseId);
  }

  return false;
}

function buildNoteFlags(req, note) {
  const status = normalizeNoteStatus(note.status);

  return {
    can_view: canViewNote(req, note),
    can_edit: canEditDraft(req, note),
    can_edit_items: canEditDraft(req, note),
    can_submit: canEditDraft(req, note),
    can_approve: (isAdminUser(req) || isMasterUser(req)) && ["SUBMITTED"].includes(status),
    can_reject: (isAdminUser(req) || isMasterUser(req)) && ["DRAFT", "SUBMITTED"].includes(status),
    can_issue: (isAdminUser(req) || isMasterUser(req)) && ["APPROVED"].includes(status),
    can_adjust:
      (isAdminUser(req) || isMasterUser(req)) && ["FUND_ISSUED", "PARTIALLY_ADJUSTED"].includes(status),
    can_print: canViewNote(req, note),
  };
}

function serializeBase(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return null;
  return {
    id: Number(item.id),
    base_name: item.base_name,
    base_code: item.base_code,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function serializeFinancialCode(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return null;
  return {
    id: Number(item.id),
    code: item.code,
    khat_name_bn: item.khat_name_bn,
    khat_name_en: item.khat_name_en,
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function serializeFiscalYear(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return null;
  return {
    id: Number(item.id),
    name: item.name,
    start_date: formatDateOnly(item.start_date),
    end_date: formatDateOnly(item.end_date),
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
function serializeBudget(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return null;
  return {
    id: Number(item.id),
    base_id: Number(item.base_id),
    fiscal_year_id: Number(item.fiscal_year_id),
    financial_code_id: Number(item.financial_code_id),
    budget_amount: toMoney(item.budget_amount, 0),
    base: item.base
      ? {
          id: Number(item.base.id),
          base_name: item.base.base_name,
          base_code: item.base.base_code,
        }
      : null,
    fiscal_year: item.fiscalYear
      ? {
          id: Number(item.fiscalYear.id),
          name: item.fiscalYear.name,
        }
      : null,
    financial_code: item.financialCode
      ? {
          id: Number(item.financialCode.id),
          code: item.financialCode.code,
          khat_name_bn: item.financialCode.khat_name_bn,
          khat_name_en: item.financialCode.khat_name_en,
        }
      : null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function serializeNoteItem(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return null;

  const previousIssued = toMoney(item.previous_issued_amount, toMoney(item.previous_expense, 0));
  const claimed = toMoney(item.current_claim, 0);
  const approved = toMoney(item.approved_amount, claimed);
  const issued = toMoney(item.issued_amount, approved);
  const adjusted = toMoney(item.adjustment_amount, 0);
  const unadjusted = toMoney(item.unadjusted_amount, roundMoney(issued - adjusted));
  const budgetRemaining = toMoney(
    item.budget_remaining,
    roundMoney(toMoney(item.budget_amount, 0) - previousIssued - issued)
  );

  return {
    id: Number(item.id),
    note_item_id: Number(item.id),
    note_id: Number(item.note_id),
    financial_code_id: Number(item.financial_code_id),
    khat_name: item.khat_name,
    budget_amount: toMoney(item.budget_amount, 0),
    previous_issued_amount: previousIssued,
    previous_expense: previousIssued,
    current_claim: claimed,
    claimed_amount: claimed,
    approved_amount: approved,
    issued_amount: issued,
    adjustment_amount: adjusted,
    adjusted_amount: adjusted,
    unadjusted_amount: unadjusted,
    budget_remaining: budgetRemaining,
    remaining_balance: toMoney(item.remaining_balance, 0),
    remarks: item.remarks || null,
    financial_code: item.financialCode
      ? {
          id: Number(item.financialCode.id),
          code: item.financialCode.code,
          khat_name_bn: item.financialCode.khat_name_bn,
          khat_name_en: item.financialCode.khat_name_en,
          status: item.financialCode.status,
        }
      : null,
  };
}

function serializeIssue(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return null;

  return {
    id: Number(item.id),
    note_id: Number(item.note_id),
    issue_date: formatDateOnly(item.issue_date),
    dispatch_no: item.dispatch_no || item.voucher_no || null,
    voucher_no: item.voucher_no || item.dispatch_no || null,
    total_issued_amount: toMoney(item.total_issued_amount, 0),
    issued_by: item.issued_by ? Number(item.issued_by) : null,
    issued_by_name: item.issuer?.name || item.issuer?.username || null,
    remarks: item.remarks || null,
    createdAt: item.createdAt,
  };
}

function serializeAdjustment(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return null;

  return {
    id: Number(item.id),
    note_id: Number(item.note_id),
    note_item_id: item.note_item_id ? Number(item.note_item_id) : null,
    financial_code_id: Number(item.financial_code_id),
    adjusted_amount: toMoney(item.adjusted_amount, 0),
    adjustment_date: formatDateOnly(item.adjustment_date),
    adjustment_ref_no: item.adjustment_ref_no || item.voucher_no || null,
    voucher_no: item.voucher_no || null,
    remarks: item.remarks || null,
    created_by: item.created_by ? Number(item.created_by) : null,
    created_by_name: item.creator?.name || item.creator?.username || null,
    note_item: item.noteItem
      ? {
          id: Number(item.noteItem.id),
          note_id: Number(item.noteItem.note_id),
          financial_code_id: Number(item.noteItem.financial_code_id),
          khat_name: item.noteItem.khat_name,
        }
      : null,
    financial_code: item.financialCode
      ? {
          id: Number(item.financialCode.id),
          code: item.financialCode.code,
          khat_name_bn: item.financialCode.khat_name_bn,
        }
      : null,
    createdAt: item.createdAt,
  };
}

function serializeDurationAdjustment(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return null;

  return {
    id: Number(item.id),
    base_id: Number(item.base_id),
    fiscal_year_id: Number(item.fiscal_year_id),
    duration_key: item.duration_key,
    duration_label: item.duration_label,
    duration_start: formatDateOnly(item.duration_start),
    duration_end: formatDateOnly(item.duration_end),
    source_financial_code_id: item.source_financial_code_id ? Number(item.source_financial_code_id) : null,
    target_financial_code_id: item.target_financial_code_id ? Number(item.target_financial_code_id) : null,
    issued_reference_amount: toMoney(item.issued_reference_amount, 0),
    adjusted_amount: toMoney(item.adjusted_amount, 0),
    adjustment_date: formatDateOnly(item.adjustment_date),
    voucher_no: item.voucher_no || null,
    remarks: item.remarks || null,
    created_by: item.created_by ? Number(item.created_by) : null,
    created_by_name: item.creator?.name || item.creator?.username || null,
    source_financial_code: item.sourceFinancialCode
      ? {
          id: Number(item.sourceFinancialCode.id),
          code: item.sourceFinancialCode.code,
          khat_name_bn: item.sourceFinancialCode.khat_name_bn,
          khat_name_en: item.sourceFinancialCode.khat_name_en || null,
        }
      : null,
    target_financial_code: item.targetFinancialCode
      ? {
          id: Number(item.targetFinancialCode.id),
          code: item.targetFinancialCode.code,
          khat_name_bn: item.targetFinancialCode.khat_name_bn,
          khat_name_en: item.targetFinancialCode.khat_name_en || null,
        }
      : null,
    createdAt: item.createdAt,
  };
}

function serializeNote(row, req, { includeDetails = true } = {}) {
  const note = row?.toJSON ? row.toJSON() : row;
  if (!note) return null;
  const demandType = normalizeStoredDemandType(note);
  const pakkhik = normalizeStoredPakkhik(note);

  const base = note.base
    ? {
        id: Number(note.base.id),
        base_name: note.base.base_name,
        base_code: note.base.base_code,
      }
    : null;

  const fiscalYear = note.fiscalYear
    ? {
        id: Number(note.fiscalYear.id),
        name: note.fiscalYear.name,
        start_date: formatDateOnly(note.fiscalYear.start_date),
        end_date: formatDateOnly(note.fiscalYear.end_date),
      }
    : null;

  const payload = {
    id: Number(note.id),
    note_no: note.note_no,
    base_id: Number(note.base_id),
    fiscal_year_id: Number(note.fiscal_year_id),
    month: Number(note.month),
    month_name: monthName(note.month),
    demand_type: demandType,
    pakkhik: pakkhik,
    pakkhik_label: pakkhikNameEn(pakkhik),
    period_start: formatDateOnly(note.period_start),
    period_end: formatDateOnly(note.period_end),
    status: normalizeNoteStatus(note.status),
    raw_status: note.status,
    total_budget: toMoney(note.total_budget, 0),
    total_previous_expense: toMoney(note.total_previous_expense, 0),
    total_current_claim: toMoney(note.total_current_claim, 0),
    total_remaining: toMoney(note.total_remaining, 0),
    created_by: note.created_by ? Number(note.created_by) : null,
    submitted_by: note.submitted_by ? Number(note.submitted_by) : null,
    approved_by: note.approved_by ? Number(note.approved_by) : null,
    issued_by: note.issued_by ? Number(note.issued_by) : null,
    remarks: note.remarks || null,
    base,
    fiscal_year: fiscalYear,
    created_by_name: note.creator?.name || note.creator?.username || null,
    submitted_by_name: note.submitter?.name || note.submitter?.username || null,
    approved_by_name: note.approver?.name || note.approver?.username || null,
    issued_by_name: note.issuer?.name || note.issuer?.username || null,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    ...buildNoteFlags(req, note),
  };

  if (includeDetails) {
    payload.items = Array.isArray(note.items) ? note.items.map(serializeNoteItem) : [];
    payload.issues = Array.isArray(note.issues) ? note.issues.map(serializeIssue) : [];
    payload.adjustments = Array.isArray(note.adjustments)
      ? note.adjustments.map(serializeAdjustment)
      : [];
  }

  return payload;
}
async function fetchNoteWithDetails(noteId, transaction = null) {
  ensureAssociations();
  return ImprestNote.findByPk(noteId, {
    include: [
      {
        model: ImprestBase,
        as: "base",
        attributes: ["id", "base_name", "base_code"],
        required: false,
      },
      {
        model: ImprestFiscalYear,
        as: "fiscalYear",
        attributes: ["id", "name", "start_date", "end_date"],
        required: false,
      },
      {
        model: User,
        as: "creator",
        attributes: ["id", "name", "username"],
        required: false,
      },
      {
        model: User,
        as: "submitter",
        attributes: ["id", "name", "username"],
        required: false,
      },
      {
        model: User,
        as: "approver",
        attributes: ["id", "name", "username"],
        required: false,
      },
      {
        model: User,
        as: "issuer",
        attributes: ["id", "name", "username"],
        required: false,
      },
      {
        model: ImprestNoteItem,
        as: "items",
        include: [
          {
            model: ImprestFinancialCode,
            as: "financialCode",
            attributes: ["id", "code", "khat_name_bn", "khat_name_en", "status"],
            required: false,
          },
        ],
        required: false,
      },
      {
        model: ImprestIssue,
        as: "issues",
        include: [
          {
            model: User,
            as: "issuer",
            attributes: ["id", "name", "username"],
            required: false,
          },
        ],
        required: false,
      },
      {
        model: ImprestAdjustment,
        as: "adjustments",
        include: [
          {
            model: ImprestNoteItem,
            as: "noteItem",
            attributes: ["id", "note_id", "financial_code_id", "khat_name"],
            required: false,
          },
          {
            model: User,
            as: "creator",
            attributes: ["id", "name", "username"],
            required: false,
          },
          {
            model: ImprestFinancialCode,
            as: "financialCode",
            attributes: ["id", "code", "khat_name_bn", "khat_name_en"],
            required: false,
          },
        ],
        required: false,
      },
    ],
    order: [
      [{ model: ImprestNoteItem, as: "items" }, "id", "ASC"],
      [{ model: ImprestIssue, as: "issues" }, "id", "ASC"],
      [{ model: ImprestAdjustment, as: "adjustments" }, "id", "ASC"],
    ],
    transaction,
  });
}

function resolveFiscalMonthYear(fiscalYear, month) {
  const start = new Date(fiscalYear.start_date);
  const end = new Date(fiscalYear.end_date);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const now = new Date();
    return now.getFullYear();
  }

  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  const startMonth = start.getMonth() + 1;

  if (startYear === endYear) return startYear;
  return month >= startMonth ? startYear : endYear;
}

function computePeriod(fiscalYear, month, pakkhik, customStart = null, customEnd = null, demandType = "REGULAR") {
  if (demandType === "COMPLEMENTARY" || pakkhik === "NONE" || pakkhik === "SUPPLEMENTARY") {
    const periodStart = toDateOnly(customStart);
    const periodEnd = toDateOnly(customEnd);
    if (!periodStart || !periodEnd) return null;
    if (new Date(periodStart).getTime() > new Date(periodEnd).getTime()) return null;
    return {
      period_start: periodStart,
      period_end: periodEnd,
    };
  }

  if (!["FIRST_HALF", "SECOND_HALF"].includes(String(pakkhik || ""))) return null;

  const year = resolveFiscalMonthYear(fiscalYear, month);
  const monthText = String(month).padStart(2, "0");

  if (pakkhik === "FIRST_HALF") {
    return {
      period_start: `${year}-${monthText}-01`,
      period_end: `${year}-${monthText}-15`,
    };
  }

  const monthEndDay = new Date(year, month, 0).getDate();
  return {
    period_start: `${year}-${monthText}-16`,
    period_end: `${year}-${monthText}-${String(monthEndDay).padStart(2, "0")}`,
  };
}

function getKhatName(code) {
  if (!code) return "-";
  return String(code.khat_name_bn || code.khat_name_en || code.code || "-").trim() || "-";
}

async function generateNoteNo({ fiscalYear, month, pakkhik, transaction }) {
  const fyToken = String(fiscalYear?.name || "FY")
    .replace(/[^0-9A-Za-z]/g, "")
    .toUpperCase();
  const halfToken = pakkhik === "FIRST_HALF" ? "FH" : pakkhik === "SECOND_HALF" ? "SH" : "COMP";
  const prefix = `IMP-${fyToken}-${String(month).padStart(2, "0")}-${halfToken}-`;

  const latest = await ImprestNote.findOne({
    where: { note_no: { [Op.like]: `${prefix}%` } },
    attributes: ["note_no"],
    order: [["id", "DESC"]],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  let serial = 1;
  if (latest?.note_no) {
    const m = String(latest.note_no).match(/-(\d{4})$/);
    if (m) serial = Number(m[1]) + 1;
  }

  return `${prefix}${String(serial).padStart(4, "0")}`;
}

function buildHalfPeriodsForFiscalYear(fiscalYear) {
  const start = toDateOnly(fiscalYear?.start_date);
  const end = toDateOnly(fiscalYear?.end_date);
  if (!start || !end) return [];

  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];

  const periods = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

  while (cursor.getTime() <= endDate.getTime()) {
    const year = cursor.getFullYear();
    const month = cursor.getMonth() + 1;
    const monthText = String(month).padStart(2, "0");
    const monthEndDay = new Date(year, month, 0).getDate();

    const candidates = [
      {
        month,
        year,
        pakkhik: "FIRST_HALF",
        period_start: `${year}-${monthText}-01`,
        period_end: `${year}-${monthText}-15`,
      },
      {
        month,
        year,
        pakkhik: "SECOND_HALF",
        period_start: `${year}-${monthText}-16`,
        period_end: `${year}-${monthText}-${String(monthEndDay).padStart(2, "0")}`,
      },
    ];

    candidates.forEach((row) => {
      if (row.period_end < start || row.period_start > end) return;
      periods.push(row);
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  periods.sort((a, b) => {
    if (a.period_start < b.period_start) return -1;
    if (a.period_start > b.period_start) return 1;
    return 0;
  });

  return periods;
}

function buildAdjustmentDurations(fiscalYear) {
  const periods = buildHalfPeriodsForFiscalYear(fiscalYear);
  if (!periods.length) return [];

  const durations = [];
  let serial = 1;

  const first = periods[0];
  durations.push({
    duration_key: `DUR-${String(serial).padStart(2, "0")}-${first.period_start.replace(/-/g, "")}-${first.period_end.replace(
      /-/g,
      ""
    )}`,
    duration_index: serial,
    duration_label: `${monthName(first.month)} ${first.year} ${pakkhikNameEn(first.pakkhik)}`,
    duration_start: first.period_start,
    duration_end: first.period_end,
    periods: [first],
  });
  serial += 1;

  for (let i = 1; i < periods.length; i += 2) {
    const start = periods[i];
    const end = periods[i + 1] || periods[i];
    const label = `${monthName(start.month)} ${start.year} ${pakkhikNameEn(start.pakkhik)} + ${monthName(
      end.month
    )} ${end.year} ${pakkhikNameEn(end.pakkhik)}`;

    durations.push({
      duration_key: `DUR-${String(serial).padStart(2, "0")}-${start.period_start.replace(/-/g, "")}-${end.period_end.replace(
        /-/g,
        ""
      )}`,
      duration_index: serial,
      duration_label: label,
      duration_start: start.period_start,
      duration_end: end.period_end,
      periods: [start, end],
    });
    serial += 1;
  }

  return durations;
}

function findDurationByKey(durations, durationKey) {
  const key = String(durationKey || "").trim();
  if (!key) return null;
  return durations.find((x) => x.duration_key === key) || null;
}

function findDurationByDate(durations, dateText) {
  const dateOnly = toDateOnly(dateText);
  if (!dateOnly) return null;
  return durations.find((x) => dateOnly >= x.duration_start && dateOnly <= x.duration_end) || null;
}

async function loadIssuedSummaryByDuration(baseId, fiscalYearId, durations, transaction = null) {
  ensureAssociations();

  const notes = await ImprestNote.findAll({
    where: {
      base_id: baseId,
      fiscal_year_id: fiscalYearId,
      status: { [Op.in]: ["FUND_ISSUED", "PARTIALLY_ADJUSTED", "ADJUSTED"] },
    },
    attributes: ["id", "note_no", "period_start", "period_end", "status"],
    include: [
      {
        model: ImprestNoteItem,
        as: "items",
        attributes: ["id", "financial_code_id", "issued_amount"],
        include: [
          {
            model: ImprestFinancialCode,
            as: "financialCode",
            attributes: ["id", "code", "khat_name_bn", "khat_name_en"],
            required: false,
          },
        ],
        required: false,
      },
    ],
    order: [["period_start", "ASC"], ["id", "ASC"], [{ model: ImprestNoteItem, as: "items" }, "id", "ASC"]],
    transaction,
  });

  const byDuration = new Map();
  durations.forEach((duration) => {
    byDuration.set(duration.duration_key, {
      issued_total: 0,
      issued_rows: new Map(),
      notes: [],
    });
  });

  notes.forEach((note) => {
    const duration = findDurationByDate(durations, note.period_start);
    if (!duration) return;
    const bucket = byDuration.get(duration.duration_key);
    if (!bucket) return;

    bucket.notes.push({
      note_id: Number(note.id),
      note_no: note.note_no,
      period_start: formatDateOnly(note.period_start),
      period_end: formatDateOnly(note.period_end),
      status: note.status,
    });

    const items = Array.isArray(note.items) ? note.items : [];
    items.forEach((item) => {
      const codeId = Number(item.financial_code_id || 0);
      if (!codeId) return;

      const issued = toMoney(item.issued_amount, 0);
      if (issued <= 0) return;

      const current = bucket.issued_rows.get(codeId) || {
        financial_code_id: codeId,
        code: item.financialCode?.code || `CODE-${codeId}`,
        khat_name_bn: item.financialCode?.khat_name_bn || null,
        khat_name_en: item.financialCode?.khat_name_en || null,
        issued_amount: 0,
      };

      current.issued_amount = roundMoney(current.issued_amount + issued);
      bucket.issued_rows.set(codeId, current);
      bucket.issued_total = roundMoney(bucket.issued_total + issued);
    });
  });

  return byDuration;
}

async function loadDurationAdjustmentRows(baseId, fiscalYearId, durationKey = null, transaction = null) {
  ensureAssociations();

  const where = {
    base_id: baseId,
    fiscal_year_id: fiscalYearId,
  };
  if (durationKey) where.duration_key = durationKey;

  return ImprestDurationAdjustment.findAll({
    where,
    include: [
      {
        model: ImprestFinancialCode,
        as: "sourceFinancialCode",
        attributes: ["id", "code", "khat_name_bn", "khat_name_en"],
        required: false,
      },
      {
        model: ImprestFinancialCode,
        as: "targetFinancialCode",
        attributes: ["id", "code", "khat_name_bn", "khat_name_en"],
        required: false,
      },
      {
        model: User,
        as: "creator",
        attributes: ["id", "name", "username"],
        required: false,
      },
    ],
    order: [["adjustment_date", "ASC"], ["id", "ASC"]],
    transaction,
  });
}

async function getBudgetRows(baseId, fiscalYearId, transaction = null) {
  ensureAssociations();

  return ImprestBudgetAllocation.findAll({
    where: {
      base_id: baseId,
      fiscal_year_id: fiscalYearId,
    },
    include: [
      {
        model: ImprestFinancialCode,
        as: "financialCode",
        attributes: ["id", "code", "khat_name_bn", "khat_name_en", "status"],
        required: false,
      },
    ],
    order: [[{ model: ImprestFinancialCode, as: "financialCode" }, "code", "ASC"], ["id", "ASC"]],
    transaction,
  });
}

async function getPreviousExpenseMap(baseId, fiscalYearId, periodStart, transaction = null) {
  ensureAssociations();

  const where = {
    base_id: baseId,
    fiscal_year_id: fiscalYearId,
    status: { [Op.in]: NOTE_ISSUED_STATUSES },
    ...buildPreviousPeriodCondition(periodStart),
  };

  const rows = await ImprestNote.findAll({
    where,
    attributes: ["id"],
    include: [
      {
        model: ImprestNoteItem,
        as: "items",
        attributes: ["financial_code_id", "issued_amount"],
        required: false,
      },
    ],
    transaction,
  });

  const map = new Map();
  rows.forEach((note) => {
    const lines = Array.isArray(note.items) ? note.items : [];
    lines.forEach((line) => {
      const codeId = Number(line.financial_code_id || 0);
      if (!codeId) return;

      const spent = toMoney(line.issued_amount, 0);
      if (spent <= 0) return;

      const old = toMoney(map.get(codeId), 0);
      map.set(codeId, roundMoney(old + spent));
    });
  });

  return map;
}
async function recalcNoteTotals(noteId, transaction = null) {
  const items = await ImprestNoteItem.findAll({
    where: { note_id: noteId },
    transaction,
  });

  const totals = items.reduce(
    (acc, row) => {
      acc.total_budget += toMoney(row.budget_amount, 0);
      acc.total_previous_expense += toMoney(row.previous_expense, 0);
      acc.total_current_claim += toMoney(row.current_claim, 0);
      acc.total_remaining += toMoney(row.remaining_balance, 0);
      return acc;
    },
    {
      total_budget: 0,
      total_previous_expense: 0,
      total_current_claim: 0,
      total_remaining: 0,
    }
  );

  await ImprestNote.update(
    {
      total_budget: roundMoney(totals.total_budget),
      total_previous_expense: roundMoney(totals.total_previous_expense),
      total_current_claim: roundMoney(totals.total_current_claim),
      total_remaining: roundMoney(totals.total_remaining),
    },
    {
      where: { id: noteId },
      transaction,
    }
  );

  return {
    total_budget: roundMoney(totals.total_budget),
    total_previous_expense: roundMoney(totals.total_previous_expense),
    total_current_claim: roundMoney(totals.total_current_claim),
    total_remaining: roundMoney(totals.total_remaining),
  };
}

async function syncNoteItemsFromBudget(note, budgetRows, previousExpenseMap, transaction) {
  const noteId = Number(note.id);
  const existingItems = await ImprestNoteItem.findAll({
    where: { note_id: noteId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  const itemByCode = new Map();
  existingItems.forEach((item) => {
    itemByCode.set(Number(item.financial_code_id), item);
  });

  for (const budgetRow of budgetRows) {
    const codeId = Number(budgetRow.financial_code_id);
    const budgetAmount = toMoney(budgetRow.budget_amount, 0);
    const previousIssued = toMoney(previousExpenseMap.get(codeId), 0);
    const khatName = getKhatName(budgetRow.financialCode);

    const existing = itemByCode.get(codeId);

    if (existing) {
      existing.khat_name = khatName;
      existing.budget_amount = roundMoney(budgetAmount);
      existing.previous_issued_amount = roundMoney(previousIssued);
      existing.previous_expense = roundMoney(previousIssued);

      const claim = toMoney(existing.current_claim, 0);
      const issued = toMoney(existing.issued_amount, 0);
      const adjusted = toMoney(existing.adjustment_amount, 0);
      const unadjusted = roundMoney(Math.max(0, issued - adjusted));

      existing.unadjusted_amount = unadjusted;
      existing.budget_remaining = roundMoney(budgetAmount - previousIssued - issued);
      existing.remaining_balance = computeRemaining(budgetAmount, previousIssued, claim);
      await existing.save({ transaction });
      continue;
    }

    await ImprestNoteItem.create(
      {
        note_id: noteId,
        financial_code_id: codeId,
        khat_name: khatName,
        budget_amount: roundMoney(budgetAmount),
        previous_issued_amount: roundMoney(previousIssued),
        previous_expense: roundMoney(previousIssued),
        current_claim: 0,
        approved_amount: 0,
        issued_amount: 0,
        adjustment_amount: 0,
        unadjusted_amount: 0,
        budget_remaining: roundMoney(budgetAmount - previousIssued),
        remaining_balance: computeRemaining(budgetAmount, previousIssued, 0),
      },
      { transaction }
    );
  }

  await recalcNoteTotals(noteId, transaction);
}

async function pruneDraftNoteItems(noteId, allowedCodeIds, transaction) {
  if (!(allowedCodeIds instanceof Set) || !allowedCodeIds.size) return;

  const rows = await ImprestNoteItem.findAll({
    where: { note_id: noteId },
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  for (const row of rows) {
    const codeId = Number(row.financial_code_id);
    if (allowedCodeIds.has(codeId)) continue;

    const hasValue =
      toMoney(row.current_claim, 0) > 0 ||
      toMoney(row.approved_amount, 0) > 0 ||
      toMoney(row.issued_amount, 0) > 0 ||
      toMoney(row.adjustment_amount, 0) > 0;

    if (hasValue) continue;
    await row.destroy({ transaction });
  }

  await recalcNoteTotals(noteId, transaction);
}

async function resolveNoteForAction(noteId, req, transaction) {
  const note = await fetchNoteWithDetails(noteId, transaction);
  if (!note) {
    return { error: { status: 404, message: "Imprest note not found" } };
  }

  if (!canViewNote(req, note)) {
    return { error: { status: 403, message: "Forbidden" } };
  }

  return { note };
}

function buildPrintMeta(note) {
  const baseName = note.base?.base_name || "-";
  const monthLabel = monthName(note.month);
  const year = note.period_start ? String(note.period_start).slice(0, 4) : "-";
  const pakkhik = normalizeStoredPakkhik(note);
  const demandType = normalizeStoredDemandType(note);
  const pakkhikLabel =
    pakkhik === "FIRST_HALF"
      ? "\u09e7\u09ae"
      : pakkhik === "SECOND_HALF"
      ? "\u09e8\u09df"
      : "\u09aa\u09b0\u09bf\u09aa\u09c2\u09b0\u0995";
  const currentClaim = toMoney(note.total_current_claim, 0);

  return {
    header_line: "\u0985\u09ab\u09bf\u09b8 \u09a8\u09cb\u099f/\u09aa\u09c3\u09b7\u09cd\u09a0\u09be/\u09e6\u09e8",
    subject:
      demandType === "COMPLEMENTARY"
        ? `\u09ac\u09bf\u09b7\u09df: ${baseName} \u098f\u09b0 ${monthLabel}/${year} \u09ae\u09be\u09b8\u09c7\u09b0 \u09aa\u09b0\u09bf\u09aa\u09c2\u09b0\u0995 \u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09a6\u09be\u09ac\u09c0\u0964`
        : `\u09ac\u09bf\u09b7\u09df: ${baseName} \u098f\u09b0 ${monthLabel}/${year} \u09ae\u09be\u09b8\u09c7\u09b0 \u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09a6\u09be\u09ac\u09c0 (${pakkhikLabel} \u09aa\u09be\u0995\u09cd\u09b7\u09bf\u0995)\u0964`,
    paragraph: `\u0989\u09aa\u09b0\u09cd\u09af\u09c1\u0995\u09cd\u09a4 \u09ac\u09bf\u09b7\u09af\u09bc\u09c7 ${note.period_start || "-"} \u09b9\u09a4\u09c7 ${note.period_end || "-"} \u09aa\u09b0\u09cd\u09af\u09a8\u09cd\u09a4 \u09b8\u09ae\u09af\u09bc\u09c7\u09b0 \u09ac\u09cd\u09af\u09af\u09bc \u09a8\u09bf\u09b0\u09cd\u09ac\u09be\u09b9\u09c7\u09b0 \u09a8\u09bf\u09ae\u09bf\u09a4\u09cd\u09a4\u09c7 = ${currentClaim.toFixed(
      2
    )}/- \u099f\u09be\u0995\u09be\u09b0 \u0986\u09b0\u09cd\u09a5\u09bf\u0995 \u09a6\u09be\u09ac\u09c0 \u09aa\u09be\u0993\u09af\u09bc\u09be \u0997\u09c7\u099b\u09c7\u0964`,
    footer: `\u098f\u09a4\u09a6\u09cd\u09ac\u09bf\u09b7\u09af\u09bc\u09c7, \u09b8\u0982\u09b6\u09cd\u09b2\u09bf\u09b7\u09cd\u099f \u0998\u09be\u0981\u099f\u09bf \u0995\u09b0\u09cd\u09a4\u09c3\u0995 \u09a6\u09be\u09ac\u09c0\u0995\u09c3\u09a4 = ${currentClaim.toFixed(
      2
    )}/- \u099f\u09be\u0995\u09be \u0985\u0997\u09cd\u09b0\u09bf\u09ae \u09aa\u09cd\u09b0\u09a6\u09be\u09a8 \u0995\u09b0\u09be \u09af\u09c7\u09a4\u09c7 \u09aa\u09be\u09b0\u09c7\u0964 \u09ae\u09b9\u09cb\u09a6\u09af\u09bc\u09c7\u09b0 \u09b8\u09a6\u09af\u09bc \u0985\u09a8\u09c1\u09ae\u09cb\u09a6\u09a8\u09c7\u09b0 \u099c\u09a8\u09cd\u09af \u09a8\u09a5\u09bf \u0989\u09aa\u09b8\u09cd\u09a5\u09be\u09aa\u09a8 \u0995\u09b0\u09be \u09b9\u09b2\u09cb\u0964`,
  };
}

exports.listBases = async (req, res) => {
  try {
    const where = {};
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();

    if (status && status !== "all") {
      where.status = status === "inactive" ? "inactive" : "active";
    }

    if (q) {
      where[Op.or] = [
        { base_name: { [Op.like]: `%${q}%` } },
        { base_code: { [Op.like]: `%${q}%` } },
      ];
    }

    if (isGeneralUser(req)) {
      const assignedBaseId = getAssignedBaseId(req);
      if (!assignedBaseId) {
        return res.status(403).json({ message: "Your account has no assigned base/section" });
      }
      where.id = assignedBaseId;
    }

    const rows = await ImprestBase.findAll({
      where,
      order: [["base_name", "ASC"], ["id", "ASC"]],
    });

    return res.json({ data: rows.map(serializeBase) });
  } catch (err) {
    console.error("imprest.listBases error:", err);
    return res.status(500).json({ message: "Failed to load bases" });
  }
};

exports.createBase = async (req, res) => {
  try {
    const baseName = cleanText(req.body?.base_name, 140);
    const baseCode = cleanText(req.body?.base_code, 40);
    const statusRaw = String(req.body?.status || "active").trim().toLowerCase();
    const status = statusRaw === "inactive" ? "inactive" : "active";

    if (!baseName) return res.status(400).json({ message: "base_name is required" });
    if (!baseCode) return res.status(400).json({ message: "base_code is required" });

    const existing = await ImprestBase.findOne({
      where: {
        [Op.or]: [{ base_name: baseName }, { base_code: baseCode }],
      },
    });

    if (existing) {
      return res.status(400).json({ message: "Base name or code already exists" });
    }

    const created = await ImprestBase.create({
      base_name: baseName,
      base_code: baseCode,
      status,
    });

    return res.status(201).json({ message: "Base created", data: serializeBase(created) });
  } catch (err) {
    console.error("imprest.createBase error:", err);
    return res.status(500).json({ message: "Failed to create base" });
  }
};

exports.listFinancialCodes = async (req, res) => {
  try {
    const where = {};
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();

    if (status && status !== "all") {
      where.status = status === "inactive" ? "inactive" : "active";
    }

    if (q) {
      where[Op.or] = [
        { code: { [Op.like]: `%${q}%` } },
        { khat_name_bn: { [Op.like]: `%${q}%` } },
        { khat_name_en: { [Op.like]: `%${q}%` } },
      ];
    }

    const rows = await ImprestFinancialCode.findAll({
      where,
      order: [["code", "ASC"], ["id", "ASC"]],
    });

    return res.json({ data: rows.map(serializeFinancialCode) });
  } catch (err) {
    console.error("imprest.listFinancialCodes error:", err);
    return res.status(500).json({ message: "Failed to load financial codes" });
  }
};

exports.createFinancialCode = async (req, res) => {
  try {
    const code = cleanText(req.body?.code, 60);
    const khatNameBn = cleanText(req.body?.khat_name_bn, 255);
    const khatNameEn = cleanText(req.body?.khat_name_en, 255);
    const statusRaw = String(req.body?.status || "active").trim().toLowerCase();
    const status = statusRaw === "inactive" ? "inactive" : "active";

    if (!code) return res.status(400).json({ message: "code is required" });
    if (!khatNameBn) return res.status(400).json({ message: "khat_name_bn is required" });

    const existing = await ImprestFinancialCode.findOne({ where: { code } });
    if (existing) {
      return res.status(400).json({ message: "Financial code already exists" });
    }

    const created = await ImprestFinancialCode.create({
      code,
      khat_name_bn: khatNameBn,
      khat_name_en: khatNameEn,
      status,
    });

    return res.status(201).json({ message: "Financial code created", data: serializeFinancialCode(created) });
  } catch (err) {
    console.error("imprest.createFinancialCode error:", err);
    return res.status(500).json({ message: "Failed to create financial code" });
  }
};

exports.listFiscalYears = async (req, res) => {
  try {
    const where = {};
    const status = String(req.query.status || "").trim().toLowerCase();

    if (status && status !== "all") {
      where.status = status === "inactive" ? "inactive" : "active";
    }

    const rows = await ImprestFiscalYear.findAll({
      where,
      order: [["start_date", "DESC"], ["id", "DESC"]],
    });

    return res.json({ data: rows.map(serializeFiscalYear) });
  } catch (err) {
    console.error("imprest.listFiscalYears error:", err);
    return res.status(500).json({ message: "Failed to load fiscal years" });
  }
};

exports.createFiscalYear = async (req, res) => {
  try {
    const name = cleanText(req.body?.name, 40);
    const startDate = toDateOnly(req.body?.start_date);
    const endDate = toDateOnly(req.body?.end_date);
    const statusRaw = String(req.body?.status || "active").trim().toLowerCase();
    const status = statusRaw === "inactive" ? "inactive" : "active";

    if (!name) return res.status(400).json({ message: "name is required" });
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "start_date and end_date are required" });
    }
    if (new Date(startDate).getTime() > new Date(endDate).getTime()) {
      return res.status(400).json({ message: "start_date cannot be greater than end_date" });
    }

    const existing = await ImprestFiscalYear.findOne({ where: { name } });
    if (existing) {
      return res.status(400).json({ message: "Fiscal year name already exists" });
    }

    const created = await ImprestFiscalYear.create({
      name,
      start_date: startDate,
      end_date: endDate,
      status,
    });

    return res.status(201).json({ message: "Fiscal year created", data: serializeFiscalYear(created) });
  } catch (err) {
    console.error("imprest.createFiscalYear error:", err);
    return res.status(500).json({ message: "Failed to create fiscal year" });
  }
};

exports.createBudget = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    ensureAssociations();

    const baseId = toPositiveInt(req.body?.base_id);
    const fiscalYearId = toPositiveInt(req.body?.fiscal_year_id);
    const financialCodeId = toPositiveInt(req.body?.financial_code_id);
    const budgetAmount = toMoney(req.body?.budget_amount, null);

    if (!baseId) {
      await t.rollback();
      return res.status(400).json({ message: "base_id is required" });
    }
    if (!fiscalYearId) {
      await t.rollback();
      return res.status(400).json({ message: "fiscal_year_id is required" });
    }
    if (!financialCodeId) {
      await t.rollback();
      return res.status(400).json({ message: "financial_code_id is required" });
    }
    if (budgetAmount === null || budgetAmount < 0) {
      await t.rollback();
      return res.status(400).json({ message: "budget_amount must be 0 or greater" });
    }

    const [base, fiscalYear, financialCode] = await Promise.all([
      ImprestBase.findByPk(baseId, { transaction: t }),
      ImprestFiscalYear.findByPk(fiscalYearId, { transaction: t }),
      ImprestFinancialCode.findByPk(financialCodeId, { transaction: t }),
    ]);

    if (!base || !fiscalYear || !financialCode) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid base/fiscal year/financial code" });
    }

    let row = await ImprestBudgetAllocation.findOne({
      where: {
        base_id: baseId,
        fiscal_year_id: fiscalYearId,
        financial_code_id: financialCodeId,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (row) {
      row.budget_amount = roundMoney(budgetAmount);
      await row.save({ transaction: t });
    } else {
      row = await ImprestBudgetAllocation.create(
        {
          base_id: baseId,
          fiscal_year_id: fiscalYearId,
          financial_code_id: financialCodeId,
          budget_amount: roundMoney(budgetAmount),
        },
        { transaction: t }
      );
    }

    await t.commit();

    const out = await ImprestBudgetAllocation.findByPk(row.id, {
      include: [
        { model: ImprestBase, as: "base", attributes: ["id", "base_name", "base_code"], required: false },
        { model: ImprestFiscalYear, as: "fiscalYear", attributes: ["id", "name"], required: false },
        {
          model: ImprestFinancialCode,
          as: "financialCode",
          attributes: ["id", "code", "khat_name_bn", "khat_name_en"],
          required: false,
        },
      ],
    });

    return res.status(201).json({
      message: "Budget allocation saved",
      data: serializeBudget(out),
    });
  } catch (err) {
    await t.rollback();
    console.error("imprest.createBudget error:", err);
    return res.status(500).json({ message: "Failed to save budget allocation" });
  }
};

exports.listBudgets = async (req, res) => {
  try {
    ensureAssociations();

    const where = {};
    const baseId = toPositiveInt(req.query.base_id);
    const fiscalYearId = toPositiveInt(req.query.fiscal_year_id);
    const financialCodeId = toPositiveInt(req.query.financial_code_id);

    if (isGeneralUser(req)) {
      const assignedBaseId = getAssignedBaseId(req);
      if (!assignedBaseId) {
        return res.status(403).json({ message: "Your account has no assigned base/section" });
      }
      where.base_id = assignedBaseId;
    } else if (baseId) {
      where.base_id = baseId;
    }
    if (fiscalYearId) where.fiscal_year_id = fiscalYearId;
    if (financialCodeId) where.financial_code_id = financialCodeId;

    const rows = await ImprestBudgetAllocation.findAll({
      where,
      include: [
        { model: ImprestBase, as: "base", attributes: ["id", "base_name", "base_code"], required: false },
        { model: ImprestFiscalYear, as: "fiscalYear", attributes: ["id", "name"], required: false },
        {
          model: ImprestFinancialCode,
          as: "financialCode",
          attributes: ["id", "code", "khat_name_bn", "khat_name_en", "status"],
          required: false,
        },
      ],
      order: [
        [{ model: ImprestBase, as: "base" }, "base_name", "ASC"],
        [{ model: ImprestFiscalYear, as: "fiscalYear" }, "start_date", "DESC"],
        [{ model: ImprestFinancialCode, as: "financialCode" }, "code", "ASC"],
        ["id", "ASC"],
      ],
    });

    return res.json({ data: rows.map(serializeBudget) });
  } catch (err) {
    console.error("imprest.listBudgets error:", err);
    return res.status(500).json({ message: "Failed to load budgets" });
  }
};
exports.generateNote = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    ensureAssociations();

    const baseId = toPositiveInt(req.body?.base_id);
    const fiscalYearId = toPositiveInt(req.body?.fiscal_year_id);
    const month = parseMonth(req.body?.month);
    const demandType = normalizeDemandType(req.body?.demand_type, req.body?.pakkhik);
    const pakkhik = normalizePakkhik(req.body?.pakkhik, demandType);
    const requestedCodeIds = parseCodeIdList(req.body?.financial_code_ids);

    if (!baseId || !fiscalYearId || !month || !demandType || !pakkhik) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "base_id, fiscal_year_id, month, demand_type and pakkhik are required" });
    }

    const accessError = assertGeneralBaseAccess(req, baseId);
    if (accessError) {
      await t.rollback();
      return res.status(accessError.status).json({ message: accessError.message });
    }

    const [base, fiscalYear] = await Promise.all([
      ImprestBase.findByPk(baseId, { transaction: t }),
      ImprestFiscalYear.findByPk(fiscalYearId, { transaction: t }),
    ]);

    if (!base || !fiscalYear) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid base or fiscal year" });
    }

    const period = computePeriod(
      fiscalYear,
      month,
      pakkhik,
      req.body?.period_start,
      req.body?.period_end,
      demandType
    );
    if (!period) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid period range for selected pakkhik" });
    }

    if (
      period.period_start < String(fiscalYear.start_date || "") ||
      period.period_end > String(fiscalYear.end_date || "")
    ) {
      await t.rollback();
      return res.status(400).json({ message: "Selected period must be inside fiscal year range" });
    }

    let budgetRows = await getBudgetRows(baseId, fiscalYearId, t);
    if (requestedCodeIds.length) {
      const allowed = new Set(requestedCodeIds);
      budgetRows = budgetRows.filter((row) => allowed.has(Number(row.financial_code_id)));
    }
    if (!budgetRows.length) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Budget allocation not found for selected base/fiscal year/codes" });
    }

    const previousExpenseMap = await getPreviousExpenseMap(baseId, fiscalYearId, period.period_start, t);

    let note = await ImprestNote.findOne({
      where: {
        base_id: baseId,
        fiscal_year_id: fiscalYearId,
        month,
        pakkhik,
        period_start: period.period_start,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    let createdNew = false;

    if (!note) {
      const noteNo = await generateNoteNo({ fiscalYear, month, pakkhik, transaction: t });

      note = await ImprestNote.create(
        {
          note_no: noteNo,
          base_id: baseId,
          fiscal_year_id: fiscalYearId,
          month,
          demand_type: demandType,
          pakkhik,
          period_start: period.period_start,
          period_end: period.period_end,
          status: "DRAFT",
          created_by: getActorUserId(req),
          remarks: cleanText(req.body?.remarks, 2000),
        },
        { transaction: t }
      );
      createdNew = true;
    } else if (note.status === "DRAFT") {
      note.demand_type = demandType;
      note.period_start = period.period_start;
      note.period_end = period.period_end;
      if (req.body?.remarks !== undefined) {
        note.remarks = cleanText(req.body?.remarks, 2000);
      }
      await note.save({ transaction: t });
    }

    if (createdNew || note.status === "DRAFT") {
      await syncNoteItemsFromBudget(note, budgetRows, previousExpenseMap, t);
      if (requestedCodeIds.length) {
        await pruneDraftNoteItems(note.id, new Set(requestedCodeIds), t);
      }
    }

    await t.commit();

    const out = await fetchNoteWithDetails(note.id);
    return res.status(createdNew ? 201 : 200).json({
      message: createdNew ? "Imprest note generated" : "Existing note loaded",
      reused_existing: !createdNew,
      data: serializeNote(out, req),
    });
  } catch (err) {
    await t.rollback();
    console.error("imprest.generateNote error:", err);
    if (err?.name === "SequelizeUniqueConstraintError") {
      return res.status(400).json({ message: "Duplicate note exists for selected period" });
    }
    return res.status(500).json({ message: "Failed to generate imprest note" });
  }
};

exports.listNotes = async (req, res) => {
  try {
    ensureAssociations();

    const { page, limit, offset } = parsePagination(req);
    const where = {};
    const role = normalizeRole(req.user?.role);

    const baseId = toPositiveInt(req.query.base_id);
    const fiscalYearId = toPositiveInt(req.query.fiscal_year_id);
    const month = parseMonth(req.query.month);
    const demandType = parseDemandType(req.query.demand_type);
    const pakkhik = parsePakkhik(req.query.pakkhik);
    const status = String(req.query.status || "").trim().toUpperCase();
    const q = String(req.query.q || "").trim();

    if (baseId) where.base_id = baseId;
    if (fiscalYearId) where.fiscal_year_id = fiscalYearId;
    if (month) where.month = month;
    if (demandType) where.demand_type = demandType;
    if (pakkhik) where.pakkhik = pakkhik;
    if (status && status !== "ALL" && NOTE_ALLOWED_STATUSES.includes(status)) {
      where.status = status === "SUBMITTED" ? { [Op.in]: ["SUBMITTED", "FORWARDED"] } : status;
    }

    if (role === "general") {
      const assignedBaseId = getAssignedBaseId(req);
      if (!assignedBaseId) {
        return res.status(403).json({ message: "Your account has no assigned base/section" });
      }
      where.base_id = assignedBaseId;
    }

    if (q) {
      where[Op.or] = [
        { note_no: { [Op.like]: `%${q}%` } },
        { remarks: { [Op.like]: `%${q}%` } },
        sequelize.where(col("base.base_name"), { [Op.like]: `%${q}%` }),
        sequelize.where(col("base.base_code"), { [Op.like]: `%${q}%` }),
      ];
    }

    const { rows, count } = await ImprestNote.findAndCountAll({
      where,
      include: [
        {
          model: ImprestBase,
          as: "base",
          attributes: ["id", "base_name", "base_code"],
          required: false,
        },
        {
          model: ImprestFiscalYear,
          as: "fiscalYear",
          attributes: ["id", "name", "start_date", "end_date"],
          required: false,
        },
        {
          model: User,
          as: "submitter",
          attributes: ["id", "name", "username"],
          required: false,
        },
        {
          model: User,
          as: "approver",
          attributes: ["id", "name", "username"],
          required: false,
        },
        {
          model: User,
          as: "issuer",
          attributes: ["id", "name", "username"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      distinct: true,
      limit,
      offset,
      subQuery: false,
    });

    return res.json({
      data: rows.map((row) => serializeNote(row, req, { includeDetails: false })),
      total: Number(count || 0),
      page,
      limit,
    });
  } catch (err) {
    console.error("imprest.listNotes error:", err);
    return res.status(500).json({ message: "Failed to load imprest notes" });
  }
};

exports.getNoteById = async (req, res) => {
  try {
    const noteId = toPositiveInt(req.params.id);
    if (!noteId) return res.status(400).json({ message: "Invalid note id" });

    const out = await resolveNoteForAction(noteId, req, null);
    if (out.error) return res.status(out.error.status).json({ message: out.error.message });

    return res.json({ data: serializeNote(out.note, req) });
  } catch (err) {
    console.error("imprest.getNoteById error:", err);
    return res.status(500).json({ message: "Failed to load imprest note" });
  }
};

exports.updateNoteItems = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const noteId = toPositiveInt(req.params.id);
    if (!noteId) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid note id" });
    }

    const out = await resolveNoteForAction(noteId, req, t);
    if (out.error) {
      await t.rollback();
      return res.status(out.error.status).json({ message: out.error.message });
    }

    const note = out.note;

    if (!canEditDraft(req, note)) {
      await t.rollback();
      return res.status(403).json({ message: "Draft editing is not allowed" });
    }

    const payloadRows = Array.isArray(req.body?.items)
      ? req.body.items
      : Array.isArray(req.body?.rows)
      ? req.body.rows
      : null;

    if (!payloadRows || !payloadRows.length) {
      await t.rollback();
      return res.status(400).json({ message: "items array is required" });
    }
    const replaceItems = Boolean(req.body?.replace_items || req.body?.replaceItems);

    const items = await ImprestNoteItem.findAll({
      where: { note_id: noteId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const byId = new Map();
    const byCodeId = new Map();
    items.forEach((item) => {
      byId.set(Number(item.id), item);
      byCodeId.set(Number(item.financial_code_id), item);
    });

    let budgetByCode = null;
    let previousExpenseMap = null;
    if (replaceItems) {
      const budgetRows = await getBudgetRows(note.base_id, note.fiscal_year_id, t);
      budgetByCode = new Map();
      budgetRows.forEach((row) => {
        budgetByCode.set(Number(row.financial_code_id), row);
      });
      previousExpenseMap = await getPreviousExpenseMap(note.base_id, note.fiscal_year_id, note.period_start, t);
    }

    const touchedIds = new Set();

    for (const raw of payloadRows) {
      const rowId = toPositiveInt(raw?.id);
      const codeId = toPositiveInt(raw?.financial_code_id);
      const target = (rowId && byId.get(rowId)) || (codeId && byCodeId.get(codeId));

      if (rowId && codeId && target && Number(target.financial_code_id) !== codeId) {
        await t.rollback();
        return res.status(400).json({ message: "Item id and financial_code_id mismatch" });
      }

      let workingItem = target;
      if (!workingItem) {
        if (!replaceItems || !codeId) {
          await t.rollback();
          return res.status(400).json({ message: "Invalid item row found in payload" });
        }

        const budgetRow = budgetByCode.get(codeId);
        if (!budgetRow) {
          await t.rollback();
          return res.status(400).json({ message: "Invalid financial_code_id for selected base/fiscal year" });
        }

        const budgetAmount = toMoney(budgetRow.budget_amount, 0);
        const previousIssued = toMoney(previousExpenseMap.get(codeId), 0);
        const khatName = getKhatName(budgetRow.financialCode);

        workingItem = await ImprestNoteItem.create(
          {
            note_id: noteId,
            financial_code_id: codeId,
            khat_name: khatName,
            budget_amount: roundMoney(budgetAmount),
            previous_issued_amount: roundMoney(previousIssued),
            previous_expense: roundMoney(previousIssued),
            current_claim: 0,
            approved_amount: 0,
            issued_amount: 0,
            adjustment_amount: 0,
            unadjusted_amount: 0,
            budget_remaining: roundMoney(budgetAmount - previousIssued),
            remaining_balance: computeRemaining(budgetAmount, previousIssued, 0),
          },
          { transaction: t }
        );
        byId.set(Number(workingItem.id), workingItem);
        byCodeId.set(Number(workingItem.financial_code_id), workingItem);
      }

      const claim = toMoney(raw?.current_claim, null);
      if (claim === null || claim < 0) {
        await t.rollback();
        return res.status(400).json({ message: "current_claim must be a non-negative number" });
      }
      const previousIssued = toMoney(workingItem.previous_issued_amount, toMoney(workingItem.previous_expense, 0));
      const claimCap = roundMoney(toMoney(workingItem.budget_amount, 0) - previousIssued);
      if (claim > claimCap) {
        await t.rollback();
        return res.status(400).json({
          message: "current_claim cannot exceed remaining budget after previous issued amount",
        });
      }

      workingItem.current_claim = roundMoney(claim);
      workingItem.remarks = cleanText(raw?.remarks, 1000);
      workingItem.remaining_balance = computeRemaining(workingItem.budget_amount, previousIssued, claim);
      workingItem.budget_remaining = roundMoney(toMoney(workingItem.budget_amount, 0) - previousIssued - toMoney(workingItem.issued_amount, 0));
      workingItem.unadjusted_amount = roundMoney(
        Math.max(0, toMoney(workingItem.issued_amount, 0) - toMoney(workingItem.adjustment_amount, 0))
      );
      await workingItem.save({ transaction: t });
      touchedIds.add(Number(workingItem.id));
    }

    if (replaceItems) {
      if (!touchedIds.size) {
        await t.rollback();
        return res.status(400).json({ message: "At least one code row is required" });
      }

      for (const item of items) {
        if (touchedIds.has(Number(item.id))) continue;
        await item.destroy({ transaction: t });
      }
    }

    if (req.body?.remarks !== undefined) {
      note.remarks = cleanText(req.body?.remarks, 2000);
      await note.save({ transaction: t });
    }

    await recalcNoteTotals(noteId, t);

    await t.commit();

    const refreshed = await fetchNoteWithDetails(noteId);
    return res.json({ message: "Draft note updated", data: serializeNote(refreshed, req) });
  } catch (err) {
    await t.rollback();
    console.error("imprest.updateNoteItems error:", err);
    return res.status(500).json({ message: "Failed to update note items" });
  }
};

exports.submitNote = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const noteId = toPositiveInt(req.params.id);
    if (!noteId) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid note id" });
    }

    const out = await resolveNoteForAction(noteId, req, t);
    if (out.error) {
      await t.rollback();
      return res.status(out.error.status).json({ message: out.error.message });
    }

    const note = out.note;
    if (!canEditDraft(req, note)) {
      await t.rollback();
      return res.status(403).json({ message: "Only draft owner can submit" });
    }

    const totals = await recalcNoteTotals(noteId, t);
    if (toMoney(totals.total_current_claim, 0) <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Current claim must be greater than 0 before submit" });
    }

    note.status = "SUBMITTED";
    note.submitted_by = getActorUserId(req);
    if (req.body?.remarks !== undefined) {
      note.remarks = cleanText(req.body?.remarks, 2000);
    }
    await note.save({ transaction: t });

    await t.commit();

    const refreshed = await fetchNoteWithDetails(noteId);
    return res.json({ message: "Imprest note submitted", data: serializeNote(refreshed, req) });
  } catch (err) {
    await t.rollback();
    console.error("imprest.submitNote error:", err);
    return res.status(500).json({ message: "Failed to submit imprest note" });
  }
};

exports.approveNote = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const noteId = toPositiveInt(req.params.id);
    if (!noteId) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid note id" });
    }

    const out = await resolveNoteForAction(noteId, req, t);
    if (out.error) {
      await t.rollback();
      return res.status(out.error.status).json({ message: out.error.message });
    }

    const note = out.note;
    const noteStatus = normalizeNoteStatus(note.status);

    if (!(isAdminUser(req) || isMasterUser(req))) {
      await t.rollback();
      return res.status(403).json({ message: "Only Admin/Master can approve" });
    }

    if (!["SUBMITTED"].includes(noteStatus)) {
      await t.rollback();
      return res.status(400).json({ message: "Only submitted note can be approved" });
    }

    const items = await ImprestNoteItem.findAll({
      where: { note_id: noteId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    for (const item of items) {
      const approvedAmount = toMoney(item.current_claim, 0);
      if (approvedAmount < 0) {
        await t.rollback();
        return res.status(400).json({ message: "current_claim must be non-negative" });
      }

      item.approved_amount = roundMoney(approvedAmount);
      const previousIssued = toMoney(item.previous_issued_amount, toMoney(item.previous_expense, 0));
      item.remaining_balance = computeRemaining(item.budget_amount, previousIssued, approvedAmount);
      item.budget_remaining = roundMoney(toMoney(item.budget_amount, 0) - previousIssued - toMoney(item.issued_amount, 0));
      await item.save({ transaction: t });
    }

    note.status = "APPROVED";
    note.approved_by = getActorUserId(req);
    if (req.body?.remarks !== undefined) {
      note.remarks = cleanText(req.body?.remarks, 2000);
    }
    await note.save({ transaction: t });

    await recalcNoteTotals(noteId, t);

    await t.commit();

    const refreshed = await fetchNoteWithDetails(noteId);
    return res.json({ message: "Imprest note approved", data: serializeNote(refreshed, req) });
  } catch (err) {
    await t.rollback();
    console.error("imprest.approveNote error:", err);
    return res.status(500).json({ message: "Failed to approve imprest note" });
  }
};

exports.rejectNote = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const noteId = toPositiveInt(req.params.id);
    if (!noteId) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid note id" });
    }

    const out = await resolveNoteForAction(noteId, req, t);
    if (out.error) {
      await t.rollback();
      return res.status(out.error.status).json({ message: out.error.message });
    }

    const note = out.note;
    const noteStatus = normalizeNoteStatus(note.status);

    if (!(isAdminUser(req) || isMasterUser(req))) {
      await t.rollback();
      return res.status(403).json({ message: "Only Admin/Master can reject" });
    }

    if (!["DRAFT", "SUBMITTED"].includes(noteStatus)) {
      await t.rollback();
      return res.status(400).json({ message: "This note can no longer be rejected" });
    }

    note.status = "REJECTED";
    note.remarks = cleanText(req.body?.remarks, 2000);
    await note.save({ transaction: t });

    await t.commit();

    const refreshed = await fetchNoteWithDetails(noteId);
    return res.json({ message: "Imprest note rejected", data: serializeNote(refreshed, req) });
  } catch (err) {
    await t.rollback();
    console.error("imprest.rejectNote error:", err);
    return res.status(500).json({ message: "Failed to reject imprest note" });
  }
};
exports.issueNote = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const noteId = toPositiveInt(req.params.id);
    if (!noteId) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid note id" });
    }

    const out = await resolveNoteForAction(noteId, req, t);
    if (out.error) {
      await t.rollback();
      return res.status(out.error.status).json({ message: out.error.message });
    }

    const note = out.note;
    const noteStatus = normalizeNoteStatus(note.status);

    if (!(isAdminUser(req) || isMasterUser(req))) {
      await t.rollback();
      return res.status(403).json({ message: "Only Admin/Master can issue fund" });
    }

    if (!["APPROVED"].includes(noteStatus)) {
      await t.rollback();
      return res.status(400).json({ message: "Only approved note can be issued" });
    }

    const rows = await ImprestNoteItem.findAll({
      where: { note_id: noteId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!rows.length) {
      await t.rollback();
      return res.status(400).json({ message: "No note item found to issue" });
    }

    let totalIssuedNow = 0;

    for (const row of rows) {
      const claimAmount = toMoney(row.current_claim, 0);
      if (claimAmount < 0) {
        await t.rollback();
        return res.status(400).json({ message: "Claim amount cannot be negative" });
      }

      row.approved_amount = roundMoney(claimAmount);
      row.issued_amount = roundMoney(claimAmount);

      const adjusted = toMoney(row.adjustment_amount, 0);
      row.unadjusted_amount = roundMoney(Math.max(0, claimAmount - adjusted));
      const previousIssued = toMoney(row.previous_issued_amount, toMoney(row.previous_expense, 0));
      row.budget_remaining = roundMoney(toMoney(row.budget_amount, 0) - previousIssued - claimAmount);
      row.remaining_balance = roundMoney(row.budget_remaining);
      await row.save({ transaction: t });
      totalIssuedNow = roundMoney(totalIssuedNow + claimAmount);
    }

    if (totalIssuedNow <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Total claim amount must be greater than 0 for issue" });
    }

    const issueDate = toDateOnly(req.body?.issue_date) || todayDateOnly();
    const dispatchNo = cleanText(req.body?.dispatch_no ?? req.body?.voucher_no, 120);
    const remarks = cleanText(req.body?.remarks, 1000);

    await ImprestIssue.create(
      {
        note_id: noteId,
        issue_date: issueDate,
        dispatch_no: dispatchNo,
        voucher_no: dispatchNo,
        total_issued_amount: roundMoney(totalIssuedNow),
        issued_by: getActorUserId(req),
        remarks,
      },
      { transaction: t }
    );

    note.status = "FUND_ISSUED";
    note.issued_by = getActorUserId(req);
    if (req.body?.remarks !== undefined) {
      note.remarks = cleanText(req.body?.remarks, 2000);
    }
    await note.save({ transaction: t });

    await recalcNoteTotals(noteId, t);

    await t.commit();

    const refreshed = await fetchNoteWithDetails(noteId);
    return res.json({ message: "Fund issued successfully", data: serializeNote(refreshed, req) });
  } catch (err) {
    await t.rollback();
    console.error("imprest.issueNote error:", err);
    return res.status(500).json({ message: "Failed to issue fund" });
  }
};

exports.adjustNote = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const noteId = toPositiveInt(req.params.id);
    if (!noteId) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid note id" });
    }

    const out = await resolveNoteForAction(noteId, req, t);
    if (out.error) {
      await t.rollback();
      return res.status(out.error.status).json({ message: out.error.message });
    }

    const note = out.note;
    const noteStatus = normalizeNoteStatus(note.status);

    if (!(isAdminUser(req) || isMasterUser(req))) {
      await t.rollback();
      return res.status(403).json({ message: "Only Admin/Master can adjust" });
    }

    if (!["FUND_ISSUED", "PARTIALLY_ADJUSTED"].includes(noteStatus)) {
      await t.rollback();
      return res.status(400).json({ message: "Only issued note can be adjusted" });
    }

    const rows = await ImprestNoteItem.findAll({
      where: { note_id: noteId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const rowById = new Map();
    const rowByCode = new Map();
    rows.forEach((row) => {
      rowById.set(Number(row.id), row);
      rowByCode.set(Number(row.financial_code_id), row);
    });

    const payloadRows = Array.isArray(req.body?.adjustments) ? req.body.adjustments : [];
    const queue = [];
    const queuedByItemId = new Map();

    if (payloadRows.length) {
      for (const raw of payloadRows) {
        const noteItemId = toPositiveInt(raw?.note_item_id);
        const rowId = toPositiveInt(raw?.id);
        const codeId = toPositiveInt(raw?.financial_code_id);
        const target =
          (noteItemId && rowById.get(noteItemId)) ||
          (rowId && rowById.get(rowId)) ||
          (codeId && rowByCode.get(codeId));
        if (!target) {
          await t.rollback();
          return res.status(400).json({ message: "Invalid adjustment row" });
        }

        const amount = toMoney(raw?.adjusted_amount, null);
        if (amount === null || amount < 0) {
          await t.rollback();
          return res.status(400).json({ message: "adjusted_amount must be non-negative" });
        }
        if (amount <= 0) continue;

        const issued = toMoney(target.issued_amount, 0);
        const adjusted = toMoney(target.adjustment_amount, 0);
        const pending = roundMoney(Math.max(0, issued - adjusted));
        const targetItemId = Number(target.id);
        const alreadyQueued = toMoney(queuedByItemId.get(targetItemId), 0);
        const availablePending = roundMoney(Math.max(0, pending - alreadyQueued));
        if (amount > availablePending) {
          await t.rollback();
          return res.status(400).json({ message: "Adjusted amount exceeds pending/unadjusted amount" });
        }
        queuedByItemId.set(targetItemId, roundMoney(alreadyQueued + amount));

        queue.push({ row: target, amount, remarks: cleanText(raw?.remarks, 1000) });
      }
    } else {
      rows.forEach((row) => {
        const issued = toMoney(row.issued_amount, 0);
        const adjusted = toMoney(row.adjustment_amount, 0);
        const delta = roundMoney(Math.max(0, issued - adjusted));
        if (delta > 0) {
          queue.push({ row, amount: delta, remarks: null });
        }
      });
    }

    if (!queue.length) {
      await t.rollback();
      return res.status(400).json({ message: "No adjustment amount found" });
    }

    const adjustmentDate = toDateOnly(req.body?.adjustment_date) || todayDateOnly();
    const adjustmentRefNo = cleanText(req.body?.adjustment_ref_no ?? req.body?.voucher_no, 120);
    const lineRemarks = cleanText(req.body?.line_remarks, 1000);

    const adjustmentRows = [];

    for (const entry of queue) {
      const row = entry.row;
      const amount = toMoney(entry.amount, 0);

      const newAdjusted = roundMoney(toMoney(row.adjustment_amount, 0) + amount);
      row.adjustment_amount = newAdjusted;
      row.unadjusted_amount = roundMoney(Math.max(0, toMoney(row.issued_amount, 0) - newAdjusted));
      row.remaining_balance = roundMoney(toMoney(row.budget_remaining, 0));

      await row.save({ transaction: t });

      adjustmentRows.push({
        note_id: noteId,
        note_item_id: Number(row.id),
        financial_code_id: Number(row.financial_code_id),
        adjusted_amount: amount,
        adjustment_date: adjustmentDate,
        adjustment_ref_no: adjustmentRefNo,
        voucher_no: adjustmentRefNo,
        remarks: entry.remarks || lineRemarks,
        created_by: getActorUserId(req),
      });
    }

    await ImprestAdjustment.bulkCreate(adjustmentRows, { transaction: t });

    const hasAnyIssued = rows.some((row) => toMoney(row.issued_amount, 0) > 0);
    const hasAnyAdjusted = rows.some((row) => toMoney(row.adjustment_amount, 0) > 0);
    const fullyAdjusted = rows.every(
      (row) => toMoney(row.issued_amount, 0) <= 0 || toMoney(row.unadjusted_amount, toMoney(row.issued_amount, 0) - toMoney(row.adjustment_amount, 0)) <= 0
    );

    if (hasAnyIssued && fullyAdjusted) {
      note.status = "ADJUSTED";
    } else if (hasAnyAdjusted) {
      note.status = "PARTIALLY_ADJUSTED";
    } else {
      note.status = "FUND_ISSUED";
    }
    if (req.body?.remarks !== undefined) {
      note.remarks = cleanText(req.body?.remarks, 2000);
    }
    await note.save({ transaction: t });

    await recalcNoteTotals(noteId, t);

    await t.commit();

    const refreshed = await fetchNoteWithDetails(noteId);
    return res.json({ message: "Adjustment recorded", data: serializeNote(refreshed, req) });
  } catch (err) {
    await t.rollback();
    console.error("imprest.adjustNote error:", err);
    return res.status(500).json({ message: "Failed to adjust imprest note" });
  }
};

exports.listAdjustmentDurations = async (req, res) => {
  try {
    ensureAssociations();

    const baseId = toPositiveInt(req.query.base_id);
    const fiscalYearId = toPositiveInt(req.query.fiscal_year_id);
    if (!baseId || !fiscalYearId) {
      return res.status(400).json({ message: "base_id and fiscal_year_id are required" });
    }

    const accessError = assertGeneralBaseAccess(req, baseId);
    if (accessError) {
      return res.status(accessError.status).json({ message: accessError.message });
    }

    const [base, fiscalYear] = await Promise.all([
      ImprestBase.findByPk(baseId),
      ImprestFiscalYear.findByPk(fiscalYearId),
    ]);
    if (!base || !fiscalYear) {
      return res.status(400).json({ message: "Invalid base or fiscal year" });
    }

    const durations = buildAdjustmentDurations(fiscalYear);
    const issuedByDuration = await loadIssuedSummaryByDuration(baseId, fiscalYearId, durations);
    const adjustmentRows = await loadDurationAdjustmentRows(baseId, fiscalYearId, null);

    const adjustmentByDuration = new Map();
    adjustmentRows.forEach((row) => {
      const key = row.duration_key;
      if (!key) return;

      const bucket =
        adjustmentByDuration.get(key) ||
        {
          adjusted_total: 0,
          by_source_code: new Map(),
          row_count: 0,
        };

      const amount = toMoney(row.adjusted_amount, 0);
      bucket.adjusted_total = roundMoney(bucket.adjusted_total + amount);
      bucket.row_count += 1;

      const sourceCodeId = toPositiveInt(row.source_financial_code_id);
      if (sourceCodeId) {
        const old = toMoney(bucket.by_source_code.get(sourceCodeId), 0);
        bucket.by_source_code.set(sourceCodeId, roundMoney(old + amount));
      }

      adjustmentByDuration.set(key, bucket);
    });

    const data = durations.map((duration) => {
      const issuedBucket = issuedByDuration.get(duration.duration_key) || {
        issued_total: 0,
        issued_rows: new Map(),
        notes: [],
      };
      const adjBucket =
        adjustmentByDuration.get(duration.duration_key) || {
          adjusted_total: 0,
          by_source_code: new Map(),
          row_count: 0,
        };

      const issuedRows = Array.from(issuedBucket.issued_rows.values())
        .map((row) => {
          const adjustedAmount = toMoney(adjBucket.by_source_code.get(row.financial_code_id), 0);
          return {
            financial_code_id: Number(row.financial_code_id),
            code: row.code || `CODE-${Number(row.financial_code_id)}`,
            khat_name_bn: row.khat_name_bn || null,
            khat_name_en: row.khat_name_en || null,
            issued_amount: toMoney(row.issued_amount, 0),
            adjusted_amount: adjustedAmount,
            pending_amount: roundMoney(toMoney(row.issued_amount, 0) - adjustedAmount),
          };
        })
        .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));

      const issuedTotal = toMoney(issuedBucket.issued_total, 0);
      const adjustedTotal = toMoney(adjBucket.adjusted_total, 0);

      return {
        duration_key: duration.duration_key,
        duration_index: Number(duration.duration_index),
        duration_label: duration.duration_label,
        duration_start: duration.duration_start,
        duration_end: duration.duration_end,
        periods: duration.periods.map((x) => ({
          month: Number(x.month),
          month_name: monthName(x.month),
          pakkhik: x.pakkhik,
          pakkhik_label: pakkhikNameEn(x.pakkhik),
          period_start: x.period_start,
          period_end: x.period_end,
        })),
        note_refs: issuedBucket.notes,
        issued_total: issuedTotal,
        adjusted_total: adjustedTotal,
        pending_total: roundMoney(issuedTotal - adjustedTotal),
        adjustment_count: Number(adjBucket.row_count || 0),
        issued_rows: issuedRows,
      };
    });

    return res.json({
      data,
      base: serializeBase(base),
      fiscal_year: serializeFiscalYear(fiscalYear),
    });
  } catch (err) {
    console.error("imprest.listAdjustmentDurations error:", err);
    return res.status(500).json({ message: "Failed to load adjustment durations" });
  }
};

exports.listDurationAdjustmentEntries = async (req, res) => {
  try {
    ensureAssociations();

    const baseId = toPositiveInt(req.query.base_id);
    const fiscalYearId = toPositiveInt(req.query.fiscal_year_id);
    const durationKey = String(req.query.duration_key || "").trim() || null;

    if (!baseId || !fiscalYearId) {
      return res.status(400).json({ message: "base_id and fiscal_year_id are required" });
    }

    const accessError = assertGeneralBaseAccess(req, baseId);
    if (accessError) {
      return res.status(accessError.status).json({ message: accessError.message });
    }

    const [base, fiscalYear] = await Promise.all([
      ImprestBase.findByPk(baseId),
      ImprestFiscalYear.findByPk(fiscalYearId),
    ]);
    if (!base || !fiscalYear) {
      return res.status(400).json({ message: "Invalid base or fiscal year" });
    }

    const rows = await loadDurationAdjustmentRows(baseId, fiscalYearId, durationKey);
    const serialized = rows.map(serializeDurationAdjustment);
    const adjustedTotal = serialized.reduce((sum, row) => sum + toMoney(row.adjusted_amount, 0), 0);

    const summaryByTargetMap = new Map();
    const summaryBySourceMap = new Map();
    serialized.forEach((row) => {
      const amount = toMoney(row.adjusted_amount, 0);
      if (row.target_financial_code_id) {
        const key = Number(row.target_financial_code_id);
        const existing = summaryByTargetMap.get(key) || {
          financial_code_id: key,
          code: row.target_financial_code?.code || `CODE-${key}`,
          khat_name_bn: row.target_financial_code?.khat_name_bn || null,
          adjusted_amount: 0,
        };
        existing.adjusted_amount = roundMoney(existing.adjusted_amount + amount);
        summaryByTargetMap.set(key, existing);
      }
      if (row.source_financial_code_id) {
        const key = Number(row.source_financial_code_id);
        const existing = summaryBySourceMap.get(key) || {
          financial_code_id: key,
          code: row.source_financial_code?.code || `CODE-${key}`,
          khat_name_bn: row.source_financial_code?.khat_name_bn || null,
          adjusted_amount: 0,
        };
        existing.adjusted_amount = roundMoney(existing.adjusted_amount + amount);
        summaryBySourceMap.set(key, existing);
      }
    });

    let durationMeta = null;
    if (durationKey) {
      const durations = buildAdjustmentDurations(fiscalYear);
      durationMeta = findDurationByKey(durations, durationKey);
    }

    return res.json({
      data: serialized,
      totals: {
        adjusted_total: roundMoney(adjustedTotal),
      },
      summary_by_target: Array.from(summaryByTargetMap.values()).sort((a, b) =>
        String(a.code || "").localeCompare(String(b.code || ""))
      ),
      summary_by_source: Array.from(summaryBySourceMap.values()).sort((a, b) =>
        String(a.code || "").localeCompare(String(b.code || ""))
      ),
      duration: durationMeta
        ? {
            duration_key: durationMeta.duration_key,
            duration_index: Number(durationMeta.duration_index),
            duration_label: durationMeta.duration_label,
            duration_start: durationMeta.duration_start,
            duration_end: durationMeta.duration_end,
          }
        : null,
      base: serializeBase(base),
      fiscal_year: serializeFiscalYear(fiscalYear),
    });
  } catch (err) {
    console.error("imprest.listDurationAdjustmentEntries error:", err);
    return res.status(500).json({ message: "Failed to load adjustment entries" });
  }
};

exports.createDurationAdjustmentEntries = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    ensureAssociations();

    const baseId = toPositiveInt(req.body?.base_id);
    const fiscalYearId = toPositiveInt(req.body?.fiscal_year_id);
    const durationKey = String(req.body?.duration_key || "").trim();
    const payloadRows = Array.isArray(req.body?.entries)
      ? req.body.entries
      : Array.isArray(req.body?.adjustments)
      ? req.body.adjustments
      : [];

    if (!baseId || !fiscalYearId || !durationKey) {
      await t.rollback();
      return res.status(400).json({ message: "base_id, fiscal_year_id and duration_key are required" });
    }
    if (!payloadRows.length) {
      await t.rollback();
      return res.status(400).json({ message: "entries array is required" });
    }

    const accessError = assertGeneralBaseAccess(req, baseId);
    if (accessError) {
      await t.rollback();
      return res.status(accessError.status).json({ message: accessError.message });
    }

    const [base, fiscalYear] = await Promise.all([
      ImprestBase.findByPk(baseId, { transaction: t }),
      ImprestFiscalYear.findByPk(fiscalYearId, { transaction: t }),
    ]);
    if (!base || !fiscalYear) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid base or fiscal year" });
    }

    const durations = buildAdjustmentDurations(fiscalYear);
    const duration = findDurationByKey(durations, durationKey);
    if (!duration) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid duration_key for selected fiscal year" });
    }

    const issuedByDuration = await loadIssuedSummaryByDuration(baseId, fiscalYearId, durations, t);
    const issuedBucket = issuedByDuration.get(duration.duration_key) || {
      issued_total: 0,
      issued_rows: new Map(),
    };
    const issuedTotal = toMoney(issuedBucket.issued_total, 0);
    if (issuedTotal <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "No issued amount found for this duration" });
    }

    const existingRows = await loadDurationAdjustmentRows(baseId, fiscalYearId, duration.duration_key, t);
    const existingTotal = existingRows.reduce((sum, row) => sum + toMoney(row.adjusted_amount, 0), 0);

    const sourceIssuedMap = new Map();
    Array.from(issuedBucket.issued_rows.values()).forEach((row) => {
      sourceIssuedMap.set(Number(row.financial_code_id), toMoney(row.issued_amount, 0));
    });

    const existingBySource = new Map();
    existingRows.forEach((row) => {
      const sourceId = toPositiveInt(row.source_financial_code_id);
      if (!sourceId) return;
      const old = toMoney(existingBySource.get(sourceId), 0);
      existingBySource.set(sourceId, roundMoney(old + toMoney(row.adjusted_amount, 0)));
    });

    const sourceCodesToLoad = new Set();
    const targetCodesToLoad = new Set();
    payloadRows.forEach((raw) => {
      const sourceId = toPositiveInt(raw?.source_financial_code_id);
      const targetId = toPositiveInt(raw?.target_financial_code_id);
      if (sourceId) sourceCodesToLoad.add(sourceId);
      if (targetId) targetCodesToLoad.add(targetId);
    });

    const allCodeIds = Array.from(new Set([...sourceCodesToLoad, ...targetCodesToLoad]));
    const codeMap = new Map();
    if (allCodeIds.length) {
      const codes = await ImprestFinancialCode.findAll({
        where: { id: { [Op.in]: allCodeIds } },
        attributes: ["id", "code", "khat_name_bn", "khat_name_en"],
        transaction: t,
      });
      codes.forEach((row) => codeMap.set(Number(row.id), row));
    }

    let newTotal = 0;
    const pendingBySource = new Map();
    const createRows = [];

    for (const raw of payloadRows) {
      const amount = toMoney(raw?.adjusted_amount, null);
      if (amount === null || amount <= 0) {
        await t.rollback();
        return res.status(400).json({ message: "Every entry must have adjusted_amount greater than 0" });
      }

      const sourceId = toPositiveInt(raw?.source_financial_code_id);
      const targetId = toPositiveInt(raw?.target_financial_code_id);
      if (!sourceId && !targetId) {
        await t.rollback();
        return res
          .status(400)
          .json({ message: "Each entry must include source_financial_code_id or target_financial_code_id" });
      }

      if (sourceId && !codeMap.has(sourceId)) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid source_financial_code_id in entries" });
      }
      if (targetId && !codeMap.has(targetId)) {
        await t.rollback();
        return res.status(400).json({ message: "Invalid target_financial_code_id in entries" });
      }

      if (sourceId && sourceIssuedMap.has(sourceId)) {
        const issuedAmount = toMoney(sourceIssuedMap.get(sourceId), 0);
        const existingUsed = toMoney(existingBySource.get(sourceId), 0);
        const pendingCurrent = toMoney(pendingBySource.get(sourceId), 0);
        if (roundMoney(existingUsed + pendingCurrent + amount) > issuedAmount) {
          await t.rollback();
          return res.status(400).json({
            message: `Source code ${codeMap.get(sourceId)?.code || sourceId} exceeds issued balance for this duration`,
          });
        }
        pendingBySource.set(sourceId, roundMoney(pendingCurrent + amount));
      }

      const adjustmentDate = toDateOnly(raw?.adjustment_date || req.body?.adjustment_date) || todayDateOnly();
      const voucherNo = cleanText(raw?.voucher_no ?? req.body?.voucher_no, 120);
      const remarks = cleanText(raw?.remarks ?? req.body?.remarks, 1000);

      const sourceIssuedRef = sourceId ? toMoney(sourceIssuedMap.get(sourceId), 0) : 0;
      newTotal = roundMoney(newTotal + amount);

      createRows.push({
        base_id: baseId,
        fiscal_year_id: fiscalYearId,
        duration_key: duration.duration_key,
        duration_label: duration.duration_label,
        duration_start: duration.duration_start,
        duration_end: duration.duration_end,
        source_financial_code_id: sourceId || null,
        target_financial_code_id: targetId || null,
        issued_reference_amount: roundMoney(sourceIssuedRef),
        adjusted_amount: roundMoney(amount),
        adjustment_date: adjustmentDate,
        voucher_no: voucherNo,
        remarks,
        created_by: getActorUserId(req),
      });
    }

    if (roundMoney(existingTotal + newTotal) > issuedTotal) {
      await t.rollback();
      return res.status(400).json({
        message: "Total adjustment amount exceeds issued amount of selected duration",
      });
    }

    await ImprestDurationAdjustment.bulkCreate(createRows, { transaction: t });
    await t.commit();

    const rows = await loadDurationAdjustmentRows(baseId, fiscalYearId, duration.duration_key);
    const serialized = rows.map(serializeDurationAdjustment);
    const adjustedTotal = serialized.reduce((sum, row) => sum + toMoney(row.adjusted_amount, 0), 0);

    return res.status(201).json({
      message: "Duration adjustment saved",
      data: serialized,
      duration: {
        duration_key: duration.duration_key,
        duration_index: Number(duration.duration_index),
        duration_label: duration.duration_label,
        duration_start: duration.duration_start,
        duration_end: duration.duration_end,
        issued_total: issuedTotal,
        adjusted_total: roundMoney(adjustedTotal),
        pending_total: roundMoney(issuedTotal - adjustedTotal),
      },
    });
  } catch (err) {
    await t.rollback();
    console.error("imprest.createDurationAdjustmentEntries error:", err);
    return res.status(500).json({ message: "Failed to save duration adjustment" });
  }
};

exports.getWorkflowReport = async (req, res) => {
  try {
    ensureAssociations();

    const reportType = String(req.query.type || "base_yearly").trim().toLowerCase();
    const baseId = toPositiveInt(req.query.base_id);
    const fiscalYearId = toPositiveInt(req.query.fiscal_year_id);
    const month = parseMonth(req.query.month);
    const demandType = parseDemandType(req.query.demand_type);
    const pakkhik = parsePakkhik(req.query.pakkhik);
    const noteId = toPositiveInt(req.query.note_id);
    const codeId = toPositiveInt(req.query.financial_code_id);

    const noteWhere = {};
    if (baseId) noteWhere.base_id = baseId;
    if (fiscalYearId) noteWhere.fiscal_year_id = fiscalYearId;
    if (month) noteWhere.month = month;
    if (demandType) noteWhere.demand_type = demandType;
    if (pakkhik) noteWhere.pakkhik = pakkhik;
    if (noteId) noteWhere.id = noteId;

    if (isGeneralUser(req)) {
      const assignedBaseId = getAssignedBaseId(req);
      if (!assignedBaseId) {
        return res.status(403).json({ message: "Your account has no assigned base/section" });
      }
      noteWhere.base_id = assignedBaseId;
    }

    const budgetWhere = {};
    if (noteWhere.base_id) budgetWhere.base_id = noteWhere.base_id;
    if (fiscalYearId) budgetWhere.fiscal_year_id = fiscalYearId;
    if (codeId) budgetWhere.financial_code_id = codeId;

    const [budgets, notes] = await Promise.all([
      ImprestBudgetAllocation.findAll({
        where: budgetWhere,
        include: [
          { model: ImprestBase, as: "base", attributes: ["id", "base_name", "base_code"], required: false },
          { model: ImprestFiscalYear, as: "fiscalYear", attributes: ["id", "name"], required: false },
          {
            model: ImprestFinancialCode,
            as: "financialCode",
            attributes: ["id", "code", "khat_name_bn", "khat_name_en"],
            required: false,
          },
        ],
        order: [["id", "ASC"]],
      }),
      ImprestNote.findAll({
        where: noteWhere,
        include: [
          { model: ImprestBase, as: "base", attributes: ["id", "base_name", "base_code"], required: false },
          { model: ImprestFiscalYear, as: "fiscalYear", attributes: ["id", "name"], required: false },
          {
            model: ImprestNoteItem,
            as: "items",
            include: [
              {
                model: ImprestFinancialCode,
                as: "financialCode",
                attributes: ["id", "code", "khat_name_bn", "khat_name_en"],
                required: false,
              },
            ],
            required: false,
          },
          {
            model: ImprestIssue,
            as: "issues",
            attributes: ["id", "issue_date", "dispatch_no", "voucher_no", "total_issued_amount"],
            required: false,
          },
        ],
        order: [["id", "ASC"], [{ model: ImprestNoteItem, as: "items" }, "id", "ASC"]],
      }),
    ]);

    const budgetRows = budgets.map((row) => (row.toJSON ? row.toJSON() : row));
    const noteRows = notes.map((row) => (row.toJSON ? row.toJSON() : row));

    const issuedItemRows = [];
    const noteRollups = [];

    noteRows.forEach((note) => {
      const normalizedStatus = normalizeNoteStatus(note.status);
      const base = note.base || {};
      const fy = note.fiscalYear || {};
      const normalizedDemandType = normalizeStoredDemandType(note);
      const normalizedPakkhik = normalizeStoredPakkhik(note);
      const issues = Array.isArray(note.issues) ? note.issues : [];
      const dispatch = issues.length ? issues[issues.length - 1] : null;

      let noteIssuedTotal = 0;
      let noteAdjustedTotal = 0;

      (Array.isArray(note.items) ? note.items : []).forEach((item) => {
        const normalizedItem = item?.toJSON ? item.toJSON() : item;
        const itemCodeId = Number(normalizedItem?.financial_code_id || 0);
        if (!itemCodeId) return;
        if (codeId && itemCodeId !== codeId) return;

        const budgetAmount = toMoney(normalizedItem.budget_amount, 0);
        const previousIssued = toMoney(normalizedItem.previous_issued_amount, toMoney(normalizedItem.previous_expense, 0));
        const claimAmount = toMoney(normalizedItem.current_claim, 0);
        const approvedAmount = toMoney(normalizedItem.approved_amount, claimAmount);
        const issuedAmount = toMoney(normalizedItem.issued_amount, 0);
        const adjustedAmount = toMoney(normalizedItem.adjustment_amount, 0);
        const pendingAdjustment = roundMoney(Math.max(0, issuedAmount - adjustedAmount));
        const budgetRemaining = roundMoney(budgetAmount - previousIssued - issuedAmount);

        noteIssuedTotal = roundMoney(noteIssuedTotal + issuedAmount);
        noteAdjustedTotal = roundMoney(noteAdjustedTotal + adjustedAmount);

        issuedItemRows.push({
          note_id: Number(note.id),
          note_no: note.note_no,
          status: normalizedStatus,
          base_id: Number(note.base_id),
          base_name: base.base_name || "-",
          base_code: base.base_code || "-",
          fiscal_year_id: Number(note.fiscal_year_id),
          fiscal_year_name: fy.name || "-",
          month: Number(note.month),
          month_name: monthName(note.month),
          demand_type: normalizedDemandType,
          pakkhik: normalizedPakkhik,
          pakkhik_label: pakkhikNameEn(normalizedPakkhik),
          period_start: formatDateOnly(note.period_start),
          period_end: formatDateOnly(note.period_end),
          note_item_id: Number(normalizedItem.id),
          financial_code_id: itemCodeId,
          code: normalizedItem?.financialCode?.code || `CODE-${itemCodeId}`,
          khat_name_bn: normalizedItem?.financialCode?.khat_name_bn || normalizedItem?.khat_name || null,
          khat_name_en: normalizedItem?.financialCode?.khat_name_en || null,
          budget_amount: budgetAmount,
          previous_issued_amount: previousIssued,
          claimed_amount: claimAmount,
          approved_amount: approvedAmount,
          issued_amount: issuedAmount,
          adjusted_amount: adjustedAmount,
          pending_adjustment: pendingAdjustment,
          unadjusted_amount: pendingAdjustment,
          budget_remaining: budgetRemaining,
          dispatch_no: dispatch?.dispatch_no || dispatch?.voucher_no || null,
          dispatch_date: formatDateOnly(dispatch?.issue_date),
        });
      });

      noteRollups.push({
        note_id: Number(note.id),
        note_no: note.note_no,
        base_id: Number(note.base_id),
        base_name: base.base_name || "-",
        base_code: base.base_code || "-",
        fiscal_year_id: Number(note.fiscal_year_id),
        fiscal_year_name: fy.name || "-",
        month: Number(note.month),
        month_name: monthName(note.month),
        demand_type: normalizedDemandType,
        pakkhik: normalizedPakkhik,
        status: normalizedStatus,
        dispatch_no: dispatch?.dispatch_no || dispatch?.voucher_no || null,
        issued_amount: noteIssuedTotal,
        adjusted_amount: noteAdjustedTotal,
        pending_adjustment: roundMoney(noteIssuedTotal - noteAdjustedTotal),
      });
    });

    const sumBudgetByBase = new Map();
    const sumBudgetByCode = new Map();
    const sumBudgetByBaseCode = new Map();

    budgetRows.forEach((row) => {
      const amount = toMoney(row.budget_amount, 0);
      const bId = Number(row.base_id || 0);
      const cId = Number(row.financial_code_id || 0);
      if (!bId || !cId) return;

      sumBudgetByBase.set(bId, roundMoney(toMoney(sumBudgetByBase.get(bId), 0) + amount));
      sumBudgetByCode.set(cId, roundMoney(toMoney(sumBudgetByCode.get(cId), 0) + amount));
      const key = `${bId}::${cId}`;
      sumBudgetByBaseCode.set(key, roundMoney(toMoney(sumBudgetByBaseCode.get(key), 0) + amount));
    });

    const rowsForIssued = issuedItemRows.filter((row) => toMoney(row.issued_amount, 0) > 0);

    if (reportType === "dispatch_note_adjustment") {
      const data = rowsForIssued.map((row) => ({
        note_id: row.note_id,
        note_no: row.note_no,
        status: row.status,
        dispatch_no: row.dispatch_no || "-",
        base_id: row.base_id,
        base_name: row.base_name,
        base_code: row.base_code,
        month: row.month,
        month_name: row.month_name,
        demand_type: row.demand_type,
        pakkhik: row.pakkhik,
        pakkhik_label: row.pakkhik_label,
        financial_code_id: row.financial_code_id,
        code: row.code,
        khat_name_bn: row.khat_name_bn,
        issued_amount: row.issued_amount,
        adjusted_amount: row.adjusted_amount,
        pending_adjustment: row.pending_adjustment,
      }));

      return res.json({
        type: reportType,
        filters: { base_id: baseId, fiscal_year_id: fiscalYearId, month, demand_type: demandType, pakkhik, note_id: noteId, financial_code_id: codeId },
        data,
      });
    }

    if (reportType === "monthly_pakkhik") {
      const byKey = new Map();

      noteRollups.forEach((row) => {
        if (toMoney(row.issued_amount, 0) <= 0 && toMoney(row.adjusted_amount, 0) <= 0) return;
        const key = `${row.base_id}::${row.month}`;
        const current =
          byKey.get(key) ||
          {
            base_id: row.base_id,
            base_name: row.base_name,
            base_code: row.base_code,
            month: row.month,
            month_name: row.month_name,
            first_half_issued: 0,
            second_half_issued: 0,
            complementary_issued: 0,
            total_issued: 0,
            adjusted_amount: 0,
            pending_adjustment: 0,
          };

        const issuedAmount = toMoney(row.issued_amount, 0);
        const adjustedAmount = toMoney(row.adjusted_amount, 0);
        const pending = roundMoney(issuedAmount - adjustedAmount);

        if (row.demand_type === "COMPLEMENTARY") {
          current.complementary_issued = roundMoney(current.complementary_issued + issuedAmount);
        } else if (row.pakkhik === "FIRST_HALF") {
          current.first_half_issued = roundMoney(current.first_half_issued + issuedAmount);
        } else if (row.pakkhik === "SECOND_HALF") {
          current.second_half_issued = roundMoney(current.second_half_issued + issuedAmount);
        }

        current.total_issued = roundMoney(current.total_issued + issuedAmount);
        current.adjusted_amount = roundMoney(current.adjusted_amount + adjustedAmount);
        current.pending_adjustment = roundMoney(current.pending_adjustment + pending);

        byKey.set(key, current);
      });

      const data = Array.from(byKey.values()).sort((a, b) => {
        if (a.base_name !== b.base_name) return String(a.base_name).localeCompare(String(b.base_name));
        return Number(a.month) - Number(b.month);
      });

      return res.json({
        type: reportType,
        filters: { base_id: baseId, fiscal_year_id: fiscalYearId, month, demand_type: demandType, pakkhik, note_id: noteId, financial_code_id: codeId },
        data,
      });
    }

    if (reportType === "code_yearly") {
      const codeMeta = new Map();
      const issuedByCode = new Map();
      const adjustedByCode = new Map();

      budgetRows.forEach((row) => {
        const cId = Number(row.financial_code_id || 0);
        if (!cId) return;
        if (!codeMeta.has(cId)) {
          codeMeta.set(cId, {
            financial_code_id: cId,
            code: row.financialCode?.code || `CODE-${cId}`,
            khat_name_bn: row.financialCode?.khat_name_bn || null,
            khat_name_en: row.financialCode?.khat_name_en || null,
          });
        }
      });

      issuedItemRows.forEach((row) => {
        const cId = Number(row.financial_code_id || 0);
        if (!cId) return;
        if (!codeMeta.has(cId)) {
          codeMeta.set(cId, {
            financial_code_id: cId,
            code: row.code || `CODE-${cId}`,
            khat_name_bn: row.khat_name_bn || null,
            khat_name_en: row.khat_name_en || null,
          });
        }
        issuedByCode.set(cId, roundMoney(toMoney(issuedByCode.get(cId), 0) + toMoney(row.issued_amount, 0)));
        adjustedByCode.set(cId, roundMoney(toMoney(adjustedByCode.get(cId), 0) + toMoney(row.adjusted_amount, 0)));
      });

      const ids = new Set([...sumBudgetByCode.keys(), ...issuedByCode.keys(), ...adjustedByCode.keys()]);
      const data = Array.from(ids)
        .map((cId) => {
          const budget = toMoney(sumBudgetByCode.get(cId), 0);
          const issued = toMoney(issuedByCode.get(cId), 0);
          const adjusted = toMoney(adjustedByCode.get(cId), 0);
          return {
            ...(codeMeta.get(cId) || {
              financial_code_id: Number(cId),
              code: `CODE-${Number(cId)}`,
              khat_name_bn: null,
              khat_name_en: null,
            }),
            budget_amount: budget,
            total_issued: issued,
            total_adjusted: adjusted,
            pending_adjustment: roundMoney(issued - adjusted),
            budget_remaining: roundMoney(budget - issued),
          };
        })
        .sort((a, b) => String(a.code || "").localeCompare(String(b.code || "")));

      return res.json({
        type: reportType,
        filters: { base_id: baseId, fiscal_year_id: fiscalYearId, month, demand_type: demandType, pakkhik, note_id: noteId, financial_code_id: codeId },
        data,
      });
    }

    if (reportType === "budget_utilization") {
      const baseCodeMeta = new Map();
      const issuedByBaseCode = new Map();
      const adjustedByBaseCode = new Map();

      budgetRows.forEach((row) => {
        const bId = Number(row.base_id || 0);
        const cId = Number(row.financial_code_id || 0);
        if (!bId || !cId) return;
        const key = `${bId}::${cId}`;
        if (!baseCodeMeta.has(key)) {
          baseCodeMeta.set(key, {
            base_id: bId,
            base_name: row.base?.base_name || "-",
            base_code: row.base?.base_code || "-",
            financial_code_id: cId,
            code: row.financialCode?.code || `CODE-${cId}`,
            khat_name_bn: row.financialCode?.khat_name_bn || null,
            khat_name_en: row.financialCode?.khat_name_en || null,
          });
        }
      });

      issuedItemRows.forEach((row) => {
        const key = `${Number(row.base_id)}::${Number(row.financial_code_id)}`;
        if (!baseCodeMeta.has(key)) {
          baseCodeMeta.set(key, {
            base_id: Number(row.base_id),
            base_name: row.base_name,
            base_code: row.base_code,
            financial_code_id: Number(row.financial_code_id),
            code: row.code,
            khat_name_bn: row.khat_name_bn || null,
            khat_name_en: row.khat_name_en || null,
          });
        }
        issuedByBaseCode.set(key, roundMoney(toMoney(issuedByBaseCode.get(key), 0) + toMoney(row.issued_amount, 0)));
        adjustedByBaseCode.set(
          key,
          roundMoney(toMoney(adjustedByBaseCode.get(key), 0) + toMoney(row.adjusted_amount, 0))
        );
      });

      const keys = new Set([...sumBudgetByBaseCode.keys(), ...issuedByBaseCode.keys(), ...adjustedByBaseCode.keys()]);
      const data = Array.from(keys)
        .map((key) => {
          const budget = toMoney(sumBudgetByBaseCode.get(key), 0);
          const issued = toMoney(issuedByBaseCode.get(key), 0);
          const adjusted = toMoney(adjustedByBaseCode.get(key), 0);
          return {
            ...(baseCodeMeta.get(key) || {
              base_id: null,
              base_name: "-",
              base_code: "-",
              financial_code_id: null,
              code: "-",
              khat_name_bn: null,
              khat_name_en: null,
            }),
            budget_amount: budget,
            cumulative_issued: issued,
            cumulative_adjusted: adjusted,
            pending_adjustment: roundMoney(issued - adjusted),
            remaining_budget: roundMoney(budget - issued),
          };
        })
        .sort((a, b) => {
          if (a.base_name !== b.base_name) return String(a.base_name).localeCompare(String(b.base_name));
          return String(a.code || "").localeCompare(String(b.code || ""));
        });

      return res.json({
        type: reportType,
        filters: { base_id: baseId, fiscal_year_id: fiscalYearId, month, demand_type: demandType, pakkhik, note_id: noteId, financial_code_id: codeId },
        data,
      });
    }

    const baseMeta = new Map();
    const issuedByBase = new Map();
    const adjustedByBase = new Map();

    budgetRows.forEach((row) => {
      const bId = Number(row.base_id || 0);
      if (!bId) return;
      if (!baseMeta.has(bId)) {
        baseMeta.set(bId, {
          base_id: bId,
          base_name: row.base?.base_name || "-",
          base_code: row.base?.base_code || "-",
        });
      }
    });

    issuedItemRows.forEach((row) => {
      const bId = Number(row.base_id || 0);
      if (!bId) return;
      if (!baseMeta.has(bId)) {
        baseMeta.set(bId, {
          base_id: bId,
          base_name: row.base_name || "-",
          base_code: row.base_code || "-",
        });
      }
      issuedByBase.set(bId, roundMoney(toMoney(issuedByBase.get(bId), 0) + toMoney(row.issued_amount, 0)));
      adjustedByBase.set(bId, roundMoney(toMoney(adjustedByBase.get(bId), 0) + toMoney(row.adjusted_amount, 0)));
    });

    const baseIds = new Set([...sumBudgetByBase.keys(), ...issuedByBase.keys(), ...adjustedByBase.keys()]);
    const data = Array.from(baseIds)
      .map((bId) => {
        const budget = toMoney(sumBudgetByBase.get(bId), 0);
        const issued = toMoney(issuedByBase.get(bId), 0);
        const adjusted = toMoney(adjustedByBase.get(bId), 0);
        return {
          ...(baseMeta.get(bId) || {
            base_id: Number(bId),
            base_name: "-",
            base_code: "-",
          }),
          budget_amount: budget,
          total_issued: issued,
          total_adjusted: adjusted,
          pending_adjustment: roundMoney(issued - adjusted),
          budget_remaining: roundMoney(budget - issued),
        };
      })
      .sort((a, b) => String(a.base_name || "").localeCompare(String(b.base_name || "")));

    return res.json({
      type: "base_yearly",
      filters: { base_id: baseId, fiscal_year_id: fiscalYearId, month, demand_type: demandType, pakkhik, note_id: noteId, financial_code_id: codeId },
      data,
    });
  } catch (err) {
    console.error("imprest.getWorkflowReport error:", err);
    return res.status(500).json({ message: "Failed to load workflow report" });
  }
};

exports.printNote = async (req, res) => {
  try {
    const noteId = toPositiveInt(req.params.id);
    if (!noteId) return res.status(400).json({ message: "Invalid note id" });

    const out = await resolveNoteForAction(noteId, req, null);
    if (out.error) return res.status(out.error.status).json({ message: out.error.message });

    const note = out.note;
    const data = serializeNote(note, req);

    return res.json({
      data,
      print_meta: buildPrintMeta(data),
    });
  } catch (err) {
    console.error("imprest.printNote error:", err);
    return res.status(500).json({ message: "Failed to load note print data" });
  }
};
