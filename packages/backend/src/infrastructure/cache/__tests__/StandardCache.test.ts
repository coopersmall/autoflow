import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getMockedCacheAdapter } from '@backend/infrastructure/cache/adapters/__mocks__/CacheAdapter.mock';
import { getMockedCacheClientFactory } from '@backend/infrastructure/cache/clients/__mocks__/CacheClientFactory.mock';
import { StandardCache } from '@backend/infrastructure/cache/StandardCache';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { type Id, newId } from '@core/domain/Id';
import { UserId } from '@core/domain/user/user';
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

describe('StandardCache', () => {
  let mockAdapter: ReturnType<typeof getMockedCacheAdapter>;
  let mockAppConfig: ReturnType<typeof getMockedAppConfigurationService>;
  let mockLogger: ReturnType<typeof getMockedLogger>;
  // let mockLogger: {
  //   debug: ReturnType<typeof mock>;
  //   info: ReturnType<typeof mock>;
  //   error: ReturnType<typeof mock>;
  // };
  let mockCreateCacheClientFactory: ReturnType<typeof mock>;
  let mockCreateCacheAdapter: ReturnType<typeof mock>;
  let mockGenerateKey: ReturnType<typeof mock>;
  let cache: StandardCache<TestItemId, TestItem>;
  const testUserId = UserId('user-123');

  beforeEach(() => {
    mockAdapter = getMockedCacheAdapter();
    mockAppConfig = getMockedAppConfigurationService();
    mockLogger = getMockedLogger();
    mockGenerateKey = mock(
      (namespace: string, id: string, userId: string) =>
        `user/${userId}/${namespace}/${id}`,
    );
    mockCreateCacheAdapter = mock(() => mockAdapter);
    mockCreateCacheClientFactory = mock(() => getMockedCacheClientFactory());

    cache = new StandardCache<TestItemId, TestItem>(
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

      const result = await cache.get(testId, testUserId);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(testItem);
      }
      expect(mockAdapter.get).toHaveBeenCalledWith(
        'user/user-123/test-namespace/item-123',
        validator,
      );
      expect(mockGenerateKey).toHaveBeenCalledWith(
        'test-namespace',
        testId,
        testUserId,
      );
    });

    it('should return error when cache adapter returns error', async () => {
      const testId = TestItemId('item-404');
      const cacheError = new ErrorWithMetadata('Cache miss', 'NotFound', {});

      mockAdapter.get.mockResolvedValue(err(cacheError));

      const result = await cache.get(testId, testUserId);

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

      const result = await cache.get(testId, testUserId, onMiss);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(testItem);
      }
      expect(onMiss).toHaveBeenCalledWith(testId, testUserId);
      expect(mockAdapter.set).toHaveBeenCalledWith(
        'user/user-123/test-namespace/item-miss',
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

      const result = await cache.get(testId, testUserId, onMiss);

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

      const result = await cache.get(testId, testUserId, onMiss);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(testItem);
      }
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Cache set failed on cache miss',
        setError,
        {
          id: testId,
          userId: testUserId,
          key: 'user/user-123/test-namespace/item-set-fail',
        },
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

      const result = await cache.get(testId, testUserId);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.category).toBeUndefined();
      }
    });

    it('should isolate cache entries by user ID', async () => {
      const testId = TestItemId('shared-id');
      const user1Id = UserId('user-1');
      const user2Id = UserId('user-2');

      const item1: TestItem = {
        id: testId,
        name: 'User 1 Item',
        value: 1,
        createdAt: new Date(),
        schemaVersion: 1,
      };

      const item2: TestItem = {
        id: testId,
        name: 'User 2 Item',
        value: 2,
        createdAt: new Date(),
        schemaVersion: 1,
      };

      mockAdapter.get
        .mockResolvedValueOnce(ok(item1))
        .mockResolvedValueOnce(ok(item2));

      const result1 = await cache.get(testId, user1Id);
      const result2 = await cache.get(testId, user2Id);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      expect(mockGenerateKey).toHaveBeenNthCalledWith(
        1,
        'test-namespace',
        testId,
        user1Id,
      );
      expect(mockGenerateKey).toHaveBeenNthCalledWith(
        2,
        'test-namespace',
        testId,
        user2Id,
      );
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

      const result = await cache.set(testItem, testUserId);

      expect(result.isOk()).toBe(true);
      expect(mockAdapter.set).toHaveBeenCalledWith(
        'user/user-123/test-namespace/item-123',
        testItem,
        { ttl: 3600 },
      );
      expect(mockGenerateKey).toHaveBeenCalledWith(
        'test-namespace',
        testId,
        testUserId,
      );
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

      const result = await cache.set(testItem, testUserId, 7200);

      expect(result.isOk()).toBe(true);
      expect(mockAdapter.set).toHaveBeenCalledWith(
        'user/user-123/test-namespace/item-ttl',
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

      const result = await cache.set(testItem, testUserId);

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

      const result = await cache.set(testItem, testUserId);

      expect(result.isOk()).toBe(true);
      expect(mockAdapter.set).toHaveBeenCalledWith(
        'user/user-123/test-namespace/item-full',
        testItem,
        { ttl: 3600 },
      );
    });

    it('should use item.id for key generation', async () => {
      const testId = TestItemId('item-with-id');
      const testItem: TestItem = {
        id: testId,
        name: 'Item With ID',
        value: 42,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      mockAdapter.set.mockResolvedValue(ok(undefined));

      await cache.set(testItem, testUserId);

      expect(mockGenerateKey).toHaveBeenCalledWith(
        'test-namespace',
        testId,
        testUserId,
      );
    });
  });

  describe('del()', () => {
    it('should successfully delete an item from cache', async () => {
      const testId = TestItemId('item-delete');

      mockAdapter.del.mockResolvedValue(ok(undefined));

      const result = await cache.del(testId, testUserId);

      expect(result.isOk()).toBe(true);
      expect(mockAdapter.del).toHaveBeenCalledWith(
        'user/user-123/test-namespace/item-delete',
      );
      expect(mockGenerateKey).toHaveBeenCalledWith(
        'test-namespace',
        testId,
        testUserId,
      );
    });

    it('should return error when adapter delete fails', async () => {
      const testId = TestItemId('item-error');
      const deleteError = new ErrorWithMetadata(
        'Cache delete error',
        'InternalServer',
        {},
      );

      mockAdapter.del.mockResolvedValue(err(deleteError));

      const result = await cache.del(testId, testUserId);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache delete error');
      }
    });

    it('should isolate delete operations by user ID', async () => {
      const testId = TestItemId('shared-id');
      const user1Id = UserId('user-1');
      const user2Id = UserId('user-2');

      mockAdapter.del.mockResolvedValue(ok(undefined));

      await cache.del(testId, user1Id);
      await cache.del(testId, user2Id);

      expect(mockGenerateKey).toHaveBeenNthCalledWith(
        1,
        'test-namespace',
        testId,
        user1Id,
      );
      expect(mockGenerateKey).toHaveBeenNthCalledWith(
        2,
        'test-namespace',
        testId,
        user2Id,
      );
    });
  });

  describe('key generation', () => {
    it('should use custom generateCacheKey function from dependencies', async () => {
      const customKeyGen = mock(
        (ns: string, id: string, userId?: string) =>
          `custom:${userId}:${ns}:${id}`,
      );
      const customCache = new StandardCache<TestItemId, TestItem>(
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

      await customCache.get(testId, testUserId);

      expect(customKeyGen).toHaveBeenCalledWith('custom', testId, testUserId);
      expect(mockAdapter.get).toHaveBeenCalledWith(
        'custom:user-123:custom:test-id',
        validator,
      );
    });

    it('should generate consistent keys for same namespace, id, and userId', async () => {
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

      await cache.get(testId, testUserId);
      await cache.get(testId, testUserId);

      expect(mockGenerateKey).toHaveBeenCalledTimes(2);
      expect(mockGenerateKey).toHaveBeenNthCalledWith(
        1,
        'test-namespace',
        testId,
        testUserId,
      );
      expect(mockGenerateKey).toHaveBeenNthCalledWith(
        2,
        'test-namespace',
        testId,
        testUserId,
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

      const getResult1 = await cache.get(testId, testUserId);
      expect(getResult1.isErr()).toBe(true);

      const setResult = await cache.set(testItem, testUserId);
      expect(setResult.isOk()).toBe(true);

      const getResult2 = await cache.get(testId, testUserId);
      expect(getResult2.isOk()).toBe(true);

      const delResult = await cache.del(testId, testUserId);
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

      const result = await cache.get(testId, testUserId, fetchFromDB);

      expect(result.isOk()).toBe(true);
      expect(fetchFromDB).toHaveBeenCalledWith(testId, testUserId);
      expect(mockAdapter.set).toHaveBeenCalledWith(
        'user/user-123/test-namespace/cache-aside',
        dbItem,
        { ttl: 3600 },
      );
    });

    it('should handle multi-user cache-aside pattern', async () => {
      const testId = TestItemId('multi-user');
      const user1Id = UserId('user-1');
      const user2Id = UserId('user-2');

      const user1Item: TestItem = {
        id: testId,
        name: 'User 1 Item',
        value: 100,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      const user2Item: TestItem = {
        id: testId,
        name: 'User 2 Item',
        value: 200,
        createdAt: new Date('2024-01-01'),
        schemaVersion: 1,
      };

      mockAdapter.get.mockResolvedValue(
        err(new ErrorWithMetadata('Cache miss', 'NotFound', {})),
      );
      mockAdapter.set.mockResolvedValue(ok(undefined));

      const fetchUser1 = mock(async () => ok(user1Item));
      const fetchUser2 = mock(async () => ok(user2Item));

      const result1 = await cache.get(testId, user1Id, fetchUser1);
      const result2 = await cache.get(testId, user2Id, fetchUser2);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      if (result1.isOk() && result2.isOk()) {
        expect(result1.value.name).toBe('User 1 Item');
        expect(result2.value.name).toBe('User 2 Item');
      }

      expect(fetchUser1).toHaveBeenCalledWith(testId, user1Id);
      expect(fetchUser2).toHaveBeenCalledWith(testId, user2Id);
    });
  });
});
