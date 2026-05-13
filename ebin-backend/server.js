require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const rateLimit = require('express-rate-limit');

// ========================================
// 1. CREATE APP
// ========================================
const app = express();

// ========================================
// 2. MIDDLEWARE
// ========================================

// ✅ FIXED: Allow all origins + handle preflight
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options(/.*/, cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Too many requests'
});
app.use('/api/', limiter);

// ========================================
// 3. DATABASE
// ========================================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected!'))
  .catch(err => {
    console.error('❌ MongoDB Error:', err.message);
    process.exit(1);
  });

const SECRET_KEY = process.env.JWT_SECRET || 'ebin-secret-2026';

// ========================================
// 4. EMAIL TRANSPORTER
// ========================================
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify((error, success) => {
  if (error) {
    console.error('EMAIL CONFIG ERROR:', error);
  } else {
    console.log('✅ Email server is ready');
  }
});

// ========================================
// 5. SCHEMAS
// ========================================
const userSchema = new mongoose.Schema({
  full_name: { type: String, required: true },
  username: { type: String, unique: true, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['Administrator', 'Utility Staff', 'Maintenance Personnel'],
    required: true,
    default: 'Utility Staff'
  },
  account_status: { type: String, default: 'Active' },
  otp: { type: String, default: null },
  otpExpiry: { type: Date, default: null }
});

const binSchema = new mongoose.Schema({
  bin_name: { type: String, required: true },
  location: { type: String, required: true },
  bin_type: {
    type: String,
    enum: ['Biodegradable', 'Non-Biodegradable', 'Recyclable'],
    required: true
  },
  installation_area: String,
  status: {
    type: String,
    enum: ['Active', 'Full', 'Empty', 'Maintenance'],
    default: 'Active'
  },
  current_fill_level: { type: Number, default: 0 },
  max_capacity: { type: Number, default: 100 }
});

const User = mongoose.model('User', userSchema);
const Bin = mongoose.model('Bin', binSchema);

// ========================================
// 6. AUTH MIDDLEWARE
// ========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// ========================================
// 7. HELPER
// ========================================
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ========================================
// 8. SEED DATA
// ========================================
async function seedData() {
  try {
    const adminCount = await User.countDocuments({ username: 'admin' });

    if (adminCount === 0) {
      await User.insertMany([
        {
          full_name: 'Eriza Enriquez-Santos',
          username: 'admin',
          email: 'admin@pdm.edu.ph',
          password: await bcrypt.hash('password', 10),
          role: 'Administrator'
        },
        {
          full_name: 'Jimmy Capalad',
          username: 'staff',
          email: 'staff@pdm.edu.ph',
          password: await bcrypt.hash('password', 10),
          role: 'Utility Staff'
        }
      ]);

      console.log('✅ Users seeded (admin/staff : password)');
    }

    const binCount = await Bin.countDocuments();

    if (binCount === 0) {
      await Bin.insertMany([
        {
          bin_name: 'Bin-1',
          location: 'Building A',
          bin_type: 'Biodegradable',
          status: 'Active',
          current_fill_level: 45.5
        },
        {
          bin_name: 'Bin-2',
          location: 'Building A',
          bin_type: 'Non-Biodegradable',
          status: 'Full',
          current_fill_level: 92.3
        },
        {
          bin_name: 'Bin-3',
          location: 'Building B',
          bin_type: 'Recyclable',
          status: 'Active',
          current_fill_level: 23.1
        }
      ]);

      console.log('✅ 3 sample bins created');
    }
  } catch (error) {
    console.log('Seed warning:', error.message);
  }
}

// ========================================
// 9. ROUTES
// ========================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    database: 'MongoDB Atlas ✅',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/test-email', async (req, res) => {
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'Test Email',
      text: 'If you received this, email setup is working.'
    });

    res.json({ message: 'Test email sent successfully' });
  } catch (error) {
    console.error('TEST EMAIL ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

// REGISTER
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({
      $or: [
        { username: username.trim() },
        { email: email.trim().toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      full_name: username.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: 'Utility Staff',
      account_status: 'Active'
    });

    await newUser.save();

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('REGISTER ERROR:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      SECRET_KEY,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        fullName: user.full_name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// FORGOT PASSWORD
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: 'E-Bin Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>E-Bin Password Reset</h2>
          <p>Your OTP code is:</p>
          <h1 style="letter-spacing: 4px;">${otp}</h1>
          <p>This code will expire in 5 minutes.</p>
        </div>
      `
    });

    res.json({ message: 'OTP sent to your email' });
  } catch (error) {
    console.error('FORGOT PASSWORD ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to send OTP' });
  }
});

// VERIFY OTP
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.otp || !user.otpExpiry) {
      return res.status(400).json({ error: 'No OTP request found' });
    }

    if (user.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    res.json({ message: 'OTP verified successfully' });
  } catch (error) {
    console.error('VERIFY OTP ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to verify OTP' });
  }
});

// RESET PASSWORD
app.post('/api/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ error: 'Email, OTP, and new password are required' });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.otp || !user.otpExpiry) {
      return res.status(400).json({ error: 'No OTP request found' });
    }

    if (user.otp !== otp.trim()) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    if (new Date() > user.otpExpiry) {
      return res.status(400).json({ error: 'OTP has expired' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiry = null;

    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('RESET PASSWORD ERROR:', error);
    res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
});

// DASHBOARD
app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const [totalBins, fullBins] = await Promise.all([
      Bin.countDocuments(),
      Bin.countDocuments({ status: 'Full' })
    ]);

    res.json({
      totalBins,
      fullBins,
      activeAlerts: 2,
      totalWasteToday: 45.2
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET BINS
app.get('/api/bins', authenticateToken, async (req, res) => {
  try {
    const bins = await Bin.find().sort({ location: 1 });
    res.json(bins);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// RESET BIN
app.put('/api/bins/:id/reset', authenticateToken, async (req, res) => {
  try {
    await Bin.findByIdAndUpdate(req.params.id, {
      status: 'Active',
      current_fill_level: 0
    });

    res.json({ message: '✅ Bin reset successfully!' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ========================================
// 10. START SERVER
// ========================================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 E-Bin Backend: http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  seedData();
});