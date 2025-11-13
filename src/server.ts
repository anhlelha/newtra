import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config';
import logger from './utils/logger';
import { errorHandler } from './api/middlewares/errorHandler';
import { BinanceClient } from './services/binance/BinanceClient';
import { SignalProcessor } from './services/SignalProcessor';
import { RiskManager } from './services/RiskManager';
import { OrderManager } from './services/OrderManager';
import { WebhookController } from './api/controllers/WebhookController';
import { AdminController } from './api/controllers/AdminController';
import { createWebhookRouter } from './api/routes/webhook';
import { createAdminRouter } from './api/routes/admin';

export function createServer(): Express {
  const app = express();

  // CORS configuration - must be before other middleware
  app.use(
    cors({
      origin: config.server.nodeEnv === 'development'
        ? ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173']
        : process.env.FRONTEND_URL || '*',
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-webhook-secret'],
    })
  );

  // Security middleware
  app.use(helmet());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.security.rateLimitWindowMs,
    max: config.security.rateLimitMaxRequests,
    message: 'Too many requests from this IP',
  });
  app.use(limiter);

  // Request logging
  app.use((req, _res, next) => {
    logger.info('Incoming request', {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });

  // Initialize services
  logger.info('Initializing services...');

  const binanceClient = new BinanceClient({
    apiKey: config.binance.apiKey,
    apiSecret: config.binance.apiSecret,
    testnet: config.binance.testnet,
  });

  const signalProcessor = new SignalProcessor();
  const riskManager = new RiskManager(binanceClient);
  const orderManager = new OrderManager(binanceClient, riskManager, signalProcessor);

  // Initialize controllers
  const webhookController = new WebhookController(signalProcessor, orderManager);
  const adminController = new AdminController(binanceClient, orderManager, riskManager, signalProcessor);

  // Setup routes
  app.use('/webhook', createWebhookRouter(webhookController));
  app.use('/api', createAdminRouter(adminController));

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      name: 'Crypto Trading Bot',
      version: '1.0.0',
      status: 'running',
    });
  });

  // 404 handler
  app.use((_req, res) => {
    res.status(404).json({
      error: {
        type: 'NOT_FOUND',
        message: 'Endpoint not found',
      },
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  logger.info('Server initialized successfully');

  return app;
}
