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

const { requireAuth, requireRole } = require('../middleware/auth');

console.log('✅ sectionRoutes.js loaded');

// =========================
// Read (Logged-in users)
// =========================
router.get('/', requireAuth, getSections);
router.get('/racks/:sectionId', requireAuth, getRacksBySection);
router.get('/central/racks', requireAuth, getCentralRacks);

// =========================
// Write (Admin only)
// =========================
router.post('/add', requireAuth, requireRole('admin'), addSection);
router.post('/add-sub', requireAuth, requireRole('admin'), addSubcategory);
router.post('/add-rack', requireAuth, requireRole('admin'), addRack);

router.delete('/:id', requireAuth, requireRole('admin'), deleteSection);
router.delete('/sub/:id', requireAuth, requireRole('admin'), deleteSubcategory);
router.delete('/rack/:id', requireAuth, requireRole('admin'), deleteRack);

module.exports = router;
