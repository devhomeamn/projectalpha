const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const User = sequelize.define('User', {
  name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  serviceid: {
    type: DataTypes.INTEGER,
    unique: true,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate: { isEmail: true },
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM('Admin', 'Master', 'General'),
    defaultValue: 'General',
  },
  // ✅ Assigned section for General users (null for Admin/Master)
  section_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending', // ✅ new field for approval
  },
  is_active: {
  type: DataTypes.BOOLEAN,
  allowNull: false,
  defaultValue: true,
},

});

module.exports = User;
