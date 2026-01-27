// routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requireRole } = require('../middleware/auth');

// Public
router.post('/register', authController.register);
router.post('/login', authController.login);

//AC DEACTIVE
router.patch(
  "/users/:id/toggle-active",
  requireAuth,
  requireRole("admin"),
  authController.toggleUserActive
);


// 🔐 Admin-only approval & user management APIs
router.get(
  '/pending',
  requireAuth,
  requireRole('admin'),
  authController.getPendingUsers
);

router.post(
  '/approve/:id',
  requireAuth,
  requireRole('admin'),
  authController.approveUser
);

router.post(
  '/reject/:id',
  requireAuth,
  requireRole('admin'),
  authController.rejectUser
);

router.get(
  '/users/all',
  requireAuth,
  requireRole('admin'),
  authController.getAllUsers
);

// ✅ Admin: update user access (role + section assignment)
router.patch(
  '/users/:id/access',
  requireAuth,
  requireRole('admin'),
  authController.updateUserAccess
);

// 🔎 JWT-verified user info (for frontend guard)
router.get('/me', requireAuth, (req, res) => {
  // req.user আসে jwt.verify() থেকে
  res.json({ user: req.user }); // { id, role, email?, name? ...token payload অনুযায়ী }
});

module.exports = router;
