import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  ResponsiveContainer, Tooltip, BarChart, Bar 
} from 'recharts';

const API_BASE = 'http://localhost:5000';

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Sample data for demo
    setReports([
      { date: 'Mar 20', recyclable: 15, nonRecyclable: 25, general: 8 },
      { date: 'Mar 21', recyclable: 18, nonRecyclable: 22, general: 10 },
      { date: 'Mar 22', recyclable: 20, nonRecyclable: 28, general: 12 },
      { date: 'Mar 23', recyclable: 22, nonRecyclable: 24, general: 9 },
      { date: 'Mar 24', recyclable: 25, nonRecyclable: 20, general: 11 },
      { date: 'Mar 25', recyclable: 28, nonRecyclable: 18, general: 13 },
      { date: 'Mar 26', recyclable: 30, nonRecyclable: 22, general: 10 }
    ]);
    setLoading(false);
  }, []);

  const exportPDF = () => {
    const data = reports.map(r => ({
      Date: r.date,
      'Recyclable (kg)': r.recyclable,
      'Non-Recyclable (kg)': r.nonRecyclable,
      'General (kg)': r.general
    }));
    
    // Simple CSV export
    const csv = 'Date,Recyclable,Non-Recyclable,General\n' + 
      data.map(row => Object.values(row).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ebin-waste-report.csv';
    a.click();
  };

  if (loading) return <div className="loading">⏳ Loading reports...</div>;

  return (
    <div className="reports">
      <div className="reports-header">
        <h2>Waste Management Reports</h2>
        <button className="export-btn" onClick={exportPDF}>
          Export CSV
        </button>
      </div>

      <div className="charts-grid">
        {/* Waste Trends */}
        <div className="chart-card">
          <h3>📈 Weekly Waste Trends</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={reports}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f7f4" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="recyclable" stroke="#56ab2f" strokeWidth={3} name="Recyclable" />
              <Line type="monotone" dataKey="nonRecyclable" stroke="#e74c3c" strokeWidth={3} name="Non-Recyclable" />
              <Line type="monotone" dataKey="general" stroke="#f39c12" strokeWidth={3} name="General" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Summary Cards */}
        <div className="summary-grid">
          <div className="summary-card green">
            <h4>Recycling Rate</h4>
            <div className="big-number">41%</div>
            <p>Target: 50%</p>
          </div>
          <div className="summary-card blue">
            <h4>Total Collections</h4>
            <div className="big-number">127</div>
            <p>This week</p>
          </div>
          <div className="summary-card orange">
            <h4>Avg Response</h4>
            <div className="big-number">28m</div>
            <p>Alert resolution</p>
          </div>
        </div>
      </div>

      {/* RA 9003 Compliance */}
      <div className="compliance-card">
        <h3>✅ RA 9003 Compliance</h3>
        <div className="compliance-grid">
          <div>Segregation: <strong>78%</strong></div>
          <div>MRF Ready: <strong>41%</strong></div>
          <div>Zero Waste: <strong>65%</strong></div>
        </div>
      </div>
    </div>
  );
};

export default Reports;