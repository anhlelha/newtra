import { Request, Response } from 'express';
import { createModuleLogger } from '../../utils/logger';
import { tradingViewSignalSchema } from '../schemas/webhook.schema';
import { SignalProcessor } from '../../services/SignalProcessor';
import { OrderManager } from '../../services/OrderManager';
import { PendingSignalService } from '../../services/PendingSignalService';

const logger = createModuleLogger('WebhookController');

export class WebhookController {
  private pendingSignalService: PendingSignalService;

  constructor(
    private signalProcessor: SignalProcessor,
    private orderManager: OrderManager
  ) {
    this.pendingSignalService = new PendingSignalService();
  }

  async handleTradingViewWebhook(req: Request, res: Response) {
    try {
      logger.info('Received TradingView webhook', {
        body: req.body,
        ip: req.ip,
      });

      // Validate payload
      const signal = tradingViewSignalSchema.parse(req.body);

      // Process signal and determine strategy
      const result = await this.signalProcessor.processSignal(signal);

      // Return 200 OK immediately
      res.status(200).json({
        success: true,
        message: result.requiresApproval
          ? 'Signal received and pending manual approval'
          : 'Signal received and processing',
        signalId: result.signalId,
        strategyType: result.strategyType,
        requiresApproval: result.requiresApproval,
      });

      // Handle based on strategy type
      if (result.requiresApproval && result.strategyId) {
        // Manual strategy: create pending signal for review
        this.createPendingSignalAsync(result.signalId, result.strategyId, signal);
      } else {
        // Automatic strategy: execute order immediately
        this.executeOrderAsync(result.signalId, signal);
      }
    } catch (error) {
      logger.error('Webhook processing failed', { error });
      throw error;
    }
  }

  private async createPendingSignalAsync(
    signalId: string,
    strategyId: string,
    signal: any
  ) {
    try {
      const pendingSignal = this.pendingSignalService.createPendingSignal({
        strategy_id: strategyId,
        signal_id: signalId,
        signal,
      });

      logger.info('Pending signal created for manual review', {
        signalId,
        pendingSignalId: pendingSignal.id,
        strategyId,
      });
    } catch (error) {
      logger.error('Failed to create pending signal', {
        signalId,
        strategyId,
        error,
      });
    }
  }

  private async executeOrderAsync(signalId: string, signal: any) {
    try {
      const orderId = await this.orderManager.executeFromSignal(signalId, signal);
      logger.info('Order executed from webhook', { signalId, orderId });
    } catch (error) {
      logger.error('Failed to execute order from webhook', {
        signalId,
        error,
      });
    }
  }
}
