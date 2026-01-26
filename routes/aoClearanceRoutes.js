// routes/aoClearanceRoutes.js
const express = require("express");
const router = express.Router();

const { requireAuth, requireRole } = require("../middleware/auth");
const uploadAOClearance = require("../middleware/uploadsAoClearance");

const aoClearanceController = require("../controllers/aoClearanceController");

// General/Master submit request (optional attachment)
router.post(
  "/",
  requireAuth,
  requireRole("general", "master"),
  uploadAOClearance.single("attachment"),
  aoClearanceController.createRequest
);

// Admin list requests
router.get(
  "/",
  requireAuth,
  requireRole("admin"),
  aoClearanceController.listRequests
);

// General/Master view own requests
router.get(
  "/mine",
  requireAuth,
  requireRole("general", "master"),
  aoClearanceController.listMine
);

// Admin decide
router.put(
  "/:id/decide",
  requireAuth,
  requireRole("admin"),
  aoClearanceController.decideRequest
);

module.exports = router;
