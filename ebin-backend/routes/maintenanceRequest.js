const express = require('express');
const router = express.Router();
const MaintenanceRequest = require('../models/MaintenanceRequest');
const MaintenanceLog = require('../models/MaintenanceLog');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

// Create maintenance request
router.post('/requests', authenticateToken, async (req, res) => {
  try {
    const request = new MaintenanceRequest({
      ...req.body,
      requestedBy: req.user.userId
    });
    await request.save();
    res.status(201).json(request);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get maintenance requests
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const { status, priority } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    
    const requests = await MaintenanceRequest.find(filter)
      .populate('binId')
      .populate('assignedTo', 'name email');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update request status
router.patch('/requests/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status, assignedTo } = req.body;
    const request = await MaintenanceRequest.findByIdAndUpdate(
      req.params.id,
      { status, assignedTo, completedAt: status === 'completed' ? Date.now() : undefined },
      { new: true }
    );
    res.json(request);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Add maintenance log
router.post('/logs', authenticateToken, authorizeRoles('admin', 'maintenance_staff'), async (req, res) => {
  try {
    const log = new MaintenanceLog({
      ...req.body,
      performedBy: req.user.userId
    });
    await log.save();
    res.status(201).json(log);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;