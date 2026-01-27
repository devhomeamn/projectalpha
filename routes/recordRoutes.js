const express = require("express");
const router = express.Router();
const upload = require("../middleware/uploads");


const { requireAuth, requireRole } = require("../middleware/auth");
const {
  addRecord,
  getRecords,
  lookupRecords,
  moveToCentral,
  getCentralRecords,
  bulkMoveRecords,
  updateRecord,
  deleteRecord,
  checkBdUnique,
  getRecordForPrint,
  updateWorkflowStatus,
  getBdObjectionHistory, // ✅ workflow status update
  getAuditObjectionsList,
} = require("../controllers/recordController");

const Record = require("../models/recordModel");

console.log("✅ recordRoutes.js loaded");

// ✏️ Update record basic info
router.put("/update/:id", requireAuth, requireRole("admin","master","general"), updateRecord);

// 🗑️ Delete record (admin/master)
router.delete("/delete/:id", requireAuth, requireRole("admin","master"), deleteRecord);

// ✅ Live BD check
router.get("/check-bd", requireAuth, checkBdUnique);


router.get("/by-bd", requireAuth, getBdObjectionHistory);

// 📋 Full Audit Objection list (table)
router.get("/audit-objections", requireAuth, getAuditObjectionsList);


// topbar search
router.get("/lookup", requireAuth, requireRole("admin","master","general"), lookupRecords);


router.post(  "/add",  requireAuth,  requireRole("admin","master","general"),  upload.single("attachment"),  addRecord
);

// 📄 Get all records (pagination/search)
router.get("/", requireAuth, requireRole("admin","master","general"), getRecords);

// 🚚 Move single record to central
router.put("/move/:id", requireAuth, requireRole("admin","master"), moveToCentral);

// 🏢 Get all central records

router.get("/central", requireAuth, requireRole("admin","master","general"), getCentralRecords);


// 📦 Bulk move records to central
router.post("/bulk-move", requireAuth, requireRole("admin","master"), bulkMoveRecords);


// 🔢 Get serial numbers by rack
router.get("/by-rack/:rackId", requireAuth, async (req, res) => {
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

// 🖨️ Print / details by record id
router.get("/print/:id", requireAuth, requireRole("admin","master","general"), getRecordForPrint);

// 🔄 Update workflow status (Ongoing ↔ Closed)
router.put("/workflow/:id", requireAuth, requireRole("admin","master","general"), updateWorkflowStatus);

// 🧮 Count total records
router.get("/count", requireAuth, async (req, res) => {
  try {
    const total = await Record.count();
    res.json({ total });
  } catch (err) {
    console.error("❌ count error:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;