const SiteNotice = require("../models/SiteNotice");

// GET /api/notices/active (auth required)
exports.getActiveNotice = async (req, res) => {
  try {
    const n = await SiteNotice.findOne({
      where: { is_active: true },
      order: [["updatedAt", "DESC"]],
      attributes: ["id", "title", "message", "type", "version", "updatedAt"],
    });

    return res.json(n || null);
  } catch (err) {
    console.error("❌ getActiveNotice error:", err);
    return res.status(500).json({ error: "Failed to load active notice" });
  }
};

// POST /api/notices/upsert (admin only)
exports.upsertNotice = async (req, res) => {
  try {
    const { title, message, type = "info", is_active = true, updated_by } = req.body || {};
    if (!title?.trim() || !message?.trim()) {
      return res.status(400).json({ error: "title and message are required" });
    }

    const latest = await SiteNotice.findOne({ order: [["updatedAt", "DESC"]] });

    if (!latest) {
      const created = await SiteNotice.create({
        title: title.trim(),
        message: message.trim(),
        type,
        is_active: !!is_active,
        version: 1,
        created_by: updated_by || null,
        updated_by: updated_by || null,
      });
      return res.json({ message: "Notice created", data: created });
    }

    // update + bump version so all users see again
    latest.title = title.trim();
    latest.message = message.trim();
    latest.type = type;
    latest.is_active = !!is_active;
    latest.updated_by = updated_by || null;
    latest.version = (latest.version || 1) + 1;

    await latest.save();
    return res.json({ message: "Notice updated", data: latest });
  } catch (err) {
    console.error("❌ upsertNotice error:", err);
    return res.status(500).json({ error: "Failed to save notice" });
  }
};

// POST /api/notices/deactivate (admin only)
exports.deactivateNotice = async (req, res) => {
  try {
    const latest = await SiteNotice.findOne({ order: [["updatedAt", "DESC"]] });
    if (!latest) return res.json({ message: "No notice found" });

    latest.is_active = false;
    await latest.save();
    return res.json({ message: "Notice deactivated" });
  } catch (err) {
    console.error("❌ deactivateNotice error:", err);
    return res.status(500).json({ error: "Failed to deactivate notice" });
  }
};
