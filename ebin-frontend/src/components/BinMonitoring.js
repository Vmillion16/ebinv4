import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './BinMonitoring.css';
import API_URL from '../config';

// Helper Functions (keep your existing ones)
const getTypeShortName = (type) => {
  const t = type?.toLowerCase() || '';
  if (t.includes('organic') || t.includes('bio')) return 'Bio';
  if (t.includes('recyclable') || t.includes('recycle') || t.includes('plastic')) return 'Recycle';
  return 'Non-Bio';
};

const getPriorityLabel = (fillLevel) => {
  if (fillLevel >= 90) return { label: 'CRITICAL', cls: 'critical' };
  if (fillLevel >= 76) return { label: 'HIGH',     cls: 'high'     };
  if (fillLevel >= 51) return { label: 'MEDIUM',   cls: 'medium'   };
  return                      { label: 'LOW',      cls: 'low'      };
};

const getStatusClass = (status) => {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':      return 'status-active';
    case 'FULL':        return 'status-full';
    case 'MAINTENANCE': return 'status-maintenance';
    default:            return 'status-unknown';
  }
};

// Bin Row Component
const BinRow = ({ bin }) => {
  const fillLevel = bin.fill_level ?? 0;
  const weight    = bin.weight_kg ?? 0;  // Note: your backend uses weight_kg
  const { label, cls } = getPriorityLabel(fillLevel);
  const fillPct   = Math.min(Math.round(fillLevel), 100);

  return (
    <tr className={`pro-row priority-${cls}`}>
      <td>
        <span className={`type-badge pro-type-${getTypeShortName(bin.bin_type).toLowerCase().replace('-', '')}`}>
          {getTypeShortName(bin.bin_type)}
        </span>
      </td>
      <td>
        <div className="fill-cell">
          <div className="fill-bar-track">
            <div
              className="fill-bar-fill"
              style={{ width: `${fillPct}%` }}
              data-level={fillPct >= 90 ? 'critical' : fillPct >= 76 ? 'high' : fillPct >= 51 ? 'medium' : 'low'}
            />
          </div>
          <span className="fill-pct">{fillPct}%</span>
        </div>
      </td>
      <td>
        <span className={`pro-status-badge ${getStatusClass(bin.status)}`}>
          {bin.status ?? 'UNKNOWN'}
        </span>
      </td>
      <td><span className="weight-badge">{weight.toFixed(1)} kg</span></td>
      <td><span className={`priority-badge pro-priority-${cls}`}>{label}</span></td>
    </tr>
  );
};

// Main Component - Now with API connection
const BinMonitoring = () => {
  const [bins, setBins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Fetch bins from backend
  useEffect(() => {
    const fetchBins = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        if (!token) {
          setError('Please login to view bins');
          setLoading(false);
          return;
        }

        const response = await axios.get(`${API_URL}/bins`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log('Fetched bins:', response.data);
        setBins(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching bins:', err);
        setError(err.response?.data?.error || 'Failed to load bins');
      } finally {
        setLoading(false);
      }
    };

    fetchBins();
    
    // Optional: Refresh data every 30 seconds
    const interval = setInterval(fetchBins, 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredBins = bins.filter((bin) => {
    const typeMatch = filterType === 'all' || getTypeShortName(bin.bin_type) === filterType;
    const statusMatch = filterStatus === 'all' || bin.status?.toUpperCase() === filterStatus;
    return typeMatch && statusMatch;
  });

  if (loading) {
    return (
      <div className="bin-monitoring-professional">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading bins...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bin-monitoring-professional">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <p>{error}</p>
          <button onClick={() => window.location.reload()} className="retry-btn">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bin-monitoring-professional">
      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Bin Type</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Types</option>
            <option value="Recycle">Recycle</option>
            <option value="Bio">Bio</option>
            <option value="Non-Bio">Non-Bio</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Status</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="FULL">Full</option>
            <option value="MAINTENANCE">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <div className="table-header">
          <h2>{filteredBins.length} Bins • {bins.length} Total</h2>
          <button 
            className="refresh-btn" 
            onClick={() => window.location.reload()}
            title="Refresh data"
          >
            🔄
          </button>
        </div>
        <div className="table-responsive">
          <table className="professional-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Fill</th>
                <th>Status</th>
                <th>Weight</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {bins.length === 0 ? (
                <tr>
                  <td colSpan="5" className="no-data">
                    <div className="empty-state">
                      <div className="empty-icon">📦</div>
                      <p>No bin data available</p>
                      <small>Waiting for sensor data...</small>
                    </div>
                  </td>
                </tr>
              ) : filteredBins.length === 0 ? (
                <tr>
                  <td colSpan="5" className="no-data">
                    <div className="empty-state">
                      <div className="empty-icon">🔍</div>
                      <p>No bins match your filters</p>
                      <small>Try adjusting the filters above</small>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredBins.map((bin) => (
                  <BinRow key={bin._id || bin.bin_id} bin={bin} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BinMonitoring;