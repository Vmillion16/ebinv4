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

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!credentials.username.trim() || !credentials.password) {
      setError('All fields are required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const response = await axios.post(`${API_URL}/api/login`, {
        username: credentials.username.trim(),
        password: credentials.password
      });

      onLogin(response.data.user, response.data.token);
    } catch (err) {
      console.log('LOGIN ERROR:', err.response?.data || err.message);
      setError(err.response?.data?.error || 'Invalid credentials');
    } finally {
      setLoading(false);
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
            Don’t have an account?{' '}
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