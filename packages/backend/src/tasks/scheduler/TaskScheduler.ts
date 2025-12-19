import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { QueueConfig } from '@backend/infrastructure/queue/domain/QueueConfig';
import type { TaskDefinition } from '@backend/tasks/domain/TaskDefinition';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import { createTaskQueue } from '@backend/tasks/queue/TaskQueue';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import { scheduleTask } from '@backend/tasks/scheduler/actions';
import type { UserId } from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

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
   * @param ctx - Request context with correlationId for tracing
   * @param task - Task definition containing queueName, validator, handler, options
   * @param payload - Task payload (type-safe based on TaskDefinition)
   * @param options - Optional scheduling options
   * @returns Result with TaskRecord or error
   */
  schedule<TPayload extends Record<string, unknown> = Record<string, unknown>>(
    ctx: Context,
    task: TaskDefinition<TPayload>,
    payload: TPayload,
    options?: ScheduleOptions,
  ): Promise<Result<TaskRecord, AppError>>;
}

/**
 * Configuration for creating a TaskScheduler.
 */
interface TaskSchedulerConfig {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  queueConfig?: QueueConfig;
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
 *   ctx,
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
 *   ctx,
 *   sendWelcomeEmailTask,
 *   { email: 'user@example.com', name: 'John' },
 * );
 *
 * // Schedule with delay
 * await scheduler.schedule(
 *   ctx,
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
  private readonly queueConfig?: QueueConfig;
  private readonly queues: Map<string, ITaskQueue> = new Map();

  constructor(
    config: TaskSchedulerConfig,
    private readonly dependencies = {
      createTasksRepo,
      createTaskQueue,
    },
    private readonly taskSchedulerActions = {
      scheduleTask,
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
    ctx: Context,
    task: TaskDefinition<TPayload>,
    payload: TPayload,
    options?: ScheduleOptions,
  ): Promise<Result<TaskRecord, AppError>> {
    return this.taskSchedulerActions.scheduleTask(
      ctx,
      {
        task,
        payload,
        options,
      },
      {
        tasksRepo: this.tasksRepo,
        logger: this.logger,
        getQueue: this.getQueue.bind(this),
      },
    );
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
