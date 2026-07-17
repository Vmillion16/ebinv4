// BinMonitoring.js
import React, { useMemo, useState, useEffect } from 'react';
import './BinMonitoring.css';
import { useEbin } from '../EbinContext';
import { io } from 'socket.io-client';

const BASE_URL   = "https://ebinv4-1.onrender.com";
const SENSOR_URL = `${BASE_URL}/api/esp32/sensors/update`;

// Physical bin capacity: 10kg / 100 liters. Fill level is now derived directly
// from the actual accumulated waste weight (kg) for that bin, not item count.
const MAX_BIN_CAPACITY_KG = 10;

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

// Convert accumulated waste weight (kg) into a fill percentage against the
// bin's physical capacity (10kg / 100L). Clamped to [0, 100].
const computeFillPctFromWeight = (weightKg) => {
  const pct = (weightKg / MAX_BIN_CAPACITY_KG) * 100;
  return Math.min(Math.max(Math.round(pct), 0), 100);
};

// ── Empty Bin confirmation modal ──────────────────────────────
const EmptyConfirmModal = ({ bin, onConfirm, onCancel, loading }) => (
  <div className="modal-overlay">
    <div className="modal-box">
      <div className="modal-icon">🗑️</div>
      <h3 className="modal-title">Mark Bin as Emptied?</h3>
      <p className="modal-desc">
        This will <strong>PERMANENTLY DELETE</strong> all waste history and reset{' '}
        <strong>{bin.bin_name}</strong> ({getFullTypeName(bin.bin_type)}) fill level back to{' '}
        <strong>0%</strong>.
      </p>
      <p className="modal-warning">
        ⚠️ This action cannot be undone! All waste events and collection logs for this bin will be
        permanently deleted.
      </p>
      <div className="modal-actions">
        <button className="modal-btn modal-btn-cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button className="modal-btn modal-btn-confirm" onClick={onConfirm} disabled={loading}>
          {loading ? 'Deleting & Resetting...' : '🗑️ Yes, Delete History & Empty'}
        </button>
      </div>
    </div>
  </div>
);

// ── Individual bin row (fill level = weight based, capacity is 10kg / 100L) ──
const BinRow = ({ bin, totalWeight, thresholds, onEmptyClick }) => {
  // Fill percentage is now computed from the bin's actual accumulated waste
  // weight (kg), scaled against the physical capacity of 10kg (≈100 liters).
  // This replaces the old item-count based estimate (+10% per detection),
  // which drifted from reality whenever items had very different weights.
  const fillPct = computeFillPctFromWeight(totalWeight);
  const typeColor = getTypeColor(bin.bin_type);
  const isFull = fillPct >= thresholds.full;

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
        <span className={`status-badge ${getStatusClass(bin.status)}`}>
          {bin.status || 'ACTIVE'}
        </span>
      </td>
      <td>
        <span className="weight-value">{totalWeight.toFixed(1)} kg</span>
      </td>
      <td>
        <button
          className={`empty-bin-btn ${isFull ? 'empty-bin-btn-urgent' : ''}`}
          onClick={() => onEmptyClick(bin)}
          title="Permanently delete all waste history and reset bin fill level to 0%"
        >
          {isFull ? '🚨 Empty & Delete History' : '🗑️ Delete History & Empty'}
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
        <span className="stat-bio">🌱 {bins.filter(b => b.bin_type === 'Biodegradable').length} Biodegradable</span>
        <span className="stat-recycle">♻️ {bins.filter(b => b.bin_type === 'Recyclable').length} Recyclable</span>
        <span className="stat-nonbio">🗑️ {bins.filter(b => b.bin_type === 'Non-Biodegradable').length} Non-Biodegradable</span>
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
  } = useEbin();

  const [confirmBin,  setConfirmBin]  = useState(null);
  const [resetting,   setResetting]   = useState(false);
  const [resetResult, setResetResult] = useState(null);
  const [thresholds,  setThresholds]  = useState({
    nearFull: 75,
    full:     90,
    overflow: 95,
  });

  // ── Compute total weight per bin directly from wasteEvents — this now
  // drives the fill % as well as the displayed weight, since fill level is
  // weight-based against the 10kg / 100L physical capacity. ──
  const totalWeightPerBin = useMemo(() => {
    const map = new Map();
    wasteEvents.forEach(event => {
      const binName = event.bin;
      const weight = event.weight_kg ?? 0;
      map.set(binName, (map.get(binName) || 0) + weight);
    });
    return map;
  }, [wasteEvents]);

  const sortedBins = useMemo(() => [...bins].sort((a, b) => {
    const order = { Biodegradable: 1, Recyclable: 2, 'Non-Biodegradable': 3 };
    return (order[a.bin_type] || 99) - (order[b.bin_type] || 99);
  }), [bins]);

  // Fetch thresholds from backend settings
  useEffect(() => {
    const fetchThresholds = async () => {
      try {
        const token = localStorage.getItem('token');
        const res   = await fetch(`${BASE_URL}/api/settings`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setThresholds({
            nearFull: data.nearFullThreshold ?? 75,
            full:     data.fullThreshold     ?? 90,
            overflow: data.overflowThreshold ?? 95,
          });
        }
      } catch (err) {
        console.error('Failed to load thresholds', err);
      }
    };
    fetchThresholds();
  }, []);

  // Socket real‑time updates
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
      }
    });
    return () => { socket.off('bin-updated'); };
  }, [refreshAll]);

  const handleEmptyConfirm = async () => {
    if (!confirmBin) return;
    setResetting(true);

    try {
      const token = localStorage.getItem('token');

      const deleteHistoryRes = await fetch(`${BASE_URL}/api/bins/${confirmBin._id}/clear-history`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!deleteHistoryRes.ok) {
        const errorData = await deleteHistoryRes.json();
        throw new Error(errorData.error || 'Failed to delete bin history');
      }
      const deleteResult = await deleteHistoryRes.json();

      const resetRes = await fetch(`${BASE_URL}/api/bins/${confirmBin._id}/reset`, {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!resetRes.ok) throw new Error('Failed to reset bin fill level');
      await resetRes.json();

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
        message: `✅ ${confirmBin.bin_name} emptied and ALL waste history permanently deleted! ${deleteResult.deletedEvents || 0} events removed.`,
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

        <p className="table-note">
          💡 Fill levels are weight-based: each bin holds up to <strong>{MAX_BIN_CAPACITY_KG}kg (≈100 liters)</strong>,
          and the percentage shown is the bin's accumulated waste weight divided by that capacity.<br />
          🗑️ Press <strong>"Delete History & Empty"</strong> to permanently delete all waste records and reset the bin to 0%.
        </p>
      </div>
    </div>
  );
};

export default BinMonitoring;