import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { TaskDefinition } from '@backend/tasks/domain/TaskDefinition';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { TaskQueueConfig } from '@backend/tasks/domain/TaskQueueConfig';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import { newTaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import { createTaskQueue } from '@backend/tasks/queue/TaskQueue';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { UserId } from '@core/domain/user/user';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export { createTaskScheduler };
export type { ITaskScheduler, ScheduleOptions };

/**
 * Options for scheduling a task.
 */
interface ScheduleOptions {
  /** User ID for user-scoped tasks */
  userId?: UserId;
  /** Delay before execution in milliseconds */
  delayMs?: number;
}

/**
 * Interface for the task scheduler.
 */
interface ITaskScheduler {
  /**
   * Schedule a task for execution.
   *
   * @param correlationId - Correlation ID for tracing
   * @param task - Task definition containing queueName, validator, handler, options
   * @param payload - Task payload (type-safe based on TaskDefinition)
   * @param options - Optional scheduling options
   * @returns Result with TaskRecord or error
   */
  schedule<TPayload extends Record<string, unknown> = Record<string, unknown>>(
    correlationId: CorrelationId,
    task: TaskDefinition<TPayload>,
    payload: TPayload,
    options?: ScheduleOptions,
  ): Promise<Result<TaskRecord, ErrorWithMetadata>>;
}

/**
 * Configuration for creating a TaskScheduler.
 */
interface TaskSchedulerConfig {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  queueConfig?: TaskQueueConfig;
}

/**
 * Factory function to create a TaskScheduler.
 *
 * @example
 * ```typescript
 * const scheduler = createTaskScheduler({ logger, appConfig });
 *
 * // Schedule a task - payload type is inferred from task definition
 * await scheduler.schedule(
 *   correlationId,
 *   sendWelcomeEmailTask,
 *   { email: 'user@example.com', name: 'John' },
 * );
 * ```
 */
function createTaskScheduler(
  config: TaskSchedulerConfig,
  dependencies = {
    createTasksRepo,
    createTaskQueue,
  },
): ITaskScheduler {
  return new TaskScheduler(config, dependencies);
}

/**
 * Schedules tasks for execution using TaskDefinitions.
 *
 * The scheduler is generic - it can schedule any task type.
 * Type safety comes from the TaskDefinition<TPayload> parameter.
 *
 * @example
 * ```typescript
 * const scheduler = createTaskScheduler({ logger, appConfig });
 *
 * // Type-safe: payload must match { email: string; name: string }
 * await scheduler.schedule(
 *   correlationId,
 *   sendWelcomeEmailTask,
 *   { email: 'user@example.com', name: 'John' },
 * );
 *
 * // Schedule with delay
 * await scheduler.schedule(
 *   correlationId,
 *   sendWelcomeEmailTask,
 *   { email: 'user@example.com', name: 'John' },
 *   { delayMs: 60000 },  // 1 minute delay
 * );
 * ```
 */
class TaskScheduler implements ITaskScheduler {
  private readonly logger: ILogger;
  private readonly appConfig: IAppConfigurationService;
  private readonly tasksRepo: ITasksRepo;
  private readonly queueConfig?: TaskQueueConfig;
  private readonly queues: Map<string, ITaskQueue> = new Map();

  constructor(
    config: TaskSchedulerConfig,
    private readonly dependencies = {
      createTasksRepo,
      createTaskQueue,
    },
  ) {
    this.logger = config.logger;
    this.appConfig = config.appConfig;
    this.queueConfig = config.queueConfig;
    this.dependencies = dependencies;
    this.tasksRepo = dependencies.createTasksRepo({
      appConfig: config.appConfig,
    });
  }

  /**
   * Schedule a task for execution.
   *
   * Validates the payload using the task's validator, creates a TaskRecord
   * in the database, and enqueues it to BullMQ.
   */
  async schedule<
    TPayload extends Record<string, unknown> = Record<string, unknown>,
  >(
    correlationId: CorrelationId,
    task: TaskDefinition<TPayload>,
    payload: TPayload,
    options?: ScheduleOptions,
  ): Promise<Result<TaskRecord, ErrorWithMetadata>> {
    // Validate payload using task's validator
    const validationResult = task.validator(payload);
    if (validationResult.isErr()) {
      const error = new ErrorWithMetadata(
        'Task payload validation failed',
        'BadRequest',
        {
          correlationId,
          queueName: task.queueName,
          validationError: validationResult.error.message,
        },
      );
      this.logger.error('Task payload validation failed', error, {
        correlationId,
        queueName: task.queueName,
      });
      return err(error);
    }

    // Determine if delayed
    const delayMs = options?.delayMs ?? 0;
    const isDelayed = delayMs > 0;

    // Create task record
    const taskRecord = newTaskRecord(task.queueName, task.queueName, {
      payload: payload,
      status: isDelayed ? 'delayed' : 'pending',
      priority: task.options.priority,
      attempts: 0,
      maxAttempts: task.options.maxAttempts,
      enqueuedAt: new Date(),
      delayUntil: isDelayed ? new Date(Date.now() + delayMs) : undefined,
      userId: options?.userId,
    });

    // Save to database
    const createResult = await this.tasksRepo.create(taskRecord.id, taskRecord);
    if (createResult.isErr()) {
      this.logger.error('Failed to create task record', createResult.error, {
        correlationId,
        queueName: task.queueName,
      });
      return err(createResult.error);
    }

    // Enqueue to BullMQ
    const queue = this.getQueue(task.queueName);
    const enqueueResult = await queue.enqueue(
      correlationId,
      createResult.value,
    );
    if (enqueueResult.isErr()) {
      this.logger.error('Failed to enqueue task', enqueueResult.error, {
        correlationId,
        taskId: taskRecord.id,
        queueName: task.queueName,
      });
      return err(enqueueResult.error);
    }

    this.logger.info('Task scheduled', {
      correlationId,
      taskId: taskRecord.id,
      queueName: task.queueName,
      priority: task.options.priority,
      delayed: isDelayed,
    });

    return ok(createResult.value);
  }

  /**
   * Get or create a queue for the given queue name.
   */
  private getQueue(queueName: string): ITaskQueue {
    const existing = this.queues.get(queueName);
    if (existing) {
      return existing;
    }

    const queue = this.dependencies.createTaskQueue({
      queueName,
      logger: this.logger,
      appConfig: this.appConfig,
      queueConfig: this.queueConfig,
    });

    this.queues.set(queueName, queue);
    return queue;
  }
}
