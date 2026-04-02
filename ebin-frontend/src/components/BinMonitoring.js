import React from 'react';

const BinMonitoring = ({ bins, onResetBin }) => {
  return (
    <div className="bin-table-container">
      <h2>Bin Monitoring</h2>
      <div className="table-header">
        <p>Real-time status of all campus bins</p>
        <button className="refresh-btn" onClick={() => window.location.reload()}>
          🔄 Refresh
        </button>
      </div>
      <div className="table-responsive">
        <table className="bins-table">
          <thead>
            <tr>
              <th>Bin ID</th>
              <th>Location</th>
              <th>Type</th>
              <th>Fill Level</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {bins.length === 0 ? (
              <tr>
                <td colSpan="7" className="no-data">
                  No bins data available. Please wait for real-time update...
                </td>
              </tr>
            ) : (
              bins.map((bin) => (
                <tr 
                  key={bin.bin_id} 
                  className={`status-${bin.status?.toLowerCase().replace('_', '-') || 'unknown'}`}
                >
                  <td>
                    <strong>{bin.bin_name}</strong>
                  </td>
                  <td>{bin.location}</td>
                  <td>
                    <span className={`type-badge type-${bin.bin_type?.toLowerCase().replace('_', '-')}`}>
                      {bin.bin_type}
                    </span>
                  </td>
                  <td>
                    <div className="progress-container">
                      <div className="progress-bar">
                        <div 
                          className={`progress-fill level-${getFillLevelStatus(bin.fill_level || 0)}`}
                          style={{ width: `${bin.fill_level || 0}%` }}
                        />
                      </div>
                      <span className="fill-percent">
                        {bin.fill_level?.toFixed(1) || 0}%
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`status-badge status-${bin.status?.toLowerCase().replace('_', '-')}`}>
                      {bin.status || 'Unknown'}
                    </span>
                  </td>
                  <td>
                    <span className="last-updated">
                      {bin.date_time_recorded 
                        ? new Date(bin.date_time_recorded).toLocaleString()
                        : 'Never'
                      }
                    </span>
                  </td>
                  <td>
                    {bin.status === 'Full' && (
                      <button
                        className="action-btn reset-btn"
                        onClick={() => onResetBin(bin.bin_id)}
                      >
                        Reset Bin
                      </button>
                    )}
                    {bin.status !== 'Full' && (
                      <span className="no-action">—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Helper function to determine fill level status for color coding
const getFillLevelStatus = (fillLevel) => {
  if (fillLevel >= 90) return 'critical';
  if (fillLevel >= 70) return 'high';
  if (fillLevel >= 50) return 'medium';
  return 'low';
};

export default BinMonitoring;