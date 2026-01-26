// middleware/uploadsAoClearance.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "..", "uploads", "ao_clearance_requests");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const fileFilter = (req, file, cb) => {
  // allow common images + pdf
  const ok =
    file.mimetype === "application/pdf" ||
    file.mimetype.startsWith("image/");

  if (!ok) return cb(new Error("Only PDF or image files are allowed."), false);
  cb(null, true);
};

const uploadAOClearance = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

module.exports = uploadAOClearance;
