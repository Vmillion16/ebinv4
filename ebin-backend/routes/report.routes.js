const express = require('express');
const router = express.Router();
const WasteEvent = require('../models/WasteEvent');
const Bin = require('../models/Bin');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const User = require('../models/User');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get waste statistics
router.get('/waste-stats', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const filter = {};
    if (startDate && endDate) {
      filter.timestamp = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    const wasteStats = await WasteEvent.aggregate([
      { $match: filter },
      { $group: {
        _id: '$wasteType',
        totalWeight: { $sum: '$weight' },
        totalEvents: { $sum: 1 },
        totalPoints: { $sum: '$pointsEarned' }
      }}
    ]);
    
    res.json(wasteStats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bin performance report
router.get('/bin-performance', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const bins = await Bin.aggregate([
      { $lookup: {
        from: 'wasteevents',
        localField: '_id',
        foreignField: 'binId',
        as: 'wasteHistory'
      }},
      { $project: {
        binId: 1,
        location: 1,
        fillLevel: 1,
        status: 1,
        totalDisposals: { $size: '$wasteHistory' },
        avgFillLevel: { $avg: '$fillLevel' }
      }}
    ]);
    res.json(bins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;