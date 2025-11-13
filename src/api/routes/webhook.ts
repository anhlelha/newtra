import { Router } from 'express';
import { WebhookController } from '../controllers/WebhookController';
// import { authenticateWebhook } from '../middlewares/auth'; // Disabled for testing

export function createWebhookRouter(controller: WebhookController): Router {
  const router = Router();

  // Temporarily disabled authentication for testing
  // router.post('/tradingview', authenticateWebhook, (req, res, next) => {
  router.post('/tradingview', (req, res, next) => {
    controller.handleTradingViewWebhook(req, res).catch(next);
  });

  return router;
}
