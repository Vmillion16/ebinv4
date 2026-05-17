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
    console.log('🔗 Connection state:', mongoose.connection.readyState);
  })
  .catch(err => { 
    console.error('❌ MongoDB Error:', err.message);
    console.error('📝 Full error:', err);
    process.exit(1); 
  });

// Add connection event listeners
mongoose.connection.on('error', err => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

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
  points:         { type: Number, default: 0 },
  total_rewards:  { type: Number, default: 0 },
  last_reward_at: { type: Date },
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
  name: {
    type: String,
    required: true,
    unique: true
  },
  location: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['Available', 'In use', 'Offline', 'Maintenance'],
    default: 'Available'
  },
  current_session_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RewardSession'
  },
  total_sessions: {
    type: Number,
    default: 0
  },
  total_charging_minutes: {
    type: Number,
    default: 0
  },
  last_used_at: {
    type: Date
  },
  health_status: {
    type: String,
    enum: ['Good', 'Warning', 'Critical'],
    default: 'Good'
  },
  detail: {
    type: String,
    default: ''
  }
});

// ── Reward Sessions ─────────────────────────────────────────
// ── Reward Sessions ─────────────────────────────────────────
const rewardSessionSchema = new mongoose.Schema({
  event_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WasteEvent',
    required: true
  },
  port_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ChargingPort',
    required: true
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  started_at: {
    type: Date,
    default: Date.now
  },
  duration_min: {
    type: Number,
    default: 20
  },
  result: {
    type: String,
    enum: ['Granted', 'Declined', 'Pending'],
    default: 'Pending'
  },
  points_earned: {
    type: Number,
    default: 0
  },
  reward_type: {
    type: String,
    enum: ['disposal_reward', 'charging_reward', 'bonus', 'points_redeemed'],
    default: 'disposal_reward'
  },
  description: {
    type: String,
    default: ''
  },
  ended_at: {
    type: Date
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});
rewardSessionSchema.index({ user_id: 1, started_at: -1 });
rewardSessionSchema.index({ event_id: 1 });
rewardSessionSchema.index({ port_id: 1 });
rewardSessionSchema.index({ result: 1 });

// ── Collection Logs ─────────────────────────────────────────
const collectionLogSchema = new mongoose.Schema({
  bin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bin',
    required: true
  },
  staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collected_at: {
    type: Date,
    default: Date.now
  },
  waste_type: {
    type: String,
    enum: ['Recyclable', 'Biodegradable', 'Non-Biodegradable'],
    required: true
  },
  weight_kg: {
    type: Number,
    required: true,
    min: 0
  },
  destination: {
    type: String,
    default: 'Recycling Center'
  },
  status: {
    type: String,
    enum: ['Done', 'Partial', 'Scheduled', 'In Progress'],
    default: 'Done'
  },
  notes: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});
collectionLogSchema.index({ bin_id: 1, collected_at: -1 });
collectionLogSchema.index({ staff_id: 1 });

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

// ✅ ============================================================
// ✅ PUBLIC DASHBOARD ENDPOINT (NO AUTHENTICATION REQUIRED)
// ✅ ============================================================
app.get('/api/bins/public/dashboard', async (req, res) => {
  try {
    console.log('📊 Public dashboard requested');
    
    const bins = await Bin.find().sort({ location: 1 });
    
    // Calculate summary
    const totalFillLevel = bins.reduce((sum, bin) => sum + (bin.fill_level || 0), 0);
    const averageFillLevel = bins.length > 0 ? totalFillLevel / bins.length : 0;
    const criticalBins = bins.filter(bin => (bin.fill_level || 0) >= 85).length;
    const fullBins = bins.filter(bin => bin.status === 'Full').length;
    
    // Get last 7 days of waste events
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      
      const events = await WasteEvent.aggregate([
        {
          $match: {
            detected_at: { $gte: date, $lt: nextDay }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: '$weight_kg' }
          }
        }
      ]);
      
      last7Days.push({
        day: dayName,
        kg: events.length > 0 ? Math.round(events[0].total * 10) / 10 : 0
      });
    }
    
    // Get today's waste total
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTotal = await WasteEvent.aggregate([
      { $match: { detected_at: { $gte: today } } },
      { $group: { _id: null, total: { $sum: '$weight_kg' } } }
    ]);
    
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
      wasteLast7Days: last7Days,
      summary: {
        totalBins: bins.length,
        fullBins: fullBins,
        averageFillLevel: Math.round(averageFillLevel),
        criticalBins: criticalBins,
        totalWasteToday: todayTotal.length > 0 ? Math.round(todayTotal[0].total * 10) / 10 : 0,
        timestamp: new Date()
      }
    });
    
    console.log(`✅ Public dashboard data sent: ${bins.length} bins`);
  } catch (err) {
    console.error('Public dashboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ ============================================================
// ✅ PUBLIC WASTE EVENTS ENDPOINT (NO AUTHENTICATION REQUIRED)
// ✅ ============================================================
app.get('/api/waste-events/public/latest', async (req, res) => {
  try {
    console.log('📊 Public waste events requested');
    
    // Get latest waste events (limit 50)
    const events = await WasteEvent.find()
      .sort({ detected_at: -1 })
      .limit(50)
      .populate('bin_id', 'bin_name bin_type location');
    
    const shaped = events.map((e) => ({
      id: e._id,
      time: e.detected_at ? e.detected_at.toLocaleString('en-PH', { timeZone: 'Asia/Manila' }) : new Date().toLocaleString(),
      bin: e.bin_id?.bin_name ?? 'Unknown Bin',
      type: e.waste_type,
      item: e.item_label ?? '—',
      weight: `${(e.weight_kg || 0).toFixed(2)} kg`,
      result: e.result,
      confidence: e.confidence
    }));
    
    // Get summary statistics
    const totalWeight = await WasteEvent.aggregate([
      { $group: { _id: null, total: { $sum: '$weight_kg' } } }
    ]);
    
    res.json({
      success: true,
      count: events.length,
      events: shaped,
      summary: {
        totalEvents: events.length,
        totalWeight: totalWeight[0]?.total?.toFixed(2) || 0
      }
    });
    
    console.log(`✅ Public waste events data sent: ${events.length} events`);
  } catch (err) {
    console.error('Public waste events error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ✅ ============================================================
// ✅ COLLECTION ROUTES (AUTHENTICATION REQUIRED)
// ✅ ============================================================

// Get all collection logs (with filters)
app.get('/api/collections', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      bin_id, 
      staff_id, 
      waste_type, 
      status,
      limit = 100,
      page = 1
    } = req.query;

    const filter = {};
    
    if (startDate || endDate) {
      filter.collected_at = {};
      if (startDate) filter.collected_at.$gte = new Date(startDate);
      if (endDate) filter.collected_at.$lte = new Date(endDate);
    }
    
    if (bin_id) filter.bin_id = bin_id;
    if (staff_id) filter.staff_id = staff_id;
    if (waste_type) filter.waste_type = waste_type;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const logs = await CollectionLog.find(filter)
      .sort({ collected_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('bin_id', 'bin_name location bin_type fill_level')
      .populate('staff_id', 'full_name username email role');

    const total = await CollectionLog.countDocuments(filter);

    // Get weekly summary
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    const weeklyStats = await CollectionLog.aggregate([
      {
        $match: {
          collected_at: { $gte: startOfWeek }
        }
      },
      {
        $group: {
          _id: null,
          totalWeight: { $sum: '$weight_kg' },
          totalCollections: { $sum: 1 },
          recyclableWeight: {
            $sum: {
              $cond: [{ $eq: ['$waste_type', 'Recyclable'] }, '$weight_kg', 0]
            }
          },
          biodegradableWeight: {
            $sum: {
              $cond: [{ $eq: ['$waste_type', 'Biodegradable'] }, '$weight_kg', 0]
            }
          },
          nonBiodegradableWeight: {
            $sum: {
              $cond: [{ $eq: ['$waste_type', 'Non-Biodegradable'] }, '$weight_kg', 0]
            }
          }
        }
      }
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      summary: {
        weeklyCollections: weeklyStats[0]?.totalCollections || 0,
        weeklyWeight: (weeklyStats[0]?.totalWeight || 0).toFixed(2),
        recyclableWeight: (weeklyStats[0]?.recyclableWeight || 0).toFixed(2),
        biodegradableWeight: (weeklyStats[0]?.biodegradableWeight || 0).toFixed(2),
        nonBiodegradableWeight: (weeklyStats[0]?.nonBiodegradableWeight || 0).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error fetching collection logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single collection log by ID
app.get('/api/collections/:id', auth, async (req, res) => {
  try {
    const log = await CollectionLog.findById(req.params.id)
      .populate('bin_id', 'bin_name location bin_type')
      .populate('staff_id', 'full_name username');
    
    if (!log) {
      return res.status(404).json({ success: false, error: 'Collection log not found' });
    }
    
    res.json({ success: true, data: log });
  } catch (error) {
    console.error('Error fetching collection log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint to check collection logs data
app.get('/api/collections/test', auth, async (req, res) => {
  try {
    const count = await CollectionLog.countDocuments();
    const sample = await CollectionLog.findOne().populate('bin_id', 'bin_name').populate('staff_id', 'full_name');
    
    res.json({
      success: true,
      count: count,
      sample: sample,
      message: `Found ${count} collection logs in database`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test endpoint to check reward sessions data
app.get('/api/rewards/test', auth, async (req, res) => {
  try {
    const count = await RewardSession.countDocuments();
    const sample = await RewardSession.findOne()
      .populate('event_id', 'waste_type weight_kg')
      .populate('port_id', 'name')
      .populate('user_id', 'full_name');
    
    res.json({
      success: true,
      count: count,
      sample: sample,
      message: `Found ${count} reward sessions in database`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new collection log
app.post('/api/collections', auth, async (req, res) => {
  try {
    const { bin_id, waste_type, weight_kg, destination, status, notes } = req.body;

    if (!bin_id || !waste_type || !weight_kg) {
      return res.status(400).json({ 
        success: false, 
        error: 'bin_id, waste_type, and weight_kg are required' 
      });
    }

    // Check if bin exists
    const bin = await Bin.findById(bin_id);
    if (!bin) {
      return res.status(404).json({ success: false, error: 'Bin not found' });
    }

    const collectionLog = new CollectionLog({
      bin_id,
      staff_id: req.user.userId,
      waste_type,
      weight_kg,
      destination: destination || 'Recycling Center',
      status: status || 'Done',
      notes: notes || '',
      collected_at: new Date()
    });

    await collectionLog.save();

    // Update bin fill level (reset after collection)
    await Bin.findByIdAndUpdate(bin_id, {
      fill_level: 0,
      weight_kg: 0,
      status: 'Active',
      last_updated: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Collection logged successfully',
      data: collectionLog
    });
  } catch (error) {
    console.error('Error creating collection log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update collection log
app.put('/api/collections/:id', auth, async (req, res) => {
  try {
    const { waste_type, weight_kg, status, destination, notes } = req.body;
    
    const log = await CollectionLog.findById(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Collection log not found' });
    }

    if (waste_type) log.waste_type = waste_type;
    if (weight_kg) log.weight_kg = weight_kg;
    if (status) log.status = status;
    if (destination) log.destination = destination;
    if (notes !== undefined) log.notes = notes;

    await log.save();
    
    res.json({
      success: true,
      message: 'Collection log updated successfully',
      data: log
    });
  } catch (error) {
    console.error('Error updating collection log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete collection log
app.delete('/api/collections/:id', auth, async (req, res) => {
  try {
    const log = await CollectionLog.findByIdAndDelete(req.params.id);
    if (!log) {
      return res.status(404).json({ success: false, error: 'Collection log not found' });
    }
    
    res.json({ success: true, message: 'Collection log deleted successfully' });
  } catch (error) {
    console.error('Error deleting collection log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get collection statistics for dashboard
app.get('/api/collections/stats/dashboard', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    
    const startOfMonth = new Date(today);
    startOfMonth.setDate(1);

    // Today's stats
    const todayStats = await CollectionLog.aggregate([
      {
        $match: {
          collected_at: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          totalWeight: { $sum: '$weight_kg' },
          totalCollections: { $sum: 1 },
          recyclable: {
            $sum: {
              $cond: [{ $eq: ['$waste_type', 'Recyclable'] }, 1, 0]
            }
          },
          biodegradable: {
            $sum: {
              $cond: [{ $eq: ['$waste_type', 'Biodegradable'] }, 1, 0]
            }
          },
          nonBiodegradable: {
            $sum: {
              $cond: [{ $eq: ['$waste_type', 'Non-Biodegradable'] }, 1, 0]
            }
          }
        }
      }
    ]);

    // Get bins that need collection (fill_level >= 75)
    const binsNeedingCollection = await Bin.countDocuments({
      fill_level: { $gte: 75 },
      status: { $ne: 'Full' }
    });

    // Helper function to get next pickup date
    function getNextPickupDate() {
      const todayDate = new Date();
      const day = todayDate.getDay();
      
      let nextPickup = new Date(todayDate);
      
      if (day === 6) { // Saturday
        nextPickup.setDate(todayDate.getDate() + 3);
      } else if (day === 0) { // Sunday
        nextPickup.setDate(todayDate.getDate() + 2);
      } else if (day === 1) { // Monday
        nextPickup.setDate(todayDate.getDate() + 1);
      } else if (day === 2) { // Tuesday
        nextPickup.setDate(todayDate.getDate() + 4);
      } else if (day === 3) { // Wednesday
        nextPickup.setDate(todayDate.getDate() + 3);
      } else if (day === 4) { // Thursday
        nextPickup.setDate(todayDate.getDate() + 2);
      } else if (day === 5) { // Friday
        nextPickup.setDate(todayDate.getDate() + 1);
      }
      
      return nextPickup.toLocaleDateString('en-PH', { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
      });
    }

    res.json({
      success: true,
      data: {
        today: {
          totalCollections: todayStats[0]?.totalCollections || 0,
          totalWeight: (todayStats[0]?.totalWeight || 0).toFixed(2),
          recyclable: todayStats[0]?.recyclable || 0,
          biodegradable: todayStats[0]?.biodegradable || 0,
          nonBiodegradable: todayStats[0]?.nonBiodegradable || 0
        },
        binsNeedingCollection,
        nextPickup: getNextPickupDate()
      }
    });
  } catch (error) {
    console.error('Error fetching collection stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ ============================================================
// ✅ REWARD SESSIONS ROUTES (AUTHENTICATION REQUIRED)
// ✅ ============================================================

// Get user's own reward sessions
app.get('/api/rewards/my-rewards', auth, async (req, res) => {
  try {
    const { limit = 50, status } = req.query;
    
    const filter = { user_id: req.user.userId };
    if (status) filter.result = status;

    const rewards = await RewardSession.find(filter)
      .sort({ started_at: -1 })
      .limit(parseInt(limit))
      .populate('event_id', 'waste_type weight_kg detected_at')
      .populate('port_id', 'name status');

    // Get user's total points
    const user = await User.findById(req.user.userId);
    
    // Get today's rewards count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayRewards = await RewardSession.countDocuments({
      user_id: req.user.userId,
      started_at: { $gte: today },
      result: 'Granted'
    });

    // Calculate total points earned
    const totalPointsEarned = await RewardSession.aggregate([
      {
        $match: {
          user_id: req.user.userId,
          result: 'Granted'
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$points_earned' }
        }
      }
    ]);

    res.json({
      success: true,
      data: rewards,
      stats: {
        totalPoints: user?.points || 0,
        totalPointsEarned: totalPointsEarned[0]?.total || 0,
        todayRewards,
        totalRewards: rewards.length
      }
    });
  } catch (error) {
    console.error('Error fetching user rewards:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get all reward sessions (admin/staff only)
app.get('/api/rewards/all', auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      result, 
      reward_type,
      limit = 100,
      page = 1
    } = req.query;

    const filter = {};
    
    if (startDate || endDate) {
      filter.started_at = {};
      if (startDate) filter.started_at.$gte = new Date(startDate);
      if (endDate) filter.started_at.$lte = new Date(endDate);
    }
    
    if (result) filter.result = result;
    if (reward_type) filter.reward_type = reward_type;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const sessions = await RewardSession.find(filter)
      .sort({ started_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('user_id', 'full_name username email')
      .populate('event_id', 'waste_type weight_kg detected_at')
      .populate('port_id', 'name');

    const total = await RewardSession.countDocuments(filter);

    // Get statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await RewardSession.aggregate([
      {
        $match: {
          started_at: { $gte: today }
        }
      },
      {
        $group: {
          _id: '$result',
          count: { $sum: 1 },
          totalPoints: { $sum: '$points_earned' }
        }
      }
    ]);

    res.json({
      success: true,
      data: sessions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        granted: stats.find(s => s._id === 'Granted')?.count || 0,
        declined: stats.find(s => s._id === 'Declined')?.count || 0,
        pending: stats.find(s => s._id === 'Pending')?.count || 0,
        totalPoints: stats.reduce((sum, s) => sum + (s.totalPoints || 0), 0)
      }
    });
  } catch (error) {
    console.error('Error fetching reward sessions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single reward session by ID
app.get('/api/rewards/:id', auth, async (req, res) => {
  try {
    const session = await RewardSession.findById(req.params.id)
      .populate('user_id', 'full_name username email points')
      .populate('event_id', 'waste_type weight_kg detected_at item_label')
      .populate('port_id', 'name status');
    
    if (!session) {
      return res.status(404).json({ success: false, error: 'Reward session not found' });
    }
    
    // Check if user has permission to view this session
    if (session.user_id._id.toString() !== req.user.userId && req.user.role !== 'Administrator') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }
    
    res.json({ success: true, data: session });
  } catch (error) {
    console.error('Error fetching reward session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new reward session (when waste is disposed)
app.post('/api/rewards', auth, async (req, res) => {
  try {
    const { event_id, port_id, duration_min, points_earned, description } = req.body;

    if (!event_id) {
      return res.status(400).json({ success: false, error: 'event_id is required' });
    }

    // Check if waste event exists
    const wasteEvent = await WasteEvent.findById(event_id);
    if (!wasteEvent) {
      return res.status(404).json({ success: false, error: 'Waste event not found' });
    }

    // Check if port is available (if provided)
    let port = null;
    if (port_id) {
      port = await ChargingPort.findById(port_id);
      if (port && port.status !== 'Available') {
        return res.status(400).json({ success: false, error: 'Charging port is not available' });
      }
    }

    // Calculate points if not provided (10 points per kg for Recyclable, 5 for Biodegradable, 2 for Non-Biodegradable)
    let finalPoints = points_earned;
    if (!finalPoints) {
      const pointsMap = { 'Recyclable': 10, 'Biodegradable': 5, 'Non-Biodegradable': 2 };
      finalPoints = Math.floor(wasteEvent.weight_kg * (pointsMap[wasteEvent.waste_type] || 5));
    }

    const rewardSession = new RewardSession({
      event_id,
      port_id: port_id || null,
      user_id: req.user.userId,
      duration_min: duration_min || 20,
      points_earned: finalPoints,
      reward_type: 'disposal_reward',
      result: 'Granted',
      description: description || `Reward for disposing ${wasteEvent.weight_kg}kg of ${wasteEvent.waste_type} waste`,
      started_at: new Date()
    });

    await rewardSession.save();

    // Update user points
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { points: finalPoints, total_rewards: 1 },
      last_reward_at: new Date()
    });

    // Update port status if used
    if (port) {
      port.status = 'In use';
      port.current_session_id = rewardSession._id;
      port.total_sessions += 1;
      port.last_used_at = new Date();
      await port.save();
    }

    res.status(201).json({
      success: true,
      message: 'Reward session created successfully',
      data: rewardSession
    });
  } catch (error) {
    console.error('Error creating reward session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// End reward session (release charging port)
app.put('/api/rewards/:id/end', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const rewardSession = await RewardSession.findById(id);
    if (!rewardSession) {
      return res.status(404).json({ success: false, error: 'Reward session not found' });
    }

    // Check permission
    if (rewardSession.user_id.toString() !== req.user.userId && req.user.role !== 'Administrator') {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    // Update session
    rewardSession.ended_at = new Date();
    rewardSession.duration_min = Math.ceil((rewardSession.ended_at - rewardSession.started_at) / 60000);
    await rewardSession.save();

    // Release charging port
    if (rewardSession.port_id) {
      await ChargingPort.findByIdAndUpdate(rewardSession.port_id, {
        status: 'Available',
        current_session_id: null
      });
    }

    res.json({
      success: true,
      message: 'Reward session ended successfully',
      data: rewardSession
    });
  } catch (error) {
    console.error('Error ending reward session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Redeem points for rewards
app.post('/api/rewards/redeem', auth, async (req, res) => {
  try {
    const { pointsToRedeem, rewardItem, description } = req.body;
    
    if (!pointsToRedeem || pointsToRedeem <= 0) {
      return res.status(400).json({ success: false, error: 'Valid points to redeem are required' });
    }
    
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    if (user.points < pointsToRedeem) {
      return res.status(400).json({ 
        success: false, 
        error: 'Insufficient points',
        availablePoints: user.points,
        requestedPoints: pointsToRedeem
      });
    }
    
    // Deduct points from user
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { points: -pointsToRedeem }
    });
    
    // Create reward session for redemption
    const rewardSession = new RewardSession({
      user_id: req.user.userId,
      points_earned: -pointsToRedeem,
      reward_type: 'points_redeemed',
      result: 'Granted',
      description: description || `Redeemed ${pointsToRedeem} points for ${rewardItem || 'reward item'}`,
      started_at: new Date()
    });
    await rewardSession.save();
    
    res.json({ 
      success: true, 
      message: 'Points redeemed successfully',
      data: rewardSession,
      remainingPoints: user.points - pointsToRedeem
    });
  } catch (error) {
    console.error('Error redeeming points:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get reward dashboard statistics
app.get('/api/rewards/dashboard/stats', auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());

    // Today's statistics
    const todayStats = await RewardSession.aggregate([
      {
        $match: {
          started_at: { $gte: today }
        }
      },
      {
        $group: {
          _id: '$result',
          count: { $sum: 1 },
          totalPoints: { $sum: '$points_earned' }
        }
      }
    ]);

    // Active charging sessions
    const activePorts = await ChargingPort.find({ status: 'In use' })
      .populate('current_session_id', 'user_id started_at');

    // Weekly statistics
    const weeklyStats = await RewardSession.aggregate([
      {
        $match: {
          started_at: { $gte: startOfWeek },
          result: 'Granted'
        }
      },
      {
        $group: {
          _id: {
            day: { $dayOfWeek: '$started_at' }
          },
          count: { $sum: 1 },
          totalPoints: { $sum: '$points_earned' }
        }
      }
    ]);

    // Total rewards summary
    const totalSummary = await RewardSession.aggregate([
      {
        $group: {
          _id: '$result',
          count: { $sum: 1 },
          totalPoints: { $sum: '$points_earned' }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        today: {
          granted: todayStats.find(s => s._id === 'Granted')?.count || 0,
          declined: todayStats.find(s => s._id === 'Declined')?.count || 0,
          pending: todayStats.find(s => s._id === 'Pending')?.count || 0,
          pointsEarned: todayStats.find(s => s._id === 'Granted')?.totalPoints || 0
        },
        activeSessions: activePorts.length,
        weekly: weeklyStats,
        total: {
          granted: totalSummary.find(s => s._id === 'Granted')?.count || 0,
          declined: totalSummary.find(s => s._id === 'Declined')?.count || 0,
          totalPoints: totalSummary.reduce((sum, s) => sum + (s.totalPoints || 0), 0)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching reward dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

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
// 10. ROUTES (EXISTING ROUTES CONTINUE HERE)
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
      user: { id: user._id, fullName: user.full_name, email: user.email, role: user.role, points: user.points || 0 },
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

// ── Collection Logs (existing) ────────────────────────────────────────

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

// ── Reward Sessions (existing) ────────────────────────────────────────

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

// Call seed data function
seedData();

// ─────────────────────────────────────────────────────────────
// 11. START
// ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 E-Bin Backend: http://localhost:${PORT}`);
  console.log(`📊 Health:        http://localhost:${PORT}/api/health`);
  console.log(`📋 Public Dashboard: http://localhost:${PORT}/api/bins/public/dashboard`);
});