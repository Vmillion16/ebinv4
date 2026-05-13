import React, { useState } from 'react';
import axios from 'axios';
import { FaEye, FaEyeSlash, FaEnvelope, FaKey, FaLock, FaRecycle} from 'react-icons/fa';
import '../index.css';

const ForgotPassword = () => {
  const [step, setStep] = useState(1);

  const [formData, setFormData] = useState({
    email: '',
    otp: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handleChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess('');
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();

    if (!formData.email.trim()) {
      setError('Email is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await axios.post('http://localhost:5000/api/forgot-password', {
        email: formData.email.trim()
      });

      setSuccess('OTP has been sent to your Gmail');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    if (!formData.otp.trim()) {
      setError('OTP code is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await axios.post('http://localhost:5000/api/verify-otp', {
        email: formData.email.trim(),
        otp: formData.otp.trim()
      });

      setSuccess('OTP verified successfully');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (!formData.newPassword || !formData.confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (formData.newPassword !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      await axios.post('http://localhost:5000/api/reset-password', {
        email: formData.email.trim(),
        otp: formData.otp.trim(),
        newPassword: formData.newPassword
      });

      setSuccess('Password reset successfully');

      setTimeout(() => {
        window.location.href = '/login';
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const getStepTitle = () => {
    if (step === 1) return 'Recover Account';
    if (step === 2) return 'Verify Security Code';
    return 'Set New Password';
  };

  const getStepDescription = () => {
    if (step === 1) return 'Secure access to the E-Bin waste segregation monitoring system';
    if (step === 2) return 'Enter the OTP sent to your registered email';
    return 'Create a secure password for system access';
  };

  return (
    <div className="forgot-page">
      <div className="bg-circle bg-circle-1"></div>
      <div className="bg-circle bg-circle-2"></div>
      <div className="bg-circle bg-circle-3"></div>

      <div className="forgot-card">
        <div className="eco-badge">
          <FaRecycle />
        </div>

        <div className="forgot-header">
          <h2>E-Bin System</h2>
          <h3>{getStepTitle()}</h3>
          <span className="forgot-description">{getStepDescription()}</span>
        </div>

        <div className="step-indicator">
          <div className={`step-dot ${step >= 1 ? 'active' : ''}`}></div>
          <div className={`step-dot ${step >= 2 ? 'active' : ''}`}></div>
          <div className={`step-dot ${step >= 3 ? 'active' : ''}`}></div>
        </div>

        {step === 1 && (
          <form onSubmit={handleSendOtp} className="forgot-form fade-in-up">
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

            {error && <div className="message error">{error}</div>}
            {success && <div className="message success">{success}</div>}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Sending OTP...' : 'Send OTP'}
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="forgot-form fade-in-up">
            <div className="form-group">
              <label>Email / Gmail</label>
              <div className="input-wrapper">
                <FaEnvelope className="input-icon left-icon" />
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="disabled-input"
                />
              </div>
            </div>

            <div className="form-group">
              <label>OTP Code</label>
              <div className="input-wrapper">
                <FaKey className="input-icon left-icon" />
                <input
                  type="text"
                  placeholder="Enter OTP code"
                  value={formData.otp}
                  onChange={(e) => handleChange('otp', e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <div className="message error">{error}</div>}
            {success && <div className="message success">{success}</div>}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify OTP'}
            </button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleResetPassword} className="forgot-form fade-in-up">
            <div className="form-group">
              <label>New Password</label>
              <div className="input-wrapper">
                <FaLock className="input-icon left-icon" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="Enter new password"
                  value={formData.newPassword}
                  onChange={(e) => handleChange('newPassword', e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Confirm New Password</label>
              <div className="input-wrapper">
                <FaLock className="input-icon left-icon" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleChange('confirmPassword', e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {error && <div className="message error">{error}</div>}
            {success && <div className="message success">{success}</div>}

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </form>
        )}

        <div className="bottom-links">
          <p>
            Remembered your password?{' '}
            <span
              className="link-text"
              onClick={() => (window.location.href = '/login')}
            >
              Sign In
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;