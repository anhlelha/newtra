export enum ErrorType {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  BINANCE_API_ERROR = 'BINANCE_API_ERROR',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  RISK_LIMIT_EXCEEDED = 'RISK_LIMIT_EXCEEDED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  DUPLICATE_SIGNAL = 'DUPLICATE_SIGNAL',
  INVALID_SYMBOL = 'INVALID_SYMBOL',
  ORDER_FAILED = 'ORDER_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class TradingError extends Error {
  constructor(
    public type: ErrorType,
    message: string,
    public details?: any,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'TradingError';
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: {
        type: this.type,
        message: this.message,
        details: this.details,
      },
    };
  }
}

export class ValidationError extends TradingError {
  constructor(message: string, details?: any) {
    super(ErrorType.VALIDATION_ERROR, message, details, 400);
    this.name = 'ValidationError';
  }
}

export class BinanceApiError extends TradingError {
  constructor(message: string, details?: any) {
    super(ErrorType.BINANCE_API_ERROR, message, details, 502);
    this.name = 'BinanceApiError';
  }
}

export class InsufficientBalanceError extends TradingError {
  constructor(message: string, details?: any) {
    super(ErrorType.INSUFFICIENT_BALANCE, message, details, 400);
    this.name = 'InsufficientBalanceError';
  }
}

export class RiskLimitExceededError extends TradingError {
  constructor(message: string, details?: any) {
    super(ErrorType.RISK_LIMIT_EXCEEDED, message, details, 400);
    this.name = 'RiskLimitExceededError';
  }
}

export class AuthenticationError extends TradingError {
  constructor(message: string = 'Authentication failed') {
    super(ErrorType.AUTHENTICATION_ERROR, message, undefined, 401);
    this.name = 'AuthenticationError';
  }
}

export class DuplicateSignalError extends TradingError {
  constructor(message: string = 'Duplicate signal detected') {
    super(ErrorType.DUPLICATE_SIGNAL, message, undefined, 409);
    this.name = 'DuplicateSignalError';
  }
}
