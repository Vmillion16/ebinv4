import React, { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import './DashboardOverview.css';
import API_URL from '../config';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  full:     '#E24B4A',
  nearFull: '#F59E0B',
  active:   '#1D9E75',
  maint:    '#6b7280',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="do-tooltip">
      <p className="do-tooltip-label">{label}</p>
      <p className="do-tooltip-val">{payload[0].value} kg collected</p>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
const DashboardOverview = ({ data }) => {
  const bins  = data?.bins           ?? [];
  const trend = data?.wasteLast7Days ?? [];

  // ── Priority bins (fill ≥ 75) ──────────────────────────────────────────────
  const priorityBins = useMemo(() =>
    bins
      .filter((b) => (b.fillLevel ?? 0) >= 75)
      .sort((a, b) => b.fillLevel - a.fillLevel)
      .slice(0, 5),
    [bins]
  );

  if (!data) {
    return (
      <div className="do-loading">
        <span className="do-loading-dot" />
        <span className="do-loading-dot" />
        <span className="do-loading-dot" />
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="do-container">

      {/* ── Waste trend ── */}
      <div className="do-card do-card-full">
        <p className="do-card-title">Waste trend — last 7 days</p>
        {trend.length === 0 ? (
          <div className="do-empty-chart">No trend data available yet.</div>
        ) : (
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
        )}
      </div>

      {/* ── Priority bins ── */}
      <div className="do-card do-card-full">
        <div className="do-card-header">
          <p className="do-card-title" style={{ margin: 0 }}>Priority bins</p>
          {priorityBins.length > 0
            ? <span className="do-badge do-badge-warn">{priorityBins.length} need attention</span>
            : <span className="do-badge do-badge-ok">All bins normal</span>
          }
        </div>

        {priorityBins.length === 0 ? (
          <div className="do-all-ok">
            <span className="do-ok-icon">✓</span>
            <p>No bins require immediate collection</p>
          </div>
        ) : (
          <div className="do-priority-list">
            {priorityBins.map((bin, i) => {
              const status = bin.status || getBinStatus(bin.fillLevel ?? 0);
              return (
                <div key={bin._id ?? bin.id ?? i} className="do-priority-row">
                  <div className="do-priority-left">
                    <span className="do-priority-dot" style={{ background: getFillBarColor(bin.fillLevel ?? 0) }} />
                    <span className="do-priority-name">{bin.bin_name ?? bin.id ?? `Bin ${i + 1}`}</span>
                    <span className="do-priority-type">{bin.bin_type ?? '—'}</span>
                  </div>
                  <div className="do-priority-center">
                    <div className="do-fill-bar-bg">
                      <div
                        className="do-fill-bar-fill"
                        style={{
                          width: `${bin.fillLevel ?? 0}%`,
                          background: getFillBarColor(bin.fillLevel ?? 0),
                        }}
                      />
                    </div>
                  </div>
                  <div className="do-priority-right">
                    <span className="do-fill-pct">{bin.fillLevel ?? 0}%</span>
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