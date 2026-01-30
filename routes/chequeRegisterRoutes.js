// routes/chequeRegisterRoutes.js
const express = require("express");
const router = express.Router();

const { requireAuth } = require("../middleware/auth");
const chequeRegisterController = require("../controllers/chequeRegisterController");

// IMPORTANT: auth for all cheque-register routes
router.use(requireAuth);

// ✅ Logs (Admin/Master only - controller enforces)
router.get("/:id/logs", chequeRegisterController.getEntryLogs);

// list all origin sections (cheque users/admin/master only)
router.get("/origin-sections", chequeRegisterController.listOriginSections);

router.post("/", chequeRegisterController.createEntry);
router.get("/", chequeRegisterController.listEntries);
router.get("/:id", chequeRegisterController.getEntry);
router.put("/:id", chequeRegisterController.updateEntry);
router.post("/:id/return", chequeRegisterController.returnEntry);

// ✅ Admin-only delete
router.delete("/:id", chequeRegisterController.deleteEntry);

module.exports = router;
