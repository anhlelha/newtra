import { v4 as uuidv4 } from 'uuid';
import databaseService from '../database';
import { createModuleLogger } from '../utils/logger';
import { TradingViewSignal } from '../api/schemas/webhook.schema';

const logger = createModuleLogger('PendingSignalService');

export interface PendingSignal {
  id: string;
  strategy_id: string;
  strategy_name?: string; // Optional, populated when joining with strategies table
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

export interface CreatePendingSignalInput {
  strategy_id: string;
  signal_id: string;
  signal: TradingViewSignal;
}

export class PendingSignalService {
  private db = databaseService.getDatabase();

  /**
   * Create a pending signal for manual review
   */
  createPendingSignal(input: CreatePendingSignalInput): PendingSignal {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO pending_signals (
        id, strategy_id, signal_id, symbol, action, order_type,
        price, quantity, signal_data, status, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.strategy_id,
      input.signal_id,
      input.signal.symbol,
      input.signal.action,
      input.signal.orderType || 'market',
      input.signal.price || null,
      input.signal.quantity || null,
      JSON.stringify(input.signal),
      'pending',
      now
    );

    logger.info('Pending signal created', {
      id,
      strategy_id: input.strategy_id,
      symbol: input.signal.symbol,
      action: input.signal.action,
    });

    return this.getPendingSignalById(id)!;
  }

  /**
   * Get pending signal by ID
   */
  getPendingSignalById(id: string): PendingSignal | null {
    const stmt = this.db.prepare(`
      SELECT * FROM pending_signals
      WHERE id = ?
    `);

    return (stmt.get(id) as PendingSignal) || null;
  }

  /**
   * Get all pending signals (awaiting review)
   */
  getPendingSignals(strategyId?: string): PendingSignal[] {
    let query = `
      SELECT * FROM pending_signals
      WHERE status = 'pending'
    `;

    const params: any[] = [];

    if (strategyId) {
      query += ' AND strategy_id = ?';
      params.push(strategyId);
    }

    query += ' ORDER BY created_at DESC';

    const stmt = this.db.prepare(query);

    return stmt.all(...params) as PendingSignal[];
  }

  /**
   * Get all pending signals with any status
   */
  getAllPendingSignals(
    status?: 'pending' | 'approved' | 'rejected' | 'failed',
    strategyId?: string
  ): PendingSignal[] {
    let query = `
      SELECT
        ps.*,
        s.name as strategy_name
      FROM pending_signals ps
      LEFT JOIN strategies s ON ps.strategy_id = s.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status) {
      query += ' AND ps.status = ?';
      params.push(status);
    }

    if (strategyId) {
      query += ' AND ps.strategy_id = ?';
      params.push(strategyId);
    }

    query += ' ORDER BY ps.created_at DESC LIMIT 100';

    const stmt = this.db.prepare(query);

    return stmt.all(...params) as PendingSignal[];
  }

  /**
   * Approve a pending signal
   */
  approvePendingSignal(id: string, reviewedBy?: string): PendingSignal | null {
    const signal = this.getPendingSignalById(id);
    if (!signal) {
      logger.warn('Pending signal not found', { id });
      return null;
    }

    if (signal.status !== 'pending') {
      logger.warn('Pending signal already reviewed', { id, status: signal.status });
      return signal;
    }

    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE pending_signals
      SET status = 'approved', reviewed_at = ?, reviewed_by = ?
      WHERE id = ?
    `);

    stmt.run(now, reviewedBy || null, id);

    logger.info('Pending signal approved', { id, reviewedBy });

    return this.getPendingSignalById(id);
  }

  /**
   * Reject a pending signal
   */
  rejectPendingSignal(id: string, reviewedBy?: string): PendingSignal | null {
    const signal = this.getPendingSignalById(id);
    if (!signal) {
      logger.warn('Pending signal not found', { id });
      return null;
    }

    if (signal.status !== 'pending') {
      logger.warn('Pending signal already reviewed', { id, status: signal.status });
      return signal;
    }

    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE pending_signals
      SET status = 'rejected', reviewed_at = ?, reviewed_by = ?
      WHERE id = ?
    `);

    stmt.run(now, reviewedBy || null, id);

    logger.info('Pending signal rejected', { id, reviewedBy });

    return this.getPendingSignalById(id);
  }

  /**
   * Get pending signals count
   */
  getPendingSignalsCount(strategyId?: string): number {
    let query = `
      SELECT COUNT(*) as count FROM pending_signals
      WHERE status = 'pending'
    `;

    const params: any[] = [];

    if (strategyId) {
      query += ' AND strategy_id = ?';
      params.push(strategyId);
    }

    const stmt = this.db.prepare(query);
    const result = stmt.get(...params) as { count: number };

    return result.count;
  }

  /**
   * Mark a pending signal as failed with error message
   */
  markAsFailed(id: string, errorMessage: string): PendingSignal | null {
    const signal = this.getPendingSignalById(id);
    if (!signal) {
      logger.warn('Pending signal not found', { id });
      return null;
    }

    const stmt = this.db.prepare(`
      UPDATE pending_signals
      SET status = 'failed', error_message = ?
      WHERE id = ?
    `);

    stmt.run(errorMessage, id);

    logger.info('Pending signal marked as failed', { id, errorMessage });

    return this.getPendingSignalById(id);
  }

  /**
   * Update pending signal with order ID after successful execution
   */
  updateOrderId(id: string, orderId: string): PendingSignal | null {
    const signal = this.getPendingSignalById(id);
    if (!signal) {
      logger.warn('Pending signal not found', { id });
      return null;
    }

    const stmt = this.db.prepare(`
      UPDATE pending_signals
      SET order_id = ?
      WHERE id = ?
    `);

    stmt.run(orderId, id);

    logger.info('Pending signal order ID updated', { id, orderId });

    return this.getPendingSignalById(id);
  }

  /**
   * Delete old reviewed signals (cleanup)
   */
  cleanupOldSignals(daysOld: number = 30): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const stmt = this.db.prepare(`
      DELETE FROM pending_signals
      WHERE status IN ('approved', 'rejected', 'failed')
      AND reviewed_at < ?
    `);

    const result = stmt.run(cutoffDate.toISOString());

    logger.info('Old pending signals cleaned up', {
      deleted: result.changes,
      daysOld,
    });

    return result.changes;
  }
}
