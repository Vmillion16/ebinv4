const mongoose = require('mongoose');

const chargingPortSchema = new mongoose.Schema({
  portId: {
    type: String,
    required: true,
    unique: true
  },
  location: {
    lat: Number,
    lng: Number,
    address: String
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'maintenance', 'offline'],
    default: 'available'
  },
  binId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bin'
  },
  lastUsed: Date,
  powerRating: Number
});

module.exports = mongoose.model('ChargingPort', chargingPortSchema);