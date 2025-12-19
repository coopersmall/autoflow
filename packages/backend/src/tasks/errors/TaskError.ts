/**
 * Error factory functions and types for task operations.
 * Provides standardized error creation for task-related operations.
 */
import {
  type AppError,
  badRequest,
  internalError,
  notFound,
} from '@core/errors';

/**
 * Creates a task not found error.
 * @param taskId - The ID of the task that was not found
 * @returns AppError with NotFound code and task context
 */
export function createTaskNotFoundError(taskId: string): AppError {
  return notFound(`Task not found: ${taskId}`);
}

/**
 * Creates a task operation error.
 * @param operation - The operation that failed (e.g., 'retry', 'cancel')
 * @param error - The underlying error
 * @param metadata - Additional error context
 * @returns AppError with InternalServer code and task operation context
 */
export function createTaskOperationError(
  operation: string,
  error: unknown,
  metadata?: Record<string, unknown>,
): AppError {
  const message =
    error instanceof Error ? error.message : `Task ${operation} failed`;
  const cause = error instanceof Error ? error : undefined;
  return internalError(message, {
    cause,
    metadata: {
      operation,
      ...metadata,
    },
  });
}

/**
 * Creates an invalid task state error.
 * @param currentState - The current state of the task
 * @param attemptedOperation - The operation that was attempted
 * @returns AppError with BadRequest code and state transition context
 */
export function createInvalidTaskStateError(
  currentState: string,
  attemptedOperation: string,
): AppError {
  return badRequest(
    `Cannot ${attemptedOperation} task in ${currentState} state`,
    {
      metadata: {
        currentState,
        attemptedOperation,
      },
    },
  );
}

/**
 * Union type of all possible task errors.
 * Used in Result<T, TaskError> return types throughout the tasks layer.
 */
export type TaskError = AppError;
