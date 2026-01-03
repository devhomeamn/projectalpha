// middleware/auth.js
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // {id, role}
    next();
  } catch (e) {
    return res.status(401).json({ message: "Invalid/Expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const role = (req.user?.role || "").toLowerCase();
    const allowed = roles.map(r => r.toLowerCase());
    if (!allowed.includes(role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
