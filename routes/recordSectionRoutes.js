const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const recordSectionController = require("../controllers/recordSectionController");

router.use(requireAuth);
router.use(requireRole("admin", "master", "general"));

router.get("/options/offices", recordSectionController.listOfficeOptions);
router.post("/options/offices", requireRole("admin", "master"), recordSectionController.createOfficeOption);
router.delete("/options/offices/:id", requireRole("admin", "master"), recordSectionController.deleteOfficeOption);

router.get("/options/forward-targets", recordSectionController.listForwardTargets);
router.post(
  "/options/forward-targets",
  requireRole("admin", "master"),
  recordSectionController.createForwardTarget
);
router.delete(
  "/options/forward-targets/:id",
  requireRole("admin", "master"),
  recordSectionController.deleteForwardTarget
);

router.get("/sections", recordSectionController.listSections);
router.get("/context", recordSectionController.getContext);
router.get("/section-users/:sectionId", recordSectionController.listSectionUsers);
router.get("/stats/daily", recordSectionController.dailyCounts);
router.get("/suggestions/memo-nos", recordSectionController.listMemoNoSuggestions);
router.get("/reports/forwarded-by-date", recordSectionController.forwardedByDateReport);

router.post("/", recordSectionController.createEntry);
router.get("/", recordSectionController.listEntries);
router.get("/:id/logs", recordSectionController.listEntryLogs);
router.get("/:id", recordSectionController.getEntry);
router.put("/:id", recordSectionController.updateEntry);
router.post("/:id/forward", recordSectionController.forwardEntry);
router.post("/:id/receive", recordSectionController.receiveForwardedEntry);

module.exports = router;
