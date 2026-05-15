import React, { useState } from 'react';
import axios from 'axios';
import {
  FaEye,
  FaEyeSlash,
  FaUser,
  FaLock,
  FaRecycle,
} from 'react-icons/fa';
import './Login.css';
import API_URL from '../config';

const Login = ({ onLogin }) => {
  const [credentials, setCredentials] = useState({
    username: '',
    password: ''
  });
  
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // In your Login.js handleSubmit function
const handleSubmit = async (e) => {
  e.preventDefault();
  
  try {
    const response = await axios.post(`${API_URL}/login`, {
      username: credentials.username.trim(),
      password: credentials.password
    });

    console.log('Login response:', response.data); // Debug

    if (response.data.token) {
      // IMPORTANT: Save token to localStorage
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      console.log('Token saved:', localStorage.getItem('token')); // Debug
      
      // Call parent callback
      onLogin(response.data.user, response.data.token);
    }
  } catch (err) {
    console.error('Login error:', err);
  }
};

  return (
    <div className="login-page">
      <div className="bg-circle bg-circle-1"></div>
      <div className="bg-circle bg-circle-2"></div>
      <div className="bg-circle bg-circle-3"></div>

      <div className="login-card">
        <div className="eco-badge">
          <FaRecycle />
        </div>

        <div className="login-header">
          <h2>E-Bin System</h2>
          <h3>Welcome Back</h3>
          <span className="login-description">
            Sign in to access the solar-powered waste monitoring dashboard
          </span>
        </div>

        <form onSubmit={handleSubmit} className="login-form fade-in-up">
          <div className="form-group">
            <label>Username</label>
            <div className="input-wrapper">
              <FaUser className="input-icon left-icon" />
              <input
                type="text"
                placeholder="Enter your username"
                value={credentials.username}
                onChange={(e) =>
                  setCredentials({ ...credentials, username: e.target.value })
                }
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-wrapper">
              <FaLock className="input-icon left-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={credentials.password}
                onChange={(e) =>
                  setCredentials({ ...credentials, password: e.target.value })
                }
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {error && <div className="message error">{error}</div>}

          <button
            type="submit"
            className={`submit-btn ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span>
                Signing in...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="bottom-links">
          <p>
            Don't have an account?{' '}
            <span
              className="link-text"
              onClick={() => {
                window.location.href = '/register';
              }}
            >
              Create one
            </span>
          </p>

          <p>
            Forgot password?{' '}
            <span
              className="link-text"
              onClick={() => {
                window.location.href = '/forgot-password';
              }}
            >
              Reset here
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;