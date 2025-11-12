import { Router } from 'express';
import { AdminController } from '../controllers/AdminController';
import { authenticateAdmin } from '../middlewares/auth';

export function createAdminRouter(controller: AdminController): Router {
  const router = Router();

  // Public health check (no auth)
  router.get('/health', (req, res, next) => {
    controller.getHealth(req, res).catch(next);
  });

  // Protected endpoints (require auth)
  router.use(authenticateAdmin);

  router.get('/status', (req, res, next) => {
    controller.getStatus(req, res).catch(next);
  });

  router.get('/positions', (req, res, next) => {
    controller.getPositions(req, res).catch(next);
  });

  router.get('/orders', (req, res, next) => {
    controller.getOrders(req, res).catch(next);
  });

  router.post('/orders/cancel/:id', (req, res, next) => {
    controller.cancelOrder(req, res).catch(next);
  });

  router.get('/balance', (req, res, next) => {
    controller.getBalance(req, res).catch(next);
  });

  router.post('/config', (req, res, next) => {
    controller.updateConfig(req, res).catch(next);
  });

  return router;
}
