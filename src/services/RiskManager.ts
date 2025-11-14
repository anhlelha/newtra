import { createModuleLogger } from '../utils/logger';
import { TradingViewSignal } from '../api/schemas/webhook.schema';
import { BinanceClient } from './binance/BinanceClient';
import databaseService from '../database';
import config from '../config';

const logger = createModuleLogger('RiskManager');

export interface RiskCheckResult {
  allowed: boolean;
  reason?: string;
  calculatedQuantity?: number;
}

export class RiskManager {
  constructor(private binanceClient: BinanceClient) {}

  /**
   * Get current risk configuration from database
   */
  private getRiskConfig() {
    const db = databaseService.getDatabase();

    const getConfigValue = (key: string, defaultValue: any) => {
      const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key) as { value: string } | undefined;
      if (!row) return defaultValue;

      // Try to parse as JSON first (for boolean/number values stored as JSON)
      try {
        return JSON.parse(row.value);
      } catch {
        // If not JSON, return as-is and let caller parse
        return row.value;
      }
    };

    const enabled = getConfigValue('trading.enabled', config.trading.enabled);

    return {
      enabled: typeof enabled === 'boolean' ? enabled : enabled === 'true',
      maxPositionSizePercent: parseFloat(getConfigValue('trading.maxPositionSizePercent', config.trading.maxPositionSizePercent)),
      maxTotalExposurePercent: parseFloat(getConfigValue('trading.maxTotalExposurePercent', config.trading.maxTotalExposurePercent)),
      maxDailyLoss: parseFloat(getConfigValue('trading.maxDailyLoss', config.trading.maxDailyLoss)),
    };
  }

  async checkRiskLimits(
    signal: TradingViewSignal,
    calculatedQuantity: number
  ): Promise<RiskCheckResult> {
    try {
      logger.info('Checking risk limits', { signal, calculatedQuantity });

      // Get current risk config from database
      const riskConfig = this.getRiskConfig();

      // Check if trading is enabled
      if (!riskConfig.enabled) {
        return {
          allowed: false,
          reason: 'Trading is disabled',
        };
      }

      // Get current price
      const currentPrice = await this.binanceClient.getPrice(signal.symbol);

      // Calculate order value
      const orderValue = calculatedQuantity * currentPrice;

      // Get account balance
      const quoteAsset = this.getQuoteAsset(signal.symbol);
      const balance = await this.binanceClient.getBalance(quoteAsset);
      const availableBalance = parseFloat(balance.free);

      // Check position size limit
      const positionSizePercent = (orderValue / availableBalance) * 100;
      if (positionSizePercent > riskConfig.maxPositionSizePercent) {
        return {
          allowed: false,
          reason: `Position size ${positionSizePercent.toFixed(2)}% exceeds max ${
            riskConfig.maxPositionSizePercent
          }%`,
        };
      }

      // Check total exposure
      const currentExposure = await this.getCurrentExposure();
      const totalExposure = currentExposure + orderValue;
      const exposurePercent = (totalExposure / availableBalance) * 100;

      if (exposurePercent > riskConfig.maxTotalExposurePercent) {
        return {
          allowed: false,
          reason: `Total exposure ${exposurePercent.toFixed(2)}% exceeds max ${
            riskConfig.maxTotalExposurePercent
          }%`,
        };
      }

      // Check daily loss limit
      const dailyLoss = await this.getDailyLoss();
      if (Math.abs(dailyLoss) > riskConfig.maxDailyLoss) {
        return {
          allowed: false,
          reason: `Daily loss $${Math.abs(dailyLoss).toFixed(2)} exceeds max $${
            riskConfig.maxDailyLoss
          }`,
        };
      }

      // Check sufficient balance
      if (orderValue > availableBalance) {
        return {
          allowed: false,
          reason: `Insufficient balance. Required: ${orderValue.toFixed(2)}, Available: ${availableBalance.toFixed(2)}`,
        };
      }

      logger.info('Risk check passed', {
        positionSizePercent: positionSizePercent.toFixed(2),
        exposurePercent: exposurePercent.toFixed(2),
        dailyLoss: dailyLoss.toFixed(2),
      });

      return {
        allowed: true,
        calculatedQuantity,
      };
    } catch (error) {
      logger.error('Risk check failed', { error });
      throw error;
    }
  }

  async calculatePositionSize(signal: TradingViewSignal): Promise<number> {
    try {
      // If quantity is provided in signal, use it
      if (signal.quantity) {
        logger.info('Using quantity from signal', { quantity: signal.quantity });
        return signal.quantity;
      }

      // Otherwise, calculate based on position size percentage
      const quoteAsset = this.getQuoteAsset(signal.symbol);
      const balance = await this.binanceClient.getBalance(quoteAsset);
      const availableBalance = parseFloat(balance.free);

      const currentPrice = await this.binanceClient.getPrice(signal.symbol);

      // Calculate quantity based on default position size percentage
      const positionValue =
        (availableBalance * config.trading.defaultPositionSizePercent) / 100;
      const quantity = positionValue / currentPrice;

      // Round to appropriate precision (8 decimal places for crypto)
      const roundedQuantity = Math.floor(quantity * 100000000) / 100000000;

      logger.info('Calculated position size', {
        availableBalance,
        positionValue,
        currentPrice,
        quantity: roundedQuantity,
      });

      return roundedQuantity;
    } catch (error) {
      logger.error('Failed to calculate position size', { error });
      throw error;
    }
  }

  async getCurrentExposure(): Promise<number> {
    const db = databaseService.getDatabase();

    const stmt = db.prepare(`
      SELECT
        p.symbol,
        p.quantity,
        p.entry_price
      FROM positions p
      WHERE p.status = 'OPEN'
    `);

    const positions = stmt.all() as Array<{
      symbol: string;
      quantity: number;
      entry_price: number;
    }>;

    let totalExposure = 0;

    for (const position of positions) {
      try {
        const currentPrice = await this.binanceClient.getPrice(position.symbol);
        const positionValue = position.quantity * currentPrice;
        totalExposure += positionValue;
      } catch (error) {
        logger.warn(`Failed to get price for ${position.symbol}`, { error });
      }
    }

    return totalExposure;
  }

  async getDailyLoss(): Promise<number> {
    const db = databaseService.getDatabase();

    const stmt = db.prepare(`
      SELECT COALESCE(SUM(realized_pnl), 0) as total_pnl
      FROM positions
      WHERE DATE(closed_at) = DATE('now')
    `);

    const result = stmt.get() as { total_pnl: number };
    return result.total_pnl || 0;
  }

  private getQuoteAsset(symbol: string): string {
    // Common quote assets
    if (symbol.endsWith('USDT')) return 'USDT';
    if (symbol.endsWith('BUSD')) return 'BUSD';
    if (symbol.endsWith('BTC')) return 'BTC';
    if (symbol.endsWith('ETH')) return 'ETH';
    if (symbol.endsWith('BNB')) return 'BNB';

    // Default to USDT
    return 'USDT';
  }

  shouldAllowTrade(): boolean {
    return config.trading.enabled;
  }
}
