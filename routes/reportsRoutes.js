const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const {
  sectionWiseReport,
  centralReport,
  movementHistoryReport,
  userActivityReport,
  userCompletionReport,
  monthlySummaryReport,
  chequeRegisterReport,
} = require("../controllers/reportsController");

console.log("✅ reportsRoutes.js loaded");

router.get("/section-wise", sectionWiseReport);
router.get("/central", centralReport);
router.get("/movement-history", movementHistoryReport);
router.get("/user-activity", userActivityReport);
router.get("/user-completion", userCompletionReport);
router.get("/monthly-summary", monthlySummaryReport);
router.get("/cheque-register", requireAuth, chequeRegisterReport);

module.exports = router;
