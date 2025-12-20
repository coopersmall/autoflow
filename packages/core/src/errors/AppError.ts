import type { CorrelationId } from '@core/domain/CorrelationId';
import zod from 'zod';

/**
 * Core error types and utilities for the application.
 * Provides a functional factory pattern for creating errors with consistent structure.
 */

const errorCodes = zod.enum([
  'BadRequest',
  'Unauthorized',
  'Forbidden',
  'NotFound',
  'InternalServer',
  'Timeout',
  'GatewayTimeout',
  'TooManyRequests',
]);

export type ErrorCode = zod.infer<typeof errorCodes>;

export interface AppError extends Error {
  readonly code: ErrorCode;
  readonly metadata: Record<string, unknown>;
}

export interface ErrorOptions {
  correlationId?: CorrelationId;
  cause?: unknown;
  metadata?: Record<string, unknown>;
}

/**
 * Internal factory for creating AppError instances.
 * Use specific factory functions (badRequest, notFound, etc.) instead of calling this directly.
 *
 * @param message - Human-readable error message
 * @param code - Error code for categorization
 * @param options - Optional cause and metadata
 * @returns AppError instance
 */
export function createAppError(
  message: string,
  code: ErrorCode,
  options?: ErrorOptions,
): AppError {
  const error = new Error(message, { cause: options?.cause });
  return Object.assign(error, { code, metadata: options?.metadata ?? {} });
}

/**
 * Type guard to check if an unknown value is an AppError.
 *
 * @param error - Unknown value to check
 * @returns True if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    'metadata' in error &&
    typeof error.metadata === 'object'
  );
}
