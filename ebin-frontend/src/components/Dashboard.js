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
import API_URL from '../config';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab,        setActiveTab]        = useState('overview');
  const [dashboardData,    setDashboardData]    = useState(null);
  const [bins,             setBins]             = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [binsLoading,      setBinsLoading]      = useState(true);

  const token = localStorage.getItem('token');

  // Fetch dashboard data using public endpoint (no auth required)
  const fetchDashboard = async () => {
    try {
      setDashboardLoading(true);
      
      // Use public dashboard endpoint - no authentication needed!
      const response = await fetch(`${API_URL}/bins/public/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Dashboard data fetched successfully:', data);
        setDashboardData(data);
      } else {
        console.error('Failed to fetch dashboard data:', response.status);
        // Fallback to empty data structure
        setDashboardData({
          bins: [],
          wasteLast7Days: [],
          totalBins: 0,
          fullBins: 0,
          activeAlerts: 0
        });
      }
    } catch (err) {
      console.error('Failed to fetch dashboard:', err);
      setDashboardData({
        bins: [],
        wasteLast7Days: [],
        totalBins: 0,
        fullBins: 0,
        activeAlerts: 0
      });
    } finally {
      setDashboardLoading(false);
    }
  };

  // Fetch bins data using public endpoint
  const fetchBins = async () => {
    try {
      setBinsLoading(true);
      
      // Use public dashboard endpoint to get bin data
      const response = await fetch(`${API_URL}/bins/public/dashboard`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Bins data fetched successfully:', data.bins);
        setBins(data.bins || []);
      } else {
        console.error('Failed to fetch bins data:', response.status);
        setBins([]);
      }
    } catch (err) {
      console.error('Failed to fetch bins:', err);
      setBins([]);
    } finally {
      setBinsLoading(false);
    }
  };

  const handleResetBin = async (binId) => {
    try {
      // This still needs authentication since it's an admin action
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
          <h2>Loading dashboard...</h2>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <DashboardOverview data={dashboardData} />;

      case 'bins':
        return <BinMonitoring bins={bins} isLoading={binsLoading} onResetBin={handleResetBin} />;

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
            <span className="user-name">{user?.fullName || user?.name || 'User'}</span>
            <span className={`role-badge role-${user?.role?.toLowerCase().replace(/\s+/g, '-') || 'user'}`}>
              {user?.role || 'User'}
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