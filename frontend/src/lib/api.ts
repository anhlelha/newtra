import axios from 'axios';
import type {
  Position,
  Order,
  SystemStatus,
  HealthStatus,
  Balance,
  Strategy,
  PendingSignal,
  CreateStrategyInput,
  RiskConfig,
  UpdateRiskConfigInput,
  UpdateStrategyInput,
} from '../types';

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

  // Signals
  getSignals: async (limit: number = 20): Promise<any[]> => {
    const { data } = await api.get('/signals', { params: { limit } });
    return data;
  },

  // Strategies
  getStrategies: async (): Promise<Strategy[]> => {
    const { data } = await api.get('/strategies');
    return data;
  },

  getStrategy: async (id: string): Promise<Strategy> => {
    const { data } = await api.get(`/strategies/${id}`);
    return data;
  },

  createStrategy: async (input: CreateStrategyInput): Promise<Strategy> => {
    const { data } = await api.post('/strategies', input);
    return data;
  },

  updateStrategy: async (id: string, input: UpdateStrategyInput): Promise<Strategy> => {
    const { data } = await api.put(`/strategies/${id}`, input);
    return data;
  },

  deleteStrategy: async (id: string): Promise<void> => {
    await api.delete(`/strategies/${id}`);
  },

  toggleStrategy: async (id: string): Promise<Strategy> => {
    const { data } = await api.post(`/strategies/${id}/toggle`);
    return data;
  },

  // Pending Signals
  getPendingSignals: async (params?: {
    status?: 'pending' | 'approved' | 'rejected';
    strategyId?: string;
  }): Promise<PendingSignal[]> => {
    const { data } = await api.get('/pending-signals', { params });
    return data;
  },

  getPendingSignalsCount: async (): Promise<{ count: number }> => {
    const { data } = await api.get('/pending-signals/count');
    return data;
  },

  approvePendingSignal: async (id: string): Promise<PendingSignal> => {
    const { data } = await api.post(`/pending-signals/${id}/approve`);
    return data;
  },

  rejectPendingSignal: async (id: string): Promise<PendingSignal> => {
    const { data} = await api.post(`/pending-signals/${id}/reject`);
    return data;
  },

  // Risk Config
  getRiskConfig: async (): Promise<RiskConfig> => {
    const { data } = await api.get('/risk-config');
    return data;
  },

  updateRiskConfig: async (config: UpdateRiskConfigInput): Promise<{ success: boolean; message: string; updates: any }> => {
    const { data } = await api.put('/risk-config', config);
    return data;
  },
};

export default api;
