import React, { useState, useMemo } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import "./WasteSegregation.css";

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  Recyclable:     "#1D9E75",
  "Non-Recyclable": "#E24B4A",
  General:        "#F59E0B",
};

const WASTE_ITEMS = {
  Recyclable:       "Plastic bottles, paper, metal cans",
  "Non-Recyclable": "Food wrappers, styrofoam, soiled paper",
  General:          "Mixed / unknown waste",
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const TypeBadge = ({ type }) => (
  <span
    className="ws-type-badge"
    style={{
      background: `${COLORS[type]}18`,
      color:       COLORS[type],
      border:      `1px solid ${COLORS[type]}40`,
    }}
  >
    {type}
  </span>
);

const ResultBadge = ({ result }) => (
  <span className={`ws-result-badge ws-result-${result === "Classified" ? "ok" : "fallback"}`}>
    {result === "Classified" ? "✓ Classified" : "⚠ Fallback"}
  </span>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const WasteSegregation = ({
  bins        = [],
  events      = [],   // live segregation events from parent (WebSocket / polling)
  trendData   = [],   // 7-day trend: [{ day, Recyclable, "Non-Recyclable", General }]
}) => {
  const [eventFilter, setEventFilter] = useState("All");

  // ── Stats derived from bins prop ──────────────────────────────────────────
  const stats = useMemo(() => {
    const recyclable    = bins.filter((b) => b.bin_type === "Recyclable").length;
    const nonRecyclable = bins.filter((b) => b.bin_type === "Non-Recyclable").length;
    const general       = bins.filter((b) => b.bin_type === "General").length;
    const total         = bins.length;
    const recyclingRate = total > 0 ? Math.round((recyclable / total) * 100) : 0;
    return { recyclable, nonRecyclable, general, total, recyclingRate };
  }, [bins]);

  const pieData = [
    { name: "Recyclable",     value: stats.recyclable },
    { name: "Non-Recyclable", value: stats.nonRecyclable },
    { name: "General",        value: stats.general },
  ];

  const filteredEvents = useMemo(() =>
    eventFilter === "All" ? events : events.filter((e) => e.type === eventFilter),
    [events, eventFilter]
  );

  const segregationAccuracy = useMemo(() => {
    if (events.length === 0) return 0;
    const classified = events.filter((e) => e.result === "Classified").length;
    return Math.round((classified / events.length) * 100);
  }, [events]);

  const fallbackCount = events.filter((e) => e.result === "Fallback").length;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    return (
      <div className="ws-tooltip">
        <p className="ws-tooltip-name">{d.name}</p>
        <p className="ws-tooltip-val">{d.value} bins</p>
      </div>
    );
  };

  return (
    <div className="ws-page">
      {/* ── Header ── */}
      <div className="ws-header">
        <div>
          <h2 className="ws-title">Waste Segregation</h2>
        </div>
        <div className="ws-live-dot">
          <span className="ws-dot-pulse" />
          Live
        </div>
      </div>

      {/* ── Top metrics ── */}
      <div className="ws-metrics">
        {[
          { label: "Recycling rate",        value: `${stats.recyclingRate}%`, color: "#1D9E75", sub: "of total bins"          },
          { label: "Total bins",             value: stats.total,               color: "#1a1a1a", sub: "monitored"               },
          { label: "Segregation accuracy",  value: `${segregationAccuracy}%`, color: "#1D9E75", sub: "correctly classified"    },
          { label: "Fallback events",        value: fallbackCount,             color: "#F59E0B", sub: "general waste used"      },
        ].map((m) => (
          <div key={m.label} className="ws-metric">
            <p className="ws-metric-label">{m.label}</p>
            <p className="ws-metric-value" style={{ color: m.color }}>{m.value}</p>
            <p className="ws-metric-sub">{m.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Chart row ── */}
      <div className="ws-chart-row">
        {/* Pie chart */}
        <div className="ws-card ws-pie-card">
          <p className="ws-card-title">Bin distribution</p>
          {bins.length === 0 ? (
            <p className="ws-empty">No bin data available.</p>
          ) : (
            <>
              <div className="ws-pie-wrap">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="ws-pie-center">
                  <p className="ws-pie-center-val">{stats.recyclingRate}%</p>
                  <p className="ws-pie-center-label">Recycling</p>
                </div>
              </div>
              <div className="ws-legend">
                {pieData.map((d) => (
                  <div key={d.name} className="ws-legend-item">
                    <span className="ws-legend-dot" style={{ background: COLORS[d.name] }} />
                    <span className="ws-legend-name">{d.name}</span>
                    <span className="ws-legend-count">{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Live status */}
        <div className="ws-card ws-live-card">
          <p className="ws-card-title">Live status</p>
          {["Recyclable", "Non-Recyclable", "General"].map((type) => {
            const count =
              type === "Recyclable"     ? stats.recyclable :
              type === "Non-Recyclable" ? stats.nonRecyclable :
              stats.general;
            const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={type} className="ws-live-row">
                <div className="ws-live-left">
                  <span className="ws-live-dot-sm" style={{ background: COLORS[type] }} />
                  <div>
                    <p className="ws-live-type">{type}</p>
                    <p className="ws-live-items">{WASTE_ITEMS[type]}</p>
                  </div>
                </div>
                <div className="ws-live-right">
                  <div className="ws-live-bar-bg">
                    <div className="ws-live-bar-fill" style={{ width: `${pct}%`, background: COLORS[type] }} />
                  </div>
                  <span className="ws-live-count">{count}</span>
                </div>
              </div>
            );
          })}

          {/* 7-day trend */}
          <p className="ws-card-title" style={{ marginTop: 20 }}>7-day trend</p>
          {trendData.length === 0 ? (
            <p className="ws-empty">No trend data available.</p>
          ) : (
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={trendData} barSize={8} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }} cursor={{ fill: "#f9fafb" }} />
                <Bar dataKey="Recyclable"     fill="#1D9E75" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Non-Recyclable" fill="#E24B4A" radius={[3, 3, 0, 0]} />
                <Bar dataKey="General"        fill="#F59E0B" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── Event log ── */}
      <div className="ws-card">
        <div className="ws-card-header-row">
          <div>
            <p className="ws-card-title" style={{ margin: 0 }}>Segregation event log</p>
            <p className="ws-card-sub">Each disposal recorded — DFD Process 2 requirement</p>
          </div>
          <div className="ws-event-filters">
            {["All", "Recyclable", "Non-Recyclable", "General"].map((f) => (
              <button
                key={f}
                className={`ws-filter-btn ${eventFilter === f ? "ws-filter-active" : ""}`}
                onClick={() => setEventFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Time</th><th>Bin</th><th>Waste type</th>
                <th>Item detected</th><th>Weight</th><th>Result</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 ? (
                <tr><td colSpan={6} className="ws-empty">No events for this filter.</td></tr>
              ) : (
                filteredEvents.map((row) => (
                  <tr key={row.id}>
                    <td className="ws-muted">{row.time}</td>
                    <td>{row.bin}</td>
                    <td><TypeBadge type={row.type} /></td>
                    <td className="ws-muted">{row.item}</td>
                    <td>{row.weight}</td>
                    <td><ResultBadge result={row.result} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="ws-log-note">
          ⚡ Live — events stream in from the parent via the <code>events</code> prop (WebSocket / polling).
          "Fallback" means the system could not classify the item and routed it to General waste.
        </p>
      </div>
    </div>
  );
};

export default WasteSegregation;