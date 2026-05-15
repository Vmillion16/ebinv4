const express = require('express');
const router = express.Router();
const WasteEvent = require('../models/WasteEvent');
const RewardSession = require('../models/RewardSession');
const User = require('../models/User');
const Bin = require('../models/Bin');
const { authenticateToken } = require('../middleware/auth');

// Record waste disposal
router.post('/dispose', authenticateToken, async (req, res) => {
  try {
    const { binId, wasteType, weight, imageUrl } = req.body;
    
    // Calculate points (customize based on your logic)
    const pointsEarned = calculatePoints(wasteType, weight);
    
    const wasteEvent = new WasteEvent({
      binId,
      userId: req.user.userId,
      wasteType,
      weight,
      imageUrl,
      pointsEarned
    });
    
    await wasteEvent.save();
    
    // Update user points
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { points: pointsEarned }
    });
    
    // Create reward session
    const rewardSession = new RewardSession({
      userId: req.user.userId,
      wasteEventId: wasteEvent._id,
      points: pointsEarned,
      rewardType: 'points_earned',
      description: `Earned ${pointsEarned} points for disposing ${weight}kg of ${wasteType}`
    });
    await rewardSession.save();
    
    // Update bin fill level
    await Bin.findByIdAndUpdate(binId, {
      $inc: { fillLevel: calculateFillIncrease(weight) },
      lastUpdated: Date.now()
    });
    
    res.status(201).json({ wasteEvent, pointsEarned });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user's waste history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const history = await WasteEvent.find({ userId: req.user.userId })
      .sort({ timestamp: -1 })
      .populate('binId', 'location binId');
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

function calculatePoints(wasteType, weight) {
  const multipliers = {
    plastic: 10,
    paper: 8,
    glass: 12,
    metal: 15,
    organic: 5,
    general: 2
  };
  return Math.floor(weight * (multipliers[wasteType] || 5));
}

function calculateFillIncrease(weight) {
  // Custom logic based on bin capacity
  return Math.min(weight * 2, 100);
}

module.exports = router;