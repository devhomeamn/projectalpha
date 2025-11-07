const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const sequelize = require('./config/db');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Debug: সব request log করো
app.use((req, res, next) => {
  console.log('➡️', req.method, req.originalUrl);
  next();
});

// ✅ Import routes
const authRoutes = require('./routes/authRoutes');
const sectionRoutes = require('./routes/sectionRoutes');
const recordRoutes = require('./routes/recordRoutes');


 // ✅ must come BEFORE static serve

// ✅ API routes অবশ্যই প্রথমে রাখো
app.use('/api/auth', authRoutes);
app.use('/api/sections', sectionRoutes);
app.use('/api/records', recordRoutes);


// ✅ Static serve (সবচেয়ে শেষে)
app.use(express.static(path.join(__dirname, 'frontend')));

// ✅ Root page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

// ✅ Database sync
sequelize.sync({ alter: false })
  .then(() => console.log("✅ Database synced with approval system"))
  .catch(console.error);


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
// Send API base URL from backend (.env)
app.get('/api/config', (req, res) => {
  res.json({ apiBase: process.env.API_BASE });
});

