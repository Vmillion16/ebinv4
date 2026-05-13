// routes/esp32Routes.js
import express from 'express';
import mongoose from 'mongoose';

// Import your models
import ChargingPort from '../models/ChargingPort.js';
import Bin from '../models/Bin.js';
import CollectionLog from '../models/CollectionLog.js';
import MaintenanceLog from '../models/MaintenanceLog.js';
import User from '../models/User.js';
import RewardSession from '../models/RewardSession.js';

const router = express.Router();

// ============================================
// E-BIN SYSTEM - ESP32 ENDPOINTS
// Based on your database schema
// ============================================

// ============================================
// MAIN ENDPOINT - Get all bin status for website
// ============================================
router.get('/latest', async (req, res) => {
  try {
    // Get all bins with latest data
    const bins = await Bin.find().sort({ last_updated: -1 });
    
    // Get charging ports status
    const ports = await ChargingPort.find().sort({ last_updated: -1 });
    
    if (!bins || bins.length === 0) {
      console.log('No bins found in database');
      return res.json({
        success: true,
        bins: [],
        chargingPorts: [],
        summary: {
          totalBins: 0,
          averageFillLevel: 0,
          criticalBins: 0,
          onlinePorts: 0
        }
      });
    }
    
    // Calculate summary statistics
    const totalFillLevel = bins.reduce((sum, bin) => sum + (bin.bin_level || 0), 0);
    const averageFillLevel = totalFillLevel / bins.length;
    const criticalBins = bins.filter(bin => (bin.bin_level || 0) >= 85).length;
    const onlinePorts = ports.filter(port => port.status === 'available' || port.status === 'charging').length;
    
    console.log('✅ Returning bin data:');
    bins.forEach(bin => {
      console.log(`   ${bin.bin_type}: ${bin.bin_level}% full`);
    });
    
    res.json({
      success: true,
      bins: bins.map(bin => ({
        id: bin._id,
        objectId: bin.objectId,
        bin_type: bin.bin_type,
        bin_level: bin.bin_level,
        last_updated: bin.last_updated,
        location: bin.location,
        weight_kg: bin.weight_kg,
        status: getBinStatus(bin.bin_level)
      })),
      chargingPorts: ports.map(port => ({
        id: port._id,
        name: port.name,
        status: port.status,
        bin_name: port.bin_name,
        bin_type: port.bin_type,
        fill_level: port.fill_level,
        health_pct: port.health_pct,
        last_read: port.last_read
      })),
      summary: {
        totalBins: bins.length,
        averageFillLevel: Math.round(averageFillLevel),
        criticalBins: criticalBins,
        onlinePorts: onlinePorts,
        timestamp: new Date()
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching bin data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ESP32 - UPDATE BIN SENSOR DATA
// This is your main data ingestion endpoint
// ============================================
router.post('/sensors/update', async (req, res) => {
  console.log('📡 ESP32 Sensor Data Received');
  console.log('📦 Body:', req.body);
  
  try {
    const {
      objectId,        // Unique identifier for the bin
      bin_type,        // 'recyclable', 'non_recyclable', 'general'
      bin_level,       // Percentage full (0-100)
      weight_kg,       // Current weight in kg
      location,        // Location of the bin
      sensor_name,     // Sensor identifier
      health_pct,      // Sensor health percentage
      port_id,         // Associated charging port ID
      port_name,       // Charging port name
      port_status,     // 'available', 'charging', 'maintenance'
      battery_level    // Battery level of ESP32
    } = req.body;
    
    // 1. Update or create Bin record
    let bin = await Bin.findOne({ objectId: objectId });
    
    if (!bin) {
      // Create new bin if it doesn't exist
      bin = new Bin({
        objectId: objectId,
        bin_type: bin_type || 'general',
        bin_level: bin_level || 0,
        last_updated: new Date(),
        date: new Date(),
        location: location || 'Pambayang Dalubhasaan ng Marilao',
        sensor: sensor_name || 'ultrasonic_hc_sr04',
        weight_kg: weight_kg || 0
      });
      console.log(`📦 Created new bin record for ${objectId}`);
    } else {
      // Update existing bin
      bin.bin_level = bin_level !== undefined ? bin_level : bin.bin_level;
      bin.weight_kg = weight_kg !== undefined ? weight_kg : bin.weight_kg;
      bin.last_updated = new Date();
      if (location) bin.location = location;
      if (sensor_name) bin.sensor = sensor_name;
      console.log(`✅ Updated bin ${objectId}: ${bin.bin_level}% full`);
    }
    
    await bin.save();
    
    // 2. Update or create ChargingPort record
    if (port_id) {
      let port = await ChargingPort.findOne({ objectId: port_id });
      
      if (!port) {
        port = new ChargingPort({
          name: port_name || `Port ${port_id}`,
          status: port_status || 'available',
          objectId: port_id,
          bin_name: bin_type || 'waste_bin',
          bin_type: bin_type,
          fill_level: bin_level || 0,
          last_updated: new Date(),
          location: location,
          health_pct: health_pct || 100,
          last_read: new Date(),
          sensor_name: sensor_name,
          weight_kg: weight_kg || 0
        });
        console.log(`🔌 Created new charging port record for ${port_id}`);
      } else {
        port.fill_level = bin_level !== undefined ? bin_level : port.fill_level;
        port.status = port_status || port.status;
        port.health_pct = health_pct || port.health_pct;
        port.last_read = new Date();
        port.last_updated = new Date();
        port.weight_kg = weight_kg !== undefined ? weight_kg : port.weight_kg;
        console.log(`🔌 Updated charging port ${port_id}`);
      }
      
      await port.save();
    }
    
    // 3. Check for critical levels and create alerts (as maintenance logs)
    if (bin_level >= 90) {
      const criticalAlert = new MaintenanceLog({
        bin_id: bin._id,
        description: `CRITICAL: ${bin_type} bin is at ${bin_level}% capacity. Immediate collection required!`,
        performed_on: new Date(),
        status: 'pending',
        type: 'critical_alert'
      });
      await criticalAlert.save();
      console.log(`⚠️ CRITICAL ALERT: ${bin_type} bin at ${bin_level}%`);
    } else if (bin_level >= 75) {
      const warningAlert = new MaintenanceLog({
        bin_id: bin._id,
        description: `Warning: ${bin_type} bin is at ${bin_level}% capacity. Schedule collection soon.`,
        performed_on: new Date(),
        status: 'pending',
        type: 'warning_alert'
      });
      await warningAlert.save();
      console.log(`⚠️ Warning: ${bin_type} bin at ${bin_level}%`);
    }
    
    // 4. Emit real-time update via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('bin_update', {
        objectId: objectId,
        bin_type: bin.bin_type,
        bin_level: bin.bin_level,
        weight_kg: bin.weight_kg,
        last_updated: bin.last_updated,
        timestamp: new Date()
      });
    }
    
    res.json({
      success: true,
      message: 'Bin data updated successfully',
      data: {
        bin: {
          id: bin._id,
          level: bin.bin_level,
          weight: bin.weight_kg
        },
        alerts: bin_level >= 75 ? ['Bin needs attention'] : []
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating sensor data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// BULK UPDATE - Update multiple bins at once
// ============================================
router.post('/sensors/bulk-update', async (req, res) => {
  console.log('📡 Bulk sensor update received');
  console.log('📦 Body:', req.body);
  
  try {
    const { bins, timestamp } = req.body;
    
    if (!bins || !Array.isArray(bins)) {
      return res.status(400).json({ success: false, error: 'Invalid bins array' });
    }
    
    const results = [];
    
    for (const binData of bins) {
      let bin = await Bin.findOne({ objectId: binData.objectId });
      
      if (!bin) {
        bin = new Bin({
          objectId: binData.objectId,
          bin_type: binData.bin_type || 'general',
          bin_level: binData.bin_level || 0,
          last_updated: new Date(),
          date: new Date(),
          location: binData.location,
          sensor: binData.sensor_name,
          weight_kg: binData.weight_kg || 0
        });
      } else {
        bin.bin_level = binData.bin_level;
        bin.weight_kg = binData.weight_kg;
        bin.last_updated = new Date();
      }
      
      await bin.save();
      results.push({
        objectId: binData.objectId,
        success: true,
        level: bin.bin_level
      });
    }
    
    console.log(`✅ Bulk updated ${results.length} bins`);
    
    // Emit bulk update via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.emit('bulk_bin_update', {
        count: results.length,
        timestamp: new Date(),
        bins: results
      });
    }
    
    res.json({
      success: true,
      message: `${results.length} bins updated successfully`,
      results: results
    });
    
  } catch (error) {
    console.error('❌ Error in bulk update:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// COLLECTION LOGS - Record waste collection
// ============================================
router.post('/collection/record', async (req, res) => {
  console.log('🗑️ Collection record received:', req.body);
  
  try {
    const {
      bin_id,
      staff_id,
      waste_type,
      weight_kg,
      status,
      collected_at
    } = req.body;
    
    // Find the bin first
    let bin = await Bin.findOne({ objectId: bin_id });
    if (!bin) {
      return res.status(404).json({ success: false, error: 'Bin not found' });
    }
    
    // Create collection log
    const collectionLog = new CollectionLog({
      bin_id: bin._id,
      collected_at: collected_at || new Date(),
      staff_id: staff_id || new mongoose.Types.ObjectId(),
      status: status || 'completed',
      waste_type: waste_type || bin.bin_type,
      weight_kg: weight_kg || bin.weight_kg
    });
    
    await collectionLog.save();
    
    // Reset bin level after collection
    bin.bin_level = 0;
    bin.weight_kg = 0;
    bin.last_updated = new Date();
    await bin.save();
    
    console.log(`✅ Collection recorded: ${weight_kg}kg of ${waste_type} waste`);
    console.log(`   Bin ${bin_id} reset to 0%`);
    
    // Emit collection event
    const io = req.app.get('io');
    if (io) {
      io.emit('collection_completed', {
        bin_id: bin_id,
        waste_type: waste_type,
        weight_kg: weight_kg,
        collected_at: collectionLog.collected_at
      });
    }
    
    res.json({
      success: true,
      message: 'Collection recorded successfully',
      collectionId: collectionLog._id,
      binReset: true
    });
    
  } catch (error) {
    console.error('❌ Error recording collection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// MAINTENANCE LOGS - Record maintenance activities
// ============================================
router.post('/maintenance/record', async (req, res) => {
  console.log('🔧 Maintenance record received:', req.body);
  
  try {
    const {
      bin_id,
      staff_id,
      description,
      type,
      status
    } = req.body;
    
    // Find the bin
    let bin = await Bin.findOne({ objectId: bin_id });
    if (!bin) {
      return res.status(404).json({ success: false, error: 'Bin not found' });
    }
    
    // Create maintenance log
    const maintenanceLog = new MaintenanceLog({
      bin_id: bin._id,
      description: description || 'Routine maintenance',
      performed_on: new Date(),
      staff_id: staff_id || null,
      status: status || 'completed',
      type: type || 'maintenance'
    });
    
    await maintenanceLog.save();
    
    console.log(`✅ Maintenance recorded: ${type} - ${description}`);
    
    res.json({
      success: true,
      message: 'Maintenance recorded successfully',
      maintenanceId: maintenanceLog._id
    });
    
  } catch (error) {
    console.error('❌ Error recording maintenance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// REWARD SESSIONS - For user rewards/points
// ============================================
router.post('/reward/start', async (req, res) => {
  console.log('🎮 Reward session started:', req.body);
  
  try {
    const {
      event_id,
      port_id,
      user_id
    } = req.body;
    
    // Create reward session
    const rewardSession = new RewardSession({
      duration_min: 0,
      event_id: event_id || null,
      port_id: port_id || null,
      result: 'in_progress',
      started_at: new Date()
    });
    
    await rewardSession.save();
    
    console.log(`✅ Reward session started: ${rewardSession._id}`);
    
    res.json({
      success: true,
      message: 'Reward session started',
      sessionId: rewardSession._id,
      started_at: rewardSession.started_at
    });
    
  } catch (error) {
    console.error('❌ Error starting reward session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/reward/end', async (req, res) => {
  console.log('🎮 Reward session ended:', req.body);
  
  try {
    const {
      session_id,
      duration_min,
      result
    } = req.body;
    
    const rewardSession = await RewardSession.findById(session_id);
    
    if (!rewardSession) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }
    
    rewardSession.duration_min = duration_min || 0;
    rewardSession.result = result || 'completed';
    await rewardSession.save();
    
    console.log(`✅ Reward session completed: ${session_id} (${duration_min} minutes)`);
    
    res.json({
      success: true,
      message: 'Reward session completed',
      session: rewardSession
    });
    
  } catch (error) {
    console.error('❌ Error ending reward session:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET COLLECTION HISTORY (for website/utility staff)
// ============================================
router.get('/collections', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const bin_type = req.query.bin_type;
    
    let query = {};
    if (bin_type) {
      // First find bins of that type
      const bins = await Bin.find({ bin_type: bin_type });
      const binIds = bins.map(b => b._id);
      query.bin_id = { $in: binIds };
    }
    
    const collections = await CollectionLog.find(query)
      .populate('bin_id', 'bin_type location')
      .sort({ collected_at: -1 })
      .limit(limit);
    
    // Get summary statistics
    const stats = await CollectionLog.aggregate([
      {
        $group: {
          _id: '$waste_type',
          totalWeight: { $sum: '$weight_kg' },
          count: { $sum: 1 },
          avgWeight: { $avg: '$weight_kg' }
        }
      }
    ]);
    
    res.json({
      success: true,
      count: collections.length,
      collections: collections,
      statistics: stats
    });
    
  } catch (error) {
    console.error('❌ Error fetching collections:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// GET MAINTENANCE HISTORY
// ============================================
router.get('/maintenance', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const status = req.query.status;
    
    let query = {};
    if (status) query.status = status;
    
    const maintenanceLogs = await MaintenanceLog.find(query)
      .populate('bin_id', 'bin_type location')
      .sort({ performed_on: -1 })
      .limit(limit);
    
    res.json({
      success: true,
      count: maintenanceLogs.length,
      maintenanceLogs: maintenanceLogs
    });
    
  } catch (error) {
    console.error('❌ Error fetching maintenance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// CHARGING PORT STATUS
// ============================================
router.get('/ports', async (req, res) => {
  try {
    const ports = await ChargingPort.find()
      .sort({ last_updated: -1 });
    
    const summary = {
      total: ports.length,
      available: ports.filter(p => p.status === 'available').length,
      charging: ports.filter(p => p.status === 'charging').length,
      maintenance: ports.filter(p => p.status === 'maintenance').length,
      averageHealth: ports.reduce((sum, p) => sum + (p.health_pct || 0), 0) / ports.length || 0
    };
    
    res.json({
      success: true,
      ports: ports,
      summary: summary
    });
    
  } catch (error) {
    console.error('❌ Error fetching ports:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ANALYTICS & REPORTS
// ============================================

// Get waste composition over time
router.get('/analytics/waste-composition', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const collections = await CollectionLog.find({
      collected_at: { $gte: startDate }
    });
    
    const composition = {
      recyclable: { weight: 0, count: 0 },
      non_recyclable: { weight: 0, count: 0 },
      general: { weight: 0, count: 0 }
    };
    
    collections.forEach(collection => {
      const type = collection.waste_type;
      if (composition[type]) {
        composition[type].weight += collection.weight_kg;
        composition[type].count += 1;
      }
    });
    
    res.json({
      success: true,
      dateRange: { from: startDate, to: new Date() },
      composition: composition,
      totalWaste: collections.reduce((sum, c) => sum + c.weight_kg, 0),
      totalCollections: collections.length
    });
    
  } catch (error) {
    console.error('❌ Error getting analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get bin fill level history
router.get('/analytics/bin-history/:objectId', async (req, res) => {
  try {
    const { objectId } = req.params;
    const hours = parseInt(req.query.hours) || 24;
    
    const startTime = new Date();
    startTime.setHours(startTime.getHours() - hours);
    
    const bin = await Bin.findOne({ objectId: objectId });
    
    if (!bin) {
      return res.status(404).json({ success: false, error: 'Bin not found' });
    }
    
    // Note: This assumes you have historical Bin records
    // If not, you might need a separate BinHistory collection
    const history = await Bin.find({
      objectId: objectId,
      last_updated: { $gte: startTime }
    }).sort({ last_updated: 1 });
    
    res.json({
      success: true,
      bin: {
        id: bin._id,
        type: bin.bin_type,
        location: bin.location
      },
      history: history.map(record => ({
        timestamp: record.last_updated,
        fill_level: record.bin_level,
        weight_kg: record.weight_kg
      }))
    });
    
  } catch (error) {
    console.error('❌ Error getting bin history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PUBLIC DASHBOARD ENDPOINTS
// ============================================

// Public summary for website visitors
router.get('/public/summary', async (req, res) => {
  try {
    const bins = await Bin.find().sort({ last_updated: -1 });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayCollections = await CollectionLog.find({
      collected_at: { $gte: today }
    });
    
    const totalWeightToday = todayCollections.reduce((sum, c) => sum + (c.weight_kg || 0), 0);
    const averageFill = bins.reduce((sum, b) => sum + (b.bin_level || 0), 0) / bins.length;
    
    res.json({
      success: true,
      data: {
        totalBins: bins.length,
        averageFillLevel: Math.round(averageFill),
        criticalBins: bins.filter(b => (b.bin_level || 0) >= 85).length,
        todayCollections: todayCollections.length,
        todayWasteKg: totalWeightToday,
        lastUpdated: new Date(),
        bins: bins.map(b => ({
          type: b.bin_type,
          level: b.bin_level,
          location: b.location
        }))
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// DEVICE HEALTH & DEBUG
// ============================================

// Endpoint for ESP32 to report device health
router.post('/device/health', async (req, res) => {
  console.log('💓 Device health ping:', req.body);
  
  try {
    const {
      device_id,
      battery_level,
      firmware_version,
      uptime_seconds,
      free_memory,
      wifi_strength
    } = req.body;
    
    // Update the associated charging port or device record
    if (device_id) {
      await ChargingPort.findOneAndUpdate(
        { objectId: device_id },
        {
          health_pct: battery_level || 100,
          last_read: new Date(),
          status: 'online'
        },
        { upsert: true }
      );
    }
    
    console.log(`✅ Device ${device_id} health: ${battery_level}% battery | ${wifi_strength}dBm`);
    
    res.json({
      success: true,
      message: 'Health report received',
      server_time: new Date()
    });
    
  } catch (error) {
    console.error('❌ Error recording health:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Debug endpoint
router.get('/debug', async (req, res) => {
  try {
    const binCount = await Bin.countDocuments();
    const collectionCount = await CollectionLog.countDocuments();
    const maintenanceCount = await MaintenanceLog.countDocuments();
    const portCount = await ChargingPort.countDocuments();
    const rewardCount = await RewardSession.countDocuments();
    
    const latestBin = await Bin.findOne().sort({ last_updated: -1 });
    const latestCollection = await CollectionLog.findOne().sort({ collected_at: -1 });
    
    console.log('=== E-BIN DATABASE STATUS ===');
    console.log(`Bins: ${binCount}`);
    console.log(`Collections: ${collectionCount}`);
    console.log(`Maintenance Logs: ${maintenanceCount}`);
    console.log(`Charging Ports: ${portCount}`);
    console.log(`Reward Sessions: ${rewardCount}`);
    
    res.json({
      success: true,
      statistics: {
        bins: binCount,
        collections: collectionCount,
        maintenanceLogs: maintenanceCount,
        chargingPorts: portCount,
        rewardSessions: rewardCount,
        latestBinUpdate: latestBin?.last_updated,
        latestCollection: latestCollection?.collected_at
      }
    });
    
  } catch (error) {
    console.error('❌ Debug error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// ALERT ENDPOINTS
// ============================================

// Alert endpoint
router.post('/alert', async (req, res) => {
  console.log('🚨 Alert received:', req.body);
  
  try {
    const { deviceId, alertType, message, binId } = req.body;
    
    // Create maintenance request for full bins
    if (alertType && alertType.includes('FULL')) {
      let bin = await Bin.findOne({ objectId: binId });
      
      if (bin) {
        // Note: Make sure MaintenanceRequest model is imported or use MaintenanceLog
        const maintenanceRequest = new MaintenanceLog({
          bin_id: bin._id,
          description: `Bin Full Alert: ${alertType} - ${message}`,
          performed_on: new Date(),
          status: 'pending',
          type: 'overflow_alert'
        });
        
        await maintenanceRequest.save();
        console.log(`✅ Maintenance request created for ${alertType}`);
      }
    }
    
    // Emit via Socket.IO for real-time website updates
    const io = req.app.get('io');
    if (io) {
      io.emit('bin_alert', {
        type: alertType,
        message: message,
        timestamp: new Date()
      });
    }
    
    res.json({ success: true, message: 'Alert processed' });
    
  } catch (error) {
    console.error('❌ Error processing alert:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get statistics for website dashboard
router.get('/dashboard/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Note: Make sure DetectionLog model is imported or use CollectionLog
    const todayDetections = await CollectionLog.countDocuments({
      collected_at: { $gte: today }
    });
    
    const pendingMaintenance = await MaintenanceLog.countDocuments({
      status: 'pending'
    });
    
    const recentDetections = await CollectionLog.find()
      .sort({ collected_at: -1 })
      .limit(10);
    
    res.json({
      success: true,
      stats: {
        todayDisposals: todayDetections,
        pendingMaintenance: pendingMaintenance,
        lastUpdated: new Date()
      },
      recentDetections: recentDetections
    });
    
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// TEST ENDPOINT
// ============================================
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'E-Bin ESP32 Routes are working with your database schema!',
    endpoints: [
      'GET  /api/esp32/latest - Get all bin status',
      'POST /api/esp32/sensors/update - Update single bin sensor data',
      'POST /api/esp32/sensors/bulk-update - Update multiple bins',
      'POST /api/esp32/collection/record - Record waste collection',
      'POST /api/esp32/maintenance/record - Record maintenance',
      'POST /api/esp32/reward/start - Start reward session',
      'POST /api/esp32/reward/end - End reward session',
      'GET  /api/esp32/collections - Get collection history',
      'GET  /api/esp32/maintenance - Get maintenance history',
      'GET  /api/esp32/ports - Get charging port status',
      'GET  /api/esp32/analytics/waste-composition - Waste analytics',
      'GET  /api/esp32/analytics/bin-history/:id - Bin fill history',
      'GET  /api/esp32/public/summary - Public dashboard summary',
      'POST /api/esp32/device/health - Report device health',
      'GET  /api/esp32/debug - Debug database'
    ],
    databaseTables: [
      'bin', 'chargingPorts', 'collectionLogs', 
      'maintenanceLogs', 'rewardSessions', 'users'
    ]
  });
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function getBinStatus(level) {
  if (level >= 90) return 'Critical';
  if (level >= 75) return 'Almost Full';
  if (level >= 50) return 'Moderate';
  if (level >= 20) return 'Low';
  return 'Empty';
}

export default router;