/**
 * Error module exports.
 * Provides AppError pattern with factory functions for creating errors.
 */

// AppError type and utilities
export type { AppError, ErrorCode, ErrorOptions } from './AppError';
export { isAppError } from './AppError';

// Error factory functions (primary API)
export {
  badRequest,
  forbidden,
  gatewayTimeout,
  internalError,
  notFound,
  timeout,
  tooManyRequests,
  unauthorized,
  validationError,
} from './factories';

// Utility functions
export * from './getErrorFromString';
