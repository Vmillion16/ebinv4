const express = require('express');
const router = express.Router();
const Setting = require('../models/Setting');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Get settings
router.get('/', authenticateToken, async (req, res) => {
  try {
    const settings = await Setting.find();
    const settingsObject = {};
    settings.forEach(setting => {
      settingsObject[setting.key] = setting.value;
    });
    res.json(settingsObject);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update settings (admin only)
router.put('/', authenticateToken, authorizeRoles('admin'), async (req, res) => {
  try {
    const updates = req.body;
    const operations = Object.keys(updates).map(key => 
      Setting.findOneAndUpdate(
        { key },
        { key, value: updates[key], updatedAt: Date.now(), updatedBy: req.user.userId },
        { upsert: true, new: true }
      )
    );
    await Promise.all(operations);
    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;