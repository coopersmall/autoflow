import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { Context } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { createQueueClientFactory } from '@backend/infrastructure/queue/clients/QueueClientFactory';
import type {
  IQueueClient,
  QueueJob,
  QueueJobInput,
} from '@backend/infrastructure/queue/domain/QueueClient';
import type { QueueConfig } from '@backend/infrastructure/queue/domain/QueueConfig';
import type { QueueStats } from '@backend/infrastructure/queue/domain/QueueStats';
import { createCachedGetter } from '@backend/infrastructure/utils/createCachedGetter';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import {
  closeQueue,
  enqueueTask,
  getJob,
  getJobCounts,
  removeTask,
} from '@backend/tasks/queue/actions';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import type { AppError } from '@core/errors/AppError';
import { err, type Result } from 'neverthrow';

export { createTaskQueue };

/**
 * Convert TaskRecord to generic QueueJobInput
 * This is the adapter layer between task domain and queue infrastructure
 *
 * @param task - The task record
 * @param correlationId - Correlation ID to embed in job data for distributed tracing
 */
function taskToQueueJobInput(
  task: TaskRecord,
  correlationId: string,
): QueueJobInput {
  // Calculate delay if delayUntil is set
  let delay: number | undefined;
  if (task.delayUntil) {
    const now = Date.now();
    const delayUntilMs = task.delayUntil.getTime();
    delay = Math.max(0, delayUntilMs - now);
  }

  return {
    id: task.id,
    name: task.taskName,
    // Store correlationId in job data for worker to retrieve
    data: {
      ...task.payload,
      correlationId,
    },
    priority: task.priority,
    delay,
    maxAttempts: task.maxAttempts,
  };
}

/**
 * Dependencies for TaskQueue (for testing)
 */
interface TaskQueueDependencies {
  createQueueClientFactory: typeof createQueueClientFactory;
  createTasksRepo: typeof createTasksRepo;
}

/**
 * Factory function to create a TaskQueue instance
 *
 * @param queueName - Name of the queue
 * @param logger - Logger instance
 * @param appConfig - Application configuration service
 * @param queueConfig - Optional queue configuration for retry behavior.
 *                      Use FAST_RETRY_CONFIG for integration tests.
 * @param dependencies - Optional dependencies for testing
 */
function createTaskQueue(
  {
    queueName,
    logger,
    appConfig,
    queueConfig,
  }: {
    queueName: string;
    logger: ILogger;
    appConfig: IAppConfigurationService;
    queueConfig?: QueueConfig;
  },
  dependencies?: TaskQueueDependencies,
): ITaskQueue {
  return Object.freeze(
    new TaskQueue(logger, appConfig, queueName, queueConfig, dependencies),
  );
}

/**
 * TaskQueue orchestrates queue operations with database updates and logging.
 *
 * This is where the business logic lives:
 * - Calls queue client (minimal adapter)
 * - Updates database records
 * - Logs operations
 * - Handles errors
 *
 * The queue client is a pure adapter with no business logic.
 *
 * Benefits:
 * - Decoupled from BullMQ - can swap queue implementations
 * - Uses factory pattern for dependency injection
 * - Returns generic QueueJob instead of BullMQ-specific Job
 * - Consistent with DatabaseClient and CacheClient patterns
 *
 * Responsibilities:
 * - Enqueue tasks (client + DB update + logging)
 * - Remove tasks from queue (client + logging)
 * - Query job status (client + logging)
 * - Get queue statistics (client + logging)
 */
class TaskQueue implements ITaskQueue {
  private readonly tasksRepo: ITasksRepo;
  private readonly getQueueClient: () => Result<IQueueClient, AppError>;

  constructor(
    private readonly logger: ILogger,
    private readonly appConfig: IAppConfigurationService,
    private readonly queueName: string,
    private readonly queueConfig?: QueueConfig,
    private readonly dependencies = {
      createQueueClientFactory,
      createTasksRepo,
    },
    private readonly taskQueueActions = {
      enqueueTask,
      removeTask,
      getJob,
      getJobCounts,
      closeQueue,
    },
  ) {
    // Create tasks repository for database operations
    this.tasksRepo = dependencies.createTasksRepo({ appConfig });

    this.getQueueClient = createCachedGetter(() => {
      const clientResult = this.dependencies
        .createQueueClientFactory({
          appConfig: this.appConfig,
          queueConfig: this.queueConfig,
        })
        .getQueueClient(this.queueName);

      return clientResult;
    });
  }

  /**
   * Enqueue a task
   *
   * Orchestration flow:
   * 1. Call queue client to enqueue (minimal adapter)
   * 2. Update task record with job ID in database
   * 3. Log success or failure
   */
  async enqueue(
    ctx: Context,
    task: TaskRecord,
  ): Promise<Result<QueueJob, AppError>> {
    const clientResult = this.getQueueClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get queue client for enqueueing task',
        clientResult.error,
        { queueName: this.queueName },
      );
      return err(clientResult.error);
    }

    return this.taskQueueActions.enqueueTask(
      ctx,
      { task },
      {
        client: clientResult.value,
        tasksRepo: this.tasksRepo,
        logger: this.logger,
        queueName: this.queueName,
        taskToQueueJobInput: (t) =>
          taskToQueueJobInput(t, String(ctx.correlationId)),
      },
    );
  }

  /**
   * Remove a task from the queue by task ID
   *
   * Orchestration flow:
   * 1. Call queue client to remove
   * 2. Log success or failure
   */
  async remove(ctx: Context, taskId: TaskId): Promise<Result<void, AppError>> {
    const clientResult = this.getQueueClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get queue client for removing task',
        clientResult.error,
        { queueName: this.queueName },
      );
      return err(clientResult.error);
    }

    return this.taskQueueActions.removeTask(
      ctx,
      { taskId },
      {
        client: clientResult.value,
        logger: this.logger,
        queueName: this.queueName,
      },
    );
  }

  /**
   * Get a job by job ID
   * Returns generic QueueJob instead of BullMQ-specific Job
   */
  async getJob(
    ctx: Context,
    jobId: string,
  ): Promise<Result<QueueJob | null, AppError>> {
    const clientResult = this.getQueueClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get queue client for getting job',
        clientResult.error,
        { queueName: this.queueName },
      );
      return err(clientResult.error);
    }

    return this.taskQueueActions.getJob(
      ctx,
      { jobId },
      {
        client: clientResult.value,
        logger: this.logger,
        queueName: this.queueName,
      },
    );
  }

  /**
   * Get job counts by status
   */
  async getJobCounts(ctx: Context): Promise<Result<QueueStats, AppError>> {
    const clientResult = this.getQueueClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get queue client for getting job counts',
        clientResult.error,
        { queueName: this.queueName },
      );
      return err(clientResult.error);
    }

    return this.taskQueueActions.getJobCounts(
      ctx,
      {},
      {
        client: clientResult.value,
        logger: this.logger,
        queueName: this.queueName,
      },
    );
  }

  /**
   * Close the queue connection
   */
  async close(): Promise<void> {
    const clientResult = this.getQueueClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get queue client for closing',
        clientResult.error,
        { queueName: this.queueName },
      );
      return;
    }

    return this.taskQueueActions.closeQueue({
      client: clientResult.value,
      logger: this.logger,
      queueName: this.queueName,
    });
  }
}
