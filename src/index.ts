import config from './config';
import logger from './utils/logger';
import databaseService from './database';
import { createServer } from './server';

async function main() {
  try {
    logger.info('Starting Crypto Trading Bot...', {
      nodeEnv: config.server.nodeEnv,
      port: config.server.port,
      binanceTestnet: config.binance.testnet,
      tradingEnabled: config.trading.enabled,
    });

    // Initialize database
    logger.info('Initializing database...');
    const db = databaseService.getDatabase();
    if (!db) {
      throw new Error('Failed to initialize database');
    }

    // Create Express server
    const app = createServer();

    // Start server
    const server = app.listen(config.server.port, () => {
      logger.info(`Server listening on port ${config.server.port}`);
      logger.info('Trading bot started successfully');
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      server.close(() => {
        logger.info('HTTP server closed');
      });

      // Close database connection
      databaseService.close();

      logger.info('Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      shutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
    });
  } catch (error) {
    logger.error('Failed to start application', { error });
    process.exit(1);
  }
}

main();
