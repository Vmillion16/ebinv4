const mongoose = require('mongoose');

const wasteEventSchema = new mongoose.Schema({
  binId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bin',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  wasteType: {
    type: String,
    enum: ['plastic', 'paper', 'glass', 'metal', 'organic', 'general'],
    required: true
  },
  weight: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  pointsEarned: {
    type: Number,
    default: 0
  },
  imageUrl: String,
  status: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  }
});

module.exports = mongoose.model('WasteEvent', wasteEventSchema);