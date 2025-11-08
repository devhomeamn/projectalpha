const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Section = require('./sectionModel');

const Rack = sequelize.define('Rack', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
  },
  section_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // central rack-এর জন্য null রাখা যাবে
  },
  is_central: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  
});

// Relations
Section.hasMany(Rack, { foreignKey: 'section_id', onDelete: 'CASCADE' });
Rack.belongsTo(Section, { foreignKey: 'section_id' });

module.exports = Rack;
