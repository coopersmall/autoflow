import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { createCacheAdapter } from '@backend/infrastructure/cache/adapters/CacheAdapter';
import { getMockedCacheClient } from '@backend/infrastructure/cache/clients/__mocks__/CacheClient.mock';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Validator } from '@core/validation/validate';
import { err, ok } from 'neverthrow';

describe('CacheAdapter', () => {
  let mockClient: ReturnType<typeof getMockedCacheClient>;
  let mockLogger: {
    debug: ReturnType<typeof mock>;
    info: ReturnType<typeof mock>;
    error: ReturnType<typeof mock>;
  };
  let adapter: ReturnType<typeof createCacheAdapter>;

  beforeEach(() => {
    mockClient = getMockedCacheClient();
    mockLogger = {
      debug: mock(),
      info: mock(),
      error: mock(),
    };
    adapter = createCacheAdapter({
      client: mockClient,
      logger: mockLogger,
    });
  });

  describe('get', () => {
    const mockValidator: Validator<{ name: string }> = (data: unknown) => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'name' in data &&
        typeof data.name === 'string'
      ) {
        return ok({ name: data.name });
      }
      return err(new ErrorWithMetadata('Invalid data', 'BadRequest', {}));
    };

    it('should retrieve and validate cached value', async () => {
      const cachedData = JSON.stringify({ name: 'test' });
      mockClient.get.mockResolvedValue(cachedData);

      const result = await adapter.get('test-key', mockValidator);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual({ name: 'test' });
      }
      expect(mockClient.get).toHaveBeenCalledWith('test-key');
    });

    it('should return cache miss error when data is null', async () => {
      mockClient.get.mockResolvedValue(null);

      const result = await adapter.get('test-key', mockValidator);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache miss');
        expect(result.error.code).toBe('NotFound');
        expect(result.error.metadata.key).toBe('test-key');
      }
    });

    it('should return error when JSON parsing fails', async () => {
      mockClient.get.mockResolvedValue('invalid json{');

      const result = await adapter.get('test-key', mockValidator);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache deserialization error');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cache data conversion failed',
          expect.any(ErrorWithMetadata),
          { key: 'test-key' },
        );
      }
    });

    it('should return error when validation fails', async () => {
      const cachedData = JSON.stringify({ invalid: 'data' });
      mockClient.get.mockResolvedValue(cachedData);

      const result = await adapter.get('test-key', mockValidator);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ErrorWithMetadata);
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cache data conversion failed',
          expect.any(ErrorWithMetadata),
          { key: 'test-key' },
        );
      }
    });

    it('should return error when client throws', async () => {
      const clientError = new Error('Redis connection failed');
      mockClient.get.mockRejectedValue(clientError);

      const result = await adapter.get('test-key', mockValidator);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache get error');
        expect(result.error.code).toBe('InternalServer');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cache get failed',
          expect.any(ErrorWithMetadata),
          { key: 'test-key' },
        );
      }
    });

    it('should handle complex nested objects', async () => {
      const complexData = { name: 'test', count: 42 };
      const cachedData = JSON.stringify(complexData);
      mockClient.get.mockResolvedValue(cachedData);

      const complexValidator: Validator<typeof complexData> = (
        data: unknown,
      ) => {
        if (
          typeof data === 'object' &&
          data !== null &&
          'name' in data &&
          'count' in data &&
          typeof data.name === 'string' &&
          typeof data.count === 'number'
        ) {
          return ok({ name: data.name, count: data.count });
        }
        return err(new ErrorWithMetadata('Invalid data', 'BadRequest', {}));
      };

      const result = await adapter.get('test-key', complexValidator);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toEqual(complexData);
      }
    });
  });

  describe('set', () => {
    it('should serialize and store value with default TTL', async () => {
      const value = { name: 'test' };
      mockClient.set.mockResolvedValue(undefined);

      const result = await adapter.set('test-key', value);

      expect(result.isOk()).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(value),
        3600,
      );
    });

    it('should use custom TTL when provided', async () => {
      const value = { name: 'test' };
      mockClient.set.mockResolvedValue(undefined);

      const result = await adapter.set('test-key', value, { ttl: 7200 });

      expect(result.isOk()).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(value),
        7200,
      );
    });

    it('should handle serialization of arrays', async () => {
      const value = [1, 2, 3, 'test'];
      mockClient.set.mockResolvedValue(undefined);

      const result = await adapter.set('test-key', value);

      expect(result.isOk()).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith(
        'test-key',
        JSON.stringify(value),
        3600,
      );
    });

    it('should handle serialization of null', async () => {
      mockClient.set.mockResolvedValue(undefined);

      const result = await adapter.set('test-key', null);

      expect(result.isOk()).toBe(true);
      expect(mockClient.set).toHaveBeenCalledWith('test-key', 'null', 3600);
    });

    it('should return error when serialization fails', async () => {
      const circular: Record<string, unknown> = { name: 'test' };
      circular.self = circular;

      const result = await adapter.set('test-key', circular);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache serialization error');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cache serialization failed',
          expect.any(ErrorWithMetadata),
          { key: 'test-key' },
        );
      }
    });

    it('should return error when client throws', async () => {
      const value = { name: 'test' };
      const clientError = new Error('Redis write failed');
      mockClient.set.mockRejectedValue(clientError);

      const result = await adapter.set('test-key', value);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache set error');
        expect(result.error.code).toBe('InternalServer');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cache set failed',
          expect.any(ErrorWithMetadata),
          { key: 'test-key' },
        );
      }
    });
  });

  describe('del', () => {
    it('should delete cache entry', async () => {
      mockClient.del.mockResolvedValue(undefined);

      const result = await adapter.del('test-key');

      expect(result.isOk()).toBe(true);
      expect(mockClient.del).toHaveBeenCalledWith('test-key');
    });

    it('should return error when client throws', async () => {
      const clientError = new Error('Redis delete failed');
      mockClient.del.mockRejectedValue(clientError);

      const result = await adapter.del('test-key');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache delete error');
        expect(result.error.code).toBe('InternalServer');
        expect(mockLogger.error).toHaveBeenCalledWith(
          'Cache delete failed',
          expect.any(ErrorWithMetadata),
          { key: 'test-key' },
        );
      }
    });
  });

  describe('getClient', () => {
    it('should return underlying cache client', () => {
      const client = adapter.getClient();

      expect(client).toBe(mockClient);
    });
  });

  describe('integration scenarios', () => {
    const validator: Validator<{ id: string; name: string }> = (
      data: unknown,
    ) => {
      if (
        typeof data === 'object' &&
        data !== null &&
        'id' in data &&
        'name' in data &&
        typeof data.id === 'string' &&
        typeof data.name === 'string'
      ) {
        return ok({ id: data.id, name: data.name });
      }
      return err(new ErrorWithMetadata('Invalid user data', 'BadRequest', {}));
    };

    it('should handle set then get successfully', async () => {
      const user = { id: '123', name: 'Alice' };
      mockClient.set.mockResolvedValue(undefined);
      mockClient.get.mockResolvedValue(JSON.stringify(user));

      const setResult = await adapter.set('user:123', user);
      expect(setResult.isOk()).toBe(true);

      const getResult = await adapter.get('user:123', validator);
      expect(getResult.isOk()).toBe(true);
      if (getResult.isOk()) {
        expect(getResult.value).toEqual(user);
      }
    });

    it('should handle set, get, then delete', async () => {
      const user = { id: '123', name: 'Bob' };
      mockClient.set.mockResolvedValue(undefined);
      mockClient.get.mockResolvedValue(JSON.stringify(user));
      mockClient.del.mockResolvedValue(undefined);

      await adapter.set('user:123', user);
      await adapter.get('user:123', validator);
      const delResult = await adapter.del('user:123');

      expect(delResult.isOk()).toBe(true);
      expect(mockClient.del).toHaveBeenCalledWith('user:123');
    });
  });
});
