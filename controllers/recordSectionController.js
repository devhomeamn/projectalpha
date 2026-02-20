const { Op, fn, col, where: sqlWhere } = require("sequelize");
const Section = require("../models/sectionModel");
const User = require("../models/userModel");
const RecordSectionEntry = require("../models/recordSectionEntryModel");
const RecordSectionLog = require("../models/recordSectionLogModel");
const RecordSectionOfficeOption = require("../models/recordSectionOfficeOptionModel");
const RecordSectionForwardOption = require("../models/recordSectionForwardOptionModel");
let cachedRecordSection = { id: null, fetchedAt: 0 };
const RECORD_SECTION_CACHE_TTL_MS = 10 * 60 * 1000;

let assocInit = false;
function ensureAssociations() {
  if (assocInit) return;
  assocInit = true;

  if (!RecordSectionEntry.associations?.receivedFromOfficeOption) {
    RecordSectionEntry.belongsTo(RecordSectionOfficeOption, {
      foreignKey: "received_from_office_id",
      as: "receivedFromOfficeOption",
    });
  }
  if (!RecordSectionEntry.associations?.recordSection) {
    RecordSectionEntry.belongsTo(Section, {
      foreignKey: "record_section_id",
      as: "recordSection",
    });
  }
  if (!RecordSectionEntry.associations?.currentSection) {
    RecordSectionEntry.belongsTo(Section, {
      foreignKey: "current_section_id",
      as: "currentSection",
    });
  }
  if (!RecordSectionEntry.associations?.forwardToSection) {
    RecordSectionEntry.belongsTo(Section, {
      foreignKey: "forward_to_section_id",
      as: "forwardToSection",
    });
  }
  if (!RecordSectionEntry.associations?.forwardToCustomOption) {
    RecordSectionEntry.belongsTo(RecordSectionForwardOption, {
      foreignKey: "forward_to_custom_id",
      as: "forwardToCustomOption",
    });
  }
  if (!RecordSectionEntry.associations?.forwardToUser) {
    RecordSectionEntry.belongsTo(User, {
      foreignKey: "forward_to_user_id",
      as: "forwardToUser",
    });
  }
  if (!RecordSectionEntry.associations?.receivedByUser) {
    RecordSectionEntry.belongsTo(User, {
      foreignKey: "received_by_user_id",
      as: "receivedByUser",
    });
  }
  if (!RecordSectionEntry.associations?.creator) {
    RecordSectionEntry.belongsTo(User, {
      foreignKey: "created_by",
      as: "creator",
    });
  }
  if (!RecordSectionEntry.associations?.updater) {
    RecordSectionEntry.belongsTo(User, {
      foreignKey: "updated_by",
      as: "updater",
    });
  }

  if (!RecordSectionLog.associations?.actor) {
    RecordSectionLog.belongsTo(User, {
      foreignKey: "actor_id",
      as: "actor",
    });
  }
}

const ENTRY_INCLUDE = [
  { model: RecordSectionOfficeOption, as: "receivedFromOfficeOption", attributes: ["id", "name"], required: false },
  { model: Section, as: "recordSection", attributes: ["id", "name"], required: false },
  { model: Section, as: "currentSection", attributes: ["id", "name"], required: false },
  { model: Section, as: "forwardToSection", attributes: ["id", "name"], required: false },
  { model: RecordSectionForwardOption, as: "forwardToCustomOption", attributes: ["id", "name"], required: false },
  { model: User, as: "forwardToUser", attributes: ["id", "name", "username"], required: false },
  { model: User, as: "receivedByUser", attributes: ["id", "name", "username"], required: false },
  { model: User, as: "creator", attributes: ["id", "name", "username"], required: false },
  { model: User, as: "updater", attributes: ["id", "name", "username"], required: false },
];

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function isAdminOrMaster(req) {
  const role = normalizeRole(req.user?.role);
  return role === "admin" || role === "master";
}

function getActorUserId(req) {
  const id = Number(req.user?.id || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function getUserSectionId(req) {
  const id = Number(req.user?.section_id || 0);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function parseDateOnlyOrNull(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function parseDateOnlyStrict(value) {
  const date = parseDateOnlyOrNull(value);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const [y, m, d] = date.split("-").map((part) => Number(part));
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(probe.getTime())) return null;
  if (probe.getUTCFullYear() !== y || probe.getUTCMonth() + 1 !== m || probe.getUTCDate() !== d) return null;

  return date;
}

function parsePositiveIntOrNull(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function parseForwardKey(raw) {
  const text = String(raw || "").trim().toLowerCase();
  const m = text.match(/^(section|custom):(\d+)$/);
  if (!m) return null;
  return { type: m[1], id: Number(m[2]) };
}

async function resolveRecordSectionId() {
  const now = Date.now();
  if (cachedRecordSection.id && now - cachedRecordSection.fetchedAt < RECORD_SECTION_CACHE_TTL_MS) {
    return cachedRecordSection.id;
  }

  const configuredId = parsePositiveIntOrNull(process.env.RECORD_SECTION_ID);
  if (configuredId) {
    const foundById = await Section.findByPk(configuredId, { attributes: ["id", "name"] });
    if (foundById?.id) {
      cachedRecordSection = { id: Number(foundById.id), fetchedAt: now };
      return Number(foundById.id);
    }
  }

  const configuredName = normalizeName(process.env.RECORD_SECTION_NAME);
  const sections = await Section.findAll({ attributes: ["id", "name"] });
  const rows = sections.map((s) => ({
    id: Number(s.id),
    name: String(s.name || ""),
    norm: normalizeName(s.name),
  }));

  let found = null;
  if (configuredName) {
    found = rows.find((r) => r.norm === configuredName) || null;
  }
  if (!found) {
    found = rows.find((r) => r.norm === "record section") || rows.find((r) => r.norm.includes("record")) || null;
  }

  if (!found?.id) return null;
  cachedRecordSection = { id: Number(found.id), fetchedAt: now };
  return Number(found.id);
}

async function assertRecordSectionEntryAccess(req) {
  const sectionId = getUserSectionId(req);
  if (!sectionId) {
    return { ok: false, status: 403, message: "Your account is not assigned to any section" };
  }

  const recordSectionId = await resolveRecordSectionId();
  if (!recordSectionId) {
    return { ok: false, status: 500, message: "Record section not found. Set RECORD_SECTION_NAME or RECORD_SECTION_ID" };
  }

  if (Number(sectionId) !== Number(recordSectionId)) {
    return { ok: false, status: 403, message: "Only Record section users can create/forward entries" };
  }

  return { ok: true, sectionId, recordSectionId };
}

function addAndWhere(where, clause) {
  if (!where[Op.and]) where[Op.and] = [];
  where[Op.and].push(clause);
}

function buildGeneralVisibilityClause(req) {
  const userId = getActorUserId(req);
  const sectionId = getUserSectionId(req);
  const list = [];

  if (sectionId) {
    list.push({ record_section_id: sectionId });
    list.push({ current_section_id: sectionId });
    list.push({ forward_to_section_id: sectionId });
  }
  if (userId) {
    list.push({ created_by: userId });
    list.push({ received_by_user_id: userId });
    list.push({ forward_to_user_id: userId });
  }

  if (!list.length) return { id: -1 };
  return { [Op.or]: list };
}

function canViewEntry(req, entry) {
  if (isAdminOrMaster(req)) return true;

  const userId = getActorUserId(req);
  const sectionId = getUserSectionId(req);
  const row = entry?.toJSON ? entry.toJSON() : entry;
  if (!row) return false;

  if (
    sectionId &&
    (Number(row.record_section_id) === sectionId ||
      Number(row.current_section_id) === sectionId ||
      Number(row.forward_to_section_id) === sectionId)
  ) {
    return true;
  }

  if (
    userId &&
    (Number(row.created_by) === userId ||
      Number(row.forward_to_user_id) === userId ||
      Number(row.received_by_user_id) === userId)
  ) {
    return true;
  }

  return false;
}

function canModifyEntry(req, entry) {
  const sectionId = getUserSectionId(req);
  if (!sectionId) return false;
  return Number(entry?.record_section_id) === sectionId && Number(entry?.current_section_id) === sectionId;
}

function canForwardEntry(req, entry) {
  return canModifyEntry(req, entry);
}

function canReceiveEntry(req, entry) {
  const sectionId = getUserSectionId(req);
  if (!sectionId) return false;
  if (String(entry.forward_to_type || "") !== "section") return false;
  if (Number(entry.forward_to_section_id) !== sectionId) return false;
  return Number(entry.current_section_id) !== sectionId;
}

function normalizeEntry(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return item;

  const forwardToName =
    item.forward_to_label ||
    item.forwardToSection?.name ||
    item.forwardToCustomOption?.name ||
    null;

  return {
    ...item,
    received_from_office_name: item.receivedFromOfficeOption?.name || null,
    record_section_name: item.recordSection?.name || null,
    current_section_name: item.currentSection?.name || null,
    forward_to_name: forwardToName,
    forward_to_section_name: item.forwardToSection?.name || null,
    forward_to_custom_name: item.forwardToCustomOption?.name || null,
    forward_to_user_name: item.forwardToUser?.name || item.forwardToUser?.username || null,
    received_by_user_name: item.receivedByUser?.name || item.receivedByUser?.username || null,
    created_by_name: item.creator?.name || item.creator?.username || null,
    updated_by_name: item.updater?.name || item.updater?.username || null,
  };
}

async function writeLog({ entryId, action, oldObj, newObj, note, actorId }) {
  try {
    await RecordSectionLog.create({
      entry_id: entryId,
      action,
      old_data: oldObj ? JSON.stringify(oldObj) : null,
      new_data: newObj ? JSON.stringify(newObj) : null,
      note: note || null,
      actor_id: actorId || null,
    });
  } catch (err) {
    console.error("record section log write failed:", err);
  }
}

async function findEntryWithInclude(id) {
  ensureAssociations();
  return RecordSectionEntry.findByPk(id, { include: ENTRY_INCLUDE });
}

async function resolveForwardTarget(forwardKey) {
  if (!forwardKey || !forwardKey.type || !forwardKey.id) return null;

  if (forwardKey.type === "section") {
    const section = await Section.findByPk(forwardKey.id, { attributes: ["id", "name"] });
    if (!section) return null;
    return {
      forward_to_type: "section",
      forward_to_section_id: Number(section.id),
      forward_to_custom_id: null,
      forward_to_label: section.name,
    };
  }

  if (forwardKey.type === "custom") {
    const custom = await RecordSectionForwardOption.findOne({
      where: { id: forwardKey.id, is_active: true },
      attributes: ["id", "name"],
    });
    if (!custom) return null;
    return {
      forward_to_type: "custom",
      forward_to_section_id: null,
      forward_to_custom_id: Number(custom.id),
      forward_to_label: custom.name,
    };
  }

  return null;
}

function canManageOptions(req) {
  return isAdminOrMaster(req);
}

function resolveSourceSectionId(req) {
  return getUserSectionId(req);
}

function decoratePermissions(req, entryLike) {
  const row = entryLike?.toJSON ? entryLike.toJSON() : entryLike;
  const canEdit = canModifyEntry(req, row);
  const canReceive = row?.status === "forwarded" && canReceiveEntry(req, row);
  return { can_edit: !!canEdit, can_receive: !!canReceive };
}

function toLocalISODate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

exports.listSections = async (req, res) => {
  try {
    const sections = await Section.findAll({
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
    });
    return res.json(sections);
  } catch (err) {
    console.error("recordSection.listSections error:", err);
    return res.status(500).json({ message: "Failed to load sections" });
  }
};

exports.getContext = async (req, res) => {
  try {
    const recordSectionId = await resolveRecordSectionId();
    const userSectionId = getUserSectionId(req);
    const canEntry =
      !!recordSectionId && !!userSectionId && Number(recordSectionId) === Number(userSectionId);

    return res.json({
      record_section_id: recordSectionId || null,
      user_section_id: userSectionId || null,
      can_entry: !!canEntry,
    });
  } catch (err) {
    console.error("recordSection.getContext error:", err);
    return res.status(500).json({ message: "Failed to load record section context" });
  }
};

exports.listOfficeOptions = async (req, res) => {
  try {
    const rows = await RecordSectionOfficeOption.findAll({
      where: { is_active: true },
      attributes: ["id", "name", "description"],
      order: [["name", "ASC"]],
    });
    return res.json(rows);
  } catch (err) {
    console.error("recordSection.listOfficeOptions error:", err);
    return res.status(500).json({ message: "Failed to load office options" });
  }
};

exports.createOfficeOption = async (req, res) => {
  try {
    if (!canManageOptions(req)) return res.status(403).json({ message: "Admin/Master only" });

    const name = String(req.body?.name || "").trim();
    const description = String(req.body?.description || "").trim() || null;
    if (!name) return res.status(400).json({ message: "Option name is required" });

    const existing = await RecordSectionOfficeOption.findOne({ where: { name } });
    if (existing) return res.status(400).json({ message: "Option already exists" });

    const created = await RecordSectionOfficeOption.create({
      name,
      description,
      created_by: getActorUserId(req),
      is_active: true,
    });

    return res.status(201).json({ message: "Option created", data: created });
  } catch (err) {
    console.error("recordSection.createOfficeOption error:", err);
    return res.status(500).json({ message: "Failed to create office option" });
  }
};

exports.deleteOfficeOption = async (req, res) => {
  try {
    if (!canManageOptions(req)) return res.status(403).json({ message: "Admin/Master only" });

    const id = parsePositiveIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid option id" });

    const row = await RecordSectionOfficeOption.findByPk(id);
    if (!row) return res.status(404).json({ message: "Option not found" });

    row.is_active = false;
    await row.save();
    return res.json({ message: "Option deactivated" });
  } catch (err) {
    console.error("recordSection.deleteOfficeOption error:", err);
    return res.status(500).json({ message: "Failed to delete office option" });
  }
};

exports.listForwardTargets = async (req, res) => {
  try {
    const includeSections = String(req.query?.include_sections || "1") !== "0";

    const [sections, custom] = await Promise.all([
      includeSections
        ? Section.findAll({
            attributes: ["id", "name"],
            order: [["name", "ASC"]],
          })
        : Promise.resolve([]),
      RecordSectionForwardOption.findAll({
        where: { is_active: true },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
      }),
    ]);

    const sectionItems = sections.map((s) => ({
      key: `section:${s.id}`,
      type: "section",
      section_id: Number(s.id),
      custom_id: null,
      name: s.name,
      label: s.name,
    }));

    const customItems = custom.map((c) => ({
      key: `custom:${c.id}`,
      type: "custom",
      section_id: null,
      custom_id: Number(c.id),
      name: c.name,
      label: c.name,
    }));

    return res.json({
      items: [...sectionItems, ...customItems],
      sections: sectionItems,
      custom_options: customItems,
    });
  } catch (err) {
    console.error("recordSection.listForwardTargets error:", err);
    return res.status(500).json({ message: "Failed to load forward targets" });
  }
};

exports.createForwardTarget = async (req, res) => {
  try {
    if (!canManageOptions(req)) return res.status(403).json({ message: "Admin/Master only" });

    const name = String(req.body?.name || "").trim();
    if (!name) return res.status(400).json({ message: "Option name is required" });

    const existing = await RecordSectionForwardOption.findOne({ where: { name } });
    if (existing) return res.status(400).json({ message: "Option already exists" });

    const created = await RecordSectionForwardOption.create({
      name,
      created_by: getActorUserId(req),
      is_active: true,
    });

    return res.status(201).json({ message: "Forward target created", data: created });
  } catch (err) {
    console.error("recordSection.createForwardTarget error:", err);
    return res.status(500).json({ message: "Failed to create forward target" });
  }
};

exports.deleteForwardTarget = async (req, res) => {
  try {
    if (!canManageOptions(req)) return res.status(403).json({ message: "Admin/Master only" });

    const id = parsePositiveIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid option id" });

    const row = await RecordSectionForwardOption.findByPk(id);
    if (!row) return res.status(404).json({ message: "Option not found" });

    row.is_active = false;
    await row.save();
    return res.json({ message: "Forward target deactivated" });
  } catch (err) {
    console.error("recordSection.deleteForwardTarget error:", err);
    return res.status(500).json({ message: "Failed to delete forward target" });
  }
};

exports.listSectionUsers = async (req, res) => {
  try {
    const sectionId = parsePositiveIntOrNull(req.params.sectionId);
    if (!sectionId) return res.status(400).json({ message: "Invalid section id" });

    const users = await User.findAll({
      where: {
        section_id: sectionId,
        status: "approved",
        is_active: true,
      },
      attributes: ["id", "name", "username", "serviceid", "role"],
      order: [["name", "ASC"]],
    });

    return res.json(users);
  } catch (err) {
    console.error("recordSection.listSectionUsers error:", err);
    return res.status(500).json({ message: "Failed to load users" });
  }
};

exports.dailyCounts = async (req, res) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days || 10)));
    const whereBase = {};
    if (!isAdminOrMaster(req)) addAndWhere(whereBase, buildGeneralVisibilityClause(req));

    const [enteredRows, forwardedRows, lifetimeEntered, lifetimeForwarded] = await Promise.all([
      RecordSectionEntry.findAll({
        where: whereBase,
        attributes: ["received_date", [fn("COUNT", col("id")), "total"]],
        group: ["received_date"],
        raw: true,
      }),
      RecordSectionEntry.findAll({
        where: { ...whereBase, forwarded_at: { [Op.ne]: null } },
        attributes: [[fn("DATE", col("forwarded_at")), "forward_date"], [fn("COUNT", col("id")), "total"]],
        group: [fn("DATE", col("forwarded_at"))],
        raw: true,
      }),
      RecordSectionEntry.count({ where: whereBase }),
      RecordSectionEntry.count({ where: { ...whereBase, forwarded_at: { [Op.ne]: null } } }),
    ]);

    const enteredMap = new Map(
      enteredRows
        .map((r) => ({ date: String(r.received_date || "").slice(0, 10), total: Number(r.total || 0) }))
        .filter((x) => x.date)
        .map((x) => [x.date, x.total])
    );

    const forwardedMap = new Map(
      forwardedRows
        .map((r) => ({ date: String(r.forward_date || "").slice(0, 10), total: Number(r.total || 0) }))
        .filter((x) => x.date)
        .map((x) => [x.date, x.total])
    );

    const allDates = Array.from(new Set([...enteredMap.keys(), ...forwardedMap.keys()])).sort((a, b) =>
      b.localeCompare(a)
    );
    const daily = allDates.slice(0, days).map((date) => ({
      date,
      entered: enteredMap.get(date) || 0,
      forwarded: forwardedMap.get(date) || 0,
    }));

    const today = toLocalISODate(new Date());
    return res.json({
      today_date: today,
      today: {
        entered: enteredMap.get(today) || 0,
        forwarded: forwardedMap.get(today) || 0,
      },
      lifetime: {
        entered: Number(lifetimeEntered || 0),
        forwarded: Number(lifetimeForwarded || 0),
      },
      daily,
    });
  } catch (err) {
    console.error("recordSection.dailyCounts error:", err);
    return res.status(500).json({ message: "Failed to load daily counts" });
  }
};

exports.forwardedByDateReport = async (req, res) => {
  try {
    ensureAssociations();

    const reportDate = parseDateOnlyStrict(req.query.report_date);
    if (!reportDate) {
      return res.status(400).json({ message: "Valid report_date (YYYY-MM-DD) is required" });
    }

    const where = {
      forwarded_at: { [Op.ne]: null },
    };

    addAndWhere(where, sqlWhere(fn("DATE", col("forwarded_at")), reportDate));
    if (!isAdminOrMaster(req)) addAndWhere(where, buildGeneralVisibilityClause(req));

    const rows = await RecordSectionEntry.findAll({
      where,
      include: ENTRY_INCLUDE,
      order: [["forwarded_at", "ASC"], ["id", "ASC"]],
    });

    const entries = rows.map((row) => {
      const item = normalizeEntry(row);
      return {
        id: Number(item.id),
        received_date: parseDateOnlyOrNull(item.received_date),
        diary_sl_no: item.diary_sl_no || "",
        memo_no: item.memo_no || "",
        topic: item.topic || "",
        current_section_name: item.current_section_name || "-",
        forward_to_name: item.forward_to_name || "-",
        status: item.status || "-",
        forwarded_at: item.forwarded_at || null,
      };
    });

    return res.json({
      report_date: reportDate,
      total_forwarded: entries.length,
      entries,
    });
  } catch (err) {
    console.error("recordSection.forwardedByDateReport error:", err);
    return res.status(500).json({ message: "Failed to load forwarded report" });
  }
};

exports.listEntries = async (req, res) => {
  try {
    ensureAssociations();

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(5, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const where = {};
    const status = String(req.query.status || "").trim().toLowerCase();
    const q = String(req.query.q || "").trim();
    const sectionFilter = parsePositiveIntOrNull(req.query.current_section_id);

    if (status && status !== "all") where.status = status;
    if (sectionFilter) where.current_section_id = sectionFilter;

    if (q) {
      where[Op.or] = [
        { diary_sl_no: { [Op.like]: `%${q}%` } },
        { memo_no: { [Op.like]: `%${q}%` } },
        { topic: { [Op.like]: `%${q}%` } },
        { forward_to_label: { [Op.like]: `%${q}%` } },
      ];
    }

    if (!isAdminOrMaster(req)) addAndWhere(where, buildGeneralVisibilityClause(req));

    const { rows, count } = await RecordSectionEntry.findAndCountAll({
      where,
      include: ENTRY_INCLUDE,
      order: [["received_date", "DESC"], ["id", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      data: rows.map((row) => {
        const normalized = normalizeEntry(row);
        return { ...normalized, ...decoratePermissions(req, normalized) };
      }),
      total: count,
      page,
      limit,
    });
  } catch (err) {
    console.error("recordSection.listEntries error:", err);
    return res.status(500).json({ message: "Failed to load entries" });
  }
};

exports.getEntry = async (req, res) => {
  try {
    ensureAssociations();
    const id = parsePositiveIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid entry id" });

    const entry = await findEntryWithInclude(id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    if (!canViewEntry(req, entry)) return res.status(403).json({ message: "Forbidden" });

    const normalized = normalizeEntry(entry);
    return res.json({ data: { ...normalized, ...decoratePermissions(req, normalized) } });
  } catch (err) {
    console.error("recordSection.getEntry error:", err);
    return res.status(500).json({ message: "Failed to load entry" });
  }
};

exports.createEntry = async (req, res) => {
  try {
    ensureAssociations();
    const access = await assertRecordSectionEntryAccess(req);
    if (!access.ok) return res.status(access.status).json({ message: access.message });

    const receivedFromOfficeId = parsePositiveIntOrNull(req.body.received_from_office_id);
    const receivedDate = parseDateOnlyOrNull(req.body.received_date);
    const diarySlNo = String(req.body.diary_sl_no || "").trim();
    const memoNo = String(req.body.memo_no || "").trim() || null;
    const memoDate = parseDateOnlyOrNull(req.body.memo_date);
    const topic = String(req.body.topic || "").trim();
    const forwardKey = parseForwardKey(req.body.forward_to_key);
    const sourceSectionId = access.recordSectionId || resolveSourceSectionId(req);

    if (!receivedFromOfficeId) return res.status(400).json({ message: "received_from_office_id is required" });
    if (!receivedDate) return res.status(400).json({ message: "received_date is required" });
    if (!diarySlNo) return res.status(400).json({ message: "diary_sl_no is required" });
    if (!topic) return res.status(400).json({ message: "topic is required" });
    if (!forwardKey) return res.status(400).json({ message: "forward_to_key is required" });
    if (!sourceSectionId) return res.status(403).json({ message: "Your account is not assigned to any section" });

    const [officeOption, sourceSection, forwardTarget] = await Promise.all([
      RecordSectionOfficeOption.findOne({ where: { id: receivedFromOfficeId, is_active: true } }),
      Section.findByPk(sourceSectionId),
      resolveForwardTarget(forwardKey),
    ]);

    if (!officeOption) return res.status(400).json({ message: "Invalid received_from_office_id" });
    if (!sourceSection) return res.status(400).json({ message: "Invalid source_section_id" });
    if (!forwardTarget) return res.status(400).json({ message: "Invalid forward_to_key" });
    if (
      String(forwardTarget.forward_to_type || "") === "section" &&
      Number(forwardTarget.forward_to_section_id) === Number(sourceSectionId)
    ) {
      return res.status(400).json({ message: "Forward section must be different from current section" });
    }

    const actorId = getActorUserId(req);
    const created = await RecordSectionEntry.create({
      received_from_office_id: receivedFromOfficeId,
      received_date: receivedDate,
      diary_sl_no: diarySlNo,
      memo_no: memoNo,
      memo_date: memoDate,
      topic,
      record_section_id: sourceSectionId,
      current_section_id: sourceSectionId,
      forward_to_type: forwardTarget.forward_to_type,
      forward_to_section_id: forwardTarget.forward_to_section_id,
      forward_to_custom_id: forwardTarget.forward_to_custom_id,
      forward_to_label: forwardTarget.forward_to_label,
      forward_to_user_id: null,
      forwarded_by: actorId,
      forwarded_at: new Date(),
      status: "forwarded",
      created_by: actorId,
      updated_by: null,
    });

    await writeLog({
      entryId: created.id,
      action: "create",
      oldObj: null,
      newObj: created.toJSON ? created.toJSON() : created,
      note: null,
      actorId,
    });

    const out = await findEntryWithInclude(created.id);
    return res.status(201).json({ message: "Entry created", data: normalizeEntry(out) });
  } catch (err) {
    console.error("recordSection.createEntry error:", err);
    return res.status(500).json({ message: "Failed to create entry" });
  }
};

exports.updateEntry = async (req, res) => {
  try {
    ensureAssociations();
    const id = parsePositiveIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid entry id" });

    const entry = await RecordSectionEntry.findByPk(id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    if (!canModifyEntry(req, entry)) return res.status(403).json({ message: "Section user can modify only own section records" });

    const oldObj = entry.toJSON ? entry.toJSON() : entry;
    const receivedFromOfficeId = parsePositiveIntOrNull(req.body.received_from_office_id);
    const receivedDate = parseDateOnlyOrNull(req.body.received_date);
    const diarySlNo = req.body.diary_sl_no !== undefined ? String(req.body.diary_sl_no || "").trim() : undefined;
    const memoNo = req.body.memo_no !== undefined ? String(req.body.memo_no || "").trim() : undefined;
    const memoDate = req.body.memo_date !== undefined ? parseDateOnlyOrNull(req.body.memo_date) : undefined;
    const topic = req.body.topic !== undefined ? String(req.body.topic || "").trim() : undefined;

    if (receivedFromOfficeId !== null) {
      const office = await RecordSectionOfficeOption.findOne({
        where: { id: receivedFromOfficeId, is_active: true },
      });
      if (!office) return res.status(400).json({ message: "Invalid received_from_office_id" });
      entry.received_from_office_id = receivedFromOfficeId;
    }
    if (receivedDate !== null) entry.received_date = receivedDate;
    if (diarySlNo !== undefined) {
      if (!diarySlNo) return res.status(400).json({ message: "diary_sl_no cannot be empty" });
      entry.diary_sl_no = diarySlNo;
    }
    if (memoNo !== undefined) entry.memo_no = memoNo || null;
    if (memoDate !== undefined) entry.memo_date = memoDate || null;
    if (topic !== undefined) {
      if (!topic) return res.status(400).json({ message: "topic cannot be empty" });
      entry.topic = topic;
    }

    const forwardKey = req.body.forward_to_key !== undefined ? parseForwardKey(req.body.forward_to_key) : null;
    if (req.body.forward_to_key !== undefined) {
      const access = await assertRecordSectionEntryAccess(req);
      if (!access.ok) return res.status(access.status).json({ message: access.message });
      if (!forwardKey) return res.status(400).json({ message: "Invalid forward_to_key" });
      if (!canForwardEntry(req, entry)) {
        return res.status(403).json({ message: "Only assigned current section user can forward this entry" });
      }
      const forwardTarget = await resolveForwardTarget(forwardKey);
      if (!forwardTarget) return res.status(400).json({ message: "Invalid forward target" });
      if (
        String(forwardTarget.forward_to_type || "") === "section" &&
        Number(forwardTarget.forward_to_section_id) === Number(entry.current_section_id)
      ) {
        return res.status(400).json({ message: "Forward section must be different from current section" });
      }

      entry.forward_to_type = forwardTarget.forward_to_type;
      entry.forward_to_section_id = forwardTarget.forward_to_section_id;
      entry.forward_to_custom_id = forwardTarget.forward_to_custom_id;
      entry.forward_to_label = forwardTarget.forward_to_label;
      entry.forward_to_user_id = null;
      entry.forwarded_by = getActorUserId(req);
      entry.forwarded_at = new Date();
      entry.status = "forwarded";
      entry.received_by_user_id = null;
      entry.received_at = null;
    }

    entry.updated_by = getActorUserId(req);
    await entry.save();

    await writeLog({
      entryId: entry.id,
      action: "update",
      oldObj,
      newObj: entry.toJSON ? entry.toJSON() : entry,
      note: req.body?.note || null,
      actorId: getActorUserId(req),
    });

    const out = await findEntryWithInclude(entry.id);
    return res.json({ message: "Entry updated", data: normalizeEntry(out) });
  } catch (err) {
    console.error("recordSection.updateEntry error:", err);
    return res.status(500).json({ message: "Failed to update entry" });
  }
};

exports.forwardEntry = async (req, res) => {
  try {
    ensureAssociations();
    const access = await assertRecordSectionEntryAccess(req);
    if (!access.ok) return res.status(access.status).json({ message: access.message });
    const id = parsePositiveIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid entry id" });

    const forwardKey = parseForwardKey(req.body.forward_to_key);
    if (!forwardKey) return res.status(400).json({ message: "forward_to_key is required" });

    const entry = await RecordSectionEntry.findByPk(id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    if (!canForwardEntry(req, entry)) {
      return res.status(403).json({ message: "Section user can modify only own section records" });
    }

    const forwardTarget = await resolveForwardTarget(forwardKey);
    if (!forwardTarget) return res.status(400).json({ message: "Invalid forward target" });
    if (
      String(forwardTarget.forward_to_type || "") === "section" &&
      Number(forwardTarget.forward_to_section_id) === Number(entry.current_section_id)
    ) {
      return res.status(400).json({ message: "Forward section must be different from current section" });
    }

    const oldObj = entry.toJSON ? entry.toJSON() : entry;
    entry.forward_to_type = forwardTarget.forward_to_type;
    entry.forward_to_section_id = forwardTarget.forward_to_section_id;
    entry.forward_to_custom_id = forwardTarget.forward_to_custom_id;
    entry.forward_to_label = forwardTarget.forward_to_label;
    entry.forward_to_user_id = null;
    entry.forwarded_by = getActorUserId(req);
    entry.forwarded_at = new Date();
    entry.received_by_user_id = null;
    entry.received_at = null;
    entry.status = "forwarded";
    entry.updated_by = getActorUserId(req);
    await entry.save();

    await writeLog({
      entryId: entry.id,
      action: "forward",
      oldObj,
      newObj: entry.toJSON ? entry.toJSON() : entry,
      note: req.body?.note || null,
      actorId: getActorUserId(req),
    });

    const out = await findEntryWithInclude(entry.id);
    return res.json({ message: "Entry forwarded", data: normalizeEntry(out) });
  } catch (err) {
    console.error("recordSection.forwardEntry error:", err);
    return res.status(500).json({ message: "Failed to forward entry" });
  }
};

exports.receiveForwardedEntry = async (req, res) => {
  try {
    ensureAssociations();
    const id = parsePositiveIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid entry id" });

    const entry = await RecordSectionEntry.findByPk(id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    if (entry.status !== "forwarded") {
      return res.status(400).json({ message: "Only forwarded entries can be received" });
    }
    if (String(entry.forward_to_type || "") !== "section" || !entry.forward_to_section_id) {
      return res.status(400).json({ message: "This forward target cannot be received by section user" });
    }
    if (!canReceiveEntry(req, entry)) {
      return res.status(403).json({ message: "You cannot receive this entry" });
    }

    const oldObj = entry.toJSON ? entry.toJSON() : entry;
    entry.current_section_id = entry.forward_to_section_id;
    entry.status = "forward_received";
    entry.received_by_user_id = getActorUserId(req);
    entry.received_at = new Date();
    entry.updated_by = getActorUserId(req);
    await entry.save();

    await writeLog({
      entryId: entry.id,
      action: "receive",
      oldObj,
      newObj: entry.toJSON ? entry.toJSON() : entry,
      note: req.body?.note || null,
      actorId: getActorUserId(req),
    });

    const out = await findEntryWithInclude(entry.id);
    return res.json({ message: "Entry received", data: normalizeEntry(out) });
  } catch (err) {
    console.error("recordSection.receiveForwardedEntry error:", err);
    return res.status(500).json({ message: "Failed to receive entry" });
  }
};

exports.listEntryLogs = async (req, res) => {
  try {
    ensureAssociations();
    const id = parsePositiveIntOrNull(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid entry id" });

    const entry = await RecordSectionEntry.findByPk(id);
    if (!entry) return res.status(404).json({ message: "Entry not found" });
    if (!canViewEntry(req, entry)) return res.status(403).json({ message: "Forbidden" });

    const rows = await RecordSectionLog.findAll({
      where: { entry_id: id },
      include: [{ model: User, as: "actor", attributes: ["id", "name", "username"], required: false }],
      order: [["created_at", "ASC"]],
    });

    return res.json({ data: rows });
  } catch (err) {
    console.error("recordSection.listEntryLogs error:", err);
    return res.status(500).json({ message: "Failed to load logs" });
  }
};
