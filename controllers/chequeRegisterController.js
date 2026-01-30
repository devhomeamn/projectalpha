// controllers/chequeRegisterController.js

const { Op } = require("sequelize");
const sequelize = require("../config/db");
const Section = require("../models/sectionModel");
const ChequeRegisterEntry = require("../models/chequeRegisterEntryModel");
const User = require("../models/userModel");
const ChequeRegisterLog = require("../models/chequeRegisterLogModel");

// -----------------------------
// Associations (safe init)
// -----------------------------
let assocInit = false;
function ensureAssociations() {
  if (assocInit) return;
  assocInit = true;

  // ChequeRegisterEntry.created_by -> User
  if (!ChequeRegisterEntry.associations?.creator) {
    ChequeRegisterEntry.belongsTo(User, { foreignKey: "created_by", as: "creator" });
  }
  // ChequeRegisterEntry.updated_by -> User
  if (!ChequeRegisterEntry.associations?.updater) {
    ChequeRegisterEntry.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
  }

  // ChequeRegisterLog.actor_id -> User
  if (!ChequeRegisterLog.associations?.actor) {
    ChequeRegisterLog.belongsTo(User, { foreignKey: "actor_id", as: "actor" });
  }
}

// -----------------------------
// Cheque Section resolver (cached)
// -----------------------------
let cachedChequeSection = { id: null, fetchedAt: 0 };
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function normalizeName(s) {
  return String(s || "").trim().toLowerCase();
}

async function resolveChequeSectionId() {
  const now = Date.now();
  if (cachedChequeSection.id && now - cachedChequeSection.fetchedAt < CACHE_TTL_MS) {
    return cachedChequeSection.id;
  }

  const configuredName = normalizeName(process.env.CHEQUE_SECTION_NAME);

  let section = null;

  // 1) Exact name match via env (BEST)
  if (configuredName) {
    section = await Section.findOne({
      where: sequelize.where(sequelize.fn("LOWER", sequelize.col("name")), configuredName),
    });
  }

  // 2) Fallback heuristics
  if (!section) {
    const rows = await Section.findAll({ attributes: ["id", "name"] });
    const rowsNorm = rows.map((r) => ({ id: r.id, name: r.name, n: normalizeName(r.name) }));

    section = rowsNorm.find((r) => r.n.includes("cheque")) || null;

    if (!section) {
      section =
        rowsNorm.find((r) => /\bsection\s*d\b/.test(r.n) || /\bsec\s*d\b/.test(r.n)) || null;
    }

    if (!section) section = rowsNorm.find((r) => r.n === "d") || null;
    if (!section) section = rowsNorm.find((r) => r.n.startsWith("d")) || null;
  }

  if (!section) return null;

  cachedChequeSection = { id: section.id, fetchedAt: now };
  return section.id;
}

async function assertChequeAccess(req) {
  const role = normalizeName(req.user?.role);

  if (role === "admin" || role === "master") return { ok: true };

  const chequeId = await resolveChequeSectionId();
  if (!chequeId) {
    return {
      ok: false,
      status: 500,
      message: "Cheque section not found. Set CHEQUE_SECTION_NAME in .env",
    };
  }

  const userSectionId = req.user?.section_id;
  if (role === "general" && Number(userSectionId) === Number(chequeId)) {
    return { ok: true };
  }

  return { ok: false, status: 403, message: "Forbidden (Cheque section only)" };
}

// -----------------------------
// Helpers
// -----------------------------
function parseDateOnlyOrNull(v) {
  if (!v) return null;
  return String(v).slice(0, 10);
}

function pickStatus(s) {
  const v = String(s || "").toLowerCase();
  return ["received", "processing", "returned"].includes(v) ? v : "received";
}

async function nextEntryNoForYear(year) {
  const maxRow = await ChequeRegisterEntry.findOne({
    attributes: [[sequelize.fn("MAX", sequelize.col("entry_no")), "max_entry_no"]],
    where: sequelize.where(sequelize.fn("YEAR", sequelize.col("received_date")), year),
    raw: true,
  });
  const max = Number(maxRow?.max_entry_no || 0);
  return max + 1;
}

function decorateEntry(row) {
  const j = row?.toJSON ? row.toJSON() : row;
  if (!j) return j;

  j.created_by_name = j.creator?.name || j.creator?.username || null;
  j.updated_by_name = j.updater?.name || j.updater?.username || null;

  return j;
}

// ✅ audit log helper
async function writeLog({ entryId, action, oldObj, newObj, note, actorId }) {
  try {
    await ChequeRegisterLog.create({
      entry_id: entryId,
      action,
      old_data: oldObj ? JSON.stringify(oldObj) : null,
      new_data: newObj ? JSON.stringify(newObj) : null,
      note: note || null,
      actor_id: actorId || null,
    });
  } catch (e) {
    console.error("writeLog failed:", e);
    // don't block main action
  }
}

// -----------------------------
// GET /api/cheque-register/origin-sections
// -----------------------------
exports.listOriginSections = async (req, res) => {
  try {
    const access = await assertChequeAccess(req);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const rows = await Section.findAll({ order: [["name", "ASC"]] });
    return res.json(rows);
  } catch (err) {
    console.error("listOriginSections error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// -----------------------------
// POST /api/cheque-register
// -----------------------------
exports.createEntry = async (req, res) => {
  try {
    ensureAssociations();

    const access = await assertChequeAccess(req);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const {
      bill_ref_no,
      origin_section_id,
      received_date,
      token_no,
      amount,
      remarks,
      status,
      returned_to_section_id,
    } = req.body;

    if (!origin_section_id) return res.status(400).json({ message: "origin_section_id is required" });
    if (!received_date) return res.status(400).json({ message: "received_date is required" });
    if (!token_no) return res.status(400).json({ message: "token_no is required" });
    if (amount === undefined || amount === null || amount === "") {
      return res.status(400).json({ message: "amount is required" });
    }

    const recv = parseDateOnlyOrNull(received_date);
    const y = Number(String(recv || "").slice(0, 4)) || new Date().getFullYear();
    const entryNo = await nextEntryNoForYear(y);

    const created = await ChequeRegisterEntry.create({
      entry_no: entryNo,
      bill_ref_no: bill_ref_no || null,
      origin_section_id: Number(origin_section_id),
      received_date: recv,
      token_no: String(token_no).trim(),
      amount: Number(amount),
      remarks: remarks || null,
      status: pickStatus(status),
      returned_to_section_id: returned_to_section_id
        ? Number(returned_to_section_id)
        : Number(origin_section_id),
      returned_date: null,
      created_by: req.user?.id || null,
      updated_by: null,
      // soft-delete fields (if present in DB/model)
      deleted_at: null,
      deleted_by: null,
      delete_reason: null,
    });

    await writeLog({
      entryId: created.id,
      action: "create",
      oldObj: null,
      newObj: created.toJSON ? created.toJSON() : created,
      note: null,
      actorId: req.user?.id,
    });

    const row = await ChequeRegisterEntry.findByPk(created.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "username"] },
        { model: User, as: "updater", attributes: ["id", "name", "username"] },
      ],
    });

    return res.status(201).json({ message: "Cheque entry created", data: decorateEntry(row) });
  } catch (err) {
    console.error("createEntry error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// -----------------------------
// GET /api/cheque-register
// -----------------------------
exports.listEntries = async (req, res) => {
  try {
    ensureAssociations();

    const access = await assertChequeAccess(req);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const { status, q, origin_section_id, from, to } = req.query;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(5, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const where = {};

    // soft-delete filter: hide deleted by default
    const includeDeleted = String(req.query.include_deleted || "") === "1";
    if (!includeDeleted) where.deleted_at = null;

    if (status && status !== "all") where.status = pickStatus(status);
    if (origin_section_id) where.origin_section_id = Number(origin_section_id);

    if (from || to) {
      where.received_date = {};
      if (from) where.received_date[Op.gte] = parseDateOnlyOrNull(from);
      if (to) where.received_date[Op.lte] = parseDateOnlyOrNull(to);
    }

    if (q) {
      const s = String(q).trim();
      where[Op.or] = [
        { bill_ref_no: { [Op.like]: `%${s}%` } },
        { token_no: { [Op.like]: `%${s}%` } },
        ...(String(Number(s)) !== "NaN" ? [{ entry_no: Number(s) }] : []),
      ];
    }

    const { rows, count } = await ChequeRegisterEntry.findAndCountAll({
      where,
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "username"] },
        { model: User, as: "updater", attributes: ["id", "name", "username"] },
      ],
      order: [["received_date", "DESC"], ["entry_no", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      data: rows.map(decorateEntry),
      page,
      limit,
      total: count,
    });
  } catch (err) {
    console.error("listEntries error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// -----------------------------
// GET /api/cheque-register/:id
// -----------------------------
exports.getEntry = async (req, res) => {
  try {
    ensureAssociations();

    const access = await assertChequeAccess(req);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const row = await ChequeRegisterEntry.findByPk(req.params.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "username"] },
        { model: User, as: "updater", attributes: ["id", "name", "username"] },
      ],
    });
    if (!row) return res.status(404).json({ message: "Entry not found" });

    return res.json({ data: decorateEntry(row) });
  } catch (err) {
    console.error("getEntry error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// -----------------------------
// PUT /api/cheque-register/:id
// -----------------------------
exports.updateEntry = async (req, res) => {
  try {
    ensureAssociations();

    const access = await assertChequeAccess(req);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const row = await ChequeRegisterEntry.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Entry not found" });

    const role = normalizeName(req.user?.role);
    if (row.status === "returned" && !(role === "admin" || role === "master")) {
      return res.status(400).json({ message: "Returned entry cannot be edited" });
    }

    const oldObj = row.toJSON ? row.toJSON() : row;

    const allowed = [
      "bill_ref_no",
      "origin_section_id",
      "received_date",
      "token_no",
      "amount",
      "remarks",
      "status",
      "returned_to_section_id",
    ];

    for (const k of allowed) {
      if (req.body[k] === undefined) continue;

      if (k === "origin_section_id" || k === "returned_to_section_id") {
        row[k] = req.body[k] ? Number(req.body[k]) : null;
        continue;
      }
      if (k === "received_date") {
        row[k] = parseDateOnlyOrNull(req.body[k]);
        continue;
      }
      if (k === "amount") {
        row[k] = req.body[k] === "" ? row[k] : Number(req.body[k]);
        continue;
      }
      if (k === "status") {
        row[k] = pickStatus(req.body[k]);
        continue;
      }
      row[k] = req.body[k];
    }

    row.updated_by = req.user?.id || null;
    await row.save();

    await writeLog({
      entryId: row.id,
      action: "update",
      oldObj,
      newObj: row.toJSON ? row.toJSON() : row,
      note: req.body?.note || null,
      actorId: req.user?.id,
    });

    const out = await ChequeRegisterEntry.findByPk(row.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "username"] },
        { model: User, as: "updater", attributes: ["id", "name", "username"] },
      ],
    });

    return res.json({ message: "Updated", data: decorateEntry(out) });
  } catch (err) {
    console.error("updateEntry error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// -----------------------------
// POST /api/cheque-register/:id/return
// -----------------------------
exports.returnEntry = async (req, res) => {
  try {
    ensureAssociations();

    const access = await assertChequeAccess(req);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const row = await ChequeRegisterEntry.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Entry not found" });

    const oldObj = row.toJSON ? row.toJSON() : row;

    row.status = "returned";
    row.returned_date =
      parseDateOnlyOrNull(req.body.returned_date) || new Date().toISOString().slice(0, 10);
    row.returned_to_section_id = req.body.returned_to_section_id
      ? Number(req.body.returned_to_section_id)
      : (row.returned_to_section_id || row.origin_section_id);

    row.updated_by = req.user?.id || null;
    await row.save();

    await writeLog({
      entryId: row.id,
      action: "return",
      oldObj,
      newObj: row.toJSON ? row.toJSON() : row,
      note: req.body?.note || null,
      actorId: req.user?.id,
    });

    const out = await ChequeRegisterEntry.findByPk(row.id, {
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "username"] },
        { model: User, as: "updater", attributes: ["id", "name", "username"] },
      ],
    });

    return res.json({ message: "Marked returned", data: decorateEntry(out) });
  } catch (err) {
    console.error("returnEntry error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// -----------------------------
// DELETE /api/cheque-register/:id  (Admin only) => SOFT DELETE
// -----------------------------
exports.deleteEntry = async (req, res) => {
  try {
    ensureAssociations();

    const access = await assertChequeAccess(req);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const role = normalizeName(req.user?.role);
    if (role !== "admin") return res.status(403).json({ message: "Admin only" });

    const row = await ChequeRegisterEntry.findByPk(req.params.id);
    if (!row) return res.status(404).json({ message: "Entry not found" });

    const oldObj = row.toJSON ? row.toJSON() : row;

    row.deleted_at = new Date();
    row.deleted_by = req.user?.id || null;
    row.delete_reason = (req.body?.reason || "").trim() || null;
    row.updated_by = req.user?.id || null;
    await row.save();

    await writeLog({
      entryId: row.id,
      action: "delete",
      oldObj,
      newObj: row.toJSON ? row.toJSON() : row,
      note: row.delete_reason || null,
      actorId: req.user?.id,
    });

    return res.json({ message: "Soft deleted" });
  } catch (err) {
    console.error("deleteEntry error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};

// -----------------------------
// GET /api/cheque-register/:id/logs (admin/master)
// -----------------------------
exports.getEntryLogs = async (req, res) => {
  try {
    ensureAssociations();

    const role = String(req.user?.role || "").toLowerCase();
    if (role !== "admin" && role !== "master") {
      return res.status(403).json({ message: "Admin/Master only" });
    }

    const entryId = Number(req.params.id);
    if (!entryId) return res.status(400).json({ message: "Invalid entry id" });

    const logs = await ChequeRegisterLog.findAll({
      where: { entry_id: entryId },
      include: [{ model: User, as: "actor", attributes: ["id", "name", "username"] }],
      order: [["created_at", "ASC"]],
    });

    return res.json({ data: logs });
  } catch (err) {
    console.error("getEntryLogs error:", err);
    return res.status(500).json({ message: err.message || "Server error" });
  }
};
