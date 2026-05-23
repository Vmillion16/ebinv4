// BinMonitoring.js
import React, { useMemo, useState, useEffect } from 'react';
import './BinMonitoring.css';
import { useEbin } from '../EbinContext';
import { io } from 'socket.io-client';

const BASE_URL   = "https://ebinv4-1.onrender.com";
const SENSOR_URL = `${BASE_URL}/api/esp32/sensors/update`;

// Create socket connection
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
        This will <strong>PERMANENTLY DELETE</strong> all waste history and reset <strong>{bin.bin_name}</strong> ({getFullTypeName(bin.bin_type)}) fill level back to <strong>0%</strong>.
      </p>
      <p className="modal-warning">⚠️ This action cannot be undone! All waste events and collection logs for this bin will be permanently deleted.</p>
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
          title="Permanently delete all waste history and reset bin fill level to 0%"
        >
          {isFull ? '🚨 Empty & Delete History' : '🗑️ Delete History & Empty'}
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
  const [socketConnected, setSocketConnected] = useState(false);

  const sortedBins = useMemo(() => [...bins].sort((a, b) => {
    const order = { Biodegradable: 1, Recyclable: 2, 'Non-Biodegradable': 3 };
    return (order[a.bin_type] || 99) - (order[b.bin_type] || 99);
  }), [bins]);

  // Socket.io connection and event listeners
  useEffect(() => {
    // Connection events
    socket.on('connect', () => {
      console.log('✅ Socket connected for real-time updates');
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected');
      setSocketConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setSocketConnected(false);
    });

    // Listen for bin update events from server
    socket.on('bin-updated', async (data) => {
      console.log('📡 Real-time bin update received:', data);
      
      if (data.type === 'CLEARED' || data.type === 'RESET') {
        // Show notification
        setResetResult({
          success: true,
          message: `🔄 Real-time update: ${data.binName} has been emptied${data.deletedBy ? ` by ${data.deletedBy}` : ''}! Refreshing data...`
        });
        
        // Refresh bins to get updated data
        await fetchBins();
        
        // Clear the notification after 3 seconds
        setTimeout(() => setResetResult(null), 3000);
      }
      
      if (data.type === 'HISTORY_DELETED') {
        setResetResult({
          success: true,
          message: `🗑️ All waste history for ${data.binName} has been permanently deleted!`
        });
        await fetchBins();
        setTimeout(() => setResetResult(null), 3000);
      }
    });

    // Cleanup on component unmount
    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('bin-updated');
    };
  }, [fetchBins]);

  // ── Called when user confirms emptying - NOW DELETES HISTORY ──
  const handleEmptyConfirm = async () => {
    if (!confirmBin) return;
    setResetting(true);

    try {
      const token = localStorage.getItem('token');
      
      // STEP 1: Delete ALL history for this bin (WasteEvents + CollectionLogs)
      console.log(`🗑️ Deleting history for bin: ${confirmBin._id}`);
      const deleteHistoryRes = await fetch(`${BASE_URL}/api/bins/${confirmBin._id}/clear-history`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!deleteHistoryRes.ok) {
        const errorData = await deleteHistoryRes.json();
        throw new Error(errorData.error || 'Failed to delete bin history');
      }

      const deleteResult = await deleteHistoryRes.json();
      console.log('History deletion result:', deleteResult);

      // STEP 2: Reset bin fill level to 0
      const resetRes = await fetch(`${BASE_URL}/api/bins/${confirmBin._id}/reset`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!resetRes.ok) {
        throw new Error('Failed to reset bin fill level');
      }

      const resetResult_data = await resetRes.json();
      console.log('Reset result:', resetResult_data);

      // STEP 3: Also call ESP32 sensor endpoint for immediate UI update
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
        message: `✅ ${confirmBin.bin_name} has been emptied and ALL waste history permanently deleted! ${deleteResult.deletedEvents || 0} events and ${deleteResult.deletedLogs || 0} logs removed.`
      });
      
      // Clear events for this bin type in WasteSegregation
      clearEventsForBin(confirmBin.bin_type);
      
      // Refresh bins to show updated data
      await fetchBins();
      
      // Auto-hide notification after 5 seconds
      setTimeout(() => setResetResult(null), 5000);
      
    } catch (e) {
      console.error('Error emptying bin:', e);
      setResetResult({ 
        success: false, 
        message: `❌ Failed to empty bin: ${e.message}` 
      });
      setTimeout(() => setResetResult(null), 5000);
    } finally {
      setResetting(false);
      setConfirmBin(null);
    }
  };

  // ── Manual refresh: restore events + reload everything ──
  const handleManualRefresh = () => {
    resetClearedTypes();  // unblock any cleared types
    refreshAll();         // re-fetch bins + events fresh
    setResetResult({
      success: true,
      message: '🔄 Manual refresh complete! Data reloaded from server.'
    });
    setTimeout(() => setResetResult(null), 3000);
  };

  // ── Loading / error states ──
  if (loadingBins && bins.length === 0) {
    return (
      <div className="bin-monitoring">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading bin data...</p>
          {!socketConnected && <p className="socket-warning">⚠️ Connecting to real-time server...</p>}
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
        {socketConnected && <span className="live-badge">🟢 LIVE</span>}
        {!socketConnected && <span className="offline-badge">🔴 OFFLINE</span>}
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
          💡 Press <strong>"Delete History & Empty"</strong> to permanently delete all waste records and reset the bin to 0%.
          🗑️ This action <strong>cannot be undone</strong> and will remove all waste events and collection logs for this bin.
          🟢 <strong>LIVE</strong> indicator shows real-time updates are active.
        </p>
      </div>
    </div>
  );
};

export default BinMonitoring;