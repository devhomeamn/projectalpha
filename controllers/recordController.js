const { Op } = require("sequelize");
const Record = require("../models/recordModel");
const Section = require("../models/sectionModel");
const Subcategory = require("../models/subcategoryModel");
const Rack = require("../models/rackModel");

// ================== ADD NEW RECORD ==================
exports.addRecord = async (req, res) => {
  try {
    const {
      file_name,
      bd_no,
      section_id,
      subcategory_id,
      rack_id,
      description,
      added_by,
      serial_no,
    } = req.body;

    if (!file_name || !section_id || !rack_id) {
      return res
        .status(400)
        .json({ error: "File name, Section, and Rack are required" });
    }

    // 🧮 Auto serial
    let finalSerial = serial_no;
    if (!finalSerial) {
      const lastRecord = await Record.findOne({
        where: { rack_id },
        order: [["serial_no", "DESC"]],
      });
      finalSerial = (lastRecord?.serial_no || 0) + 1;
    }

    // 🛑 Duplicate check
    const exists = await Record.findOne({
      where: { rack_id, serial_no: finalSerial },
    });
    if (exists) {
      return res
        .status(400)
        .json({ error: `Serial No. ${finalSerial} already exists in this rack` });
    }

    const record = await Record.create({
      file_name,
      bd_no,
      section_id,
      subcategory_id,
      rack_id,
      description,
      added_by,
      serial_no: finalSerial,
      status: "active",
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
    const q = req.query.q || "";
    const sectionFilter = req.query.section || "";
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const whereClause = {
      ...(q && {
        [Op.or]: [
          { file_name: { [Op.like]: `%${q}%` } },
          { bd_no: { [Op.like]: `%${q}%` } },
          { description: { [Op.like]: `%${q}%` } },
          { moved_by: { [Op.like]: `%${q}%` } },
          { serial_no: { [Op.like]: `%${q}%` } },     // ✅ search by serial number
          { "$Rack.name$": { [Op.like]: `%${q}%` } }, // ✅ search by rack name/number
        ],
      }),
      ...(sectionFilter && { section_id: sectionFilter }),
    };

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

    // Enhance with previous location names
    const enhanced = await Promise.all(
      records.map(async (r) => {
        let prevSection = null,
          prevSub = null,
          prevRack = null;

        if (r.previous_section_id) {
          const s = await Section.findByPk(r.previous_section_id);
          prevSection = s ? s.name : null;
        }
        if (r.previous_subcategory_id) {
          const sb = await Subcategory.findByPk(r.previous_subcategory_id);
          prevSub = sb ? sb.name : null;
        }
        if (r.previous_rack_id) {
          const rk = await Rack.findByPk(r.previous_rack_id);
          prevRack = rk ? rk.name : null;
        }

        return {
          ...r.toJSON(),
          previous_location: {
            section_name: prevSection,
            subcategory_name: prevSub,
            rack_name: prevRack,
          },
        };
      })
    );

    res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      data: enhanced,
    });
  } catch (err) {
    console.error("❌ getRecords error:", err);
    res.status(500).json({ error: err.message });
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
    if (record.status === "central")
      return res.status(400).json({ error: "Already moved to central" });
    if (!newRackId)
      return res.status(400).json({ error: "Target rack (newRackId) is required" });

    const targetRack = await Rack.findByPk(newRackId);
    if (!targetRack)
      return res.status(400).json({ error: "Target rack not found" });

    // 🟢 Preserve OLD location before move
    const oldSectionId = record.section_id;
    const oldRackId = record.rack_id;
    const oldSubId = record.subcategory_id;

    const oldSection = await Section.findByPk(oldSectionId);
    const oldRack = await Rack.findByPk(oldRackId);
    const oldSub = await Subcategory.findByPk(oldSubId);

    record.previous_section_id = oldSectionId;
    record.previous_subcategory_id = oldSubId;
    record.previous_rack_id = oldRackId;

    // 🧮 Determine serial
    let serial;
    if (!startSerialNo || startSerialNo === "auto") {
      const maxSerial = await Record.max("serial_no", {
        where: { rack_id: newRackId },
      });
      serial = (Number.isFinite(maxSerial) ? maxSerial : 0) + 1;
    } else {
      serial = parseInt(startSerialNo, 10);
      const exists = await Record.findOne({
        where: { rack_id: newRackId, serial_no: serial },
      });
      if (exists)
        return res
          .status(409)
          .json({ error: `Serial ${serial} already exists in target rack` });
    }

    // 🟢 Move record to Central Room (keep subcategory!)
    const centralSection = await Section.findOne({ where: { name: "Central Room" } });
    record.section_id = centralSection ? centralSection.id : record.section_id;
    record.rack_id = newRackId;
    record.serial_no = serial;
    record.status = "central";
    record.moved_by = req.user?.name || moved_by || "Unknown User";

    // 🟢 KEEP subcategory_id
    // record.subcategory_id = record.subcategory_id;

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
    const q = req.query.q || "";

    const records = await Record.findAll({
      where: {
        status: "central",
        ...(q && {
          [Op.or]: [
            { file_name: { [Op.like]: `%${q}%` } },
            { bd_no: { [Op.like]: `%${q}%` } },
            { description: { [Op.like]: `%${q}%` } },
            { moved_by: { [Op.like]: `%${q}%` } },
          ],
        }),
      },
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
      order: [["updatedAt", "DESC"]],
    });

    res.json(records);
  } catch (err) {
    console.error("❌ getCentralRecords error:", err);
    res.status(500).json({ error: err.message });
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
    if (!newRackId)
      return res.status(400).json({ error: "Target rack is required." });

    newRackId = parseInt(newRackId, 10);
    let serial =
      !startSerialNo || startSerialNo === "auto"
        ? null
        : parseInt(startSerialNo, 10);

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
      rec.moved_by = moved_by || "Unknown User";

      // ✅ Preserve subcategory_id instead of clearing it
      // rec.subcategory_id = rec.subcategory_id;

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
    const id = req.params.id;
    const {
      file_name,
      bd_no,
      section_id,
      subcategory_id,
      rack_id,
      description,
      updated_by,
    } = req.body;

    const record = await Record.findByPk(id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    record.file_name = file_name ?? record.file_name;
    record.bd_no = bd_no ?? record.bd_no;
    record.section_id = section_id ?? record.section_id;
    record.subcategory_id = subcategory_id ?? record.subcategory_id;
    record.rack_id = rack_id ?? record.rack_id;
    record.description = description ?? record.description;
    record.updated_by = updated_by || req.user?.name || "Unknown User";

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
    const userRole = req.user?.role || req.body.role; // frontend will send role too

    if (!["admin", "master"].includes(userRole.toLowerCase())) {
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
