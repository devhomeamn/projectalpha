const express = require("express");
const router = express.Router();
const {
  addRecord,
  getRecords,
  moveToCentral,
  getCentralRecords,
  bulkMoveRecords,
} = require("../controllers/recordController");

const Record = require("../models/recordModel");

console.log("✅ recordRoutes.js loaded");

// ================== ROUTES ==================

// ➕ Add new record
router.post("/add", addRecord);

// 📄 Get all records (supports pagination, search, filter)
router.get("/", getRecords);

// 🚚 Move single record to Central Room
router.put("/move/:id", moveToCentral);

// 🏢 Get all central records
router.get("/central", getCentralRecords);

// 📦 Bulk move multiple records to Central Room
router.post("/bulk-move", bulkMoveRecords);

// 🔢 Get serial numbers by rack (for auto-serial generation)
router.get("/by-rack/:rackId", async (req, res) => {
  try {
    const { rackId } = req.params;

    const records = await Record.findAll({
      where: { rack_id: rackId },
      attributes: ["serial_no"],
      order: [["serial_no", "ASC"]],
    });

    res.json(records);
  } catch (err) {
    console.error("❌ by-rack error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 🧮 Optional: Get total record count (for dashboards)
router.get("/count", async (req, res) => {
  try {
    const total = await Record.count();
    res.json({ total });
  } catch (err) {
    console.error("❌ count route error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
