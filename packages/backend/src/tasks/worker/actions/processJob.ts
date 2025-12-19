import { createContext } from '@backend/infrastructure/context';
import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { WorkerJob } from '@backend/infrastructure/queue/domain/WorkerClient';
import type { TaskContext } from '@backend/tasks/domain/TaskContext';
import type { TaskDefinition } from '@backend/tasks/domain/TaskDefinition';
import { TaskId } from '@backend/tasks/domain/TaskId';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import { CorrelationId } from '@core/domain/CorrelationId';
import { type AppError, badRequest, internalError } from '@core/errors';
import { isString } from 'lodash';
import { err, ok, type Result } from 'neverthrow';

export interface ProcessJobDeps<TPayload> {
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
 * 1. Extract correlationId from job data (propagated from scheduler)
 * 2. Validate payload using task's validator
 * 3. Update task status to 'active'
 * 4. Execute task handler
 * 5. Return result
 */
export async function processJob<TPayload>(
  deps: ProcessJobDeps<TPayload>,
  request: ProcessJobRequest,
): Promise<Result<unknown, AppError>> {
  const { task, repo, logger } = deps;
  const { job } = request;

  const taskId = TaskId(job.id);

  // Retrieve correlationId from job data (stored when scheduled)
  // Fall back to generating new one for backwards compatibility
  const correlationId = isString(job.data.correlationId)
    ? CorrelationId(job.data.correlationId)
    : CorrelationId();

  // Create abort controller for this job
  const abortController = new AbortController();

  // Build Context for service calls
  const ctx = createContext(correlationId, abortController);

  // Build TaskContext for the handler (keeps existing interface)
  const taskContext: TaskContext = {
    correlationId,
    taskId,
    logger,
  };

  // Validate payload using the task's validator
  const payloadValidation = task.validator(job.data);
  if (payloadValidation.isErr()) {
    const error = badRequest('Task payload validation failed', {
      metadata: {
        correlationId,
        taskId,
        queueName: task.queueName,
        validationError: payloadValidation.error.message,
      },
    });
    logger.error('Task payload validation failed', error, {
      correlationId,
      taskId,
      queueName: task.queueName,
    });
    return err(error);
  }

  const validPayload = payloadValidation.value;

  // Update task status to 'active' in database
  const updateResult = await repo.update(ctx, taskId, {
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

  // Execute the task handler (TaskContext only, not Context)
  const result = await task.handler(validPayload, taskContext);

  if (result.isErr()) {
    const error = internalError('Task execution failed', {
      metadata: {
        correlationId,
        taskId,
        queueName: task.queueName,
        taskError: result.error,
      },
    });
    return err(error);
  }

  return ok(result.value);
}
