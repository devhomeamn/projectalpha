const multer = require("multer");
const path = require("path");
const fs = require("fs");

const dest = path.join(__dirname, "..", "uploads", "records");
fs.mkdirSync(dest, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dest),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safe);
  },
});

const fileFilter = (req, file, cb) => {
  const ok = ["application/pdf", "image/jpeg", "image/png"].includes(file.mimetype);
  if (!ok) return cb(new Error("Only PDF/JPG/PNG allowed"), false);
  cb(null, true);
};

module.exports = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
