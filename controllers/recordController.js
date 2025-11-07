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
    } = req.body;

    if (!file_name || !section_id || !rack_id) {
      return res
        .status(400)
        .json({ error: "File name, Section, and Rack are required" });
    }

    const record = await Record.create({
      file_name,
      bd_no,
      section_id,
      subcategory_id,
      rack_id,
      description,
      added_by,
      status: "active",
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
    const q = req.query.q || "";

    const records = await Record.findAll({
      where: {
        ...(q && {
          [Op.or]: [
            { file_name: { [Op.like]: `%${q}%` } },
            { bd_no: { [Op.like]: `%${q}%` } },
            { description: { [Op.like]: `%${q}%` } },
          ],
        }),
      },
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

// ================== MOVE TO CENTRAL ==================
exports.moveToCentral = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Record.findByPk(id);

    if (!record) {
      return res.status(404).json({ error: "Record not found" });
    }

    // ✅ Mark as moved to central instead of nulling FKs
    record.status = "central";
    await record.save();

    res.json({ message: "✅ Record moved to central successfully", record });
  } catch (err) {
    console.error("❌ moveToCentral error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== GET CENTRAL RECORDS (with search) ==================
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

    // 🧾 Optional CSV export (if ?export=csv is passed)
    if (req.query.export === "csv") {
      const { Parser } = require("json2csv");
      const fields = [
        "id",
        "file_name",
        "bd_no",
        "Section.name",
        "Rack.name",
        "description",
        "added_by",
        "status",
      ];
      const parser = new Parser({ fields });
      const csv = parser.parse(records.map((r) => r.toJSON()));

      res.header("Content-Type", "text/csv");
      res.attachment(`central_records_${new Date().toISOString().slice(0, 10)}.csv`);
      return res.send(csv);
    }

    res.json(records);
  } catch (err) {
    console.error("❌ getCentralRecords error:", err);
    res.status(500).json({ error: err.message });
  }
};
