import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getMockedCacheAdapter } from '@backend/infrastructure/cache/adapters/__mocks__/CacheAdapter.mock';
import { getMockedCacheClientFactory } from '@backend/infrastructure/cache/clients/__mocks__/CacheClientFactory.mock';
import { SharedCache } from '@backend/infrastructure/cache/SharedCache';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { type Id, newId } from '@core/domain/Id';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import { err, ok, type Result } from 'neverthrow';
import zod from 'zod';

type TestItemId = Id<'TestItem'>;
const TestItemId = newId<TestItemId>;

const testItemIdSchema = zod.string().brand<'TestItem'>();

const testItemSchema = zod.object({
  id: testItemIdSchema,
  name: zod.string(),
  value: zod.number(),
  category: zod.string().optional(),
  createdAt: zod.date(),
  schemaVersion: zod.literal(1),
});

type TestItem = zod.infer<typeof testItemSchema>;

function validator(data: unknown): Result<TestItem, ValidationError> {
  return validate(testItemSchema, data);
}

describe('SharedCache', () => {
  let mockAdapter: ReturnType<typeof getMockedCacheAdapter>;
  let mockAppConfig: ReturnType<typeof getMockedAppConfigurationService>;
  let mockLogger: ReturnType<typeof getMockedLogger>;
  let mockCreateCacheClientFactory: ReturnType<typeof mock>;
  let mockCreateCacheAdapter: ReturnType<typeof mock>;
  let mockGenerateKey: ReturnType<typeof mock>;
  let cache: SharedCache<TestItemId, TestItem>;

  beforeEach(() => {
    mockAdapter = getMockedCacheAdapter();
    mockAppConfig = getMockedAppConfigurationService();
    mockLogger = getMockedLogger();
    mockGenerateKey = mock(
      (namespace: string, id: string) => `${namespace}/${id}`,
    );
    mockCreateCacheAdapter = mock(() => mockAdapter);
    mockCreateCacheClientFactory = mock(() => getMockedCacheClientFactory());

    cache = new SharedCache<TestItemId, TestItem>(
      'test-namespace',
      {
        logger: mockLogger,
        appConfig: mockAppConfig,
        validator,
      },
      {
        createCacheClientFactory: mockCreateCacheClientFactory,
        createCacheAdapter: mockCreateCacheAdapter,
        generateCacheKey: mockGenerateKey,
      },
    );
  });

  describe('get()', () => {
    it('should successfully get and validate an item from cache', async () => {
      const testId = TestItemId('item-123');
      const testItem: TestItem = {
        id: testId,
        name: 'Test Item',
        value: 42,
        category: 'test',
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      mockAdapter.get.mockResolvedValue(ok(testItem));

      const result = await cache.get(testId);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(testItem);
      }
      expect(mockAdapter.get).toHaveBeenCalledWith(
        'test-namespace/item-123',
        validator,
      );
      expect(mockGenerateKey).toHaveBeenCalledWith('test-namespace', testId);
    });

    it('should return error when cache adapter returns error', async () => {
      const testId = TestItemId('item-404');
      const cacheError = new ErrorWithMetadata('Cache miss', 'NotFound', {});

      mockAdapter.get.mockResolvedValue(err(cacheError));

      const result = await cache.get(testId);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache miss');
      }
    });

    it('should execute onMiss callback when cache returns error', async () => {
      const testId = TestItemId('item-miss');
      const testItem: TestItem = {
        id: testId,
        name: 'Fetched Item',
        value: 100,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      mockAdapter.get.mockResolvedValue(
        err(new ErrorWithMetadata('Cache miss', 'NotFound', {})),
      );
      mockAdapter.set.mockResolvedValue(ok(undefined));

      const onMiss = mock(async () => ok(testItem));

      const result = await cache.get(testId, onMiss);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(testItem);
      }
      expect(onMiss).toHaveBeenCalledWith(testId);
      expect(mockAdapter.set).toHaveBeenCalledWith(
        'test-namespace/item-miss',
        testItem,
        { ttl: 3600 },
      );
    });

    it('should return error if onMiss callback fails', async () => {
      const testId = TestItemId('item-error');
      const missError = new ErrorWithMetadata(
        'Database error',
        'InternalServer',
        {},
      );

      mockAdapter.get.mockResolvedValue(
        err(new ErrorWithMetadata('Cache miss', 'NotFound', {})),
      );

      const onMiss = mock(async () => err(missError));

      const result = await cache.get(testId, onMiss);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Database error');
      }
      expect(mockAdapter.set).not.toHaveBeenCalled();
    });

    it('should log error if cache set fails during onMiss', async () => {
      const testId = TestItemId('item-set-fail');
      const testItem: TestItem = {
        id: testId,
        name: 'Item',
        value: 50,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };
      const setError = new ErrorWithMetadata(
        'Cache set failed',
        'InternalServer',
        {},
      );

      mockAdapter.get.mockResolvedValue(
        err(new ErrorWithMetadata('Cache miss', 'NotFound', {})),
      );
      mockAdapter.set.mockResolvedValue(err(setError));

      const onMiss = mock(async () => ok(testItem));

      const result = await cache.get(testId, onMiss);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(testItem);
      }
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cache set failed on cache miss',
        setError,
        { id: testId, key: 'test-namespace/item-set-fail' },
      );
    });

    it('should handle items without optional fields', async () => {
      const testId = TestItemId('item-minimal');
      const testItem: TestItem = {
        id: testId,
        name: 'Minimal Item',
        value: 1,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      mockAdapter.get.mockResolvedValue(ok(testItem));

      const result = await cache.get(testId);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.category).toBeUndefined();
      }
    });
  });

  describe('set()', () => {
    it('should successfully set an item in cache with default TTL', async () => {
      const testId = TestItemId('item-123');
      const testItem: TestItem = {
        id: testId,
        name: 'Test Item',
        value: 42,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      mockAdapter.set.mockResolvedValue(ok(undefined));

      const result = await cache.set(testId, testItem);

      expect(result.isOk()).toBe(true);
      expect(mockAdapter.set).toHaveBeenCalledWith(
        'test-namespace/item-123',
        testItem,
        { ttl: 3600 },
      );
      expect(mockGenerateKey).toHaveBeenCalledWith('test-namespace', testId);
    });

    it('should successfully set an item with custom TTL', async () => {
      const testId = TestItemId('item-ttl');
      const testItem: TestItem = {
        id: testId,
        name: 'TTL Item',
        value: 99,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      mockAdapter.set.mockResolvedValue(ok(undefined));

      const result = await cache.set(testId, testItem, 7200);

      expect(result.isOk()).toBe(true);
      expect(mockAdapter.set).toHaveBeenCalledWith(
        'test-namespace/item-ttl',
        testItem,
        { ttl: 7200 },
      );
    });

    it('should return error when adapter set fails', async () => {
      const testId = TestItemId('item-error');
      const testItem: TestItem = {
        id: testId,
        name: 'Error Item',
        value: 0,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };
      const setError = new ErrorWithMetadata(
        'Cache set error',
        'InternalServer',
        {},
      );

      mockAdapter.set.mockResolvedValue(err(setError));

      const result = await cache.set(testId, testItem);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache set error');
      }
    });

    it('should handle setting items with all optional fields', async () => {
      const testId = TestItemId('item-full');
      const testItem: TestItem = {
        id: testId,
        name: 'Full Item',
        value: 100,
        category: 'premium',
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      mockAdapter.set.mockResolvedValue(ok(undefined));

      const result = await cache.set(testId, testItem);

      expect(result.isOk()).toBe(true);
      expect(mockAdapter.set).toHaveBeenCalledWith(
        'test-namespace/item-full',
        testItem,
        { ttl: 3600 },
      );
    });
  });

  describe('del()', () => {
    it('should successfully delete an item from cache', async () => {
      const testId = TestItemId('item-delete');

      mockAdapter.del.mockResolvedValue(ok(undefined));

      const result = await cache.del(testId);

      expect(result.isOk()).toBe(true);
      expect(mockAdapter.del).toHaveBeenCalledWith(
        'test-namespace/item-delete',
      );
      expect(mockGenerateKey).toHaveBeenCalledWith('test-namespace', testId);
    });

    it('should return error when adapter delete fails', async () => {
      const testId = TestItemId('item-error');
      const deleteError = new ErrorWithMetadata(
        'Cache delete error',
        'InternalServer',
        {},
      );

      mockAdapter.del.mockResolvedValue(err(deleteError));

      const result = await cache.del(testId);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache delete error');
      }
    });
  });

  describe('key generation', () => {
    it('should use custom generateCacheKey function from dependencies', async () => {
      const customKeyGen = mock(
        (ns: string, id: string) => `custom:${ns}:${id}`,
      );
      const customCache = new SharedCache<TestItemId, TestItem>(
        'custom',
        { logger: mockLogger, appConfig: mockAppConfig, validator },
        {
          createCacheClientFactory: mockCreateCacheClientFactory,
          createCacheAdapter: mockCreateCacheAdapter,
          generateCacheKey: customKeyGen,
        },
      );

      const testId = TestItemId('test-id');
      mockAdapter.get.mockResolvedValue(
        ok({
          id: testId,
          name: 'Test',
          value: 1,
          createdAt: new Date(),
          schemaVersion: 1,
        }),
      );

      await customCache.get(testId);

      expect(customKeyGen).toHaveBeenCalledWith('custom', testId);
      expect(mockAdapter.get).toHaveBeenCalledWith(
        'custom:custom:test-id',
        validator,
      );
    });

    it('should generate consistent keys for same namespace and id', async () => {
      const testId = TestItemId('consistent-id');
      mockAdapter.get.mockResolvedValue(
        ok({
          id: testId,
          name: 'Test',
          value: 1,
          createdAt: new Date(),
          schemaVersion: 1,
        }),
      );

      await cache.get(testId);
      await cache.get(testId);

      expect(mockGenerateKey).toHaveBeenCalledTimes(2);
      expect(mockGenerateKey).toHaveBeenNthCalledWith(
        1,
        'test-namespace',
        testId,
      );
      expect(mockGenerateKey).toHaveBeenNthCalledWith(
        2,
        'test-namespace',
        testId,
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle get, set, delete workflow', async () => {
      const testId = TestItemId('workflow-item');
      const testItem: TestItem = {
        id: testId,
        name: 'Workflow Item',
        value: 200,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      mockAdapter.get.mockResolvedValueOnce(
        err(new ErrorWithMetadata('Cache miss', 'NotFound', {})),
      );
      mockAdapter.set.mockResolvedValue(ok(undefined));
      mockAdapter.get.mockResolvedValueOnce(ok(testItem));
      mockAdapter.del.mockResolvedValue(ok(undefined));

      const getResult1 = await cache.get(testId);
      expect(getResult1.isErr()).toBe(true);

      const setResult = await cache.set(testId, testItem);
      expect(setResult.isOk()).toBe(true);

      const getResult2 = await cache.get(testId);
      expect(getResult2.isOk()).toBe(true);

      const delResult = await cache.del(testId);
      expect(delResult.isOk()).toBe(true);
    });

    it('should handle cache-aside pattern with onMiss', async () => {
      const testId = TestItemId('cache-aside');
      const dbItem: TestItem = {
        id: testId,
        name: 'DB Item',
        value: 300,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      mockAdapter.get.mockResolvedValue(
        err(new ErrorWithMetadata('Cache miss', 'NotFound', {})),
      );
      mockAdapter.set.mockResolvedValue(ok(undefined));

      const fetchFromDB = mock(async () => ok(dbItem));

      const result = await cache.get(testId, fetchFromDB);

      expect(result.isOk()).toBe(true);
      expect(fetchFromDB).toHaveBeenCalledWith(testId);
      expect(mockAdapter.set).toHaveBeenCalledWith(
        'test-namespace/cache-aside',
        dbItem,
        { ttl: 3600 },
      );
    });
  });
});
