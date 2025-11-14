export interface Balance {
  asset: string;
  free: string;
  locked: string;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  trading_type: 'SPOT' | 'FUTURE';
  leverage?: number;
  entry_price: number;
  quantity: number;
  stop_loss_price?: number;
  stop_loss_order_id?: string;
  entry_order_id: string;
  exit_order_id?: string;
  realized_pnl: number;
  liquidation_price?: number;
  status: 'OPEN' | 'CLOSED';
  opened_at: string;
  closed_at?: string;
  currentPrice?: number;
  unrealizedPnL?: number;
}

export interface Order {
  id: string;
  binance_order_id?: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT';
  trading_type: 'SPOT' | 'FUTURE';
  quantity: number;
  price?: number;
  stop_price?: number;
  status: 'NEW' | 'FILLED' | 'PARTIALLY_FILLED' | 'CANCELED' | 'REJECTED' | 'EXPIRED';
  filled_quantity: number;
  avg_fill_price?: number;
  commission?: number;
  commission_asset?: string;
  signal_data?: string;
  error_message?: string;
  strategy_id?: string | null;
  strategy_name?: string | null;
  risk_passed?: boolean;
  created_at: string;
  updated_at: string;
}

export interface SystemStatus {
  status: 'running' | 'stopped' | 'error';
  tradingEnabled: boolean;
  openPositions: number;
  todayPnL: number;
  currentExposure: number;
  uptime: number;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: boolean;
    binance: boolean;
    disk: boolean;
    memory: boolean;
  };
  system?: {
    memory: {
      free: number;
      total: number;
      usagePercent: string;
    };
    uptime: number;
  };
}

export interface StatCard {
  label: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon: string;
}

export interface Strategy {
  id: string;
  name: string;
  type: 'automatic' | 'manual';
  trading_type: 'SPOT' | 'FUTURE';
  leverage: number;
  description?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PendingSignal {
  id: string;
  strategy_id: string;
  strategy_name?: string;
  signal_id: string;
  symbol: string;
  action: 'buy' | 'sell' | 'close';
  order_type: string;
  price: number | null;
  quantity: number | null;
  signal_data: string;
  status: 'pending' | 'approved' | 'rejected' | 'failed';
  error_message: string | null;
  order_id: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export interface CreateStrategyInput {
  name: string;
  type: 'automatic' | 'manual';
  trading_type?: 'SPOT' | 'FUTURE';
  leverage?: number;
  description?: string;
  enabled?: boolean;
}

export interface UpdateStrategyInput {
  name?: string;
  type?: 'automatic' | 'manual';
  trading_type?: 'SPOT' | 'FUTURE';
  leverage?: number;
  description?: string;
  enabled?: boolean;
}

export interface RiskConfig {
  defaultPositionSizePercent: number;
  maxPositionSizePercent: number;
  maxTotalExposurePercent: number;
  maxDailyLoss: number;
  enableStopLoss: boolean;
  defaultStopLossPercent: number;
  enabled: boolean;
}

export interface UpdateRiskConfigInput {
  defaultPositionSizePercent?: number;
  maxPositionSizePercent?: number;
  maxTotalExposurePercent?: number;
  maxDailyLoss?: number;
  enableStopLoss?: boolean;
  defaultStopLossPercent?: number;
  enabled?: boolean;
}
