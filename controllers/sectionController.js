const Section = require('../models/sectionModel');
const Subcategory = require('../models/subcategoryModel');
const Rack = require('../models/rackModel');
exports.getSections = async (req, res) => {
  try {
    const sections = await Section.findAll({
      include: [{ model: Subcategory }]
    });
    res.json(sections);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server Error' });
  }
};

exports.addSection = async (req, res) => {
  try {
    const { name, description } = req.body;
    const section = await Section.create({ name, description });
    res.json(section);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.addSubcategory = async (req, res) => {
  try {
    const { sectionId, name } = req.body;
    const sub = await Subcategory.create({ section_id: sectionId, name });
    res.json(sub);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ================== Rack Features ==================


// ✅ Add new rack
exports.addRack = async (req, res) => {
  try {
    console.log('📥 Incoming Rack Payload:', req.body);
    const { sectionId, name, description } = req.body;

    if (!sectionId || !name) {
      return res.status(400).json({ error: 'Section ID and Rack Name required' });
    }

    const sectionExists = await Section.findByPk(sectionId);
    if (!sectionExists) {
      return res.status(404).json({ error: 'Section not found' });
    }

    const rack = await Rack.create({
      section_id: sectionId,
      name,
      description
    });

    res.json({ message: '✅ Rack added successfully', rack });
  } catch (err) {
    console.error('❌ addRack error:', err);
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get racks by section
exports.getRacksBySection = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const racks = await Rack.findAll({ where: { section_id: sectionId } });
    res.json(racks);
  } catch (err) {
    console.error('❌ getRacksBySection error:', err);
    res.status(500).json({ error: err.message });
  }
};
