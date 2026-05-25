// Reports.js
import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, BarChart, Bar, Legend,
} from 'recharts';
import './Report.css';
import { useEbin } from '../EbinContext';

// ─── Constants ────────────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'daily',   label: 'Daily'   },
  { key: 'weekly',  label: 'Weekly'  },
  { key: 'monthly', label: 'Monthly' },
];

const COLORS = {
  recyclable:        '#1D9E75',   // green
  biodegradable:     '#F59E0B',   // orange
  nonBiodegradable:  '#E24B4A',   // red
};

// Helper: group waste events by date range
const aggregateByPeriod = (events, period) => {
  if (!events.length) return [];

  const groups = new Map();

  events.forEach(event => {
    const date = new Date(event.detected_at || event.time);
    let key, label;

    if (period === 'daily') {
      key = date.toISOString().split('T')[0];
      label = key;
    } else if (period === 'weekly') {
      const startOfWeek = new Date(date);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);
      key = startOfWeek.toISOString().split('T')[0];
      label = `Week of ${key}`;
    } else { // monthly
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      label = `${date.toLocaleString('default', { month: 'long' })} ${date.getFullYear()}`;
    }

    if (!groups.has(key)) {
      groups.set(key, { label, recyclable: 0, biodegradable: 0, nonBiodegradable: 0 });
    }

    const group = groups.get(key);
    const weight = event.weight_kg || 0;

    switch (event.waste_type) {
      case 'Recyclable':
        group.recyclable += weight;
        break;
      case 'Biodegradable':
        group.biodegradable += weight;
        break;
      case 'Non-Biodegradable':
        group.nonBiodegradable += weight;
        break;
      default:
        group.nonBiodegradable += weight;
    }
  });

  // Sort by date (oldest first)
  const sorted = Array.from(groups.values()).sort((a, b) => {
    if (period === 'daily') return a.label.localeCompare(b.label);
    if (period === 'weekly') return a.label.localeCompare(b.label);
    // monthly: extract year and month
    const getDate = (label) => {
      const parts = label.split(' ');
      const month = parts[0];
      const year = parseInt(parts[1]);
      return new Date(year, new Date(Date.parse(month + " 1, 2000")).getMonth());
    };
    return getDate(a.label) - getDate(b.label);
  });

  return sorted;
};

// ─── Custom Tooltip ──────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
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

// ─── Main Component ──────────────────────────────────────────────────────────
const Reports = () => {
  const { wasteEvents, loadingEvents, errorEvents } = useEbin();
  const [period, setPeriod] = useState('weekly');
  const [chartType, setChartType] = useState('line');

  // Compute aggregated data based on selected period
  const periodData = useMemo(() => {
    if (!wasteEvents.length) return [];
    return aggregateByPeriod(wasteEvents, period);
  }, [wasteEvents, period]);

  // Calculate totals (no rate needed)
  const totals = useMemo(() => {
    const rec = periodData.reduce((sum, d) => sum + d.recyclable, 0);
    const bio = periodData.reduce((sum, d) => sum + d.biodegradable, 0);
    const nonBio = periodData.reduce((sum, d) => sum + d.nonBiodegradable, 0);
    const total = rec + bio + nonBio;
    return { rec, bio, nonBio, total };
  }, [periodData]);

  const handleExport = () => {
    const headers = ['Period', 'Recyclable (kg)', 'Biodegradable (kg)', 'Non-Biodegradable (kg)', 'Total (kg)'];
    const rows = periodData.map((r) => [
      r.label, r.recyclable, r.biodegradable, r.nonBiodegradable,
      r.recyclable + r.biodegradable + r.nonBiodegradable,
    ]);
    const summary = ['', '', '', 'TOTAL', totals.total];
    const csv = [headers, ...rows, summary].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sharedAxisProps = {
    tick: { fontSize: 11, fill: '#9ca3af' },
    axisLine: false,
    tickLine: false,
  };

  const sharedChartProps = {
    data: periodData,
    margin: { top: 4, right: 8, left: -16, bottom: 0 },
  };

  const periodLabel =
    period === 'daily' ? "Today's" :
    period === 'weekly' ? 'Weekly' : 'Monthly';

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
          <button onClick={() => window.location.reload()} className="retry-button">Retry</button>
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
        </div>
        <button className="rp-export-btn" onClick={handleExport}>↓ Export CSV</button>
      </div>

      {/* Summary metrics – percentages removed */}
      <div className="rp-metrics">
        {[
          {
            label: 'Total waste collected',
            value: `${totals.total} kg`,
            sub: period === 'daily' ? 'Today' : period === 'weekly' ? 'This week' : 'This month',
            color: '#1a1a1a',
          },
          {
            label: 'Recyclable',
            value: `${totals.rec} kg`,
            color: COLORS.recyclable,
          },
          {
            label: 'Biodegradable',
            value: `${totals.bio} kg`,
            color: COLORS.biodegradable,
          },
          {
            label: 'Non-Biodegradable',
            value: `${totals.nonBio} kg`,
            color: COLORS.nonBiodegradable,
          },
        ].map((m) => (
          <div key={m.label} className="rp-metric">
            <p className="rp-metric-label">{m.label}</p>
            <p className="rp-metric-value" style={{ color: m.color }}>{m.value}</p>
            {m.sub && <p className="rp-metric-sub">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* Chart card */}
      <div className="rp-card">
        <div className="rp-card-toolbar">
          <p className="rp-card-title">{periodLabel} waste trend</p>
          <div className="rp-controls">
            <div className="rp-seg">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  className={`rp-seg-btn ${period === p.key ? 'rp-seg-active' : ''}`}
                  onClick={() => setPeriod(p.key)}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="rp-seg">
              {['line', 'bar'].map((type) => (
                <button
                  key={type}
                  className={`rp-seg-btn ${chartType === type ? 'rp-seg-active' : ''}`}
                  onClick={() => setChartType(type)}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {periodData.length === 0 ? (
          <p className="rp-empty">No waste events found for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            {chartType === 'line' ? (
              <LineChart {...sharedChartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" {...sharedAxisProps} />
                <YAxis {...sharedAxisProps} unit=" kg" />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Line type="monotone" dataKey="recyclable" name="Recyclable" stroke={COLORS.recyclable} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="biodegradable" name="Biodegradable" stroke={COLORS.biodegradable} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="nonBiodegradable" name="Non-Biodegradable" stroke={COLORS.nonBiodegradable} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            ) : (
              <BarChart {...sharedChartProps} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" {...sharedAxisProps} />
                <YAxis {...sharedAxisProps} unit=" kg" />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Bar dataKey="recyclable" name="Recyclable" fill={COLORS.recyclable} radius={[4, 4, 0, 0]} />
                <Bar dataKey="biodegradable" name="Biodegradable" fill={COLORS.biodegradable} radius={[4, 4, 0, 0]} />
                <Bar dataKey="nonBiodegradable" name="Non-Biodegradable" fill={COLORS.nonBiodegradable} radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Breakdown table – without recycling rate column */}
      <div className="rp-card">
        <p className="rp-card-title">Collection breakdown</p>
        <div className="rp-table-wrap">
          <table className="rp-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Recyclable</th>
                <th>Biodegradable</th>
                <th>Non-Biodegradable</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {periodData.length === 0 ? (
                <tr><td colSpan="5" className="rp-empty">No data for this period.</td></tr>
              ) : (
                periodData.map((row) => {
                  const rowTotal = row.recyclable + row.biodegradable + row.nonBiodegradable;
                  return (
                    <tr key={row.label}>
                      <td className="rp-muted">{row.label}</td>
                      <td><span className="rp-dot" style={{ background: COLORS.recyclable }} />{row.recyclable} kg</td>
                      <td><span className="rp-dot" style={{ background: COLORS.biodegradable }} />{row.biodegradable} kg</td>
                      <td><span className="rp-dot" style={{ background: COLORS.nonBiodegradable }} />{row.nonBiodegradable} kg</td>
                      <td><strong>{rowTotal} kg</strong></td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {periodData.length > 0 && (
              <tfoot>
                <tr className="rp-tfoot">
                  <td>Total</td>
                  <td>{totals.rec} kg</td>
                  <td>{totals.bio} kg</td>
                  <td>{totals.nonBio} kg</td>
                  <td><strong>{totals.total} kg</strong></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

export default Reports;