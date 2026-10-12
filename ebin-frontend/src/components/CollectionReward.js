import React from "react";
import "./CollectionReward.css";
import API_URL from '../config';

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
  rewardSessions = [],
  chargingPorts = [],
  metrics = {},
}) {
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
    { label: "Reward granted", pct: Math.round((granted  / total) * 100),           color: "#378ADD", textColor: "cr-bar-info"   },
    { label: "Wrong bin",      pct: Math.round((declined / total) * 100),           color: "#E24B4A", textColor: "cr-bar-danger" },
    { label: "Port offline",   pct: Math.round((portOffline / totalPorts) * 100),   color: "#BA7517", textColor: "cr-bar-warn"   },
  ];

  return (
    <div className="cr-page">
      <div className="cr-page-header">
        <div>
          <h2 className="cr-page-title">Reward &amp; Charging</h2>
        </div>
      </div>

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
    </div>
  );
}