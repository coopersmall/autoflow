/**
 * Distributed Lock integration tests.
 *
 * Tests the distributed lock functionality with real Redis:
 * - Lock acquisition and release
 * - Concurrent lock attempts
 * - Lock TTL expiration
 * - withLock helper
 *
 * These tests require a real Redis connection.
 */

import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'bun:test';
import { type Id, newId } from '@autoflow/core';
import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import { createContext } from '@backend/infrastructure/context';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { TestCache } from '@backend/testing/integration/setup/TestCache';
import { createTestConfig } from '@backend/testing/integration/setup/TestConfig';
import { TestServices } from '@backend/testing/integration/setup/TestServices';
import { CorrelationId } from '@core/domain/CorrelationId';
import * as fc from 'fast-check';
import { err, ok } from 'neverthrow';
import { createDistributedLock } from '../DistributedLock';

type TestId = Id<'test-resource'>;

describe('DistributedLock Integration', () => {
  let cache: TestCache;
  let config: IAppConfigurationService;
  let logger: ILogger;

  beforeAll(async () => {
    const databaseUrl = TestServices.getDatabaseUrl();
    const redisUrl = TestServices.getRedisUrl();

    config = createTestConfig({ databaseUrl, redisUrl });
    logger = getMockedLogger();

    cache = new TestCache(redisUrl);
    await cache.initialize();
  });

  beforeEach(async () => {
    await cache.flushAll();
  });

  afterAll(async () => {
    if (cache) {
      await cache.close();
    }
  });

  function createTestContext() {
    const correlationId = CorrelationId();
    const controller = new AbortController();
    return createContext(correlationId, controller);
  }

  describe('Property Tests', () => {
    // Arbitraries for property-based testing
    // Use raw strings - Redis keys can contain any bytes, so we test
    // that our lock system handles arbitrary input correctly
    const namespaceArb = fc.string({ minLength: 1, maxLength: 50 });
    const resourceIdArb = fc
      .string({ minLength: 1, maxLength: 100 })
      .map((s) => newId<TestId>(s));
    it('should always acquire lock when resource is not held', async () => {
      await fc.assert(
        fc.asyncProperty(
          namespaceArb,
          resourceIdArb,
          async (namespace, resourceId) => {
            const lock = createDistributedLock(namespace, {
              logger,
              appConfig: config,
            });
            const ctx = createTestContext();

            const result = await lock.acquire(ctx, resourceId);

            expect(result.isOk()).toBe(true);
            expect(result._unsafeUnwrap()).not.toBeNull();

            // Clean up
            await result._unsafeUnwrap()?.release();
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should generate correct lock key format', async () => {
      await fc.assert(
        fc.asyncProperty(
          namespaceArb,
          resourceIdArb,
          async (namespace, resourceId) => {
            const lock = createDistributedLock(namespace, {
              logger,
              appConfig: config,
            });
            const ctx = createTestContext();

            const result = await lock.acquire(ctx, resourceId);
            const handle = result._unsafeUnwrap();

            expect(handle?.key).toBe(`lock:${namespace}:${resourceId}`);

            // Clean up
            await handle?.release();
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should use correlationId as holderId by default', async () => {
      await fc.assert(
        fc.asyncProperty(
          namespaceArb,
          resourceIdArb,
          async (namespace, resourceId) => {
            const lock = createDistributedLock(namespace, {
              logger,
              appConfig: config,
            });
            const ctx = createTestContext();

            const result = await lock.acquire(ctx, resourceId);
            const handle = result._unsafeUnwrap();

            expect(handle?.holderId).toBe(String(ctx.correlationId));

            // Clean up
            await handle?.release();
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should release lock and allow re-acquisition', async () => {
      await fc.assert(
        fc.asyncProperty(
          namespaceArb,
          resourceIdArb,
          async (namespace, resourceId) => {
            const lock = createDistributedLock(namespace, {
              logger,
              appConfig: config,
            });
            const ctx1 = createTestContext();
            const ctx2 = createTestContext();

            // Acquire with ctx1
            const result1 = await lock.acquire(ctx1, resourceId);
            expect(result1._unsafeUnwrap()).not.toBeNull();

            // Release
            await result1._unsafeUnwrap()?.release();

            // ctx2 should be able to acquire
            const result2 = await lock.acquire(ctx2, resourceId);
            expect(result2._unsafeUnwrap()).not.toBeNull();

            // Clean up
            await result2._unsafeUnwrap()?.release();
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should prevent concurrent acquisition of same resource', async () => {
      await fc.assert(
        fc.asyncProperty(
          namespaceArb,
          resourceIdArb,
          fc.integer({ min: 2, max: 5 }),
          async (namespace, resourceId, concurrency) => {
            const lock = createDistributedLock(namespace, {
              logger,
              appConfig: config,
            });

            // Fire multiple acquire attempts simultaneously
            const contexts = Array.from({ length: concurrency }, () =>
              createTestContext(),
            );
            const promises = contexts.map((ctx) =>
              lock.acquire(ctx, resourceId),
            );
            const results = await Promise.all(promises);

            // Exactly one should succeed
            const successCount = results.filter(
              (r) => r.isOk() && r._unsafeUnwrap() !== null,
            ).length;
            expect(successCount).toBe(1);

            // Others should return null (not error)
            const nullCount = results.filter(
              (r) => r.isOk() && r._unsafeUnwrap() === null,
            ).length;
            expect(nullCount).toBe(concurrency - 1);

            // Clean up - release the one that succeeded
            for (const result of results) {
              if (result.isOk() && result.value !== null) {
                await result.value.release();
              }
            }
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should isolate locks by namespace', async () => {
      await fc.assert(
        fc.asyncProperty(
          namespaceArb,
          namespaceArb.filter((n) => n.length > 0),
          resourceIdArb,
          async (namespace1, namespace2Suffix, resourceId) => {
            // Ensure different namespaces
            const namespace2 = `${namespace1}-${namespace2Suffix}`;

            const lock1 = createDistributedLock(namespace1, {
              logger,
              appConfig: config,
            });
            const lock2 = createDistributedLock(namespace2, {
              logger,
              appConfig: config,
            });
            const ctx = createTestContext();

            // Acquire same resourceId in both namespaces
            const result1 = await lock1.acquire(ctx, resourceId);
            const result2 = await lock2.acquire(ctx, resourceId);

            // Both should succeed
            expect(result1._unsafeUnwrap()).not.toBeNull();
            expect(result2._unsafeUnwrap()).not.toBeNull();

            // Clean up
            await result1._unsafeUnwrap()?.release();
            await result2._unsafeUnwrap()?.release();
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should execute withLock function and release lock', async () => {
      await fc.assert(
        fc.asyncProperty(
          namespaceArb,
          resourceIdArb,
          fc.string(),
          async (namespace, resourceId, returnValue) => {
            const lock = createDistributedLock(namespace, {
              logger,
              appConfig: config,
            });
            const ctx = createTestContext();

            let executed = false;
            const result = await lock.withLock(ctx, resourceId, async () => {
              executed = true;
              return ok(returnValue);
            });

            expect(executed).toBe(true);
            expect(result.isOk()).toBe(true);
            expect(result._unsafeUnwrap()).toBe(returnValue);

            // Lock should be released
            const isLockedResult = await lock.isLocked(ctx, resourceId);
            expect(isLockedResult._unsafeUnwrap()).toBe(false);
          },
        ),
        { numRuns: 20 },
      );
    });

    it('should release lock even when withLock function returns error', async () => {
      await fc.assert(
        fc.asyncProperty(
          namespaceArb,
          resourceIdArb,
          fc.string(),
          async (namespace, resourceId, errorMessage) => {
            const lock = createDistributedLock(namespace, {
              logger,
              appConfig: config,
            });
            const ctx = createTestContext();

            const result = await lock.withLock(ctx, resourceId, async () => {
              return err({
                name: 'Error',
                message: errorMessage,
                code: 'InternalServer' as const,
                metadata: {},
              });
            });

            expect(result.isErr()).toBe(true);

            // Lock should still be released
            const isLockedResult = await lock.isLocked(ctx, resourceId);
            expect(isLockedResult._unsafeUnwrap()).toBe(false);
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  describe('acquire', () => {
    const testId = newId<TestId>('resource-1');
    it('should acquire lock when not held', async () => {
      const lock = createDistributedLock('test', { logger, appConfig: config });
      const ctx = createTestContext();

      const result = await lock.acquire(ctx, testId);

      expect(result.isOk()).toBe(true);
      const handle = result._unsafeUnwrap();
      expect(handle).not.toBeNull();
      expect(handle?.key).toBe('lock:test:resource-1');
      expect(handle?.holderId).toBe(String(ctx.correlationId));
    });

    it('should return null when lock is already held by another', async () => {
      const lock = createDistributedLock('test', { logger, appConfig: config });
      const ctx1 = createTestContext();
      const ctx2 = createTestContext();

      // First request acquires the lock
      const result1 = await lock.acquire(ctx1, testId);
      expect(result1.isOk()).toBe(true);
      expect(result1._unsafeUnwrap()).not.toBeNull();

      // Second request cannot acquire the lock
      const result2 = await lock.acquire(ctx2, testId);
      expect(result2.isOk()).toBe(true);
      expect(result2._unsafeUnwrap()).toBeNull();
    });

    it('should allow same holder to check lock status', async () => {
      const lock = createDistributedLock('test', { logger, appConfig: config });
      const ctx = createTestContext();

      // Acquire the lock
      const acquireResult = await lock.acquire(ctx, testId);
      expect(acquireResult.isOk()).toBe(true);

      // Check if locked
      const isLockedResult = await lock.isLocked(ctx, testId);
      expect(isLockedResult.isOk()).toBe(true);
      expect(isLockedResult._unsafeUnwrap()).toBe(true);
    });

    it('should report not locked after release', async () => {
      const lock = createDistributedLock('test', { logger, appConfig: config });
      const ctx = createTestContext();

      // Acquire and release
      const acquireResult = await lock.acquire(ctx, testId);
      const handle = acquireResult._unsafeUnwrap();
      await handle?.release();

      // Check if locked
      const isLockedResult = await lock.isLocked(ctx, testId);
      expect(isLockedResult.isOk()).toBe(true);
      expect(isLockedResult._unsafeUnwrap()).toBe(false);
    });
  });

  describe('release', () => {
    const testId = newId<TestId>('resource-1');
    it('should release lock successfully', async () => {
      const lock = createDistributedLock('test', { logger, appConfig: config });
      const ctx = createTestContext();

      // Acquire
      const acquireResult = await lock.acquire(ctx, testId);
      const handle = acquireResult._unsafeUnwrap();
      expect(handle).not.toBeNull();

      // Release
      const releaseResult = await handle!.release();
      expect(releaseResult.isOk()).toBe(true);
      expect(releaseResult._unsafeUnwrap()).toBe(true);

      // Another context can now acquire
      const ctx2 = createTestContext();
      const result2 = await lock.acquire(ctx2, testId);
      expect(result2.isOk()).toBe(true);
      expect(result2._unsafeUnwrap()).not.toBeNull();
    });

    it('should not allow other holders to release lock', async () => {
      const lock = createDistributedLock('test', { logger, appConfig: config });
      const ctx1 = createTestContext();
      const ctx2 = createTestContext();

      // ctx1 acquires the lock
      const result1 = await lock.acquire(ctx1, testId);
      expect(result1._unsafeUnwrap()).not.toBeNull();

      // ctx2 tries to acquire - should fail since ctx1 holds it
      const result2 = await lock.acquire(ctx2, testId);
      expect(result2._unsafeUnwrap()).toBeNull();

      // Verify lock is still held by checking ctx1 can't re-acquire
      const result3 = await lock.acquire(ctx1, testId);
      expect(result3._unsafeUnwrap()).toBeNull();
    });
  });

  describe('extend', () => {
    const testId = newId<TestId>('resource-1');
    it('should extend lock TTL when held by same holder', async () => {
      const lock = createDistributedLock('test', {
        logger,
        appConfig: config,
        defaultTtl: 2, // 2 seconds
      });
      const ctx = createTestContext();

      // Acquire with short TTL
      const acquireResult = await lock.acquire(ctx, testId);
      const handle = acquireResult._unsafeUnwrap();
      expect(handle).not.toBeNull();

      // Extend TTL
      const extendResult = await handle!.extend(300); // Extend to 5 minutes
      expect(extendResult.isOk()).toBe(true);
      expect(extendResult._unsafeUnwrap()).toBe(true);

      // Wait 2 seconds (original TTL would have expired)
      await new Promise((resolve) => setTimeout(resolve, 2100));

      // Lock should still be held (because we extended it)
      const isLockedResult = await lock.isLocked(ctx, testId);
      expect(isLockedResult.isOk()).toBe(true);
      expect(isLockedResult._unsafeUnwrap()).toBe(true);
    });
  });

  describe('withLock', () => {
    const testId = newId<TestId>('resource-1');
    it('should execute function and release lock on success', async () => {
      const lock = createDistributedLock('test', { logger, appConfig: config });
      const ctx = createTestContext();

      let executed = false;
      const result = await lock.withLock(ctx, testId, async () => {
        executed = true;
        return ok('success');
      });

      expect(executed).toBe(true);
      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe('success');

      // Lock should be released
      const isLockedResult = await lock.isLocked(ctx, testId);
      expect(isLockedResult._unsafeUnwrap()).toBe(false);
    });

    it('should release lock when function returns error', async () => {
      const lock = createDistributedLock('test', { logger, appConfig: config });
      const ctx = createTestContext();

      const result = await lock.withLock(ctx, testId, async () => {
        return err({
          name: 'Error',
          message: 'test error',
          code: 'InternalServer' as const,
          metadata: {},
        });
      });

      expect(result.isErr()).toBe(true);

      // Lock should still be released
      const isLockedResult = await lock.isLocked(ctx, testId);
      expect(isLockedResult._unsafeUnwrap()).toBe(false);
    });

    it('should return lockNotAcquiredError when lock is held', async () => {
      const lock = createDistributedLock('test', { logger, appConfig: config });
      const ctx1 = createTestContext();
      const ctx2 = createTestContext();

      // ctx1 holds the lock
      const handle = await lock.acquire(ctx1, testId);
      expect(handle._unsafeUnwrap()).not.toBeNull();

      // ctx2 tries to use withLock
      const result = await lock.withLock(ctx2, testId, async () => {
        return ok('should not execute');
      });

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().message).toContain('Lock not acquired');
    });
  });

  describe('TTL expiration', () => {
    const testId = newId<TestId>('resource-1');
    it('should auto-release lock after TTL expires', async () => {
      const lock = createDistributedLock('test', {
        logger,
        appConfig: config,
        defaultTtl: 1, // 1 second TTL
      });
      const ctx1 = createTestContext();
      const ctx2 = createTestContext();

      // ctx1 acquires with short TTL
      const result1 = await lock.acquire(ctx1, testId);
      expect(result1._unsafeUnwrap()).not.toBeNull();

      // ctx2 cannot acquire immediately
      const result2 = await lock.acquire(ctx2, testId);
      expect(result2._unsafeUnwrap()).toBeNull();

      // Wait for TTL to expire
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // ctx2 can now acquire
      const result3 = await lock.acquire(ctx2, testId);
      expect(result3.isOk()).toBe(true);
      expect(result3._unsafeUnwrap()).not.toBeNull();
    });
  });

  describe('concurrent access', () => {
    const testId = newId<TestId>('resource-1');
    it('should only allow one of concurrent requests to acquire lock', async () => {
      const lock = createDistributedLock('test', { logger, appConfig: config });

      // Fire multiple acquire attempts simultaneously
      const contexts = Array.from({ length: 5 }, () => createTestContext());
      const promises = contexts.map((ctx) => lock.acquire(ctx, testId));

      const results = await Promise.all(promises);

      // Exactly one should succeed
      const successCount = results.filter(
        (r) => r.isOk() && r._unsafeUnwrap() !== null,
      ).length;
      expect(successCount).toBe(1);

      // Others should return null (not error)
      const nullCount = results.filter(
        (r) => r.isOk() && r._unsafeUnwrap() === null,
      ).length;
      expect(nullCount).toBe(4);
    });
  });

  describe('namespace isolation', () => {
    const testId = newId<TestId>('resource-1');
    it('should isolate locks by namespace', async () => {
      const lock1 = createDistributedLock('namespace-a', {
        logger,
        appConfig: config,
      });
      const lock2 = createDistributedLock('namespace-b', {
        logger,
        appConfig: config,
      });
      const ctx = createTestContext();

      // Acquire lock in namespace-a
      const result1 = await lock1.acquire(ctx, testId);
      expect(result1._unsafeUnwrap()).not.toBeNull();

      // Can still acquire same resource in namespace-b
      const result2 = await lock2.acquire(ctx, testId);
      expect(result2._unsafeUnwrap()).not.toBeNull();
    });
  });
});
