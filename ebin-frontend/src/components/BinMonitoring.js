// BinMonitoring.js
import React, { useMemo, useState, useEffect } from 'react';
import './BinMonitoring.css';
import { useEbin } from '../EbinContext';
import { io } from 'socket.io-client';
import {
  BASE_URL,

  computeFillPct,
  getWeightPerBin,
  useThresholds,
} from '../utils/binFill';

const SENSOR_URL = `${BASE_URL}/api/esp32/sensors/update`;

const socket = io(BASE_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

const getFullTypeName = (type) => {
  if (type === 'Biodegradable')     return 'Biodegradable';
  if (type === 'Non-Biodegradable') return 'Non-Biodegradable';
  if (type === 'Recyclable')        return 'Recyclable';
  return 'General Waste';
};

const getStatusClass = (status) => {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':      return 'status-active';
    case 'FULL':        return 'status-full';
    case 'MAINTENANCE': return 'status-maintenance';
    default:            return 'status-unknown';
  }
};

const getTypeColor = (type) => {
  if (type === 'Biodegradable')     return '#4CAF50';
  if (type === 'Recyclable')        return '#2196F3';
  if (type === 'Non-Biodegradable') return '#FF9800';
  return '#9E9E9E';
};

const getBinTypeKey = (type) => {
  if (type === 'Recyclable')        return 'recyclable';
  if (type === 'Biodegradable')     return 'biodegradable';
  if (type === 'Non-Biodegradable') return 'non_biodegradable';
  return 'non_biodegradable';
};

// ── Empty Bin confirmation modal ──────────────────────────────
const EmptyConfirmModal = ({ bin, onConfirm, onCancel, loading }) => (
  <div className="modal-overlay">
    <div className="modal-box">
      <div className="modal-icon">🗑️</div>
      <h3 className="modal-title">Empty This Bin?</h3>
      <p className="modal-desc">
        This will mark <strong>{bin.bin_name}</strong> ({getFullTypeName(bin.bin_type)}) as emptied
        and reset its fill level back to <strong>0%</strong>.
      </p>
      <div className="modal-actions">
        <button className="modal-btn modal-btn-cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button className="modal-btn modal-btn-confirm" onClick={onConfirm} disabled={loading}>
          {loading ? 'Emptying...' : 'Yes, Empty Bin'}
        </button>
      </div>
    </div>
  </div>
);

// ── Individual bin row (fill level = weight based, capacity is 10kg / 100L) ──
const BinRow = ({ bin, totalWeight, thresholds, onEmptyClick }) => {
  // Fill % = accumulated waste weight (kg) / physical capacity (10kg ≈ 100L).
  // Shared with the Dashboard Overview through utils/binFill.js.
  const fillPct = computeFillPct(totalWeight);
  const typeColor = getTypeColor(bin.bin_type);
  const isFull = fillPct >= thresholds.full;

  // Status badge follows the computed fill, so it matches the Overview
  const displayStatus =
    String(bin.status).toUpperCase() === 'MAINTENANCE'
      ? 'MAINTENANCE'
      : isFull
        ? 'FULL'
        : (bin.status || 'ACTIVE');

  return (
    <tr className="bin-row">
      <td>
        <div className="bin-info">
          <div className="bin-name-wrapper">
            <span className="bin-type-indicator" style={{ backgroundColor: typeColor }} />
            <div>
              <div className="bin-name">{bin.bin_name}</div>
              <div className="bin-type-label" style={{ color: typeColor }}>
                {getFullTypeName(bin.bin_type)}
              </div>
            </div>
          </div>
        </div>
      </td>
      <td>
        <div className="fill-level-container">
          <div className="fill-bar">
            <div
              className={`fill-bar-fill ${
                fillPct >= thresholds.overflow ? 'critical' :
                fillPct >= thresholds.full     ? 'high'     :
                fillPct >= thresholds.nearFull ? 'medium'   : 'low'
              }`}
              style={{ width: `${fillPct}%` }}
            />
          </div>
          <div className="fill-percentage">{fillPct}%</div>
        </div>
      </td>
      <td>
        <span className={`status-badge ${getStatusClass(displayStatus)}`}>
          {displayStatus}
        </span>
      </td>
      <td>
        <span className="weight-value">{totalWeight.toFixed(1)} kg</span>
      </td>
      <td>
        <button
          className={`empty-bin-btn ${isFull ? 'empty-bin-btn-urgent' : ''}`}
          onClick={() => onEmptyClick(bin)}
          title="Mark this bin as emptied and reset its fill level to 0%"
        >
          Empty Bin
        </button>
      </td>
    </tr>
  );
};

// ── Stats cards – uses stats.totalEventsWeight directly (same as WasteSegregation) ──
const StatsCard = ({ bins, stats }) => (
  <div className="stats-grid">
    <div className="stat-card">
      <div className="stat-value">{stats.totalBins}</div>
      <div className="stat-label">Total Bins</div>
      <div className="stat-breakdown">
        <span className="stat-bio"> {bins.filter(b => b.bin_type === 'Biodegradable').length} Biodegradable</span>
        <span className="stat-recycle"> {bins.filter(b => b.bin_type === 'Recyclable').length} Recyclable</span>
        <span className="stat-nonbio">{bins.filter(b => b.bin_type === 'Non-Biodegradable').length} Non-Biodegradable</span>
      </div>
    </div>

    <div className="stat-card">
      <div className="stat-value">{stats.totalEventsWeight.toFixed(2)} kg</div>
      <div className="stat-label">Total Waste Weight</div>
      <div className="stat-trend">From waste events</div>
    </div>

    <div className="stat-card">
      <div className="stat-value">{stats.totalEvents}</div>
      <div className="stat-label">Total Detections</div>
      <div className="stat-trend">
        ♻️ {stats.recyclableEvents} · 🌱 {stats.biodegradableEvents} · 🗑️ {stats.nonBioEvents}
      </div>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────
const BinMonitoring = () => {
  const {
    bins, wasteEvents, stats, loadingBins, errorBins,
    refreshAll,
    resetClearedTypes,
    emptiedAt,
    markBinEmptied,
  } = useEbin();

  const [confirmBin,  setConfirmBin]  = useState(null);
  const [resetting,   setResetting]   = useState(false);
  const [resetResult, setResetResult] = useState(null);

  // Thresholds from /api/settings (shared with the Dashboard Overview)
  const thresholds = useThresholds();

  // Total weight per bin, summed from waste events (shared helper)
  const totalWeightPerBin = useMemo(
    () => getWeightPerBin(wasteEvents, emptiedAt),
    [wasteEvents, emptiedAt]
  );

  const sortedBins = useMemo(() => [...bins].sort((a, b) => {
    const order = { Biodegradable: 1, Recyclable: 2, 'Non-Biodegradable': 3 };
    return (order[a.bin_type] || 99) - (order[b.bin_type] || 99);
  }), [bins]);

  // Socket real-time updates
  useEffect(() => {
    socket.on('bin-updated', async (data) => {
      console.log('📡 Real-time bin update received:', data);
      if (data.type === 'CLEARED' || data.type === 'RESET' || data.type === 'HISTORY_DELETED') {
        setResetResult({
          success: true,
          message: `🔄 Real-time update: ${data.binName} has been emptied. Refreshing data...`,
        });
        await refreshAll();
        setTimeout(() => setResetResult(null), 3000);
      } else {
        // Any other update (new detection, sensor reading, etc.): refresh quietly
        await refreshAll();
      }
    });
    return () => { socket.off('bin-updated'); };
  }, [refreshAll]);

  const handleEmptyConfirm = async () => {
    if (!confirmBin) return;
    setResetting(true);

    try {
      const token = localStorage.getItem('token');

      // Reset the bin's fill level (waste history is kept)
      const resetRes = await fetch(`${BASE_URL}/api/bins/${confirmBin._id}/reset`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!resetRes.ok) throw new Error('Failed to empty bin');
      await resetRes.json();

      // Fill level restarts from now; existing waste events stay in the log
      markBinEmptied(confirmBin.bin_name);

      await fetch(SENSOR_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bin_type:  getBinTypeKey(confirmBin.bin_type),
          bin_level: 0,
          weight_kg: 0,
          status:    'ACTIVE',
        }),
      }).catch(err => console.warn('ESP32 update failed:', err));

      setResetResult({
        success: true,
        message: `✅ ${confirmBin.bin_name} has been emptied.`,
      });

      await refreshAll();
      setTimeout(() => setResetResult(null), 5000);

    } catch (e) {
      console.error('Error emptying bin:', e);
      setResetResult({ success: false, message: `❌ Failed to empty bin: ${e.message}` });
      setTimeout(() => setResetResult(null), 5000);
    } finally {
      setResetting(false);
      setConfirmBin(null);
    }
  };

  const handleManualRefresh = () => {
    resetClearedTypes();
    refreshAll();
    setResetResult({ success: true, message: '🔄 Manual refresh complete! Data reloaded from server.' });
    setTimeout(() => setResetResult(null), 3000);
  };

  if (loadingBins && bins.length === 0) {
    return (
      <div className="bin-monitoring">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading bin data...</p>
        </div>
      </div>
    );
  }

  if (errorBins && bins.length === 0) {
    return (
      <div className="bin-monitoring">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <p>{errorBins}</p>
          <button onClick={handleManualRefresh} className="retry-button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bin-monitoring">
      {confirmBin && (
        <EmptyConfirmModal
          bin={confirmBin}
          onConfirm={handleEmptyConfirm}
          onCancel={() => setConfirmBin(null)}
          loading={resetting}
        />
      )}

      {resetResult && (
        <div className={`reset-toast ${resetResult.success ? 'toast-success' : 'toast-error'}`}>
          {resetResult.message}
          <button className="toast-close" onClick={() => setResetResult(null)}>✕</button>
        </div>
      )}

      <StatsCard bins={bins} stats={stats} />

      <div className="table-wrapper">
        <div className="table-header">
          <h3>All Bins</h3>
          <div className="table-stats">
            <span>{bins.length} total bins</span>
            <button className="refresh-button" onClick={handleManualRefresh} title="Refresh">🔄</button>
          </div>
        </div>

        <div className="table-responsive">
          <table className="bins-table">
            <thead>
              <tr>
                <th>Bin Information</th>
                <th>Fill Level</th>
                <th>Status</th>
                <th>Weight</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedBins.map(bin => (
                <BinRow
                  key={bin._id}
                  bin={bin}
                  totalWeight={totalWeightPerBin.get(bin.bin_name) || 0}
                  thresholds={thresholds}
                  onEmptyClick={(b) => setConfirmBin(b)}
                />
              ))}
            </tbody>
          </table>
        </div>

      
      </div>
    </div>
  );
};

export default BinMonitoring;