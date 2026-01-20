const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../models/userModel");
const PasswordReset = require("../models/passwordResetModel");
const { sendResetEmail } = require("../utils/mailer"); // ✅ top-level require

function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function addMinutes(mins) {
  return new Date(Date.now() + mins * 60 * 1000);
}

/**
 * POST /api/password/forgot
 * body: { email }
 * Response always generic (doesn't reveal if email exists)
 */
exports.forgotPassword = async (req, res) => {
  try {
    const email = (req.body?.email || "").trim().toLowerCase();

    // ✅ always same response for security
    const okMsg = {
      message: "যদি এই ইমেইলটি সিস্টেমে থাকে, তাহলে একটি রিসেট লিংক পাঠানো হবে।",
    };

    if (!email) return res.json(okMsg);

    const user = await User.findOne({ where: { email } });

    // ✅ do NOT reveal if email exists
    if (!user) return res.json(okMsg);

    // invalidate previous unused tokens
    await PasswordReset.update(
      { used_at: new Date() },
      { where: { user_id: user.id, used_at: null } }
    );

    const token = crypto.randomBytes(32).toString("hex"); // raw token (only send to user)
    const token_hash = sha256Hex(token);

    await PasswordReset.create({
      user_id: user.id,
      token_hash,
      expires_at: addMinutes(30), // 30 minutes
      used_at: null,
    });

    // ✅ better base URL (supports production)
    const base =
      process.env.API_BASE || `${req.protocol}://${req.get("host")}`;
    const resetUrl = `${base}/reset-password.html?token=${token}`;

    // ✅ send email (don’t leak failure)
    try {
      await sendResetEmail(email, resetUrl);
    } catch (e) {
      console.error("❌ sendResetEmail failed:", e);
      // still return okMsg for security
    }

    return res.json(okMsg);
  } catch (err) {
    console.error("❌ forgotPassword error:", err);
    return res.status(500).json({ error: "Failed to process request" });
  }
};

/**
 * POST /api/password/reset
 * body: { token, newPassword }
 */
exports.resetPassword = async (req, res) => {
  try {
    const token = (req.body?.token || "").trim();
    const newPassword = (req.body?.newPassword || "").trim();

    if (!token || !newPassword) {
      return res.status(400).json({ error: "token and newPassword are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const token_hash = sha256Hex(token);

    const pr = await PasswordReset.findOne({ where: { token_hash } });
    if (!pr) return res.status(400).json({ error: "Invalid or expired token" });

    if (pr.used_at) return res.status(400).json({ error: "Token already used" });
    if (new Date(pr.expires_at).getTime() < Date.now()) {
      return res.status(400).json({ error: "Token expired" });
    }

    const user = await User.findByPk(pr.user_id);
    if (!user) return res.status(400).json({ error: "Invalid token" });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed; // ✅ user model field name check
    await user.save();

    pr.used_at = new Date();
    await pr.save();

    // invalidate any other remaining tokens
    await PasswordReset.update(
      { used_at: new Date() },
      { where: { user_id: user.id, used_at: null } }
    );

    return res.json({ message: "✅ Password reset successful. Please login." });
  } catch (err) {
    console.error("❌ resetPassword error:", err);
    return res.status(500).json({ error: "Failed to reset password" });
  }
};
