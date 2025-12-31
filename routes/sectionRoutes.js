const express = require('express');
const router = express.Router();
const {
  addSection,
  addSubcategory,
  getSections,
  addRack,
  getRacksBySection,
  getCentralRacks,
  deleteSection,
  deleteRack,
  deleteSubcategory,
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
router.delete("/:id", deleteSection);
router.delete("/sub/:id", deleteSubcategory);
router.delete("/rack/:id", deleteRack);

module.exports = router;
