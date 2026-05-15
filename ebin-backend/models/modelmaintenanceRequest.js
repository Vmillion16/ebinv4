const mongoose = require('mongoose');

const maintenanceRequestSchema = new mongoose.Schema({
  binId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bin',
    required: true
  },
  requestType: {
    type: String,
    enum: ['repair', 'cleaning', 'emptying', 'sensor_issue'],
    required: true
  },
  description: String,
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  requestedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date,
  notes: [{
    text: String,
    createdAt: Date,
    createdBy: mongoose.Schema.Types.ObjectId
  }]
});

module.exports = mongoose.model('MaintenanceRequest', maintenanceRequestSchema);