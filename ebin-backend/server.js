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
  event_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'WasteEvent', required: true },
  port_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'ChargingPort', required: true },
  user_id:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  started_at:   { type: Date, default: Date.now },
  duration_min: { type: Number, default: 20 },
  result:       { type: String, enum: ['Granted', 'Declined', 'Pending'], default: 'Pending' },
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
// 7. AUTH MIDDLEWARE (DEFINED BEFORE ROUTES)
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
// 9. PUBLIC ENDPOINTS (NO AUTH REQUIRED)
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
// 10. AUTH ROUTES (NO AUTH NEEDED)
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
// DEBUG ENDPOINTS (Check database connections)
// ─────────────────────────────────────────────────────────────

// Debug endpoint to check collection logs data (NO AUTH for testing)
app.get('/api/debug/collections', async (req, res) => {
  try {
    const count = await CollectionLog.countDocuments();
    const allLogs = await CollectionLog.find().limit(10);
    res.json({
      success: true,
      count: count,
      logs: allLogs,
      message: `Found ${count} collection logs in database`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check reward sessions data (NO AUTH for testing)
app.get('/api/debug/rewards', async (req, res) => {
  try {
    const count = await RewardSession.countDocuments();
    const allRewards = await RewardSession.find().limit(10);
    res.json({
      success: true,
      count: count,
      rewards: allRewards,
      message: `Found ${count} reward sessions in database`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint to check all collections
app.get('/api/debug/all', async (req, res) => {
  try {
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    const stats = {};
    for (const name of collectionNames) {
      const count = await mongoose.connection.db.collection(name).countDocuments();
      stats[name] = count;
    }
    
    res.json({
      success: true,
      collections: collectionNames,
      counts: stats
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 11. COLLECTION LOGS ROUTES (AUTH REQUIRED)
// ─────────────────────────────────────────────────────────────

// Get all collection logs
app.get('/api/collections', auth, async (req, res) => {
  try {
    const logs = await CollectionLog.find()
      .sort({ collected_at: -1 })
      .populate('bin_id', 'bin_name location')
      .populate('staff_id', 'full_name');
    
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single collection log
app.get('/api/collections/:id', auth, async (req, res) => {
  try {
    const log = await CollectionLog.findById(req.params.id)
      .populate('bin_id', 'bin_name location')
      .populate('staff_id', 'full_name');
    
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

// Update collection log
app.put('/api/collections/:id', auth, async (req, res) => {
  try {
    const log = await CollectionLog.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!log) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, data: log });
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

// Collection stats
app.get('/api/collections/stats/dashboard', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayCount = await CollectionLog.countDocuments({ collected_at: { $gte: today } });
    const totalWeight = await CollectionLog.aggregate([{ $group: { _id: null, total: { $sum: '$weight_kg' } } }]);
    
    res.json({
      success: true,
      data: {
        today: { totalCollections: todayCount, totalWeight: totalWeight[0]?.total || 0 },
        binsNeedingCollection: await Bin.countDocuments({ fill_level: { $gte: 75 } }),
        nextPickup: 'Tuesday'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint for collections
app.get('/api/collections/test', auth, async (req, res) => {
  try {
    const count = await CollectionLog.countDocuments();
    const sample = await CollectionLog.findOne().populate('bin_id', 'bin_name').populate('staff_id', 'full_name');
    res.json({ success: true, count, sample });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// 12. REWARD SESSIONS ROUTES (AUTH REQUIRED)
// ─────────────────────────────────────────────────────────────

// Get user's rewards
app.get('/api/rewards/my-rewards', auth, async (req, res) => {
  try {
    const rewards = await RewardSession.find({ user_id: req.user.userId })
      .sort({ started_at: -1 })
      .populate('event_id', 'waste_type weight_kg')
      .populate('port_id', 'name');
    
    const user = await User.findById(req.user.userId);
    
    res.json({
      success: true,
      data: rewards,
      stats: {
        totalPoints: user?.points || 0,
        totalRewards: rewards.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all rewards (admin)
app.get('/api/rewards/all', auth, async (req, res) => {
  try {
    const rewards = await RewardSession.find()
      .sort({ started_at: -1 })
      .populate('user_id', 'full_name username')
      .populate('event_id', 'waste_type weight_kg')
      .populate('port_id', 'name');
    
    res.json({ success: true, data: rewards });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single reward
app.get('/api/rewards/:id', auth, async (req, res) => {
  try {
    const reward = await RewardSession.findById(req.params.id)
      .populate('user_id', 'full_name')
      .populate('event_id', 'waste_type weight_kg')
      .populate('port_id', 'name');
    
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
    await User.findByIdAndUpdate(req.user.userId, { $inc: { points: points_earned || 10 } });
    
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

// Redeem points
app.post('/api/rewards/redeem', auth, async (req, res) => {
  try {
    const { pointsToRedeem, rewardItem } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (user.points < pointsToRedeem) {
      return res.status(400).json({ success: false, error: 'Insufficient points' });
    }
    
    await User.findByIdAndUpdate(req.user.userId, { $inc: { points: -pointsToRedeem } });
    
    const reward = new RewardSession({
      user_id: req.user.userId,
      points_earned: -pointsToRedeem,
      reward_type: 'points_redeemed',
      result: 'Granted',
      description: `Redeemed ${pointsToRedeem} points for ${rewardItem}`
    });
    await reward.save();
    
    res.json({ success: true, message: 'Points redeemed', remainingPoints: user.points - pointsToRedeem });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reward dashboard stats
app.get('/api/rewards/dashboard/stats', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayCount = await RewardSession.countDocuments({ started_at: { $gte: today }, result: 'Granted' });
    const totalPoints = await RewardSession.aggregate([
      { $match: { result: 'Granted' } },
      { $group: { _id: null, total: { $sum: '$points_earned' } } }
    ]);
    
    res.json({
      success: true,
      data: {
        today: { granted: todayCount, pointsEarned: 0 },
        activeSessions: 0,
        total: { granted: await RewardSession.countDocuments({ result: 'Granted' }), totalPoints: totalPoints[0]?.total || 0 }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint for rewards
app.get('/api/rewards/test', auth, async (req, res) => {
  try {
    const count = await RewardSession.countDocuments();
    const sample = await RewardSession.findOne().populate('user_id', 'full_name');
    res.json({ success: true, count, sample });
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
});