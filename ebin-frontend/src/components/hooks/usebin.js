import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useAuth } from '../context/AuthContext'; // Your auth context

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const useBins = (filters = {}) => {
  const { token } = useAuth();
  
  return useQuery({
    queryKey: ['bins', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters).toString();
      const { data } = await axios.get(`${API_BASE}/bins?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return data;
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useDashboard = () => {
  const { token } = useAuth();
  
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => {
      const { data } = await axios.get(`${API_BASE}/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
  });
};

export const useResetBin = () => {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  
  return useMutation({
    mutationFn: async (binId) => {
      const { data } = await axios.put(
        `${API_BASE}/bins/${binId}/reset`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bins']);
      queryClient.invalidateQueries(['dashboard']);
    },
  });
};

export const useBulkReset = () => {
  const queryClient = useQueryClient();
  const { token } = useAuth();
  
  return useMutation({
    mutationFn: async (binIds) => {
      const { data } = await axios.put(
        `${API_BASE}/bins/bulk-reset`,
        { binIds },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['bins']);
      queryClient.invalidateQueries(['dashboard']);
    },
  });
};


