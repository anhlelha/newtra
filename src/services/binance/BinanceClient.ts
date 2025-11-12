import Binance from 'binance-api-node';
import { createModuleLogger } from '../../utils/logger';
import { BinanceApiError } from '../../utils/errors';
import {
  BinanceConfig,
  SymbolInfo,
  Balance,
  AccountInfo,
  MarketOrderParams,
  LimitOrderParams,
  StopLossParams,
  Order,
  TickerPrice,
  Stats24hr,
} from './types';

const logger = createModuleLogger('BinanceClient');

export class BinanceClient {
  private client: ReturnType<typeof Binance>;
  private symbolCache: Map<string, SymbolInfo> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  constructor(private config: BinanceConfig) {
    const apiUrl = config.testnet
      ? 'https://testnet.binance.vision'
      : 'https://api.binance.com';

    this.client = Binance({
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      httpBase: apiUrl,
    });

    logger.info('Binance client initialized', {
      testnet: config.testnet,
      apiUrl,
    });
  }

  // ========== Market Data ==========

  async getPrice(symbol: string): Promise<number> {
    try {
      const ticker = await this.retryWithBackoff(() => this.client.prices({ symbol }));
      return parseFloat(ticker[symbol]);
    } catch (error) {
      throw this.handleBinanceError(error, 'getPrice');
    }
  }

  async getSymbolInfo(symbol: string): Promise<SymbolInfo> {
    try {
      // Check cache
      const cached = this.getCachedData(symbol, 3600000); // 1 hour TTL
      if (cached) {
        return cached;
      }

      const exchangeInfo = await this.retryWithBackoff(() => this.client.exchangeInfo());
      const symbolInfo = exchangeInfo.symbols.find((s) => s.symbol === symbol);

      if (!symbolInfo) {
        throw new Error(`Symbol ${symbol} not found`);
      }

      // Cache the result
      this.setCachedData(symbol, symbolInfo as SymbolInfo, 3600000);

      return symbolInfo as SymbolInfo;
    } catch (error) {
      throw this.handleBinanceError(error, 'getSymbolInfo');
    }
  }

  async get24hrStats(symbol: string): Promise<Stats24hr> {
    try {
      const stats = await this.retryWithBackoff(() => this.client.dailyStats({ symbol }));
      return stats as Stats24hr;
    } catch (error) {
      throw this.handleBinanceError(error, 'get24hrStats');
    }
  }

  async getAllPrices(): Promise<TickerPrice[]> {
    try {
      const prices = await this.retryWithBackoff(() => this.client.prices());
      return Object.entries(prices).map(([symbol, price]) => ({
        symbol,
        price,
      }));
    } catch (error) {
      throw this.handleBinanceError(error, 'getAllPrices');
    }
  }

  // ========== Account ==========

  async getAccountInfo(): Promise<AccountInfo> {
    try {
      const account = await this.retryWithBackoff(() => this.client.accountInfo());
      return {
        balances: account.balances,
        canTrade: account.canTrade,
        canWithdraw: account.canWithdraw,
        canDeposit: account.canDeposit,
      };
    } catch (error) {
      throw this.handleBinanceError(error, 'getAccountInfo');
    }
  }

  async getBalance(asset: string): Promise<Balance> {
    try {
      const account = await this.getAccountInfo();
      const balance = account.balances.find((b) => b.asset === asset);

      if (!balance) {
        return {
          asset,
          free: '0',
          locked: '0',
        };
      }

      return balance;
    } catch (error) {
      throw this.handleBinanceError(error, 'getBalance');
    }
  }

  // ========== Orders ==========

  async createMarketOrder(params: MarketOrderParams): Promise<Order> {
    try {
      logger.info('Creating market order', params);

      const order = await this.retryWithBackoff(() =>
        this.client.order({
          symbol: params.symbol,
          side: params.side,
          type: 'MARKET',
          quantity: params.quantity.toString(),
        })
      );

      logger.info('Market order created', {
        orderId: order.orderId,
        symbol: params.symbol,
        status: order.status,
      });

      return this.mapOrder(order);
    } catch (error) {
      logger.error('Failed to create market order', { params, error });
      throw this.handleBinanceError(error, 'createMarketOrder');
    }
  }

  async createLimitOrder(params: LimitOrderParams): Promise<Order> {
    try {
      logger.info('Creating limit order', params);

      const order = await this.retryWithBackoff(() =>
        this.client.order({
          symbol: params.symbol,
          side: params.side,
          type: 'LIMIT',
          quantity: params.quantity.toString(),
          price: params.price.toString(),
          timeInForce: 'GTC',
        })
      );

      logger.info('Limit order created', {
        orderId: order.orderId,
        symbol: params.symbol,
        status: order.status,
      });

      return this.mapOrder(order);
    } catch (error) {
      logger.error('Failed to create limit order', { params, error });
      throw this.handleBinanceError(error, 'createLimitOrder');
    }
  }

  async createStopLossOrder(params: StopLossParams): Promise<Order> {
    try {
      logger.info('Creating stop loss order', params);

      const order = await this.retryWithBackoff(() =>
        this.client.order({
          symbol: params.symbol,
          side: params.side,
          type: 'STOP_LOSS_LIMIT',
          quantity: params.quantity.toString(),
          price: params.stopPrice.toString(),
          stopPrice: params.stopPrice.toString(),
          timeInForce: 'GTC',
        })
      );

      logger.info('Stop loss order created', {
        orderId: order.orderId,
        symbol: params.symbol,
        status: order.status,
      });

      return this.mapOrder(order);
    } catch (error) {
      logger.error('Failed to create stop loss order', { params, error });
      throw this.handleBinanceError(error, 'createStopLossOrder');
    }
  }

  async cancelOrder(symbol: string, orderId: string): Promise<void> {
    try {
      logger.info('Cancelling order', { symbol, orderId });

      await this.retryWithBackoff(() =>
        this.client.cancelOrder({
          symbol,
          orderId: parseInt(orderId, 10),
        })
      );

      logger.info('Order cancelled', { symbol, orderId });
    } catch (error) {
      logger.error('Failed to cancel order', { symbol, orderId, error });
      throw this.handleBinanceError(error, 'cancelOrder');
    }
  }

  async getOrder(symbol: string, orderId: string): Promise<Order> {
    try {
      const order = await this.retryWithBackoff(() =>
        this.client.getOrder({
          symbol,
          orderId: parseInt(orderId, 10),
        })
      );

      return this.mapOrder(order);
    } catch (error) {
      throw this.handleBinanceError(error, 'getOrder');
    }
  }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    try {
      const orders = await this.retryWithBackoff(() =>
        this.client.openOrders(symbol ? { symbol } : {})
      );

      return orders.map((order) => this.mapOrder(order));
    } catch (error) {
      throw this.handleBinanceError(error, 'getOpenOrders');
    }
  }

  // ========== Utility Methods ==========

  private mapOrder(binanceOrder: any): Order {
    return {
      orderId: binanceOrder.orderId.toString(),
      symbol: binanceOrder.symbol,
      side: binanceOrder.side,
      type: binanceOrder.type,
      quantity: parseFloat(binanceOrder.origQty || binanceOrder.quantity),
      price: binanceOrder.price ? parseFloat(binanceOrder.price) : undefined,
      status: binanceOrder.status,
      executedQty: parseFloat(binanceOrder.executedQty || '0'),
      cummulativeQuoteQty: parseFloat(binanceOrder.cummulativeQuoteQty || '0'),
      fills: binanceOrder.fills,
      transactTime: binanceOrder.transactTime,
    };
  }

  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Don't retry on certain errors
        if (error.code && ['INVALID_ORDER', 'INSUFFICIENT_BALANCE'].includes(error.code)) {
          throw error;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
          error: error.message,
        });

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private handleBinanceError(error: any, method: string): never {
    logger.error(`Binance API error in ${method}`, { error });

    const message = error.message || 'Unknown Binance API error';
    const details = {
      method,
      code: error.code,
      body: error.body,
    };

    throw new BinanceApiError(message, details);
  }

  private getCachedData<T>(key: string, maxAge: number): T | null {
    const expiry = this.cacheExpiry.get(key);
    if (expiry && Date.now() < expiry) {
      return this.symbolCache.get(key) as T;
    }
    return null;
  }

  private setCachedData<T>(key: string, data: T, ttl: number): void {
    this.symbolCache.set(key, data as any);
    this.cacheExpiry.set(key, Date.now() + ttl);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Health check
  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch (error) {
      logger.error('Binance ping failed', { error });
      return false;
    }
  }

  async testConnectivity(): Promise<boolean> {
    try {
      await this.client.time();
      return true;
    } catch (error) {
      logger.error('Binance connectivity test failed', { error });
      return false;
    }
  }
}
