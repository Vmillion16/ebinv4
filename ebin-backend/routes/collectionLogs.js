const express = require('express');
const router = express.Router();
const CollectionLog = require('../models/CollectionLog');
const Bin = require('../models/Bin');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all collection logs (with filters)
router.get('/', authenticateToken, async (req, res) => {
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

    // Get summary statistics
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

    // Get today's collections
    const todayCollections = await CollectionLog.countDocuments({
      collected_at: { $gte: today }
    });

    const todayWeight = await CollectionLog.aggregate([
      {
        $match: {
          collected_at: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$weight_kg' }
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
        nonBiodegradableWeight: (weeklyStats[0]?.nonBiodegradableWeight || 0).toFixed(2),
        todayCollections,
        todayWeight: (todayWeight[0]?.total || 0).toFixed(2)
      }
    });
  } catch (error) {
    console.error('Error fetching collection logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get single collection log by ID
router.get('/:id', authenticateToken, async (req, res) => {
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

// Create new collection log
router.post('/', authenticateToken, authorizeRoles('Administrator', 'Utility Staff'), async (req, res) => {
  try {
    const { bin_id, waste_type, weight_kg, status, destination, notes } = req.body;

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
      status: status || 'Done',
      destination: destination || 'Recycling Center',
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
router.put('/:id', authenticateToken, authorizeRoles('Administrator'), async (req, res) => {
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
router.delete('/:id', authenticateToken, authorizeRoles('Administrator'), async (req, res) => {
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
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
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

    // Weekly stats
    const weeklyStats = await CollectionLog.aggregate([
      {
        $match: {
          collected_at: { $gte: startOfWeek }
        }
      },
      {
        $group: {
          _id: {
            day: { $dayOfWeek: '$collected_at' },
            waste_type: '$waste_type'
          },
          totalWeight: { $sum: '$weight_kg' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Monthly stats
    const monthlyStats = await CollectionLog.aggregate([
      {
        $match: {
          collected_at: { $gte: startOfMonth }
        }
      },
      {
        $group: {
          _id: '$waste_type',
          totalWeight: { $sum: '$weight_kg' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get bins that need collection (fill_level >= 75)
    const binsNeedingCollection = await Bin.countDocuments({
      fill_level: { $gte: 75 },
      status: { $ne: 'Full' }
    });

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
        weekly: weeklyStats,
        monthly: monthlyStats,
        binsNeedingCollection,
        nextPickup: getNextPickupDate()
      }
    });
  } catch (error) {
    console.error('Error fetching collection stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Helper function to get next pickup date (Tuesday and Saturday)
function getNextPickupDate() {
  const today = new Date();
  const day = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  
  let nextPickup = new Date(today);
  
  if (day === 6) { // Saturday
    nextPickup.setDate(today.getDate() + 3); // Next Tuesday
  } else if (day === 0) { // Sunday
    nextPickup.setDate(today.getDate() + 2); // Next Tuesday
  } else if (day === 1) { // Monday
    nextPickup.setDate(today.getDate() + 1); // Next Tuesday
  } else if (day === 2) { // Tuesday
    nextPickup.setDate(today.getDate() + 4); // Next Saturday
  } else if (day === 3) { // Wednesday
    nextPickup.setDate(today.getDate() + 3); // Next Saturday
  } else if (day === 4) { // Thursday
    nextPickup.setDate(today.getDate() + 2); // Next Saturday
  } else if (day === 5) { // Friday
    nextPickup.setDate(today.getDate() + 1); // Next Saturday
  }
  
  return nextPickup.toLocaleDateString('en-PH', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
}

module.exports = router;