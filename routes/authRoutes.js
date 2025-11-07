const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/register', authController.register);
router.post('/login', authController.login);

// 🔹 Admin-only approval APIs
router.get('/pending', authController.getPendingUsers);
router.post('/approve/:id', authController.approveUser);
router.post('/reject/:id', authController.rejectUser);
router.get('/users/all', authController.getAllUsers);


module.exports = router;
