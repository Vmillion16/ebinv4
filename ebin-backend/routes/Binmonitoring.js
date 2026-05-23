// BinMonitoring.js
import React, { useMemo, useState } from 'react';
import './BinMonitoring.css';
import { useEbin } from '../EbinContext';
import API_URL from '../config';

const BASE_URL   = "https://ebinv4-1.onrender.com";
const SENSOR_URL = `${BASE_URL}/api/esp32/sensors/update`;

const getFullTypeName = (type) => {
  if (type === 'Biodegradable')     return 'Biodegradable';
  if (type === 'Non-Biodegradable') return 'Non-Biodegradable';
  if (type === 'Recyclable')        return 'Recyclable';
  return 'General Waste';
};

const getPriorityLabel = (fillLevel) => {
  if (fillLevel >= 90) return { label: 'CRITICAL', cls: 'critical' };
  if (fillLevel >= 76) return { label: 'HIGH',     cls: 'high' };
  if (fillLevel >= 51) return { label: 'MEDIUM',   cls: 'medium' };
  return                       { label: 'LOW',      cls: 'low' };
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
      <h3 className="modal-title">Mark Bin as Emptied?</h3>
      <p className="modal-desc">
        This will reset <strong>{bin.bin_name}</strong> ({getFullTypeName(bin.bin_type)}) fill level
        back to <strong>0%</strong>, mark it as <strong>ACTIVE</strong>, and{' '}
        <strong>permanently delete</strong> all its collection logs.
      </p>
      <p className="modal-warning">Only do this after the bin has been physically emptied.</p>
      <div className="modal-actions">
        <button className="modal-btn modal-btn-cancel" onClick={onCancel} disabled={loading}>
          Cancel
        </button>
        <button className="modal-btn modal-btn-confirm" onClick={onConfirm} disabled={loading}>
          {loading ? 'Processing...' : '✅ Yes, Bin is Empty'}
        </button>
      </div>
    </div>
  </div>
);

// ── Individual bin row ────────────────────────────────────────
const BinRow = ({ bin, onEmptyClick }) => {
  const { label, cls } = getPriorityLabel(bin.fillLevel);
  const fillPct        = Math.min(Math.round(bin.fillLevel), 100);
  const typeColor      = getTypeColor(bin.bin_type);
  const isFull         = fillPct >= 90;

  return (
    <tr className={`bin-row priority-${cls}`}>
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
                fillPct >= 90 ? 'critical' :
                fillPct >= 76 ? 'high' :
                fillPct >= 51 ? 'medium' : 'low'
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
        <span className="weight-value">{(bin.weight_kg ?? 0).toFixed(1)} kg</span>
      </td>
      <td>
        <span className={`priority-badge priority-${cls}`}>{label}</span>
      </td>
      <td>
        <button
          className={`empty-bin-btn ${isFull ? 'empty-bin-btn-urgent' : ''}`}
          onClick={() => onEmptyClick(bin)}
          title="Mark this bin as emptied — resets fill level and deletes logs"
        >
          {isFull ? '🚨 Empty Now' : '🗑️ Mark Empty'}
        </button>
      </td>
    </tr>
  );
};

// ── Stats cards ───────────────────────────────────────────────
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
      <div className="stat-value">{stats.avgFillLevel.toFixed(0)}%</div>
      <div className="stat-label">Average Fill Level</div>
      <div className="stat-trend">
        {stats.avgFillLevel > 70 ? '⚠️ Needs attention' : '✅ Operating normally'}
      </div>
    </div>
    <div className="stat-card">
      <div className="stat-value">{stats.totalBinWeight.toFixed(1)} kg</div>
      <div className="stat-label">Total Waste Weight</div>
      <div className="stat-trend">Across all bins</div>
    </div>
    <div className="stat-card">
      <div className="stat-value">{stats.totalEvents}</div>
      <div className="stat-label">Total Detections</div>
      <div className="stat-trend">♻️ {stats.recyclableEvents} · 🌱 {stats.biodegradableEvents} · 🗑️ {stats.nonBioEvents}</div>
    </div>
  </div>
);

// ── Main component ────────────────────────────────────────────
const BinMonitoring = () => {
  const {
    bins, stats, loadingBins, errorBins,
    fetchBins,
    refreshAll,
    clearEventsForBin,
    resetClearedTypes,
  } = useEbin();

  const [confirmBin,  setConfirmBin]  = useState(null);
  const [resetting,   setResetting]   = useState(false);
  const [resetResult, setResetResult] = useState(null);

  const sortedBins = useMemo(() => [...bins].sort((a, b) => {
    const order = { Biodegradable: 1, Recyclable: 2, 'Non-Biodegradable': 3 };
    return (order[a.bin_type] || 99) - (order[b.bin_type] || 99);
  }), [bins]);

  const handleEmptyConfirm = async () => {
    if (!confirmBin) return;
    setResetting(true);

    try {
      // ── Step 1: Reset bin sensor data via ESP32 endpoint ──
      const sensorRes = await fetch(SENSOR_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bin_type:  getBinTypeKey(confirmBin.bin_type),
          bin_level: 0,
          weight_kg: 0,
          status:    'ACTIVE',
        }),
      });

      if (!sensorRes.ok) {
        const err = await sensorRes.json().catch(() => ({}));
        throw new Error(err.message || sensorRes.statusText);
      }

      // ── Step 2: Permanently delete collection logs from MongoDB ──
      const token = localStorage.getItem('token'); // adjust key if yours differs
      const deleteRes = await fetch(`${API_URL}/collection-logs/by-bin/${confirmBin._id}`, {
        method:  'DELETE',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      const deleteData = await deleteRes.json().catch(() => ({}));

      if (!deleteRes.ok) {
        // Sensor was reset but DB delete failed — warn but don't block
        console.warn('DB delete failed:', deleteData.error);
        setResetResult({
          success: true,
          message: `✅ ${confirmBin.bin_name} reset to 0%, but log deletion failed: ${deleteData.error || 'unknown error'}`,
        });
      } else {
        setResetResult({
          success: true,
          message: `✅ ${confirmBin.bin_name} emptied and ${deleteData.deletedCount ?? 0} log(s) permanently deleted.`,
        });
      }

      // ── Step 3: Hide events instantly in UI + refresh bins ──
      clearEventsForBin(confirmBin.bin_type);
      await fetchBins();

    } catch (e) {
      setResetResult({ success: false, message: `❌ Error: ${e.message}` });
    } finally {
      setResetting(false);
      setConfirmBin(null);
    }
  };

  const handleManualRefresh = () => {
    resetClearedTypes();
    refreshAll();
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

      <div className="monitoring-header">
        <h1>🗑️ Bin Monitoring</h1>
        <p>Real-time waste bin status and fill levels</p>
      </div>

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
                <th>Priority</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {sortedBins.map(bin => (
                <BinRow
                  key={bin._id}
                  bin={bin}
                  onEmptyClick={(b) => setConfirmBin(b)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <p className="table-note">
          💡 Press <strong>"Mark Empty"</strong> after physically collecting waste to reset the fill
          level to 0% and permanently clear all collection logs for that bin.
          Bins at 90%+ are highlighted as 🚨 urgent.
        </p>
      </div>
    </div>
  );
};

export default BinMonitoring;