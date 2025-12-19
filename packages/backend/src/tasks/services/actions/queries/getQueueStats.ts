import type { Context } from '@backend/infrastructure/context';
import type { QueueStats } from '@backend/infrastructure/queue/domain/QueueStats';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { AppError } from '@core/errors/AppError';
import type { Result } from 'neverthrow';

export interface GetQueueStatsDeps {
  taskQueue: (queueName: string) => ITaskQueue;
}

export interface GetQueueStatsRequest {
  queueName: string;
}

export async function getQueueStats(
  ctx: Context,
  request: GetQueueStatsRequest,
  deps: GetQueueStatsDeps,
): Promise<Result<QueueStats, AppError>> {
  const taskQueue = deps.taskQueue(request.queueName);
  return taskQueue.getJobCounts(ctx);
}
