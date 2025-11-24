const express = require("express");
const router = express.Router();
const { getDashboardSummary } = require("../controllers/dashboardController");

console.log("✅ dashboardRoutes.js loaded");

router.get("/summary", getDashboardSummary);

module.exports = router;
