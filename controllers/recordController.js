const { Op } = require("sequelize");
const Record = require("../models/recordModel");
const Section = require("../models/sectionModel");
const Subcategory = require("../models/subcategoryModel");
const Rack = require("../models/rackModel");
const sequelize = require("../config/db"); 

// helper: normalize BD
const normalizeBd = (v) => (typeof v === "string" ? v.trim() : v);

// helper: pick actor username safely
function getActor(req, fallbackFromBody) {
  return (
    req.user?.username ||
    req.user?.name ||
    req.user?.email ||
    fallbackFromBody ||
    "Unknown User"
  );
}

async function resolveAuditAccess(req, res) {
  const role = String(req.user?.role || "").toLowerCase();
  if (!["admin", "master", "general"].includes(role)) {
    res.status(403).json({ error: "You do not have access to this module." });
    return null;
  }

  let userSectionId = null;
  if (role === "general") {
    userSectionId = Number(req.user?.section_id || 0);
    if (!userSectionId) {
      res.status(403).json({ error: "Your account is not assigned to any section." });
      return null;
    }
  }

  return { role, userSectionId };
}

// ================== ADD NEW RECORD ==================
exports.addRecord = async (req, res) => {
  try {
    let {
      file_name,
      bd_no,
      section_id,
      subcategory_id,
      rack_id,
      description,
      opening_date,
      record_status,
      closing_date,
      added_by,
      serial_no,
      allocate_table, // ✅ new
    } = req.body;

    bd_no = normalizeBd(bd_no);
    file_name = file_name?.trim();

    if (!file_name || !section_id || !rack_id) {
      return res
        .status(400)
        .json({ error: "File name, Section, and Rack are required" });
    }

    if (!subcategory_id) {
      return res.status(400).json({ error: "Subcategory is required" });
    }
    if (!bd_no) {
      return res.status(400).json({ error: "BD No is required" });
    }

    // ✅ Opening date required (manual)
    if (!opening_date) {
      return res.status(400).json({ error: "Opening Date is required" });
    }

    // ✅ Current Status (manual) defaults to ongoing
    const allowedStatuses = ["ongoing", "closed"];
    record_status = (record_status || "ongoing").toString().toLowerCase().trim();
    if (!allowedStatuses.includes(record_status)) record_status = "ongoing";

    // ✅ Closing date rule: only required when status is closed
    if (record_status === "closed" && !closing_date) {
      return res
        .status(400)
        .json({ error: "Closing Date is required when status is Closed" });
    }
    if (record_status !== "closed") {
      closing_date = null;
    }

    // ✅ Basic date sanity (DATEONLY strings)
    const today = new Date().toISOString().slice(0, 10);
    if (opening_date > today) {
      return res
        .status(400)
        .json({ error: "Opening Date cannot be in the future" });
    }
    if (closing_date && closing_date > today) {
      return res
        .status(400)
        .json({ error: "Closing Date cannot be in the future" });
    }
    if (closing_date && closing_date < opening_date) {
      return res.status(400).json({
        error: "Closing Date cannot be before Opening Date",
      });
    }

    // cast ids to int (safe)
    section_id = parseInt(section_id, 10);
    subcategory_id = parseInt(subcategory_id, 10);
    rack_id = parseInt(rack_id, 10);

    // ✅ Role scope: General users can only add to their assigned section
    const role = (req.user?.role || "").toLowerCase();
    const userSectionId = req.user?.section_id;
    if (role === "general") {
      if (!userSectionId) {
        return res.status(403).json({ error: "Your account is not assigned to any section" });
      }
      if (String(section_id) !== String(userSectionId)) {
        return res.status(403).json({ error: "You can only add records in your assigned section" });
      }
    }

    // ✅ Section-based rule: OP-1/OP-2 => allocate_table required
    const sec = await Section.findByPk(section_id);
    const secName = (sec?.name || "").toLowerCase();
    const isOP =
      secName === "officers pay (op-1)" || secName === "officers pay (op-2)";

    if (isOP) {
      if (!allocate_table || String(allocate_table).trim() === "") {
        return res.status(400).json({
          error: "Allocate Table is required for Officers Pay sections",
        });
      }
      allocate_table = String(allocate_table).trim();
    } else {
      allocate_table = null;
    }

    const isLALAO = (secName || "").trim().toLowerCase().replace(/\s+/g, "") === "la/lao";

    const audit_objection_raw = req.body.audit_objection;
    const audit_objection =
      String(audit_objection_raw || "").toLowerCase() === "true" ||
      String(audit_objection_raw || "").toLowerCase() === "yes" ||
      String(audit_objection_raw || "").toLowerCase() === "1";

    const objection_no = (req.body.objection_no || "").trim();
    const objection_title = (req.body.objection_title || "").trim();
    const objection_details = (req.body.objection_details || "").trim();

    const f = req.file;
    // ✅ LA&LAO + Audit Objection = Yes => required fields + required attachment
    if (isLALAO && audit_objection) {
      if (!objection_no) return res.status(400).json({ error: "Objection number is required" });
      if (!objection_title) return res.status(400).json({ error: "Objection title is required" });
      if (!objection_details) return res.status(400).json({ error: "Objection details is required" });
      if (!f) return res.status(400).json({ error: "Attachment file is required for audit objection" });
    }

    // 🧮 Auto serial
    let finalSerial = serial_no ? parseInt(serial_no, 10) : null;
    if (!finalSerial) {
      const lastRecord = await Record.findOne({
        where: { rack_id },
        order: [["serial_no", "DESC"]],
      });
      finalSerial = (lastRecord?.serial_no || 0) + 1;
    }

    // ✅ BD No unique check (same subcategory)
    // Rule: LA/LAO + Audit Objection = YES → same BD allowed
    if (!(isLALAO && audit_objection)) {
      const bdExists = await Record.findOne({
        where: { subcategory_id, bd_no },
      });

      if (bdExists) {
        return res.status(400).json({
          error: `BD No. ${bd_no} already exists in this subcategory`,
        });
      }
    }

    // 🛑 Duplicate check (serial in same rack)
    const exists = await Record.findOne({
      where: { rack_id, serial_no: finalSerial },
    });
    if (exists) {
      return res.status(400).json({
        error: `Serial No. ${finalSerial} already exists in this rack`,
      });
    }

    // ✅ Prevent exact duplicate (same subcategory + bd_no + file_name)
    const dup = await Record.findOne({
      where: { subcategory_id, bd_no, file_name },
    });
    if (dup) {
      return res.status(409).json({
        error: "Duplicate record: একই Subcategory + BD No + File Name আগেই আছে",
      });
    }

    const actor = getActor(req, added_by);

    const record = await Record.create({
      file_name,
      bd_no,
      section_id,
      subcategory_id,
      rack_id,
      description,
      opening_date,
      record_status,
      closing_date,
      allocate_table,
      serial_no: finalSerial,
      status: "active",
      added_by: actor,
      audit_objection,
      objection_no: audit_objection ? objection_no : null,
      objection_title: audit_objection ? objection_title : null,
      objection_details: audit_objection ? objection_details : null,

      attachment_path: f ? `/uploads/records/${f.filename}` : null,
      attachment_name: f ? f.originalname : null,
      attachment_mime: f ? f.mimetype : null,
      attachment_size: f ? f.size : null,
    });

    res.json({ message: "✅ Record added successfully", record });
  } catch (err) {
    console.error("❌ addRecord error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== GET ALL RECORDS (with pagination + filter + rack search) ==================
exports.getRecords = async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    const sectionFilter = req.query.section || "";
    const rackFilter = req.query.rack || "";

    const role = (req.user?.role || "").toLowerCase();
    const userSectionId = req.user?.section_id;

    const recordStatusFilter = (req.query.record_status || "")
      .toString()
      .trim()
      .toLowerCase();

    const mine = (req.query.mine || "").toString().trim();

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    const allowedRS = ["ongoing", "closed"];
    const rs = allowedRS.includes(recordStatusFilter) ? recordStatusFilter : "";

    const actor = getActor(req, "");

    /* ---------- BASE WHERE ---------- */
    const whereClause = {
      ...(q && {
        [Op.or]: [
          { file_name: { [Op.like]: `%${q}%` } },
          { bd_no: { [Op.like]: `%${q}%` } },
          { description: { [Op.like]: `%${q}%` } },
          { moved_by: { [Op.like]: `%${q}%` } },
          { serial_no: { [Op.like]: `%${q}%` } },
          { "$Rack.name$": { [Op.like]: `%${q}%` } },
        ],
      }),

      ...(rackFilter && { rack_id: rackFilter }),
      ...(rs && { record_status: rs }),
      ...(mine === "1" && actor && { added_by: actor }),
    };

    /* ---------- ROLE LOGIC ---------- */
    if (role === "general") {
      if (!userSectionId) {
        return res.json({ data: [], page, totalPages: 1, total: 0 });
      }

      // ✅ assigned section + own-section-origin central
      whereClause[Op.and] = [
        {
          [Op.or]: [
            { section_id: userSectionId }, // normal
            {
              status: "central",
              previous_section_id: userSectionId, // moved to central
            },
          ],
        },
      ];
    } else {
      // Admin / Master
      if (sectionFilter) {
        whereClause.section_id = sectionFilter;
      }
    }

    const { rows: records, count: total } = await Record.findAndCountAll({
      where: whereClause,
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
      order: [["createdAt", "DESC"]],
      limit,
      offset,
    });

    res.json({
      data: records,
      page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    console.error("❌ getRecords error:", err);
    res.status(500).json({ error: "Failed to fetch records" });
  }
};

// ================== LOOKUP RECORDS (Topbar global search) ==================
// উদ্দেশ্য: BD No বা File Name দিয়ে দ্রুত record টা কোথায় আছে (Section/Central) দেখানো
// Returns: up to 8 matches (most recently updated first)
exports.lookupRecords = async (req, res) => {
  try {
    const qRaw = req.query.q || "";
    const q = qRaw.toString().trim();
    if (!q) return res.json([]);

    const role = (req.user?.role || "").toLowerCase();
    const userSectionId = req.user?.section_id;

    const searchWhere = {
      [Op.or]: [
        { bd_no: { [Op.like]: `%${q}%` } },
        { file_name: { [Op.like]: `%${q}%` } },
      ],
    };

    let accessWhere = null;

    // ✅ General: only own section + own-origin central
    if (role === "general") {
      if (!userSectionId) return res.json([]);

      accessWhere = {
        [Op.or]: [
          // ✅ own section normal records (exclude central)
          {
            section_id: userSectionId,
            status: { [Op.ne]: "central" },
          },
          // ✅ central records only if originated from own section
          {
            status: "central",
            previous_section_id: userSectionId,
          },
        ],
      };
    }

    // ✅ FIX: combine without overwriting Op.or
    const finalWhere =
      role === "general" && accessWhere
        ? { [Op.and]: [searchWhere, accessWhere] }
        : searchWhere; // admin/master: see all

    const matches = await Record.findAll({
      where: finalWhere,
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
      order: [["updatedAt", "DESC"]],
      limit: 8,
    });

    // ✅ Batch fetch previous location names (no N+1)
    const prevSectionIds = [
      ...new Set(matches.map((r) => r.previous_section_id).filter(Boolean)),
    ];
    const prevSubIds = [
      ...new Set(matches.map((r) => r.previous_subcategory_id).filter(Boolean)),
    ];
    const prevRackIds = [
      ...new Set(matches.map((r) => r.previous_rack_id).filter(Boolean)),
    ];

    const [prevSections, prevSubs, prevRacks] = await Promise.all([
      prevSectionIds.length
        ? Section.findAll({
            where: { id: prevSectionIds },
            attributes: ["id", "name"],
          })
        : [],
      prevSubIds.length
        ? Subcategory.findAll({
            where: { id: prevSubIds },
            attributes: ["id", "name"],
          })
        : [],
      prevRackIds.length
        ? Rack.findAll({
            where: { id: prevRackIds },
            attributes: ["id", "name"],
          })
        : [],
    ]);

    const secMap = new Map(prevSections.map((s) => [s.id, s.name]));
    const subMap = new Map(prevSubs.map((s) => [s.id, s.name]));
    const rackMap = new Map(prevRacks.map((r) => [r.id, r.name]));

    const enhanced = matches.map((r) => {
      const prevLoc =
        r.previous_section_id || r.previous_subcategory_id || r.previous_rack_id
          ? {
              section_name: secMap.get(r.previous_section_id) || null,
              subcategory_name: subMap.get(r.previous_subcategory_id) || null,
              rack_name: rackMap.get(r.previous_rack_id) || null,
            }
          : {
              section_name: null,
              subcategory_name: null,
              rack_name: null,
            };

      return {
        id: r.id,
        bd_no: r.bd_no,
        file_name: r.file_name,
        record_status: r.record_status,
        status: r.status, // 'active' | 'central'
        serial_no: r.serial_no,
        section: r.Section ? { id: r.Section.id, name: r.Section.name } : null,
        subcategory: r.Subcategory
          ? { id: r.Subcategory.id, name: r.Subcategory.name }
          : null,
        rack: r.Rack ? { id: r.Rack.id, name: r.Rack.name } : null,
        previous_location: prevLoc,
        updatedAt: r.updatedAt,
      };
    });

    return res.json(enhanced);
  } catch (err) {
    console.error("❌ lookupRecords error:", err);
    return res.status(500).json({ error: err.message });
  }
};

// ================== MOVE SINGLE RECORD TO CENTRAL ==================
exports.moveToCentral = async (req, res) => {
  try {
    const id = req.params.id;
    let { newRackId, startSerialNo, moved_by } = req.body || {};

    const record = await Record.findByPk(id, {
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
    });

    if (!record) return res.status(404).json({ error: "Record not found" });

    // ✅ Role scope: General users are not allowed to move to Central (route already blocks, extra safety)
    const role = (req.user?.role || "").toLowerCase();
    const userSectionId = req.user?.section_id;
    if (role === "general") {
      if (!userSectionId) {
        return res.status(403).json({ error: "Your account is not assigned to any section" });
      }
      if (String(record.section_id) !== String(userSectionId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (String(record.status).toLowerCase() === "central") {
        return res.status(403).json({ error: "Forbidden" });
      }
    }
    if (record.status === "central")
      return res.status(400).json({ error: "Already moved to central" });
    if (!newRackId)
      return res.status(400).json({ error: "Target rack (newRackId) is required" });

    const targetRack = await Rack.findByPk(newRackId);
    if (!targetRack) return res.status(400).json({ error: "Target rack not found" });

    const oldSectionId = record.section_id;
    const oldRackId = record.rack_id;
    const oldSubId = record.subcategory_id;

    const oldSection = await Section.findByPk(oldSectionId);
    const oldRack = await Rack.findByPk(oldRackId);
    const oldSub = await Subcategory.findByPk(oldSubId);

    record.previous_section_id = oldSectionId;
    record.previous_subcategory_id = oldSubId;
    record.previous_rack_id = oldRackId;

    let serial;
    if (!startSerialNo || startSerialNo === "auto") {
      const maxSerial = await Record.max("serial_no", { where: { rack_id: newRackId } });
      serial = (Number.isFinite(maxSerial) ? maxSerial : 0) + 1;
    } else {
      serial = parseInt(startSerialNo, 10);
      const exists = await Record.findOne({
        where: { rack_id: newRackId, serial_no: serial },
      });
      if (exists)
        return res.status(409).json({ error: `Serial ${serial} already exists in target rack` });
    }

    const centralSection = await Section.findOne({ where: { name: "Central Room" } });
    record.section_id = centralSection ? centralSection.id : record.section_id;
    record.rack_id = newRackId;
    record.serial_no = serial;
    record.status = "central";

    // ✅ fixed moved_by
    record.moved_by = getActor(req, moved_by);

    await record.save();

    res.json({
      message: "✅ Record moved to Central successfully",
      record,
      previous_location: {
        section_name: oldSection ? oldSection.name : "(unknown section)",
        subcategory_name: oldSub ? oldSub.name : "(unknown subcategory)",
        rack_name: oldRack ? oldRack.name : "(unknown rack)",
      },
    });
  } catch (err) {
    console.error("❌ moveToCentral error:", err);
    res.status(500).json({ error: err.message || "Failed to move record" });
  }
};

// ================== GET CENTRAL RECORDS ==================
exports.getCentralRecords = async (req, res) => {
  try {
    const role = (req.user?.role || "").toLowerCase();
    const userSectionId = req.user?.section_id;

    const q = (req.query.q || "").trim();

    const whereClause = {
      status: "central",
      ...(q && {
        [Op.or]: [
          { file_name: { [Op.like]: `%${q}%` } },
          { bd_no: { [Op.like]: `%${q}%` } },
          { description: { [Op.like]: `%${q}%` } },
          { moved_by: { [Op.like]: `%${q}%` } },
          { serial_no: { [Op.like]: `%${q}%` } },
        ],
      }),
    };

    if (role === "general") {
      if (!userSectionId) return res.json({ data: [] });
      // ✅ ONLY own section-origin central
      whereClause.previous_section_id = userSectionId;
    }

    const records = await Record.findAll({
      where: whereClause,
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
      order: [["updatedAt", "DESC"]],
    });

    // ✅ Attach previous location names for modal/UI
    const prevSectionIds = [...new Set(records.map(r => r.previous_section_id).filter(Boolean))];
    const prevSubIds     = [...new Set(records.map(r => r.previous_subcategory_id).filter(Boolean))];
    const prevRackIds    = [...new Set(records.map(r => r.previous_rack_id).filter(Boolean))];

    const [prevSections, prevSubs, prevRacks] = await Promise.all([
      prevSectionIds.length
        ? Section.findAll({ where: { id: prevSectionIds }, attributes: ["id", "name"] })
        : [],
      prevSubIds.length
        ? Subcategory.findAll({ where: { id: prevSubIds }, attributes: ["id", "name"] })
        : [],
      prevRackIds.length
        ? Rack.findAll({ where: { id: prevRackIds }, attributes: ["id", "name"] })
        : [],
    ]);

    const secMap  = new Map(prevSections.map(s => [s.id, s.name]));
    const subMap  = new Map(prevSubs.map(s => [s.id, s.name]));
    const rackMap = new Map(prevRacks.map(r => [r.id, r.name]));

    const enriched = records.map(r => {
      r.dataValues.previous_location = {
        section_name:     secMap.get(r.previous_section_id) || "-",
        subcategory_name: subMap.get(r.previous_subcategory_id) || "-",
        rack_name:        rackMap.get(r.previous_rack_id) || "-",
      };
      return r;
    });

    return res.json({ data: enriched }); // ✅ only one response
  } catch (err) {
    console.error("❌ getCentralRecords error:", err);
    return res.status(500).json({ error: "Failed to fetch central records" });
  }
};

// ================== BULK MOVE TO CENTRAL ==================
exports.bulkMoveRecords = async (req, res) => {
  console.log("📦 bulkMoveRecords called:", req.body);
  const t = await Record.sequelize.transaction();
  try {
    let { recordIds, newRackId, startSerialNo, moved_by } = req.body;

    if (!Array.isArray(recordIds) || recordIds.length === 0)
      return res.status(400).json({ error: "No records selected." });
    if (!newRackId) return res.status(400).json({ error: "Target rack is required." });

    newRackId = parseInt(newRackId, 10);
    let serial =
      !startSerialNo || startSerialNo === "auto" ? null : parseInt(startSerialNo, 10);

    const targetRack = await Rack.findByPk(newRackId, { transaction: t });
    if (!targetRack) {
      await t.rollback();
      return res.status(400).json({ error: "Target rack not found." });
    }

    const centralSection = await Section.findOne({
      where: { name: "Central Room" },
      transaction: t,
    });

    if (serial === null) {
      const maxSerial = await Record.max("serial_no", {
        where: { rack_id: newRackId },
        transaction: t,
      });
      serial = (Number.isFinite(maxSerial) ? maxSerial : 0) + 1;
    }

    let movedCount = 0;
    for (const id of recordIds) {
      const rec = await Record.findByPk(id, { transaction: t });
      if (!rec || rec.status === "central") continue;

      rec.previous_section_id = rec.section_id;
      rec.previous_subcategory_id = rec.subcategory_id;
      rec.previous_rack_id = rec.rack_id;

      rec.section_id = centralSection ? centralSection.id : rec.section_id;
      rec.rack_id = newRackId;
      rec.serial_no = serial++;
      rec.status = "central";

      // ✅ fixed moved_by
      rec.moved_by = getActor(req, moved_by);

      await rec.save({ transaction: t });
      movedCount++;
    }

    await t.commit();
    res.json({ message: `✅ ${movedCount} record(s) moved to Central.` });
  } catch (err) {
    await t.rollback();
    console.error("❌ bulkMoveRecords error:", err);
    res.status(500).json({ error: err.message || "Failed to move records." });
  }
};

// ================== UPDATE RECORD ==================
exports.updateRecord = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    let {
      file_name,
      bd_no,
      section_id,
      subcategory_id,
      rack_id,
      description,
      updated_by,
      allocate_table, // ✅ allow update if you want
    } = req.body;

    // normalize
    if (typeof bd_no === "string") bd_no = bd_no.trim();
    if (typeof file_name === "string") file_name = file_name.trim();

    const record = await Record.findByPk(id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    // ✅ Role scope: General users can only edit records in their assigned section (and not central)
    const role = (req.user?.role || "").toLowerCase();
    const userSectionId = req.user?.section_id;
    if (role === "general") {
      if (!userSectionId) {
        return res.status(403).json({ error: "Your account is not assigned to any section" });
      }
      if (String(record.section_id) !== String(userSectionId)) {
        return res.status(403).json({ error: "You can only edit records from your assigned section" });
      }
      if (String(record.status).toLowerCase() === "central") {
        return res.status(403).json({ error: "Central records cannot be edited by General users" });
      }
      // prevent changing section via request
      if (section_id && String(section_id) !== String(userSectionId)) {
        return res.status(403).json({ error: "You cannot change section" });
      }
    }

    // ✅ effective values (request না দিলে existing value ধরে নাও)
    const newBd = bd_no ?? record.bd_no;
    const newSub = parseInt(subcategory_id ?? record.subcategory_id, 10);

    // ✅ BD uniqueness check (same subcategory)
    if (newBd && newSub) {
      const exists = await Record.findOne({
        where: {
          bd_no: newBd,
          subcategory_id: newSub,
          id: { [Op.ne]: id },
        },
      });

      if (exists) {
        return res.status(400).json({
          error: `BD No. ${newBd} already exists in this subcategory`,
        });
      }
    }

    // apply updates
    record.file_name = file_name ?? record.file_name;
    record.bd_no = bd_no ?? record.bd_no;
    record.section_id = section_id ?? record.section_id;
    record.subcategory_id = subcategory_id ?? record.subcategory_id;
    record.rack_id = rack_id ?? record.rack_id;
    record.description = description ?? record.description;

    // allocate_table (optional)
    if (allocate_table !== undefined) {
      const v = String(allocate_table || "").trim();
      record.allocate_table = v ? v : null;
    }

    // ✅ fixed updated_by
    record.updated_by = getActor(req, updated_by);

    await record.save();
    res.json({ message: "✅ Record updated successfully", record });
  } catch (err) {
    console.error("❌ updateRecord error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== DELETE RECORD (Admin Only) ==================
exports.deleteRecord = async (req, res) => {
  try {
    const id = req.params.id;
    const userRole = (req.user?.role || req.body.role || "").toLowerCase(); // ✅ safe

    if (!["admin", "master"].includes(userRole)) {
      return res.status(403).json({ error: "Only admin or master can delete records" });
    }

    const record = await Record.findByPk(id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    await record.destroy();
    res.json({ message: "🗑️ Record deleted successfully" });
  } catch (err) {
    console.error("❌ deleteRecord error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== CHECK BD UNIQUE (LIVE) ==================
exports.checkBdUnique = async (req, res) => {
  try {
    const bd_no = normalizeBd(req.query.bd_no);
    const subcategory_id = parseInt(req.query.subcategory_id, 10);

    if (!bd_no || !subcategory_id) {
      return res.status(400).json({ error: "bd_no and subcategory_id are required" });
    }

    const exists = await Record.findOne({
      where: { bd_no, subcategory_id },
    });

    return res.json({ available: !exists });
  } catch (err) {
    console.error("❌ checkBdUnique error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== GET SINGLE RECORD (FOR PRINT) ==================
exports.getRecordForPrint = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ error: "Invalid record id" });

    const record = await Record.findByPk(id, {
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
    });

    if (!record) return res.status(404).json({ error: "Record not found" });

    // ✅ Role scope: General users can only print records from their assigned section (non-central)
    const role = (req.user?.role || "").toLowerCase();
    const userSectionId = req.user?.section_id;
    if (role === "general") {
      if (!userSectionId) {
        return res.status(403).json({ error: "Your account is not assigned to any section" });
      }
      if (String(record.section_id) !== String(userSectionId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (String(record.status).toLowerCase() === "central") {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    return res.json({ record });
  } catch (err) {
    console.error("❌ getRecordForPrint error:", err);
    return res.status(500).json({ error: err.message || "Server error" });
  }
};

// ================== UPDATE WORKFLOW STATUS (ONGOING/CLOSED) ==================
exports.updateWorkflowStatus = async (req, res) => {
  try {
    const id = req.params.id;
    let { record_status, closing_date } = req.body || {};

    record_status = String(record_status || "").toLowerCase().trim();

    if (!["ongoing", "closed"].includes(record_status)) {
      return res.status(400).json({ error: "Invalid record_status. Use ongoing/closed" });
    }

    const record = await Record.findByPk(id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    // ✅ Role scope: General users can only update workflow for their assigned section records (non-central)
    const role = (req.user?.role || "").toLowerCase();
    const userSectionId = req.user?.section_id;
    if (role === "general") {
      if (!userSectionId) {
        return res.status(403).json({ error: "Your account is not assigned to any section" });
      }
      if (String(record.section_id) !== String(userSectionId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      if (String(record.status).toLowerCase() === "central") {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

    if (record_status === "closed") {
      if (!closing_date) {
        return res
          .status(400)
          .json({ error: "Closing date is required when status is closed" });
      }

      const today = new Date().toISOString().slice(0, 10);
      if (closing_date > today) {
        return res.status(400).json({ error: "Closing date cannot be in the future" });
      }

      if (record.opening_date && closing_date < record.opening_date) {
        return res.status(400).json({
          error: "Closing date cannot be before opening date",
        });
      }

      record.closing_date = closing_date;
    } else {
      record.closing_date = null;
    }

    record.record_status = record_status;
    await record.save();

    return res.json({ message: "✅ Workflow status updated", record });
  } catch (err) {
    console.error("❌ updateWorkflowStatus error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getBdObjectionHistory = async (req, res) => {
  try {
    const access = await resolveAuditAccess(req, res);
    if (!access) return;

    const bd_no = String(req.query.bd_no || "").trim();
    if (!bd_no) return res.status(400).json({ error: "bd_no is required" });

    // optional filters
    const section_id = req.query.section_id ? parseInt(req.query.section_id, 10) : null;
    const only_ao = (String(req.query.only_ao || "1") === "1"); // default only AO
    const limit = Math.min(parseInt(req.query.limit || "200", 10), 500);

    const where = { bd_no };
    if (only_ao) where.audit_objection = true;
    if (section_id) where.section_id = section_id;
    if (access.role === "general") {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { section_id: access.userSectionId },
            { previous_section_id: access.userSectionId },
          ],
        },
      ];
    } else if (section_id) {
      where.section_id = section_id;
    }

    const rows = await Record.findAll({
      where,
      limit,
      order: [
        [sequelize.literal("serial_no IS NULL"), "ASC"], // NULL গুলো last
        ["serial_no", "ASC"],
        ["createdAt", "ASC"],
      ],
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
    });

    return res.json({
      bd_no,
      total: rows.length,
      data: rows,
    });
  } catch (err) {
    console.error("getBdObjectionHistory error:", err);
    return res.status(500).json({ error: "Failed to load BD objection history" });
  }
};

// ================== AUDIT OBJECTION FULL LIST ==================
// GET /api/records/audit-objections?status=open|requested|cleared&bd_no=...&q=...&page=1&limit=20
exports.getAuditObjectionsList = async (req, res) => {
  try {
    const access = await resolveAuditAccess(req, res);
    if (!access) return;

    const status = req.query.status ? String(req.query.status).trim() : "";
    const bd_no = req.query.bd_no ? String(req.query.bd_no).trim() : "";
    const q = req.query.q ? String(req.query.q).trim() : "";
    const section_id = req.query.section_id ? parseInt(req.query.section_id, 10) : null;

    const page = Math.max(parseInt(req.query.page || "1", 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    const where = {
      audit_objection: true, // only records marked as audit objection
    };

    if (status) where.ao_status = status;
    if (bd_no) where.bd_no = bd_no;

    if (q) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { file_name: { [Op.like]: `%${q}%` } },
            { bd_no: { [Op.like]: `%${q}%` } },
            { objection_no: { [Op.like]: `%${q}%` } },
            { objection_title: { [Op.like]: `%${q}%` } },
            { objection_details: { [Op.like]: `%${q}%` } },
          ],
        },
      ];
    }

    if (access.role === "general") {
      // General: own section + own-origin central records
      where[Op.and] = [
        ...(where[Op.and] || []),
        {
          [Op.or]: [
            { section_id: access.userSectionId },
            { previous_section_id: access.userSectionId },
          ],
        },
      ];
    } else if (section_id) {
      // Admin/Master optional section filter
      where.section_id = section_id;
    }

    const { rows, count } = await Record.findAndCountAll({
      where,
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
      order: [
        ["bd_no", "ASC"],
        [sequelize.literal("serial_no IS NULL"), "ASC"],
        ["serial_no", "ASC"],
        ["createdAt", "DESC"],
      ],
      limit,
      offset,
    });

    return res.json({
      items: rows,
      pagination: { page, limit, total: count },
    });
  } catch (err) {
    console.error("getAuditObjectionsList error:", err);
    return res.status(500).json({ error: "Failed to load audit objection list" });
  }
};
