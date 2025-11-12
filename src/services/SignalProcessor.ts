import { v4 as uuidv4 } from 'uuid';
import { createModuleLogger } from '../utils/logger';
import { TradingViewSignal } from '../api/schemas/webhook.schema';
import { DuplicateSignalError, ValidationError } from '../utils/errors';
import databaseService from '../database';
import config from '../config';

const logger = createModuleLogger('SignalProcessor');

interface SignalRecord {
  id: string;
  action: string;
  symbol: string;
  payload: string;
  processed: boolean;
  received_at: string;
}

export class SignalProcessor {
  private recentSignals: Map<string, number> = new Map();

  async processSignal(signal: TradingViewSignal): Promise<string> {
    const signalId = uuidv4();

    try {
      logger.info('Processing trading signal', { signalId, signal });

      // Check for duplicates
      if (this.isDuplicate(signal)) {
        logger.warn('Duplicate signal detected', { signal });
        throw new DuplicateSignalError(
          `Duplicate signal for ${signal.symbol} within ${config.trading.preventDuplicatesWindowMs}ms`
        );
      }

      // Validate signal
      this.validateSignal(signal);

      // Save signal to database
      this.saveSignal(signalId, signal);

      // Mark as recent
      this.markAsRecent(signal);

      logger.info('Signal processed successfully', { signalId });

      return signalId;
    } catch (error) {
      logger.error('Failed to process signal', { signalId, error });

      // Save failed signal to database
      this.saveSignal(signalId, signal, (error as Error).message);

      throw error;
    }
  }

  validateSignal(signal: TradingViewSignal): void {
    // Validate limit order has price
    if (signal.orderType === 'limit' && !signal.price) {
      throw new ValidationError('Price is required for limit orders');
    }

    // Validate close action doesn't need price/quantity
    if (signal.action === 'close') {
      // Close action is valid, no additional validation needed
      return;
    }

    // Validate buy/sell action
    if (signal.action === 'buy' || signal.action === 'sell') {
      // Quantity is optional, will be calculated based on config if not provided
      if (signal.quantity && signal.quantity <= 0) {
        throw new ValidationError('Quantity must be positive');
      }

      if (signal.price && signal.price <= 0) {
        throw new ValidationError('Price must be positive');
      }

      if (signal.stopLoss && signal.stopLoss <= 0) {
        throw new ValidationError('Stop loss must be positive');
      }
    }
  }

  isDuplicate(signal: TradingViewSignal): boolean {
    const key = this.getSignalKey(signal);
    const lastTime = this.recentSignals.get(key);

    if (!lastTime) {
      return false;
    }

    const timeSinceLastSignal = Date.now() - lastTime;
    return timeSinceLastSignal < config.trading.preventDuplicatesWindowMs;
  }

  private markAsRecent(signal: TradingViewSignal): void {
    const key = this.getSignalKey(signal);
    this.recentSignals.set(key, Date.now());

    // Cleanup old entries
    this.cleanupRecentSignals();
  }

  private getSignalKey(signal: TradingViewSignal): string {
    return `${signal.action}-${signal.symbol}-${signal.orderType}`;
  }

  private cleanupRecentSignals(): void {
    const now = Date.now();
    const threshold = config.trading.preventDuplicatesWindowMs;

    for (const [key, timestamp] of this.recentSignals.entries()) {
      if (now - timestamp > threshold) {
        this.recentSignals.delete(key);
      }
    }
  }

  private saveSignal(signalId: string, signal: TradingViewSignal, errorMessage?: string): void {
    const db = databaseService.getDatabase();

    const stmt = db.prepare(`
      INSERT INTO signals (id, action, symbol, payload, processed, error_message)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      signalId,
      signal.action,
      signal.symbol,
      JSON.stringify(signal),
      errorMessage ? 0 : 1,
      errorMessage || null
    );
  }

  async updateSignalStatus(
    signalId: string,
    orderId: string,
    errorMessage?: string
  ): Promise<void> {
    const db = databaseService.getDatabase();

    const stmt = db.prepare(`
      UPDATE signals
      SET processed = ?, order_id = ?, error_message = ?, processed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(errorMessage ? 0 : 1, orderId || null, errorMessage || null, signalId);
  }

  async getRecentSignals(limit = 100): Promise<SignalRecord[]> {
    const db = databaseService.getDatabase();

    const stmt = db.prepare(`
      SELECT * FROM signals
      ORDER BY received_at DESC
      LIMIT ?
    `);

    return stmt.all(limit) as SignalRecord[];
  }
}
