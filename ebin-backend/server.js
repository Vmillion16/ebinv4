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
  .then(() => {
    console.log('✅ MongoDB Connected!');
    console.log('📊 Database name:', mongoose.connection.name);
  })
  .catch(err => { 
    console.error('❌ MongoDB Error:', err.message);
    process.exit(1); 
  });

const SECRET_KEY = process.env.JWT_SECRET || 'ebin-secret-2026';

// ─────────────────────────────────────────────────────────────
// 4. EMAIL
// ─────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
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
  points:         { type: Number, default: 0 },
  total_rewards:  { type: Number, default: 0 },
  last_reward_at: { type: Date },
  otp:            { type: String,  default: null },
  otpExpiry:      { type: Date,    default: null },
}, { timestamps: true });

// ── Bins ───────────────────────────────────────────────────
const binSchema = new mongoose.Schema({
  bin_name:          { type: String, required: true },
  location:          { type: String, required: true },
  bin_type:          { type: String, enum: ['Biodegradable', 'Non-Biodegradable', 'Recyclable'], required: true },
  installation_area: { type: String },
  status:            { type: String, enum: ['Active', 'Full', 'Maintenance'], default: 'Active' },
  fill_level:        { type: Number, default: 0 },
  weight_kg:         { type: Number, default: 0 },
  max_capacity:      { type: Number, default: 100 },
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

// ── Collection Logs ─────────────────────────────────────────
const collectionLogSchema = new mongoose.Schema({
  bin_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Bin', required: true },
  staff_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  collected_at: { type: Date, default: Date.now },
  waste_type:   { type: String, enum: ['Recyclable', 'Biodegradable', 'Non-Biodegradable'], required: true },
  weight_kg:    { type: Number, required: true },
  destination:  { type: String, default: 'Recycling Center' },
  status:       { type: String, enum: ['Done', 'Partial'], default: 'Done' },
  notes:        { type: String, default: '' },
});

// ── Reward Sessions ─────────────────────────────────────────
const rewardSessionSchema = new mongoose.Schema({
  event_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'WasteEvent' },
  port_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'ChargingPort' },
  user_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  started_at:   { type: Date, default: Date.now },
  duration_min: { type: Number, default: 20 },
  result:       { type: String, enum: ['Granted', 'Declined', 'Pending'], default: 'Granted' },
  points_earned: { type: Number, default: 0 },
  reward_type:  { type: String, default: 'disposal_reward' },
  description:  { type: String, default: '' },
  ended_at:     { type: Date },
});

// ── Charging Ports ──────────────────────────────────────────
const chargingPortSchema = new mongoose.Schema({
  name:   { type: String, required: true, unique: true },
  status: { type: String, enum: ['Available', 'In use', 'Offline'], default: 'Available' },
  detail: { type: String, default: '' },
});

// ── Maintenance Requests ────────────────────────────────────
const maintenanceRequestSchema = new mongoose.Schema({
  bin_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Bin', required: true },
  submitted_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:        { type: String, required: true },
  type:         { type: String, default: 'Inspection' },
  description:  { type: String },
  priority:     { type: String, enum: ['High', 'Normal'], default: 'Normal' },
  status:       { type: String, enum: ['Pending', 'Done'], default: 'Pending' },
}, { timestamps: true });

// ── Maintenance Logs ────────────────────────────────────────
const maintenanceLogSchema = new mongoose.Schema({
  bin_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'Bin', required: true },
  staff_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  performed_on: { type: Date, default: Date.now },
  type:         { type: String, required: true },
  description:  { type: String },
  status:       { type: String, default: 'Done' },
});

// ── Settings ────────────────────────────────────────────────
const settingsSchema = new mongoose.Schema({
  fullThreshold:     { type: Number, default: 90 },
  nearFullThreshold: { type: Number, default: 75 },
  rewardEnabled:     { type: Boolean, default: true },
  chargingDuration:  { type: Number, default: 20 },
  adminName:         { type: String, default: 'Eriza Enriquez-Santos' },
  updatedAt:         { type: Date, default: Date.now },
});

// ─────────────────────────────────────────────────────────────
// 6. MODELS
// ─────────────────────────────────────────────────────────────
const User               = mongoose.model('User', userSchema);
const Bin                = mongoose.model('Bin', binSchema);
const WasteEvent         = mongoose.model('WasteEvent', wasteEventSchema);
const CollectionLog      = mongoose.model('CollectionLog', collectionLogSchema);
const RewardSession      = mongoose.model('RewardSession', rewardSessionSchema);
const ChargingPort       = mongoose.model('ChargingPort', chargingPortSchema);
const MaintenanceRequest = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);
const MaintenanceLog     = mongoose.model('MaintenanceLog', maintenanceLogSchema);
const Settings           = mongoose.model('Settings', settingsSchema);

// ─────────────────────────────────────────────────────────────
// 7. AUTH MIDDLEWARE
// ─────────────────────────────────────────────────────────────
const auth = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'Administrator')
    return res.status(403).json({ error: 'Admin only' });
  next();
};

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
const mapBin = (bin) => ({ ...bin.toObject(), bin_id: bin._id });

// ─────────────────────────────────────────────────────────────
// 9. PUBLIC ENDPOINTS
// ─────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', database: 'MongoDB Atlas ✅', timestamp: new Date().toISOString() });
});

// Public bins endpoint
app.get('/api/bins/public/dashboard', async (req, res) => {
  try {
    const bins = await Bin.find().sort({ location: 1 });
    res.json({
      success: true,
      bins: bins.map(bin => ({
        _id: bin._id,
        bin_name: bin.bin_name,
        bin_type: bin.bin_type,
        fillLevel: bin.fill_level,
        status: bin.status,
        location: bin.location,
        weight_kg: bin.weight_kg
      })),
      wasteLast7Days: [
        { day: 'Mon', kg: 0 }, { day: 'Tue', kg: 0 }, { day: 'Wed', kg: 0 },
        { day: 'Thu', kg: 0 }, { day: 'Fri', kg: 0 }, { day: 'Sat', kg: 0 }, { day: 'Sun', kg: 0 }
      ]
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Public waste events endpoint
app.get('/api/waste-events/public/latest', async (req, res) => {
  try {
    const events = await WasteEvent.find().sort({ detected_at: -1 }).limit(50).populate('bin_id', 'bin_name');
    res.json({
      success: true,
      count: events.length,
      events: events.map(e => ({
        id: e._id,
        time: e.detected_at,
        bin: e.bin_id?.bin_name || 'Unknown',
        type: e.waste_type,
        item: e.item_label || '—',
        weight: `${e.weight_kg} kg`,
        result: e.result
      }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 10. AUTH ROUTES
// ─────────────────────────────────────────────────────────────

app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(400).json({ error: 'Username or email already exists' });

    const user = new User({
      full_name: username,
      username,
      email: email.toLowerCase(),
      password: await bcrypt.hash(password, 10),
      role: 'Utility Staff'
    });
    await user.save();
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await bcrypt.compare(password, user.password)))
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, user: { id: user._id, fullName: user.full_name, email: user.email, role: user.role, points: user.points } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(404).json({ error: 'Email not found' });

    const otp = generateOtp();
    user.otp = otp;
    user.otpExpiry = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'E-Bin Password Reset OTP',
      html: `<h2>Your OTP code is: ${otp}</h2><p>Expires in 5 minutes.</p>`
    });

    res.json({ message: 'OTP sent to your email' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.otp !== otp || new Date() > user.otpExpiry)
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    res.json({ message: 'OTP verified successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || user.otp !== otp || new Date() > user.otpExpiry)
      return res.status(400).json({ error: 'Invalid or expired OTP' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.otp = null;
    user.otpExpiry = null;
    await user.save();
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 11. COLLECTION LOGS ROUTES (WORKING VERSION)
// ─────────────────────────────────────────────────────────────

// Get all collection logs - PUBLIC for testing
app.get('/api/collections', async (req, res) => {
  try {
    const logs = await CollectionLog.find()
      .sort({ collected_at: -1 })
      .populate('bin_id', 'bin_name location')
      .populate('staff_id', 'full_name username');
    
    // Format data for frontend
    const formattedLogs = logs.map(log => ({
      id: log._id,
      datetime: log.collected_at,
      bin: log.bin_id?.bin_name || 'Unknown Bin',
      staff: log.staff_id?.full_name || 'Staff',
      type: log.waste_type,
      weight: `${log.weight_kg} kg`,
      status: log.status,
      destination: log.destination || 'Recycling Center'
    }));
    
    // Calculate statistics
    const totalWeight = logs.reduce((sum, log) => sum + (log.weight_kg || 0), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = logs.filter(log => new Date(log.collected_at) >= today);
    const todayWeight = todayLogs.reduce((sum, log) => sum + (log.weight_kg || 0), 0);
    
    res.json({
      success: true,
      data: formattedLogs,
      stats: {
        totalCollections: logs.length,
        totalWeight: totalWeight,
        todayCollections: todayLogs.length,
        todayWeight: todayWeight,
        binsNeedingCollection: await Bin.countDocuments({ fill_level: { $gte: 75 } })
      }
    });
  } catch (error) {
    console.error('Error fetching collection logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single collection log
app.get('/api/collections/:id', async (req, res) => {
  try {
    const log = await CollectionLog.findById(req.params.id)
      .populate('bin_id', 'bin_name location')
      .populate('staff_id', 'full_name username');
    
    if (!log) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create collection log
app.post('/api/collections', auth, async (req, res) => {
  try {
    const { bin_id, waste_type, weight_kg, destination, status } = req.body;
    
    const log = new CollectionLog({
      bin_id,
      staff_id: req.user.userId,
      waste_type,
      weight_kg,
      destination: destination || 'Recycling Center',
      status: status || 'Done'
    });
    
    await log.save();
    
    // Reset bin after collection
    await Bin.findByIdAndUpdate(bin_id, { fill_level: 0, weight_kg: 0, status: 'Active' });
    
    res.status(201).json({ success: true, data: log });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete collection log
app.delete('/api/collections/:id', auth, async (req, res) => {
  try {
    const log = await CollectionLog.findByIdAndDelete(req.params.id);
    if (!log) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Collection dashboard stats
app.get('/api/collections/stats/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalCollections = await CollectionLog.countDocuments();
    const todayCollections = await CollectionLog.countDocuments({ collected_at: { $gte: today } });
    const totalWeight = await CollectionLog.aggregate([{ $group: { _id: null, total: { $sum: '$weight_kg' } } }]);
    const todayWeight = await CollectionLog.aggregate([
      { $match: { collected_at: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$weight_kg' } } }
    ]);
    
    res.json({
      success: true,
      data: {
        total: { collections: totalCollections, weight: totalWeight[0]?.total || 0 },
        today: { collections: todayCollections, weight: todayWeight[0]?.total || 0 },
        binsNeedingCollection: await Bin.countDocuments({ fill_level: { $gte: 75 } }),
        nextPickup: 'Tuesday, Saturday'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 12. REWARD SESSIONS ROUTES (WORKING VERSION)
// ─────────────────────────────────────────────────────────────

// Get all reward sessions - PUBLIC for testing
app.get('/api/rewards', async (req, res) => {
  try {
    const rewards = await RewardSession.find()
      .sort({ started_at: -1 })
      .populate('event_id', 'waste_type weight_kg')
      .populate('port_id', 'name');
    
    // Format data for frontend
    const formattedRewards = rewards.map(reward => ({
      id: reward._id,
      time: reward.started_at,
      duration: `${reward.duration_min} min`,
      result: reward.result,
      port: reward.port_id?.name || 'Unknown Port',
      wasteType: reward.event_id?.waste_type || 'Unknown',
      weight: reward.event_id?.weight_kg ? `${reward.event_id.weight_kg} kg` : '—',
      points: reward.points_earned
    }));
    
    // Calculate statistics
    const grantedRewards = rewards.filter(r => r.result === 'Granted');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRewards = rewards.filter(r => new Date(r.started_at) >= today && r.result === 'Granted');
    
    res.json({
      success: true,
      data: formattedRewards,
      stats: {
        totalRewards: rewards.length,
        grantedRewards: grantedRewards.length,
        todayRewards: todayRewards.length,
        totalPoints: grantedRewards.reduce((sum, r) => sum + (r.points_earned || 0), 0),
        activeSessions: await ChargingPort.countDocuments({ status: 'In use' })
      }
    });
  } catch (error) {
    console.error('Error fetching rewards:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single reward session
app.get('/api/rewards/:id', async (req, res) => {
  try {
    const reward = await RewardSession.findById(req.params.id)
      .populate('event_id', 'waste_type weight_kg item_label')
      .populate('port_id', 'name status');
    
    if (!reward) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: reward });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create reward session
app.post('/api/rewards', auth, async (req, res) => {
  try {
    const { event_id, port_id, duration_min, points_earned } = req.body;
    
    const reward = new RewardSession({
      event_id,
      port_id,
      user_id: req.user.userId,
      duration_min: duration_min || 20,
      points_earned: points_earned || 10,
      result: 'Granted',
      started_at: new Date()
    });
    
    await reward.save();
    
    // Update user points
    await User.findByIdAndUpdate(req.user.userId, { $inc: { points: points_earned || 10, total_rewards: 1 } });
    
    res.status(201).json({ success: true, data: reward });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// End reward session
app.put('/api/rewards/:id/end', auth, async (req, res) => {
  try {
    const reward = await RewardSession.findById(req.params.id);
    if (!reward) return res.status(404).json({ success: false, error: 'Not found' });
    
    reward.ended_at = new Date();
    reward.duration_min = Math.ceil((reward.ended_at - reward.started_at) / 60000);
    await reward.save();
    
    // Release charging port
    if (reward.port_id) {
      await ChargingPort.findByIdAndUpdate(reward.port_id, { status: 'Available' });
    }
    
    res.json({ success: true, data: reward });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reward dashboard stats
app.get('/api/rewards/dashboard/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const totalRewards = await RewardSession.countDocuments({ result: 'Granted' });
    const todayRewards = await RewardSession.countDocuments({ started_at: { $gte: today }, result: 'Granted' });
    const totalPoints = await RewardSession.aggregate([
      { $match: { result: 'Granted' } },
      { $group: { _id: null, total: { $sum: '$points_earned' } } }
    ]);
    const todayPoints = await RewardSession.aggregate([
      { $match: { started_at: { $gte: today }, result: 'Granted' } },
      { $group: { _id: null, total: { $sum: '$points_earned' } } }
    ]);
    
    res.json({
      success: true,
      data: {
        total: { granted: totalRewards, points: totalPoints[0]?.total || 0 },
        today: { granted: todayRewards, points: todayPoints[0]?.total || 0 },
        activeSessions: await ChargingPort.countDocuments({ status: 'In use' })
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 13. OTHER EXISTING ROUTES
// ─────────────────────────────────────────────────────────────

app.get('/api/dashboard', auth, async (req, res) => {
  try {
    const totalBins = await Bin.countDocuments();
    const fullBins = await Bin.countDocuments({ status: 'Full' });
    const priorityBins = await Bin.find({ fill_level: { $gte: 75 } }).sort({ fill_level: -1 }).limit(5);
    
    res.json({
      totalBins,
      fullBins,
      activeAlerts: 0,
      totalWasteToday: 0,
      detectedToday: 0,
      bins: priorityBins.map(mapBin),
      wasteLast7Days: []
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/bins', auth, async (req, res) => {
  const bins = await Bin.find().sort({ location: 1 });
  res.json(bins.map(mapBin));
});

app.get('/api/bins/:id', auth, async (req, res) => {
  const bin = await Bin.findById(req.params.id);
  if (!bin) return res.status(404).json({ error: 'Bin not found' });
  res.json(mapBin(bin));
});

app.put('/api/bins/:id/reset', auth, async (req, res) => {
  const bin = await Bin.findByIdAndUpdate(
    req.params.id,
    { status: 'Active', fill_level: 0, weight_kg: 0, last_updated: new Date() },
    { new: true }
  );
  res.json({ message: 'Bin reset successfully', bin: mapBin(bin) });
});

app.get('/api/waste-events', auth, async (req, res) => {
  const events = await WasteEvent.find().sort({ detected_at: -1 }).limit(100).populate('bin_id', 'bin_name');
  res.json(events);
});

app.get('/api/charging-ports', auth, async (req, res) => {
  const ports = await ChargingPort.find();
  res.json(ports);
});

app.get('/api/settings', auth, async (req, res) => {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  res.json(settings);
});

// ─────────────────────────────────────────────────────────────
// 14. SEED DATA
// ─────────────────────────────────────────────────────────────
async function seedData() {
  if (await User.countDocuments() === 0) {
    await User.create({
      full_name: 'Admin User',
      username: 'admin',
      email: 'admin@pdm.edu.ph',
      password: await bcrypt.hash('password', 10),
      role: 'Administrator'
    });
    console.log('✅ Admin user created');
  }
  
  if (await Bin.countDocuments() === 0) {
    await Bin.create([
      { bin_name: 'Bio Bin A', location: 'Building A', bin_type: 'Biodegradable', fill_level: 45, status: 'Active' },
      { bin_name: 'Bio Bin b', location: 'Building A', bin_type: 'Non-Biodegradable', fill_level: 80, status: 'Active' }
    ]);
    console.log('✅ Bins seeded');
  }
  
  if (await ChargingPort.countDocuments() === 0) {
    await ChargingPort.create([
      { name: 'Port A', status: 'Available' },
      { name: 'Port B', status: 'Available' }
    ]);
    console.log('✅ Charging ports seeded');
  }
}

seedData();

// ─────────────────────────────────────────────────────────────
// 15. START SERVER
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  console.log(`📋 Collections API: http://localhost:${PORT}/api/collections`);
  console.log(`🎁 Rewards API: http://localhost:${PORT}/api/rewards`);
});