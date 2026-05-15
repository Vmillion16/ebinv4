const express = require('express');
const router = express.Router();
const RewardSession = require('../models/RewardSession');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Get user's rewards
router.get('/my-rewards', authenticateToken, async (req, res) => {
  try {
    const rewards = await RewardSession.find({ userId: req.user.userId })
      .sort({ timestamp: -1 })
      .populate('wasteEventId');
    res.json(rewards);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Redeem points
router.post('/redeem', authenticateToken, async (req, res) => {
  try {
    const { pointsToRedeem, rewardItem } = req.body;
    const user = await User.findById(req.user.userId);
    
    if (user.points < pointsToRedeem) {
      return res.status(400).json({ message: 'Insufficient points' });
    }
    
    await User.findByIdAndUpdate(req.user.userId, {
      $inc: { points: -pointsToRedeem }
    });
    
    const rewardSession = new RewardSession({
      userId: req.user.userId,
      points: -pointsToRedeem,
      rewardType: 'points_redeemed',
      description: `Redeemed ${pointsToRedeem} points for ${rewardItem}`
    });
    await rewardSession.save();
    
    res.json({ message: 'Points redeemed successfully', rewardSession });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;