const mongoose = require('mongoose');

const rewardSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  wasteEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WasteEvent'
  },
  points: {
    type: Number,
    required: true
  },
  rewardType: {
    type: String,
    enum: ['points_earned', 'points_redeemed', 'bonus'],
    required: true
  },
  description: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('RewardSession', rewardSessionSchema);