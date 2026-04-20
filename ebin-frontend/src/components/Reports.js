import React, { useState, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  ResponsiveContainer, Tooltip, BarChart, Bar, Legend,
} from 'recharts';
import './Report.css';

// ─── Constants ────────────────────────────────────────────────────────────────
const PERIODS = [
  { key: 'daily',   label: 'Daily'   },
  { key: 'weekly',  label: 'Weekly'  },
  { key: 'monthly', label: 'Monthly' },
];

const COLORS = {
  recyclable:    '#1D9E75',
  nonRecyclable: '#E24B4A',
  general:       '#F59E0B',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const sum = (data, key) => data.reduce((acc, r) => acc + (r[key] ?? 0), 0);

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

// ─── Component ────────────────────────────────────────────────────────────────
const Reports = ({
  data = { daily: [], weekly: [], monthly: [] },
}) => {
  const [period,    setPeriod]    = useState('weekly');
  const [chartType, setChartType] = useState('line');

  const periodData = data[period] ?? [];

  const totals = useMemo(() => {
    const rec    = sum(periodData, 'recyclable');
    const nonRec = sum(periodData, 'nonRecyclable');
    const gen    = sum(periodData, 'general');
    const total  = rec + nonRec + gen;
    const rate   = total > 0 ? Math.round((rec / total) * 100) : 0;
    return { rec, nonRec, gen, total, rate };
  }, [periodData]);

  const handleExport = () => {
    const headers = ['Period', 'Recyclable (kg)', 'Non-Recyclable (kg)', 'General (kg)', 'Total (kg)'];
    const rows    = periodData.map((r) => [
      r.label, r.recyclable, r.nonRecyclable, r.general,
      r.recyclable + r.nonRecyclable + r.general,
    ]);
    const summary = ['', '', '', 'TOTAL', totals.total];
    const csv     = [headers, ...rows, summary].map((r) => r.join(',')).join('\n');
    const blob    = new Blob([csv], { type: 'text/csv' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href        = url;
    a.download    = `report-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sharedAxisProps = {
    tick:     { fontSize: 11, fill: '#9ca3af' },
    axisLine: false,
    tickLine: false,
  };

  const sharedChartProps = {
    data:   periodData,
    margin: { top: 4, right: 8, left: -16, bottom: 0 },
  };

  const periodLabel =
    period === 'daily' ? "Today's" :
    period === 'weekly' ? 'Weekly' : 'Monthly';

  return (
    <div className="rp-page">

      {/* ── Header ── */}
      <div className="rp-header">
        <div>
          <h2 className="rp-title">Waste Management Reports</h2>
          <p className="rp-sub">Track collection trends, waste volume, and segregation performance</p>
        </div>
        <button className="rp-export-btn" onClick={handleExport}>↓ Export CSV</button>
      </div>

      {/* ── Summary metrics ── */}
      <div className="rp-metrics">
        {[
          {
            label: 'Total waste collected',
            value: `${totals.total} kg`,
            sub:   period === 'daily' ? 'Today' : period === 'weekly' ? 'This week' : 'This month',
            color: '#1a1a1a',
          },
          {
            label: 'Recyclable',
            value: `${totals.rec} kg`,
            sub:   `${totals.rate}% of total`,
            color: COLORS.recyclable,
          },
          {
            label: 'Non-Recyclable',
            value: `${totals.nonRec} kg`,
            sub:   `${totals.total > 0 ? Math.round((totals.nonRec / totals.total) * 100) : 0}% of total`,
            color: COLORS.nonRecyclable,
          },
          {
            label: 'General waste',
            value: `${totals.gen} kg`,
            sub:   `${totals.total > 0 ? Math.round((totals.gen / totals.total) * 100) : 0}% of total`,
            color: COLORS.general,
          },
        ].map((m) => (
          <div key={m.label} className="rp-metric">
            <p className="rp-metric-label">{m.label}</p>
            <p className="rp-metric-value" style={{ color: m.color }}>{m.value}</p>
            <p className="rp-metric-sub">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Chart card ── */}
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
          <p className="rp-empty">No data available for this period.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            {chartType === 'line' ? (
              <LineChart {...sharedChartProps}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" {...sharedAxisProps} />
                <YAxis {...sharedAxisProps} unit=" kg" />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Line type="monotone" dataKey="recyclable"    name="Recyclable"     stroke={COLORS.recyclable}    strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="nonRecyclable" name="Non-Recyclable"  stroke={COLORS.nonRecyclable} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="general"       name="General"         stroke={COLORS.general}       strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            ) : (
              <BarChart {...sharedChartProps} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="label" {...sharedAxisProps} />
                <YAxis {...sharedAxisProps} unit=" kg" />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                <Bar dataKey="recyclable"    name="Recyclable"     fill={COLORS.recyclable}    radius={[4, 4, 0, 0]} />
                <Bar dataKey="nonRecyclable" name="Non-Recyclable"  fill={COLORS.nonRecyclable} radius={[4, 4, 0, 0]} />
                <Bar dataKey="general"       name="General"         fill={COLORS.general}       radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Breakdown table ── */}
      <div className="rp-card">
        <p className="rp-card-title">Collection breakdown</p>
        <div className="rp-table-wrap">
          <table className="rp-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Recyclable</th>
                <th>Non-Recyclable</th>
                <th>General</th>
                <th>Total</th>
                <th>Recycling rate</th>
              </tr>
            </thead>
            <tbody>
              {periodData.length === 0 ? (
                <tr><td colSpan={6} className="rp-empty">No data for this period.</td></tr>
              ) : (
                periodData.map((row) => {
                  const rowTotal = row.recyclable + row.nonRecyclable + row.general;
                  const rowRate  = rowTotal > 0 ? Math.round((row.recyclable / rowTotal) * 100) : 0;
                  return (
                    <tr key={row.label}>
                      <td className="rp-muted">{row.label}</td>
                      <td><span className="rp-dot" style={{ background: COLORS.recyclable }} />{row.recyclable} kg</td>
                      <td><span className="rp-dot" style={{ background: COLORS.nonRecyclable }} />{row.nonRecyclable} kg</td>
                      <td><span className="rp-dot" style={{ background: COLORS.general }} />{row.general} kg</td>
                      <td><strong>{rowTotal} kg</strong></td>
                      <td>
                        <div className="rp-rate-row">
                          <div className="rp-rate-bg">
                            <div className="rp-rate-fill" style={{ width: `${rowRate}%` }} />
                          </div>
                          <span className="rp-rate-pct">{rowRate}%</span>
                        </div>
                      </td>
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
                  <td>{totals.nonRec} kg</td>
                  <td>{totals.gen} kg</td>
                  <td><strong>{totals.total} kg</strong></td>
                  <td>
                    <div className="rp-rate-row">
                      <div className="rp-rate-bg">
                        <div className="rp-rate-fill" style={{ width: `${totals.rate}%` }} />
                      </div>
                      <span className="rp-rate-pct">{totals.rate}%</span>
                    </div>
                  </td>
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