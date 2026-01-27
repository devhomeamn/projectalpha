const User = require('../models/userModel');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');

// ✅ Register (new user = pending)
exports.register = async (req, res) => {
  const { name, serviceid, email, username, password } = req.body;
  try {
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { serviceid }, { email }],
      },
    });

    if (existingUser)
      return res.status(400).json({
        error:
          existingUser.username === username
            ? 'Username already exists'
            : existingUser.serviceid === Number(serviceid)
            ? 'Service ID already exists'
            : 'Email already exists',
      });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      username,
      serviceid,
      email,
      password: hashedPassword,
      // ✅ Security: role is always General on self-register
      role: 'General',
      section_id: null,
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

      if (user.is_active === false) {
  return res.status(403).json({
    message: "আপনার একাউন্টটি সাময়িকভাবে নিষ্ক্রিয় করা হয়েছে। Admin এর সাথে যোগাযোগ করুন।"
  });
}

    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        section_id: user.section_id,
        username: user.username,
        name: user.name,
        email: user.email,
        serviceid: user.serviceid,
      },
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
    serviceid: user.serviceid,
    email: user.email,
    role: user.role,
    section_id: user.section_id,
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
      attributes: ['id', 'name', 'username', 'serviceid', 'email', 'role', 'section_id', 'status', 'createdAt'],
      order: [['createdAt', 'DESC']]
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// ✅ Admin: update user access (role + section assignment)
exports.updateUserAccess = async (req, res) => {
  try {
    const { id } = req.params;
    const roleRaw = (req.body.role || '').toString().trim();
    const sectionRaw = req.body.section_id;

    const allowedRoles = ['Admin', 'Master', 'General'];
    if (!allowedRoles.includes(roleRaw)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // section_id: null/empty allowed for Admin/Master; required for General
    let section_id = null;
    if (sectionRaw !== null && sectionRaw !== undefined && `${sectionRaw}`.trim() !== '') {
      const n = parseInt(sectionRaw, 10);
      if (!Number.isFinite(n) || n <= 0) {
        return res.status(400).json({ error: 'Invalid section_id' });
      }
      section_id = n;
    }

    if (roleRaw === 'General' && !section_id) {
      return res.status(400).json({ error: 'General user must have a section assigned' });
    }

    // For Admin/Master, force section_id null
    if (roleRaw !== 'General') {
      section_id = null;
    }

    const [updated] = await User.update(
      { role: roleRaw, section_id },
      { where: { id } }
    );

    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = await User.findByPk(id, {
      attributes: ['id', 'name', 'username', 'serviceid', 'email', 'role', 'section_id', 'status', 'createdAt'],
    });

    res.json({ message: '✅ User access updated', user });
  } catch (err) {
    console.error('updateUserAccess error:', err);
    res.status(500).json({ error: 'Failed to update user access' });
  }
};
exports.toggleUserActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // self-lock prevent
    if (req.user.id === user.id && is_active === false) {
      return res.status(400).json({ message: "নিজেকে deactivate করা যাবে না।" });
    }

    user.is_active = Boolean(is_active);
    await user.save();

    res.json({ message: "Updated", user });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

