const mongoose = require('mongoose');

const collectionLogSchema = new mongoose.Schema({
  bin_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bin',
    required: true
  },
  staff_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  collected_at: {
    type: Date,
    default: Date.now
  },
  waste_type: {
    type: String,
    enum: ['Recyclable', 'Biodegradable', 'Non-Biodegradable'],
    required: true
  },
  weight_kg: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['Done', 'Partial', 'Scheduled', 'In Progress'],
    default: 'Done'
  },
  destination: {
    type: String,
    default: 'Recycling Center'
  },
  notes: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('CollectionLog', collectionLogSchema);