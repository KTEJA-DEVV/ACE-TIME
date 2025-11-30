import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string | number;
  errors?: any;
}

// Error types for better categorization
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE = 'DUPLICATE_ERROR',
  DATABASE = 'DATABASE_ERROR',
  EXTERNAL_SERVICE = 'EXTERNAL_SERVICE_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
}

// Custom error class
export class ApiError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  type: ErrorType;
  details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    type: ErrorType = ErrorType.INTERNAL,
    details?: any
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.type = type;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error classes
export class ValidationError extends ApiError {
  constructor(message: string, details?: any) {
    super(message, 400, ErrorType.VALIDATION, details);
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, ErrorType.AUTHENTICATION);
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Access denied') {
    super(message, 403, ErrorType.AUTHORIZATION);
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, ErrorType.NOT_FOUND);
  }
}

export class DuplicateError extends ApiError {
  constructor(field: string) {
    super(`${field} already exists`, 409, ErrorType.DUPLICATE);
  }
}

export class ExternalServiceError extends ApiError {
  constructor(service: string, originalError?: any) {
    super(
      `External service error: ${service}`,
      503,
      ErrorType.EXTERNAL_SERVICE,
      { service, originalError: originalError?.message }
    );
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfter?: number) {
    super('Too many requests, please try again later', 429, ErrorType.RATE_LIMIT, { retryAfter });
  }
}

// Handle MongoDB errors
const handleMongooseError = (err: any): ApiError => {
  // Duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return new DuplicateError(field);
  }

  // Validation error
  if (err instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(err.errors).map((e: any) => ({
      field: e.path,
      message: e.message,
    }));
    return new ValidationError('Validation failed', errors);
  }

  // Cast error (invalid ObjectId, etc.)
  if (err instanceof mongoose.Error.CastError) {
    return new ValidationError(`Invalid ${err.path}: ${err.value}`);
  }

  return new ApiError('Database error', 500, ErrorType.DATABASE);
};

// Handle JWT errors
const handleJWTError = (err: any): ApiError => {
  if (err.name === 'JsonWebTokenError') {
    return new AuthenticationError('Invalid token');
  }
  if (err.name === 'TokenExpiredError') {
    return new AuthenticationError('Token expired');
  }
  return new AuthenticationError('Authentication failed');
};

// Handle OpenAI errors
const handleOpenAIError = (err: any): ApiError => {
  if (err.status === 429) {
    return new RateLimitError();
  }
  if (err.status === 401) {
    return new ExternalServiceError('OpenAI', { message: 'Invalid API key' });
  }
  return new ExternalServiceError('OpenAI', err);
};

// Main error handler middleware
export const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let error: ApiError;

  // Convert known error types
  if (err instanceof ApiError) {
    error = err;
  } else if (err.name === 'MongoError' || err.name === 'MongoServerError' || err instanceof mongoose.Error) {
    error = handleMongooseError(err);
  } else if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    error = handleJWTError(err);
  } else if ((err as any).status && (err as any).error?.type?.includes('openai')) {
    error = handleOpenAIError(err);
  } else {
    // Unknown error
    error = new ApiError(
      process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
      500,
      ErrorType.INTERNAL
    );
  }

  // Log error
  console.error(`[${new Date().toISOString()}] ${error.type}:`, {
    message: error.message,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });

  // Send response
  res.status(error.statusCode).json({
    success: false,
    error: {
      message: error.message,
      type: error.type,
      ...(error.details && { details: error.details }),
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
};

// Legacy createError for backward compatibility
export const createError = (message: string, statusCode: number): AppError => {
  return new ApiError(message, statusCode);
};

// Async handler wrapper
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Not found handler
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
  next(new NotFoundError(`Route ${req.originalUrl}`));
};

// Unhandled rejection handler
export const setupUnhandledRejectionHandler = () => {
  process.on('unhandledRejection', (reason: any) => {
    console.error('[UNHANDLED REJECTION]:', reason);
    // In production, you might want to gracefully shutdown
  });

  process.on('uncaughtException', (error: Error) => {
    console.error('[UNCAUGHT EXCEPTION]:', error);
    // In production, gracefully shutdown
    process.exit(1);
  });
};

