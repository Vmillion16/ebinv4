import React from 'react';

const DashboardOverview = ({ data }) => {
  return (
    <div className="overview-grid">
      <div className="stat-card green">
        <h3>Total Bins</h3>
        <div className="stat-number">{data.totalBins || 0}</div>
      </div>
      <div className="stat-card red">
        <h3>Full Bins</h3>
        <div className="stat-number">{data.fullBins || 0}</div>
      </div>
      <div className="stat-card orange">
        <h3>Active Alerts</h3>
        <div className="stat-number">{data.activeAlerts || 0}</div>
      </div>
      <div className="stat-card blue">
        <h3>Waste Today (kg)</h3>
        <div className="stat-number">{data.totalWasteToday?.toFixed(2) || 0}</div>
      </div>
    </div>
  );
};

export default DashboardOverview;