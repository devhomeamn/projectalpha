// routes/noticeRoutes.js
const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth"); // path check
const {
  getActiveNotice,
  upsertNotice,
  deactivateNotice,
} = require("../controllers/noticeController");

// all logged-in users
router.get("/active", requireAuth, getActiveNotice);

// admin only
router.post("/upsert", requireAuth, requireRole("admin"), upsertNotice);
router.post("/deactivate", requireAuth, requireRole("admin"), deactivateNotice);

module.exports = router;
