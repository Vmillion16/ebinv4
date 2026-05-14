import React, { useState, useMemo, useEffect, useCallback } from "react";
import "./WasteSegregation.css";

const API_URL = process.env.REACT_APP_API_URL || "https://ebinv4-1.onrender.com";

const WASTE_TYPES = ["Recyclable", "Biodegradable", "Non-Biodegradable"];
const REFRESH_MS  = 10000;

const TypeBadge = ({ type }) => {
  const cls =
    type === "Recyclable"    ? "badge-recyclable"    :
    type === "Biodegradable" ? "badge-biodegradable" :
    "badge-nonbiodegradable";
  return <span className={`ws-badge ${cls}`}>{type}</span>;
};

const ResultBadge = ({ result }) => (
  <span className={`ws-badge ${result === "Classified" ? "badge-success" : "badge-warning"}`}>
    {result}
  </span>
);

const SummaryCards = ({ events }) => {
  const total      = events.length;
  const recyclable = events.filter((e) => e.type === "Recyclable").length;
  const bio        = events.filter((e) => e.type === "Biodegradable").length;
  const nonBio     = events.filter((e) => e.type === "Non-Biodegradable").length;
  const fallback   = events.filter((e) => e.result === "Fallback").length;
  const classified = total - fallback;
  const rate       = total > 0 ? Math.round((classified / total) * 100) : 0;
  const pct        = (n) => (total > 0 ? Math.round((n / total) * 100) : 0);

  return (
    <div className="ws-summary-grid">
      <div className="ws-summary-card">
        <p className="ws-summary-label">Total events</p>
        <p className="ws-summary-value">{total}</p>
        <p className="ws-summary-sub">Since last reset</p>
      </div>
      <div className="ws-summary-card">
        <p className="ws-summary-label">Recyclable</p>
        <p className="ws-summary-value ws-val-green">{recyclable}</p>
        <p className="ws-summary-sub">{pct(recyclable)}% of total</p>
      </div>
      <div className="ws-summary-card">
        <p className="ws-summary-label">Biodegradable</p>
        <p className="ws-summary-value ws-val-amber">{bio}</p>
        <p className="ws-summary-sub">{pct(bio)}% of total</p>
      </div>
      <div className="ws-summary-card">
        <p className="ws-summary-label">Non-Biodegradable</p>
        <p className="ws-summary-value ws-val-red">{nonBio}</p>
        <p className="ws-summary-sub">{pct(nonBio)}% of total</p>
      </div>
      <div className="ws-summary-card">
        <p className="ws-summary-label">Classify rate</p>
        <p className="ws-summary-value ws-val-green">{rate}%</p>
        <p className="ws-summary-sub">{fallback} fallback{fallback !== 1 ? "s" : ""}</p>
      </div>
    </div>
  );
};

const WasteSegregation = () => {
  const [events,      setEvents]      = useState([]);
  const [filter,      setFilter]      = useState("All");
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      setError("");
      const token = localStorage.getItem("token");
      const res   = await fetch(`${API_URL}/api/waste-events?limit=200`, {
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${token}`,
        },
      });

      if (res.status === 401) { setError("Session expired. Please log in again."); return; }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Server error ${res.status}`);
      }

      const data = await res.json();
      setEvents(data);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Failed to load events.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchEvents]);

  const filtered = useMemo(
    () => filter === "All" ? events : events.filter((e) => e.type === filter),
    [events, filter]
  );

  const handleRetry = () => { setLoading(true); fetchEvents(); };

  return (
    <div className="ws-page">

      {/* Header */}
      <div className="ws-page-header">
        <div>
          <h2 className="ws-page-title">Waste Segregation</h2>
          <p className="ws-page-sub">
            Live detection log — auto-refreshes every {REFRESH_MS / 1000}s
            {lastUpdated && (
              <span className="ws-last-updated">
                {" · "}Last updated:{" "}
                {lastUpdated.toLocaleTimeString("en-PH", {
                  timeZone: "Asia/Manila",
                  hour: "2-digit", minute: "2-digit", second: "2-digit",
                })}
              </span>
            )}
          </p>
        </div>
        <button
          className="ws-refresh-btn"
          onClick={handleRetry}
          disabled={loading}
        >
          {loading ? "Refreshing..." : "↻ Refresh"}
        </button>
      </div>

      {/* Summary cards */}
      {!loading && !error && <SummaryCards events={events} />}

      {/* Event log */}
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
              {loading ? (
                <tr>
                  <td colSpan={6} className="ws-empty">
                    <span className="ws-loading-dot" />
                    <span className="ws-loading-dot" />
                    <span className="ws-loading-dot" />
                    <span style={{ marginLeft: 8 }}>Loading events...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={6} className="ws-empty ws-error">
                    <span>⚠ {error}</span>
                    <button className="ws-retry-btn" onClick={handleRetry}>Retry</button>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="ws-empty">
                    {filter === "All"
                      ? "No events recorded yet. Waiting for detections..."
                      : `No events found for "${filter}".`}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
                    <td className="ws-muted ws-mono">{row.time}</td>
                    <td style={{ fontWeight: 500 }}>{row.bin}</td>
                    <td><TypeBadge type={row.type} /></td>
                    <td className="ws-muted">{row.item}</td>
                    <td className="ws-muted">{row.weight}</td>
                    <td><ResultBadge result={row.result} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <p className="ws-log-note">
          "Fallback" means the model could not classify the item and defaulted to Non-Biodegradable.
          Data is fetched from MongoDB Atlas via the E-Bin backend.
        </p>
      </div>
    </div>
  );
};

export default WasteSegregation;