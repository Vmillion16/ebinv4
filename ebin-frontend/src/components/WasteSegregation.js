// WasteSegregation.js — uses shared EbinContext (no duplicate API calls)
import React, { useMemo, useState } from "react";
import "./WasteSegregation.css";
import { useEbin } from '../EbinContext';

const WASTE_TYPES = ["Recyclable", "Biodegradable", "Non-Biodegradable"];

const formatTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso; // fallback if already formatted
  const date = d.toISOString().slice(0, 10);   // "2026-06-02"
  const time = d.toISOString().slice(11, 19);  // "08:54:40"
  return `${date}  ${time}`;
};

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

const WasteSegregation = () => {
  const { wasteEvents, stats, loadingEvents, errorEvents, refreshAll, lastSync } = useEbin();
  const [filter, setFilter] = useState("All");

  const filtered = useMemo(
    () => filter === "All" ? wasteEvents : wasteEvents.filter(e => e.type === filter),
    [wasteEvents, filter]
  );

  if (loadingEvents && wasteEvents.length === 0) {
    return (
      <div className="ws-page">
        <div className="ws-card">
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Loading waste events from database...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ws-page">
      {/* Header */}
      <div className="ws-page-header">
        <div>
          <h2 className="ws-page-title">Waste Segregation</h2>
          {wasteEvents.length === 0 && !errorEvents && (
            <p className="ws-info-note">No waste events found in database.</p>
          )}
          {errorEvents && (
            <p className="ws-error-note">⚠️ {errorEvents}</p>
          )}
          {wasteEvents.length > 0 && (
            <p className="ws-success-note">
              ✅ {wasteEvents.length} waste events loaded · Last sync: {lastSync}
            </p>
          )}
        </div>
        <button onClick={refreshAll} className="ws-refresh-btn" title="Refresh data">
          🔄 Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      {wasteEvents.length > 0 && (
        <div className="ws-stats-row">
          <div className="ws-stat-box">
            <span className="ws-stat-number">{stats.totalEvents}</span>
            <span className="ws-stat-text">Total Events</span>
          </div>
          <div className="ws-stat-box ws-stat-green">
            <span className="ws-stat-number">{stats.recyclableEvents}</span>
            <span className="ws-stat-text">Recyclable</span>
          </div>
          <div className="ws-stat-box ws-stat-orange">
            <span className="ws-stat-number">{stats.biodegradableEvents}</span>
            <span className="ws-stat-text">Biodegradable</span>
          </div>
          <div className="ws-stat-box ws-stat-red">
            <span className="ws-stat-number">{stats.nonBioEvents}</span>
            <span className="ws-stat-text">Non-Biodegradable</span>
          </div>
          <div className="ws-stat-box">
            <span className="ws-stat-number">{stats.totalEventsWeight.toFixed(2)} kg</span>
            <span className="ws-stat-text">Total Weight</span>
          </div>
          <div className="ws-stat-box">
            <span className="ws-stat-number">{stats.classifiedEvents}</span>
            <span className="ws-stat-text">Classified</span>
          </div>
          <div className="ws-stat-box">
            <span className="ws-stat-number">{stats.fullBins}</span>
            <span className="ws-stat-text">Full Bins</span>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="ws-card">
        <div className="ws-card-header">
          <p className="ws-card-title">Event Log</p>
          <div className="ws-card-actions">
            {["All", ...WASTE_TYPES].map(f => (
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
                <th>Waste Type</th>
                <th>Weight</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && wasteEvents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ws-empty">
                    <div className="empty-state">
                      <div className="empty-icon">🗑️</div>
                      <p>No waste events found</p>
                      <small>Waste disposal events will appear here</small>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="ws-empty">No events match the selected filter.</td>
                </tr>
              ) : (
                filtered.map(row => (
                  <tr key={row.id}>
                    <td className="ws-muted ws-mono">{formatTime(row.time)}</td>
                    <td style={{ fontWeight: 500 }}>{row.bin}</td>
                    <td><TypeBadge type={row.type} /></td>
                    <td className="ws-muted">{row.weight}</td>
                    <td><ResultBadge result={row.result} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="ws-log-note">
          💡 "Fallback" means the system could not classify the item and defaulted to Non-Biodegradable.
          <br />
        </p>
      </div>
    </div>
  );
};

export default WasteSegregation;