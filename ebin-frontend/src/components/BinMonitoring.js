import React, { useState } from 'react';
import './BinMonitoring.css';

// Helper Functions
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

// Bin Row
const BinRow = ({ bin }) => {
  const fillLevel = bin.fill_level ?? 0;
  const weight    = bin.weight     ?? 0;
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

// Main Component
const BinMonitoring = ({ bins = [] }) => {
  const [filterType,   setFilterType]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredBins = bins.filter((bin) => {
    const typeMatch   = filterType   === 'all' || getTypeShortName(bin.bin_type) === filterType;
    const statusMatch = filterStatus === 'all' || bin.status?.toUpperCase() === filterStatus;
    return typeMatch && statusMatch;
  });

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
                  <BinRow key={bin.bin_id} bin={bin} />
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