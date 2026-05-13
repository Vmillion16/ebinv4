import React, { useState } from "react";
import "./Maintenance.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const typeColor = (type) => {
  if (type === "Calibration") return "mtype mtype-info";
  if (type === "Repair")      return "mtype mtype-warn";
  return "mtype mtype-neutral";
};

const statusClass = (s) => {
  if (s === "Done")      return "badge badge-success";
  if (s === "Pending")   return "badge badge-warning";
  if (s === "Scheduled") return "badge badge-info";
  return "badge badge-default";
};

const priorityClass = (p) => (p === "High" ? "badge badge-warning" : "badge badge-default");

const sensorBarColor = (pct) => {
  if (pct >= 90) return "#1D9E75";
  if (pct >= 70) return "#f59e0b";
  return "#ef4444";
};

const sensorTextClass = (pct) => {
  if (pct >= 90) return "sensor-ok";
  if (pct >= 70) return "sensor-warn";
  return "sensor-bad";
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Maintenance({
  maintenanceLogs = [],
  initialRequests = [],
  sensors         = [],
  metrics         = {},
  binOptions      = [],
}) {
  const [typeFilter, setTypeFilter] = useState("All");
  const [binFilter,  setBinFilter]  = useState("All");
  const [requests,   setRequests]   = useState(initialRequests);
  const [showForm,   setShowForm]   = useState(false);
  const [form, setForm] = useState({
    title: "", bin: binOptions[0] ?? "", type: "Inspection", description: "",
  });

  // Derive unique filter options from log data
  const logTypes = ["All", ...new Set(maintenanceLogs.map((r) => r.type))];
  const logBins  = ["All", ...new Set(maintenanceLogs.map((r) => r.bin))];

  const filteredLogs = maintenanceLogs.filter((r) => {
    const typeMatch = typeFilter === "All" || r.type === typeFilter;
    const binMatch  = binFilter  === "All" || r.bin  === binFilter || r.bin === "All bins";
    return typeMatch && binMatch;
  });

  const handleResolve = (id) =>
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "Done" } : r)));

  const handleSubmit = () => {
    if (!form.title.trim() || !form.description.trim()) return;
    setRequests((prev) => [
      { id: Date.now(), title: form.title, bin: form.bin, description: form.description, priority: "Normal", status: "Pending" },
      ...prev,
    ]);
    setForm({ title: "", bin: binOptions[0] ?? "", type: "Inspection", description: "" });
    setShowForm(false);
  };

  const openCount     = requests.filter((r) => r.status === "Pending").length;
  const systemHealth  = metrics.systemHealth     ?? "—";
  const healthSub     = metrics.healthSub        ?? "";
  const resolvedCount = metrics.resolvedThisMonth ?? 0;
  const lastMaintained = metrics.lastMaintained  ?? "—";
  const lastMaintSub   = metrics.lastMaintSub    ?? "";

  return (
    <div className="mt-page">
      <div className="mt-page-header">
        <div>
          <h2 className="mt-page-title">Maintenance</h2>
      
        </div>
        <button className="mt-btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New request"}
        </button>
      </div>

      {showForm && (
        <div className="mt-form-card">
          <p className="mt-card-title">New maintenance request</p>
          <div className="mt-form-grid">
            <div className="mt-form-field">
              <label className="mt-label">Issue title</label>
              <input
                className="mt-input"
                placeholder="e.g. Load cell not reading"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="mt-form-field">
              <label className="mt-label">Bin</label>
              <select className="mt-select" value={form.bin} onChange={(e) => setForm({ ...form, bin: e.target.value })}>
                {binOptions.map((b) => <option key={b}>{b}</option>)}
                <option value="All bins">All bins</option>
              </select>
            </div>
            <div className="mt-form-field">
              <label className="mt-label">Type</label>
              <select className="mt-select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option>Inspection</option>
                <option>Calibration</option>
                <option>Repair</option>
              </select>
            </div>
          </div>
          <div className="mt-form-field" style={{ marginTop: 10 }}>
            <label className="mt-label">Description</label>
            <textarea
              className="mt-textarea"
              rows={3}
              placeholder="Describe the issue or task..."
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
            <button className="mt-btn-primary" onClick={handleSubmit}>Submit request</button>
          </div>
        </div>
      )}

      <div className="mt-metrics">
        <div className="mt-metric">
          <p className="mt-metric-label">System health</p>
          <p className="mt-metric-value mt-green">{systemHealth}</p>
          <p className="mt-metric-sub">{healthSub}</p>
        </div>
        <div className="mt-metric">
          <p className="mt-metric-label">Open issues</p>
          <p className="mt-metric-value mt-warn">{openCount}</p>
          <p className="mt-metric-sub">Needs attention</p>
        </div>
        <div className="mt-metric">
          <p className="mt-metric-label">Resolved this month</p>
          <p className="mt-metric-value">{resolvedCount}</p>
          <p className="mt-metric-sub">Maintenance tasks</p>
        </div>
        <div className="mt-metric">
          <p className="mt-metric-label">Last maintained</p>
          <p className="mt-metric-value">{lastMaintained}</p>
          <p className="mt-metric-sub">{lastMaintSub}</p>
        </div>
      </div>

      <div className="mt-two-col">
        <div className="mt-card">
          <p className="mt-card-title">Sensor &amp; component status</p>
          {sensors.length === 0 ? (
            <p className="mt-empty">No sensor data available.</p>
          ) : (
            sensors.map((s) => (
              <div key={s.name} className="mt-sensor-row">
                <span className="mt-sensor-name">{s.name}</span>
                <div className="mt-bar-bg">
                  <div className="mt-bar-fill" style={{ width: `${s.pct}%`, background: sensorBarColor(s.pct) }} />
                </div>
                <span className={`mt-sensor-pct ${sensorTextClass(s.pct)}`}>
                  {s.status === "Calibrate" ? "Calibrate" : `${s.pct}%`}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="mt-card">
          <p className="mt-card-title">Open requests</p>
          {requests.filter((r) => r.status !== "Done").length === 0 ? (
            <p className="mt-empty">No open requests — all clear.</p>
          ) : (
            requests
              .filter((r) => r.status !== "Done")
              .map((req) => (
                <div
                  key={req.id}
                  className={`mt-request-card ${req.priority === "High" ? "mt-request-warn" : "mt-request-neutral"}`}
                >
                  <div className="mt-request-header">
                    <span className="mt-request-title">{req.title}</span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span className={priorityClass(req.priority)}>{req.priority}</span>
                      <span className={statusClass(req.status)}>{req.status}</span>
                    </div>
                  </div>
                  <p className="mt-request-bin">{req.bin}</p>
                  <p className="mt-request-desc">{req.description}</p>
                  <div className="mt-request-actions">
                    <button className="mt-btn-sm" onClick={() => handleResolve(req.id)}>
                      Mark resolved
                    </button>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      <div className="mt-card">
        <div className="mt-card-header">
          <p className="mt-card-title" style={{ margin: 0 }}>Maintenance log</p>
          <div className="mt-card-actions">
            <select className="mt-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
              {logTypes.map((t) => <option key={t} value={t}>{t === "All" ? "All types" : t}</option>)}
            </select>
            <select className="mt-select" value={binFilter} onChange={(e) => setBinFilter(e.target.value)}>
              {logBins.map((b) => <option key={b} value={b}>{b === "All" ? "All bins" : b}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-table-wrap">
          <table className="mt-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Bin</th>
                <th>Description</th>
                <th>Performed by</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr><td colSpan={6} className="mt-empty-cell">No records match your filters.</td></tr>
              ) : (
                filteredLogs.map((row) => (
                  <tr key={row.id}>
                    <td className="mt-muted">{row.date}</td>
                    <td><span className={typeColor(row.type)}>{row.type}</span></td>
                    <td>{row.bin}</td>
                    <td className="mt-muted">{row.description}</td>
                    <td>{row.staff}</td>
                    <td><span className={statusClass(row.status)}>{row.status}</span></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}