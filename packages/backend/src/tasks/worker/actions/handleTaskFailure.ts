import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import { TaskId as TaskIdConstructor } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';

export interface HandleTaskFailureDeps {
  readonly logger: ILogger;
  readonly queueName: string;
  readonly enqueueUpdate: (update: {
    taskId: TaskId;
    data: Partial<TaskRecord>;
    onSuccess?: () => void;
  }) => void;
}

export interface HandleTaskFailureRequest {
  readonly jobId: string;
  readonly error: Error;
}

/**
 * Handles task failure by logging and enqueueing a database update.
 */
export function handleTaskFailure(
  deps: HandleTaskFailureDeps,
  request: HandleTaskFailureRequest,
): void {
  const { logger, queueName, enqueueUpdate } = deps;
  const { jobId, error } = request;

  const taskId = TaskIdConstructor(jobId);

  logger.error('Task failed permanently', error, {
    taskId,
    jobId,
    queueName,
  });

  enqueueUpdate({
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
