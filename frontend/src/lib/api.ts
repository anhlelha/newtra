import axios from 'axios';
import type { Position, Order, SystemStatus, HealthStatus, Balance } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth header to requests
api.interceptors.request.use((config) => {
  if (ADMIN_API_KEY) {
    config.headers.Authorization = `Bearer ${ADMIN_API_KEY}`;
  }
  return config;
});

export const apiClient = {
  // Health check
  health: async (): Promise<HealthStatus> => {
    const { data } = await api.get('/health');
    return data;
  },

  // System status
  getStatus: async (): Promise<SystemStatus> => {
    const { data } = await api.get('/status');
    return data;
  },

  // Positions
  getPositions: async (status: 'OPEN' | 'CLOSED' = 'OPEN'): Promise<Position[]> => {
    const { data } = await api.get('/positions', { params: { status } });
    return data;
  },

  // Orders
  getOrders: async (params?: {
    symbol?: string;
    status?: string;
    limit?: number;
  }): Promise<Order[]> => {
    const { data } = await api.get('/orders', { params });
    return data;
  },

  cancelOrder: async (orderId: string): Promise<void> => {
    await api.post(`/orders/cancel/${orderId}`);
  },

  // Balance
  getBalance: async (asset: string = 'USDT'): Promise<Balance> => {
    const { data } = await api.get('/balance', { params: { asset } });
    return data;
  },

  // Config
  updateConfig: async (config: Record<string, any>): Promise<void> => {
    await api.post('/config', config);
  },
};

export default api;
