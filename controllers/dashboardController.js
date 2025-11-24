const { Op } = require("sequelize");
const Section = require("../models/sectionModel");
const Subcategory = require("../models/subcategoryModel");
const Record = require("../models/recordModel");

console.log("✅ dashboardController.js loaded");

/**
 * Dashboard Summary:
 * - total sections (excluding Central Room)
 * - total records (excluding central status unless includeCentral=true)
 * - section-wise record count
 * - section -> subcategory list with record counts
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    const includeCentral = req.query.includeCentral === "true"; // optional
    const centralSection = await Section.findOne({ where: { name: "Central Room" } });
    const centralId = centralSection?.id;

    // ---- Sections (exclude central room by default)
    const sectionWhere = includeCentral || !centralId
      ? {}
      : { id: { [Op.ne]: centralId } };

    const sections = await Section.findAll({
      where: sectionWhere,
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
      include: [
        {
          model: Subcategory,
          attributes: ["id", "name"],
          required: false,
        },
      ],
    });

    // ---- Records filter (exclude central records by default)
    const recordWhere = includeCentral
      ? {}
      : { status: { [Op.ne]: "central" } };

    const records = await Record.findAll({
      where: recordWhere,
      attributes: ["id", "section_id", "subcategory_id", "status"],
    });

    // ---- Total
    const totalSections = sections.length;
    const totalRecords = records.length;

    // ---- Build counts
    const sectionCounts = {};
    const subCounts = {}; // {sectionId: {subId: count}}

    for (const r of records) {
      const sId = r.section_id;
      const sbId = r.subcategory_id;

      if (sId) sectionCounts[sId] = (sectionCounts[sId] || 0) + 1;

      if (sId && sbId) {
        if (!subCounts[sId]) subCounts[sId] = {};
        subCounts[sId][sbId] = (subCounts[sId][sbId] || 0) + 1;
      }
    }

    const enhanced = sections.map((s) => {
      const sJson = s.toJSON();
      const subcats = (sJson.Subcategories || []).map((sb) => ({
        id: sb.id,
        name: sb.name,
        recordCount: subCounts[s.id]?.[sb.id] || 0,
      }));

      return {
        id: s.id,
        name: s.name,
        recordCount: sectionCounts[s.id] || 0,
        subcategories: subcats,
      };
    });

    res.json({
      totalSections,
      totalRecords,
      sections: enhanced,
      includeCentral,
    });
  } catch (err) {
    console.error("❌ getDashboardSummary error:", err);
    res.status(500).json({ error: err.message });
  }
};
