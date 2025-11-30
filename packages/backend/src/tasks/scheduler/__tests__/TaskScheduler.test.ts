import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { getMockedAppConfigurationService } from '@backend/infrastructure/configuration/__mocks__/AppConfigurationService.mock';
import { getMockedLogger } from '@backend/infrastructure/logger/__mocks__/Logger.mock';
import { createTestQueueJob } from '@backend/infrastructure/queue/__mocks__/QueueClient.mock';
import { defineTask } from '@backend/tasks/domain/TaskDefinition';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import { getMockedTaskQueue } from '@backend/tasks/queue/__mocks__/TaskQueue.mock';
import { getMockedTasksRepo } from '@backend/tasks/repos/__mocks__/TasksRepo.mock';
import { createTaskScheduler } from '@backend/tasks/scheduler/TaskScheduler';
import { CorrelationId } from '@core/domain/CorrelationId';
import { UserId } from '@core/domain/user/user';
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

// Create a test task definition
const testTask = defineTask<TestPayload>({
  queueName: 'test:send-email',
  validator: testValidator,
  handler: mock().mockReturnValue(ok({ success: true })),
  options: {
    priority: 'normal',
    maxAttempts: 3,
  },
});

describe('TaskScheduler', () => {
  const mockRepo = getMockedTasksRepo();
  const mockQueue = getMockedTaskQueue();
  const mockLogger = getMockedLogger();
  const mockAppConfig = getMockedAppConfigurationService();

  // Track created task records for assertions
  let createdTaskRecord: TaskRecord | null = null;

  const createScheduler = () => {
    return createTaskScheduler(
      {
        logger: mockLogger,
        appConfig: mockAppConfig,
      },
      {
        createTasksRepo: () => mockRepo,
        createTaskQueue: () => mockQueue,
      },
    );
  };

  beforeEach(() => {
    mock.restore();
    mockRepo.create.mockReset();
    mockQueue.enqueue.mockReset();
    createdTaskRecord = null;

    // Default: capture created task record and return it
    mockRepo.create.mockImplementation(async (_id, data) => {
      createdTaskRecord = data as TaskRecord;
      return ok(createdTaskRecord);
    });
  });

  describe('successful scheduling', () => {
    it('should successfully schedule task with valid payload', async () => {
      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      const result = await scheduler.schedule(
        CorrelationId('corr-123'),
        testTask,
        payload,
      );

      expect(result.isOk()).toBe(true);
      expect(mockRepo.create).toHaveBeenCalled();
      expect(mockQueue.enqueue).toHaveBeenCalled();
    });

    it('should create TaskRecord with correct fields', async () => {
      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(CorrelationId('corr-123'), testTask, payload);

      expect(createdTaskRecord).not.toBeNull();
      expect(createdTaskRecord?.taskName).toBe('test:send-email');
      expect(createdTaskRecord?.queueName).toBe('test:send-email');
      expect(createdTaskRecord?.payload).toEqual(payload);
      expect(createdTaskRecord?.priority).toBe('normal');
      expect(createdTaskRecord?.maxAttempts).toBe(3);
      expect(createdTaskRecord?.attempts).toBe(0);
    });

    it('should set status to pending for immediate tasks', async () => {
      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(CorrelationId('corr-123'), testTask, payload);

      expect(createdTaskRecord?.status).toBe('pending');
      expect(createdTaskRecord?.delayUntil).toBeUndefined();
    });

    it('should set status to delayed for delayed tasks', async () => {
      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(CorrelationId('corr-123'), testTask, payload, {
        delayMs: 60000,
      });

      expect(createdTaskRecord?.status).toBe('delayed');
    });

    it('should set delayUntil for delayed tasks', async () => {
      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };
      const beforeSchedule = Date.now();

      await scheduler.schedule(CorrelationId('corr-123'), testTask, payload, {
        delayMs: 60000,
      });

      expect(createdTaskRecord?.delayUntil).toBeDefined();
      const delayUntilTime = createdTaskRecord?.delayUntil?.getTime();
      // Should be approximately 60 seconds from now
      expect(delayUntilTime).toBeGreaterThanOrEqual(beforeSchedule + 59000);
      expect(delayUntilTime).toBeLessThanOrEqual(beforeSchedule + 61000);
    });

    it('should save TaskRecord to database before enqueueing', async () => {
      const callOrder: string[] = [];

      mockRepo.create.mockImplementation(async (_id, data) => {
        callOrder.push('create');
        createdTaskRecord = data as TaskRecord;
        return ok(createdTaskRecord);
      });

      mockQueue.enqueue.mockImplementation(async () => {
        callOrder.push('enqueue');
        return ok(createTestQueueJob({ id: 'job-123' }));
      });

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(CorrelationId('corr-123'), testTask, payload);

      expect(callOrder).toEqual(['create', 'enqueue']);
    });

    it('should include userId when provided', async () => {
      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(CorrelationId('corr-123'), testTask, payload, {
        userId: UserId('user-456'),
      });

      expect(createdTaskRecord?.userId).toBe('user-456');
    });

    it('should log successful scheduling', async () => {
      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(CorrelationId('corr-123'), testTask, payload);

      expect(mockLogger.info).toHaveBeenCalledWith(
        'Task scheduled',
        expect.objectContaining({
          correlationId: 'corr-123',
          queueName: 'test:send-email',
          priority: 'normal',
          delayed: false,
        }),
      );
    });
  });

  describe('payload validation', () => {
    it('should validate payload before scheduling', async () => {
      const scheduler = createScheduler();
      const invalidPayload = {
        email: 'not-an-email',
        name: 'John',
      } as TestPayload;

      const result = await scheduler.schedule(
        CorrelationId('corr-123'),
        testTask,
        invalidPayload,
      );

      expect(result.isErr()).toBe(true);
      expect(mockRepo.create).not.toHaveBeenCalled();
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should return validation error for invalid payload', async () => {
      const scheduler = createScheduler();
      const invalidPayload = {
        email: 'not-an-email',
        name: 'John',
      } as TestPayload;

      const result = await scheduler.schedule(
        CorrelationId('corr-123'),
        testTask,
        invalidPayload,
      );

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(error.message).toContain('validation failed');
    });

    it('should log validation errors', async () => {
      const scheduler = createScheduler();
      const invalidPayload = {
        email: 'not-an-email',
        name: 'John',
      } as TestPayload;

      await scheduler.schedule(
        CorrelationId('corr-123'),
        testTask,
        invalidPayload,
      );

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Task payload validation failed',
        expect.any(Error),
        expect.objectContaining({
          correlationId: 'corr-123',
          queueName: 'test:send-email',
        }),
      );
    });
  });

  describe('error handling', () => {
    it('should return error if database create fails', async () => {
      const dbError = new ErrorWithMetadata('Database error', 'InternalServer');
      mockRepo.create.mockResolvedValue(err(dbError));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      const result = await scheduler.schedule(
        CorrelationId('corr-123'),
        testTask,
        payload,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(dbError);
      expect(mockQueue.enqueue).not.toHaveBeenCalled();
    });

    it('should return error if enqueue fails', async () => {
      const queueError = new ErrorWithMetadata('Queue error', 'InternalServer');
      mockQueue.enqueue.mockResolvedValue(err(queueError));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      const result = await scheduler.schedule(
        CorrelationId('corr-123'),
        testTask,
        payload,
      );

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe(queueError);
    });

    it('should log database create failure', async () => {
      const dbError = new ErrorWithMetadata('Database error', 'InternalServer');
      mockRepo.create.mockResolvedValue(err(dbError));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(CorrelationId('corr-123'), testTask, payload);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to create task record',
        dbError,
        expect.objectContaining({
          correlationId: 'corr-123',
          queueName: 'test:send-email',
        }),
      );
    });

    it('should log enqueue failure', async () => {
      const queueError = new ErrorWithMetadata('Queue error', 'InternalServer');
      mockQueue.enqueue.mockResolvedValue(err(queueError));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(CorrelationId('corr-123'), testTask, payload);

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to enqueue task',
        queueError,
        expect.objectContaining({
          correlationId: 'corr-123',
          queueName: 'test:send-email',
        }),
      );
    });
  });

  describe('task options', () => {
    it('should apply task priority from task definition', async () => {
      const highPriorityTask = defineTask<TestPayload>({
        queueName: 'test:high-priority',
        validator: testValidator,
        handler: mock().mockReturnValue(ok({ success: true })),
        options: { priority: 'high' },
      });

      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(
        CorrelationId('corr-123'),
        highPriorityTask,
        payload,
      );

      expect(createdTaskRecord?.priority).toBe('high');
    });

    it('should apply maxAttempts from task definition', async () => {
      const customAttemptsTask = defineTask<TestPayload>({
        queueName: 'test:custom-attempts',
        validator: testValidator,
        handler: mock().mockReturnValue(ok({ success: true })),
        options: { maxAttempts: 5 },
      });

      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const scheduler = createScheduler();
      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(
        CorrelationId('corr-123'),
        customAttemptsTask,
        payload,
      );

      expect(createdTaskRecord?.maxAttempts).toBe(5);
    });
  });

  describe('queue caching', () => {
    it('should reuse queue instance for same queueName', async () => {
      let createQueueCallCount = 0;
      const trackingCreateTaskQueue = () => {
        createQueueCallCount++;
        return mockQueue;
      };

      const scheduler = createTaskScheduler(
        { logger: mockLogger, appConfig: mockAppConfig },
        {
          createTasksRepo: () => mockRepo,
          createTaskQueue: trackingCreateTaskQueue,
        },
      );

      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const payload = { email: 'test@example.com', name: 'John' };

      // Schedule multiple tasks to same queue
      await scheduler.schedule(CorrelationId('corr-1'), testTask, payload);
      await scheduler.schedule(CorrelationId('corr-2'), testTask, payload);
      await scheduler.schedule(CorrelationId('corr-3'), testTask, payload);

      // Should only create queue once
      expect(createQueueCallCount).toBe(1);
    });

    it('should create separate queues for different queueNames', async () => {
      const createdQueues: string[] = [];
      const trackingCreateTaskQueue = ({
        queueName,
      }: {
        queueName: string;
      }) => {
        createdQueues.push(queueName);
        return mockQueue;
      };

      const scheduler = createTaskScheduler(
        { logger: mockLogger, appConfig: mockAppConfig },
        {
          createTasksRepo: () => mockRepo,
          createTaskQueue: trackingCreateTaskQueue,
        },
      );

      const queueJob = createTestQueueJob({ id: 'job-123' });
      mockQueue.enqueue.mockResolvedValue(ok(queueJob));

      const task1 = defineTask<TestPayload>({
        queueName: 'queue-1',
        validator: testValidator,
        handler: mock().mockReturnValue(ok({ success: true })),
      });

      const task2 = defineTask<TestPayload>({
        queueName: 'queue-2',
        validator: testValidator,
        handler: mock().mockReturnValue(ok({ success: true })),
      });

      const payload = { email: 'test@example.com', name: 'John' };

      await scheduler.schedule(CorrelationId('corr-1'), task1, payload);
      await scheduler.schedule(CorrelationId('corr-2'), task2, payload);

      expect(createdQueues).toContain('queue-1');
      expect(createdQueues).toContain('queue-2');
      expect(createdQueues.length).toBe(2);
    });
  });
});
