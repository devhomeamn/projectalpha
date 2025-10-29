const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Section = require('./sectionModel');

const Rack = sequelize.define('Rack', {
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  section_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
});

// 🧩 Relationships
Section.hasMany(Rack, { foreignKey: 'section_id', onDelete: 'CASCADE' });
Rack.belongsTo(Section, { foreignKey: 'section_id' });

module.exports = Rack;
