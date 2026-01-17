const Section = require("../models/sectionModel");
const Subcategory = require("../models/subcategoryModel");
const Rack = require("../models/rackModel");
const { Op } = require("sequelize");   


// ================== GET ALL SECTIONS ==================
exports.getSections = async (req, res) => {
  try {
    const role = (req.user?.role || "").toLowerCase();
    const userSectionId = req.user?.section_id;

    // ✅ General users should only see their assigned section
    const where = {};
    if (role === "general") {
      if (!userSectionId) return res.json([]);
      where.id = userSectionId;
    }

    const sections = await Section.findAll({
      where,
      include: [
        { model: Subcategory },   // subcategories
        { model: Rack },          // ✅ racks under section
      ],
      order: [["name", "ASC"]],
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
       is_central: !!centralRoom, 
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

    const role = (req.user?.role || "").toLowerCase();
    const userSectionId = req.user?.section_id;

    // ✅ General users can only query racks of their assigned section
    if (role === "general") {
      if (!userSectionId || String(userSectionId) !== String(sectionId)) {
        return res.status(403).json({ error: "Forbidden" });
      }
    }

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



// ================== GET ONLY CENTRAL ROOM RACKS ==================
exports.getCentralRacks = async (req, res) => {
  try {
    // 1) "Central Room" নামের section খুঁজি
    const centralSection = await Section.findOne({
      where: { name: "Central Room" },
    });

    // যদি একদমই না থাকে, তাহলে খালি array ফেরত দেই
    if (!centralSection) {
      return res.json([]);
    }

    // 2) এই Central Room section-এর নিচের সব rack বের করি
    const racks = await Rack.findAll({
      where: { section_id: centralSection.id },
      order: [["name", "ASC"]],
    });

    res.json(racks);
  } catch (err) {
    console.error("❌ getCentralRacks error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== DELETE SECTION (SAFE) ==================
exports.deleteSection = async (req, res) => {
  try {
    const { id } = req.params;

    const section = await Section.findByPk(id);
    if (!section)
      return res.status(404).json({ error: "Section not found" });

    // ❌ Central Room protected
    if ((section.name || "").toLowerCase() === "central room") {
      return res.status(400).json({ error: "Central Room cannot be deleted" });
    }

    const subCount = await Subcategory.count({ where: { section_id: id } });
    const rackCount = await Rack.count({ where: { section_id: id } });

    if (subCount > 0 || rackCount > 0) {
      return res.status(400).json({
        error: `Cannot delete. This section has ${subCount} subcategory(s) and ${rackCount} rack(s).`,
      });
    }

    await section.destroy();
    res.json({ message: "✅ Section deleted successfully" });
  } catch (err) {
    console.error("❌ deleteSection error:", err);
    res.status(500).json({ error: err.message });
  }
};

// ================== DELETE SUBCATEGORY ==================
exports.deleteSubcategory = async (req, res) => {
  try {
    const { id } = req.params;

    const sub = await Subcategory.findByPk(id);
    if (!sub) return res.status(404).json({ error: "Subcategory not found" });

    await sub.destroy();
    res.json({ message: "✅ Subcategory deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ================== DELETE RACK ==================
exports.deleteRack = async (req, res) => {
  try {
    const { id } = req.params;

    const rack = await Rack.findByPk(id);
    if (!rack) return res.status(404).json({ error: "Rack not found" });

    await rack.destroy();
    res.json({ message: "✅ Rack deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

