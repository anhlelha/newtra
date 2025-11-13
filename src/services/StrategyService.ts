import { v4 as uuidv4 } from 'uuid';
import databaseService from '../database';
import { createModuleLogger } from '../utils/logger';

const logger = createModuleLogger('StrategyService');

export interface Strategy {
  id: string;
  name: string;
  type: 'automatic' | 'manual';
  description?: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStrategyInput {
  name: string;
  type: 'automatic' | 'manual';
  description?: string;
  enabled?: boolean;
}

export interface UpdateStrategyInput {
  name?: string;
  type?: 'automatic' | 'manual';
  description?: string;
  enabled?: boolean;
}

export class StrategyService {
  private db = databaseService.getDatabase();

  /**
   * Get all strategies
   */
  getAllStrategies(): Strategy[] {
    const stmt = this.db.prepare(`
      SELECT * FROM strategies
      ORDER BY created_at DESC
    `);

    return stmt.all() as Strategy[];
  }

  /**
   * Get strategies by type
   */
  getStrategiesByType(type: 'automatic' | 'manual'): Strategy[] {
    const stmt = this.db.prepare(`
      SELECT * FROM strategies
      WHERE type = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(type) as Strategy[];
  }

  /**
   * Get enabled strategies
   */
  getEnabledStrategies(): Strategy[] {
    const stmt = this.db.prepare(`
      SELECT * FROM strategies
      WHERE enabled = 1
      ORDER BY created_at DESC
    `);

    return stmt.all() as Strategy[];
  }

  /**
   * Get strategy by ID
   */
  getStrategyById(id: string): Strategy | null {
    const stmt = this.db.prepare(`
      SELECT * FROM strategies
      WHERE id = ?
    `);

    return (stmt.get(id) as Strategy) || null;
  }

  /**
   * Get strategy by name
   */
  getStrategyByName(name: string): Strategy | null {
    const stmt = this.db.prepare(`
      SELECT * FROM strategies
      WHERE name = ?
    `);

    return (stmt.get(name) as Strategy) || null;
  }

  /**
   * Create a new strategy
   */
  createStrategy(input: CreateStrategyInput): Strategy {
    const id = uuidv4();
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO strategies (id, name, type, description, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      input.name,
      input.type,
      input.description || null,
      input.enabled !== undefined ? (input.enabled ? 1 : 0) : 1,
      now,
      now
    );

    logger.info('Strategy created', { id, name: input.name, type: input.type });

    return this.getStrategyById(id)!;
  }

  /**
   * Update strategy
   */
  updateStrategy(id: string, input: UpdateStrategyInput): Strategy | null {
    const strategy = this.getStrategyById(id);
    if (!strategy) {
      logger.warn('Strategy not found', { id });
      return null;
    }

    const updates: string[] = [];
    const values: any[] = [];

    if (input.name !== undefined) {
      updates.push('name = ?');
      values.push(input.name);
    }

    if (input.type !== undefined) {
      updates.push('type = ?');
      values.push(input.type);
    }

    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }

    if (input.enabled !== undefined) {
      updates.push('enabled = ?');
      values.push(input.enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return strategy;
    }

    values.push(id);

    const stmt = this.db.prepare(`
      UPDATE strategies
      SET ${updates.join(', ')}
      WHERE id = ?
    `);

    stmt.run(...values);

    logger.info('Strategy updated', { id, updates: Object.keys(input) });

    return this.getStrategyById(id);
  }

  /**
   * Delete strategy
   */
  deleteStrategy(id: string): boolean {
    // Check if strategy has pending signals
    const pendingCount = this.db
      .prepare('SELECT COUNT(*) as count FROM pending_signals WHERE strategy_id = ? AND status = ?')
      .get(id, 'pending') as { count: number };

    if (pendingCount.count > 0) {
      logger.warn('Cannot delete strategy with pending signals', {
        id,
        pendingCount: pendingCount.count,
      });
      throw new Error('Cannot delete strategy with pending signals');
    }

    const stmt = this.db.prepare('DELETE FROM strategies WHERE id = ?');
    const result = stmt.run(id);

    if (result.changes > 0) {
      logger.info('Strategy deleted', { id });
      return true;
    }

    return false;
  }

  /**
   * Toggle strategy enabled status
   */
  toggleStrategy(id: string): Strategy | null {
    const strategy = this.getStrategyById(id);
    if (!strategy) {
      return null;
    }

    const stmt = this.db.prepare(`
      UPDATE strategies
      SET enabled = ?
      WHERE id = ?
    `);

    stmt.run(strategy.enabled ? 0 : 1, id);

    logger.info('Strategy toggled', { id, enabled: !strategy.enabled });

    return this.getStrategyById(id);
  }
}
