import type { QueueStats } from '@backend/infrastructure/queue/domain/QueueStats';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { CorrelationId } from '@core/domain/CorrelationId';
import type { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import type { Result } from 'neverthrow';

export interface GetQueueStatsContext {
  taskQueue: (queueName: string) => ITaskQueue;
}

export interface GetQueueStatsRequest {
  correlationId: CorrelationId;
  queueName: string;
}

export async function getQueueStats(
  ctx: GetQueueStatsContext,
  request: GetQueueStatsRequest,
): Promise<Result<QueueStats, ErrorWithMetadata>> {
  const taskQueue = ctx.taskQueue(request.queueName);
  return taskQueue.getJobCounts(request.correlationId);
}
