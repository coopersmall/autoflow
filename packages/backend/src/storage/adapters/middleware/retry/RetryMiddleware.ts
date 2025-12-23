/**
 * Retry middleware for storage operations.
 *
 * This middleware wraps an IStorageProvider and adds automatic retry
 * with exponential backoff for transient failures.
 *
 * @module storage/adapters/middleware/retry/RetryMiddleware
 */

import type { AppError } from "@core/errors/AppError";
import type { Result } from "neverthrow";
import type { RetryConfig } from "../../../domain/MiddlewareConfig";
import type {
  IStorageProvider,
  ListOptions,
  ListResult,
  ObjectMetadata,
  PutStreamOptions,
  SignedUploadUrlOptions,
} from "../../../domain/StorageProvider";
import { withRetry } from "./actions/withRetry";

/**
 * Creates a retry middleware that wraps a storage provider.
 *
 * The middleware automatically retries operations that fail with transient
 * errors (timeouts, rate limits, server errors). It uses exponential backoff
 * with optional jitter to avoid thundering herd problems.
 *
 * ## Retryable vs Non-Retryable Errors
 *
 * **Retryable:** Timeout, TooManyRequests, InternalServer, GatewayTimeout
 * **Not Retryable:** BadRequest, Unauthorized, Forbidden, NotFound
 *
 * ## Streaming Operations
 *
 * `putStream()` is NOT retried because streams are consumed on first read.
 * For reliable uploads, use resumable uploads at the storage client level.
 *
 * @param inner - The storage provider to wrap
 * @param config - Retry configuration (attempts, delays, backoff)
 * @returns Storage provider with retry behavior
 *
 * @example
 * ```typescript
 * const retryingProvider = createRetryMiddleware(baseProvider, {
 *   maxAttempts: 3,
 *   initialDelayMs: 100,
 *   maxDelayMs: 5000,
 *   backoffMultiplier: 2,
 *   jitter: true,
 * });
 * ```
 */
export function createRetryMiddleware(
  inner: IStorageProvider,
  config: RetryConfig,
): IStorageProvider {
  return new RetryMiddleware(inner, config);
}

/**
 * Middleware that wraps an IStorageProvider with retry logic.
 *
 * All operations except putStream() are retried on transient failures.
 * putStream() is not retried because streams are consumed after first attempt.
 */
class RetryMiddleware implements IStorageProvider {
  constructor(
    private readonly inner: IStorageProvider,
    private readonly config: RetryConfig,
  ) {}

  /**
   * Upload via streaming - NO RETRY.
   * Streams are consumed after first attempt and cannot be retried.
   */
  async putStream(
    key: string,
    stream: ReadableStream<Uint8Array>,
    options: PutStreamOptions,
  ): Promise<Result<void, AppError>> {
    return this.inner.putStream(key, stream, options);
  }

  /**
   * Check if object exists - WITH RETRY.
   */
  async exists(key: string): Promise<Result<boolean, AppError>> {
    return withRetry(() => this.inner.exists(key), this.config);
  }

  /**
   * Delete object - WITH RETRY.
   */
  async delete(key: string): Promise<Result<void, AppError>> {
    return withRetry(() => this.inner.delete(key), this.config);
  }

  /**
   * Get object metadata - WITH RETRY.
   */
  async getMetadata(
    key: string,
  ): Promise<Result<ObjectMetadata | null, AppError>> {
    return withRetry(() => this.inner.getMetadata(key), this.config);
  }

  /**
   * Generate signed upload URL - WITH RETRY.
   */
  async getSignedUploadUrl(
    key: string,
    options: SignedUploadUrlOptions,
  ): Promise<Result<string, AppError>> {
    return withRetry(
      () => this.inner.getSignedUploadUrl(key, options),
      this.config,
    );
  }

  /**
   * Generate signed download URL - WITH RETRY.
   */
  async getSignedDownloadUrl(
    key: string,
    expiresInSeconds: number,
  ): Promise<Result<string, AppError>> {
    return withRetry(
      () => this.inner.getSignedDownloadUrl(key, expiresInSeconds),
      this.config,
    );
  }

  /**
   * List objects by prefix - WITH RETRY.
   */
  async list(
    prefix: string,
    options?: ListOptions,
  ): Promise<Result<ListResult, AppError>> {
    return withRetry(() => this.inner.list(prefix, options), this.config);
  }
}
