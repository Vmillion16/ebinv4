import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Register from './components/Register';
import ForgotPassword from './components/ForgotPassword';
import UserManagement from './components/Usermanagement';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (token) {
      setIsAuthenticated(true);
    }

    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/login"
            element={
              !isAuthenticated ? (
                <Login onLogin={handleLogin} />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />

          <Route
            path="/register"
            element={
              !isAuthenticated ? (
                <Register />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />

          <Route
            path="/forgot-password"
            element={
              !isAuthenticated ? (
                <ForgotPassword />
              ) : (
                <Navigate to="/dashboard" />
              )
            }
          />

          <Route
            path="/dashboard/*"
            element={
              isAuthenticated ? (
                <Dashboard user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/login" />
              )
            }
          />

          <Route
            path="/usermanagement"
            element={
              isAuthenticated ? (
                <UserManagement />
              ) : (
                <Navigate to="/login" />
              )
            }
          />

          {/* ✅ REMOVED: /collection-reward and /maintenance orphan routes
              These are now handled inside Dashboard via activeTab switch */}

          <Route
            path="/"
            element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />}
          />

          <Route
            path="*"
            element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />}
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;