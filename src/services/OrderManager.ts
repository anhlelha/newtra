import { v4 as uuidv4 } from 'uuid';
import { createModuleLogger } from '../utils/logger';
import { TradingViewSignal } from '../api/schemas/webhook.schema';
import { BinanceClient } from './binance/BinanceClient';
import { RiskManager } from './RiskManager';
import { SignalProcessor } from './SignalProcessor';
import { InsufficientBalanceError, RiskLimitExceededError } from '../utils/errors';
import databaseService from '../database';

const logger = createModuleLogger('OrderManager');

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  quantity: number;
  price?: number;
  stopPrice?: number;
}

export class OrderManager {
  constructor(
    private binanceClient: BinanceClient,
    private riskManager: RiskManager,
    private signalProcessor: SignalProcessor
  ) {}

  async executeFromSignal(signalId: string, signal: TradingViewSignal): Promise<string> {
    try {
      logger.info('Executing order from signal', { signalId, signal });

      // Calculate quantity
      const quantity = await this.riskManager.calculatePositionSize(signal);

      // Check risk limits
      const riskCheck = await this.riskManager.checkRiskLimits(signal, quantity);

      if (!riskCheck.allowed) {
        throw new RiskLimitExceededError(riskCheck.reason!);
      }

      // Determine order side
      const side = this.getOrderSide(signal);

      // Execute order based on type
      let orderId: string;

      if (signal.orderType === 'market') {
        orderId = await this.executeMarketOrder({
          symbol: signal.symbol,
          side,
          type: 'MARKET',
          quantity,
        });
      } else {
        // Limit order
        if (!signal.price) {
          throw new Error('Price is required for limit orders');
        }

        orderId = await this.executeLimitOrder({
          symbol: signal.symbol,
          side,
          type: 'LIMIT',
          quantity,
          price: signal.price,
        });
      }

      // Update signal status
      await this.signalProcessor.updateSignalStatus(signalId, orderId);

      logger.info('Order executed successfully', { signalId, orderId });

      return orderId;
    } catch (error) {
      logger.error('Failed to execute order from signal', { signalId, error });

      // Update signal with error
      await this.signalProcessor.updateSignalStatus(signalId, '', (error as Error).message);

      throw error;
    }
  }

  private async executeMarketOrder(request: OrderRequest): Promise<string> {
    const orderId = uuidv4();
    const db = databaseService.getDatabase();

    try {
      logger.info('Executing market order', { orderId, request });

      // Execute on Binance
      const binanceOrder = await this.binanceClient.createMarketOrder({
        symbol: request.symbol,
        side: request.side,
        quantity: request.quantity,
      });

      // Calculate average fill price
      const avgFillPrice =
        binanceOrder.cummulativeQuoteQty > 0
          ? binanceOrder.cummulativeQuoteQty / binanceOrder.executedQty
          : 0;

      // Calculate commission
      const commission = binanceOrder.fills
        ? binanceOrder.fills.reduce((sum, fill) => sum + parseFloat(fill.commission), 0)
        : 0;

      const commissionAsset = binanceOrder.fills?.[0]?.commissionAsset || '';

      // Save to database
      const stmt = db.prepare(`
        INSERT INTO orders (
          id, binance_order_id, symbol, side, type, quantity,
          status, filled_quantity, avg_fill_price, commission, commission_asset
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        orderId,
        binanceOrder.orderId,
        request.symbol,
        request.side,
        'MARKET',
        request.quantity,
        binanceOrder.status,
        binanceOrder.executedQty,
        avgFillPrice,
        commission,
        commissionAsset
      );

      logger.info('Market order executed and saved', {
        orderId,
        binanceOrderId: binanceOrder.orderId,
        status: binanceOrder.status,
        executedQty: binanceOrder.executedQty,
      });

      return orderId;
    } catch (error) {
      logger.error('Market order execution failed', { orderId, error });

      // Save failed order to database
      const stmt = db.prepare(`
        INSERT INTO orders (
          id, symbol, side, type, quantity, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        orderId,
        request.symbol,
        request.side,
        'MARKET',
        request.quantity,
        'REJECTED',
        (error as Error).message
      );

      throw error;
    }
  }

  private async executeLimitOrder(request: OrderRequest): Promise<string> {
    const orderId = uuidv4();
    const db = databaseService.getDatabase();

    try {
      logger.info('Executing limit order', { orderId, request });

      // Execute on Binance
      const binanceOrder = await this.binanceClient.createLimitOrder({
        symbol: request.symbol,
        side: request.side,
        quantity: request.quantity,
        price: request.price!,
      });

      // Save to database
      const stmt = db.prepare(`
        INSERT INTO orders (
          id, binance_order_id, symbol, side, type, quantity, price, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        orderId,
        binanceOrder.orderId,
        request.symbol,
        request.side,
        'LIMIT',
        request.quantity,
        request.price,
        binanceOrder.status
      );

      logger.info('Limit order executed and saved', {
        orderId,
        binanceOrderId: binanceOrder.orderId,
        status: binanceOrder.status,
      });

      return orderId;
    } catch (error) {
      logger.error('Limit order execution failed', { orderId, error });

      // Save failed order
      const stmt = db.prepare(`
        INSERT INTO orders (
          id, symbol, side, type, quantity, price, status, error_message
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        orderId,
        request.symbol,
        request.side,
        'LIMIT',
        request.quantity,
        request.price,
        'REJECTED',
        (error as Error).message
      );

      throw error;
    }
  }

  async cancelOrder(orderId: string): Promise<void> {
    const db = databaseService.getDatabase();

    try {
      // Get order from database
      const order = db
        .prepare('SELECT * FROM orders WHERE id = ?')
        .get(orderId) as any;

      if (!order) {
        throw new Error(`Order ${orderId} not found`);
      }

      if (!order.binance_order_id) {
        throw new Error(`Order ${orderId} has no Binance order ID`);
      }

      // Cancel on Binance
      await this.binanceClient.cancelOrder(order.symbol, order.binance_order_id);

      // Update status in database
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run('CANCELED', orderId);

      logger.info('Order cancelled', { orderId });
    } catch (error) {
      logger.error('Failed to cancel order', { orderId, error });
      throw error;
    }
  }

  private getOrderSide(signal: TradingViewSignal): 'BUY' | 'SELL' {
    if (signal.action === 'buy') {
      return 'BUY';
    } else if (signal.action === 'sell' || signal.action === 'close') {
      return 'SELL';
    }

    throw new Error(`Invalid action: ${signal.action}`);
  }

  async getOrder(orderId: string) {
    const db = databaseService.getDatabase();
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  }

  async getOrders(filters?: { symbol?: string; status?: string; limit?: number }) {
    const db = databaseService.getDatabase();

    let query = 'SELECT * FROM orders WHERE 1=1';
    const params: any[] = [];

    if (filters?.symbol) {
      query += ' AND symbol = ?';
      params.push(filters.symbol);
    }

    if (filters?.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }
}
