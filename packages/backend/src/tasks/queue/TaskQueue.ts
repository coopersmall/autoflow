import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { IQueueClient, QueueJob } from '@backend/tasks/domain/QueueClient';
import type { QueueStats } from '@backend/tasks/domain/QueueStats';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { TaskQueueConfig } from '@backend/tasks/domain/TaskQueueConfig';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import { createQueueClientFactory } from '@backend/tasks/queue/clients/QueueClientFactory';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export { createTaskQueue };

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
 *                      Use FAST_RETRY_QUEUE_CONFIG for integration tests.
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
    queueConfig?: TaskQueueConfig;
  },
  dependencies?: TaskQueueDependencies,
): ITaskQueue {
  return new TaskQueue(logger, appConfig, queueName, queueConfig, dependencies);
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
  private client?: IQueueClient;

  constructor(
    private readonly logger: ILogger,
    private readonly appConfig: IAppConfigurationService,
    private readonly queueName: string,
    private readonly queueConfig?: TaskQueueConfig,
    private readonly dependencies = {
      createQueueClientFactory,
      createTasksRepo,
    },
  ) {
    // Create tasks repository for database operations
    this.tasksRepo = dependencies.createTasksRepo({ appConfig });
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
    correlationId: CorrelationId,
    task: TaskRecord,
  ): Promise<Result<QueueJob, ErrorWithMetadata>> {
    const clientResult = this.getQueueClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get queue client for enqueueing task',
        clientResult.error,
        { queueName: this.queueName },
      );
      return err(clientResult.error);
    }

    const client = clientResult.value;
    const enqueueResult = await client.enqueue(correlationId, task);

    if (enqueueResult.isErr()) {
      this.logger.error('Failed to enqueue task', enqueueResult.error, {
        correlationId,
        taskId: task.id,
        queueName: task.queueName,
      });
      return enqueueResult;
    }

    const queueJob = enqueueResult.value;

    const updateResult = await this.tasksRepo.update(task.id, {
      externalId: queueJob.id,
    });

    if (updateResult.isErr()) {
      this.logger.error(
        'Failed to update task with external ID',
        updateResult.error,
        {
          correlationId,
          taskId: task.id,
          queueName: task.queueName,
          externalId: queueJob.id,
        },
      );
      // Don't fail the enqueue operation - job is already in queue
      // This is a non-fatal error
    }

    this.logger.info('Task enqueued successfully', {
      correlationId,
      taskId: task.id,
      externalId: queueJob.id,
      queueName: task.queueName,
      taskName: task.taskName,
    });

    return ok(queueJob);
  }

  /**
   * Remove a task from the queue by task ID
   *
   * Orchestration flow:
   * 1. Call queue client to remove
   * 2. Log success or failure
   */
  async remove(
    correlationId: CorrelationId,
    taskId: TaskId,
  ): Promise<Result<void, ErrorWithMetadata>> {
    const clientResult = this.getQueueClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get queue client for removing task',
        clientResult.error,
        { queueName: this.queueName },
      );
      return err(clientResult.error);
    }

    const client = clientResult.value;
    const removeResult = await client.remove(correlationId, taskId);

    if (removeResult.isErr()) {
      this.logger.error(
        'Failed to remove task from queue',
        removeResult.error,
        {
          correlationId,
          taskId,
          queueName: this.queueName,
        },
      );
      return removeResult;
    }

    this.logger.info('Task removed from queue', {
      correlationId,
      taskId,
      queueName: this.queueName,
    });

    return ok(undefined);
  }

  /**
   * Get a job by job ID
   * Returns generic QueueJob instead of BullMQ-specific Job
   */
  async getJob(
    correlationId: CorrelationId,
    jobId: string,
  ): Promise<Result<QueueJob | null, ErrorWithMetadata>> {
    const clientResult = this.getQueueClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get queue client for getting job',
        clientResult.error,
        { queueName: this.queueName },
      );
      return err(clientResult.error);
    }

    const client = clientResult.value;
    const result = await client.getJob(correlationId, jobId);

    if (result.isErr()) {
      this.logger.error('Failed to get job', result.error, {
        correlationId,
        jobId,
        queueName: this.queueName,
      });
      return result;
    }

    return result;
  }

  /**
   * Get job counts by status
   */
  async getJobCounts(
    correlationId: CorrelationId,
  ): Promise<Result<QueueStats, ErrorWithMetadata>> {
    const clientResult = this.getQueueClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get queue client for getting job counts',
        clientResult.error,
        { queueName: this.queueName },
      );
      return err(clientResult.error);
    }

    const client = clientResult.value;
    const result = await client.getStats(correlationId);

    if (result.isErr()) {
      this.logger.error('Failed to get job counts', result.error, {
        correlationId,
        queueName: this.queueName,
      });
      return result;
    }

    return result;
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

    const client = clientResult.value;
    await client.close();
    this.logger.info('TaskQueue closed', { queueName: this.queueName });
  }

  /**
   * Get or create the queue client instance
   */
  private getQueueClient(): Result<IQueueClient, ErrorWithMetadata> {
    if (this.client) {
      return ok(this.client);
    }
    const clientResult = this.dependencies
      .createQueueClientFactory({
        appConfig: this.appConfig,
        queueConfig: this.queueConfig,
      })
      .getQueueClient(this.queueName);

    if (clientResult.isErr()) {
      return clientResult;
    }

    this.client = clientResult.value;
    return ok(this.client);
  }
}
