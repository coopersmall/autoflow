/**
 * Configuration options for queue behavior.
 *
 * These settings control job retention and retry strategies.
 * Use DEFAULT_QUEUE_CONFIG for sensible defaults.
 *
 * Note: This interface is provider-agnostic. Queue adapters (BullMQ, SQS, etc.)
 * are responsible for mapping these settings to their provider-specific options.
 */
export interface QueueConfig {
  /**
   * Number of completed jobs to retain in the queue.
   * Older completed jobs are automatically removed.
   * @default 100
   */
  completedJobRetention: number;

  /**
   * Number of failed jobs to retain in the queue.
   * Older failed jobs are automatically removed.
   * @default 500
   */
  failedJobRetention: number;

  /**
   * Retry configuration for failed jobs.
   */
  retry: {
    /**
     * Retry strategy:
     * - 'exponential': Delay doubles after each retry (recommended)
     * - 'fixed': Same delay between each retry
     * @default 'exponential'
     */
    strategy: 'exponential' | 'fixed';

    /**
     * Initial delay in milliseconds before first retry.
     * For exponential strategy, subsequent retries double this value.
     * @default 5000 (5 seconds)
     */
    initialDelay: number;
  };
}

/**
 * Default configuration values for queues.
 *
 * These defaults are suitable for most production workloads:
 * - Keeps enough job history for debugging
 * - Uses exponential backoff to avoid overwhelming failing services
 * - 5 second initial delay gives transient issues time to resolve
 */
export const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  completedJobRetention: 100,
  failedJobRetention: 500,
  retry: {
    strategy: 'exponential',
    initialDelay: 5000,
  },
} as const;

/**
 * Fast retry configuration for integration tests.
 * Uses 100ms delay instead of 5s for faster test execution.
 */
export const FAST_RETRY_CONFIG: QueueConfig = {
  completedJobRetention: 100,
  failedJobRetention: 500,
  retry: {
    strategy: 'exponential',
    initialDelay: 100,
  },
} as const;
