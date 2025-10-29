const express = require('express');
const router = express.Router();
const { addSection, addSubcategory, getSections } = require('../controllers/sectionController');
const { addRack, getRacksBySection } = require('../controllers/sectionController');

console.log('✅ sectionRoutes.js loaded');


// CRUD routes
router.get('/', getSections);
router.post('/add', addSection);
router.post('/add-sub', addSubcategory);
router.post('/add-rack', addRack);
router.get('/racks/:sectionId', getRacksBySection);
module.exports = router;
