// DashboardOverview.js
import React, { useMemo, useEffect } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import { io } from 'socket.io-client';
import './DashboardOverview.css';
import { useEbin } from '../EbinContext';
import {
  BASE_URL,
  computeFillPct,
  getWeightPerBin,
  getEventWeightKg,
  useThresholds,
} from '../utils/binFill';

// Fallback polling in case the socket misses an update. Set to 0 to disable.
const AUTO_REFRESH_MS = 30000;

const COLORS = {
  full:     '#E24B4A',
  nearFull: '#F59E0B',
  active:   '#1D9E75',
  maint:    '#6b7280',
};

const getStatusColor = (status) => {
  if (status === 'Full')        return COLORS.full;
  if (status === 'Near Full')   return COLORS.nearFull;
  if (status === 'Maintenance') return COLORS.maint;
  return COLORS.active;
};

const getFillBarColor = (fill, t) => {
  if (fill >= t.full)     return COLORS.full;
  if (fill >= t.nearFull) return COLORS.nearFull;
  return COLORS.active;
};

const getFillLabel = (fill, t) => {
  if (fill >= t.full)     return { text: 'CRITICAL', color: COLORS.full };
  if (fill >= t.nearFull) return { text: 'HIGH',     color: COLORS.nearFull };
  if (fill >= 51)         return { text: 'MEDIUM',   color: '#3b82f6' };
  return                         { text: 'LOW',      color: COLORS.active };
};

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="do-tooltip">
      <p className="do-tooltip-label">{label}</p>
      <p className="do-tooltip-val">{payload[0].value} kg collected</p>
    </div>
  );
};

// ─── Date helpers (local time, no UTC shift) ────────────────
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getEventDate = (event) => {
  let raw = event.time ?? event.detected_at ?? event.detectedAt ?? event.timestamp ?? event.createdAt;
  if (!raw) return null;
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2} \d/.test(raw)) {
    raw = raw.replace(' ', 'T');
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const DashboardOverview = () => {
  const { bins = [], wasteEvents = [], stats = {}, loadingBins, refreshAll, lastSync } = useEbin();
  const thresholds = useThresholds();

  // Real-time: refresh whenever the server pushes a bin update
  useEffect(() => {
    const socket = io(BASE_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socket.on('bin-updated', () => refreshAll && refreshAll());
    return () => {
      socket.off('bin-updated');
      socket.disconnect();
    };
  }, [refreshAll]);

  // Fallback auto-refresh
  useEffect(() => {
    if (!AUTO_REFRESH_MS || !refreshAll) return;
    const id = setInterval(() => refreshAll(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshAll]);

  // Fill level per bin: same math as Bin Monitoring
  // (sum of waste event weights for that bin / 10kg)
  const weightPerBin = useMemo(() => getWeightPerBin(wasteEvents), [wasteEvents]);

  const binsWithFill = useMemo(
    () =>
      bins.map((b) => {
        const weight = weightPerBin.get(b.bin_name) || 0;
        const fill = computeFillPct(weight);
        let status = 'Active';
        if (String(b.status).toUpperCase() === 'MAINTENANCE') status = 'Maintenance';
        else if (fill >= thresholds.full) status = 'Full';
        else if (fill >= thresholds.nearFull) status = 'Near Full';
        return { ...b, weight, fill, status };
      }),
    [bins, weightPerBin, thresholds]
  );

  // Summary cards. Full / Near Full use the same thresholds as Bin Monitoring.
  const summary = useMemo(
    () => ({
      totalBins: binsWithFill.length,
      fullBins: binsWithFill.filter((b) => b.fill >= thresholds.full).length,
      nearFullBins: binsWithFill.filter(
        (b) => b.fill >= thresholds.nearFull && b.fill < thresholds.full
      ).length,
    }),
    [binsWithFill, thresholds]
  );

  // Detections + total weight come from the same context stats Bin Monitoring uses
  const totalEvents = stats.totalEvents ?? wasteEvents.length;
  const totalWeight = stats.totalEventsWeight ?? 0;

  // Trend: last 7 calendar days (local time)
  const trend = useMemo(() => {
    const today = new Date();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      days.push({
        key: ymd(d),
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        kg: 0,
      });
    }
    const byKey = new Map(days.map((d) => [d.key, d]));

    wasteEvents.forEach((event) => {
      const date = getEventDate(event);
      if (!date) return;
      const row = byKey.get(ymd(date));
      if (row) row.kg += getEventWeightKg(event);
    });

    return days.map((d) => ({ day: d.day, kg: Math.round(d.kg * 100) / 100 }));
  }, [wasteEvents]);

  const priorityBins = useMemo(
    () =>
      binsWithFill
        .filter((b) => b.fill >= thresholds.nearFull)
        .sort((a, b) => b.fill - a.fill),
    [binsWithFill, thresholds]
  );

  if (loadingBins && bins.length === 0) {
    return (
      <div className="do-container">
        <div className="do-card do-card-full">
          <div className="do-loading">
            <span className="do-loading-dot" />
            <span className="do-loading-dot" />
            <span className="do-loading-dot" />
            <p>Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="do-container">
      {lastSync && (
        <div className="do-sync-info">
          <span className="do-sync-label">Last sync:</span>
          <span className="do-sync-time">{lastSync}</span>
          <button
            onClick={refreshAll}
            style={{ marginLeft: 12, fontSize: 12, cursor: 'pointer', background: 'none', border: 'none' }}
            title="Refresh all data"
          >
            🔄
          </button>
        </div>
      )}

      {/* Summary cards */}
      <div className="do-summary-row">
        <div className="do-summary-card">
          <span className="do-summary-number">{summary.totalBins}</span>
          <span className="do-summary-label">Total Bins</span>
        </div>
        <div className="do-summary-card" style={{ borderColor: COLORS.full }}>
          <span className="do-summary-number" style={{ color: COLORS.full }}>{summary.fullBins}</span>
          <span className="do-summary-label">Full Bins</span>
        </div>
        <div className="do-summary-card" style={{ borderColor: COLORS.nearFull }}>
          <span className="do-summary-number" style={{ color: COLORS.nearFull }}>{summary.nearFullBins}</span>
          <span className="do-summary-label">Near Full</span>
        </div>
        <div className="do-summary-card">
          <span className="do-summary-number">{totalEvents}</span>
          <span className="do-summary-label">Total Detections</span>
        </div>
        <div className="do-summary-card">
          <span className="do-summary-number">{Number(totalWeight).toFixed(2)} kg</span>
          <span className="do-summary-label">Total Waste Weight</span>
        </div>
      </div>

      {/* Weekly trend chart */}
      <div className="do-card do-card-full">
        <p className="do-card-title">Last 7 days waste trend</p>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#1D9E75" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit=" kg" />
            <Tooltip content={<CustomAreaTooltip />} />
            <Area
              type="monotone"
              dataKey="kg"
              stroke="#1D9E75"
              strokeWidth={2}
              fill="url(#areaGrad)"
              dot={{ r: 3, fill: '#1D9E75' }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Priority bins section */}
      <div className="do-card do-card-full">
        <div className="do-card-header">
          <p className="do-card-title" style={{ margin: 0 }}>Priority bins</p>
          {priorityBins.length > 0
            ? <span className="do-badge do-badge-warn">{priorityBins.length} need attention</span>
            : <span className="do-badge do-badge-ok">All bins normal</span>
          }
        </div>

        {binsWithFill.length === 0 ? (
          <div className="do-all-ok"><p>No bins data available</p></div>
        ) : (
          <div className="do-all-ok">
            {priorityBins.length === 0 && <span className="do-ok-icon">✓</span>}
            <p>
              {priorityBins.length === 0
                ? `No bins require immediate collection (threshold: ${thresholds.nearFull}%)`
                : 'Bins that need attention:'}
            </p>
            {(priorityBins.length > 0 ? priorityBins : binsWithFill).map((bin, idx) => {
              const fillLabel = getFillLabel(bin.fill, thresholds);
              const barColor = getFillBarColor(bin.fill, thresholds);
              return (
                <div key={bin._id || idx} className="do-priority-row" style={{ marginTop: '10px' }}>
                  <div className="do-priority-left">
                    <span className="do-priority-dot" style={{ background: barColor }} />
                    <span className="do-priority-name">{bin.bin_name}</span>
                    <span className="do-priority-type">{bin.bin_type}</span>
                  </div>
                  <div className="do-priority-center">
                    <div className="do-fill-bar-bg">
                      <div
                        className="do-fill-bar-fill"
                        style={{ width: `${bin.fill}%`, background: barColor }}
                      />
                    </div>
                  </div>
                  <div className="do-priority-right">
                    <span className="do-fill-pct">
                      {bin.fill}%
                      <span style={{ fontSize: 11, color: '#6b7280', marginLeft: 6 }}>
                        ({bin.weight.toFixed(1)} kg)
                      </span>
                    </span>
                    <span
                      className="do-status-tag"
                      style={{
                        background: `${getStatusColor(bin.status)}18`,
                        color: getStatusColor(bin.status),
                        border: `1px solid ${getStatusColor(bin.status)}40`,
                      }}
                    >
                      {bin.status}
                    </span>
                    <span
                      className="do-status-tag"
                      style={{
                        background: `${fillLabel.color}18`,
                        color: fillLabel.color,
                        border: `1px solid ${fillLabel.color}40`,
                        marginLeft: 4,
                      }}
                    >
                      {fillLabel.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardOverview;