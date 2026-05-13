import React, { useEffect, useState } from 'react';
import "./sidebar.css"
import { NavLink } from 'react-router-dom';
import {
  FaTachometerAlt,
  FaTrash,
  FaRecycle,
  FaChartBar,
  FaCog,
  FaSignOutAlt,
  FaGift,
  FaWrench
} from 'react-icons/fa';

const Sidebar = ({ activeTab, setActiveTab, user, onLogout }) => {
  const [showSidebar, setShowSidebar] = useState(false);

  const menuItems = [
    { id: 'overview',         label: 'Overview',            icon: FaTachometerAlt, path: '/dashboard/overview' },
    { id: 'bins',             label: 'Bin Monitoring',      icon: FaTrash,         path: '/dashboard/bins' },
    { id: 'segregation',      label: 'Waste Segregation',   icon: FaRecycle,       path: '/dashboard/segregation' },
    { id: 'reports',          label: 'Reports',             icon: FaChartBar,      path: '/dashboard/reports' },
    { id: 'collectionreward', label: 'Collection & Reward', icon: FaGift,          path: '/dashboard/collectionreward' },
    { id: 'maintenance',      label: 'Maintenance',         icon: FaWrench,        path: '/dashboard/maintenance' },
    { id: 'settings',         label: 'Settings',            icon: FaCog,           path: '/dashboard/settings' },
  ];

  const topItems    = menuItems.slice(0, 3); // Overview, Bin Monitoring, Waste Segregation
  const middleItems = menuItems.slice(3, 6); // Reports, Collection & Reward, Maintenance
  const bottomItems = menuItems.slice(6);    // Settings

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (e.clientX <= 40) {
        setShowSidebar(true);
      } else if (e.clientX > 260) {
        setShowSidebar(false);
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const renderNavItem = (item) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.id}
        to={item.path}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        onClick={() => setActiveTab(item.id)}
      >
        <Icon className="nav-icon" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <div
      className={`sidebar ${showSidebar ? 'show' : ''}`}
      onMouseEnter={() => setShowSidebar(true)}
      onMouseLeave={() => setShowSidebar(false)}
    >
      <div className="sidebar-header">
        <h3>E-Bin</h3>
        <p>Pambayang Dalubhasaan ng Marilao</p>
      </div>

      <nav className="sidebar-nav">
        {topItems.map(renderNavItem)}
        <div className="nav-divider" />
        {middleItems.map(renderNavItem)}
        <div className="nav-divider" />
        {bottomItems.map(renderNavItem)}
      </nav>

      <div className="sidebar-footer">
        <button className="logout-btn" onClick={onLogout}>
          <FaSignOutAlt />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;