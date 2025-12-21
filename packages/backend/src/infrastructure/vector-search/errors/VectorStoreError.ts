import { type AppError, internalError } from '@core/errors';

export function createVectorStoreError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Vector store error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

export function createVectorStoreIndexError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Vector store index error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

export function createVectorStoreAddError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Vector store add error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

export function createVectorStoreSearchError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Vector store search error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

export function createVectorStoreDeleteError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Vector store delete error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}

export function createVectorStoreDimensionError(
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  return internalError('Vector store dimension mismatch error', {
    cause: error instanceof Error ? error : undefined,
    metadata: { error, ...metadata },
  });
}
