const mongoose = require('mongoose');

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

// Indexes for faster queries
rewardSessionSchema.index({ user_id: 1, started_at: -1 });
rewardSessionSchema.index({ event_id: 1 });
rewardSessionSchema.index({ port_id: 1 });
rewardSessionSchema.index({ result: 1 });
rewardSessionSchema.index({ started_at: -1 });

module.exports = mongoose.model('RewardSession', rewardSessionSchema);