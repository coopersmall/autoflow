import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type {
  IQueueClient,
  QueueJob,
  QueueJobInput,
} from '@backend/infrastructure/queue/domain/QueueClient';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { ok, type Result } from 'neverthrow';

export interface EnqueueTaskContext {
  readonly client: IQueueClient;
  readonly tasksRepo: ITasksRepo;
  readonly logger: ILogger;
  readonly queueName: string;
  readonly taskToQueueJobInput: (task: TaskRecord) => QueueJobInput;
}

export interface EnqueueTaskRequest {
  readonly correlationId: CorrelationId;
  readonly task: TaskRecord;
}

/**
 * Enqueues a task to the queue and updates the task record with the external job ID.
 *
 * Orchestration flow:
 * 1. Convert task to queue job input
 * 2. Enqueue to queue client
 * 3. Update task record with external job ID
 * 4. Log success
 */
export async function enqueueTask(
  ctx: EnqueueTaskContext,
  request: EnqueueTaskRequest,
): Promise<Result<QueueJob, ErrorWithMetadata>> {
  const { client, tasksRepo, logger, taskToQueueJobInput } = ctx;
  const { correlationId, task } = request;

  const jobInput = taskToQueueJobInput(task);
  const enqueueResult = await client.enqueue(correlationId, jobInput);

  if (enqueueResult.isErr()) {
    logger.error('Failed to enqueue task', enqueueResult.error, {
      correlationId,
      taskId: task.id,
      queueName: task.queueName,
    });
    return enqueueResult;
  }

  const queueJob = enqueueResult.value;

  const updateResult = await tasksRepo.update(task.id, {
    externalId: queueJob.id,
  });

  if (updateResult.isErr()) {
    logger.error('Failed to update task with external ID', updateResult.error, {
      correlationId,
      taskId: task.id,
      queueName: task.queueName,
      externalId: queueJob.id,
    });
    // Don't fail the enqueue operation - job is already in queue
    // This is a non-fatal error
  }

  logger.info('Task enqueued successfully', {
    correlationId,
    taskId: task.id,
    externalId: queueJob.id,
    queueName: task.queueName,
    taskName: task.taskName,
  });

  return ok(queueJob);
}
