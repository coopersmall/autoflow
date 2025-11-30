import type { TaskPriority } from './TaskPriority.ts';

/**
 * Configuration options for task execution behavior.
 */
export interface TaskOptions {
  /** Task priority in the queue */
  priority?: TaskPriority;
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  /** Delay between retries in milliseconds */
  backoffMs?: number;
  /** Maximum execution time in milliseconds */
  timeoutMs?: number;
}

export const DEFAULT_TASK_OPTIONS: Required<TaskOptions> = {
  priority: 'normal',
  maxAttempts: 3,
  backoffMs: 1000,
  timeoutMs: 30000,
} as const;
