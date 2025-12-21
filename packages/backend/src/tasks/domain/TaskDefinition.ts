import type { Validator } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import type { TaskContext } from './TaskContext';
import type { TaskError } from './TaskError';
import type { TaskOptions } from './TaskOptions';
import { DEFAULT_TASK_OPTIONS } from './TaskOptions';
import type { TaskResult } from './TaskResult';

/**
 * Function signature for task handlers.
 * Takes a validated payload and context, returns a Result.
 */
export type TaskHandlerFn<TPayload> = (
  payload: TPayload,
  ctx: TaskContext,
) => Promise<Result<TaskResult, TaskError>>;

/**
 * Complete definition of a task.
 * Contains everything needed to schedule and process the task.
 */
export interface TaskDefinition<TPayload = Record<string, unknown>> {
  /** Queue name - also serves as the task identifier (one queue = one task type) */
  queueName: string;
  /** Validator function for the task payload */
  validator: Validator<TPayload>;
  /** Handler function that executes the task */
  handler: TaskHandlerFn<TPayload>;
  /** Task execution options (priority, retries, etc.) */
  options: Required<TaskOptions>;
}

/**
 * Configuration for defining a task.
 */
interface DefineTaskConfig<TPayload> {
  /** Queue name - also serves as task identifier (one queue = one task type) */
  queueName: string;
  /** Validator function for the task payload */
  validator: Validator<TPayload>;
  /** Handler function that executes the task */
  handler: TaskHandlerFn<TPayload>;
  /** Optional task execution options */
  options?: TaskOptions;
}

/**
 * Factory function to create a TaskDefinition.
 *
 * @example
 * ```typescript
 * const sendWelcomeEmailTask = defineTask({
 *   queueName: 'users:send-welcome-email',
 *   validator: validWelcomeEmailPayload,
 *   handler: async (payload, ctx) => {
 *     ctx.logger.info('Sending welcome email', { email: payload.email });
 *     return ok({ success: true, duration: 100 });
 *   },
 *   options: {
 *     priority: 'high',
 *     maxAttempts: 3,
 *   },
 * });
 * ```
 */
export function defineTask<TPayload>(
  config: DefineTaskConfig<TPayload>,
): TaskDefinition<TPayload> {
  return {
    queueName: config.queueName,
    validator: config.validator,
    handler: config.handler,
    options: { ...DEFAULT_TASK_OPTIONS, ...config.options },
  };
}
