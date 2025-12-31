import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';
import zod from 'zod';

/**
 * Supported lock client types.
 */
const lockClients = zod.enum(['redis']);
export type LockClientType = zod.infer<typeof lockClients>;

/**
 * Options for acquiring a lock.
 */
export interface LockOptions {
  /**
   * Time-to-live in seconds. Lock automatically releases after this duration.
   * Prevents deadlocks if the holder crashes without releasing.
   * @default 300 (5 minutes)
   */
  ttl?: number;

  /**
   * Optional identifier for the lock holder.
   * If not provided, the context's correlationId will be used.
   */
  holderId?: string;
}

/**
 * Handle returned when a lock is successfully acquired.
 * Used to release or extend the lock.
 */
export interface LockHandle {
  readonly key: string;
  readonly holderId: string;
  readonly expiresAt: number;

  /**
   * Release this lock.
   * @returns true if released, false if lock was already released or expired
   */
  release(): Promise<Result<boolean, AppError>>;

  /**
   * Extend the lock's TTL.
   * @param ttl - New TTL in seconds
   * @returns true if extended, false if lock was already released or expired
   */
  extend(ttl: number): Promise<Result<boolean, AppError>>;
}

/**
 * Low-level lock adapter interface.
 * Implementations provide the actual locking mechanism (Redis, Postgres, etc.)
 */
export type ILockAdapter = Readonly<{
  /**
   * Attempt to acquire a lock atomically.
   * @returns true if acquired, false if already held by another
   */
  tryAcquire(
    key: string,
    holderId: string,
    ttlSeconds: number,
  ): Promise<Result<boolean, AppError>>;

  /**
   * Release a lock if held by the specified holder.
   * @returns true if released, false if not held by this holder
   */
  release(key: string, holderId: string): Promise<Result<boolean, AppError>>;

  /**
   * Extend a lock's TTL if held by the specified holder.
   * @returns true if extended, false if not held by this holder
   */
  extend(
    key: string,
    holderId: string,
    ttlSeconds: number,
  ): Promise<Result<boolean, AppError>>;

  /**
   * Check if a lock is currently held.
   */
  isLocked(key: string): Promise<Result<boolean, AppError>>;
}>;
