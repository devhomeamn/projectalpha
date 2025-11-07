const express = require('express');
const router = express.Router();
const {
  addRecord,
  getRecords,
  moveToCentral,
  getCentralRecords, // 🆕 import added
} = require('../controllers/recordController');

console.log('✅ recordRoutes.js loaded');

router.post('/add', addRecord);
router.get('/', getRecords);
router.put('/move/:id', moveToCentral);

// 🆕 new route for central records
router.get('/central', getCentralRecords);

module.exports = router;
