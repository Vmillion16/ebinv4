import React from 'react';
import { 
  FaTachometerAlt, FaTrash, FaBell, FaRecycle, FaChartBar, FaCog, FaSignOutAlt 
} from 'react-icons/fa';

const Sidebar = ({ activeTab, setActiveTab, user, onLogout }) => {
  const menuItems = [
    { id: 'overview', label: 'Overview', icon: FaTachometerAlt },
    { id: 'bins', label: 'Bin Monitoring', icon: FaTrash },
    { id: 'alerts', label: 'Alerts', icon: FaBell },
    { id: 'segregation', label: 'Waste Segregation', icon: FaRecycle },
    { id: 'reports', label: 'Reports', icon: FaChartBar },
    { id: 'settings', label: 'Settings', icon: FaCog }
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h3>E-Bin</h3>
        <p>Pambayang Dalubhasaan ng Marilao</p>
      </div>
      
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon className="nav-icon" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          <FaSignOutAlt />
          Logout
        </button>
      </div>
    </div>
  );
};

export default Sidebar;