import type { IAppConfigurationService } from '@backend/infrastructure/configuration/AppConfigurationService';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import { createWorkerClientFactory } from '@backend/infrastructure/queue/clients/WorkerClientFactory';
import type {
  IWorkerClient,
  WorkerJob,
} from '@backend/infrastructure/queue/domain/WorkerClient';
import { createCachedGetter } from '@backend/infrastructure/utils/createCachedGetter';
import type { TaskDefinition } from '@backend/tasks/domain/TaskDefinition';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import {
  handleTaskCompletion,
  handleTaskFailure,
  type PendingTaskUpdate,
  processBulkUpdates,
  processJob,
} from '@backend/tasks/worker/actions';
import { type AppError, internalError } from '@core/errors';
import { produce } from 'immer';
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
  private readonly getWorkerClient: () => Result<IWorkerClient, AppError>;
  private updateQueue: PendingTaskUpdate[] = [];
  private isProcessingUpdates = false;
  private readonly maxUpdateBatchSize = 100;

  constructor(
    config: TaskWorkerConfig<TPayload>,
    private readonly dependencies = {
      createTasksRepo,
      createWorkerClientFactory,
    },
    private readonly taskWorkerActions = {
      processJob,
      handleTaskCompletion,
      handleTaskFailure,
      processBulkUpdates,
    },
  ) {
    this.logger = config.logger;
    this.appConfig = config.appConfig;
    this.task = config.task;
    this.dependencies = dependencies;
    this.repo = dependencies.createTasksRepo({ appConfig: config.appConfig });

    this.getWorkerClient = createCachedGetter(() => {
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

      const client = clientResult.value;

      // Register event handlers for lifecycle events
      client.on({
        onCompleted: (jobId, result) => this.onCompleted(jobId, result),
        onFailed: (jobId, error) => this.onFailed(jobId, error),
        onError: (error) => {
          this.logger.error('Worker error', error, {
            queueName: this.task.queueName,
          });
        },
      });

      return ok(client);
    });
  }

  /**
   * Start the worker to begin processing jobs.
   */
  async start(): Promise<Result<void, AppError>> {
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
  private async processJob(job: WorkerJob): Promise<Result<unknown, AppError>> {
    return this.taskWorkerActions.processJob(
      {
        task: this.task,
        repo: this.repo,
        logger: this.logger,
      },
      { job },
    );
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
      const error = internalError(result.error.message, {
        cause: result.error,
      });
      // biome-ignore lint: BullMQ requires throwing to trigger retries - this is the API boundary
      throw error;
    }

    return result.value;
  }

  /**
   * Called when a job completes successfully.
   */
  private onCompleted(jobId: string, result: unknown): void {
    this.taskWorkerActions.handleTaskCompletion(
      {
        logger: this.logger,
        queueName: this.task.queueName,
        enqueueUpdate: this.enqueueUpdate.bind(this),
      },
      { jobId, result },
    );
  }

  /**
   * Called when a job fails (after all retries exhausted).
   */
  private onFailed(jobId: string, error: Error): void {
    this.taskWorkerActions.handleTaskFailure(
      {
        logger: this.logger,
        queueName: this.task.queueName,
        enqueueUpdate: this.enqueueUpdate.bind(this),
      },
      { jobId, error },
    );
  }

  /**
   * Enqueue a database update to be processed in bulk.
   */
  private enqueueUpdate(update: PendingTaskUpdate): void {
    this.updateQueue = produce(this.updateQueue, (draft) => {
      draft.push(update);
    });
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

    await this.taskWorkerActions.processBulkUpdates(
      {
        repo: this.repo,
        logger: this.logger,
        queueName: this.task.queueName,
        maxUpdateBatchSize: this.maxUpdateBatchSize,
      },
      {
        updateQueue: this.updateQueue,
        onComplete: (remainingQueue) => {
          this.updateQueue = remainingQueue;
        },
      },
    );

    this.isProcessingUpdates = false;
  }
}
