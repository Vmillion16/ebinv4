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

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch from your Ebin collection via public endpoint
      const response = await fetch(`${API_URL}/bins/public/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Real database data:', result);
        
        // Transform database fields to match component expectations
        const transformedBins = (result.bins || []).map(bin => ({
          _id: bin._id,
          bin_name: bin.bin_name || bin.binname || 'Unknown Bin',
          bin_type: bin.bin_type || 'General',
          fillLevel: bin.fill_level || bin.fillLevel || 0,
          status: bin.status || getBinStatus(bin.fill_level || 0),
          location: bin.location,
          weight_kg: bin.weight_kg || 0
        }));
        
        setLastSync(new Date().toLocaleTimeString());
        setData({
          bins: transformedBins,
          wasteLast7Days: result.wasteLast7Days || [
            { day: 'Mon', kg: 0 }, { day: 'Tue', kg: 0 }, { day: 'Wed', kg: 0 },
            { day: 'Thu', kg: 0 }, { day: 'Fri', kg: 0 }, { day: 'Sat', kg: 0 }, 
            { day: 'Sun', kg: 0 }
          ]
        });
        return;
      }
      
      // Fallback to mock data if endpoint fails
      console.log('Using mock data - endpoint returned:', response.status);
      setData({
        bins: [
          { _id: '1', bin_name: 'Ebin Bin A', bin_type: 'Biodegradable', fillLevel: 72, status: 'Active', weight_kg: 18.5 },
        ],
        wasteLast7Days: [
          { day: 'Mon', kg: 0 }, { day: 'Tue', kg: 0 }, { day: 'Wed', kg: 0 },
          { day: 'Thu', kg: 0 }, { day: 'Fri', kg: 0 }, { day: 'Sat', kg: 0 }, 
          { day: 'Sun', kg: 0 }
        ]
      });
      setLastSync(new Date().toLocaleTimeString());
      
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err.message);
      setData({
        bins: [
          { _id: '1', bin_name: 'Ebin Bin A', bin_type: 'Biodegradable', fillLevel: 72, status: 'Active' },
        ],
        wasteLast7Days: [
          { day: 'Mon', kg: 0 }, { day: 'Tue', kg: 0 }, { day: 'Wed', kg: 0 },
          { day: 'Thu', kg: 0 }, { day: 'Fri', kg: 0 }, { day: 'Sat', kg: 0 }, 
          { day: 'Sun', kg: 0 }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 60000);
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

  if (loading && !data) {
    return (
      <div className="do-container">
        <div className="do-card do-card-full">
          <div className="do-loading">
            <span className="do-loading-dot" />
            <span className="do-loading-dot" />
            <span className="do-loading-dot" />
            <p>Loading dashboard data...</p>
          </div>
        </div>
      </div>
    );
  }

  const bins = data?.bins ?? [];
  const trend = data?.wasteLast7Days ?? [];

  return (
    <div className="do-container">
      
      {lastSync && (
        <div className="do-sync-info">
          <span className="do-sync-label">Last sync:</span>
          <span className="do-sync-time">{lastSync}</span>
        </div>
      )}

      {/* ── Waste trend ── */}
      <div className="do-card do-card-full">
        <p className="do-card-title">Waste trend — last 7 days</p>
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
            <p>No bins require immediate collection (threshold: 75%)</p>
            {bins.map((bin, idx) => (
              <div key={idx} className="do-priority-row" style={{ marginTop: '10px' }}>
                <div className="do-priority-left">
                  <span className="do-priority-name">{bin.bin_name}</span>
                  <span className="do-priority-type">{bin.bin_type}</span>
                </div>
                <div className="do-priority-center">
                  <div className="do-fill-bar-bg">
                    <div
                      className="do-fill-bar-fill"
                      style={{
                        width: `${bin.fillLevel}%`,
                        background: getFillBarColor(bin.fillLevel),
                      }}
                    />
                  </div>
                </div>
                <div className="do-priority-right">
                  <span className="do-fill-pct">{bin.fillLevel}%</span>
                  <span className="do-status-tag" style={{
                    background: `${getStatusColor('Active')}18`,
                    color: getStatusColor('Active'),
                  }}>Active</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="do-priority-list">
            {priorityBins.map((bin, i) => {
              const status = bin.status || getBinStatus(bin.fillLevel ?? 0);
              return (
                <div key={bin._id ?? bin.id ?? i} className="do-priority-row">
                  <div className="do-priority-left">
                    <span className="do-priority-dot" style={{ background: getFillBarColor(bin.fillLevel ?? 0) }} />
                    <span className="do-priority-name">{bin.bin_name ?? `Bin ${i + 1}`}</span>
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