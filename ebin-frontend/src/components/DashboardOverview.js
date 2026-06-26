// DashboardOverview.js — fixed weekly trend (local date, no timezone issues)
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

// Helper: get weekday name (Mon, Tue, ...) from a date string "YYYY-MM-DD" in local time
const getWeekdayFromDateString = (dateStr) => {
  // dateStr format: "2026-05-28"
  const [year, month, day] = dateStr.split('-').map(Number);
  // Use local date (months are 0-indexed in JS)
  const date = new Date(year, month - 1, day);
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return weekdays[date.getDay()];
};

const DashboardOverview = () => {
  const { bins, wasteEvents, stats, loadingBins, refreshAll, lastSync } = useEbin();

  // Trend: last 7 days based on actual waste events, grouped by weekday (local date)
  const trend = useMemo(() => {
    // Initialize map for Monday to Sunday
    const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weightMap = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

    wasteEvents.forEach(event => {
      // Extract date part from time string (e.g., "2026-05-28 07:33:33" -> "2026-05-28")
      const timeStr = event.time || event.detected_at;
      if (!timeStr) return;
      const datePart = timeStr.split(' ')[0]; // "YYYY-MM-DD"
      const weekday = getWeekdayFromDateString(datePart);
      const weight = event.weight_kg ?? 0;
      if (weightMap.hasOwnProperty(weekday)) {
        weightMap[weekday] += weight;
      }
    });

    // Round to 2 decimals
    Object.keys(weightMap).forEach(day => {
      weightMap[day] = parseFloat(weightMap[day].toFixed(2));
    });

    // Return array in Monday–Sunday order
    return dayOrder.map(day => ({ day, kg: weightMap[day] }));
  }, [wasteEvents]);

  // Compute priority bins directly (fillLevel >= 75)
  const priorityBins = useMemo(() => {
    return [...bins]
      .filter(b => (b.fillLevel ?? 0) >= 75)
      .sort((a, b) => (b.fillLevel ?? 0) - (a.fillLevel ?? 0));
  }, [bins]);

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

      {/* Weekly trend chart - fixed local date grouping */}
      <div className="do-card do-card-full">
        <p className="do-card-title">Weekly waste trend (based on actual waste events)</p>
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
        <p className="do-note" style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}>
          💡 Aggregates waste weight by day of week (Monday–Sunday) using the local date from each waste event.
        </p>
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

        {bins.length === 0 ? (
          <div className="do-all-ok"><p>No bins data available</p></div>
        ) : (
          <div className="do-all-ok">
            {priorityBins.length === 0 && <span className="do-ok-icon">✓</span>}
            <p>
              {priorityBins.length === 0
                ? 'No bins require immediate collection (threshold: 75%)'
                : 'Bins that need attention:'}
            </p>
            {(priorityBins.length > 0 ? priorityBins : bins).map((bin, idx) => {
              const fill = bin.fillLevel ?? 0;
              const fillLabel = getFillLabel(fill);
              const status = bin.status || getBinStatus(fill);
              return (
                <div key={bin._id || idx} className="do-priority-row" style={{ marginTop: '10px' }}>
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