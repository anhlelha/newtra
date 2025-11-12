import { Request, Response, NextFunction } from 'express';
import { TradingError } from '../../utils/errors';
import logger from '../../utils/logger';
import { ZodError } from 'zod';

export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error('Request error', {
    path: req.path,
    method: req.method,
    error: error.message,
    stack: error.stack,
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: {
        type: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: error.errors,
      },
    });
  }

  // Handle custom trading errors
  if (error instanceof TradingError) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  // Handle unknown errors
  return res.status(500).json({
    error: {
      type: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    },
  });
};
