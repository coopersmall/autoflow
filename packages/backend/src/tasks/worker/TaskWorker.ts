import type { ILogger } from '@backend/logger/Logger';
import type { IAppConfigurationService } from '@backend/services/configuration/AppConfigurationService';
import type { TaskContext } from '@backend/tasks/domain/TaskContext';
import type { TaskDefinition } from '@backend/tasks/domain/TaskDefinition';
import { TaskId } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import type {
  IWorkerClient,
  WorkerJob,
} from '@backend/tasks/domain/WorkerClient';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import { createWorkerClientFactory } from '@backend/tasks/worker/clients/WorkerClientFactory';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export { createTaskWorker };

/**
 * Configuration for creating a TaskWorker.
 */
interface TaskWorkerConfig<TPayload> {
  logger: ILogger;
  appConfig: IAppConfigurationService;
  task: TaskDefinition<TPayload>;
}

/**
 * Factory function to create a TaskWorker.
 *
 * @example
 * ```typescript
 * const worker = createTaskWorker({
 *   logger,
 *   appConfig,
 *   task: sendWelcomeEmailTask,
 * });
 *
 * await worker.start();
 * ```
 */
function createTaskWorker<TPayload>(
  config: TaskWorkerConfig<TPayload>,
  dependencies = {
    createTasksRepo,
    createWorkerClientFactory,
  },
): TaskWorker<TPayload> {
  return new TaskWorker(config, dependencies);
}

/**
 * Represents a pending database update for a task.
 */
interface PendingTaskUpdate {
  taskId: TaskId;
  data: Partial<TaskRecord>;
  onSuccess?: () => void;
}

/**
 * Processes tasks from a queue using the handler from a TaskDefinition.
 *
 * Each TaskWorker instance handles one task type (one queue = one task type).
 * The handler, validator, and options come from the TaskDefinition.
 *
 * @example
 * ```typescript
 * const worker = createTaskWorker({
 *   logger,
 *   appConfig,
 *   task: sendWelcomeEmailTask,
 * });
 *
 * const result = await worker.start();
 * if (result.isErr()) {
 *   console.error('Failed to start worker', result.error);
 * }
 *
 * // Later: graceful shutdown
 * await worker.stop();
 * ```
 */
class TaskWorker<TPayload> {
  private readonly logger: ILogger;
  private readonly appConfig: IAppConfigurationService;
  private readonly task: TaskDefinition<TPayload>;
  private readonly repo: ITasksRepo;
  private client?: IWorkerClient;
  private updateQueue: PendingTaskUpdate[] = [];
  private isProcessingUpdates = false;
  private readonly maxUpdateBatchSize = 100;

  constructor(
    config: TaskWorkerConfig<TPayload>,
    private readonly dependencies = {
      createTasksRepo,
      createWorkerClientFactory,
    },
  ) {
    this.logger = config.logger;
    this.appConfig = config.appConfig;
    this.task = config.task;
    this.dependencies = dependencies;
    this.repo = dependencies.createTasksRepo({ appConfig: config.appConfig });
  }

  /**
   * Start the worker to begin processing jobs.
   */
  async start(): Promise<Result<void, ErrorWithMetadata>> {
    const clientResult = this.getWorkerClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get worker client for starting',
        clientResult.error,
        { queueName: this.task.queueName },
      );
      return err(clientResult.error);
    }

    const client = clientResult.value;
    await client.start();
    this.logger.info('Task worker started', { queueName: this.task.queueName });
    return ok();
  }

  /**
   * Stop the worker gracefully.
   */
  async stop(): Promise<void> {
    const clientResult = this.getWorkerClient();
    if (clientResult.isErr()) {
      this.logger.error(
        'Failed to get worker client for stopping',
        clientResult.error,
        { queueName: this.task.queueName },
      );
      return;
    }

    const client = clientResult.value;
    await client.stop();
    await this.processUpdateQueue();
    this.logger.info('Task worker stopped', { queueName: this.task.queueName });
  }

  /**
   * Process a job from the queue.
   *
   * This method uses Result types internally for error handling.
   * Returns a Result with the task output or an error.
   */
  private async processJob(
    job: WorkerJob,
  ): Promise<Result<unknown, ErrorWithMetadata>> {
    const taskId = TaskId(job.id);
    const correlationId = CorrelationId();

    // Build task context
    const context: TaskContext = {
      correlationId,
      taskId,
      logger: this.logger,
    };

    // Validate payload using the task's validator
    const payloadValidation = this.task.validator(job.data);
    if (payloadValidation.isErr()) {
      const error = new ErrorWithMetadata(
        'Task payload validation failed',
        'BadRequest',
        {
          correlationId,
          taskId,
          queueName: this.task.queueName,
          validationError: payloadValidation.error.message,
        },
      );
      this.logger.error('Task payload validation failed', error, {
        correlationId,
        taskId,
        queueName: this.task.queueName,
      });
      return err(error);
    }

    const validPayload = payloadValidation.value;

    // Update task status to 'active' in database
    const updateResult = await this.repo.update(taskId, {
      status: 'active',
      startedAt: new Date(),
    });

    if (updateResult.isErr()) {
      this.logger.error(
        'Failed to update task status to active',
        updateResult.error,
        { correlationId, taskId, queueName: this.task.queueName },
      );
      // Continue processing - don't fail the job for a status update issue
    }

    // Execute the task handler
    const result = await this.task.handler(validPayload, context);

    if (result.isErr()) {
      const error = new ErrorWithMetadata(
        'Task execution failed',
        'InternalServer',
        {
          correlationId,
          taskId,
          queueName: this.task.queueName,
          taskError: result.error,
        },
      );
      return err(error);
    }

    return ok(result.value);
  }

  /**
   * Adapter function for BullMQ boundary.
   *
   * BullMQ requires throwing errors to trigger retries.
   * This method converts our Result-based processJob to the throw-based
   * interface that BullMQ expects.
   */
  private async processJobForBullMQ(job: WorkerJob): Promise<unknown> {
    const result = await this.processJob(job);

    if (result.isErr()) {
      // BullMQ expects throws for failures to trigger retries.
      // This is the ONLY place in the codebase where we throw - it's the
      // boundary between our Result-based code and BullMQ's throw-based API.
      const error = new Error(result.error.message);
      error.cause = result.error;
      // biome-ignore lint: BullMQ requires throwing to trigger retries - this is the API boundary
      throw error;
    }

    return result.value;
  }

  /**
   * Called when a job completes successfully.
   */
  private onCompleted(jobId: string, _result: unknown): void {
    const taskId = TaskId(jobId);

    this.enqueueUpdate({
      taskId,
      data: {
        status: 'completed',
        completedAt: new Date(),
      },
      onSuccess: () => {
        this.logger.info('Task completed successfully', {
          taskId,
          jobId,
          queueName: this.task.queueName,
        });
      },
    });
  }

  /**
   * Called when a job fails (after all retries exhausted).
   */
  private onFailed(jobId: string, error: Error): void {
    const taskId = TaskId(jobId);

    this.logger.error('Task failed permanently', error, {
      taskId,
      jobId,
      queueName: this.task.queueName,
    });

    this.enqueueUpdate({
      taskId,
      data: {
        status: 'failed',
        failedAt: new Date(),
        error: {
          success: false,
          reason: error.message,
          stackTrace: error.stack,
          lastAttemptAt: new Date(),
        },
      },
    });
  }

  /**
   * Enqueue a database update to be processed in bulk.
   */
  private enqueueUpdate(update: PendingTaskUpdate): void {
    this.updateQueue.push(update);
    this.processUpdateQueue().catch((error) => {
      this.logger.error('Error processing update queue', error, {
        queueName: this.task.queueName,
      });
    });
  }

  /**
   * Process the update queue using bulk updates for efficiency.
   */
  private async processUpdateQueue(): Promise<void> {
    if (this.isProcessingUpdates) {
      return;
    }

    this.isProcessingUpdates = true;

    while (this.updateQueue.length > 0) {
      const batch = this.updateQueue.splice(0, this.maxUpdateBatchSize);

      const updates = batch.map((update) => ({
        id: update.taskId,
        data: update.data,
      }));

      const result = await this.repo.bulkUpdate(updates);

      if (result.isErr()) {
        this.logger.error('Failed to bulk update tasks', result.error, {
          queueName: this.task.queueName,
          batchSize: batch.length,
        });
      } else {
        for (const update of batch) {
          update.onSuccess?.();
        }
      }
    }

    this.isProcessingUpdates = false;
  }

  /**
   * Lazy-load worker client.
   */
  private getWorkerClient(): Result<IWorkerClient, ErrorWithMetadata> {
    if (this.client) {
      return ok(this.client);
    }

    const clientResult = this.dependencies
      .createWorkerClientFactory({
        appConfig: this.appConfig,
      })
      .getWorkerClient(
        this.task.queueName,
        async (job: WorkerJob) => {
          return await this.processJobForBullMQ(job);
        },
        'bullmq',
      );

    if (clientResult.isErr()) {
      return clientResult;
    }

    this.client = clientResult.value;

    // Register event handlers for lifecycle events
    this.client.on({
      onCompleted: (jobId, result) => this.onCompleted(jobId, result),
      onFailed: (jobId, error) => this.onFailed(jobId, error),
      onError: (error) => {
        this.logger.error('Worker error', error, {
          queueName: this.task.queueName,
        });
      },
    });

    return ok(this.client);
  }
}
