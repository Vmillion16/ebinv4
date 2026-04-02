require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Atlas Connected!'))
  .catch(err => {
    console.error('❌ MongoDB Error:', err.message);
    process.exit(1);
  });

const SECRET_KEY = process.env.JWT_SECRET || 'ebin-secret-2026';

// Schemas
const userSchema = new mongoose.Schema({
  full_name: { type: String, required: true },
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { 
    type: String, 
    enum: ['Administrator', 'Utility Staff', 'Maintenance Personnel'], 
    required: true 
  },
  email: String,
  account_status: { type: String, default: 'Active' }
});

const binSchema = new mongoose.Schema({
  bin_name: { type: String, required: true },
  location: { type: String, required: true },
  bin_type: { 
    type: String, 
    enum: ['Recyclable', 'Non-Recyclable', 'General'],
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

// Seed Data
async function seedData() {
  try {
    const adminCount = await User.countDocuments({ username: 'admin' });
    if (adminCount === 0) {
      await User.insertMany([
        {
          full_name: 'Eriza Enriquez-Santos',
          username: 'admin',
          password: await bcrypt.hash('password', 10),
          role: 'Administrator',
          email: 'admin@pdm.edu.ph'
        },
        {
          full_name: 'Jimmy Capalad',
          username: 'staff',
          password: await bcrypt.hash('password', 10),
          role: 'Utility Staff',
          email: 'staff@pdm.edu.ph'
        }
      ]);
      console.log('✅ Users seeded (admin/staff : password)');
    }

    const binCount = await Bin.countDocuments();
    if (binCount === 0) {
      await Bin.insertMany([
        { 
          bin_name: 'Bin-A101', 
          location: 'Building A Room 101', 
          bin_type: 'Recyclable', 
          status: 'Active', 
          current_fill_level: 45.5 
        },
        { 
          bin_name: 'Bin-Hall1', 
          location: 'Building A Hallway', 
          bin_type: 'Non-Recyclable', 
          status: 'Full', 
          current_fill_level: 92.3 
        },
        { 
          bin_name: 'Bin-Caf1', 
          location: 'Building B Cafeteria', 
          bin_type: 'General', 
          status: 'Active', 
          current_fill_level: 23.1 
        },
        { 
          bin_name: 'Bin-Admin', 
          location: 'Administration Office', 
          bin_type: 'Recyclable', 
          status: 'Maintenance', 
          current_fill_level: 78.9 
        }
      ]);
      console.log('✅ 4 sample bins created');
    }
  } catch (error) {
    console.log('Seed warning (data may exist):', error.message);
  }
}

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  
  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    database: 'MongoDB Atlas ✅',
    timestamp: new Date().toISOString()
  });
});

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
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/dashboard', authenticateToken, async (req, res) => {
  try {
    const [totalBins, fullBins] = await Promise.all([
      Bin.countDocuments(),
      Bin.countDocuments({ status: 'Full' })
    ]);
    
    res.json({
      totalBins,
      fullBins,
      activeAlerts: 2, // Demo
      totalWasteToday: 45.2
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/bins', authenticateToken, async (req, res) => {
  try {
    const bins = await Bin.find().sort({ location: 1 });
    res.json(bins);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 E-Bin Backend: http://localhost:${PORT}`);
  seedData();
});