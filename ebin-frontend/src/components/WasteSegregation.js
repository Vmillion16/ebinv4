// WasteSegregation.js — Live log (shared EbinContext) + History view
import React, { useMemo, useState, useCallback } from "react";
import "./WasteSegregation.css";
import { useEbin } from '../EbinContext';
import API_URL from '../config';

const WASTE_TYPES = ["Recyclable", "Biodegradable", "Non-Biodegradable"];

const MAX_EVENTS    = 100;  // live view: most recent events shown
const HISTORY_LIMIT = 1000; // history view: how many events to request
const PAGE_SIZE     = 50;   // rows per page

// Row-level weight coming from the API may be a plain number (kg)
// or a string like "0.11 kg". Normalize either to a grams display string.
const formatWeightGrams = (weight) => {
  if (weight === null || weight === undefined || weight === "") return "—";
  const numeric = typeof weight === "number"
    ? weight
    : parseFloat(String(weight).replace(/[^\d.-]/g, ""));
  if (isNaN(numeric)) return weight; // fallback: show raw value if unparseable
  return `${(numeric * 1000).toFixed(0)} g`;
};

const formatTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso; // fallback if already formatted
  const date = d.toISOString().slice(0, 10);   // "2026-06-02"
  const time = d.toISOString().slice(11, 19);  // "08:54:40"
  return `${date}  ${time}`;
};

const toMs = (t) => {
  const v = new Date(t).getTime();
  return Number.isNaN(v) ? 0 : v;
};

// "YYYY-MM-DD" of an event time (same basis as formatTime), "" if unparseable
const isoDay = (t) => {
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const TypeBadge = ({ type }) => {
  const cls =
    type === "Recyclable"          ? "badge-recyclable" :
    type === "Biodegradable"       ? "badge-biodegradable" :
    "badge-nonbiodegradable";
  return <span className={`ws-badge ${cls}`}>{type}</span>;
};

const WasteSegregation = () => {
  const {
    wasteEvents, stats, loadingEvents, errorEvents,
    refreshAll, lastSync, emptiedAt = {},
  } = useEbin();

  const [view, setView] = useState("live"); // "live" | "history"
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  // History view state
  const [historyEvents, setHistoryEvents]   = useState(null); // null = not loaded yet
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError]     = useState(null);
  const [binFilter, setBinFilter]           = useState("All");
  const [dateFrom, setDateFrom]             = useState("");
  const [dateTo, setDateTo]                 = useState("");

  // ── Fetch history (on demand, not polled) ──────────────────
  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await fetch(`${API_URL}/waste-events/public/latest?limit=${HISTORY_LIMIT}`);
      if (!res.ok) throw new Error(`History fetch failed: ${res.status}`);
      const data = await res.json();
      setHistoryEvents((data.events || []).map(e => ({
        id:     e.id,
        time:   e.time,
        bin:    e.bin,
        type:   e.type,
        weight: e.weight,
      })));
    } catch (err) {
      console.error("History fetch error:", err);
      setHistoryError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const changeView = (v) => {
    setView(v);
    setPage(1);
    if (v === "history" && historyEvents === null && !historyLoading) fetchHistory();
  };

  // Live view: newest first, capped at the latest MAX_EVENTS
  const events = useMemo(
    () => [...wasteEvents].sort((a, b) => toMs(b.time) - toMs(a.time)).slice(0, MAX_EVENTS),
    [wasteEvents]
  );

  // Bins available in the history bin filter
  const binOptions = useMemo(
    () => [...new Set((historyEvents || []).map(e => e.bin).filter(Boolean))].sort(),
    [historyEvents]
  );

  // Rows before the waste-type filter: live events, or history after date/bin filters
  const baseRows = useMemo(() => {
    if (view === "live") return events;
    let list = historyEvents || [];
    if (binFilter !== "All") list = list.filter(e => e.bin === binFilter);
    if (dateFrom) list = list.filter(e => isoDay(e.time) >= dateFrom);
    if (dateTo)   list = list.filter(e => isoDay(e.time) <= dateTo);
    return [...list].sort((a, b) => toMs(b.time) - toMs(a.time));
  }, [view, events, historyEvents, binFilter, dateFrom, dateTo]);

  // "Bin emptied" markers (history view, all waste types only)
  const markers = useMemo(() => {
    if (view !== "history" || filter !== "All") return [];
    return Object.entries(emptiedAt)
      .filter(([bin, t]) =>
        (binFilter === "All" || bin === binFilter) &&
        (!dateFrom || isoDay(t) >= dateFrom) &&
        (!dateTo   || isoDay(t) <= dateTo)
      )
      .map(([bin, t]) => ({ id: `emptied-${bin}-${t}`, kind: "emptied", time: t, bin }));
  }, [view, filter, emptiedAt, binFilter, dateFrom, dateTo]);

  const filtered = useMemo(() => {
    const typed = filter === "All" ? baseRows : baseRows.filter(e => e.type === filter);
    return markers.length
      ? [...typed, ...markers].sort((a, b) => toMs(b.time) - toMs(a.time))
      : typed;
  }, [baseRows, filter, markers]);

  const eventCount = filtered.filter(r => r.kind !== "emptied").length;

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  const changeFilter = (f) => {
    setFilter(f);
    setPage(1);
  };

  const clearHistoryFilters = () => {
    setBinFilter("All");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const handleRefresh = useCallback(async () => {
    if (refreshing) return; // avoid overlapping refresh calls
    setRefreshing(true);
    try {
      if (view === "history") await fetchHistory();
      else await refreshAll();
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      setRefreshing(false);
    }
  }, [refreshAll, fetchHistory, refreshing, view]);

  if (view === "live" && loadingEvents && wasteEvents.length === 0) {
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

  const isHistory = view === "history";
  const noDataAtAll = baseRows.length === 0 && markers.length === 0;

  return (
    <div className="ws-page">
      {/* Header */}
      <div className="ws-page-header">
        <div>
          <h2 className="ws-page-title">Waste Segregation</h2>
          {!isHistory && events.length === 0 && !errorEvents && (
            <p className="ws-info-note">No waste events found in database.</p>
          )}
          {!isHistory && errorEvents && (
            <p className="ws-error-note">⚠️ {errorEvents}</p>
          )}
          {!isHistory && events.length > 0 && (
            <p className="ws-success-note">
              ✅ {events.length} waste events loaded · Last sync: {lastSync}
            </p>
          )}
          {isHistory && historyError && (
            <p className="ws-error-note">⚠️ {historyError}</p>
          )}
          {isHistory && historyEvents && !historyError && (
            <p className="ws-success-note">
              ✅ {historyEvents.length} events loaded
              {historyEvents.length >= HISTORY_LIMIT && ` (latest ${HISTORY_LIMIT} only)`}
            </p>
          )}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {["live", "history"].map(v => (
            <button
              key={v}
              className={`ws-filter-btn ${view === v ? "ws-filter-active" : ""}`}
              onClick={() => changeView(v)}
            >
              {v === "live" ? "Live" : "History"}
            </button>
          ))}
          <button
            onClick={handleRefresh}
            className="ws-refresh-btn"
            title="Refresh data"
            disabled={refreshing || historyLoading}
          >
            {refreshing || historyLoading ? "🔄 Refreshing..." : "🔄 Refresh"}
          </button>
        </div>
      </div>

      {/* Statistics Cards (live totals) */}
      {!isHistory && events.length > 0 && (
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
            <span className="ws-stat-number">{stats.fullBins}</span>
            <span className="ws-stat-text">Full Bins</span>
          </div>
        </div>
      )}

      {/* Main Card */}
      <div className="ws-card">
        <div className="ws-card-header">
          <p className="ws-card-title">{isHistory ? "Event History" : "Event Log"}</p>
          <div className="ws-card-actions">
            {["All", ...WASTE_TYPES].map(f => (
              <button
                key={f}
                className={`ws-filter-btn ${filter === f ? "ws-filter-active" : ""}`}
                onClick={() => changeFilter(f)}
              >
                {f}
              </button>
            ))}
            <span className="ws-count">
              {eventCount} event{eventCount !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* History filters */}
        {isHistory && (
          <div className="ws-history-toolbar">
            <label className="ws-history-field">
              <span>From</span>
              <input
                type="date"
                className="ws-input"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              />
            </label>
            <label className="ws-history-field">
              <span>To</span>
              <input
                type="date"
                className="ws-input"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              />
            </label>
            <label className="ws-history-field">
              <span>Bin</span>
              <select
                className="ws-input"
                value={binFilter}
                onChange={(e) => { setBinFilter(e.target.value); setPage(1); }}
              >
                <option value="All">All bins</option>
                {binOptions.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </label>
            <button className="ws-filter-btn" onClick={clearHistoryFilters}>Clear</button>
          </div>
        )}

        <div className="ws-table-wrap">
          {isHistory && historyLoading && historyEvents === null ? (
            <div className="loading-container">
              <div className="spinner"></div>
              <p>Loading history...</p>
            </div>
          ) : (
            <table className="ws-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Bin</th>
                  <th>Waste Type</th>
                  <th>Weight</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && noDataAtAll ? (
                  <tr>
                    <td colSpan={4} className="ws-empty">
                      <div className="empty-state">
                        <div className="empty-icon">🗑️</div>
                        <p>No waste events found</p>
                        <small>
                          {isHistory
                            ? "Try a different date range or bin"
                            : "Waste disposal events will appear here"}
                        </small>
                      </div>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="ws-empty">No events match the selected filter.</td>
                  </tr>
                ) : (
                  pageRows.map(row =>
                    row.kind === "emptied" ? (
                      <tr key={row.id} className="ws-row-emptied">
                        <td className="ws-muted ws-mono">{formatTime(row.time)}</td>
                        <td style={{ fontWeight: 500 }}>{row.bin}</td>
                        <td colSpan={2}>
                          <span className="ws-badge badge-emptied">Bin emptied</span>
                        </td>
                      </tr>
                    ) : (
                      <tr key={row.id}>
                        <td className="ws-muted ws-mono">{formatTime(row.time)}</td>
                        <td style={{ fontWeight: 500 }}>{row.bin}</td>
                        <td><TypeBadge type={row.type} /></td>
                        <td className="ws-muted">{formatWeightGrams(row.weight)}</td>
                      </tr>
                    )
                  )
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > PAGE_SIZE && (
          <div className="ws-pagination">
            <span className="ws-page-info">
              Showing {startIdx + 1}–{Math.min(startIdx + PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="ws-page-controls">
              <button
                className="ws-page-btn"
                onClick={() => setPage(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ‹ Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  className={`ws-page-btn ${n === currentPage ? "ws-page-btn-active" : ""}`}
                  onClick={() => setPage(n)}
                >
                  {n}
                </button>
              ))}
              <button
                className="ws-page-btn"
                onClick={() => setPage(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WasteSegregation;