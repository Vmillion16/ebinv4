import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const WasteSegregation = ({ bins = [] }) => {
  const [stats, setStats] = useState({
    recyclable: 0,
    nonRecyclable: 0,
    general: 0,
    total: 0,
    recyclingRate: 0
  });

  useEffect(() => {
    const recyclable = bins.filter(b => b.bin_type === 'Recyclable').length;
    const nonRecyclable = bins.filter(b => b.bin_type === 'Non-Recyclable').length;
    const general = bins.filter(b => b.bin_type === 'General').length;
    const total = bins.length;
    const rate = total > 0 ? Math.round((recyclable / total) * 100) : 0;

    setStats({
      recyclable,
      nonRecyclable,
      general,
      total,
      recyclingRate: rate
    });
  }, [bins]);

  const COLORS = ['#56ab2f', '#e74c3c', '#f39c12'];
  const data = [
    { name: 'Recyclable', value: stats.recyclable },
    { name: 'Non-Recyclable', value: stats.nonRecyclable },
    { name: 'General', value: stats.general }
  ];

  const segregationGuide = [
    { type: 'Recyclable ✅', items: 'Plastic bottles, paper, metal cans', color: '#56ab2f' },
    { type: 'Non-Recyclable ❌', items: 'Food wrappers, styrofoam, soiled paper', color: '#e74c3c' },
    { type: 'General ⚠️', items: 'Mixed/unknown waste', color: '#f39c12' }
  ];

  return (
    <div className="waste-segregation">
      <div className="segregation-header">
        <h2>♻️ Waste Segregation Dashboard</h2>
        <div className="key-stats">
          <div className="stat-item">
            <div className="stat-number">{stats.recyclingRate}%</div>
            <div>Recycling Rate</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">{stats.total}</div>
            <div>Total Bins</div>
          </div>
        </div>
      </div>

      <div className="segregation-grid">
        {/* Pie Chart */}
        <div className="chart-section">
          <h3>Bin Distribution</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Live Stats */}
        <div className="stats-section">
          <h3>Live Status</h3>
          {segregationGuide.map((item, index) => (
            <div key={index} className="stat-row">
              <div className="stat-color" style={{ backgroundColor: item.color }}></div>
              <div>
                <div className="stat-label">{item.type}</div>
                <div className="stat-items">{item.items}</div>
              </div>
              <div className="stat-count">
                {item.type.includes('Recyclable') ? stats.recyclable :
                 item.type.includes('Non-Recyclable') ? stats.nonRecyclable :
                 stats.general}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* RA 9003 Compliance */}
      <div className="compliance-section">
        <h3>📜 RA 9003 Compliance</h3>
        <div className="compliance-stats">
          <div className="compliance-item success">
            <div className="compliance-number">78%</div>
            <div>Segregation Rate</div>
          </div>
          <div className="compliance-item warning">
            <div className="compliance-number">41%</div>
            <div>MRF Ready</div>
          </div>
          <div className="compliance-item info">
            <div className="compliance-number">₱2,450</div>
            <div>Monthly Revenue</div>
          </div>
        </div>
      </div>

      {/* Sensor Status */}
      <div className="sensor-status">
        <h3>🔬 Sensor Performance</h3>
        <div className="sensor-grid">
          <div className="sensor-card online">
            <div className="sensor-icon">📡</div>
            <div>Ultrasonic</div>
            <div>100% Uptime</div>
          </div>
          <div className="sensor-card online">
            <div className="sensor-icon">🎨</div>
            <div>Color Sensor</div>
            <div>98% Accuracy</div>
          </div>
          <div className="sensor-card warning">
            <div className="sensor-icon">⚖️</div>
            <div>Load Cell</div>
            <div>Calibrate</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WasteSegregation;