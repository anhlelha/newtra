import { v4 as uuidv4 } from 'uuid';
import { createModuleLogger } from '../utils/logger';
import { TradingViewSignal } from '../api/schemas/webhook.schema';
import { BinanceClient } from './binance/BinanceClient';
import { RiskManager } from './RiskManager';
import { SignalProcessor } from './SignalProcessor';
import { RiskLimitExceededError } from '../utils/errors';
import databaseService from '../database';

const logger = createModuleLogger('OrderManager');

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  quantity: number;
  price?: number;
  stopPrice?: number;
  strategyId?: string | null;
}

export class OrderManager {
  constructor(
    private binanceClient: BinanceClient,
    private riskManager: RiskManager,
    private signalProcessor: SignalProcessor
  ) {}

  async executeFromSignal(signalId: string, signal: TradingViewSignal, strategyId?: string | null, bypassEnabledCheck: boolean = false): Promise<string> {
    const orderId = uuidv4();
    const db = databaseService.getDatabase();

    try {
      logger.info('Executing order from signal', { signalId, signal, strategyId, bypassEnabledCheck });

      // Calculate quantity
      const quantity = await this.riskManager.calculatePositionSize(signal);

      // Check risk limits
      const riskCheck = await this.riskManager.checkRiskLimits(signal, quantity, bypassEnabledCheck);
      const riskPassed = riskCheck.allowed;

      if (!riskPassed) {
        // Create REJECTED order record so it's visible in UI
        const side = this.getOrderSide(signal);

        logger.info('[REJECTED ORDER] Creating REJECTED order record', {
          orderId,
          signalId,
          symbol: signal.symbol,
          side,
          quantity,
          reason: riskCheck.reason,
          strategyId,
        });

        const stmt = db.prepare(`
          INSERT INTO orders (
            id, symbol, side, type, quantity, price, status, error_message, strategy_id, risk_passed
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
          orderId,
          signal.symbol,
          side,
          signal.orderType?.toUpperCase() || 'MARKET',
          quantity,
          signal.price || null,
          'REJECTED',
          riskCheck.reason,
          strategyId || null,
          0
        );

        logger.info('[REJECTED ORDER] Order record created successfully', {
          orderId,
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid,
        });

        // Verify the order was created
        const verifyStmt = db.prepare('SELECT * FROM orders WHERE id = ?');
        const createdOrder = verifyStmt.get(orderId);
        logger.info('[REJECTED ORDER] Verification query result', {
          orderId,
          found: !!createdOrder,
          order: createdOrder,
        });

        // Update signal status with order ID and error
        await this.signalProcessor.updateSignalStatus(signalId, orderId, riskCheck.reason);

        logger.warn('Order rejected by risk check', { orderId, signalId, reason: riskCheck.reason });

        throw new RiskLimitExceededError(riskCheck.reason!);
      }

      // Determine order side
      const side = this.getOrderSide(signal);

      // Execute order based on type (will create its own order ID and return it)
      let executedOrderId: string;

      if (signal.orderType === 'market') {
        executedOrderId = await this.executeMarketOrder({
          symbol: signal.symbol,
          side,
          type: 'MARKET',
          quantity,
          strategyId: strategyId || null,
        }, riskPassed);
      } else {
        // Limit order
        if (!signal.price) {
          throw new Error('Price is required for limit orders');
        }

        executedOrderId = await this.executeLimitOrder({
          symbol: signal.symbol,
          side,
          type: 'LIMIT',
          quantity,
          price: signal.price,
          strategyId: strategyId || null,
        }, riskPassed);
      }

      // Update signal status
      await this.signalProcessor.updateSignalStatus(signalId, executedOrderId);

      logger.info('Order executed successfully', { signalId, orderId: executedOrderId });

      return executedOrderId;
    } catch (error) {
      logger.error('Failed to execute order from signal', { signalId, error });

      // Only update signal if not a RiskLimitExceededError (already handled above)
      if (!(error instanceof RiskLimitExceededError)) {
        await this.signalProcessor.updateSignalStatus(signalId, '', (error as Error).message);
      }

      throw error;
    }
  }

  private async executeMarketOrder(request: OrderRequest, riskPassed: boolean = true): Promise<string> {
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
          status, filled_quantity, avg_fill_price, commission, commission_asset,
          strategy_id, risk_passed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        commissionAsset,
        request.strategyId || null,
        riskPassed ? 1 : 0
      );

      logger.info('Market order executed and saved', {
        orderId,
        binanceOrderId: binanceOrder.orderId,
        status: binanceOrder.status,
        executedQty: binanceOrder.executedQty,
      });

      // Create or update position if order is filled
      if (binanceOrder.status === 'FILLED') {
        await this.handleFilledOrder(orderId, request, avgFillPrice);
      }

      return orderId;
    } catch (error) {
      logger.error('Market order execution failed', { orderId, error });

      // Save failed order to database
      const stmt = db.prepare(`
        INSERT INTO orders (
          id, symbol, side, type, quantity, status, error_message, strategy_id, risk_passed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        orderId,
        request.symbol,
        request.side,
        'MARKET',
        request.quantity,
        'REJECTED',
        (error as Error).message,
        request.strategyId || null,
        riskPassed ? 1 : 0
      );

      throw error;
    }
  }

  private async executeLimitOrder(request: OrderRequest, riskPassed: boolean = true): Promise<string> {
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
          id, binance_order_id, symbol, side, type, quantity, price, status,
          strategy_id, risk_passed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        orderId,
        binanceOrder.orderId,
        request.symbol,
        request.side,
        'LIMIT',
        request.quantity,
        request.price,
        binanceOrder.status,
        request.strategyId || null,
        riskPassed ? 1 : 0
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
          id, symbol, side, type, quantity, price, status, error_message, strategy_id, risk_passed
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        orderId,
        request.symbol,
        request.side,
        'LIMIT',
        request.quantity,
        request.price,
        'REJECTED',
        (error as Error).message,
        request.strategyId || null,
        riskPassed ? 1 : 0
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

    let query = `
      SELECT
        o.*,
        s.name as strategy_name
      FROM orders o
      LEFT JOIN strategies s ON o.strategy_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters?.symbol) {
      query += ' AND o.symbol = ?';
      params.push(filters.symbol);
    }

    if (filters?.status) {
      query += ' AND o.status = ?';
      params.push(filters.status);
    }

    query += ' ORDER BY o.created_at DESC';

    if (filters?.limit) {
      query += ' LIMIT ?';
      params.push(filters.limit);
    }

    return db.prepare(query).all(...params);
  }

  private async handleFilledOrder(
    orderId: string,
    request: OrderRequest,
    fillPrice: number
  ): Promise<void> {
    try {
      if (request.side === 'BUY') {
        // Create new position for BUY orders
        await this.createPosition(orderId, request, fillPrice);
      } else if (request.side === 'SELL') {
        // Close position for SELL orders
        await this.closePosition(orderId, request, fillPrice);
      }
    } catch (error) {
      logger.error('Failed to handle filled order', { orderId, error });
      // Don't throw - order was executed successfully, position tracking is secondary
    }
  }

  private async createPosition(
    orderId: string,
    request: OrderRequest,
    entryPrice: number
  ): Promise<void> {
    const db = databaseService.getDatabase();
    const positionId = uuidv4();

    try {
      // Check if there's already an open position for this symbol
      const existingPosition = db
        .prepare('SELECT * FROM positions WHERE symbol = ? AND status = ?')
        .get(request.symbol, 'OPEN') as any;

      if (existingPosition) {
        // Update existing position - average entry price
        const totalQuantity = existingPosition.quantity + request.quantity;
        const totalValue =
          existingPosition.quantity * existingPosition.entry_price +
          request.quantity * entryPrice;
        const avgEntryPrice = totalValue / totalQuantity;

        db.prepare(
          `UPDATE positions
           SET quantity = ?, entry_price = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run(totalQuantity, avgEntryPrice, existingPosition.id);

        logger.info('Updated existing position', {
          positionId: existingPosition.id,
          symbol: request.symbol,
          newQuantity: totalQuantity,
          avgEntryPrice,
        });
      } else {
        // Create new position
        db.prepare(
          `INSERT INTO positions (
            id, order_id, symbol, quantity, entry_price, status
          ) VALUES (?, ?, ?, ?, ?, ?)`
        ).run(positionId, orderId, request.symbol, request.quantity, entryPrice, 'OPEN');

        logger.info('Created new position', {
          positionId,
          orderId,
          symbol: request.symbol,
          quantity: request.quantity,
          entryPrice,
        });
      }
    } catch (error) {
      logger.error('Failed to create position', { orderId, error });
      throw error;
    }
  }

  private async closePosition(
    orderId: string,
    request: OrderRequest,
    exitPrice: number
  ): Promise<void> {
    const db = databaseService.getDatabase();

    try {
      // Find open position for this symbol
      const position = db
        .prepare('SELECT * FROM positions WHERE symbol = ? AND status = ?')
        .get(request.symbol, 'OPEN') as any;

      if (!position) {
        logger.warn('No open position found to close', { symbol: request.symbol });
        return;
      }

      // Calculate realized PnL
      const realizedPnL = (exitPrice - position.entry_price) * request.quantity;

      if (request.quantity >= position.quantity) {
        // Close entire position
        db.prepare(
          `UPDATE positions
           SET status = ?, exit_price = ?, realized_pnl = ?, closed_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run('CLOSED', exitPrice, realizedPnL, position.id);

        logger.info('Closed position', {
          positionId: position.id,
          symbol: request.symbol,
          realizedPnL,
        });
      } else {
        // Partially close position
        const remainingQuantity = position.quantity - request.quantity;

        db.prepare(
          `UPDATE positions
           SET quantity = ?, realized_pnl = COALESCE(realized_pnl, 0) + ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run(remainingQuantity, realizedPnL, position.id);

        logger.info('Partially closed position', {
          positionId: position.id,
          symbol: request.symbol,
          remainingQuantity,
          realizedPnL,
        });
      }
    } catch (error) {
      logger.error('Failed to close position', { orderId, error });
      throw error;
    }
  }
}
