import React, { useState, useEffect, useMemo } from "react";
import "./WasteSegregation.css";
import API_URL from '../config';

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

const WasteSegregation = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("All");

  // Format date helper
  const formatDate = (dateString) => {
    if (!dateString) return '—';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('en-PH', { 
        timeZone: 'Asia/Manila',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '—';
    }
  };

  // Fetch waste events from PUBLIC endpoint (no authentication needed)
  const fetchWasteEvents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Use the public endpoint - NO AUTH TOKEN NEEDED!
      const response = await fetch(`${API_URL}/waste-events/public/latest`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch waste events: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Waste events fetched from public endpoint:', data);
      
      if (data.success && data.events) {
        const transformedEvents = data.events.map(event => ({
          id: event.id,
          time: event.time,
          bin: event.bin,
          type: event.type,
          item: event.item,
          weight: event.weight,
          result: event.result
        }));
        setEvents(transformedEvents);
      } else {
        setEvents([]);
      }
    } catch (err) {
      console.error('Error fetching waste events:', err);
      setError(err.message);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWasteEvents();
    // Refresh every 60 seconds (less frequent to avoid rate limiting)
    const interval = setInterval(fetchWasteEvents, 60000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(
    () => (filter === "All" ? events : events.filter((e) => e.type === filter)),
    [events, filter]
  );

  // Calculate statistics
  const stats = {
    total: events.length,
    recyclable: events.filter(e => e.type === 'Recyclable').length,
    biodegradable: events.filter(e => e.type === 'Biodegradable').length,
    nonBiodegradable: events.filter(e => e.type === 'Non-Biodegradable').length,
    classified: events.filter(e => e.result === 'Classified').length,
    fallback: events.filter(e => e.result === 'Fallback').length,
    totalWeight: events.reduce((sum, e) => {
      const match = e.weight.match(/[\d.]+/);
      const weight = match ? parseFloat(match[0]) : 0;
      return sum + weight;
    }, 0).toFixed(2)
  };

  if (loading) {
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
          <p className="ws-page-sub">Segregation event log — DFD Process 2 requirement</p>
          {events.length === 0 && !error && (
            <p className="ws-info-note">
              📋 No waste events found in database.
            </p>
          )}
          {error && (
            <p className="ws-error-note">
              ⚠️ {error}
            </p>
          )}
          {events.length > 0 && (
            <p className="ws-success-note">
              ✅ {events.length} waste events loaded from database
            </p>
          )}
        </div>
        <button onClick={fetchWasteEvents} className="ws-refresh-btn" title="Refresh data">
          🔄 Refresh
        </button>
      </div>

      {/* Statistics Cards */}
      {events.length > 0 && (
        <div className="ws-stats-row">
          <div className="ws-stat-box">
            <span className="ws-stat-number">{stats.total}</span>
            <span className="ws-stat-text">Total Events</span>
          </div>
          <div className="ws-stat-box ws-stat-green">
            <span className="ws-stat-number">{stats.recyclable}</span>
            <span className="ws-stat-text">Recyclable</span>
          </div>
          <div className="ws-stat-box ws-stat-orange">
            <span className="ws-stat-number">{stats.biodegradable}</span>
            <span className="ws-stat-text">Biodegradable</span>
          </div>
          <div className="ws-stat-box ws-stat-red">
            <span className="ws-stat-number">{stats.nonBiodegradable}</span>
            <span className="ws-stat-text">Non-Biodegradable</span>
          </div>
          <div className="ws-stat-box">
            <span className="ws-stat-number">{stats.totalWeight} kg</span>
            <span className="ws-stat-text">Total Weight</span>
          </div>
          <div className="ws-stat-box">
            <span className="ws-stat-number">{stats.classified}</span>
            <span className="ws-stat-text">Classified</span>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="ws-card">
        <div className="ws-card-header">
          <p className="ws-card-title">Event Log</p>
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
                <th>Waste Type</th>
                <th>Item Detected</th>
                <th>Weight</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && events.length === 0 ? (
                <tr>
                  <td colSpan={6} className="ws-empty">
                    <div className="empty-state">
                      <div className="empty-icon">🗑️</div>
                      <p>No waste events found</p>
                      <small>Waste disposal events will appear here</small>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 && events.length > 0 ? (
                <tr>
                  <td colSpan={6} className="ws-empty">
                    No events match the selected filter.
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
          💡 "Fallback" means the system could not classify the item and defaulted to Non-Biodegradable.
          <br />
          📊 Data is fetched directly from your MongoDB database using the public endpoint.
        </p>
      </div>
    </div>
  );
};

export default WasteSegregation;