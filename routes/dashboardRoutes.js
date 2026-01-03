const express = require("express");
const router = express.Router();

const dashboardController = require("../controllers/dashboardController");
const { requireAuth } = require("../middleware/auth");

console.log("✅ dashboardRoutes.js loaded");

// Public / auth-protected (your choice)
router.get("/summary", dashboardController.getDashboardSummary);

// My Activity (must be protected)
router.get("/my-stats", requireAuth, dashboardController.getMyStats);

module.exports = router;
