import React, { useState } from 'react';
import axios from 'axios';
import {
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaLock,
  FaUser,
  FaRecycle,
} from 'react-icons/fa';
import '../index.css';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (
      !formData.username.trim() ||
      !formData.email.trim() ||
      !formData.password ||
      !formData.confirmPassword
    ) {
      setError('All fields are required');
      return;
    }

    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await axios.post('http://localhost:5000/api/register', {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password
      });

      setSuccess('Registered successfully');

      setTimeout(() => {
        window.location.href = '/login';
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="bg-circle bg-circle-1"></div>
      <div className="bg-circle bg-circle-2"></div>
      <div className="bg-circle bg-circle-3"></div>

      <div className="register-card">
        <div className="eco-badge">
          <FaRecycle />
        </div>

        <div className="register-header">
          <h2>E-Bin System</h2>
          <h3>Create an Account</h3>
          <span className="register-description">
            Register to access the waste segregation monitoring system
          </span>
        </div>

        <form onSubmit={handleSubmit} className="register-form fade-in-up">
          <div className="form-group">
            <label>Username</label>
            <div className="input-wrapper">
              <FaUser className="input-icon left-icon" />
              <input
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={(e) => handleChange('username', e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email / Gmail</label>
            <div className="input-wrapper">
              <FaEnvelope className="input-icon left-icon" />
              <input
                type="email"
                placeholder="Enter your Gmail"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
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
                placeholder="Enter password"
                value={formData.password}
                onChange={(e) => handleChange('password', e.target.value)}
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

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-wrapper">
              <FaLock className="input-icon left-icon" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm password"
                value={formData.confirmPassword}
                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                required
              />
              <button
                type="button"
                className="eye-btn"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
              >
                {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
              </button>
            </div>
          </div>

          {error && <div className="message error">{error}</div>}
          {success && <div className="message success">{success}</div>}

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="bottom-links">
          <p>
            Already have an account?{' '}
            <span
              className="link-text"
              onClick={() => {
                window.location.href = '/login';
              }}
            >
              Login
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;