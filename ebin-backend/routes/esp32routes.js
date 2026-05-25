const express        = require('express');
const mongoose       = require('mongoose');
const router         = express.Router();

// ── Import models (CommonJS, matching server.js) ─────────────
// These models are already defined in server.js via mongoose.model().
// We re-use them here by calling mongoose.model() with just the name.
const Bin                = mongoose.model('Bin');
const ChargingPort       = mongoose.model('ChargingPort');
const CollectionLog      = mongoose.model('CollectionLog');
const MaintenanceLog     = mongoose.model('MaintenanceLog');
const MaintenanceRequest = mongoose.model('MaintenanceRequest');
const RewardSession      = mongoose.model('RewardSession');
const User               = mongoose.model('User');
const WasteEvent         = mongoose.model('WasteEvent');

// ── Helper: map ESP32 bin_type string → DB enum ──────────────
const typeMap = {
  'recyclable':        'Recyclable',
  'biodegradable':     'Biodegradable',
  'non_biodegradable': 'Non-Biodegradable',
  'non-biodegradable': 'Non-Biodegradable',
  'nonbiodegradable':  'Non-Biodegradable',
  'non_recyclable':    'Non-Biodegradable',
  'general':           'Non-Biodegradable',
};

// ── Helper: bin status label from fill level ─────────────────
function getBinStatus(level) {
  if (level >= 90) return 'Critical';
  if (level >= 75) return 'Almost Full';
  if (level >= 50) return 'Moderate';
  if (level >= 20) return 'Low';
  return 'Empty';
}

// ── Helper: get admin user _id for auto-records ──────────────
async function getAdminId() {
  const admin = await User.findOne({ role: 'Administrator' }).select('_id');
  return admin?._id || null;
}

// ============================================================
// GET /latest  — all bin status for the dashboard
// ============================================================
router.get('/latest', async (req, res) => {
  try {
    const bins  = await Bin.find().sort({ last_updated: -1 });
    const ports = await ChargingPort.find().sort({ name: 1 });

    const totalFill      = bins.reduce((s, b) => s + (b.fill_level || 0), 0);
    const avgFill        = bins.length ? totalFill / bins.length : 0;
    const criticalBins   = bins.filter(b => (b.fill_level || 0) >= 85).length;
    const onlinePorts    = ports.filter(p => p.status === 'Available' || p.status === 'In use').length;

    res.json({
      success: true,
      bins: bins.map(bin => ({
        id:           bin._id,
        bin_name:     bin.bin_name,
        bin_type:     bin.bin_type,
        fill_level:   bin.fill_level,
        weight_kg:    bin.weight_kg,
        status:       bin.status,
        location:     bin.location,
        last_updated: bin.last_updated,
        priority:     getBinStatus(bin.fill_level),
      })),
      chargingPorts: ports.map(port => ({
        id:     port._id,
        name:   port.name,
        status: port.status,
        detail: port.detail,
      })),
      summary: {
        totalBins:        bins.length,
        averageFillLevel: Math.round(avgFill),
        criticalBins,
        onlinePorts,
        timestamp:        new Date(),
      },
    });
  } catch (err) {
    console.error('❌ /latest error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /sensors/update  — ESP32 pushes sensor data
// ============================================================
router.post('/sensors/update', async (req, res) => {
  console.log('📡 ESP32 sensor update:', req.body);

  try {
    const { bin_type, bin_level, weight_kg, location } = req.body;

    const mappedType = typeMap[bin_type?.toLowerCase()];
    if (!mappedType) {
      return res.status(400).json({ success: false, error: `Invalid bin_type: ${bin_type}` });
    }

    const newStatus = bin_level >= 90 ? 'Full' : 'Active';

    const bin = await Bin.findOneAndUpdate(
      { bin_type: mappedType },
      {
        fill_level:   bin_level ?? 0,
        weight_kg:    weight_kg ?? 0,
        status:       newStatus,
        last_updated: new Date(),
        ...(location && { location }),
      },
      { new: true }
    );

    if (!bin) {
      return res.status(404).json({ success: false, error: `No bin found for type: ${mappedType}` });
    }

    // Log critical/warning alerts as maintenance logs (use admin as staff)
    if (bin_level >= 75) {
      const adminId = await getAdminId();
      const isCritical = bin_level >= 90;
      await MaintenanceLog.create({
        bin_id:      bin._id,
        staff_id:    adminId,
        type:        isCritical ? 'critical_alert' : 'warning_alert',
        description: isCritical
          ? `CRITICAL: ${mappedType} bin is at ${bin_level}% — immediate collection required.`
          : `Warning: ${mappedType} bin is at ${bin_level}% — schedule collection soon.`,
        performed_on: new Date(),
        status:       'Done',
      });
      console.log(`⚠️  ${isCritical ? 'CRITICAL' : 'Warning'}: ${mappedType} bin at ${bin_level}%`);
    }

    // Emit real-time update via Socket.IO if available
    const io = req.app.get('io');
    if (io) {
      io.emit('bin_update', {
        bin_type:     bin.bin_type,
        fill_level:   bin.fill_level,
        weight_kg:    bin.weight_kg,
        status:       bin.status,
        last_updated: bin.last_updated,
      });
      // Also emit the frontend‑expected 'bin-updated' event
      io.emit('bin-updated', {
        type: 'SENSOR_UPDATE',
        binId: bin._id,
        binName: bin.bin_name,
        bin: {
          _id: bin._id,
          bin_name: bin.bin_name,
          bin_type: bin.bin_type,
          fillLevel: bin.fill_level,
          weight_kg: bin.weight_kg,
          status: bin.status
        },
        timestamp: new Date()
      });
    }

    console.log(`✅ Sensor update → ${mappedType}: ${bin_level}% | ${weight_kg}kg`);

    res.json({
      success:    true,
      message:    'Bin updated successfully',
      bin_name:   bin.bin_name,
      bin_type:   bin.bin_type,
      fill_level: bin.fill_level,
      status:     bin.status,
      alerts:     bin_level >= 75 ? ['Bin needs attention'] : [],
    });

  } catch (err) {
    console.error('❌ /sensors/update error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /sensors/bulk-update  — update multiple bins at once
// ============================================================
router.post('/sensors/bulk-update', async (req, res) => {
  console.log('📡 Bulk sensor update:', req.body);

  try {
    const { bins } = req.body;

    if (!Array.isArray(bins) || bins.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid or empty bins array' });
    }

    const results = [];

    for (const binData of bins) {
      const mappedType = typeMap[binData.bin_type?.toLowerCase()];
      if (!mappedType) {
        results.push({ bin_type: binData.bin_type, success: false, error: 'Invalid bin_type' });
        continue;
      }

      const bin = await Bin.findOneAndUpdate(
        { bin_type: mappedType },
        {
          fill_level:   binData.bin_level ?? 0,
          weight_kg:    binData.weight_kg ?? 0,
          status:       (binData.bin_level ?? 0) >= 90 ? 'Full' : 'Active',
          last_updated: new Date(),
        },
        { new: true }
      );

      results.push({
        bin_type:   mappedType,
        success:    !!bin,
        fill_level: bin?.fill_level,
        error:      bin ? undefined : 'Bin not found',
      });
    }

    // Emit bulk update via Socket.IO
    const io = req.app.get('io');
    if (io) io.emit('bulk_bin_update', { count: results.length, timestamp: new Date(), bins: results });

    console.log(`✅ Bulk updated ${results.filter(r => r.success).length}/${results.length} bins`);

    res.json({
      success: true,
      message: `${results.filter(r => r.success).length} bins updated successfully`,
      results,
    });

  } catch (err) {
    console.error('❌ /sensors/bulk-update error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /collection/record  — record a waste collection event
// ============================================================
router.post('/collection/record', async (req, res) => {
  console.log('🗑️  Collection record:', req.body);

  try {
    const { waste_type, weight_kg } = req.body;

    const mappedType = typeMap[waste_type?.toLowerCase()] || waste_type;

    const bin = await Bin.findOne({ bin_type: mappedType });
    if (!bin) {
      return res.status(404).json({ success: false, error: `No bin found for type: ${mappedType}` });
    }

    // Requires a valid staff_id — use the admin account for ESP32-triggered collections
    const adminId = await getAdminId();
    if (!adminId) {
      return res.status(500).json({ success: false, error: 'No admin user found — cannot record collection' });
    }

    const log = await CollectionLog.create({
      bin_id:      bin._id,
      staff_id:    adminId,
      waste_type:  mappedType,
      weight_kg:   weight_kg || 0,
      status:      'Done',
      destination: 'Recycling Center',
      notes:       'Auto-recorded by ESP32',
      collected_at: new Date(),
    });

    // Reset bin after collection
    const updatedBin = await Bin.findByIdAndUpdate(
      bin._id,
      {
        fill_level:   0,
        weight_kg:    0,
        status:       'Active',
        last_updated: new Date(),
      },
      { new: true }
    );

    // Emit real‑time update for the frontend
    const io = req.app.get('io');
    if (io) {
      io.emit('collection_completed', {
        bin_type:     mappedType,
        weight_kg:    weight_kg,
        collected_at: log.collected_at,
      });
      // Emit the frontend‑expected 'bin-updated' event
      io.emit('bin-updated', {
        type: 'COLLECTION_RESET',
        binId: updatedBin._id,
        binName: updatedBin.bin_name,
        bin: {
          _id: updatedBin._id,
          bin_name: updatedBin.bin_name,
          bin_type: updatedBin.bin_type,
          fillLevel: updatedBin.fill_level,
          weight_kg: updatedBin.weight_kg,
          status: updatedBin.status
        },
        timestamp: new Date()
      });
    }

    console.log(`✅ Collection recorded: ${weight_kg}kg of ${mappedType} — bin reset to 0%`);

    res.json({
      success:    true,
      message:    'Collection recorded and bin reset',
      log_id:     log._id,
      bin_reset:  true,
    });

  } catch (err) {
    console.error('❌ /collection/record error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /maintenance/record  — record a maintenance activity
// ============================================================
router.post('/maintenance/record', async (req, res) => {
  console.log('🔧 Maintenance record:', req.body);

  try {
    const { bin_type, description, type, staff_id } = req.body;

    const mappedType = typeMap[bin_type?.toLowerCase()] || bin_type;
    const bin = await Bin.findOne({ bin_type: mappedType });
    if (!bin) {
      return res.status(404).json({ success: false, error: `No bin found for type: ${mappedType}` });
    }

    // Use provided staff_id, fall back to admin
    const resolvedStaffId = staff_id || (await getAdminId());
    if (!resolvedStaffId) {
      return res.status(500).json({ success: false, error: 'No staff user found' });
    }

    const log = await MaintenanceLog.create({
      bin_id:       bin._id,
      staff_id:     resolvedStaffId,
      type:         type || 'maintenance',
      description:  description || 'Routine maintenance',
      performed_on: new Date(),
      status:       'Done',
    });

    console.log(`✅ Maintenance recorded: ${type} on ${mappedType} bin`);

    res.json({
      success:        true,
      message:        'Maintenance recorded successfully',
      maintenance_id: log._id,
    });

  } catch (err) {
    console.error('❌ /maintenance/record error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /events  — log a waste detection event from ESP32
// ============================================================
router.post('/events', async (req, res) => {
  console.log('⚡ ESP32 waste event:', req.body);

  try {
    const { waste_type, weight_kg, event_type } = req.body;

    const mappedType = typeMap[waste_type?.toLowerCase()];
    if (!mappedType) {
      return res.status(400).json({ success: false, error: `Invalid waste_type: ${waste_type}` });
    }

    const bin = await Bin.findOne({ bin_type: mappedType });
    if (!bin) {
      return res.status(404).json({ success: false, error: `No bin found for type: ${mappedType}` });
    }

    const eventWeight = weight_kg || 0;

    // Create waste event
    const event = await WasteEvent.create({
      bin_id:     bin._id,
      waste_type: mappedType,
      weight_kg:  eventWeight,
      item_label: event_type || 'ESP32 Detection',
      result:     'Classified',
      detected_at: new Date(),
    });

    // ** UPDATE BIN WEIGHT AND FILL LEVEL **
    const newWeight = (bin.weight_kg || 0) + eventWeight;
    // Rough estimate: 1 kg ≈ 1% fill (adjust if needed)
    const newFill = Math.min(100, (bin.fill_level || 0) + eventWeight);
    const updatedBin = await Bin.findByIdAndUpdate(
      bin._id,
      {
        weight_kg:    newWeight,
        fill_level:   newFill,
        last_updated: new Date(),
        status:       newFill >= 90 ? 'Full' : 'Active'
      },
      { new: true }
    );

    console.log(`✅ Waste event logged: ${event_type} | ${mappedType} | ${eventWeight}kg`);
    console.log(`   Bin ${updatedBin.bin_name} → weight: ${newWeight}kg, fill: ${newFill}%`);

    // Emit real‑time update
    const io = req.app.get('io');
    if (io) {
      io.emit('bin_update', {
        bin_type:     updatedBin.bin_type,
        fill_level:   updatedBin.fill_level,
        weight_kg:    updatedBin.weight_kg,
        status:       updatedBin.status,
        last_updated: updatedBin.last_updated,
      });
      // Emit the frontend‑expected 'bin-updated' event
      io.emit('bin-updated', {
        type: 'WEIGHT_UPDATE',
        binId: updatedBin._id,
        binName: updatedBin.bin_name,
        bin: {
          _id: updatedBin._id,
          bin_name: updatedBin.bin_name,
          bin_type: updatedBin.bin_type,
          fillLevel: updatedBin.fill_level,
          weight_kg: updatedBin.weight_kg,
          status: updatedBin.status
        },
        timestamp: new Date()
      });
    }

    res.json({
      success:    true,
      message:    'Event logged and bin updated',
      event_id:   event._id,
      waste_type: mappedType,
      bin: {
        weight_kg: updatedBin.weight_kg,
        fill_level: updatedBin.fill_level
      }
    });

  } catch (err) {
    console.error('❌ /events error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /reward/start  — start a charging reward session
// ============================================================
router.post('/reward/start', async (req, res) => {
  console.log('🎁 Reward session start:', req.body);

  try {
    const { event_id, port_id } = req.body;

    const session = await RewardSession.create({
      event_id:     event_id || null,
      port_id:      port_id  || null,
      result:       'Pending',
      started_at:   new Date(),
      duration_min: 0,
      points_earned: 0,
    });

    // Mark port as in use
    if (port_id) {
      await ChargingPort.findByIdAndUpdate(port_id, { status: 'In use' });
    }

    console.log(`✅ Reward session started: ${session._id}`);

    res.json({
      success:    true,
      message:    'Reward session started',
      session_id: session._id,
      started_at: session.started_at,
    });

  } catch (err) {
    console.error('❌ /reward/start error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /reward/end  — end a charging reward session
// ============================================================
router.post('/reward/end', async (req, res) => {
  console.log('🎁 Reward session end:', req.body);

  try {
    const { session_id, duration_min, points_earned } = req.body;

    const session = await RewardSession.findById(session_id);
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found' });
    }

    session.ended_at      = new Date();
    session.duration_min  = duration_min || Math.ceil((session.ended_at - session.started_at) / 60000);
    session.points_earned = points_earned || 0;
    session.result        = 'Granted';
    await session.save();

    // Free the port
    if (session.port_id) {
      await ChargingPort.findByIdAndUpdate(session.port_id, { status: 'Available' });
    }

    // Credit points to user if linked
    if (session.user_id && points_earned) {
      await User.findByIdAndUpdate(session.user_id, {
        $inc: { points: points_earned, total_rewards: 1 },
        last_reward_at: new Date(),
      });
    }

    console.log(`✅ Reward session ended: ${session_id} (${session.duration_min} min, ${session.points_earned} pts)`);

    res.json({
      success: true,
      message: 'Reward session completed',
      data:    session,
    });

  } catch (err) {
    console.error('❌ /reward/end error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /collections  — collection history
// ============================================================
router.get('/collections', async (req, res) => {
  try {
    const limit    = parseInt(req.query.limit) || 50;
    const bin_type = req.query.bin_type;

    const filter = {};
    if (bin_type) {
      const mappedType = typeMap[bin_type.toLowerCase()] || bin_type;
      const bins = await Bin.find({ bin_type: mappedType }).select('_id');
      filter.bin_id = { $in: bins.map(b => b._id) };
    }

    const collections = await CollectionLog.find(filter)
      .populate('bin_id',   'bin_name bin_type location')
      .populate('staff_id', 'full_name username')
      .sort({ collected_at: -1 })
      .limit(limit);

    const stats = await CollectionLog.aggregate([
      {
        $group: {
          _id:         '$waste_type',
          totalWeight: { $sum: '$weight_kg' },
          count:       { $sum: 1 },
          avgWeight:   { $avg: '$weight_kg' },
        },
      },
    ]);

    res.json({ success: true, count: collections.length, collections, statistics: stats });

  } catch (err) {
    console.error('❌ /collections error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /maintenance  — maintenance history
// ============================================================
router.get('/maintenance', async (req, res) => {
  try {
    const limit  = parseInt(req.query.limit) || 50;
    const status = req.query.status;

    const filter = {};
    if (status) filter.status = status;

    const logs = await MaintenanceLog.find(filter)
      .populate('bin_id',   'bin_name bin_type location')
      .populate('staff_id', 'full_name username')
      .sort({ performed_on: -1 })
      .limit(limit);

    res.json({ success: true, count: logs.length, maintenanceLogs: logs });

  } catch (err) {
    console.error('❌ /maintenance error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /ports  — charging port status
// ============================================================
router.get('/ports', async (req, res) => {
  try {
    const ports = await ChargingPort.find().sort({ name: 1 });

    const summary = {
      total:       ports.length,
      available:   ports.filter(p => p.status === 'Available').length,
      in_use:      ports.filter(p => p.status === 'In use').length,
      offline:     ports.filter(p => p.status === 'Offline').length,
    };

    res.json({ success: true, ports, summary });

  } catch (err) {
    console.error('❌ /ports error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /device/health  — ESP32 health ping
// ============================================================
router.post('/device/health', async (req, res) => {
  const { device_id, battery_level, firmware_version, uptime_seconds, wifi_strength } = req.body;
  console.log(`💓 Device health → ${device_id} | Battery: ${battery_level}% | WiFi: ${wifi_strength}dBm`);

  res.json({ success: true, message: 'Health report received', server_time: new Date() });
});

// ============================================================
// POST /alert  — bin full alert from ESP32
// ============================================================
router.post('/alert', async (req, res) => {
  console.log('🚨 Alert:', req.body);

  try {
    const { alertType, message, bin_type } = req.body;

    if (alertType?.includes('FULL') && bin_type) {
      const mappedType = typeMap[bin_type.toLowerCase()] || bin_type;
      const bin        = await Bin.findOne({ bin_type: mappedType });
      const adminId    = await getAdminId();

      if (bin && adminId) {
        await MaintenanceRequest.create({
          bin_id:       bin._id,
          submitted_by: adminId,
          title:        `Bin Full Alert: ${mappedType}`,
          type:         'overflow_alert',
          description:  message || `${mappedType} bin is full`,
          priority:     'High',
          status:       'Pending',
        });
        console.log(`✅ Maintenance request created for full ${mappedType} bin`);
      }
    }

    const io = req.app.get('io');
    if (io) io.emit('bin_alert', { type: alertType, message, timestamp: new Date() });

    res.json({ success: true, message: 'Alert processed' });

  } catch (err) {
    console.error('❌ /alert error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /public/summary  — public dashboard summary (no auth)
// ============================================================
router.get('/public/summary', async (req, res) => {
  try {
    const bins  = await Bin.find();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayCollections = await CollectionLog.find({ collected_at: { $gte: today } });
    const avgFill = bins.length
      ? bins.reduce((s, b) => s + (b.fill_level || 0), 0) / bins.length
      : 0;

    res.json({
      success: true,
      data: {
        totalBins:        bins.length,
        averageFillLevel: Math.round(avgFill),
        criticalBins:     bins.filter(b => (b.fill_level || 0) >= 85).length,
        todayCollections: todayCollections.length,
        todayWasteKg:     todayCollections.reduce((s, c) => s + (c.weight_kg || 0), 0),
        lastUpdated:      new Date(),
        bins:             bins.map(b => ({ bin_type: b.bin_type, fill_level: b.fill_level, status: b.status, location: b.location })),
      },
    });

  } catch (err) {
    console.error('❌ /public/summary error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /analytics/waste-composition  — waste breakdown over N days
// ============================================================
router.get('/analytics/waste-composition', async (req, res) => {
  try {
    const days      = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await CollectionLog.aggregate([
      { $match: { collected_at: { $gte: startDate } } },
      {
        $group: {
          _id:         '$waste_type',
          totalWeight: { $sum: '$weight_kg' },
          count:       { $sum: 1 },
        },
      },
    ]);

    const totalWeight = stats.reduce((s, t) => s + t.totalWeight, 0);

    res.json({
      success:          true,
      dateRange:        { from: startDate, to: new Date() },
      composition:      stats,
      totalWeight,
      totalCollections: stats.reduce((s, t) => s + t.count, 0),
    });

  } catch (err) {
    console.error('❌ /analytics/waste-composition error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /analytics/bin-history/:bin_type  — recent events for a bin
// ============================================================
// NOTE: The old route queried Bin documents for history, which
// only ever returns one record (the current state). We now query
// WasteEvents for the correct historical data.
router.get('/analytics/bin-history/:bin_type', async (req, res) => {
  try {
    const mappedType = typeMap[req.params.bin_type?.toLowerCase()] || req.params.bin_type;
    const hours      = parseInt(req.query.hours) || 24;
    const startTime  = new Date();
    startTime.setHours(startTime.getHours() - hours);

    const bin = await Bin.findOne({ bin_type: mappedType });
    if (!bin) {
      return res.status(404).json({ success: false, error: `No bin found for type: ${mappedType}` });
    }

    const events = await WasteEvent.find({
      bin_id:      bin._id,
      detected_at: { $gte: startTime },
    }).sort({ detected_at: 1 });

    res.json({
      success: true,
      bin: { id: bin._id, bin_name: bin.bin_name, bin_type: bin.bin_type, location: bin.location },
      history: events.map(e => ({
        timestamp:  e.detected_at,
        waste_type: e.waste_type,
        weight_kg:  e.weight_kg,
        item_label: e.item_label,
        result:     e.result,
      })),
    });

  } catch (err) {
    console.error('❌ /analytics/bin-history error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /dashboard/stats  — stats for the main dashboard
// ============================================================
router.get('/dashboard/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayCollections, pendingMaintenance, recentCollections, bins] = await Promise.all([
      CollectionLog.countDocuments({ collected_at: { $gte: today } }),
      MaintenanceRequest.countDocuments({ status: 'Pending' }),
      CollectionLog.find().sort({ collected_at: -1 }).limit(10)
        .populate('bin_id', 'bin_name bin_type'),
      Bin.find(),
    ]);

    res.json({
      success: true,
      stats: {
        todayDisposals:    todayCollections,
        pendingMaintenance,
        fullBins:          bins.filter(b => b.status === 'Full').length,
        lastUpdated:       new Date(),
      },
      recentCollections,
    });

  } catch (err) {
    console.error('❌ /dashboard/stats error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /debug  — database record counts
// ============================================================
router.get('/debug', async (req, res) => {
  try {
    const [bins, collections, maintenance, ports, rewards, events] = await Promise.all([
      Bin.countDocuments(),
      CollectionLog.countDocuments(),
      MaintenanceLog.countDocuments(),
      ChargingPort.countDocuments(),
      RewardSession.countDocuments(),
      WasteEvent.countDocuments(),
    ]);

    const latestBin        = await Bin.findOne().sort({ last_updated: -1 });
    const latestCollection = await CollectionLog.findOne().sort({ collected_at: -1 });

    res.json({
      success: true,
      statistics: {
        bins, collections, maintenanceLogs: maintenance,
        chargingPorts: ports, rewardSessions: rewards, wasteEvents: events,
        latestBinUpdate:   latestBin?.last_updated,
        latestCollection:  latestCollection?.collected_at,
      },
    });

  } catch (err) {
    console.error('❌ /debug error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// GET /test  — sanity check
// ============================================================
router.get('/test', (req, res) => {
  res.json({
    success: true,
    message: 'E-Bin ESP32 routes are working correctly',
    endpoints: [
      'GET  /api/esp32/latest',
      'POST /api/esp32/sensors/update',
      'POST /api/esp32/sensors/bulk-update',
      'POST /api/esp32/collection/record',
      'POST /api/esp32/maintenance/record',
      'POST /api/esp32/events',
      'POST /api/esp32/reward/start',
      'POST /api/esp32/reward/end',
      'GET  /api/esp32/collections',
      'GET  /api/esp32/maintenance',
      'GET  /api/esp32/ports',
      'POST /api/esp32/device/health',
      'POST /api/esp32/alert',
      'GET  /api/esp32/public/summary',
      'GET  /api/esp32/analytics/waste-composition',
      'GET  /api/esp32/analytics/bin-history/:bin_type',
      'GET  /api/esp32/dashboard/stats',
      'GET  /api/esp32/debug',
    ],
  });
});

module.exports = router;