import { v4 as uuidv4 } from 'uuid';
import { createModuleLogger } from '../utils/logger';
import { TradingViewSignal } from '../api/schemas/webhook.schema';
import { BinanceClient } from './binance/BinanceClient';
import { RiskManager } from './RiskManager';
import { SignalProcessor } from './SignalProcessor';
import { RiskLimitExceededError } from '../utils/errors';
import databaseService from '../database';
import { Strategy } from './StrategyService';

const logger = createModuleLogger('OrderManager');

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS';
  quantity: number;
  price?: number;
  stopPrice?: number;
  strategyId?: string | null;
  trading_type?: 'SPOT' | 'FUTURE';
  leverage?: number;
}

export class OrderManager {
  constructor(
    private binanceClient: BinanceClient,
    private riskManager: RiskManager,
    private signalProcessor: SignalProcessor
  ) {}

  async executeFromSignal(
    signalId: string,
    signal: TradingViewSignal,
    strategyId?: string | null,
    bypassEnabledCheck: boolean = false,
    isManualApproval: boolean = false
  ): Promise<string> {
    const orderId = uuidv4();
    const db = databaseService.getDatabase();

    try {
      logger.info('Executing order from signal', { signalId, signal, strategyId, bypassEnabledCheck, isManualApproval });

      // Get strategy details if strategyId is provided
      let strategy: Strategy | null = null;
      if (strategyId) {
        strategy = db.prepare('SELECT * FROM strategies WHERE id = ?').get(strategyId) as Strategy | undefined || null;
        logger.info('Strategy loaded', { strategyId, strategy });
      }

      const trading_type = strategy?.trading_type || 'SPOT';
      const leverage = strategy?.leverage || 5;

      // Calculate quantity
      const quantity = await this.riskManager.calculatePositionSize(signal);

      // Check risk limits
      const riskCheck = await this.riskManager.checkRiskLimits(signal, quantity, bypassEnabledCheck);
      const riskPassed = riskCheck.allowed;

      if (!riskPassed) {
        // Risk check failed - create REJECTED order record so it's visible in UI
        // Note: This only happens when Risk Management is ENABLED
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
            id, symbol, side, type, quantity, price, status, error_message, strategy_id, risk_passed, trading_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          0,
          trading_type
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
          trading_type,
          leverage,
        }, riskPassed, isManualApproval);
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
          trading_type,
          leverage,
        }, riskPassed, isManualApproval);
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

  /**
   * Close a position by creating a MARKET order
   * This is a public method that can be called from AdminController
   * For LONG positions: creates a SELL order
   * For SHORT positions: creates a BUY order
   */
  async closePositionWithOrder(
    positionId: string,
    symbol: string,
    quantity: number
  ): Promise<string> {
    logger.info('Closing position with market order', { positionId, symbol, quantity });

    const db = databaseService.getDatabase();

    // Get the position to determine its side and trading_type
    const position = db
      .prepare('SELECT * FROM positions WHERE id = ?')
      .get(positionId) as any;

    if (!position) {
      throw new Error(`Position ${positionId} not found`);
    }

    // Determine the correct order side to close the position
    // LONG positions are closed with SELL orders
    // SHORT positions are closed with BUY orders
    const orderSide = position.side === 'LONG' ? 'SELL' : 'BUY';

    // Create order to close position
    const orderId = await this.executeMarketOrder(
      {
        symbol,
        side: orderSide,
        type: 'MARKET',
        quantity,
        strategyId: null,
        trading_type: position.trading_type,
        leverage: position.leverage,
      },
      true, // riskPassed = true (manual close, bypass risk checks)
      false // isManualApproval = false (not from pending signals)
    );

    logger.info('Position closed with order', {
      positionId,
      positionSide: position.side,
      orderSide,
      orderId,
    });
    return orderId;
  }

  private async executeMarketOrder(request: OrderRequest, riskPassed: boolean = true, isManualApproval: boolean = false): Promise<string> {
    const orderId = uuidv4();
    const db = databaseService.getDatabase();

    try {
      logger.info('Executing market order', { orderId, request, isManualApproval });

      const trading_type = request.trading_type || 'SPOT';
      const leverage = request.leverage || 5;

      let binanceOrder: any;

      if (trading_type === 'FUTURE') {
        // Set leverage for futures trading
        logger.info('Setting futures leverage', { symbol: request.symbol, leverage });
        await this.binanceClient.setFuturesLeverage(request.symbol, leverage);

        // Execute futures order
        binanceOrder = await this.binanceClient.createFuturesMarketOrder({
          symbol: request.symbol,
          side: request.side,
          quantity: request.quantity,
        });
      } else {
        // Execute spot order
        binanceOrder = await this.binanceClient.createMarketOrder({
          symbol: request.symbol,
          side: request.side,
          quantity: request.quantity,
        });
      }

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
          strategy_id, risk_passed, trading_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        riskPassed ? 1 : 0,
        trading_type
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
      logger.error('Market order execution failed', { orderId, error, isManualApproval });

      // For manual approvals, don't create REJECTED order record
      // The pending signal will be marked as FAILED instead
      if (!isManualApproval) {
        const trading_type = request.trading_type || 'SPOT';

        // Save failed order to database
        const stmt = db.prepare(`
          INSERT INTO orders (
            id, symbol, side, type, quantity, status, error_message, strategy_id, risk_passed, trading_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          riskPassed ? 1 : 0,
          trading_type
        );

        logger.info('Created REJECTED order record for automatic signal', { orderId });
      } else {
        logger.info('Skipping REJECTED order record for manual approval - will be marked as FAILED in pending signals', { orderId });
      }

      throw error;
    }
  }

  private async executeLimitOrder(request: OrderRequest, riskPassed: boolean = true, isManualApproval: boolean = false): Promise<string> {
    const orderId = uuidv4();
    const db = databaseService.getDatabase();

    try {
      logger.info('Executing limit order', { orderId, request, isManualApproval });

      const trading_type = request.trading_type || 'SPOT';
      const leverage = request.leverage || 5;

      let binanceOrder: any;

      if (trading_type === 'FUTURE') {
        // Set leverage for futures trading
        logger.info('Setting futures leverage for limit order', { symbol: request.symbol, leverage });
        await this.binanceClient.setFuturesLeverage(request.symbol, leverage);

        // Execute futures limit order
        binanceOrder = await this.binanceClient.createFuturesLimitOrder({
          symbol: request.symbol,
          side: request.side,
          quantity: request.quantity,
          price: request.price!,
        });
      } else {
        // Execute spot limit order
        binanceOrder = await this.binanceClient.createLimitOrder({
          symbol: request.symbol,
          side: request.side,
          quantity: request.quantity,
          price: request.price!,
        });
      }

      // Save to database
      const stmt = db.prepare(`
        INSERT INTO orders (
          id, binance_order_id, symbol, side, type, quantity, price, status,
          strategy_id, risk_passed, trading_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        riskPassed ? 1 : 0,
        trading_type
      );

      logger.info('Limit order executed and saved', {
        orderId,
        binanceOrderId: binanceOrder.orderId,
        status: binanceOrder.status,
        trading_type,
      });

      return orderId;
    } catch (error) {
      logger.error('Limit order execution failed', { orderId, error, isManualApproval });

      // For manual approvals, don't create REJECTED order record
      // The pending signal will be marked as FAILED instead
      if (!isManualApproval) {
        const trading_type = request.trading_type || 'SPOT';

        // Save failed order to database
        const stmt = db.prepare(`
          INSERT INTO orders (
            id, symbol, side, type, quantity, price, status, error_message, strategy_id, risk_passed, trading_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          riskPassed ? 1 : 0,
          trading_type
        );

        logger.info('Created REJECTED order record for automatic signal', { orderId });
      } else {
        logger.info('Skipping REJECTED order record for manual approval - will be marked as FAILED in pending signals', { orderId });
      }

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
      const trading_type = request.trading_type || 'SPOT';

      if (trading_type === 'SPOT') {
        // Spot trading: BUY opens position, SELL closes position
        if (request.side === 'BUY') {
          await this.createPosition(orderId, request, fillPrice);
        } else if (request.side === 'SELL') {
          await this.closePosition(orderId, request, fillPrice);
        }
      } else {
        // Futures trading: BUY can open LONG or close SHORT, SELL can open SHORT or close LONG
        // For now, we'll treat BUY as opening LONG and SELL as closing LONG (simplified)
        // In a more complex system, we'd check if there's an existing position to close first
        if (request.side === 'BUY') {
          await this.createPosition(orderId, request, fillPrice);
        } else if (request.side === 'SELL') {
          await this.closePosition(orderId, request, fillPrice);
        }
      }
    } catch (error) {
      logger.error('Failed to handle filled order', {
        orderId,
        side: request.side,
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
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
      const trading_type = request.trading_type || 'SPOT';
      const leverage = request.leverage || 5;

      // Determine position side based on order side and trading type
      // Spot: Always LONG (BUY opens, SELL closes)
      // Futures: BUY opens LONG, SELL opens SHORT (but we're treating SELL as close for now)
      const positionSide = request.side === 'BUY' ? 'LONG' : 'SHORT';

      // Check if there's already an open position for this symbol
      // For our "only 1 position per symbol" rule
      const existingPosition = db
        .prepare('SELECT * FROM positions WHERE symbol = ? AND status = ?')
        .get(request.symbol, 'OPEN') as any;

      if (existingPosition) {
        // Update existing position - average entry price
        // This only makes sense if positions are on the same side
        if (existingPosition.side !== positionSide) {
          logger.warn('Attempting to add to position with different side', {
            existingPosition,
            newSide: positionSide,
          });
          throw new Error(
            `Cannot add ${positionSide} position when ${existingPosition.side} position exists for ${request.symbol}`
          );
        }

        const totalQuantity = existingPosition.quantity + request.quantity;
        const totalValue =
          existingPosition.quantity * existingPosition.entry_price +
          request.quantity * entryPrice;
        const avgEntryPrice = totalValue / totalQuantity;

        db.prepare(
          `UPDATE positions
           SET quantity = ?, entry_price = ?
           WHERE id = ?`
        ).run(totalQuantity, avgEntryPrice, existingPosition.id);

        logger.info('Updated existing position', {
          positionId: existingPosition.id,
          symbol: request.symbol,
          side: positionSide,
          newQuantity: totalQuantity,
          avgEntryPrice,
        });
      } else {
        // Calculate liquidation price for futures (simplified calculation)
        let liquidationPrice = null;
        if (trading_type === 'FUTURE') {
          // Liquidation price formula (simplified):
          // LONG: entryPrice * (1 - 1/leverage)
          // SHORT: entryPrice * (1 + 1/leverage)
          if (positionSide === 'LONG') {
            liquidationPrice = entryPrice * (1 - 1 / leverage);
          } else {
            liquidationPrice = entryPrice * (1 + 1 / leverage);
          }
        }

        // Create new position
        db.prepare(
          `INSERT INTO positions (
            id, entry_order_id, symbol, side, trading_type, leverage, quantity,
            entry_price, liquidation_price, status, realized_pnl
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          positionId,
          orderId,
          request.symbol,
          positionSide,
          trading_type,
          trading_type === 'FUTURE' ? leverage : null,
          request.quantity,
          entryPrice,
          liquidationPrice,
          'OPEN',
          0
        );

        logger.info('Created new position', {
          positionId,
          orderId,
          symbol: request.symbol,
          side: positionSide,
          trading_type,
          leverage: trading_type === 'FUTURE' ? leverage : null,
          quantity: request.quantity,
          entryPrice,
          liquidationPrice,
        });
      }
    } catch (error) {
      logger.error('Failed to create position', {
        orderId,
        error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorStack: error instanceof Error ? error.stack : undefined
      });
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

      // Validate order side matches position side for closing
      // LONG positions are closed with SELL orders
      // SHORT positions are closed with BUY orders
      if (position.side === 'LONG' && request.side !== 'SELL') {
        logger.error('Invalid close order side for LONG position', {
          positionId: position.id,
          positionSide: position.side,
          orderSide: request.side,
        });
        throw new Error('LONG positions must be closed with SELL orders');
      }

      if (position.side === 'SHORT' && request.side !== 'BUY') {
        logger.error('Invalid close order side for SHORT position', {
          positionId: position.id,
          positionSide: position.side,
          orderSide: request.side,
        });
        throw new Error('SHORT positions must be closed with BUY orders');
      }

      // Calculate realized PnL
      // LONG: (exitPrice - entryPrice) * quantity
      // SHORT: (entryPrice - exitPrice) * quantity (inverse)
      let realizedPnL: number;
      if (position.side === 'LONG') {
        realizedPnL = (exitPrice - position.entry_price) * request.quantity;
      } else {
        // SHORT position
        realizedPnL = (position.entry_price - exitPrice) * request.quantity;
      }

      if (request.quantity >= position.quantity) {
        // Close entire position
        db.prepare(
          `UPDATE positions
           SET status = ?, exit_price = ?, realized_pnl = ?, exit_order_id = ?, closed_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).run('CLOSED', exitPrice, realizedPnL, orderId, position.id);

        logger.info('Closed position', {
          positionId: position.id,
          symbol: request.symbol,
          side: position.side,
          realizedPnL,
        });
      } else {
        // Partially close position
        const remainingQuantity = position.quantity - request.quantity;

        db.prepare(
          `UPDATE positions
           SET quantity = ?, realized_pnl = COALESCE(realized_pnl, 0) + ?
           WHERE id = ?`
        ).run(remainingQuantity, realizedPnL, position.id);

        logger.info('Partially closed position', {
          positionId: position.id,
          symbol: request.symbol,
          side: position.side,
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
