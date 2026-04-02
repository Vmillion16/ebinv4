import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import DashboardOverview from './DashboardOverview';
import BinMonitoring from './BinMonitoring';
import Alerts from './Alerts';
import WasteSegregation from './WasteSegregation';
import Reports from './Reports';
import Settings from './Settings';

const Dashboard = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboardData, setDashboardData] = useState({});
  const [bins, setBins] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);

  const fetchData = async () => {
    try {
      const config = {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      };
      
      const [dashboardRes, binsRes, alertsRes, reportsRes] = await Promise.all([
        axios.get('http://localhost:5000/api/dashboard', config),
        axios.get('http://localhost:5000/api/bins', config),
        axios.get('http://localhost:5000/api/alerts', config),
        axios.get('http://localhost:5000/api/reports/daily', config)
      ]);
      
      setDashboardData(dashboardRes.data);
      setBins(binsRes.data);
      setAlerts(alertsRes.data);
      setReports(reportsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const markAlertRead = async (alertId) => {
    try {
      await axios.put(`http://localhost:5000/api/alerts/${alertId}/read`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setAlerts(alerts.filter(alert => alert.alert_id !== alertId));
    } catch (error) {
      console.error('Error marking alert as read');
    }
  };

  const resetBin = async (binId) => {
    try {
      await axios.put(`http://localhost:5000/api/bins/${binId}/reset`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      fetchData(); // Refresh data
    } catch (error) {
      console.error('Error resetting bin');
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'overview':
        return <DashboardOverview data={dashboardData} />;
      case 'bins':
        return <BinMonitoring bins={bins} onResetBin={resetBin} />;
      case 'alerts':
        return <Alerts alerts={alerts} onMarkRead={markAlertRead} />;
      case 'segregation':
        return <WasteSegregation bins={bins} />;
      case 'reports':
        return <Reports reports={reports} />;
      case 'settings':
        return <Settings />;
      default:
        return <DashboardOverview data={dashboardData} />;
    }
  };

  return (
    <div className="dashboard">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={onLogout} />
      <div className="main-content">
        <header className="header">
          <h1>E-Bin Dashboard</h1>
          <div className="user-info">
            <span>{user?.fullName}</span>
            <span className="role">{user?.role}</span>
          </div>
        </header>
        <main>{renderContent()}</main>
      </div>
    </div>
  );
};

export default Dashboard;