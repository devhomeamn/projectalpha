const { Op } = require("sequelize");
const Section = require("../models/sectionModel");
const Subcategory = require("../models/subcategoryModel");
const Record = require("../models/recordModel");
const User = require("../models/userModel"); // ✅ adjust path if different

console.log("✅ dashboardController.js loaded");

exports.getDashboardSummary = async (req, res) => {
  try {
    const includeCentral = req.query.includeCentral === "true";
    const centralSection = await Section.findOne({ where: { name: "Central Room" } });
    const centralId = centralSection?.id;

    const sectionWhere = includeCentral || !centralId ? {} : { id: { [Op.ne]: centralId } };

    const sections = await Section.findAll({
      where: sectionWhere,
      attributes: ["id", "name"],
      order: [["name", "ASC"]],
      include: [{ model: Subcategory, attributes: ["id", "name"], required: false }],
    });

    const recordWhere = includeCentral ? {} : { status: { [Op.ne]: "central" } };

    const records = await Record.findAll({
      where: recordWhere,
      attributes: ["id", "section_id", "subcategory_id", "status"],
    });

    const totalSections = sections.length;
    const totalRecords = records.length;

    const sectionCounts = {};
    const subCounts = {};

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

    res.json({ totalSections, totalRecords, sections: enhanced, includeCentral });
  } catch (err) {
    console.error("❌ getDashboardSummary error:", err);
    res.status(500).json({ error: err.message });
  }
};

exports.getMyStats = async (req, res) => {
  try {
    // auth middleware gives: req.user = {id, role}
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findByPk(userId, { attributes: ["id", "username", "name", "email"] });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Record.added_by / moved_by তুমি যেটা স্টোর করো সেটা মিলাও:
    // Prefer username, fallback name/email
    const identity = user.username || user.name || user.email;

    const totalAdded = await Record.count({ where: { added_by: identity } });
    const totalMoved = await Record.count({ where: { moved_by: identity } });

    const ongoing = await Record.count({
      where: { added_by: identity, record_status: { [Op.ne]: "closed" } },
    });

    const closed = await Record.count({
      where: { added_by: identity, record_status: "closed" },
    });

    const inCentral = await Record.count({
      where: { added_by: identity, status: "central" },
    });

    const inSection = await Record.count({
      where: { added_by: identity, status: { [Op.ne]: "central" } },
    });

    const recentRows = await Record.findAll({
      where: { [Op.or]: [{ added_by: identity }, { moved_by: identity }] },
      order: [["updatedAt", "DESC"]],
      limit: 6,
      attributes: ["file_name", "bd_no", "added_by", "moved_by", "updatedAt"],
    });

    const recent = recentRows.map((r) => ({
      action: r.moved_by === identity ? "Moved" : "Added",
      file_name: r.file_name,
      bd_no: r.bd_no,
      when: r.updatedAt ? new Date(r.updatedAt).toLocaleString() : "",
    }));

    res.json({ totalAdded, totalMoved, ongoing, closed, inSection, inCentral, recent });
  } catch (err) {
    console.error("❌ getMyStats error:", err);
    res.status(500).json({ error: "Failed to load my stats" });
  }
};
