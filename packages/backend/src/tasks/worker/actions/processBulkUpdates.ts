import type { ILogger } from '@backend/infrastructure/logger/Logger';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';

export interface ProcessBulkUpdatesContext {
  readonly repo: ITasksRepo;
  readonly logger: ILogger;
  readonly queueName: string;
  readonly maxUpdateBatchSize: number;
}

export interface PendingTaskUpdate {
  taskId: TaskId;
  data: Partial<TaskRecord>;
  onSuccess?: () => void;
}

export interface ProcessBulkUpdatesRequest {
  readonly updateQueue: PendingTaskUpdate[];
  readonly onComplete: (remainingQueue: PendingTaskUpdate[]) => void;
}

/**
 * Process the update queue using bulk updates for efficiency.
 *
 * Processes updates in batches up to maxUpdateBatchSize.
 * Calls onSuccess callbacks for successful updates.
 */
export async function processBulkUpdates(
  ctx: ProcessBulkUpdatesContext,
  request: ProcessBulkUpdatesRequest,
): Promise<void> {
  const { repo, logger, queueName, maxUpdateBatchSize } = ctx;
  let { updateQueue } = request;
  const { onComplete } = request;

  while (updateQueue.length > 0) {
    const batch = updateQueue.slice(0, maxUpdateBatchSize);
    updateQueue = updateQueue.slice(maxUpdateBatchSize);

    const updates = batch.map((update) => ({
      id: update.taskId,
      data: update.data,
    }));

    const result = await repo.bulkUpdate(updates);

    if (result.isErr()) {
      logger.error('Failed to bulk update tasks', result.error, {
        queueName,
        batchSize: batch.length,
      });
    } else {
      for (const update of batch) {
        update.onSuccess?.();
      }
    }
  }

  onComplete(updateQueue);
}
