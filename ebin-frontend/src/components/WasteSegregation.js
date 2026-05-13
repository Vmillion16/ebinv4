import React, { useState, useMemo } from "react";
import "./WasteSegregation.css";

const TYPE_DOT = {
  Recyclable:          "#1D9E75",
  Biodegradable:       "#f59e0b",
  "Non-Biodegradable": "#dc2626",
};

const WASTE_TYPES = ["Recyclable", "Biodegradable", "Non-Biodegradable"];

const TypeBadge = ({ type }) => {
  const cls =
    type === "Recyclable"          ? "badge-recyclable" :
    type === "Biodegradable"       ? "badge-biodegradable" :
    "badge-nonbiodegradable";
  return <span className={`ws-badge ${cls}`}>{type}</span>;
};

const ResultBadge = ({ result }) => (
  <span className={`ws-badge ${result === "Classified" ? "badge-success" : "badge-warning"}`}>
    {result === "Classified" ? "Classified" : "Fallback"}
  </span>
);

const WasteSegregation = ({ events = [] }) => {
  const [filter, setFilter] = useState("All");

  const filtered = useMemo(
    () => (filter === "All" ? events : events.filter((e) => e.type === filter)),
    [events, filter]
  );

  return (
    <div className="ws-page">
      {/* Header */}
      <div className="ws-page-header">
        <div>
          <h2 className="ws-page-title">Waste Segregation</h2>
        </div>
      </div>

      {/* Card */}
      <div className="ws-card">
        <div className="ws-card-header">
          <p className="ws-card-title">Event log</p>
          <div className="ws-card-actions">
            {["All", ...WASTE_TYPES].map((f) => (
              <button
                key={f}
                className={`ws-filter-btn ${filter === f ? "ws-filter-active" : ""}`}
                onClick={() => setFilter(f)}
              >
                {f}
              </button>
            ))}
            <span className="ws-count">
              {filtered.length} event{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div className="ws-table-wrap">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Bin</th>
                <th>Waste type</th>
                <th>Item detected</th>
                <th>Weight</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="ws-empty">
                    No events for this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="ws-muted ws-mono">{row.time}</td>
                    <td style={{ fontWeight: 500 }}>{row.bin}</td>
                    <td>
                      <TypeBadge type={row.type} />
                    </td>
                    <td className="ws-muted">{row.item}</td>
                    <td className="ws-muted">{row.weight}</td>
                    <td>
                      <ResultBadge result={row.result} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="ws-log-note">
          "Fallback" means the system could not classify the item and defaulted to Non-Biodegradable.
        </p>
      </div>
    </div>
  );
};

export default WasteSegregation;