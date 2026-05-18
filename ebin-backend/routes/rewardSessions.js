const express = require('express');
const router = express.Router();
const RewardSession = require('../models/RewardSession');
const User = require('../models/User');
const WasteEvent = require('../models/WasteEvent');
const ChargingPort = require('../models/ChargingPort');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get user's own reward sessions
router.get('/my-rewards', authenticateToken, async (req, res) => {
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
router.get('/all', authenticateToken, authorizeRoles('Administrator', 'Utility Staff'), async (req, res) => {
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
router.get('/:id', authenticateToken, async (req, res) => {
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
router.post('/', authenticateToken, async (req, res) => {
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

    // Calculate points if not provided
    const finalPoints = points_earned || calculatePoints(wasteEvent.waste_type, wasteEvent.weight_kg);

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
router.put('/:id/end', authenticateToken, async (req, res) => {
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
router.post('/redeem', authenticateToken, async (req, res) => {
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
router.get('/dashboard/stats', authenticateToken, async (req, res) => {
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

// Helper function to calculate points
function calculatePoints(wasteType, weightKg) {
  const pointsPerKg = {
    'Recyclable': 10,
    'Biodegradable': 5,
    'Non-Biodegradable': 2
  };
  return Math.floor(weightKg * (pointsPerKg[wasteType] || 5));
}

module.exports = router;