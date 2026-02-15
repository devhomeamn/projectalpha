const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const {
  listMessages,
  createMessage,
  updateMessage,
  deleteMessage,
  listTrace,
} = require("../controllers/publicMessageController");

router.get("/", requireAuth, listMessages);
router.post("/", requireAuth, createMessage);
router.patch("/:id", requireAuth, updateMessage);
router.delete("/:id", requireAuth, deleteMessage);
router.get("/trace/list", requireAuth, listTrace);

module.exports = router;
