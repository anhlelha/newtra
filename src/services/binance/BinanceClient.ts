import Binance, { OrderType } from 'binance-api-node';
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
  FuturesMarketOrderParams,
  FuturesAccountInfo,
  FuturesBalance,
  FuturesPosition,
} from './types';

const logger = createModuleLogger('BinanceClient');

export class BinanceClient {
  private client: ReturnType<typeof Binance>;
  private symbolCache: Map<string, SymbolInfo> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  constructor(config: BinanceConfig) {
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
      const cached = this.getCachedData<SymbolInfo>(symbol);
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
          type: OrderType.MARKET,
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
          type: OrderType.LIMIT,
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
          type: OrderType.STOP_LOSS_LIMIT,
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

  // ========== Futures Trading ==========

  async setFuturesLeverage(symbol: string, leverage: number): Promise<void> {
    try {
      logger.info('Setting futures leverage', { symbol, leverage });

      await this.retryWithBackoff(() =>
        this.client.futuresLeverage({
          symbol,
          leverage,
        })
      );

      logger.info('Futures leverage set', { symbol, leverage });
    } catch (error) {
      logger.error('Failed to set futures leverage', { symbol, leverage, error });
      throw this.handleBinanceError(error, 'setFuturesLeverage');
    }
  }

  async createFuturesMarketOrder(params: FuturesMarketOrderParams): Promise<Order> {
    try {
      logger.info('Creating futures market order', params);

      const order = await this.retryWithBackoff(() =>
        this.client.futuresOrder({
          symbol: params.symbol,
          side: params.side,
          type: 'MARKET',
          quantity: params.quantity.toString(),
          positionSide: params.positionSide,
        })
      );

      logger.info('Futures market order created', {
        orderId: order.orderId,
        symbol: params.symbol,
        status: order.status,
      });

      return this.mapOrder(order);
    } catch (error) {
      logger.error('Failed to create futures market order', { params, error });
      throw this.handleBinanceError(error, 'createFuturesMarketOrder');
    }
  }

  async getFuturesAccountInfo(): Promise<FuturesAccountInfo> {
    try {
      const account = await this.retryWithBackoff(() => this.client.futuresAccountInfo());

      return {
        totalWalletBalance: account.totalWalletBalance,
        totalUnrealizedProfit: account.totalUnrealizedProfit,
        totalMarginBalance: account.totalMarginBalance,
        availableBalance: account.availableBalance,
        maxWithdrawAmount: account.maxWithdrawAmount,
        assets: account.assets.map((asset: any) => ({
          asset: asset.asset,
          walletBalance: asset.walletBalance,
          unrealizedProfit: asset.unrealizedProfit,
          marginBalance: asset.marginBalance,
          availableBalance: asset.availableBalance,
          crossWalletBalance: asset.crossWalletBalance,
          crossUnrealizedPnL: asset.crossUnPnl,
          maxWithdrawAmount: asset.maxWithdrawAmount,
        })),
        positions: account.positions.map((pos: any) => ({
          symbol: pos.symbol,
          positionAmt: pos.positionAmt,
          entryPrice: pos.entryPrice,
          markPrice: pos.markPrice,
          unrealizedProfit: pos.unrealizedProfit,
          liquidationPrice: pos.liquidationPrice,
          leverage: pos.leverage,
          marginType: pos.marginType,
          positionSide: pos.positionSide,
        })),
      };
    } catch (error) {
      throw this.handleBinanceError(error, 'getFuturesAccountInfo');
    }
  }

  async getFuturesBalance(asset: string = 'USDT'): Promise<FuturesBalance> {
    try {
      const account = await this.getFuturesAccountInfo();
      const assetBalance = account.assets.find((a) => a.asset === asset);

      if (!assetBalance) {
        return {
          asset,
          balance: '0',
          availableBalance: '0',
        };
      }

      return {
        asset,
        balance: assetBalance.walletBalance,
        availableBalance: assetBalance.availableBalance,
      };
    } catch (error) {
      throw this.handleBinanceError(error, 'getFuturesBalance');
    }
  }

  async getFuturesPositions(symbol?: string): Promise<FuturesPosition[]> {
    try {
      const account = await this.getFuturesAccountInfo();

      // Filter positions with non-zero position amount
      let positions = account.positions.filter(
        (pos) => parseFloat(pos.positionAmt) !== 0
      );

      if (symbol) {
        positions = positions.filter((pos) => pos.symbol === symbol);
      }

      return positions;
    } catch (error) {
      throw this.handleBinanceError(error, 'getFuturesPositions');
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

  private getCachedData<T>(key: string): T | null {
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
