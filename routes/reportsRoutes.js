const express = require("express");
const router = express.Router();
const {
  sectionWiseReport,
  centralReport,
  movementHistoryReport,
  userActivityReport,
  monthlySummaryReport,
} = require("../controllers/reportsController");

console.log("✅ reportsRoutes.js loaded");

router.get("/section-wise", sectionWiseReport);
router.get("/central", centralReport);
router.get("/movement-history", movementHistoryReport);
router.get("/user-activity", userActivityReport);
router.get("/monthly-summary", monthlySummaryReport);

module.exports = router;
