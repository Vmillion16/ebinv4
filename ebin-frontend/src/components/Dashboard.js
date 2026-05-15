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
import API_URL from '../config';  // ← This is imported as API_URL

const Dashboard = ({ user, onLogout }) => {
  const [activeTab,        setActiveTab]        = useState('overview');
  const [dashboardData,    setDashboardData]    = useState(null);
  const [bins,             setBins]             = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [binsLoading,      setBinsLoading]      = useState(true);

  const token = localStorage.getItem('token');

  const fetchDashboard = async () => {
  try {
    const token = localStorage.getItem('token');
    console.log('Token being sent:', token ? 'Yes (length: ' + token.length + ')' : 'NO TOKEN!');
    
    if (!token) {
      console.error('No token found! Redirecting to login...');
      window.location.href = '/login';
      return;
    }

    const res = await axios.get(`${API_URL}/dashboard`, {
      headers: { 
        'Authorization': `Bearer ${token}`  // Make sure format is exactly this
      }
    });
    setDashboardData(res.data);
  } catch (err) {
    console.error('Failed to fetch dashboard:', err);
    if (err.response?.status === 401) {
      console.log('Token invalid or expired, redirecting to login');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
  } finally {
    setDashboardLoading(false);
  }
};

  const fetchBins = async () => {
    try {
      // FIXED: Changed API_BASE to API_URL
      const res = await axios.get(`${API_URL}/bins`, {
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
      // FIXED: Changed API_BASE to API_URL
      await axios.put(
        `${API_URL}/bins/${binId}/reset`,
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
        return <BinMonitoring bins={bins} isLoading={binsLoading} />;

      case 'segregation':
        return <WasteSegregation />;

      case 'reports':
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