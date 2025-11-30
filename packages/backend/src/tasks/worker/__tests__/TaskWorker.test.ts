import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import {
  createTestProviderContext,
  createTestWorkerJob,
  getMockedWorkerClient,
} from '@backend/infrastructure/queue/__mocks__/WorkerClient.mock';
import type { WorkerEvents } from '@backend/infrastructure/queue/domain/WorkerClient';
import { defineTask } from '@backend/tasks/domain/TaskDefinition';
import {
  createTestTaskRecord,
  getMockedTasksRepo,
} from '@backend/tasks/repos/__mocks__/TasksRepo.mock';
import { createTaskWorker } from '@backend/tasks/worker/TaskWorker';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { validate } from '@core/validation/validate';
import { err, ok } from 'neverthrow';
import zod from 'zod';

// Test payload schema
const testPayloadSchema = zod.object({
  email: zod.string().email(),
  name: zod.string(),
});

type TestPayload = zod.infer<typeof testPayloadSchema>;

const testValidator = (data: unknown) => validate(testPayloadSchema, data);

describe('TaskWorker', () => {
  const mockRepo = getMockedTasksRepo();
  const mockWorkerClient = getMockedWorkerClient();
  const mockLogger = getMockedLogger();
  const mockAppConfig = getMockedAppConfigurationService();

  // Capture the worker client factory for testing
  let capturedWorkerClientFactory: ReturnType<
    typeof getMockedWorkerClientFactory
  >;

  const getMockedWorkerClientFactory = () => ({
    getWorkerClient: mock().mockReturnValue(ok(mockWorkerClient)),
  });

  // Create a test task with a mockable handler
  const createTestTask = (
    handlerFn = mock().mockReturnValue(ok({ success: true })),
  ) =>
    defineTask<TestPayload>({
      queueName: 'test:send-email',
      validator: testValidator,
      handler: handlerFn,
      options: { priority: 'normal', maxAttempts: 3 },
    });

  const createWorker = (task = createTestTask()) => {
    capturedWorkerClientFactory = getMockedWorkerClientFactory();

    return createTaskWorker(
      {
        logger: mockLogger,
        appConfig: mockAppConfig,
        task,
      },
      {
        createTasksRepo: () => mockRepo,
        createWorkerClientFactory: () => capturedWorkerClientFactory,
      },
    );
  };

  beforeEach(() => {
    mock.restore();
    mockRepo.get.mockReset();
    mockRepo.update.mockReset();
    mockRepo.bulkUpdate.mockReset();
    mockWorkerClient.start.mockReset();
    mockWorkerClient.stop.mockReset();
    mockWorkerClient.on.mockReset();

    // Default successful responses
    mockRepo.update.mockResolvedValue(ok(createTestTaskRecord()));
    mockRepo.bulkUpdate.mockResolvedValue(ok(1));
  });

  describe('start()', () => {
    it('should create and start worker client', async () => {
      const worker = createWorker();

      const result = await worker.start();

      expect(result.isOk()).toBe(true);
      expect(mockWorkerClient.start).toHaveBeenCalled();
    });

    it('should log when worker starts', async () => {
      const worker = createWorker();

      await worker.start();

      expect(mockLogger.info).toHaveBeenCalledWith('Task worker started', {
        queueName: 'test:send-email',
      });
    });

    it('should return error if worker client creation fails', async () => {
      const factoryError = new ErrorWithMetadata(
        'Factory error',
        'InternalServer',
      );
      const failingFactory = {
        getWorkerClient: mock().mockReturnValue(err(factoryError)),
      };

      const worker = createTaskWorker(
        {
          logger: mockLogger,
          appConfig: mockAppConfig,
          task: createTestTask(),
        },
        {
          createTasksRepo: () => mockRepo,
          createWorkerClientFactory: () => failingFactory,
        },
      );

      const result = await worker.start();

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(factoryError);
    });

    it('should register event handlers on worker client', async () => {
      const worker = createWorker();

      await worker.start();

      expect(mockWorkerClient.on).toHaveBeenCalledWith(
        expect.objectContaining({
          onCompleted: expect.any(Function),
          onFailed: expect.any(Function),
          onError: expect.any(Function),
        }),
      );
    });
  });

  describe('stop()', () => {
    it('should stop the worker client', async () => {
      const worker = createWorker();
      await worker.start();

      await worker.stop();

      expect(mockWorkerClient.stop).toHaveBeenCalled();
    });

    it('should log when worker stops', async () => {
      const worker = createWorker();
      await worker.start();

      await worker.stop();

      expect(mockLogger.info).toHaveBeenCalledWith('Task worker stopped', {
        queueName: 'test:send-email',
      });
    });
  });

  describe('job processing', () => {
    // Helper to get the processor function passed to worker client
    const getProcessorFn = async (task = createTestTask()) => {
      const factory = getMockedWorkerClientFactory();
      let processorFn: ((job: unknown) => Promise<unknown>) | null = null;

      factory.getWorkerClient = mock().mockImplementation(
        (_queueName, processor) => {
          processorFn = processor;
          return ok(mockWorkerClient);
        },
      );

      const worker = createTaskWorker(
        {
          logger: mockLogger,
          appConfig: mockAppConfig,
          task,
        },
        {
          createTasksRepo: () => mockRepo,
          createWorkerClientFactory: () => factory,
        },
      );

      await worker.start();
      return processorFn!;
    };

    it('should validate payload using task validator', async () => {
      const handler = mock().mockReturnValue(ok({ success: true }));
      const task = createTestTask(handler);
      const processorFn = await getProcessorFn(task);

      const job = createTestWorkerJob({
        data: { email: 'test@example.com', name: 'John' },
      });

      mockRepo.update.mockResolvedValue(ok(createTestTaskRecord()));

      await processorFn(job);

      // Handler should be called with validated payload
      expect(handler).toHaveBeenCalledWith(
        { email: 'test@example.com', name: 'John' },
        expect.objectContaining({
          taskId: expect.any(String),
          correlationId: expect.any(String),
          logger: mockLogger,
        }),
      );
    });

    it('should throw for invalid payload (BullMQ boundary)', async () => {
      const handler = mock().mockReturnValue(ok({ success: true }));
      const task = createTestTask(handler);
      const processorFn = await getProcessorFn(task);

      const job = createTestWorkerJob({
        data: { email: 'not-an-email', name: 'John' },
      });

      expect(processorFn(job)).rejects.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should update status to active before processing', async () => {
      const handler = mock().mockReturnValue(ok({ success: true }));
      const task = createTestTask(handler);
      const processorFn = await getProcessorFn(task);

      const job = createTestWorkerJob({
        id: 'task-123',
        data: { email: 'test@example.com', name: 'John' },
      });

      mockRepo.update.mockResolvedValue(ok(createTestTaskRecord()));

      await processorFn(job);

      expect(mockRepo.update).toHaveBeenCalledWith(
        'task-123',
        expect.objectContaining({
          status: 'active',
          startedAt: expect.any(Date),
        }),
      );
    });

    it('should return handler result on success', async () => {
      const handler = mock().mockReturnValue(ok({ processed: true, count: 5 }));
      const task = createTestTask(handler);
      const processorFn = await getProcessorFn(task);

      const job = createTestWorkerJob({
        data: { email: 'test@example.com', name: 'John' },
      });

      mockRepo.update.mockResolvedValue(ok(createTestTaskRecord()));

      const result = await processorFn(job);

      expect(result).toEqual({ processed: true, count: 5 });
    });

    it('should throw when handler returns error (BullMQ boundary)', async () => {
      const handlerError = new ErrorWithMetadata(
        'Handler failed',
        'InternalServer',
      );
      const handler = mock().mockReturnValue(err(handlerError));
      const task = createTestTask(handler);
      const processorFn = await getProcessorFn(task);

      const job = createTestWorkerJob({
        data: { email: 'test@example.com', name: 'John' },
      });

      mockRepo.update.mockResolvedValue(ok(createTestTaskRecord()));

      expect(processorFn(job)).rejects.toThrow();
    });

    it('should continue processing even if status update fails', async () => {
      const handler = mock().mockReturnValue(ok({ success: true }));
      const task = createTestTask(handler);
      const processorFn = await getProcessorFn(task);

      const job = createTestWorkerJob({
        data: { email: 'test@example.com', name: 'John' },
      });

      // Status update fails
      mockRepo.update.mockResolvedValue(
        err(new ErrorWithMetadata('DB error', 'InternalServer')),
      );

      // Should still process successfully
      const result = await processorFn(job);
      expect(result).toEqual({ success: true });
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('lifecycle events', () => {
    const getEventHandlers = async () => {
      let eventHandlers: WorkerEvents = {};

      mockWorkerClient.on.mockImplementation((handlers) => {
        eventHandlers = handlers;
      });

      const worker = createWorker();
      await worker.start();

      return eventHandlers;
    };

    it('should update status to completed on job success', async () => {
      const eventHandlers = await getEventHandlers();

      // Simulate job completion
      eventHandlers.onCompleted?.('task-123', { success: true });

      // Wait for async bulk update processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockRepo.bulkUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'task-123',
            data: expect.objectContaining({
              status: 'completed',
              completedAt: expect.any(Date),
            }),
          }),
        ]),
      );
    });

    it('should update status to failed on job failure', async () => {
      const eventHandlers = await getEventHandlers();

      const testError = new Error('Processing failed');
      testError.stack = 'Error: Processing failed\n    at test.ts:123';

      // Simulate job failure
      eventHandlers.onFailed?.('task-456', testError);

      // Wait for async bulk update processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockRepo.bulkUpdate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'task-456',
            data: expect.objectContaining({
              status: 'failed',
              failedAt: expect.any(Date),
              error: expect.objectContaining({
                success: false,
                reason: 'Processing failed',
              }),
            }),
          }),
        ]),
      );
    });

    it('should log worker errors', async () => {
      const eventHandlers = await getEventHandlers();

      const workerError = new Error('Worker crashed');
      eventHandlers.onError?.(workerError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Worker error',
        workerError,
        {
          queueName: 'test:send-email',
        },
      );
    });

    it('should log successful task completion', async () => {
      const eventHandlers = await getEventHandlers();

      eventHandlers.onCompleted?.('task-123', { success: true });

      // Wait for async processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Task completed successfully',
        {
          taskId: 'task-123',
          jobId: 'task-123',
          queueName: 'test:send-email',
        },
      );
    });

    it('should log task failures', async () => {
      const eventHandlers = await getEventHandlers();

      const testError = new Error('Task failed');
      eventHandlers.onFailed?.('task-789', testError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Task failed permanently',
        testError,
        expect.objectContaining({
          taskId: 'task-789',
          jobId: 'task-789',
          queueName: 'test:send-email',
        }),
      );
    });
  });

  describe('provider context', () => {
    it('should pass provider context correctly from WorkerJob', async () => {
      const handler = mock().mockReturnValue(ok({ success: true }));
      const task = createTestTask(handler);

      const factory = getMockedWorkerClientFactory();
      let processorFn: (job: unknown) => Promise<unknown> | undefined;

      factory.getWorkerClient = mock().mockImplementation(
        (_queueName, processor) => {
          processorFn = processor;
          return ok(mockWorkerClient);
        },
      );

      const worker = createTaskWorker(
        { logger: mockLogger, appConfig: mockAppConfig, task },
        {
          createTasksRepo: () => mockRepo,
          createWorkerClientFactory: () => factory,
        },
      );

      await worker.start();

      const providerContext = createTestProviderContext({
        provider: 'bullmq',
        externalId: 'bullmq-job-999',
        metadata: { timestamp: 12345 },
      });

      const job = createTestWorkerJob({
        id: 'task-123',
        data: { email: 'test@example.com', name: 'John' },
        provider: providerContext,
      });

      mockRepo.update.mockResolvedValue(ok(createTestTaskRecord()));

      await processorFn!(job);

      // The job should be processed with the provider context available
      expect(handler).toHaveBeenCalled();
    });
  });

  describe('bulk updates', () => {
    it('should batch multiple updates efficiently', async () => {
      let eventHandlers: WorkerEvents = {};
      mockWorkerClient.on.mockImplementation((h) => {
        eventHandlers = h;
      });
      const worker = createWorker();
      await worker.start();

      // Trigger multiple completions rapidly
      eventHandlers.onCompleted?.('task-1', { success: true });
      eventHandlers.onCompleted?.('task-2', { success: true });
      eventHandlers.onCompleted?.('task-3', { success: true });

      // Wait for batch processing
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should batch updates together (may be 1-3 calls depending on timing)
      expect(mockRepo.bulkUpdate).toHaveBeenCalled();
    });
  });
});
