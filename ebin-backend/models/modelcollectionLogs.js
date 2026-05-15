const mongoose = require('mongoose');

const collectionLogSchema = new mongoose.Schema({
  binId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bin',
    required: true
  },
  collectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  wasteAmount: {
    type: Number,
    required: true
  },
  wasteType: String,
  collectionTime: {
    type: Date,
    default: Date.now
  },
  routeId: String,
  notes: String
});

module.exports = mongoose.model('CollectionLog', collectionLogSchema);