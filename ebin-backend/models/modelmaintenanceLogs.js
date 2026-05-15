const mongoose = require('mongoose');

const maintenanceLogSchema = new mongoose.Schema({
  maintenanceRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MaintenanceRequest',
    required: true
  },
  binId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bin',
    required: true
  },
  action: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  duration: Number,
  cost: Number,
  partsReplaced: [String],
  notes: String,
  timestamp: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('MaintenanceLog', maintenanceLogSchema);