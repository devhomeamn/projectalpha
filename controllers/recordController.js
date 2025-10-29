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
    } = req.body;

    if (!file_name || !section_id || !rack_id) {
      return res.status(400).json({ error: "File name, Section, and Rack are required" });
    }

    const record = await Record.create({
      file_name,
      bd_no,
      section_id,
      subcategory_id,
      rack_id,
      description,
      added_by,
    });

    res.json({ message: "✅ Record added successfully", record });
  } catch (err) {
    console.error("❌ addRecord error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== GET ALL RECORDS ==================
exports.getRecords = async (req, res) => {
  try {
    const records = await Record.findAll({
      include: [
        { model: Section, attributes: ["id", "name"] },
        { model: Subcategory, attributes: ["id", "name"] },
        { model: Rack, attributes: ["id", "name"] },
      ],
      order: [["createdAt", "DESC"]],
    });
    res.json(records);
  } catch (err) {
    console.error("❌ getRecords error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== MOVE TO CENTRAL (IF USED) ==================
exports.moveToCentral = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Record.findByPk(id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    record.section_id = null;
    record.subcategory_id = null;
    record.rack_id = null;
    await record.save();

    res.json({ message: "✅ Record moved to central", record });
  } catch (err) {
    console.error("❌ moveToCentral error:", err);
    res.status(500).json({ error: err.message });
  }
};
