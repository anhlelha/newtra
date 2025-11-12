import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

interface AppConfig {
  server: {
    port: number;
    nodeEnv: string;
  };
  binance: {
    apiKey: string;
    apiSecret: string;
    testnet: boolean;
  };
  tradingView: {
    webhookSecret: string;
  };
  trading: {
    enabled: boolean;
    defaultPositionSizePercent: number;
    maxPositionSizePercent: number;
    maxTotalExposurePercent: number;
    maxDailyLoss: number;
    enableStopLoss: boolean;
    defaultStopLossPercent: number;
    preventDuplicatesWindowMs: number;
  };
  security: {
    adminApiKey: string;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
  logging: {
    level: string;
    file: string;
  };
  database: {
    path: string;
  };
}

const getEnv = (key: string, defaultValue?: string): string => {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Environment variable ${key} is required but not set`);
  }
  return value;
};

const config: AppConfig = {
  server: {
    port: parseInt(getEnv('PORT', '3000'), 10),
    nodeEnv: getEnv('NODE_ENV', 'development'),
  },
  binance: {
    apiKey: getEnv('BINANCE_API_KEY'),
    apiSecret: getEnv('BINANCE_API_SECRET'),
    testnet: getEnv('BINANCE_TESTNET', 'false') === 'true',
  },
  tradingView: {
    webhookSecret: getEnv('TRADINGVIEW_WEBHOOK_SECRET'),
  },
  trading: {
    enabled: getEnv('TRADING_ENABLED', 'true') === 'true',
    defaultPositionSizePercent: parseFloat(getEnv('DEFAULT_POSITION_SIZE_PERCENT', '2')),
    maxPositionSizePercent: parseFloat(getEnv('MAX_POSITION_SIZE_PERCENT', '5')),
    maxTotalExposurePercent: parseFloat(getEnv('MAX_TOTAL_EXPOSURE_PERCENT', '50')),
    maxDailyLoss: parseFloat(getEnv('MAX_DAILY_LOSS', '1000')),
    enableStopLoss: getEnv('ENABLE_STOP_LOSS', 'true') === 'true',
    defaultStopLossPercent: parseFloat(getEnv('DEFAULT_STOP_LOSS_PERCENT', '2')),
    preventDuplicatesWindowMs: parseInt(getEnv('PREVENT_DUPLICATES_WINDOW_MS', '30000'), 10),
  },
  security: {
    adminApiKey: getEnv('ADMIN_API_KEY'),
    rateLimitWindowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
    rateLimitMaxRequests: parseInt(getEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
  },
  logging: {
    level: getEnv('LOG_LEVEL', 'info'),
    file: getEnv('LOG_FILE', path.join(process.cwd(), 'logs', 'app.log')),
  },
  database: {
    path: getEnv('DATABASE_PATH', path.join(process.cwd(), 'data', 'database.sqlite')),
  },
};

export default config;
