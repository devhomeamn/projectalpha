const express = require("express");
const router = express.Router();
const {
  addRecord,
  getRecords,
  moveToCentral,
  getCentralRecords,
  bulkMoveRecords,
  updateRecord,
  deleteRecord,
  checkBdUnique,
} = require("../controllers/recordController");

const Record = require("../models/recordModel");

console.log("✅ recordRoutes.js loaded");

// ✏️ Update
router.put("/update/:id", updateRecord);

// 🗑️ Delete
router.delete("/delete/:id", deleteRecord);

// ✅ Live BD check
router.get("/check-bd", checkBdUnique);

// ➕ Add
router.post("/add", addRecord);

// 📄 Get all
router.get("/", getRecords);

// 🚚 Move single
router.put("/move/:id", moveToCentral);

// 🏢 Get all central
router.get("/central", getCentralRecords);

// 📦 Bulk move
router.post("/bulk-move", bulkMoveRecords);

// 🔢 Get serials by rack
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

// 🧮 Count
router.get("/count", async (req, res) => {
  try {
    const total = await Record.count();
    res.json({ total });
  } catch (err) {
    console.error("❌ count error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
