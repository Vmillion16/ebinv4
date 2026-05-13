import React, { useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, BarChart, Bar, Cell,
} from 'recharts';
import './DashboardOverview.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  full:     '#E24B4A',
  nearFull: '#F59E0B',
  active:   '#1D9E75',
  maint:    '#6b7280',
};

const STATUS_ORDER = ['Full', 'Near Full', 'Active', 'Maintenance'];

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
  const bins  = data?.bins              ?? [];
  const trend = data?.wasteLast7Days    ?? [];

  // ── Derived metrics ────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total      = bins.length;
    const avgFill    = total > 0
      ? parseFloat((bins.reduce((s, b) => s + (b.fillLevel ?? 0), 0) / total).toFixed(1))
      : 0;
    const fullBins   = bins.filter((b) => (b.fillLevel ?? 0) >= 90).length;
    const efficiency = data?.collectionEfficiency ?? 0;
    return { total, avgFill, fullBins, efficiency };
  }, [bins, data]);

  // ── Status distribution ────────────────────────────────────────────────────
  const statusDist = useMemo(() => {
    const dist = { Full: 0, 'Near Full': 0, Active: 0, Maintenance: 0 };
    bins.forEach((b) => {
      const s = b.status || getBinStatus(b.fillLevel ?? 0);
      if (s in dist) dist[s]++;
      else dist['Active']++;
    });
    return STATUS_ORDER.map((label) => ({ label, count: dist[label] }));
  }, [bins]);

  const distBarData = statusDist.map((s) => ({ name: s.label, value: s.count }));

  // ── Priority bins (fill ≥ 75) ──────────────────────────────────────────────
  const priorityBins = useMemo(() =>
    bins
      .filter((b) => (b.fillLevel ?? 0) >= 75)
      .sort((a, b) => b.fillLevel - a.fillLevel)
      .slice(0, 5),
    [bins]
  );

  // ── Waste type breakdown ───────────────────────────────────────────────────
  const wasteBreakdown = useMemo(() => {
    const total  = bins.length || 1;
    const rec    = bins.filter((b) => b.bin_type === 'Recyclable').length;
    const nonRec = bins.filter((b) => b.bin_type === 'Non-Recyclable').length;
    const gen    = bins.filter((b) => b.bin_type === 'General').length;
    return [
      { label: 'Recyclable',     count: rec,    pct: Math.round((rec    / total) * 100), color: '#1D9E75' },
      { label: 'Non-Recyclable', count: nonRec, pct: Math.round((nonRec / total) * 100), color: '#E24B4A' },
      { label: 'General',        count: gen,    pct: Math.round((gen    / total) * 100), color: '#F59E0B' },
    ];
  }, [bins]);

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

      {/* ── KPI row ── */}
      <div className="do-kpis">
        {[
          { label: 'Total bins',           value: metrics.total,            sub: 'monitored',       color: '#1a1a1a' },
          { label: 'Avg fill level',        value: `${metrics.avgFill}%`,   sub: 'across all bins', color: metrics.avgFill >= 75 ? COLORS.full : '#1a1a1a' },
          { label: 'Full bins',             value: metrics.fullBins,         sub: 'need collection', color: metrics.fullBins > 0 ? COLORS.full : COLORS.active },
          { label: 'Collection efficiency', value: `${metrics.efficiency}%`, sub: 'this period',    color: '#1a1a1a' },
        ].map((m) => (
          <div key={m.label} className="do-kpi">
            <p className="do-kpi-label">{m.label}</p>
            <p className="do-kpi-value" style={{ color: m.color }}>{m.value}</p>
            <p className="do-kpi-sub">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Chart row ── */}
      <div className="do-chart-row">
        <div className="do-card do-card-wide">
          <p className="do-card-title">Waste trend — last 7 days</p>
          {trend.length === 0 ? (
            <div className="do-empty-chart">No trend data available yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
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

        <div className="do-card">
          <p className="do-card-title">Bin status distribution</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={distBarData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} cursor={{ fill: '#f9fafb' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {distBarData.map((entry) => (
                  <Cell key={entry.name} fill={getStatusColor(entry.name)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="do-bottom-row">
        <div className="do-card do-card-wide">
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
                          style={{ width: `${bin.fillLevel ?? 0}%`, background: getFillBarColor(bin.fillLevel ?? 0) }}
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

        <div className="do-card">
          <p className="do-card-title">Waste type breakdown</p>
          {bins.length === 0 ? (
            <p className="do-empty-chart">No bin data available yet.</p>
          ) : (
            <>
              <div className="do-breakdown">
                {wasteBreakdown.map((w) => (
                  <div key={w.label} className="do-breakdown-row">
                    <div className="do-breakdown-left">
                      <span className="do-breakdown-dot" style={{ background: w.color }} />
                      <span className="do-breakdown-label">{w.label}</span>
                    </div>
                    <div className="do-breakdown-bar-bg">
                      <div className="do-breakdown-bar-fill" style={{ width: `${w.pct}%`, background: w.color }} />
                    </div>
                    <span className="do-breakdown-pct">{w.pct}%</span>
                  </div>
                ))}
              </div>
              <div className="do-type-counts">
                {wasteBreakdown.map((w) => (
                  <div key={w.label} className="do-type-count">
                    <p className="do-type-count-val" style={{ color: w.color }}>{w.count}</p>
                    <p className="do-type-count-label">{w.label.split('-')[0]}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardOverview;