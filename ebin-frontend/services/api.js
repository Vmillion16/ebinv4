import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth endpoints
export const authAPI = {
  register: (userData) => api.post('/auth/register', userData),
  login: (credentials) => api.post('/auth/login', credentials),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
};

// Bin endpoints
export const binAPI = {
  getAllBins: () => api.get('/bins'),
  getBinById: (id) => api.get(`/bins/${id}`),
  updateBinStatus: (id, data) => api.patch(`/bins/${id}/status`, data),
  getNearbyBins: (lat, lng, radius) => api.get(`/bins/nearby/${lat}/${lng}/${radius}`),
};

// Waste endpoints
export const wasteAPI = {
  disposeWaste: (data) => api.post('/waste/dispose', data),
  getWasteHistory: () => api.get('/waste/history'),
};

// Maintenance endpoints
export const maintenanceAPI = {
  createRequest: (data) => api.post('/maintenance/requests', data),
  getRequests: (params) => api.get('/maintenance/requests', { params }),
  updateRequestStatus: (id, data) => api.patch(`/maintenance/requests/${id}/status`, data),
};

// Reward endpoints
export const rewardAPI = {
  getMyRewards: () => api.get('/rewards/my-rewards'),
  redeemPoints: (data) => api.post('/rewards/redeem', data),
};

// User endpoints
export const userAPI = {
  getProfile: () => api.get('/users/profile'),
  updateProfile: (data) => api.put('/users/profile', data),
  getAllUsers: () => api.get('/users'),
};

// Settings endpoints
export const settingsAPI = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data),
};

// Report endpoints
export const reportAPI = {
  getWasteStats: (params) => api.get('/reports/waste-stats', { params }),
  getBinPerformance: () => api.get('/reports/bin-performance'),
};

export default api;