import { beforeEach, describe, expect, it } from 'bun:test';
import { createCacheClientFactory } from '@backend/cache/clients/CacheClientFactory';
import { getMockedAppConfigurationService } from '@backend/services/configuration/__mocks__/AppConfigurationService.mock';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';

describe('CacheClientFactory', () => {
  let mockAppConfig: ReturnType<typeof getMockedAppConfigurationService>;
  const cacheType = 'redis';

  beforeEach(() => {
    mockAppConfig = getMockedAppConfigurationService();
  });

  describe('getCacheClient', () => {
    it('should create cache client with valid Redis URL', () => {
      const factory = createCacheClientFactory(mockAppConfig);

      const result = factory.getCacheClient(cacheType);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value).toBeDefined();
      }
    });

    it('should return error when Redis URL is not configured', () => {
      mockAppConfig.redisUrl = undefined;
      const factory = createCacheClientFactory(mockAppConfig);

      const result = factory.getCacheClient(cacheType);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ErrorWithMetadata);
        expect(result.error.message).toBe('Cache error');
        expect(result.error.metadata.configKey).toBe('redisUrl');
      }
    });

    it('should return error when Redis URL is empty string', () => {
      mockAppConfig.redisUrl = '';
      const factory = createCacheClientFactory(mockAppConfig);

      const result = factory.getCacheClient(cacheType);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.message).toBe('Cache error');
      }
    });

    it('should handle different valid Redis URL formats', () => {
      const validUrls = [
        'redis://localhost:6379',
        'redis://127.0.0.1:6379',
        'redis://user:pass@localhost:6379',
        'redis://localhost:6379/0',
        'rediss://localhost:6380',
      ];

      validUrls.forEach((url) => {
        mockAppConfig.redisUrl = url;
        const factory = createCacheClientFactory(mockAppConfig);

        const result = factory.getCacheClient(cacheType);

        expect(result.isOk()).toBe(true);
      });
    });

    it('should handle Redis client creation gracefully', () => {
      mockAppConfig.redisUrl = 'redis://localhost:6379';
      const factory = createCacheClientFactory(mockAppConfig);

      const result = factory.getCacheClient(cacheType);

      expect(result.isOk()).toBe(true);
    });

    it('should create new client instance on each call', () => {
      const factory = createCacheClientFactory(mockAppConfig);

      const result1 = factory.getCacheClient(cacheType);
      const result2 = factory.getCacheClient(cacheType);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      if (result1.isOk() && result2.isOk()) {
        expect(result1.value).not.toBe(result2.value);
      }
    });
  });

  describe('factory creation', () => {
    it('should create factory instance successfully', () => {
      const factory = createCacheClientFactory(mockAppConfig);

      expect(factory).toBeDefined();
    });

    it('should accept app config with all properties', () => {
      const factory = createCacheClientFactory(mockAppConfig);

      const result = factory.getCacheClient(cacheType);
      expect(result.isOk()).toBe(true);
    });
  });

  describe('error metadata', () => {
    it('should include configKey in metadata when Redis URL missing', () => {
      mockAppConfig.redisUrl = undefined;
      const factory = createCacheClientFactory(mockAppConfig);

      const result = factory.getCacheClient(cacheType);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.metadata).toMatchObject({
          configKey: 'redisUrl',
        });
      }
    });

    it('should include error details in metadata when config missing', () => {
      mockAppConfig.redisUrl = undefined;
      const factory = createCacheClientFactory(mockAppConfig);

      const result = factory.getCacheClient(cacheType);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.metadata.configKey).toBe('redisUrl');
        expect(result.error.metadata.error).toBeDefined();
      }
    });
  });

  describe('integration with Redis client', () => {
    it('should return client with functional interface', () => {
      const factory = createCacheClientFactory(mockAppConfig);
      const result = factory.getCacheClient(cacheType);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const client = result.value;

        expect(typeof client.get).toBe('function');
        expect(typeof client.set).toBe('function');
        expect(typeof client.del).toBe('function');
      }
    });

    it('should create clients that can be used independently', () => {
      const factory = createCacheClientFactory(mockAppConfig);

      const result1 = factory.getCacheClient(cacheType);
      const result2 = factory.getCacheClient(cacheType);

      expect(result1.isOk()).toBe(true);
      expect(result2.isOk()).toBe(true);

      if (result1.isOk() && result2.isOk()) {
        expect(result1.value).toBeDefined();
        expect(result2.value).toBeDefined();
        expect(result1.value).not.toBe(result2.value);
      }
    });
  });
});
