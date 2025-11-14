import { Request, Response } from 'express';
import { createModuleLogger } from '../../utils/logger';
import { BinanceClient } from '../../services/binance/BinanceClient';
import { OrderManager } from '../../services/OrderManager';
import { RiskManager } from '../../services/RiskManager';
import { SignalProcessor } from '../../services/SignalProcessor';
import { StrategyService } from '../../services/StrategyService';
import { PendingSignalService } from '../../services/PendingSignalService';
import databaseService from '../../database';
import config from '../../config';
import os from 'os';

const logger = createModuleLogger('AdminController');

export class AdminController {
  private strategyService: StrategyService;
  private pendingSignalService: PendingSignalService;

  constructor(
    private binanceClient: BinanceClient,
    private orderManager: OrderManager,
    private riskManager: RiskManager,
    private signalProcessor: SignalProcessor
  ) {
    this.strategyService = new StrategyService();
    this.pendingSignalService = new PendingSignalService();
  }

  async getHealth(_req: Request, res: Response) {
    try {
      const dbHealthy = databaseService.healthCheck();
      const binanceHealthy = await this.binanceClient.ping();

      const status = dbHealthy && binanceHealthy ? 'healthy' : 'unhealthy';

      const freeMem = os.freemem();
      const totalMem = os.totalmem();
      const memoryUsagePercent = ((totalMem - freeMem) / totalMem) * 100;

      res.status(200).json({
        status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          database: dbHealthy,
          binance: binanceHealthy,
          disk: true, // Can add disk space check
          memory: memoryUsagePercent < 90,
        },
        system: {
          memory: {
            free: freeMem,
            total: totalMem,
            usagePercent: memoryUsagePercent.toFixed(2),
          },
          uptime: os.uptime(),
        },
      });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(503).json({
        status: 'unhealthy',
        error: (error as Error).message,
      });
    }
  }

  async getStatus(_req: Request, res: Response) {
    try {
      const db = databaseService.getDatabase();

      // Get open positions count
      const openPositions = db
        .prepare("SELECT COUNT(*) as count FROM positions WHERE status = 'OPEN'")
        .get() as { count: number };

      // Get today's PnL
      const todayPnL = db
        .prepare(
          `
        SELECT COALESCE(SUM(realized_pnl), 0) as pnl
        FROM positions
        WHERE DATE(closed_at) = DATE('now')
      `
        )
        .get() as { pnl: number };

      // Get total exposure
      const exposure = await this.riskManager.getCurrentExposure();

      res.status(200).json({
        status: 'running',
        tradingEnabled: config.trading.enabled,
        openPositions: openPositions.count,
        todayPnL: todayPnL.pnl,
        currentExposure: exposure,
        uptime: process.uptime(),
      });
    } catch (error) {
      logger.error('Failed to get status', { error });
      throw error;
    }
  }

  async getPositions(req: Request, res: Response) {
    try {
      const db = databaseService.getDatabase();
      const { status = 'OPEN' } = req.query;

      const positions = db
        .prepare(
          `
        SELECT * FROM positions
        WHERE status = ?
        ORDER BY opened_at DESC
      `
        )
        .all(status);

      // Get current prices and calculate unrealized PnL for open positions
      if (status === 'OPEN') {
        for (const position of positions as any[]) {
          try {
            const currentPrice = await this.binanceClient.getPrice(position.symbol);
            position.currentPrice = currentPrice;
            position.unrealizedPnL =
              (currentPrice - position.entry_price) *
              position.quantity *
              (position.side === 'LONG' ? 1 : -1);
          } catch (error) {
            logger.warn(`Failed to get price for ${position.symbol}`, { error });
          }
        }
      }

      res.status(200).json(positions);
    } catch (error) {
      logger.error('Failed to get positions', { error });
      throw error;
    }
  }

  async getOrders(req: Request, res: Response) {
    try {
      const { symbol, status, limit = 100 } = req.query;

      const orders = await this.orderManager.getOrders({
        symbol: symbol as string,
        status: status as string,
        limit: parseInt(limit as string, 10),
      });

      res.status(200).json(orders);
    } catch (error) {
      logger.error('Failed to get orders', { error });
      throw error;
    }
  }

  async cancelOrder(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await this.orderManager.cancelOrder(id);

      res.status(200).json({
        success: true,
        message: 'Order cancelled',
        orderId: id,
      });
    } catch (error) {
      logger.error('Failed to cancel order', { error });
      throw error;
    }
  }

  async getBalance(req: Request, res: Response) {
    try {
      const { asset = 'USDT' } = req.query;

      const balance = await this.binanceClient.getBalance(asset as string);

      res.status(200).json(balance);
    } catch (error) {
      logger.error('Failed to get balance', { error });
      throw error;
    }
  }

  async updateConfig(req: Request, res: Response) {
    try {
      const updates = req.body;

      const db = databaseService.getDatabase();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value)
        VALUES (?, ?)
      `);

      for (const [key, value] of Object.entries(updates)) {
        stmt.run(key, JSON.stringify(value));
      }

      logger.info('Configuration updated', { updates });

      res.status(200).json({
        success: true,
        message: 'Configuration updated',
        updates,
      });
    } catch (error) {
      logger.error('Failed to update config', { error });
      throw error;
    }
  }

  async getRiskConfig(_req: Request, res: Response) {
    try {
      const db = databaseService.getDatabase();
      const stmt = db.prepare(`
        SELECT key, value
        FROM config
        WHERE key LIKE 'trading.%'
      `);

      const configRows = stmt.all() as Array<{ key: string; value: string }>;

      logger.info('getRiskConfig - DB rows:', { count: configRows.length, rows: configRows });

      const riskConfig = {
        defaultPositionSizePercent: config.trading.defaultPositionSizePercent,
        maxPositionSizePercent: config.trading.maxPositionSizePercent,
        maxTotalExposurePercent: config.trading.maxTotalExposurePercent,
        maxDailyLoss: config.trading.maxDailyLoss,
        enableStopLoss: config.trading.enableStopLoss,
        defaultStopLossPercent: config.trading.defaultStopLossPercent,
        enabled: config.trading.enabled,
      };

      logger.info('getRiskConfig - Initial (from config file):', { enabled: riskConfig.enabled });

      // Override with database values if they exist
      for (const row of configRows) {
        let value;
        try {
          value = JSON.parse(row.value);
        } catch (e) {
          // If JSON parsing fails, try to convert the value manually
          if (row.value === 'true') value = true;
          else if (row.value === 'false') value = false;
          else if (!isNaN(Number(row.value))) value = Number(row.value);
          else value = row.value; // Keep as string
        }

        switch (row.key) {
          case 'trading.defaultPositionSizePercent':
            riskConfig.defaultPositionSizePercent = value;
            break;
          case 'trading.maxPositionSizePercent':
            riskConfig.maxPositionSizePercent = value;
            break;
          case 'trading.maxTotalExposurePercent':
            riskConfig.maxTotalExposurePercent = value;
            break;
          case 'trading.maxDailyLoss':
            riskConfig.maxDailyLoss = value;
            break;
          case 'trading.enableStopLoss':
            riskConfig.enableStopLoss = value;
            break;
          case 'trading.defaultStopLossPercent':
            riskConfig.defaultStopLossPercent = value;
            break;
          case 'trading.enabled':
            logger.info('getRiskConfig - Setting enabled from DB:', { value, parsedValue: value });
            riskConfig.enabled = value;
            break;
        }
      }

      logger.info('getRiskConfig - Final riskConfig:', { enabled: riskConfig.enabled });

      return res.status(200).json(riskConfig);
    } catch (error) {
      logger.error('Failed to get risk config', { error });
      return res.status(500).json({
        error: 'Failed to get risk configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateRiskConfig(req: Request, res: Response) {
    try {
      const {
        defaultPositionSizePercent,
        maxPositionSizePercent,
        maxTotalExposurePercent,
        maxDailyLoss,
        enableStopLoss,
        defaultStopLossPercent,
        enabled,
      } = req.body;

      const db = databaseService.getDatabase();
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO config (key, value)
        VALUES (?, ?)
      `);

      const updates: Record<string, any> = {};

      if (defaultPositionSizePercent !== undefined) {
        stmt.run('trading.defaultPositionSizePercent', JSON.stringify(defaultPositionSizePercent));
        updates.defaultPositionSizePercent = defaultPositionSizePercent;
      }

      if (maxPositionSizePercent !== undefined) {
        stmt.run('trading.maxPositionSizePercent', JSON.stringify(maxPositionSizePercent));
        updates.maxPositionSizePercent = maxPositionSizePercent;
      }

      if (maxTotalExposurePercent !== undefined) {
        stmt.run('trading.maxTotalExposurePercent', JSON.stringify(maxTotalExposurePercent));
        updates.maxTotalExposurePercent = maxTotalExposurePercent;
      }

      if (maxDailyLoss !== undefined) {
        stmt.run('trading.maxDailyLoss', JSON.stringify(maxDailyLoss));
        updates.maxDailyLoss = maxDailyLoss;
      }

      if (enableStopLoss !== undefined) {
        stmt.run('trading.enableStopLoss', JSON.stringify(enableStopLoss));
        updates.enableStopLoss = enableStopLoss;
      }

      if (defaultStopLossPercent !== undefined) {
        stmt.run('trading.defaultStopLossPercent', JSON.stringify(defaultStopLossPercent));
        updates.defaultStopLossPercent = defaultStopLossPercent;
      }

      if (enabled !== undefined) {
        stmt.run('trading.enabled', JSON.stringify(enabled));
        updates.enabled = enabled;
      }

      logger.info('Risk configuration updated', { updates });

      return res.status(200).json({
        success: true,
        message: 'Risk configuration updated successfully',
        updates,
      });
    } catch (error) {
      logger.error('Failed to update risk config', { error });
      return res.status(500).json({
        error: 'Failed to update risk configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getSignals(req: Request, res: Response) {
    try {
      const { limit = 20 } = req.query;

      const signals = await this.signalProcessor.getRecentSignals(
        parseInt(limit as string, 10)
      );

      res.status(200).json(signals);
    } catch (error) {
      logger.error('Failed to get signals', { error });
      throw error;
    }
  }

  // ========== Strategy Management ==========

  async getAllStrategies(_req: Request, res: Response) {
    try {
      const strategies = this.strategyService.getAllStrategies();
      res.status(200).json(strategies);
    } catch (error) {
      logger.error('Failed to get strategies', { error });
      throw error;
    }
  }

  async getStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const strategy = this.strategyService.getStrategyById(id);

      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      res.status(200).json(strategy);
    } catch (error) {
      logger.error('Failed to get strategy', { error });
      throw error;
    }
  }

  async createStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { name, type, description, enabled } = req.body;

      if (!name || !type) {
        res.status(400).json({ error: 'Name and type are required' });
        return;
      }

      if (type !== 'automatic' && type !== 'manual') {
        res.status(400).json({ error: 'Type must be automatic or manual' });
        return;
      }

      const strategy = this.strategyService.createStrategy({
        name,
        type,
        description,
        enabled,
      });

      res.status(201).json(strategy);
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(409).json({ error: 'Strategy name already exists' });
        return;
      }
      logger.error('Failed to create strategy', { error });
      throw error;
    }
  }

  async updateStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { name, type, description, enabled } = req.body;

      if (type && type !== 'automatic' && type !== 'manual') {
        res.status(400).json({ error: 'Type must be automatic or manual' });
        return;
      }

      const strategy = this.strategyService.updateStrategy(id, {
        name,
        type,
        description,
        enabled,
      });

      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      res.status(200).json(strategy);
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT') {
        res.status(409).json({ error: 'Strategy name already exists' });
        return;
      }
      logger.error('Failed to update strategy', { error });
      throw error;
    }
  }

  async deleteStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = this.strategyService.deleteStrategy(id);

      if (!deleted) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      res.status(204).send();
    } catch (error: any) {
      if (error.message?.includes('pending signals')) {
        res.status(400).json({ error: error.message });
        return;
      }
      logger.error('Failed to delete strategy', { error });
      throw error;
    }
  }

  async toggleStrategy(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const strategy = this.strategyService.toggleStrategy(id);

      if (!strategy) {
        res.status(404).json({ error: 'Strategy not found' });
        return;
      }

      res.status(200).json(strategy);
    } catch (error) {
      logger.error('Failed to toggle strategy', { error });
      throw error;
    }
  }

  // ========== Pending Signals Management ==========

  async getPendingSignals(req: Request, res: Response) {
    try {
      const { status, strategyId } = req.query;
      const signals = this.pendingSignalService.getAllPendingSignals(
        status as any,
        strategyId as string
      );
      logger.info('Returning pending signals with strategy names', {
        count: signals.length,
        sample: signals[0] ? { id: signals[0].id, strategy_name: signals[0].strategy_name } : null
      });
      res.status(200).json(signals);
    } catch (error) {
      logger.error('Failed to get pending signals', { error });
      throw error;
    }
  }

  async getPendingSignalsCount(_req: Request, res: Response) {
    try {
      const count = this.pendingSignalService.getPendingSignalsCount();
      res.status(200).json({ count });
    } catch (error) {
      logger.error('Failed to get pending signals count', { error });
      throw error;
    }
  }

  async approvePendingSignal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const pendingSignal = this.pendingSignalService.approvePendingSignal(id, 'admin');

      if (!pendingSignal) {
        return res.status(404).json({ error: 'Pending signal not found' });
      }

      // Execute the approved signal
      const signalData = JSON.parse(pendingSignal.signal_data);
      this.executeApprovedSignalAsync(
        id,
        pendingSignal.signal_id,
        signalData,
        pendingSignal.strategy_id
      );

      return res.status(200).json(pendingSignal);
    } catch (error) {
      logger.error('Failed to approve pending signal', { error });
      throw error;
    }
  }

  async rejectPendingSignal(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const pendingSignal = this.pendingSignalService.rejectPendingSignal(id, 'admin');

      if (!pendingSignal) {
        return res.status(404).json({ error: 'Pending signal not found' });
      }

      return res.status(200).json(pendingSignal);
    } catch (error) {
      logger.error('Failed to reject pending signal', { error });
      throw error;
    }
  }

  private async executeApprovedSignalAsync(
    pendingSignalId: string,
    signalId: string,
    signal: any,
    strategyId?: string
  ) {
    try {
      // Bypass risk checks for manually approved signals (when Risk Management is enabled)
      // isManualApproval=true prevents creating REJECTED orders if Binance fails
      const orderId = await this.orderManager.executeFromSignal(
        signalId,
        signal,
        strategyId,
        true, // bypassEnabledCheck = true
        true  // isManualApproval = true
      );

      // Update pending signal with order ID
      this.pendingSignalService.updateOrderId(pendingSignalId, orderId);

      logger.info('Order executed from approved signal', {
        pendingSignalId,
        signalId,
        orderId,
        strategyId,
      });
    } catch (error: any) {
      // Mark pending signal as failed with error message
      const errorMessage = error?.error?.message || error?.message || 'Unknown error';
      this.pendingSignalService.markAsFailed(pendingSignalId, errorMessage);

      logger.error('Failed to execute order from approved signal', {
        pendingSignalId,
        signalId,
        error,
      });
    }
  }
}
