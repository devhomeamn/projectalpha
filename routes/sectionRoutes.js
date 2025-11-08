const express = require('express');
const router = express.Router();
const {
  addSection,
  addSubcategory,
  getSections,
  addRack,
  getRacksBySection,
  getCentralRacks
} = require('../controllers/sectionController');

console.log('✅ sectionRoutes.js loaded');

// Routes
router.get('/', getSections);
router.post('/add', addSection);
router.post('/add-sub', addSubcategory);
router.post('/add-rack', addRack);
router.get('/racks/:sectionId', getRacksBySection);

// 🆕 New endpoint for central racks
router.get('/central/racks', getCentralRacks);

module.exports = router;
