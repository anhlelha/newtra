import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';

export function createWebhookRouter(controller: WebhookController): Router {
  const router = Router();

  // Authentication temporarily disabled for testing - TradingView doesn't support custom headers
  router.post('/tradingview', (req, res, next) => {
    controller.handleTradingViewWebhook(req, res).catch(next);
  });

  return router;
}
