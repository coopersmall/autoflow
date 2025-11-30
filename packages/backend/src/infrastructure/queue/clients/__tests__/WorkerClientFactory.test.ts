import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { createWorkerClientFactory } from '@backend/infrastructure/queue/clients/WorkerClientFactory';
import type {
  IWorkerClient,
  WorkerJobHandler,
} from '@backend/infrastructure/queue/domain/WorkerClient';

describe('WorkerClientFactory', () => {
  const mockAppConfig = getMockedAppConfigurationService();

  // Mock BullMQ worker client
  const mockBullMQWorkerClient: IWorkerClient = {
    start: mock(),
    stop: mock(),
    on: mock(),
  };
  const mockCreateBullMQWorkerClient = mock(() => mockBullMQWorkerClient);

  // Mock job handler
  const mockHandler: WorkerJobHandler = mock();

  const createFactory = (redisUrl?: string) => {
    // Configure mock app config
    Object.defineProperty(mockAppConfig, 'redisUrl', {
      get: () => redisUrl,
      configurable: true,
    });

    return createWorkerClientFactory(
      { appConfig: mockAppConfig },
      { createBullMQWorkerClient: mockCreateBullMQWorkerClient },
    );
  };

  beforeEach(() => {
    mock.restore();
    mockCreateBullMQWorkerClient.mockReset();
    mockCreateBullMQWorkerClient.mockReturnValue(mockBullMQWorkerClient);
  });

  describe('getWorkerClient', () => {
    describe('with bullmq provider (default)', () => {
      it('should create BullMQ worker client when Redis URL is configured', () => {
        const factory = createFactory('redis://localhost:6379');

        const result = factory.getWorkerClient('my-queue', mockHandler);

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toBe(mockBullMQWorkerClient);
      });

      it('should pass correct parameters to BullMQ worker client creator', () => {
        const factory = createFactory('redis://localhost:6379');

        factory.getWorkerClient('my-queue', mockHandler);

        expect(mockCreateBullMQWorkerClient).toHaveBeenCalledWith({
          queueName: 'my-queue',
          redisUrl: 'redis://localhost:6379',
          handler: mockHandler,
        });
      });

      it('should return error when Redis URL is not configured', () => {
        const factory = createFactory(undefined);

        const result = factory.getWorkerClient('my-queue', mockHandler);

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.message).toBe('Redis URL not configured');
        expect(error.code).toBe('InternalServer');
      });

      it('should include queueName in error metadata when Redis URL missing', () => {
        const factory = createFactory(undefined);

        const result = factory.getWorkerClient('test-queue', mockHandler);

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.metadata.configKey).toBe('redisUrl');
        expect(error.metadata.queueName).toBe('test-queue');
      });

      it('should return error when BullMQ worker client creation throws', () => {
        const factory = createFactory('redis://localhost:6379');
        mockCreateBullMQWorkerClient.mockImplementation(() => {
          throw new Error('Connection refused');
        });

        const result = factory.getWorkerClient('my-queue', mockHandler);

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.message).toBe('Failed to create BullMQ worker client');
        expect(error.code).toBe('InternalServer');
      });

      it('should include cause in error when BullMQ worker client creation throws', () => {
        const factory = createFactory('redis://localhost:6379');
        const originalError = new Error('Connection refused');
        mockCreateBullMQWorkerClient.mockImplementation(() => {
          throw originalError;
        });

        const result = factory.getWorkerClient('my-queue', mockHandler);

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.metadata.queueName).toBe('my-queue');
        expect(error.metadata.redisUrl).toBe('redis://localhost:6379');
        expect(error.metadata.cause).toBe(originalError);
      });
    });

    describe('with explicit bullmq type', () => {
      it('should create BullMQ worker client when type is explicitly bullmq', () => {
        const factory = createFactory('redis://localhost:6379');

        const result = factory.getWorkerClient(
          'my-queue',
          mockHandler,
          'bullmq',
        );

        expect(result.isOk()).toBe(true);
        expect(result._unsafeUnwrap()).toBe(mockBullMQWorkerClient);
      });
    });

    describe('with unsupported providers', () => {
      it('should return error for sqs provider', () => {
        const factory = createFactory('redis://localhost:6379');

        const result = factory.getWorkerClient('my-queue', mockHandler, 'sqs');

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.message).toBe(
          "Queue provider 'sqs' is not yet implemented",
        );
        expect(error.code).toBe('InternalServer');
      });

      it('should return error for rabbitmq provider', () => {
        const factory = createFactory('redis://localhost:6379');

        const result = factory.getWorkerClient(
          'my-queue',
          mockHandler,
          'rabbitmq',
        );

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.message).toBe(
          "Queue provider 'rabbitmq' is not yet implemented",
        );
        expect(error.code).toBe('InternalServer');
      });

      it('should include provider in error metadata for unsupported providers', () => {
        const factory = createFactory('redis://localhost:6379');

        const result = factory.getWorkerClient('my-queue', mockHandler, 'sqs');

        expect(result.isErr()).toBe(true);
        const error = result._unsafeUnwrapErr();
        expect(error.metadata.queueName).toBe('my-queue');
        expect(error.metadata.provider).toBe('sqs');
      });
    });
  });
});
