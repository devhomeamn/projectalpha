const router = require("express").Router();
const { forgotPassword, resetPassword } = require("../controllers/passwordController");

// public (no auth)
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);

module.exports = router;
