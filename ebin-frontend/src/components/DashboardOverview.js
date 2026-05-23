// DashboardOverview.js — uses shared EbinContext
import React, { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import './DashboardOverview.css';
import { useEbin } from '../EbinContext';

const COLORS = {
  full:     '#E24B4A',
  nearFull: '#F59E0B',
  active:   '#1D9E75',
  maint:    '#6b7280',
};

// Derives status label from fill level number
const getBinStatus = (fillLevel) => {
  if (fillLevel >= 90) return 'Full';
  if (fillLevel >= 75) return 'Near Full';
  return 'Active';
};

const getStatusColor = (status) => {
  if (status === 'Full')        return COLORS.full;
  if (status === 'Near Full')   return COLORS.nearFull;
  if (status === 'Maintenance') return COLORS.maint;
  return COLORS.active;
};

const getFillBarColor = (fill) => {
  if (fill >= 90) return COLORS.full;
  if (fill >= 75) return COLORS.nearFull;
  return COLORS.active;
};

// Fill level label — CRITICAL / HIGH / MEDIUM / LOW
const getFillLabel = (fill) => {
  if (fill >= 90) return { text: 'CRITICAL', color: COLORS.full };
  if (fill >= 75) return { text: 'HIGH',     color: COLORS.nearFull };
  if (fill >= 51) return { text: 'MEDIUM',   color: '#3b82f6' };
  return                  { text: 'LOW',      color: COLORS.active };
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

const DashboardOverview = () => {
  // ✅ removed errorBins — was unused
  const { bins, wasteEvents, stats, loadingBins, refreshAll, lastSync } = useEbin();

  // Build last-7-days waste trend from real waste events
  const trend = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const map = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };

    wasteEvents.forEach(e => {
      const d = new Date(e.time);
      const dayLabel = days[d.getDay()];
      map[dayLabel] = parseFloat((map[dayLabel] + e.weight_kg).toFixed(2));
    });

    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({
      day,
      kg: map[day],
    }));
  }, [wasteEvents]);

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

      {/* ── Summary cards ── */}
      <div className="do-summary-row">
        <div className="do-summary-card">
          <span className="do-summary-number">{stats.totalBins}</span>
          <span className="do-summary-label">Total Bins</span>
        </div>
        <div className="do-summary-card" style={{ borderColor: COLORS.full }}>
          <span className="do-summary-number" style={{ color: COLORS.full }}>{stats.fullBins}</span>
          <span className="do-summary-label">Full Bins</span>
        </div>
        <div className="do-summary-card" style={{ borderColor: COLORS.nearFull }}>
          <span className="do-summary-number" style={{ color: COLORS.nearFull }}>{stats.nearFullBins}</span>
          <span className="do-summary-label">Near Full</span>
        </div>
        <div className="do-summary-card">
          <span className="do-summary-number">{stats.totalEvents}</span>
          <span className="do-summary-label">Total Detections</span>
        </div>
        <div className="do-summary-card">
          <span className="do-summary-number">{stats.totalEventsWeight.toFixed(2)} kg</span>
          <span className="do-summary-label">Total Waste Weight</span>
        </div>
      </div>

      {/* ── Waste trend ── */}
      <div className="do-card do-card-full">
        <p className="do-card-title">Waste trend — last 7 days</p>
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

      {/* ── Priority bins ── */}
      <div className="do-card do-card-full">
        <div className="do-card-header">
          <p className="do-card-title" style={{ margin: 0 }}>Priority bins</p>
          {stats.priorityBins.length > 0
            ? <span className="do-badge do-badge-warn">{stats.priorityBins.length} need attention</span>
            : <span className="do-badge do-badge-ok">All bins normal</span>
          }
        </div>

        {bins.length === 0 ? (
          <div className="do-all-ok"><p>No bins data available</p></div>

        ) : stats.priorityBins.length === 0 ? (
          // Show all bins with their fill level labels even when none are priority
          <div className="do-all-ok">
            <span className="do-ok-icon">✓</span>
            <p>No bins require immediate collection (threshold: 75%)</p>
            {bins.map((bin, idx) => {
              const fill = bin.fillLevel ?? 0;
              const fillLabel = getFillLabel(fill);
              return (
                <div key={idx} className="do-priority-row" style={{ marginTop: '10px' }}>
                  <div className="do-priority-left">
                    <span className="do-priority-dot" style={{ background: getFillBarColor(fill) }} />
                    <span className="do-priority-name">{bin.bin_name}</span>
                    <span className="do-priority-type">{bin.bin_type}</span>
                  </div>
                  <div className="do-priority-center">
                    <div className="do-fill-bar-bg">
                      <div
                        className="do-fill-bar-fill"
                        style={{ width: `${fill}%`, background: getFillBarColor(fill) }}
                      />
                    </div>
                  </div>
                  <div className="do-priority-right">
                    <span className="do-fill-pct">{fill}%</span>
                    {/* ✅ Fill label badge */}
                    <span
                      className="do-status-tag"
                      style={{
                        background: `${fillLabel.color}18`,
                        color: fillLabel.color,
                        border: `1px solid ${fillLabel.color}40`,
                      }}
                    >
                      {fillLabel.text}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

        ) : (
          // Priority bins list with fill labels
          <div className="do-priority-list">
            {stats.priorityBins.map((bin, i) => {
              const fill   = bin.fillLevel ?? 0;
              const status = bin.status || getBinStatus(fill);
              const fillLabel = getFillLabel(fill);
              return (
                <div key={bin._id ?? i} className="do-priority-row">
                  <div className="do-priority-left">
                    <span className="do-priority-dot" style={{ background: getFillBarColor(fill) }} />
                    <span className="do-priority-name">{bin.bin_name}</span>
                    <span className="do-priority-type">{bin.bin_type}</span>
                  </div>
                  <div className="do-priority-center">
                    <div className="do-fill-bar-bg">
                      <div
                        className="do-fill-bar-fill"
                        style={{ width: `${fill}%`, background: getFillBarColor(fill) }}
                      />
                    </div>
                  </div>
                  <div className="do-priority-right">
                    <span className="do-fill-pct">{fill}%</span>
                    {/* ✅ Shows both status (Full/Near Full) AND fill label (CRITICAL/HIGH) */}
                    <span
                      className="do-status-tag"
                      style={{
                        background: `${getStatusColor(status)}18`,
                        color: getStatusColor(status),
                        border: `1px solid ${getStatusColor(status)}40`,
                      }}
                    >
                      {status}
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