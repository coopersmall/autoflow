import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import { TaskId as TaskIdConstructor } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';

export interface HandleTaskCompletionContext {
  readonly logger: ILogger;
  readonly queueName: string;
  readonly enqueueUpdate: (update: {
    taskId: TaskId;
    data: Partial<TaskRecord>;
    onSuccess?: () => void;
  }) => void;
}

export interface HandleTaskCompletionRequest {
  readonly jobId: string;
  readonly result: unknown;
}

/**
 * Handles task completion by enqueueing a database update.
 */
export function handleTaskCompletion(
  ctx: HandleTaskCompletionContext,
  request: HandleTaskCompletionRequest,
): void {
  const { logger, queueName, enqueueUpdate } = ctx;
  const { jobId } = request;

  const taskId = TaskIdConstructor(jobId);

  enqueueUpdate({
    taskId,
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
    onSuccess: () => {
      logger.info('Task completed successfully', {
        taskId,
        jobId,
        queueName,
      });
    },
  });
}
