import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:5000';

const Alerts = ({ alerts = [], onMarkRead }) => {
  const [activeAlerts, setActiveAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ total: 0, high: 0, resolved: 0 });
  const [view, setView] = useState('active'); // active/history
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const highPriority = alerts.filter(a => a.severity === 'High').length;
    const resolved = alerts.filter(a => a.status === 'Resolved').length;
    
    setStats({
      total: alerts.length,
      high: highPriority,
      resolved,
      responseRate: alerts.length > 0 ? Math.round((resolved / alerts.length) * 100) : 0
    });
    
    setActiveAlerts(alerts.filter(a => a.status === 'Unread'));
    setHistory(alerts.filter(a => a.status !== 'Unread'));
  }, [alerts]);

  const markAsRead = async (alertId) => {
    try {
      await axios.put(`${API_BASE}/api/alerts/${alertId}/read`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      onMarkRead(alertId);
    } catch (error) {
      console.error('Mark read failed');
    }
  };

  const filteredAlerts = view === 'active' 
    ? activeAlerts 
    : history.filter(a => filter === 'all' || a.severity === filter);

  return (
    <div className="alerts-dashboard">
      {/* Header & Stats */}
      <div className="alerts-header">
        <div>
          <h2>🚨 Alert Center</h2>
          <p>{stats.total} total | {stats.high} high priority</p>
        </div>
        <div className="alert-stats">
          <div className="stat-badge">
            <div className="stat-number">{stats.responseRate}%</div>
            <div>Resolved</div>
          </div>
          <div className="stat-badge">
            <div className="stat-number">{activeAlerts.length}</div>
            <div>Active</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="alerts-tabs">
        <button 
          className={view === 'active' ? 'tab-active' : 'tab'}
          onClick={() => setView('active')}
        >
          Active ({activeAlerts.length})
        </button>
        <button 
          className={view === 'history' ? 'tab-active' : 'tab'}
          onClick={() => setView('history')}
        >
          History ({history.length})
        </button>
      </div>

      {/* Filter */}
      {view === 'history' && (
        <div className="filter-bar">
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>
      )}

      {/* Alerts List */}
      <div className="alerts-list">
        {filteredAlerts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h3>No {view === 'active' ? 'active' : 'matching'} alerts</h3>
            <p>{view === 'active' ? 'All bins operating normally!' : 'Great job on timely responses!'}</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div 
              key={alert.alert_id} 
              className={`alert-card priority-${alert.severity?.toLowerCase()} ${alert.status}`}
            >
              <div className="alert-header">
                <div className="alert-icon">
                  {alert.severity === 'High' ? '🚨' : 
                   alert.severity === 'Medium' ? '⚠️' : 'ℹ️'}
                </div>
                <div className="alert-priority">{alert.severity}</div>
                <div className={`alert-status ${alert.status}`}>
                  {alert.status}
                </div>
              </div>
              
              <div className="alert-content">
                <h4>{alert.alert_type}</h4>
                <p><strong>{alert.bin_name}</strong> - {alert.location}</p>
                <p className="alert-time">
                  {new Date(alert.created_at).toLocaleString()}
                </p>
              </div>
              
              <div className="alert-actions">
                {alert.status === 'Unread' && (
                  <button 
                    className="action-btn resolve"
                    onClick={() => markAsRead(alert.alert_id)}
                  >
                    ✅ Resolve
                  </button>
                )}
                {alert.status !== 'Unread' && (
                  <span className="resolved-time">
                    Resolved {new Date(alert.resolved_at || alert.created_at).toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Response Analytics */}
      <div className="alerts-analytics">
        <h3>📊 Response Performance</h3>
        <div className="analytics-grid">
          <div className="metric-card">
            <div className="metric-number">{stats.resolved}</div>
            <div>Resolved This Week</div>
          </div>
          <div className="metric-card">
            <div className="metric-number">28 min</div>
            <div>Avg Response Time</div>
          </div>
          <div className="metric-card">
            <div className="metric-number">92%</div>
            <div>On-Time Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Alerts;