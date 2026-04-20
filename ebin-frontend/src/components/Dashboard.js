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

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState(null);
  const [bins, setBins] = useState([]);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [binsLoading, setBinsLoading] = useState(true);

  const token = localStorage.getItem('token');

  const fetchDashboard = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setDashboardData(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setDashboardLoading(false);
    }
  };

  const fetchBins = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/bins', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      setBins(response.data);
    } catch (error) {
      console.error('Failed to fetch bins:', error);
    } finally {
      setBinsLoading(false);
    }
  };

  const handleResetBin = async (binId) => {
    try {
      await axios.put(
        `http://localhost:5000/api/bins/${binId}/reset`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      alert('Bin reset successfully!');
      fetchBins();
      fetchDashboard();
    } catch (error) {
      console.error('Failed to reset bin:', error);
      alert('Failed to reset bin');
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchBins();
  }, []);

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
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          user={user}
          onLogout={onLogout}
        />
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
        return (
          <BinMonitoring
            bins={bins}
            onResetBin={handleResetBin}
            isLoading={binsLoading}
            refetch={fetchBins}
          />
        );

      case 'segregation':
        return <WasteSegregation bins={bins} />;

      case 'reports':
        return <Reports reports={[]} />;

      case 'settings':
        return <Settings />;

      case 'collectionreward':         // ✅ FIXED
        return <CollectionReward />;

      case 'maintenance':              // ✅ FIXED
        return <Maintenance />;

      default:
        return <DashboardOverview data={dashboardData} />;
    }
  };

  return (
    <div className="dashboard">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={onLogout}
      />

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