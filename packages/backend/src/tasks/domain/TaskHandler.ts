import type { TaskError } from '@backend/tasks/domain/TaskError';
import type { TaskResult } from '@backend/tasks/domain/TaskResult';
import type { Result } from 'neverthrow';
import type { TaskContext } from './TaskContext';

/**
 * Task handler function signature
 * Takes payload and context, returns Result with TaskResult or TaskError
 */
export type TaskHandler<TPayload = Record<string, unknown>> = (
  payload: TPayload,
  context: TaskContext,
) => Promise<Result<TaskResult, TaskError>>;
