const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const { DataTypes } = require('sequelize');
const sequelize = require('./config/db');
const User = require('./models/userModel');

// Ensure preference models are registered before sync
require('./models/userPreferredRackModel');
require('./models/sectionRuleModel');
require('./models/publicMessageModel');
require('./models/publicMessageLogModel');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  console.log('->', req.method, req.originalUrl);
  next();
});

// Import routes
const authRoutes = require('./routes/authRoutes');
const sectionRoutes = require('./routes/sectionRoutes');
const recordRoutes = require('./routes/recordRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const aoClearanceRoutes = require('./routes/aoClearanceRoutes');
const chequeRegisterRoutes = require('./routes/chequeRegisterRoutes');

app.use('/api/reports', require('./routes/reportsRoutes'));
app.use('/api/notices', require('./routes/noticeRoutes'));
app.use('/api/password', require('./routes/passwordRoutes'));
app.use('/api/public-messages', require('./routes/publicMessageRoutes'));
app.use('/api/ao-clearance-requests', aoClearanceRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/cheque-register', chequeRegisterRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Static serve
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

app.get('/api/config', (req, res) => {
  res.json({ apiBase: process.env.API_BASE });
});

async function ensureUserMobileColumn() {
  const qi = sequelize.getQueryInterface();
  const tableName = User.getTableName();
  const columns = await qi.describeTable(tableName);

  if (!columns.mobile) {
    await qi.addColumn(tableName, 'mobile', {
      type: DataTypes.STRING(15),
      allowNull: true,
    });
    console.log('Added missing Users.mobile column');
  }
}

async function startServer() {
  try {
    await sequelize.sync();
    await ensureUserMobileColumn();
    console.log('Database synced with approval system');

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

startServer();
