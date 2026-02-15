const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const sequelize = require('./config/db');

// ✅ Ensure preference models are registered before sync
require('./models/userPreferredRackModel');
require('./models/sectionRuleModel');
require('./models/publicMessageModel');
require('./models/publicMessageLogModel');

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
const dashboardRoutes = require("./routes/dashboardRoutes");
const aoClearanceRoutes = require("./routes/aoClearanceRoutes");
const chequeRegisterRoutes = require("./routes/chequeRegisterRoutes");
app.use("/api/reports", require("./routes/reportsRoutes"));
app.use("/api/notices", require("./routes/noticeRoutes"));
app.use("/api/password", require("./routes/passwordRoutes"));
app.use("/api/public-messages", require("./routes/publicMessageRoutes"));



app.use("/api/ao-clearance-requests", aoClearanceRoutes);








 // ✅ must come BEFORE static serve

// ✅ API routes অবশ্যই প্রথমে রাখো
app.use('/api/auth', authRoutes);
app.use('/api/sections', sectionRoutes);
app.use("/api/records", recordRoutes);
app.use("/api/cheque-register", chequeRegisterRoutes);
app.use("/api/dashboard", dashboardRoutes);







// ✅ Static serve (সবচেয়ে শেষে)
app.use(express.static(path.join(__dirname, 'frontend')));
// ✅ serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Root page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});

// ✅ Database sync
sequelize.sync()
  .then(() => console.log("✅ Database synced with approval system"))
  .catch(console.error);


const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
// Send API base URL from backend (.env)
app.get('/api/config', (req, res) => {
  res.json({ apiBase: process.env.API_BASE });
});
