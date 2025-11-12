import { Request, Response } from 'express';
import { createModuleLogger } from '../../utils/logger';
import { BinanceClient } from '../../services/binance/BinanceClient';
import { OrderManager } from '../../services/OrderManager';
import { RiskManager } from '../../services/RiskManager';
import databaseService from '../../database';
import config from '../../config';
import os from 'os';

const logger = createModuleLogger('AdminController');

export class AdminController {
  constructor(
    private binanceClient: BinanceClient,
    private orderManager: OrderManager,
    private riskManager: RiskManager
  ) {}

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
}
