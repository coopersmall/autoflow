import type { ILogger } from '@backend/logger/Logger';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { CorrelationId } from '@core/domain/CorrelationId';

/**
 * Context provided to task handlers during execution
 */
export interface TaskContext {
  correlationId: CorrelationId;
  taskId: TaskId;
  logger: ILogger;
}
