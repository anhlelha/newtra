import { Request, Response } from 'express';
import { createModuleLogger } from '../../utils/logger';
import { tradingViewSignalSchema } from '../schemas/webhook.schema';
import { SignalProcessor } from '../../services/SignalProcessor';
import { OrderManager } from '../../services/OrderManager';

const logger = createModuleLogger('WebhookController');

export class WebhookController {
  constructor(
    private signalProcessor: SignalProcessor,
    private orderManager: OrderManager
  ) {}

  async handleTradingViewWebhook(req: Request, res: Response) {
    try {
      logger.info('Received TradingView webhook', {
        body: req.body,
        ip: req.ip,
      });

      // Validate payload
      const signal = tradingViewSignalSchema.parse(req.body);

      // Process signal (async - don't wait)
      const signalId = await this.signalProcessor.processSignal(signal);

      // Return 200 OK immediately
      res.status(200).json({
        success: true,
        message: 'Signal received and processing',
        signalId,
      });

      // Execute order asynchronously (don't wait for response)
      this.executeOrderAsync(signalId, signal);
    } catch (error) {
      logger.error('Webhook processing failed', { error });
      throw error;
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
