/**
 * Error factory functions and types for task operations.
 * Provides standardized error creation for task-related operations.
 */
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { NotFoundError } from '@core/errors/NotFoundError';

/**
 * Creates a task not found error.
 * @param taskId - The ID of the task that was not found
 * @returns NotFoundError with task context
 */
export function createTaskNotFoundError(taskId: string): NotFoundError {
  return new NotFoundError(`Task not found: ${taskId}`);
}

/**
 * Creates a task operation error.
 * @param operation - The operation that failed (e.g., 'retry', 'cancel')
 * @param error - The underlying error
 * @param metadata - Additional error context
 * @returns ErrorWithMetadata with task operation context
 */
export function createTaskOperationError(
  operation: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): ErrorWithMetadata {
  const message =
    error instanceof Error ? error.message : `Task ${operation} failed`;
  const cause = error instanceof Error ? error : undefined;
  return new ErrorWithMetadata(message, 'InternalServer', {
    operation,
    ...metadata,
    ...(cause ? { cause } : {}),
  });
}

/**
 * Creates an invalid task state error.
 * @param currentState - The current state of the task
 * @param attemptedOperation - The operation that was attempted
 * @returns ErrorWithMetadata with state transition context
 */
export function createInvalidTaskStateError(
  currentState: string,
  attemptedOperation: string,
): ErrorWithMetadata {
  return new ErrorWithMetadata(
    `Cannot ${attemptedOperation} task in ${currentState} state`,
    'BadRequest',
    {
      currentState,
      attemptedOperation,
    },
  );
}

/**
 * Union type of all possible task errors.
 * Used in Result<T, TaskError> return types throughout the tasks layer.
 */
export type TaskError = NotFoundError | ErrorWithMetadata;
