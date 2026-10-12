// Reports.js
import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import './Report.css';
import { useEbin } from '../EbinContext';

// ─── Constants ──────────────────────────────────────────────
const PERIODS = [
  { key: 'daily',   label: 'Daily'   },
  { key: 'weekly',  label: 'Weekly'  },
  { key: 'monthly', label: 'Monthly' },
];

const CHART_TYPES = [
  { key: 'bar', label: 'Bar' },
  { key: 'pie', label: 'Pie' },
];

// How many buckets to show per period
const LIMITS = { daily: 14, weekly: 12, monthly: 12 };

// Fallback polling in case the shared context isn't already updating live.
// Set to 0 to disable.
const AUTO_REFRESH_MS = 30000;

const COLORS = {
  recyclable:       '#1D9E75',
  biodegradable:    '#F59E0B',
  nonBiodegradable: '#E24B4A',
};

const r2 = (n) => Math.round(n * 100) / 100;

// ─── Event normalizers (tolerate different field names) ─────
const getEventDate = (event) => {
  let raw =
    event.detected_at ?? event.detectedAt ?? event.time ??
    event.timestamp ?? event.createdAt ?? event.created_at;
  if (!raw) return null;
  // "2026-09-28 10:15:00" -> ISO-ish so every browser parses it
  if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2} \d/.test(raw)) {
    raw = raw.replace(' ', 'T');
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getEventWeight = (event) => {
  const w = Number(event.weight_kg ?? event.weightKg ?? event.weight ?? 0);
  return Number.isFinite(w) ? w : 0;
};

const getEventCategory = (event) => {
  const t = String(event.type ?? event.bin_type ?? event.binType ?? event.waste_type ?? '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (t.startsWith('non')) return 'nonBiodegradable';
  if (t.includes('recycl')) return 'recyclable';
  if (t.includes('biodegrad')) return 'biodegradable';
  return 'nonBiodegradable'; // same default as before
};

// ─── Local-time bucketing (no UTC shift) ────────────────────
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const shortDate = (d) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const bucketFor = (date, period) => {
  if (period === 'daily') {
    return { key: ymd(date), label: shortDate(date) };
  }
  if (period === 'weekly') {
    // Week starts Monday
    const start = new Date(
      date.getFullYear(), date.getMonth(),
      date.getDate() - ((date.getDay() + 6) % 7)
    );
    return { key: ymd(start), label: `Week of ${shortDate(start)}` };
  }
  return {
    key: `${date.getFullYear()}-${pad(date.getMonth() + 1)}`,
    label: date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
  };
};

const aggregateByPeriod = (events, period) => {
  const groups = new Map();

  events.forEach((event) => {
    const date = getEventDate(event);
    if (!date) return;

    const { key, label } = bucketFor(date, period);
    if (!groups.has(key)) {
      groups.set(key, { key, label, recyclable: 0, biodegradable: 0, nonBiodegradable: 0 });
    }
    groups.get(key)[getEventCategory(event)] += getEventWeight(event);
  });

  return Array.from(groups.values())
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-LIMITS[period])
    .map((g) => ({
      ...g,
      recyclable: r2(g.recyclable),
      biodegradable: r2(g.biodegradable),
      nonBiodegradable: r2(g.nonBiodegradable),
    }));
};

// ─── Tooltips ───────────────────────────────────────────────
const BarTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rp-tooltip">
      <p className="rp-tooltip-label">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="rp-tooltip-row" style={{ color: p.color }}>
          {p.name}: <strong>{p.value} kg</strong>
        </p>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rp-tooltip">
      <p className="rp-tooltip-row" style={{ color: p.payload.color }}>
        {p.name}: <strong>{p.value} kg</strong>
      </p>
    </div>
  );
};

const renderPieLabel = ({ percent }) =>
  percent > 0.04 ? `${Math.round(percent * 100)}%` : '';

const Reports = () => {
  const { wasteEvents = [], loadingEvents, errorEvents, refreshAll, lastSync } = useEbin();
  const [period, setPeriod] = useState('weekly');
  const [chartType, setChartType] = useState('bar');

  // Fallback auto-refresh
  useEffect(() => {
    if (!AUTO_REFRESH_MS || !refreshAll) return;
    const id = setInterval(() => refreshAll(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [refreshAll]);

  const periodData = useMemo(
    () => aggregateByPeriod(wasteEvents, period),
    [wasteEvents, period]
  );

  // Totals across everything shown in the chart
  const totals = useMemo(() => {
    const rec    = r2(periodData.reduce((s, d) => s + d.recyclable, 0));
    const bio    = r2(periodData.reduce((s, d) => s + d.biodegradable, 0));
    const nonBio = r2(periodData.reduce((s, d) => s + d.nonBiodegradable, 0));
    return { rec, bio, nonBio, total: r2(rec + bio + nonBio) };
  }, [periodData]);

  // Current period only (today / this week / this month) for the metric cards
  const current = useMemo(() => {
    const { key } = bucketFor(new Date(), period);
    const row = periodData.find((d) => d.key === key);
    const rec    = row?.recyclable ?? 0;
    const bio    = row?.biodegradable ?? 0;
    const nonBio = row?.nonBiodegradable ?? 0;
    return { rec, bio, nonBio, total: r2(rec + bio + nonBio) };
  }, [periodData, period]);

  // Pie data: share of each waste type across everything shown
  const pieData = useMemo(
    () =>
      [
        { name: 'Recyclable',        value: totals.rec,    color: COLORS.recyclable },
        { name: 'Biodegradable',     value: totals.bio,    color: COLORS.biodegradable },
        { name: 'Non-Biodegradable', value: totals.nonBio, color: COLORS.nonBiodegradable },
      ].filter((d) => d.value > 0),
    [totals]
  );

  const sharedAxisProps = {
    tick: { fontSize: 11, fill: '#9ca3af' },
    axisLine: false,
    tickLine: false,
  };

  const periodLabel = period === 'daily' ? 'Daily' : period === 'weekly' ? 'Weekly' : 'Monthly';
  const currentLabel = period === 'daily' ? 'Today' : period === 'weekly' ? 'This week' : 'This month';
  const chartTitle = chartType === 'pie' ? `${periodLabel} waste share by type` : `${periodLabel} waste trend`;

  if (loadingEvents && wasteEvents.length === 0) {
    return (
      <div className="rp-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading waste data...</p>
        </div>
      </div>
    );
  }

  if (errorEvents) {
    return (
      <div className="rp-page">
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <p>{errorEvents}</p>
          <button onClick={refreshAll} className="retry-button">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="rp-page">
      {/* Header */}
      <div className="rp-header">
        <div>
          <h2 className="rp-title">Waste Management Reports</h2>
          {wasteEvents.length === 0 && (
            <p className="rp-info-note">No waste events found in database.</p>
          )}
          {wasteEvents.length > 0 && (
            <p className="rp-success-note">
               {wasteEvents.length} waste events loaded · Last sync: {lastSync}
            </p>
          )}
        </div>
      </div>

      {/* Metrics (current period) */}
      <div className="rp-metrics">
        {[
          { label: 'Total waste collected', value: `${current.total} kg`, sub: currentLabel, color: '#1a1a1a' },
          { label: 'Recyclable',        value: `${current.rec} kg`,    sub: currentLabel, color: COLORS.recyclable },
          { label: 'Biodegradable',     value: `${current.bio} kg`,    sub: currentLabel, color: COLORS.biodegradable },
          { label: 'Non-Biodegradable', value: `${current.nonBio} kg`, sub: currentLabel, color: COLORS.nonBiodegradable },
        ].map((m) => (
          <div key={m.label} className="rp-metric">
            <p className="rp-metric-label">{m.label}</p>
            <p className="rp-metric-value" style={{ color: m.color }}>{m.value}</p>
            {m.sub && <p className="rp-metric-sub">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="rp-card">
        <div className="rp-card-toolbar">
          <p className="rp-card-title">{chartTitle}</p>
          <div className="rp-controls">
            <div className="rp-seg">
              {PERIODS.map((p) => (
                <button key={p.key} className={`rp-seg-btn ${period === p.key ? 'rp-seg-active' : ''}`} onClick={() => setPeriod(p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="rp-seg">
              {CHART_TYPES.map((c) => (
                <button key={c.key} className={`rp-seg-btn ${chartType === c.key ? 'rp-seg-active' : ''}`} onClick={() => setChartType(c.key)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {periodData.length === 0 ? (
          <p className="rp-empty">No waste events found for this period.</p>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={periodData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="label" {...sharedAxisProps} />
              <YAxis {...sharedAxisProps} unit=" kg" />
              <Tooltip content={<BarTooltip />} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar dataKey="recyclable" name="Recyclable" fill={COLORS.recyclable} radius={[4, 4, 0, 0]} />
              <Bar dataKey="biodegradable" name="Biodegradable" fill={COLORS.biodegradable} radius={[4, 4, 0, 0]} />
              <Bar dataKey="nonBiodegradable" name="Non-Biodegradable" fill={COLORS.nonBiodegradable} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : pieData.length === 0 ? (
          <p className="rp-empty">No weight recorded for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                label={renderPieLabel}
                labelLine={false}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default Reports;