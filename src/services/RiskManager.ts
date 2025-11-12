import { createModuleLogger } from '../utils/logger';
import { RiskLimitExceededError } from '../utils/errors';
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

  async checkRiskLimits(
    signal: TradingViewSignal,
    calculatedQuantity: number
  ): Promise<RiskCheckResult> {
    try {
      logger.info('Checking risk limits', { signal, calculatedQuantity });

      // Check if trading is enabled
      if (!config.trading.enabled) {
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
      if (positionSizePercent > config.trading.maxPositionSizePercent) {
        return {
          allowed: false,
          reason: `Position size ${positionSizePercent.toFixed(2)}% exceeds max ${
            config.trading.maxPositionSizePercent
          }%`,
        };
      }

      // Check total exposure
      const currentExposure = await this.getCurrentExposure();
      const totalExposure = currentExposure + orderValue;
      const exposurePercent = (totalExposure / availableBalance) * 100;

      if (exposurePercent > config.trading.maxTotalExposurePercent) {
        return {
          allowed: false,
          reason: `Total exposure ${exposurePercent.toFixed(2)}% exceeds max ${
            config.trading.maxTotalExposurePercent
          }%`,
        };
      }

      // Check daily loss limit
      const dailyLoss = await this.getDailyLoss();
      if (Math.abs(dailyLoss) > config.trading.maxDailyLoss) {
        return {
          allowed: false,
          reason: `Daily loss $${Math.abs(dailyLoss).toFixed(2)} exceeds max $${
            config.trading.maxDailyLoss
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
