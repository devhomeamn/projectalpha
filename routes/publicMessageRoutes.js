const router = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const {
  listMessages,
  createMessage,
} = require("../controllers/publicMessageController");

router.get("/", requireAuth, listMessages);
router.post("/", requireAuth, createMessage);

module.exports = router;
