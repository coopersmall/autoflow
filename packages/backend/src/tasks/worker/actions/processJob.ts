import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { WorkerJob } from '@backend/infrastructure/queue/domain/WorkerClient';
import type { TaskContext } from '@backend/tasks/domain/TaskContext';
import type { TaskDefinition } from '@backend/tasks/domain/TaskDefinition';
import { TaskId } from '@backend/tasks/domain/TaskId';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { err, ok, type Result } from 'neverthrow';

export interface ProcessJobContext<TPayload> {
  readonly task: TaskDefinition<TPayload>;
  readonly repo: ITasksRepo;
  readonly logger: ILogger;
}

export interface ProcessJobRequest {
  readonly job: WorkerJob;
}

/**
 * Process a job from the queue.
 *
 * Orchestration flow:
 * 1. Validate payload using task's validator
 * 2. Update task status to 'active'
 * 3. Execute task handler
 * 4. Return result
 */
export async function processJob<TPayload>(
  ctx: ProcessJobContext<TPayload>,
  request: ProcessJobRequest,
): Promise<Result<unknown, ErrorWithMetadata>> {
  const { task, repo, logger } = ctx;
  const { job } = request;

  const taskId = TaskId(job.id);
  const correlationId = CorrelationId();

  // Build task context
  const context: TaskContext = {
    correlationId,
    taskId,
    logger,
  };

  // Validate payload using the task's validator
  const payloadValidation = task.validator(job.data);
  if (payloadValidation.isErr()) {
    const error = new ErrorWithMetadata(
      'Task payload validation failed',
      'BadRequest',
      {
        correlationId,
        taskId,
        queueName: task.queueName,
        validationError: payloadValidation.error.message,
      },
    );
    logger.error('Task payload validation failed', error, {
      correlationId,
      taskId,
      queueName: task.queueName,
    });
    return err(error);
  }

  const validPayload = payloadValidation.value;

  // Update task status to 'active' in database
  const updateResult = await repo.update(taskId, {
    status: 'active',
    startedAt: new Date(),
  });

  if (updateResult.isErr()) {
    logger.error('Failed to update task status to active', updateResult.error, {
      correlationId,
      taskId,
      queueName: task.queueName,
    });
    // Continue processing - don't fail the job for a status update issue
  }

  // Execute the task handler
  const result = await task.handler(validPayload, context);

  if (result.isErr()) {
    const error = new ErrorWithMetadata(
      'Task execution failed',
      'InternalServer',
      {
        correlationId,
        taskId,
        queueName: task.queueName,
        taskError: result.error,
      },
    );
    return err(error);
  }

  return ok(result.value);
}
