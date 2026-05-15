const express = require('express');
const router = express.Router();
const Bin = require('../models/Bin');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get all bins
router.get('/', authenticateToken, async (req, res) => {
  try {
    const bins = await Bin.find();
    res.json(bins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bin by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const bin = await Bin.findById(req.params.id);
    if (!bin) return res.status(404).json({ message: 'Bin not found' });
    res.json(bin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create new bin
router.post('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const bin = new Bin(req.body);
    await bin.save();
    res.status(201).json(bin);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update bin status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, fillLevel } = req.body;
    const bin = await Bin.findByIdAndUpdate(
      req.params.id,
      { status, fillLevel, lastUpdated: Date.now() },
      { new: true }
    );
    res.json(bin);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get bins near location
router.get('/nearby/:lat/:lng/:radius', authenticateToken, async (req, res) => {
  try {
    const { lat, lng, radius } = req.params;
    const bins = await Bin.find({
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
          $maxDistance: parseInt(radius) * 1000 // Convert km to meters
        }
      }
    });
    res.json(bins);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;