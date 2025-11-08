const Section = require("../models/sectionModel");
const Subcategory = require("../models/subcategoryModel");
const Rack = require("../models/rackModel");

// ================== GET ALL SECTIONS ==================
exports.getSections = async (req, res) => {
  try {
    const sections = await Section.findAll({
      include: [{ model: Subcategory }],
    });
    res.json(sections);
  } catch (err) {
    console.error("❌ getSections error:", err);
    res.status(500).json({ error: "Server Error" });
  }
};

// ================== ADD SECTION ==================
exports.addSection = async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: "Section name required" });

    const section = await Section.create({ name, description });
    res.json({ message: "✅ Section added successfully", section });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ================== ADD SUBCATEGORY ==================
exports.addSubcategory = async (req, res) => {
  try {
    const { sectionId, name } = req.body;
    if (!sectionId || !name)
      return res.status(400).json({ error: "Section ID and name required" });

    const sub = await Subcategory.create({ section_id: sectionId, name });
    res.json({ message: "✅ Subcategory added", sub });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ================== ADD NORMAL + CENTRAL ROOM RACK ==================
exports.addRack = async (req, res) => {
  try {
    console.log("📥 Incoming Rack Payload:", req.body);
    let { sectionId, name, description, centralRoom } = req.body;

    if (!name)
      return res.status(400).json({ error: "Rack name is required" });

    // ✅ Handle Central Room rack creation
    if (centralRoom) {
      let centralSection = await Section.findOne({ where: { name: "Central Room" } });

      if (!centralSection) {
        centralSection = await Section.create({
          name: "Central Room",
          description: "Auto-created central storage section",
        });
        console.log("🆕 Created Central Room section:", centralSection.id);
      }

      sectionId = centralSection.id;
    }

    if (!sectionId)
      return res.status(400).json({ error: "Section ID is required" });

    const sectionExists = await Section.findByPk(sectionId);
    if (!sectionExists)
      return res.status(404).json({ error: "Section not found" });

    const rack = await Rack.create({
      section_id: sectionId,
      name,
      description,
    });

    res.json({
      message: centralRoom
        ? "✅ Central Room rack added successfully!"
        : "✅ Rack added successfully!",
      rack,
    });
  } catch (err) {
    console.error("❌ addRack error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== GET RACKS BY SECTION ==================
exports.getRacksBySection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const racks = await Rack.findAll({
      where: { section_id: sectionId },
      order: [["name", "ASC"]],
    });
    res.json(racks);
  } catch (err) {
    console.error("❌ getRacksBySection error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== GET CENTRAL ROOM RACKS ==================
exports.getCentralRacks = async (req, res) => {
  try {
    const section = await Section.findOne({ where: { name: "Central Room" } });
    if (!section)
      return res.json([]);

    const racks = await Rack.findAll({
      where: { section_id: section.id },
      order: [["name", "ASC"]],
    });
    res.json(racks);
  } catch (err) {
    console.error("❌ getCentralRacks error:", err);
    res.status(500).json({ error: err.message });
  }
};
