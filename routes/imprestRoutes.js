const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const imprestController = require("../controllers/imprestController");

router.use(requireAuth);
router.use(requireRole("admin", "master", "general"));

router.get("/bases", imprestController.listBases);
router.post("/bases", requireRole("admin"), imprestController.createBase);

router.get("/financial-codes", imprestController.listFinancialCodes);
router.post("/financial-codes", requireRole("admin"), imprestController.createFinancialCode);

router.get("/fiscal-years", imprestController.listFiscalYears);
router.post("/fiscal-years", requireRole("admin"), imprestController.createFiscalYear);

router.post("/budgets", requireRole("admin", "master"), imprestController.createBudget);
router.get("/budgets", imprestController.listBudgets);

router.get("/adjustments/durations", imprestController.listAdjustmentDurations);
router.get("/adjustments/entries", imprestController.listDurationAdjustmentEntries);
router.post(
  "/adjustments/entries",
  requireRole("admin", "master"),
  imprestController.createDurationAdjustmentEntries
);

router.get("/reports", imprestController.getWorkflowReport);

router.post("/notes/generate", requireRole("admin", "general"), imprestController.generateNote);
router.get("/notes", imprestController.listNotes);
router.get("/notes/:id", imprestController.getNoteById);
router.put("/notes/:id/items", requireRole("admin", "general"), imprestController.updateNoteItems);
router.post("/notes/:id/submit", requireRole("admin", "general"), imprestController.submitNote);
router.post("/notes/:id/approve", requireRole("admin", "master"), imprestController.approveNote);
router.post("/notes/:id/reject", requireRole("admin", "master"), imprestController.rejectNote);
router.post("/notes/:id/issue", requireRole("admin", "master"), imprestController.issueNote);
router.post("/notes/:id/adjust", requireRole("admin", "master"), imprestController.adjustNote);
router.get("/notes/:id/print", imprestController.printNote);

module.exports = router;
