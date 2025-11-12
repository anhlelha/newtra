import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';
import { authenticateWebhook } from '../middlewares/auth';

export function createWebhookRouter(controller: WebhookController): Router {
  const router = Router();

  router.post('/tradingview', authenticateWebhook, (req, res, next) => {
    controller.handleTradingViewWebhook(req, res).catch(next);
  });

  return router;
}
