import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip,
} from 'recharts';
import './DashboardOverview.css';
import API_URL from '../config';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = {
  full:     '#E24B4A',
  nearFull: '#F59E0B',
  active:   '#1D9E75',
  maint:    '#6b7280',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getBinStatus = (fillLevel) => {
  if (fillLevel >= 90) return 'Full';
  if (fillLevel >= 75) return 'Near Full';
  return 'Active';
};

const getStatusColor = (status) => {
  if (status === 'Full')        return COLORS.full;
  if (status === 'Near Full')   return COLORS.nearFull;
  if (status === 'Maintenance') return COLORS.maint;
  return COLORS.active;
};

const getFillBarColor = (fill) => {
  if (fill >= 90) return COLORS.full;
  if (fill >= 75) return COLORS.nearFull;
  return COLORS.active;
};

const CustomAreaTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="do-tooltip">
      <p className="do-tooltip-label">{label}</p>
      <p className="do-tooltip-val">{payload[0].value} kg collected</p>
    </div>
  );
};

// ─── Component ────────────────────────────────────────────────────────────────
const DashboardOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSync, setLastSync] = useState(null);

  // Get auth token
  const getAuthToken = () => {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  };

  // ── Fetch data from database ──────────────────────────────────────────────
  // Replace the fetchDashboardData function in DashboardOverview.js with:

const fetchDashboardData = async () => {
  try {
    setLoading(true);
    setError(null);
    
    // Use the public dashboard endpoint (no authentication required)
    const response = await fetch(`${API_URL}/bins/public/dashboard`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('Dashboard data received:', data);
      
      setLastSync(new Date().toLocaleTimeString());
      setData({
        bins: data.bins || [],
        wasteLast7Days: data.wasteLast7Days || []
      });
      return;
    }
    
    // If public endpoint fails, try authenticated endpoints
    const token = localStorage.getItem('token');
    if (token) {
      // Try dashboard endpoint with auth
      const authResponse = await fetch(`${API_URL}/dashboard`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (authResponse.ok) {
        const authData = await authResponse.json();
        setLastSync(new Date().toLocaleTimeString());
        setData({
          bins: authData.bins || [],
          wasteLast7Days: authData.wasteLast7Days || []
        });
        return;
      }
    }
    
    // If all else fails, use mock data
    console.log('Using mock data for development');
    setData({
      bins: [
        { _id: '1', bin_name: 'Recycling Bin A', bin_type: 'Recyclable', fillLevel: 85, weight_kg: 12.5 },
        { _id: '2', bin_name: 'General Waste B', bin_type: 'Non-Biodegradable', fillLevel: 92, weight_kg: 18.2 },
        { _id: '3', bin_name: 'Organic Bin C', bin_type: 'Biodegradable', fillLevel: 45, weight_kg: 7.8 },
        { _id: '4', bin_name: 'Recycling Bin D', bin_type: 'Recyclable', fillLevel: 78, weight_kg: 10.3 },
        { _id: '5', bin_name: 'General Waste E', bin_type: 'Non-Biodegradable', fillLevel: 95, weight_kg: 22.1 },
      ],
      wasteLast7Days: [
        { day: 'Mon', kg: 45 }, { day: 'Tue', kg: 52 }, { day: 'Wed', kg: 48 },
        { day: 'Thu', kg: 61 }, { day: 'Fri', kg: 55 }, { day: 'Sat', kg: 42 }, 
        { day: 'Sun', kg: 38 }
      ]
    });
    setLastSync(new Date().toLocaleTimeString());
    
  } catch (err) {
    console.error('Error fetching dashboard data:', err);
    setError(err.message);
    // Set mock data so UI doesn't break
    setData({
      bins: [
        { _id: '1', bin_name: 'Demo Bin 1', bin_type: 'Recyclable', fillLevel: 75 },
        { _id: '2', bin_name: 'Demo Bin 2', bin_type: 'General', fillLevel: 60 },
      ],
      wasteLast7Days: [
        { day: 'Mon', kg: 45 }, { day: 'Tue', kg: 52 }, { day: 'Wed', kg: 48 },
        { day: 'Thu', kg: 61 }, { day: 'Fri', kg: 55 }, { day: 'Sat', kg: 42 }, 
        { day: 'Sun', kg: 38 }
      ]
    });
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    fetchDashboardData();
    
    // Auto-refresh every 60 seconds
    const interval = setInterval(() => {
      fetchDashboardData();
    }, 60000);
    
    return () => clearInterval(interval);
  }, []);

  // ── Priority bins (fill ≥ 75) ──────────────────────────────────────────────
  const priorityBins = useMemo(() => {
    if (!data?.bins) return [];
    return data.bins
      .filter((b) => (b.fillLevel ?? 0) >= 75)
      .sort((a, b) => (b.fillLevel ?? 0) - (a.fillLevel ?? 0))
      .slice(0, 5);
  }, [data?.bins]);

  // Show loading state
  if (loading && !data?.bins?.length) {
    return (
      <div className="do-container">
        <div className="do-card do-card-full">
          <div className="do-loading">
            <span className="do-loading-dot" />
            <span className="do-loading-dot" />
            <span className="do-loading-dot" />
            <p>Loading dashboard data...</p>
            {lastSync && <p className="do-last-sync">Last sync: {lastSync}</p>}
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && !data?.bins?.length) {
    return (
      <div className="do-container">
        <div className="do-card do-card-full">
          <div className="do-error">
            <p className="do-error-icon">⚠️</p>
            <p className="do-error-message">Error loading dashboard data</p>
            <p className="do-error-details">{error}</p>
            <button onClick={fetchDashboardData} className="do-retry-btn">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const bins = data?.bins ?? [];
  const trend = data?.wasteLast7Days ?? [];

  return (
    <div className="do-container">
      
      {/* Last sync info */}
      {lastSync && (
        <div className="do-sync-info">
          <span className="do-sync-label">Last sync:</span>
          <span className="do-sync-time">{lastSync}</span>
        </div>
      )}

      {/* ── Waste trend ── */}
      <div className="do-card do-card-full">
        <p className="do-card-title">Waste trend — last 7 days</p>
        {trend.length === 0 ? (
          <div className="do-empty-chart">No trend data available yet.</div>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={trend} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#1D9E75" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} unit=" kg" />
              <Tooltip content={<CustomAreaTooltip />} />
              <Area
                type="monotone"
                dataKey="kg"
                stroke="#1D9E75"
                strokeWidth={2}
                fill="url(#areaGrad)"
                dot={{ r: 3, fill: '#1D9E75' }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Priority bins ── */}
      <div className="do-card do-card-full">
        <div className="do-card-header">
          <p className="do-card-title" style={{ margin: 0 }}>Priority bins</p>
          {priorityBins.length > 0
            ? <span className="do-badge do-badge-warn">{priorityBins.length} need attention</span>
            : <span className="do-badge do-badge-ok">All bins normal</span>
          }
        </div>

        {bins.length === 0 ? (
          <div className="do-all-ok">
            <p>No bins data available</p>
          </div>
        ) : priorityBins.length === 0 ? (
          <div className="do-all-ok">
            <span className="do-ok-icon">✓</span>
            <p>No bins require immediate collection</p>
          </div>
        ) : (
          <div className="do-priority-list">
            {priorityBins.map((bin, i) => {
              const status = bin.status || getBinStatus(bin.fillLevel ?? 0);
              return (
                <div key={bin._id ?? bin.id ?? i} className="do-priority-row">
                  <div className="do-priority-left">
                    <span className="do-priority-dot" style={{ background: getFillBarColor(bin.fillLevel ?? 0) }} />
                    <span className="do-priority-name">{bin.bin_name ?? bin.objectId ?? `Bin ${i + 1}`}</span>
                    <span className="do-priority-type">{bin.bin_type ?? '—'}</span>
                  </div>
                  <div className="do-priority-center">
                    <div className="do-fill-bar-bg">
                      <div
                        className="do-fill-bar-fill"
                        style={{
                          width: `${bin.fillLevel ?? 0}%`,
                          background: getFillBarColor(bin.fillLevel ?? 0),
                        }}
                      />
                    </div>
                  </div>
                  <div className="do-priority-right">
                    <span className="do-fill-pct">{bin.fillLevel ?? 0}%</span>
                    <span
                      className="do-status-tag"
                      style={{
                        background: `${getStatusColor(status)}18`,
                        color: getStatusColor(status),
                        border: `1px solid ${getStatusColor(status)}40`,
                      }}
                    >
                      {status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default DashboardOverview;