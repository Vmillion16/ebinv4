import React, { useState } from "react";
import "./CollectionReward.css";

const statusClass = (s) => {
  if (s === "Done" || s === "Granted") return "badge badge-success";
  if (s === "Partial" || s === "Offline") return "badge badge-warning";
  if (s === "Declined") return "badge badge-danger";
  return "badge badge-default";
};

const portDotClass = (s) => {
  if (s === "In use") return "port-dot dot-success";
  if (s === "Offline") return "port-dot dot-warning";
  return "port-dot dot-neutral";
};

export default function CollectionReward({
  collectionData = [],
  rewardSessions = [],
  chargingPorts = [],
  metrics = {},
}) {
  const [activeTab, setActiveTab] = useState("log");
  const [typeFilter, setTypeFilter] = useState("All");
  const [staffFilter, setStaffFilter] = useState("All");

  // Derive unique filter options from data
  const wasteTypes = ["All", ...new Set(collectionData.map((r) => r.type))];
  const staffNames = ["All", ...new Set(collectionData.map((r) => r.staff))];

  const filteredCollections = collectionData.filter((r) => {
    const typeMatch  = typeFilter  === "All" || r.type  === typeFilter;
    const staffMatch = staffFilter === "All" || r.staff === staffFilter;
    return typeMatch && staffMatch;
  });

  const handleExport = () => {
    const headers = ["Date & Time", "Bin", "Collected By", "Waste Type", "Weight", "Destination", "Status"];
    const rows = filteredCollections.map((r) =>
      [r.datetime, r.bin, r.staff, r.type, r.weight, r.destination, r.status].join(",")
    );
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "collection_log.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Derived log metrics (computed from data, with prop overrides)
  const logMetrics = {
    collectionsThisWeek: metrics.collectionsThisWeek ?? collectionData.filter((r) => r.status === "Done").length,
    totalWeight:         metrics.totalWeight         ?? null,
    nextPickup:          metrics.nextPickup          ?? "—",
    pendingCollection:   metrics.pendingCollection   ?? collectionData.filter((r) => r.status === "Partial").length,
  };

  // Derived reward metrics
  const rewardMetrics = {
    activeSessions:   metrics.activeSessions   ?? chargingPorts.filter((p) => p.status === "In use").length,
    rewardsToday:     metrics.rewardsToday     ?? rewardSessions.filter((r) => r.result === "Granted").length,
    declinedToday:    metrics.declinedToday    ?? rewardSessions.filter((r) => r.result === "Declined").length,
    correctDisposal:  metrics.correctDisposal  ?? null,
  };

  // Derived bar chart data from rewardSessions
  const total = rewardSessions.length || 1;
  const granted  = rewardSessions.filter((r) => r.result === "Granted").length;
  const declined = rewardSessions.filter((r) => r.result === "Declined").length;
  const portOffline = chargingPorts.filter((p) => p.status === "Offline").length;
  const totalPorts  = chargingPorts.length || 1;

  const disposalBars = metrics.disposalBars ?? [
    { label: "Reward granted",    pct: Math.round((granted  / total)       * 100), color: "#378ADD", textColor: "cr-bar-info"    },
    { label: "Wrong bin",         pct: Math.round((declined / total)       * 100), color: "#E24B4A", textColor: "cr-bar-danger"  },
    { label: "Port offline",      pct: Math.round((portOffline / totalPorts) * 100), color: "#BA7517", textColor: "cr-bar-warn" },
  ];

  return (
    <div className="cr-page">
      <div className="cr-page-header">
        <div>
          <h2 className="cr-page-title">Collection &amp; Reward</h2>
      
        </div>
      </div>

      <div className="cr-tabs">
        <button
          className={`cr-tab ${activeTab === "log" ? "cr-tab-active" : ""}`}
          onClick={() => setActiveTab("log")}
        >
          Collection log
        </button>
        <button
          className={`cr-tab ${activeTab === "reward" ? "cr-tab-active" : ""}`}
          onClick={() => setActiveTab("reward")}
        >
          Reward &amp; charging
        </button>
      </div>

      {activeTab === "log" && (
        <div className="cr-tab-content">
          <div className="cr-metrics">
            <div className="cr-metric">
              <p className="cr-metric-label">This week</p>
              <p className="cr-metric-value">{logMetrics.collectionsThisWeek}</p>
              <p className="cr-metric-sub">Collections done</p>
            </div>
            <div className="cr-metric">
              <p className="cr-metric-label">Total weight</p>
              <p className="cr-metric-value">{logMetrics.totalWeight ?? "—"}</p>
              <p className="cr-metric-sub">Since Monday</p>
            </div>
            <div className="cr-metric">
              <p className="cr-metric-label">Next municipal pickup</p>
              <p className="cr-metric-value cr-value-green">{logMetrics.nextPickup}</p>
              <p className="cr-metric-sub">Tue &amp; Sat schedule</p>
            </div>
            <div className="cr-metric">
              <p className="cr-metric-label">Pending collection</p>
              <p className="cr-metric-value cr-value-warn">{logMetrics.pendingCollection}</p>
              <p className="cr-metric-sub">Bins near full</p>
            </div>
          </div>

          

          <div className="cr-card">
            <div className="cr-card-header">
              <p className="cr-card-title">Collection history</p>
              <div className="cr-card-actions">
                <select className="cr-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
                  {wasteTypes.map((t) => (
                    <option key={t} value={t}>{t === "All" ? "All types" : t}</option>
                  ))}
                </select>
                <select className="cr-select" value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)}>
                  {staffNames.map((s) => (
                    <option key={s} value={s}>{s === "All" ? "All staff" : s}</option>
                  ))}
                </select>
                <button className="cr-btn-outline" onClick={handleExport}>
                  Export CSV
                </button>
              </div>
            </div>
            <div className="cr-table-wrap">
              <table className="cr-table">
                <thead>
                  <tr>
                    <th>Date &amp; time</th>
                    <th>Bin</th>
                    <th>Collected by</th>
                    <th>Waste type</th>
                    <th>Weight</th>
                    <th>Destination</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCollections.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="cr-empty">No records match your filters.</td>
                    </tr>
                  ) : (
                    filteredCollections.map((row) => (
                      <tr key={row.id}>
                        <td className="cr-muted">{row.datetime}</td>
                        <td>{row.bin}</td>
                        <td>{row.staff}</td>
                        <td>{row.type}</td>
                        <td>{row.weight}</td>
                        <td>{row.destination}</td>
                        <td><span className={statusClass(row.status)}>{row.status}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "reward" && (
        <div className="cr-tab-content">
          <div className="cr-metrics">
            <div className="cr-metric">
              <p className="cr-metric-label">Active sessions</p>
              <p className="cr-metric-value">{rewardMetrics.activeSessions}</p>
              <p className="cr-metric-sub">Charging now</p>
            </div>
            <div className="cr-metric">
              <p className="cr-metric-label">Rewards today</p>
              <p className="cr-metric-value">{rewardMetrics.rewardsToday}</p>
              <p className="cr-metric-sub">Granted today</p>
            </div>
            <div className="cr-metric">
              <p className="cr-metric-label">Declined today</p>
              <p className="cr-metric-value cr-value-danger">{rewardMetrics.declinedToday}</p>
              <p className="cr-metric-sub">Wrong bin used</p>
            </div>
            <div className="cr-metric">
              <p className="cr-metric-label">Correct disposal</p>
              <p className="cr-metric-value cr-value-green">
                {rewardMetrics.correctDisposal != null ? `${rewardMetrics.correctDisposal}%` : "—"}
              </p>
              <p className="cr-metric-sub">Earns reward</p>
            </div>
          </div>

          <div className="cr-two-col">
            <div className="cr-card">
              <p className="cr-card-title">Charging port status</p>
              {chargingPorts.length === 0 ? (
                <p className="cr-empty">No port data available.</p>
              ) : (
                chargingPorts.map((port) => (
                  <div key={port.id} className="cr-port-row">
                    <span className={portDotClass(port.status)} />
                    <span className="cr-port-name">{port.name}</span>
                    <span className={statusClass(
                      port.status === "In use" ? "Done" :
                      port.status === "Offline" ? "Partial" : "Available"
                    )}>
                      {port.status}{port.detail ? ` — ${port.detail}` : ""}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="cr-card">
              <p className="cr-card-title">Disposal vs reward rate</p>
              {disposalBars.map((item) => (
                <div key={item.label} className="cr-bar-row">
                  <span className="cr-bar-label">{item.label}</span>
                  <div className="cr-bar-bg">
                    <div className="cr-bar-fill" style={{ width: `${item.pct}%`, background: item.color }} />
                  </div>
                  <span className={`cr-bar-pct ${item.textColor}`}>{item.pct}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="cr-card">
            <p className="cr-card-title">Recent reward sessions</p>
            <div className="cr-table-wrap">
              <table className="cr-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Bin used</th>
                    <th>Waste type</th>
                    <th>Port</th>
                    <th>Duration</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rewardSessions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="cr-empty">No reward sessions yet.</td>
                    </tr>
                  ) : (
                    rewardSessions.map((row) => (
                      <tr key={row.id}>
                        <td className="cr-muted">{row.time}</td>
                        <td>{row.bin}</td>
                        <td>{row.wasteType}</td>
                        <td>{row.port}</td>
                        <td>{row.duration}</td>
                        <td><span className={statusClass(row.result)}>{row.result}</span></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}