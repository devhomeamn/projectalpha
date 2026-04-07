const { Op } = require("sequelize");
const sequelize = require("../config/db");
const Section = require("../models/sectionModel");
const User = require("../models/userModel");
const InventoryItem = require("../models/inventoryItemModel");
const InventoryRequisition = require("../models/inventoryRequisitionModel");
const InventoryRequisitionItem = require("../models/inventoryRequisitionItemModel");
const InventoryTransaction = require("../models/inventoryTransactionModel");
const {
  INVENTORY_PERMISSIONS,
  hasInventoryPermission,
} = require("../middleware/inventoryAuth");

const HEADER_STATUSES = [
  "Draft",
  "Submitted",
  "Forwarded",
  "Approved",
  "Partially Approved",
  "Rejected",
  "Issued",
];

const LINE_STATUSES = ["Pending", "Approved", "Partially Approved", "Rejected", "Issued"];
const HEADER_STATUS_MAP = new Map(HEADER_STATUSES.map((s) => [s.toLowerCase(), s]));

let assocInit = false;
function ensureAssociations() {
  if (assocInit) return;
  assocInit = true;

  if (!InventoryRequisition.associations?.items) {
    InventoryRequisition.hasMany(InventoryRequisitionItem, {
      foreignKey: "requisition_id",
      as: "items",
      onDelete: "CASCADE",
    });
  }
  if (!InventoryRequisitionItem.associations?.requisition) {
    InventoryRequisitionItem.belongsTo(InventoryRequisition, {
      foreignKey: "requisition_id",
      as: "requisition",
    });
  }

  if (!InventoryItem.associations?.requisitionItems) {
    InventoryItem.hasMany(InventoryRequisitionItem, {
      foreignKey: "item_id",
      as: "requisitionItems",
      onDelete: "RESTRICT",
    });
  }
  if (!InventoryRequisitionItem.associations?.item) {
    InventoryRequisitionItem.belongsTo(InventoryItem, {
      foreignKey: "item_id",
      as: "item",
    });
  }

  if (!InventoryItem.associations?.transactions) {
    InventoryItem.hasMany(InventoryTransaction, {
      foreignKey: "item_id",
      as: "transactions",
      onDelete: "RESTRICT",
    });
  }
  if (!InventoryTransaction.associations?.item) {
    InventoryTransaction.belongsTo(InventoryItem, {
      foreignKey: "item_id",
      as: "item",
    });
  }

  if (!InventoryRequisition.associations?.section) {
    InventoryRequisition.belongsTo(Section, {
      foreignKey: "section_id",
      as: "section",
    });
  }
  if (!InventoryRequisition.associations?.requester) {
    InventoryRequisition.belongsTo(User, {
      foreignKey: "requested_by",
      as: "requester",
    });
  }
  if (!InventoryRequisition.associations?.creator) {
    InventoryRequisition.belongsTo(User, {
      foreignKey: "created_by",
      as: "creator",
    });
  }
  if (!InventoryRequisition.associations?.forwarder) {
    InventoryRequisition.belongsTo(User, {
      foreignKey: "forwarded_by",
      as: "forwarder",
    });
  }
  if (!InventoryRequisition.associations?.approver) {
    InventoryRequisition.belongsTo(User, {
      foreignKey: "approved_by",
      as: "approver",
    });
  }
  if (!InventoryRequisition.associations?.issuer) {
    InventoryRequisition.belongsTo(User, {
      foreignKey: "issued_by",
      as: "issuer",
    });
  }

  if (!InventoryTransaction.associations?.section) {
    InventoryTransaction.belongsTo(Section, {
      foreignKey: "section_id",
      as: "section",
    });
  }
  if (!InventoryTransaction.associations?.doneBy) {
    InventoryTransaction.belongsTo(User, {
      foreignKey: "done_by",
      as: "doneBy",
    });
  }

  if (!InventoryItem.associations?.creator) {
    InventoryItem.belongsTo(User, {
      foreignKey: "created_by",
      as: "creator",
    });
  }
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getActorUserId(req) {
  const userId = Number(req.user?.id || 0);
  return Number.isFinite(userId) && userId > 0 ? userId : null;
}

function getUserSectionId(req) {
  const sectionId = Number(req.user?.section_id || 0);
  return Number.isFinite(sectionId) && sectionId > 0 ? sectionId : null;
}

function toPositiveInt(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

function toSafeInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function toQty(value) {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n.toFixed(2));
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanText(value, maxLength = 2000) {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.slice(0, maxLength);
}

function normalizeHeaderStatus(value) {
  if (!value) return null;
  return HEADER_STATUS_MAP.get(String(value).trim().toLowerCase()) || null;
}

function toMonthYear(rawMonth, rawYear) {
  const now = new Date();
  const month = toSafeInt(rawMonth, now.getMonth() + 1);
  const year = toSafeInt(rawYear, now.getFullYear());
  if (month < 1 || month > 12) return null;
  if (year < 2000 || year > 2100) return null;
  return { month, year };
}

function parsePagination(req, defaultLimit = 20) {
  const page = Math.max(1, toSafeInt(req.query.page, 1));
  const limit = Math.min(100, Math.max(5, toSafeInt(req.query.limit, defaultLimit)));
  return { page, limit, offset: (page - 1) * limit };
}

function buildRequisitionVisibilityWhere(req) {
  const role = normalizeRole(req.user?.role);
  const userId = getActorUserId(req);
  const sectionId = getUserSectionId(req);

  if (role === "admin") return {};

  if (role === "general") {
    const list = [];
    if (userId) list.push({ requested_by: userId });
    if (sectionId) list.push({ section_id: sectionId });
    if (!list.length) return { id: -1 };
    return { [Op.or]: list };
  }

  if (role === "master") {
    return {
      status: {
        [Op.in]: [
          "Submitted",
          "Forwarded",
          "Approved",
          "Partially Approved",
          "Rejected",
          "Issued",
        ],
      },
    };
  }

  if (role === "inventory manager") {
    return {
      status: {
        [Op.in]: ["Forwarded", "Approved", "Partially Approved", "Rejected", "Issued"],
      },
    };
  }

  return { id: -1 };
}

function canViewRequisition(req, requisition) {
  const role = normalizeRole(req.user?.role);
  if (role === "admin" || role === "inventory manager" || role === "master") return true;

  if (role === "general") {
    const userId = getActorUserId(req);
    const sectionId = getUserSectionId(req);
    return (
      (userId && Number(requisition.requested_by) === Number(userId)) ||
      (sectionId && Number(requisition.section_id) === Number(sectionId))
    );
  }

  return false;
}

function canEditDraft(req, requisition) {
  const role = normalizeRole(req.user?.role);
  if (role === "admin") return true;
  if (role !== "general") return false;
  const userId = getActorUserId(req);
  return userId && Number(requisition.requested_by) === Number(userId);
}

function normalizeRequisitionRow(row) {
  const item = row?.toJSON ? row.toJSON() : row;
  if (!item) return item;

  const lines = Array.isArray(item.items) ? item.items : [];
  const totals = lines.reduce(
    (acc, line) => {
      acc.requested_qty += toNumber(line.requested_qty);
      acc.approved_qty += toNumber(line.approved_qty);
      acc.issued_qty += toNumber(line.issued_qty);
      return acc;
    },
    { requested_qty: 0, approved_qty: 0, issued_qty: 0 }
  );

  return {
    ...item,
    totals: {
      requested_qty: Number(totals.requested_qty.toFixed(2)),
      approved_qty: Number(totals.approved_qty.toFixed(2)),
      issued_qty: Number(totals.issued_qty.toFixed(2)),
    },
  };
}

async function generateRequisitionNo({ month, year, transaction }) {
  const prefix = `REQ-${year}${String(month).padStart(2, "0")}-`;
  const latest = await InventoryRequisition.findOne({
    where: { requisition_no: { [Op.like]: `${prefix}%` } },
    attributes: ["requisition_no"],
    order: [["id", "DESC"]],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });

  let serial = 1;
  if (latest?.requisition_no) {
    const m = String(latest.requisition_no).match(/-(\d{4})$/);
    if (m) serial = Number(m[1]) + 1;
  }

  return `${prefix}${String(serial).padStart(4, "0")}`;
}

async function validateLineItemsForRequest(lines, transaction) {
  if (!Array.isArray(lines) || !lines.length) {
    return { ok: false, message: "At least one item row is required" };
  }

  const normalized = [];
  const seen = new Set();

  for (const raw of lines) {
    const itemId = toPositiveInt(raw?.item_id);
    const requestedQty = toQty(raw?.requested_qty);
    if (!itemId) return { ok: false, message: "Invalid item in requisition lines" };
    if (seen.has(itemId)) return { ok: false, message: "Duplicate item rows are not allowed" };
    seen.add(itemId);
    if (requestedQty === null || requestedQty <= 0) {
      return { ok: false, message: "Requested quantity must be greater than zero" };
    }
    normalized.push({
      item_id: itemId,
      requested_qty: requestedQty,
      remarks: cleanText(raw?.remarks, 500),
    });
  }

  const items = await InventoryItem.findAll({
    where: { id: normalized.map((x) => x.item_id), status: "active" },
    attributes: ["id"],
    transaction,
  });

  if (items.length !== normalized.length) {
    return { ok: false, message: "One or more selected items are inactive or invalid" };
  }

  return { ok: true, lines: normalized };
}

async function findRequisitionWithDetails(id, transaction = null) {
  ensureAssociations();
  return InventoryRequisition.findByPk(id, {
    include: [
      { model: Section, as: "section", attributes: ["id", "name"], required: false },
      { model: User, as: "requester", attributes: ["id", "name", "username"], required: false },
      { model: User, as: "forwarder", attributes: ["id", "name", "username"], required: false },
      { model: User, as: "approver", attributes: ["id", "name", "username"], required: false },
      { model: User, as: "issuer", attributes: ["id", "name", "username"], required: false },
      {
        model: InventoryRequisitionItem,
        as: "items",
        attributes: [
          "id",
          "item_id",
          "requested_qty",
          "approved_qty",
          "issued_qty",
          "remarks",
          "line_status",
        ],
        include: [
          {
            model: InventoryItem,
            as: "item",
            attributes: [
              "id",
              "item_code",
              "item_name",
              "category",
              "unit",
              "current_stock",
              "minimum_stock",
              "status",
            ],
            required: false,
          },
        ],
        required: false,
      },
    ],
    order: [[{ model: InventoryRequisitionItem, as: "items" }, "id", "ASC"]],
    transaction,
  });
}

async function writeInventoryTransaction({
  itemId,
  transactionType,
  qty,
  balanceAfter,
  referenceType,
  referenceId,
  sectionId,
  remarks,
  doneBy,
  transaction,
}) {
  await InventoryTransaction.create(
    {
      item_id: itemId,
      transaction_type: transactionType,
      qty: Number(qty.toFixed(2)),
      balance_after: Number(balanceAfter.toFixed(2)),
      reference_type: referenceType || null,
      reference_id: referenceId || null,
      section_id: sectionId || null,
      remarks: cleanText(remarks, 1000),
      done_by: doneBy || null,
    },
    { transaction }
  );
}

exports.listItems = async (req, res) => {
  try {
    ensureAssociations();
    const { page, limit, offset } = parsePagination(req);
    const where = {};
    const q = String(req.query.q || "").trim();
    const statusRaw = String(req.query.status || "").trim().toLowerCase();

    const canManageItems = hasInventoryPermission(
      req.user,
      INVENTORY_PERMISSIONS.inventory_item_manage
    );
    const canViewReports = hasInventoryPermission(
      req.user,
      INVENTORY_PERMISSIONS.inventory_report_view
    );

    if (!canManageItems && !canViewReports) {
      where.status = "active";
    } else if (statusRaw && statusRaw !== "all") {
      where.status = statusRaw === "inactive" ? "inactive" : "active";
    }

    if (q) {
      where[Op.or] = [
        { item_code: { [Op.like]: `%${q}%` } },
        { item_name: { [Op.like]: `%${q}%` } },
        { category: { [Op.like]: `%${q}%` } },
      ];
    }

    const { rows, count } = await InventoryItem.findAndCountAll({
      where,
      order: [["item_name", "ASC"], ["id", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      data: rows.map((row) => {
        const item = row.toJSON();
        const currentStock = toNumber(item.current_stock);
        const minimumStock = toNumber(item.minimum_stock);
        return {
          ...item,
          current_stock: Number(currentStock.toFixed(2)),
          minimum_stock: Number(minimumStock.toFixed(2)),
          is_low_stock: currentStock <= minimumStock,
        };
      }),
      total: count,
      page,
      limit,
    });
  } catch (err) {
    console.error("inventory.listItems error:", err);
    return res.status(500).json({ message: "Failed to load inventory items" });
  }
};

exports.getItemById = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid item id" });

    const row = await InventoryItem.findByPk(id);
    if (!row) return res.status(404).json({ message: "Item not found" });

    const item = row.toJSON();
    const currentStock = toNumber(item.current_stock);
    const minimumStock = toNumber(item.minimum_stock);

    return res.json({
      data: {
        ...item,
        current_stock: Number(currentStock.toFixed(2)),
        minimum_stock: Number(minimumStock.toFixed(2)),
        is_low_stock: currentStock <= minimumStock,
      },
    });
  } catch (err) {
    console.error("inventory.getItemById error:", err);
    return res.status(500).json({ message: "Failed to load item" });
  }
};

exports.createItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const itemCode = String(req.body?.item_code || "").trim();
    const itemName = String(req.body?.item_name || "").trim();
    const category = cleanText(req.body?.category, 120);
    const unit = cleanText(req.body?.unit, 40);
    const description = cleanText(req.body?.description, 1000);
    const currentStock = toQty(req.body?.current_stock ?? 0);
    const minimumStock = toQty(req.body?.minimum_stock ?? 0);
    const statusRaw = String(req.body?.status || "active").trim().toLowerCase();
    const status = statusRaw === "inactive" ? "inactive" : "active";
    const actorId = getActorUserId(req);

    if (!itemCode) {
      await t.rollback();
      return res.status(400).json({ message: "item_code is required" });
    }
    if (!itemName) {
      await t.rollback();
      return res.status(400).json({ message: "item_name is required" });
    }
    if (currentStock === null || minimumStock === null) {
      await t.rollback();
      return res.status(400).json({ message: "Stock quantities must be valid numbers" });
    }

    const existing = await InventoryItem.findOne({
      where: { item_code: itemCode },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ message: "item_code already exists" });
    }

    const created = await InventoryItem.create(
      {
        item_code: itemCode,
        item_name: itemName,
        category,
        unit,
        current_stock: currentStock,
        minimum_stock: minimumStock,
        description,
        status,
        created_by: actorId,
      },
      { transaction: t }
    );

    await writeInventoryTransaction({
      itemId: created.id,
      transactionType: "opening",
      qty: currentStock,
      balanceAfter: currentStock,
      referenceType: "inventory_item",
      referenceId: created.id,
      sectionId: null,
      remarks: "Opening stock",
      doneBy: actorId,
      transaction: t,
    });

    await t.commit();
    return res.status(201).json({ message: "Item created", data: created });
  } catch (err) {
    await t.rollback();
    console.error("inventory.createItem error:", err);
    return res.status(500).json({ message: "Failed to create inventory item" });
  }
};

exports.updateItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid item id" });
    }

    const row = await InventoryItem.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!row) {
      await t.rollback();
      return res.status(404).json({ message: "Item not found" });
    }

    const itemCode =
      req.body?.item_code !== undefined ? String(req.body.item_code || "").trim() : row.item_code;
    const itemName =
      req.body?.item_name !== undefined ? String(req.body.item_name || "").trim() : row.item_name;

    if (!itemCode) {
      await t.rollback();
      return res.status(400).json({ message: "item_code is required" });
    }
    if (!itemName) {
      await t.rollback();
      return res.status(400).json({ message: "item_name is required" });
    }

    const duplicate = await InventoryItem.findOne({
      where: {
        item_code: itemCode,
        id: { [Op.ne]: id },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (duplicate) {
      await t.rollback();
      return res.status(400).json({ message: "item_code already exists" });
    }

    const oldStock = toNumber(row.current_stock);
    let newStock = oldStock;
    if (req.body?.current_stock !== undefined) {
      const parsedStock = toQty(req.body.current_stock);
      if (parsedStock === null) {
        await t.rollback();
        return res.status(400).json({ message: "current_stock must be a valid number" });
      }
      newStock = parsedStock;
    }

    let minimumStock = toNumber(row.minimum_stock);
    if (req.body?.minimum_stock !== undefined) {
      const parsedMin = toQty(req.body.minimum_stock);
      if (parsedMin === null) {
        await t.rollback();
        return res.status(400).json({ message: "minimum_stock must be a valid number" });
      }
      minimumStock = parsedMin;
    }

    const actorId = getActorUserId(req);

    row.item_code = itemCode;
    row.item_name = itemName;
    if (req.body?.category !== undefined) row.category = cleanText(req.body.category, 120);
    if (req.body?.unit !== undefined) row.unit = cleanText(req.body.unit, 40);
    if (req.body?.description !== undefined) row.description = cleanText(req.body.description, 1000);
    if (req.body?.status !== undefined) {
      const statusRaw = String(req.body.status || "").trim().toLowerCase();
      row.status = statusRaw === "inactive" ? "inactive" : "active";
    }
    row.current_stock = Number(newStock.toFixed(2));
    row.minimum_stock = Number(minimumStock.toFixed(2));
    await row.save({ transaction: t });

    if (Math.abs(newStock - oldStock) > 0.0001) {
      await writeInventoryTransaction({
        itemId: row.id,
        transactionType: "adjustment",
        qty: Number((newStock - oldStock).toFixed(2)),
        balanceAfter: newStock,
        referenceType: "inventory_item",
        referenceId: row.id,
        sectionId: null,
        remarks: "Manual stock adjustment",
        doneBy: actorId,
        transaction: t,
      });
    }

    await t.commit();
    return res.json({ message: "Item updated", data: row });
  } catch (err) {
    await t.rollback();
    console.error("inventory.updateItem error:", err);
    return res.status(500).json({ message: "Failed to update inventory item" });
  }
};

exports.patchItemStatus = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid item id" });

    const row = await InventoryItem.findByPk(id);
    if (!row) return res.status(404).json({ message: "Item not found" });

    const statusRaw = String(req.body?.status || "").trim().toLowerCase();
    if (!["active", "inactive"].includes(statusRaw)) {
      return res.status(400).json({ message: "status must be active or inactive" });
    }

    row.status = statusRaw;
    await row.save();

    return res.json({ message: "Item status updated", data: row });
  } catch (err) {
    console.error("inventory.patchItemStatus error:", err);
    return res.status(500).json({ message: "Failed to update item status" });
  }
};

exports.listRequisitions = async (req, res) => {
  try {
    ensureAssociations();
    const { page, limit, offset } = parsePagination(req);
    const where = buildRequisitionVisibilityWhere(req);
    const q = String(req.query.q || "").trim();
    const status = normalizeHeaderStatus(req.query.status);

    if (q) {
      where.requisition_no = { [Op.like]: `%${q}%` };
    }
    if (status) {
      where.status = status;
    }

    if (req.query.month) {
      const month = toSafeInt(req.query.month, null);
      if (month && month >= 1 && month <= 12) where.month = month;
    }
    if (req.query.year) {
      const year = toSafeInt(req.query.year, null);
      if (year && year >= 2000 && year <= 2100) where.year = year;
    }
    if (req.query.section_id) {
      const sectionId = toPositiveInt(req.query.section_id);
      if (sectionId) where.section_id = sectionId;
    }

    const { rows, count } = await InventoryRequisition.findAndCountAll({
      where,
      include: [
        { model: Section, as: "section", attributes: ["id", "name"], required: false },
        { model: User, as: "requester", attributes: ["id", "name", "username"], required: false },
        {
          model: InventoryRequisitionItem,
          as: "items",
          attributes: ["id", "requested_qty", "approved_qty", "issued_qty", "line_status"],
          required: false,
        },
      ],
      distinct: true,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    const data = rows
      .map(normalizeRequisitionRow)
      .filter((row) => canViewRequisition(req, row))
      .map((row) => ({
        ...row,
        can_submit:
          row.status === "Draft" &&
          hasInventoryPermission(req.user, INVENTORY_PERMISSIONS.inventory_request_create) &&
          canEditDraft(req, row),
        can_forward:
          row.status === "Submitted" &&
          hasInventoryPermission(req.user, INVENTORY_PERMISSIONS.inventory_request_forward),
        can_approve:
          row.status === "Forwarded" &&
          hasInventoryPermission(req.user, INVENTORY_PERMISSIONS.inventory_request_approve),
        can_issue:
          ["Approved", "Partially Approved", "Issued"].includes(row.status) &&
          hasInventoryPermission(req.user, INVENTORY_PERMISSIONS.inventory_issue),
      }));

    return res.json({
      data,
      total: count,
      page,
      limit,
    });
  } catch (err) {
    console.error("inventory.listRequisitions error:", err);
    return res.status(500).json({ message: "Failed to load requisitions" });
  }
};

exports.getRequisitionById = async (req, res) => {
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid requisition id" });

    const row = await findRequisitionWithDetails(id);
    if (!row) return res.status(404).json({ message: "Requisition not found" });

    const data = normalizeRequisitionRow(row);
    if (!canViewRequisition(req, data)) return res.status(403).json({ message: "Forbidden" });

    return res.json({
      data: {
        ...data,
        can_edit_draft:
          data.status === "Draft" &&
          hasInventoryPermission(req.user, INVENTORY_PERMISSIONS.inventory_request_create) &&
          canEditDraft(req, data),
      },
    });
  } catch (err) {
    console.error("inventory.getRequisitionById error:", err);
    return res.status(500).json({ message: "Failed to load requisition" });
  }
};

exports.createRequisition = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const actorId = getActorUserId(req);
    const role = normalizeRole(req.user?.role);
    const sectionIdFromUser = getUserSectionId(req);
    const monthYear = toMonthYear(req.body?.month, req.body?.year);

    if (!actorId) {
      await t.rollback();
      return res.status(401).json({ message: "Unauthorized" });
    }
    if (!monthYear) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid month/year" });
    }

    let sectionId = toPositiveInt(req.body?.section_id);
    if (role === "general") {
      if (!sectionIdFromUser) {
        await t.rollback();
        return res.status(403).json({ message: "Your account is not assigned to any section" });
      }
      sectionId = sectionIdFromUser;
    }
    if (!sectionId) {
      await t.rollback();
      return res.status(400).json({ message: "section_id is required" });
    }

    const section = await Section.findByPk(sectionId, { transaction: t });
    if (!section) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid section_id" });
    }

    const lineValidation = await validateLineItemsForRequest(req.body?.items, t);
    if (!lineValidation.ok) {
      await t.rollback();
      return res.status(400).json({ message: lineValidation.message });
    }

    const requisitionNo = await generateRequisitionNo({
      month: monthYear.month,
      year: monthYear.year,
      transaction: t,
    });

    const requisition = await InventoryRequisition.create(
      {
        requisition_no: requisitionNo,
        section_id: sectionId,
        month: monthYear.month,
        year: monthYear.year,
        created_by: actorId,
        requested_by: actorId,
        status: "Draft",
        remarks: cleanText(req.body?.remarks, 1000),
      },
      { transaction: t }
    );

    await InventoryRequisitionItem.bulkCreate(
      lineValidation.lines.map((line) => ({
        requisition_id: requisition.id,
        item_id: line.item_id,
        requested_qty: line.requested_qty,
        approved_qty: 0,
        issued_qty: 0,
        remarks: line.remarks,
        line_status: "Pending",
      })),
      { transaction: t }
    );

    await t.commit();
    const out = await findRequisitionWithDetails(requisition.id);
    return res
      .status(201)
      .json({ message: "Draft requisition created", data: normalizeRequisitionRow(out) });
  } catch (err) {
    await t.rollback();
    console.error("inventory.createRequisition error:", err);
    return res.status(500).json({ message: "Failed to create requisition" });
  }
};

exports.updateRequisition = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid requisition id" });
    }

    const requisition = await InventoryRequisition.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!requisition) {
      await t.rollback();
      return res.status(404).json({ message: "Requisition not found" });
    }
    if (requisition.status !== "Draft") {
      await t.rollback();
      return res.status(400).json({ message: "Only Draft requisition can be edited" });
    }
    if (!canEditDraft(req, requisition)) {
      await t.rollback();
      return res.status(403).json({ message: "Forbidden" });
    }

    const role = normalizeRole(req.user?.role);
    const sectionIdFromUser = getUserSectionId(req);
    let sectionId = toPositiveInt(req.body?.section_id) || toPositiveInt(requisition.section_id);

    if (role === "general") {
      if (!sectionIdFromUser) {
        await t.rollback();
        return res.status(403).json({ message: "Your account is not assigned to any section" });
      }
      sectionId = sectionIdFromUser;
    }

    if (!sectionId) {
      await t.rollback();
      return res.status(400).json({ message: "section_id is required" });
    }

    const section = await Section.findByPk(sectionId, { transaction: t });
    if (!section) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid section_id" });
    }

    const monthYear = toMonthYear(
      req.body?.month ?? requisition.month,
      req.body?.year ?? requisition.year
    );
    if (!monthYear) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid month/year" });
    }

    requisition.section_id = sectionId;
    requisition.month = monthYear.month;
    requisition.year = monthYear.year;
    if (req.body?.remarks !== undefined) requisition.remarks = cleanText(req.body?.remarks, 1000);
    await requisition.save({ transaction: t });

    if (req.body?.items !== undefined) {
      const lineValidation = await validateLineItemsForRequest(req.body?.items, t);
      if (!lineValidation.ok) {
        await t.rollback();
        return res.status(400).json({ message: lineValidation.message });
      }

      await InventoryRequisitionItem.destroy({
        where: { requisition_id: requisition.id },
        transaction: t,
      });

      await InventoryRequisitionItem.bulkCreate(
        lineValidation.lines.map((line) => ({
          requisition_id: requisition.id,
          item_id: line.item_id,
          requested_qty: line.requested_qty,
          approved_qty: 0,
          issued_qty: 0,
          remarks: line.remarks,
          line_status: "Pending",
        })),
        { transaction: t }
      );
    }

    await t.commit();
    const out = await findRequisitionWithDetails(requisition.id);
    return res.json({ message: "Draft requisition updated", data: normalizeRequisitionRow(out) });
  } catch (err) {
    await t.rollback();
    console.error("inventory.updateRequisition error:", err);
    return res.status(500).json({ message: "Failed to update requisition" });
  }
};

exports.submitRequisition = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid requisition id" });
    }

    const requisition = await InventoryRequisition.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!requisition) {
      await t.rollback();
      return res.status(404).json({ message: "Requisition not found" });
    }
    if (requisition.status !== "Draft") {
      await t.rollback();
      return res.status(400).json({ message: "Only Draft requisition can be submitted" });
    }
    if (!canEditDraft(req, requisition)) {
      await t.rollback();
      return res.status(403).json({ message: "Forbidden" });
    }

    const count = await InventoryRequisitionItem.count({
      where: { requisition_id: requisition.id },
      transaction: t,
    });
    if (!count) {
      await t.rollback();
      return res.status(400).json({ message: "Add at least one item before submit" });
    }

    requisition.status = "Submitted";
    requisition.submitted_at = new Date();
    await requisition.save({ transaction: t });

    await t.commit();
    const out = await findRequisitionWithDetails(requisition.id);
    return res.json({ message: "Requisition submitted", data: normalizeRequisitionRow(out) });
  } catch (err) {
    await t.rollback();
    console.error("inventory.submitRequisition error:", err);
    return res.status(500).json({ message: "Failed to submit requisition" });
  }
};

exports.forwardRequisition = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid requisition id" });
    }

    const requisition = await InventoryRequisition.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!requisition) {
      await t.rollback();
      return res.status(404).json({ message: "Requisition not found" });
    }
    if (requisition.status !== "Submitted") {
      await t.rollback();
      return res.status(400).json({ message: "Only Submitted requisition can be forwarded" });
    }

    requisition.status = "Forwarded";
    requisition.forwarded_by = getActorUserId(req);
    requisition.forwarded_at = new Date();
    if (req.body?.remarks !== undefined) requisition.remarks = cleanText(req.body.remarks, 1000);
    await requisition.save({ transaction: t });

    await t.commit();
    const out = await findRequisitionWithDetails(requisition.id);
    return res.json({ message: "Requisition forwarded", data: normalizeRequisitionRow(out) });
  } catch (err) {
    await t.rollback();
    console.error("inventory.forwardRequisition error:", err);
    return res.status(500).json({ message: "Failed to forward requisition" });
  }
};

exports.approveRequisition = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid requisition id" });
    }

    const requisition = await InventoryRequisition.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!requisition) {
      await t.rollback();
      return res.status(404).json({ message: "Requisition not found" });
    }
    if (requisition.status !== "Forwarded") {
      await t.rollback();
      return res.status(400).json({ message: "Requisition must be Forwarded before approval" });
    }

    const lines = await InventoryRequisitionItem.findAll({
      where: { requisition_id: requisition.id },
      order: [["id", "ASC"]],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!lines.length) {
      await t.rollback();
      return res.status(400).json({ message: "No item rows found" });
    }

    const payloadLines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    const byLineId = new Map();
    const byItemId = new Map();
    payloadLines.forEach((line) => {
      const lineId = toPositiveInt(line?.id);
      const itemId = toPositiveInt(line?.item_id);
      if (lineId) byLineId.set(lineId, line);
      if (itemId) byItemId.set(itemId, line);
    });

    let hasApproved = false;
    let hasPartial = false;
    let hasRejected = false;

    for (const line of lines) {
      const requestedQty = toNumber(line.requested_qty);
      const incoming = byLineId.get(Number(line.id)) || byItemId.get(Number(line.item_id));
      const approvedQty =
        incoming && incoming.approved_qty !== undefined
          ? toQty(incoming.approved_qty)
          : Number(requestedQty.toFixed(2));

      if (approvedQty === null) {
        await t.rollback();
        return res.status(400).json({ message: "approved_qty must be a valid number" });
      }
      if (approvedQty > requestedQty) {
        await t.rollback();
        return res
          .status(400)
          .json({ message: "Approved quantity cannot exceed requested quantity" });
      }

      line.approved_qty = Number(approvedQty.toFixed(2));
      line.issued_qty = 0;
      if (incoming && incoming.remarks !== undefined) line.remarks = cleanText(incoming.remarks, 500);

      if (approvedQty <= 0) {
        line.line_status = "Rejected";
        hasRejected = true;
      } else if (approvedQty < requestedQty) {
        line.line_status = "Partially Approved";
        hasApproved = true;
        hasPartial = true;
      } else {
        line.line_status = "Approved";
        hasApproved = true;
      }

      await line.save({ transaction: t });
    }

    let finalStatus = "Rejected";
    if (hasApproved && !hasPartial && !hasRejected) finalStatus = "Approved";
    else if (hasApproved) finalStatus = "Partially Approved";

    requisition.status = finalStatus;
    requisition.approved_by = getActorUserId(req);
    requisition.approved_at = new Date();
    if (req.body?.remarks !== undefined) requisition.remarks = cleanText(req.body.remarks, 1000);
    await requisition.save({ transaction: t });

    await t.commit();
    const out = await findRequisitionWithDetails(requisition.id);
    let message = "Requisition approved";
    if (finalStatus === "Partially Approved") message = "Requisition partially approved";
    if (finalStatus === "Rejected") message = "Requisition rejected";

    return res.json({
      message,
      data: normalizeRequisitionRow(out),
    });
  } catch (err) {
    await t.rollback();
    console.error("inventory.approveRequisition error:", err);
    return res.status(500).json({ message: "Failed to approve requisition" });
  }
};

exports.rejectRequisition = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid requisition id" });
    }

    const requisition = await InventoryRequisition.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!requisition) {
      await t.rollback();
      return res.status(404).json({ message: "Requisition not found" });
    }
    if (requisition.status !== "Forwarded") {
      await t.rollback();
      return res.status(400).json({ message: "Only Forwarded requisition can be rejected" });
    }

    const lines = await InventoryRequisitionItem.findAll({
      where: { requisition_id: requisition.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    for (const line of lines) {
      line.approved_qty = 0;
      line.issued_qty = 0;
      line.line_status = "Rejected";
      if (req.body?.remarks !== undefined) line.remarks = cleanText(req.body.remarks, 500);
      await line.save({ transaction: t });
    }

    requisition.status = "Rejected";
    requisition.approved_by = getActorUserId(req);
    requisition.approved_at = new Date();
    if (req.body?.remarks !== undefined) requisition.remarks = cleanText(req.body.remarks, 1000);
    await requisition.save({ transaction: t });

    await t.commit();
    const out = await findRequisitionWithDetails(requisition.id);
    return res.json({ message: "Requisition rejected", data: normalizeRequisitionRow(out) });
  } catch (err) {
    await t.rollback();
    console.error("inventory.rejectRequisition error:", err);
    return res.status(500).json({ message: "Failed to reject requisition" });
  }
};

exports.issueRequisition = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const id = toPositiveInt(req.params.id);
    if (!id) {
      await t.rollback();
      return res.status(400).json({ message: "Invalid requisition id" });
    }

    const requisition = await InventoryRequisition.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!requisition) {
      await t.rollback();
      return res.status(404).json({ message: "Requisition not found" });
    }
    if (!["Approved", "Partially Approved", "Issued"].includes(requisition.status)) {
      await t.rollback();
      return res
        .status(400)
        .json({ message: "Only Approved/Partially Approved requisition can be issued" });
    }

    const lines = await InventoryRequisitionItem.findAll({
      where: { requisition_id: requisition.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
      order: [["id", "ASC"]],
    });
    if (!lines.length) {
      await t.rollback();
      return res.status(400).json({ message: "No item rows found" });
    }

    const issueableLines = lines.filter((line) => {
      const approvedQty = toNumber(line.approved_qty);
      const issuedQty = toNumber(line.issued_qty);
      return (
        ["Approved", "Partially Approved", "Issued"].includes(line.line_status) &&
        approvedQty > issuedQty
      );
    });
    if (!issueableLines.length) {
      await t.rollback();
      return res.status(400).json({ message: "No approved quantity left to issue" });
    }

    const items = await InventoryItem.findAll({
      where: { id: issueableLines.map((x) => x.item_id) },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const itemMap = new Map(items.map((item) => [Number(item.id), item]));

    const payloadLines = Array.isArray(req.body?.lines) ? req.body.lines : [];
    const byLineId = new Map();
    const byItemId = new Map();
    payloadLines.forEach((line) => {
      const lineId = toPositiveInt(line?.id);
      const itemId = toPositiveInt(line?.item_id);
      if (lineId) byLineId.set(lineId, line);
      if (itemId) byItemId.set(itemId, line);
    });

    const actorId = getActorUserId(req);
    let issuedAny = false;

    for (const line of issueableLines) {
      const approvedQty = toNumber(line.approved_qty);
      const issuedQty = toNumber(line.issued_qty);
      const remainingApproved = Number((approvedQty - issuedQty).toFixed(2));

      const incoming = byLineId.get(Number(line.id)) || byItemId.get(Number(line.item_id));
      let issueQty = remainingApproved;

      if (payloadLines.length) {
        if (!incoming) continue;
        const parsedIssueQty = toQty(incoming.issued_qty);
        if (parsedIssueQty === null) {
          await t.rollback();
          return res.status(400).json({ message: "issued_qty must be a valid number" });
        }
        issueQty = parsedIssueQty;
      }

      if (issueQty <= 0) continue;
      if (issueQty > remainingApproved) {
        await t.rollback();
        return res.status(400).json({ message: "Issued quantity cannot exceed approved quantity" });
      }

      const item = itemMap.get(Number(line.item_id));
      if (!item) {
        await t.rollback();
        return res.status(400).json({ message: "Linked inventory item not found" });
      }
      const currentStock = toNumber(item.current_stock);
      if (issueQty > currentStock) {
        await t.rollback();
        return res.status(400).json({
          message: `Insufficient stock for item ${item.item_name || item.item_code || item.id}`,
        });
      }

      const nextStock = Number((currentStock - issueQty).toFixed(2));
      item.current_stock = nextStock;
      await item.save({ transaction: t });

      const nextIssuedQty = Number((issuedQty + issueQty).toFixed(2));
      line.issued_qty = nextIssuedQty;
      if (nextIssuedQty >= approvedQty - 0.0001) {
        line.issued_qty = Number(approvedQty.toFixed(2));
        line.line_status = "Issued";
      } else if (approvedQty < toNumber(line.requested_qty)) {
        line.line_status = "Partially Approved";
      } else {
        line.line_status = "Approved";
      }
      await line.save({ transaction: t });

      await writeInventoryTransaction({
        itemId: Number(item.id),
        transactionType: "issue",
        qty: issueQty,
        balanceAfter: nextStock,
        referenceType: "requisition",
        referenceId: requisition.id,
        sectionId: requisition.section_id,
        remarks: incoming?.remarks || req.body?.remarks || `Issued against ${requisition.requisition_no}`,
        doneBy: actorId,
        transaction: t,
      });

      issuedAny = true;
    }

    if (!issuedAny) {
      await t.rollback();
      return res.status(400).json({ message: "No issue quantity provided" });
    }

    const finalLines = await InventoryRequisitionItem.findAll({
      where: { requisition_id: requisition.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const approvedLines = finalLines.filter((line) => toNumber(line.approved_qty) > 0);
    const allIssued =
      approvedLines.length > 0 &&
      approvedLines.every((line) => toNumber(line.issued_qty) >= toNumber(line.approved_qty));

    if (allIssued) {
      requisition.status = "Issued";
    }
    requisition.issued_by = actorId;
    requisition.issued_at = new Date();
    if (req.body?.remarks !== undefined) requisition.remarks = cleanText(req.body.remarks, 1000);
    await requisition.save({ transaction: t });

    await t.commit();
    const out = await findRequisitionWithDetails(requisition.id);
    return res.json({ message: "Items issued successfully", data: normalizeRequisitionRow(out) });
  } catch (err) {
    await t.rollback();
    console.error("inventory.issueRequisition error:", err);
    return res.status(500).json({ message: "Failed to issue items" });
  }
};

exports.listTransactions = async (req, res) => {
  try {
    ensureAssociations();
    const { page, limit, offset } = parsePagination(req);
    const where = {};

    const itemId = toPositiveInt(req.query.item_id);
    const sectionId = toPositiveInt(req.query.section_id);
    const type = String(req.query.transaction_type || "").trim();
    const from = String(req.query.from || "").trim();
    const to = String(req.query.to || "").trim();

    if (itemId) where.item_id = itemId;
    if (sectionId) where.section_id = sectionId;
    if (type) where.transaction_type = type;
    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt[Op.gte] = new Date(`${from}T00:00:00`);
      if (to) where.createdAt[Op.lte] = new Date(`${to}T23:59:59`);
    }

    const { rows, count } = await InventoryTransaction.findAndCountAll({
      where,
      include: [
        {
          model: InventoryItem,
          as: "item",
          attributes: ["id", "item_code", "item_name"],
          required: false,
        },
        { model: Section, as: "section", attributes: ["id", "name"], required: false },
        { model: User, as: "doneBy", attributes: ["id", "name", "username"], required: false },
      ],
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      limit,
      offset,
    });

    return res.json({
      data: rows,
      total: count,
      page,
      limit,
    });
  } catch (err) {
    console.error("inventory.listTransactions error:", err);
    return res.status(500).json({ message: "Failed to load inventory transactions" });
  }
};

exports.stockSummary = async (req, res) => {
  try {
    const { page, limit, offset } = parsePagination(req, 25);
    const where = {};
    const q = String(req.query.q || "").trim();
    const status = String(req.query.status || "").trim().toLowerCase();

    if (status && status !== "all") {
      where.status = status === "inactive" ? "inactive" : "active";
    }
    if (q) {
      where[Op.or] = [
        { item_code: { [Op.like]: `%${q}%` } },
        { item_name: { [Op.like]: `%${q}%` } },
        { category: { [Op.like]: `%${q}%` } },
      ];
    }

    const { rows, count } = await InventoryItem.findAndCountAll({
      where,
      order: [["item_name", "ASC"]],
      limit,
      offset,
    });

    const data = rows.map((row) => {
      const item = row.toJSON();
      const currentStock = toNumber(item.current_stock);
      const minimumStock = toNumber(item.minimum_stock);
      return {
        ...item,
        current_stock: Number(currentStock.toFixed(2)),
        minimum_stock: Number(minimumStock.toFixed(2)),
        is_low_stock: currentStock <= minimumStock,
      };
    });

    return res.json({ data, total: count, page, limit });
  } catch (err) {
    console.error("inventory.stockSummary error:", err);
    return res.status(500).json({ message: "Failed to load stock summary" });
  }
};

exports.monthlyReport = async (req, res) => {
  try {
    ensureAssociations();
    const monthYear = toMonthYear(req.query.month, req.query.year);
    if (!monthYear) return res.status(400).json({ message: "Invalid month/year" });

    const rows = await InventoryRequisition.findAll({
      where: { month: monthYear.month, year: monthYear.year },
      include: [
        { model: Section, as: "section", attributes: ["id", "name"], required: false },
        {
          model: InventoryRequisitionItem,
          as: "items",
          attributes: ["requested_qty", "approved_qty", "issued_qty"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const status_counts = {};
    const sectionMap = new Map();
    const totals = { requested_qty: 0, approved_qty: 0, issued_qty: 0 };

    rows.forEach((row) => {
      const requisition = row.toJSON();
      status_counts[requisition.status] = (status_counts[requisition.status] || 0) + 1;
      const sectionId = Number(requisition.section_id || 0);
      const sectionName = requisition.section?.name || `Section #${sectionId || "-"}`;

      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, {
          section_id: sectionId || null,
          section_name: sectionName,
          requisitions: 0,
          requested_qty: 0,
          approved_qty: 0,
          issued_qty: 0,
        });
      }
      const sectionEntry = sectionMap.get(sectionId);
      sectionEntry.requisitions += 1;

      const lines = Array.isArray(requisition.items) ? requisition.items : [];
      lines.forEach((line) => {
        const requested = toNumber(line.requested_qty);
        const approved = toNumber(line.approved_qty);
        const issued = toNumber(line.issued_qty);

        sectionEntry.requested_qty += requested;
        sectionEntry.approved_qty += approved;
        sectionEntry.issued_qty += issued;

        totals.requested_qty += requested;
        totals.approved_qty += approved;
        totals.issued_qty += issued;
      });
    });

    const section_summary = Array.from(sectionMap.values()).map((s) => ({
      ...s,
      requested_qty: Number(s.requested_qty.toFixed(2)),
      approved_qty: Number(s.approved_qty.toFixed(2)),
      issued_qty: Number(s.issued_qty.toFixed(2)),
    }));

    return res.json({
      month: monthYear.month,
      year: monthYear.year,
      total_requisitions: rows.length,
      status_counts,
      totals: {
        requested_qty: Number(totals.requested_qty.toFixed(2)),
        approved_qty: Number(totals.approved_qty.toFixed(2)),
        issued_qty: Number(totals.issued_qty.toFixed(2)),
      },
      section_summary,
    });
  } catch (err) {
    console.error("inventory.monthlyReport error:", err);
    return res.status(500).json({ message: "Failed to load monthly report" });
  }
};

exports.sectionWiseReport = async (req, res) => {
  try {
    ensureAssociations();
    const where = {};
    if (req.query.year) {
      const year = toSafeInt(req.query.year, null);
      if (!year || year < 2000 || year > 2100) {
        return res.status(400).json({ message: "Invalid year" });
      }
      where.year = year;
    }
    if (req.query.month) {
      const month = toSafeInt(req.query.month, null);
      if (!month || month < 1 || month > 12) {
        return res.status(400).json({ message: "Invalid month" });
      }
      where.month = month;
    }

    const rows = await InventoryRequisition.findAll({
      where,
      include: [
        { model: Section, as: "section", attributes: ["id", "name"], required: false },
        {
          model: InventoryRequisitionItem,
          as: "items",
          attributes: ["requested_qty", "approved_qty", "issued_qty", "line_status"],
          required: false,
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    const sectionMap = new Map();

    rows.forEach((row) => {
      const requisition = row.toJSON();
      const sectionId = Number(requisition.section_id || 0);
      const sectionName = requisition.section?.name || `Section #${sectionId || "-"}`;

      if (!sectionMap.has(sectionId)) {
        sectionMap.set(sectionId, {
          section_id: sectionId || null,
          section_name: sectionName,
          requisitions: 0,
          requested_qty: 0,
          approved_qty: 0,
          issued_qty: 0,
          statuses: {},
        });
      }

      const sectionEntry = sectionMap.get(sectionId);
      sectionEntry.requisitions += 1;
      sectionEntry.statuses[requisition.status] = (sectionEntry.statuses[requisition.status] || 0) + 1;

      const lines = Array.isArray(requisition.items) ? requisition.items : [];
      lines.forEach((line) => {
        sectionEntry.requested_qty += toNumber(line.requested_qty);
        sectionEntry.approved_qty += toNumber(line.approved_qty);
        sectionEntry.issued_qty += toNumber(line.issued_qty);
      });
    });

    const sections = Array.from(sectionMap.values()).map((row) => ({
      ...row,
      requested_qty: Number(row.requested_qty.toFixed(2)),
      approved_qty: Number(row.approved_qty.toFixed(2)),
      issued_qty: Number(row.issued_qty.toFixed(2)),
    }));

    return res.json({
      total_sections: sections.length,
      total_requisitions: rows.length,
      sections,
    });
  } catch (err) {
    console.error("inventory.sectionWiseReport error:", err);
    return res.status(500).json({ message: "Failed to load section-wise report" });
  }
};
