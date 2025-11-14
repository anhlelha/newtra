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

  router.post('/positions/:id/close', (req, res, next) => {
    controller.closePosition(req, res).catch(next);
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

  router.get('/balance/futures', (req, res, next) => {
    controller.getFuturesBalance(req, res).catch(next);
  });

  router.post('/config', (req, res, next) => {
    controller.updateConfig(req, res).catch(next);
  });

  // Risk management endpoints
  router.get('/risk-config', (req, res, next) => {
    controller.getRiskConfig(req, res).catch(next);
  });

  router.put('/risk-config', (req, res, next) => {
    controller.updateRiskConfig(req, res).catch(next);
  });

  router.get('/signals', (req, res, next) => {
    controller.getSignals(req, res).catch(next);
  });

  // Strategy management endpoints
  router.get('/strategies', (req, res, next) => {
    controller.getAllStrategies(req, res).catch(next);
  });

  router.get('/strategies/:id', (req, res, next) => {
    controller.getStrategy(req, res).catch(next);
  });

  router.post('/strategies', (req, res, next) => {
    controller.createStrategy(req, res).catch(next);
  });

  router.put('/strategies/:id', (req, res, next) => {
    controller.updateStrategy(req, res).catch(next);
  });

  router.delete('/strategies/:id', (req, res, next) => {
    controller.deleteStrategy(req, res).catch(next);
  });

  router.post('/strategies/:id/toggle', (req, res, next) => {
    controller.toggleStrategy(req, res).catch(next);
  });

  // Pending signals management endpoints
  router.get('/pending-signals', (req, res, next) => {
    controller.getPendingSignals(req, res).catch(next);
  });

  router.get('/pending-signals/count', (req, res, next) => {
    controller.getPendingSignalsCount(req, res).catch(next);
  });

  router.post('/pending-signals/:id/approve', (req, res, next) => {
    controller.approvePendingSignal(req, res).catch(next);
  });

  router.post('/pending-signals/:id/reject', (req, res, next) => {
    controller.rejectPendingSignal(req, res).catch(next);
  });

  return router;
}
