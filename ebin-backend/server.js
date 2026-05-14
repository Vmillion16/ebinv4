require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const bcrypt     = require('bcryptjs');
const cors       = require('cors');
const jwt        = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit  = require('express-rate-limit');

// ─────────────────────────────────────────────────────────────
// 1. APP
// ─────────────────────────────────────────────────────────────
const app = express();

// ─────────────────────────────────────────────────────────────
// 2. MIDDLEWARE
// ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key'],
}));
app.options(/.*/, cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/api/', rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, message: 'Too many requests' }));

// ─────────────────────────────────────────────────────────────
// 3. DATABASE
// ─────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch(err => { console.error('❌ MongoDB Error:', err.message); process.exit(1); });

const SECRET_KEY = process.env.JWT_SECRET || 'ebin-secret-2026';

// ─────────────────────────────────────────────────────────────
// 4. EMAIL
// ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});
transporter.verify((err) => {
  if (err) console.error('EMAIL CONFIG ERROR:', err);
  else     console.log('✅ Email server ready');
});

// ─────────────────────────────────────────────────────────────
// 5. SCHEMAS
// ─────────────────────────────────────────────────────────────

// ── Users ──────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  full_name:      { type: String, required: true },
  username:       { type: String, unique: true, required: true },
  email:          { type: String, unique: true, required: true },
  password:       { type: String, required: true },
  role:           { type: String, enum: ['Administrator', 'Utility Staff', 'Maintenance Personnel'], default: 'Utility Staff' },
  account_status: { type: String, default: 'Active' },
  otp:            { type: String,  default: null },
  otpExpiry:      { type: Date,    default: null },
}, { timestamps: true });

// ── Bins ───────────────────────────────────────────────────
const sensorSubSchema = new mongoose.Schema({
  sensor_name: { type: String, required: true },
  health_pct:  { type: Number, default: 100 },
  status:      { type: String, enum: ['OK', 'Calibrate', 'Fault'], default: 'OK' },
  last_read:   { type: Date,   default: Date.now },
}, { _id: false });

const binSchema = new mongoose.Schema({
  bin_name:          { type: String, required: true },
  location:          { type: String, required: true },
  bin_type:          { type: String, enum: ['Biodegradable', 'Non-Biodegradable', 'Recyclable'], required: true },
  installation_area: { type: String },
  status:            { type: String, enum: ['Active', 'Full', 'Maintenance'], default: 'Active' },
  fill_level:        { type: Number, default: 0 },
  weight_kg:         { type: Number, default: 0 },
  max_capacity:      { type: Number, default: 100 },
  sensors:           { type: [sensorSubSchema], default: [] },
  last_updated:      { type: Date, default: Date.now },
});

// ── Waste Events ────────────────────────────────────────────
const wasteEventSchema = new mongoose.Schema({
  bin_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'Bin', required: true },
  detected_at: { type: Date, default: Date.now },
  waste_type:  { type: String, enum: ['Recyclable', 'Biodegradable', 'Non-Biodegradable'], required: true },
  item_label:  { type: String },
  weight_kg:   { type: Number, default: 0 },
  confidence:  { type: Number, default: 1 },
  result:      { type: String, enum: ['Classified', 'Fallback'], default: 'Classified' },
});
wasteEventSchema.index({ bin_id: 1, detected_at: -1 });

// ── Charging Ports ──────────────────────────────────────────
const chargingPortSchema = new mongoose.Schema({
  name:   { type: String, required: true },
  status: { type: String, enum: ['Available', 'In use', 'Offline'], default: 'Available' },
  detail: { type: String },
});

// ── Reward Sessions ─────────────────────────────────────────
const rewardSessionSchema = new mongoose.Schema({
  event_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'WasteEvent',   required: true },
  port_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'ChargingPort', required: true },
  started_at:   { type: Date, default: Date.now },
  duration_min: { type: Number, default: 20 },
  result:       { type: String, enum: ['Granted', 'Declined'], default: 'Granted' },
});
rewardSessionSchema.index({ started_at: -1 });

// ── Collection Logs ─────────────────────────────────────────
const collectionLogSchema = new mongoose.Schema({
  bin_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Bin',  required: true },
  staff_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collected_at: { type: Date, default: Date.now },
  waste_type:   { type: String },
  weight_kg:    { type: Number, default: 0 },
  destination:  { type: String },
  status:       { type: String, enum: ['Done', 'Partial'], default: 'Done' },
});
collectionLogSchema.index({ bin_id: 1, collected_at: -1 });

// ── Maintenance Logs ────────────────────────────────────────
const maintenanceLogSchema = new mongoose.Schema({
  bin_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Bin',  required: true },
  staff_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performed_on: { type: Date, default: Date.now },
  type:         { type: String, enum: ['Inspection', 'Calibration', 'Repair'], required: true },
  description:  { type: String },
  status:       { type: String, enum: ['Done', 'Pending', 'Scheduled'], default: 'Done' },
});
maintenanceLogSchema.index({ bin_id: 1 });

// ── Maintenance Requests ────────────────────────────────────
const maintenanceRequestSchema = new mongoose.Schema({
  bin_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Bin',  required: true },
  submitted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:        { type: String, required: true },
  type:         { type: String, enum: ['Inspection', 'Calibration', 'Repair'], default: 'Inspection' },
  description:  { type: String },
  priority:     { type: String, enum: ['High', 'Normal'], default: 'Normal' },
  status:       { type: String, enum: ['Pending', 'Done'], default: 'Pending' },
}, { timestamps: true });

// ── Settings ────────────────────────────────────────────────
const settingsSchema = new mongoose.Schema({
  fullThreshold:     { type: Number,   default: 90 },
  nearFullThreshold: { type: Number,   default: 75 },
  overflowThreshold: { type: Number,   default: 95 },
  collectionDays:    { type: [String], default: ['Tuesday', 'Saturday'] },
  collectionTime:    { type: String,   default: '14:00' },
  municipalPickup:   { type: [String], default: ['Tuesday', 'Saturday'] },
  odorEnabled:       { type: Boolean,  default: true },
  fanTriggerLevel:   { type: Number,   default: 60 },
  fanDuration:       { type: Number,   default: 10 },
  lowBatteryAlert:   { type: Number,   default: 20 },
  reducedModeLevel:  { type: Number,   default: 10 },
  rewardEnabled:     { type: Boolean,  default: true },
  chargingDuration:  { type: Number,   default: 20 },
  rewardWasteType:   { type: String,   default: 'Recyclable' },
  emailEnabled:      { type: Boolean,  default: true },
  emailAddress:      { type: String,   default: 'admin@pdm.edu.ph' },
  smsEnabled:        { type: Boolean,  default: false },
  smsNumber:         { type: String,   default: '' },
  notifyOnFull:      { type: Boolean,  default: true },
  notifyOnOverflow:  { type: Boolean,  default: true },
  notifyOnLowPower:  { type: Boolean,  default: true },
  adminName:         { type: String,   default: 'Eriza Enriquez-Santos' },
  updatedAt:         { type: Date,     default: Date.now },
});

// ─────────────────────────────────────────────────────────────
// 6. MODELS
// ─────────────────────────────────────────────────────────────
const User               = mongoose.model('User',               userSchema);
const Bin                = mongoose.model('Bin',                binSchema);
const WasteEvent         = mongoose.model('WasteEvent',         wasteEventSchema);
const ChargingPort       = mongoose.model('ChargingPort',       chargingPortSchema);
const RewardSession      = mongoose.model('RewardSession',      rewardSessionSchema);
const CollectionLog      = mongoose.model('CollectionLog',      collectionLogSchema);
const MaintenanceLog     = mongoose.model('MaintenanceLog',     maintenanceLogSchema);
const MaintenanceRequest = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
const Settings           = mongoose.model('Settings',           settingsSchema);

// ─────────────────────────────────────────────────────────────
// 7. AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────

// JWT — used by the React dashboard
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Admin-only guard — attach after auth
const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'Administrator')
    return res.status(403).json({ error: 'Admin only' });
  next();
};

// API key — used by the laptop detection script (no login needed)
const laptopAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== process.env.LAPTOP_API_KEY)
    return res.status(401).json({ error: 'Invalid API key' });
  next();
};

// ─────────────────────────────────────────────────────────────
// 8. HELPERS
// ─────────────────────────────────────────────────────────────
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
const mapBin      = (bin) => ({ ...bin.toObject(), bin_id: bin._id });

// ─────────────────────────────────────────────────────────────
// 9. SEED DATA
// ─────────────────────────────────────────────────────────────
async function seedData() {
  try {
    if (await User.countDocuments({ username: 'admin' }) === 0) {
      await User.insertMany([
        {
          full_name: 'Eriza Enriquez-Santos',
          username:  'admin',
          email:     'admin@pdm.edu.ph',
          password:  await bcrypt.hash('password', 10),
          role:      'Administrator',
        },
        {
          full_name: 'Jimmy Capalad',
          username:  'staff',
          email:     'staff@pdm.edu.ph',
          password:  await bcrypt.hash('password', 10),
          role:      'Utility Staff',
        },
      ]);
      console.log('✅ Users seeded');
    }

    if (await Bin.countDocuments() === 0) {
      await Bin.insertMany([
        {
          bin_name: 'Bin-1', location: 'Building A', bin_type: 'Biodegradable',
          status: 'Active', fill_level: 45.5, weight_kg: 3.2,
          sensors: [
            { sensor_name: 'Ultrasonic', health_pct: 98, status: 'OK' },
            { sensor_name: 'Load Cell',  health_pct: 95, status: 'OK' },
          ],
        },
        {
          bin_name: 'Bin-2', location: 'Building A', bin_type: 'Non-Biodegradable',
          status: 'Full', fill_level: 92.3, weight_kg: 7.8,
          sensors: [
            { sensor_name: 'Ultrasonic', health_pct: 91, status: 'OK' },
            { sensor_name: 'Load Cell',  health_pct: 60, status: 'Calibrate' },
          ],
        },
        {
          bin_name: 'Bin-3', location: 'Building B', bin_type: 'Recyclable',
          status: 'Active', fill_level: 23.1, weight_kg: 1.5,
          sensors: [
            { sensor_name: 'Ultrasonic', health_pct: 99, status: 'OK' },
            { sensor_name: 'Load Cell',  health_pct: 97, status: 'OK' },
          ],
        },
      ]);
      console.log('✅ Bins seeded');
    }

    if (await ChargingPort.countDocuments() === 0) {
      await ChargingPort.insertMany([
        { name: 'Port A', status: 'Available' },
        { name: 'Port B', status: 'Available' },
        { name: 'Port C', status: 'Offline', detail: 'Cable damaged' },
      ]);
      console.log('✅ Charging ports seeded');
    }

    if (await Settings.countDocuments() === 0) {
      await Settings.create({});
      console.log('✅ Default settings created');
    }
  } catch (err) {
    console.log('Seed warning:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────
// 10. ROUTES
// ─────────────────────────────────────────────────────────────

// ── Health ─────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', database: 'MongoDB Atlas ✅', timestamp: new Date().toISOString() });
});

// ── Auth ───────────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields are required' });

    const exists = await User.findOne({
      $or: [{ username: username.trim() }, { email: email.trim().toLowerCase() }],
    });
    if (exists) return res.status(400).json({ error: 'Username or email already exists' });

    await User.create({
      full_name: username.trim(),
      username:  username.trim(),
      email:     email.trim().toLowerCase(),
      password:  await bcrypt.hash(password, 10),
      role:      'Utility Staff',
    });

    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('REGISTER ERROR:', err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user._id, fullName: user.full_name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(404).json({ error: 'Email not found' });

    const otp = generateOtp();
    user.otp      = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    await transporter.sendMail({
      from:    process.env.EMAIL_USER,
      to:      user.email,
      subject: 'E-Bin Password Reset OTP',
      html:    `<div style="font-family:Arial,sans-serif;padding:20px">
                  <h2>E-Bin Password Reset</h2>
                  <p>Your OTP code is:</p>
                  <h1 style="letter-spacing:4px">${otp}</h1>
                  <p>This code expires in 5 minutes.</p>
                </div>`,
    });

    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err);
    res.status(500).json({ error: err.message || 'Failed to send OTP' });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !user.otp)          return res.status(400).json({ error: 'No OTP request found' });
    if (user.otp !== otp.trim())     return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date() > user.otpExpiry) return res.status(400).json({ error: 'OTP has expired' });

    res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    console.error('VERIFY OTP ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ error: 'All fields are required' });

    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user || !user.otp)          return res.status(400).json({ error: 'No OTP request found' });
    if (user.otp !== otp.trim())     return res.status(400).json({ error: 'Invalid OTP' });
    if (new Date() > user.otpExpiry) return res.status(400).json({ error: 'OTP has expired' });

    user.password  = await bcrypt.hash(newPassword, 10);
    user.otp       = null;
    user.otpExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('RESET PASSWORD ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Dashboard ──────────────────────────────────────────────
app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalBins,
      fullBins,
      activeMaintenance,
      todayEvents,
      priorityBins,
      wasteLast7Days,
    ] = await Promise.all([
      Bin.countDocuments(),
      Bin.countDocuments({ status: 'Full' }),
      MaintenanceRequest.countDocuments({ status: 'Pending' }),
      WasteEvent.countDocuments({ detected_at: { $gte: today } }),
      Bin.find({ fill_level: { $gte: 75 } }).sort({ fill_level: -1 }).limit(5),
      WasteEvent.aggregate([
        { $match: { detected_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        { $group: {
          _id: { $dateToString: { format: '%a', date: '$detected_at' } },
          kg:  { $sum: '$weight_kg' },
        }},
        { $sort: { _id: 1 } },
        { $project: { _id: 0, day: '$_id', kg: { $round: ['$kg', 2] } } },
      ]),
    ]);

    const totalWasteToday = (await WasteEvent.aggregate([
      { $match: { detected_at: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$weight_kg' } } },
    ]))[0]?.total ?? 0;

    res.json({
      totalBins,
      fullBins,
      activeAlerts:    activeMaintenance,
      totalWasteToday: Math.round(totalWasteToday * 100) / 100,
      detectedToday:   todayEvents,
      bins:            priorityBins.map(mapBin),
      wasteLast7Days,
    });
  } catch (err) {
    console.error('DASHBOARD ERROR:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Bins ───────────────────────────────────────────────────

app.get('/api/bins', auth, async (req, res) => {
  try {
    const bins = await Bin.find().sort({ location: 1 });
    res.json(bins.map(mapBin));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/bins/:id', auth, async (req, res) => {
  try {
    const bin = await Bin.findById(req.params.id);
    if (!bin) return res.status(404).json({ error: 'Bin not found' });
    res.json(mapBin(bin));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/bins/:id', auth, adminOnly, async (req, res) => {
  try {
    const allowed = ['bin_name', 'location', 'bin_type', 'installation_area', 'status', 'max_capacity', 'sensors'];
    const update  = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    update.last_updated = new Date();

    const bin = await Bin.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!bin) return res.status(404).json({ error: 'Bin not found' });
    res.json(mapBin(bin));
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/bins/:id/reset', auth, async (req, res) => {
  try {
    const bin = await Bin.findByIdAndUpdate(
      req.params.id,
      { status: 'Active', fill_level: 0, weight_kg: 0, last_updated: new Date() },
      { new: true }
    );
    if (!bin) return res.status(404).json({ error: 'Bin not found' });
    res.json({ message: 'Bin reset successfully', bin: mapBin(bin) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Waste Events ───────────────────────────────────────────

// POST — laptop detection script uses x-api-key (no JWT needed)
app.post('/api/waste-events', laptopAuth, async (req, res) => {
  try {
    const {
      bin_id,
      waste_type,
      item_label,
      weight_kg  = 0,
      confidence = 1,
      result     = 'Classified',
    } = req.body;

    if (!bin_id || !waste_type)
      return res.status(400).json({ error: 'bin_id and waste_type are required' });

    const bin = await Bin.findById(bin_id);
    if (!bin) return res.status(404).json({ error: 'Bin not found' });

    // 1. Insert waste event
    const event = await WasteEvent.create({
      bin_id, waste_type, item_label, weight_kg, confidence, result,
    });

    // 2. Update bin fill level and weight
    // Adjust the multiplier (×2) to match your actual sensor calibration
    const newFill   = Math.min(100, bin.fill_level + (weight_kg * 2));
    const newStatus = newFill >= 90 ? 'Full' : bin.status;
    await Bin.findByIdAndUpdate(bin_id, {
      $inc: { weight_kg: weight_kg },
      fill_level:   newFill,
      status:       newStatus,
      last_updated: new Date(),
    });

    // 3. Check if reward should be granted
    const settings = await Settings.findOne();
    if (
      result === 'Classified' &&
      settings?.rewardEnabled &&
      (settings.rewardWasteType === 'Any' || settings.rewardWasteType === waste_type)
    ) {
      const port = await ChargingPort.findOne({ status: 'Available' });
      if (port) {
        await RewardSession.create({
          event_id:     event._id,
          port_id:      port._id,
          duration_min: settings.chargingDuration,
          result:       'Granted',
        });
        await ChargingPort.findByIdAndUpdate(port._id, { status: 'In use' });
      }
    }

    res.status(201).json({ message: 'Waste event recorded', event });
  } catch (err) {
    console.error('WASTE EVENT ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET — React dashboard uses JWT
app.get('/api/waste-events', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.bin_id)     filter.bin_id     = req.query.bin_id;
    if (req.query.waste_type) filter.waste_type = req.query.waste_type;
    if (req.query.result)     filter.result     = req.query.result;

    const events = await WasteEvent.find(filter)
      .sort({ detected_at: -1 })
      .limit(Number(req.query.limit) || 100)
      .populate('bin_id', 'bin_name bin_type');

    const shaped = events.map((e) => ({
      id:     e._id,
      time:   e.detected_at.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
      bin:    e.bin_id?.bin_name ?? '—',
      type:   e.waste_type,
      item:   e.item_label ?? '—',
      weight: `${e.weight_kg.toFixed(2)} kg`,
      result: e.result,
    }));

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Collection Logs ────────────────────────────────────────

app.get('/api/collection-logs', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.bin_id)     filter.bin_id     = req.query.bin_id;
    if (req.query.waste_type) filter.waste_type = req.query.waste_type;
    if (req.query.status)     filter.status     = req.query.status;

    const logs = await CollectionLog.find(filter)
      .sort({ collected_at: -1 })
      .limit(Number(req.query.limit) || 100)
      .populate('bin_id',   'bin_name bin_type')
      .populate('staff_id', 'full_name');

    const shaped = logs.map((l) => ({
      id:          l._id,
      datetime:    l.collected_at.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
      bin:         l.bin_id?.bin_name    ?? '—',
      staff:       l.staff_id?.full_name ?? '—',
      type:        l.waste_type          ?? '—',
      weight:      `${l.weight_kg.toFixed(2)} kg`,
      destination: l.destination         ?? '—',
      status:      l.status,
    }));

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/collection-logs', auth, async (req, res) => {
  try {
    const { bin_id, waste_type, weight_kg = 0, destination, status = 'Done' } = req.body;
    if (!bin_id) return res.status(400).json({ error: 'bin_id is required' });

    const log = await CollectionLog.create({
      bin_id,
      staff_id: req.user.userId,
      waste_type,
      weight_kg,
      destination,
      status,
    });

    if (status === 'Done') {
      await Bin.findByIdAndUpdate(bin_id, {
        fill_level:   0,
        weight_kg:    0,
        status:       'Active',
        last_updated: new Date(),
      });
    }

    res.status(201).json({ message: 'Collection logged', log });
  } catch (err) {
    console.error('COLLECTION LOG ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Reward Sessions ────────────────────────────────────────

app.get('/api/reward-sessions', auth, async (req, res) => {
  try {
    const sessions = await RewardSession.find()
      .sort({ started_at: -1 })
      .limit(Number(req.query.limit) || 50)
      .populate({ path: 'event_id', populate: { path: 'bin_id', select: 'bin_name bin_type' } })
      .populate('port_id', 'name');

    const shaped = sessions.map((s) => ({
      id:        s._id,
      time:      s.started_at.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }),
      bin:       s.event_id?.bin_id?.bin_name ?? '—',
      wasteType: s.event_id?.waste_type       ?? '—',
      port:      s.port_id?.name              ?? '—',
      duration:  `${s.duration_min} min`,
      result:    s.result,
    }));

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/reward-sessions/:id/close', auth, async (req, res) => {
  try {
    const session = await RewardSession.findById(req.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    await ChargingPort.findByIdAndUpdate(session.port_id, { status: 'Available' });
    res.json({ message: 'Session closed, port freed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Charging Ports ─────────────────────────────────────────

app.get('/api/charging-ports', auth, async (req, res) => {
  try {
    const ports = await ChargingPort.find().sort({ name: 1 });
    res.json(ports);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/charging-ports/:id/status', auth, adminOnly, async (req, res) => {
  try {
    const { status, detail } = req.body;
    const port = await ChargingPort.findByIdAndUpdate(
      req.params.id,
      { status, detail },
      { new: true }
    );
    if (!port) return res.status(404).json({ error: 'Port not found' });
    res.json(port);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Maintenance Requests ───────────────────────────────────

app.get('/api/maintenance-requests', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.bin_id) filter.bin_id = req.query.bin_id;

    const requests = await MaintenanceRequest.find(filter)
      .sort({ createdAt: -1 })
      .populate('bin_id',       'bin_name location')
      .populate('submitted_by', 'full_name');

    const shaped = requests.map((r) => ({
      id:          r._id,
      title:       r.title,
      bin:         r.bin_id?.bin_name ?? '—',
      description: r.description     ?? '',
      priority:    r.priority,
      status:      r.status,
      type:        r.type,
    }));

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/maintenance-requests', auth, async (req, res) => {
  try {
    const { bin_id, title, type = 'Inspection', description, priority = 'Normal' } = req.body;
    if (!bin_id || !title)
      return res.status(400).json({ error: 'bin_id and title are required' });

    const request = await MaintenanceRequest.create({
      bin_id,
      submitted_by: req.user.userId,
      title,
      type,
      description,
      priority,
    });
    res.status(201).json({ message: 'Request submitted', request });
  } catch (err) {
    console.error('MAINTENANCE REQUEST ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/maintenance-requests/:id/resolve', auth, async (req, res) => {
  try {
    const request = await MaintenanceRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    request.status = 'Done';
    await request.save();

    await MaintenanceLog.create({
      bin_id:      request.bin_id,
      staff_id:    req.user.userId,
      type:        request.type,
      description: request.description,
      status:      'Done',
    });

    res.json({ message: 'Request resolved and logged' });
  } catch (err) {
    console.error('RESOLVE ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Maintenance Logs ───────────────────────────────────────

app.get('/api/maintenance-logs', auth, async (req, res) => {
  try {
    const filter = {};
    if (req.query.bin_id) filter.bin_id = req.query.bin_id;
    if (req.query.type)   filter.type   = req.query.type;

    const logs = await MaintenanceLog.find(filter)
      .sort({ performed_on: -1 })
      .limit(Number(req.query.limit) || 100)
      .populate('bin_id',   'bin_name location')
      .populate('staff_id', 'full_name');

    const shaped = logs.map((l) => ({
      id:          l._id,
      date:        l.performed_on.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila' }),
      type:        l.type,
      bin:         l.bin_id?.bin_name    ?? '—',
      description: l.description        ?? '',
      staff:       l.staff_id?.full_name ?? '—',
      status:      l.status,
    }));

    res.json(shaped);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Settings ───────────────────────────────────────────────

app.get('/api/settings', auth, async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/settings', auth, adminOnly, async (req, res) => {
  try {
    const settings = await Settings.findOneAndUpdate(
      {},
      { ...req.body, updatedAt: new Date() },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ message: 'Settings saved', settings });
  } catch (err) {
    console.error('SETTINGS ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// ── Reports ────────────────────────────────────────────────

app.get('/api/reports', auth, async (req, res) => {
  try {
    const { period = 'weekly' } = req.query;

    const FORMAT = {
      daily:   { fmt: '%Y-%m-%d', days: 7   },
      weekly:  { fmt: '%Y-W%V',   days: 56  },
      monthly: { fmt: '%Y-%m',    days: 365 },
    };

    const cfg   = FORMAT[period] || FORMAT.weekly;
    const since = new Date(Date.now() - cfg.days * 24 * 60 * 60 * 1000);

    const rows = await WasteEvent.aggregate([
      { $match: { detected_at: { $gte: since } } },
      { $group: {
        _id:           { $dateToString: { format: cfg.fmt, date: '$detected_at' } },
        recyclable:    { $sum: { $cond: [{ $eq: ['$waste_type', 'Recyclable']          }, '$weight_kg', 0] } },
        nonRecyclable: { $sum: { $cond: [{ $eq: ['$waste_type', 'Non-Biodegradable']   }, '$weight_kg', 0] } },
        general:       { $sum: { $cond: [{ $eq: ['$waste_type', 'Biodegradable']       }, '$weight_kg', 0] } },
      }},
      { $sort: { _id: 1 } },
      { $project: {
        _id:           0,
        label:         '$_id',
        recyclable:    { $round: ['$recyclable',    2] },
        nonRecyclable: { $round: ['$nonRecyclable', 2] },
        general:       { $round: ['$general',       2] },
      }},
    ]);

    res.json(rows);
  } catch (err) {
    console.error('REPORTS ERROR:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── Test email ─────────────────────────────────────────────
app.get('/api/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from:    process.env.EMAIL_USER,
      to:      process.env.EMAIL_USER,
      subject: 'Test Email',
      text:    'Email setup is working.',
    });
    res.json({ message: 'Test email sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 11. START
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 E-Bin Backend: http://localhost:${PORT}`);
  console.log(`📊 Health:        http://localhost:${PORT}/api/health`);
  seedData();
});