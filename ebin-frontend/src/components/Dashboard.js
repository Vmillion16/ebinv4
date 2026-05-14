import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import DashboardOverview from './DashboardOverview';
import BinMonitoring from './BinMonitoring';
import WasteSegregation from './WasteSegregation';
import Reports from './Reports';
import Settings from './Settings';
import CollectionReward from './CollectionReward';
import Maintenance from './Maintenance';

// FIX: append /api once here so every route is correct
const API_BASE = (import.meta.env.VITE_API_URL || 'https://ebinv4-1.onrender.com') + '/api';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab,        setActiveTab]        = useState('overview');
  const [dashboardData,    setDashboardData]    = useState(null);
  const [bins,             setBins]             = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [binsLoading,      setBinsLoading]      = useState(true);

  const token = localStorage.getItem('token');

  const fetchDashboard = async () => {
    try {
      const res = await axios.get(`${API_BASE}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDashboardData(res.data);
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchBins = async () => {
    try {
      const res = await axios.get(`${API_BASE}/bins`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBins(res.data);
    } catch (err) {
      console.error('Failed to fetch bins:', err);
    } finally {
      setBinsLoading(false);
    }
  };

  const handleResetBin = async (binId) => {
    try {
      await axios.put(
        `${API_BASE}/bins/${binId}/reset`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchBins();
      fetchDashboard();
    } catch (err) {
      console.error('Failed to reset bin:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboard();
    fetchBins();
  }, []);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboard();
      fetchBins();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  if (dashboardLoading) {
    return (
      <div className="dashboard">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={onLogout} />
        <div className="main-content" style={{ padding: '20px' }}>
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <DashboardOverview data={dashboardData} />;

      case 'bins':
        // FIX: removed unused onResetBin and refetch props
        return <BinMonitoring bins={bins} isLoading={binsLoading} />;

      case 'segregation':
        // FIX: WasteSegregation fetches its own data — no props needed
        return <WasteSegregation />;

      case 'reports':
        // FIX: Reports fetches its own data — no props needed
        return <Reports />;

      case 'settings':
        return <Settings />;

      case 'collectionreward':
        return <CollectionReward />;

      case 'maintenance':
        return <Maintenance />;

      default:
        return <DashboardOverview data={dashboardData} />;
    }
  };

  return (
    <div className="dashboard">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={onLogout} />

      <div className="main-content">
        <header className="header">
          <div className="header-left">
            <h1>E-Bin Dashboard</h1>
            <span className="last-sync">
              Last sync: {new Date().toLocaleTimeString()}
            </span>
          </div>
          <div className="user-info">
            <span className="user-name">{user?.fullName}</span>
            <span className={`role-badge role-${user?.role?.toLowerCase().replace(/\s+/g, '-')}`}>
              {user?.role}
            </span>
          </div>
        </header>

        <main className="content">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;