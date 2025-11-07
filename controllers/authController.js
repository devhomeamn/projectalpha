const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

// ✅ Register (new user = pending)
exports.register = async (req, res) => {
  const { name, serviceid, username, password, role } = req.body;
  try {
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { serviceid }],
      },
    });

    if (existingUser)
      return res.status(400).json({
        error:
          existingUser.username === username
            ? 'Username already exists'
            : 'Service ID already exists',
      });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username,
      serviceid,
      password: hashedPassword,
      role,
      status: 'pending', // 👈 pending by default
    });

    res.json({
      message:
        '✅ Registration successful! Waiting for admin approval before login.',
      user,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ✅ Login (only approved users)
exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // approval check 👇
    if (user.status !== 'approved') {
      return res.status(403).json({
        error:
          user.status === 'pending'
            ? 'Your account is pending admin approval.'
            : 'Your account has been rejected by admin.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: '✅ Login Successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        username: user.username,
        role: user.role,
        status: user.status,
      },
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ✅ Admin: get all pending users
exports.getPendingUsers = async (req, res) => {
  try {
    const users = await User.findAll({ where: { status: 'pending' } });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Admin: approve user
exports.approveUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.update({ status: 'approved' }, { where: { id } });
    res.json({ message: '✅ User approved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Admin: reject user
exports.rejectUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.update({ status: 'rejected' }, { where: { id } });
    res.json({ message: '❌ User rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ✅ Get all users (Admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: ['id', 'name', 'username', 'serviceid', 'role', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};
