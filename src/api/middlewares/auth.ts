import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../../utils/errors';
import config from '../../config';

export const authenticateWebhook = (req: Request, _res: Response, next: NextFunction) => {
  // Skip authentication for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  const secret = req.headers['x-webhook-secret'];

  if (!secret || secret !== config.tradingView.webhookSecret) {
    throw new AuthenticationError('Invalid webhook secret');
  }

  next();
};

export const authenticateAdmin = (req: Request, _res: Response, next: NextFunction) => {
  // Skip authentication for OPTIONS requests (CORS preflight)
  if (req.method === 'OPTIONS') {
    return next();
  }

  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    throw new AuthenticationError('Authorization header required');
  }

  const token = authHeader.replace('Bearer ', '');

  if (token !== config.security.adminApiKey) {
    throw new AuthenticationError('Invalid API key');
  }

  next();
};
