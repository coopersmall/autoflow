import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { createQueueClientFactory } from '@backend/infrastructure/queue/clients/QueueClientFactory';
import type { IQueueClient } from '@backend/infrastructure/queue/domain/QueueClient';
import { DEFAULT_QUEUE_CONFIG } from '@backend/infrastructure/queue/domain/QueueConfig';

describe('QueueClientFactory', () => {
  const mockAppConfig = getMockedAppConfigurationService();

  // Mock BullMQ client creator
  const mockBullMQClient: IQueueClient = {
    enqueue: mock(),
    remove: mock(),
    getJob: mock(),
    getStats: mock(),
    close: mock(),
  };
  const mockCreateBullMQQueueClient = mock(() => mockBullMQClient);

  const createFactory = (redisUrl?: string) => {
    // Configure mock app config
    Object.defineProperty(mockAppConfig, 'redisUrl', {
      get: () => redisUrl,
      configurable: true,
    });

    return createQueueClientFactory(
      {
        appConfig: mockAppConfig,
        queueConfig: DEFAULT_QUEUE_CONFIG,
      },
      { createBullMQQueueClient: mockCreateBullMQQueueClient },
    );
  };

  beforeEach(() => {
    mock.restore();
    mockCreateBullMQQueueClient.mockReset();
    mockCreateBullMQQueueClient.mockReturnValue(mockBullMQClient);
  });

  describe('getQueueClient', () => {
    describe('with bullmq provider (default)', () => {
      it('should create BullMQ client when Redis URL is configured', () => {
        const factory = createFactory('redis://localhost:6379');

        const result = factory.getQueueClient('my-queue');

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toBe(mockBullMQClient);
      });

      it('should pass correct parameters to BullMQ client creator', () => {
        const factory = createFactory('redis://localhost:6379');

        factory.getQueueClient('my-queue');

        expect(mockCreateBullMQQueueClient).toHaveBeenCalledWith({
          queueName: 'my-queue',
          redisUrl: 'redis://localhost:6379',
          config: DEFAULT_QUEUE_CONFIG,
        });
      });

      it('should return error when Redis URL is not configured', () => {
        const factory = createFactory(undefined);

        const result = factory.getQueueClient('my-queue');

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.message).toBe('Redis URL not configured');
        expect(error.code).toBe('InternalServer');
      });

      it('should include queueName in error metadata when Redis URL missing', () => {
        const factory = createFactory(undefined);

        const result = factory.getQueueClient('test-queue');

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.metadata.configKey).toBe('redisUrl');
        expect(error.metadata.queueName).toBe('test-queue');
      });

      it('should return error when BullMQ client creation throws', () => {
        const factory = createFactory('redis://localhost:6379');
        mockCreateBullMQQueueClient.mockImplementation(() => {
          throw new Error('Connection refused');
        });

        const result = factory.getQueueClient('my-queue');

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.message).toBe('Failed to create BullMQ queue client');
        expect(error.code).toBe('InternalServer');
      });

      it('should include cause in error when BullMQ client creation throws', () => {
        const factory = createFactory('redis://localhost:6379');
        const originalError = new Error('Connection refused');
        mockCreateBullMQQueueClient.mockImplementation(() => {
          throw originalError;
        });

        const result = factory.getQueueClient('my-queue');

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.metadata.queueName).toBe('my-queue');
        expect(error.metadata.redisUrl).toBe('redis://localhost:6379');
        expect(error.metadata.cause).toBe(originalError);
      });
    });

    describe('with explicit bullmq type', () => {
      it('should create BullMQ client when type is explicitly bullmq', () => {
        const factory = createFactory('redis://localhost:6379');

        const result = factory.getQueueClient('my-queue', 'bullmq');

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toBe(mockBullMQClient);
      });
    });

    describe('with unsupported providers', () => {
      it('should return error for sqs provider', () => {
        const factory = createFactory('redis://localhost:6379');

        const result = factory.getQueueClient('my-queue', 'sqs');

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.message).toBe(
          "Queue provider 'sqs' is not yet implemented",
        );
        expect(error.code).toBe('InternalServer');
      });

      it('should return error for rabbitmq provider', () => {
        const factory = createFactory('redis://localhost:6379');

        const result = factory.getQueueClient('my-queue', 'rabbitmq');

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.message).toBe(
          "Queue provider 'rabbitmq' is not yet implemented",
        );
        expect(error.code).toBe('InternalServer');
      });

      it('should include provider in error metadata for unsupported providers', () => {
        const factory = createFactory('redis://localhost:6379');

        const result = factory.getQueueClient('my-queue', 'sqs');

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.metadata.queueName).toBe('my-queue');
        expect(error.metadata.provider).toBe('sqs');
      });
    });
  });

  describe('custom queue config', () => {
    it('should use provided queue config', () => {
      const customConfig = {
        ...DEFAULT_QUEUE_CONFIG,
        completedJobRetention: 500,
        failedJobRetention: 1000,
      };

      Object.defineProperty(mockAppConfig, 'redisUrl', {
        get: () => 'redis://localhost:6379',
        configurable: true,
      });

      const factory = createQueueClientFactory(
        {
          appConfig: mockAppConfig,
          queueConfig: customConfig,
        },
        { createBullMQQueueClient: mockCreateBullMQQueueClient },
      );

      factory.getQueueClient('my-queue');

      expect(mockCreateBullMQQueueClient).toHaveBeenCalledWith(
        expect.objectContaining({
          config: customConfig,
        }),
      );
    });
  });
});
