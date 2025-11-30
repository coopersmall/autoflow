/**
 * Supported queue provider types
 */
export type QueueProvider = 'bullmq' | 'sqs' | 'rabbitmq';

/**
 * Type of worker client implementation
 */
export type WorkerClientType = QueueProvider;

/**
 * Provider-specific context passed with each job.
 * Ephemeral - lives only during job processing, not persisted.
 *
 * This allows provider-specific functionality (like extending message visibility
 * in SQS) without coupling the domain model to any specific queue provider.
 */
export interface ProviderContext {
  /** Which queue provider this job came from */
  provider: QueueProvider;

  /** Provider's ID for this job (jobId for BullMQ, messageId for SQS, etc.) */
  externalId: string;

  /**
   * Extend the processing lock for long-running tasks.
   * - BullMQ: extends job lock
   * - SQS: extends message visibility timeout
   * - RabbitMQ: not typically needed (acks are explicit)
   */
  extendLock?: (durationMs: number) => Promise<void>;

  /**
   * Provider-specific metadata.
   * - BullMQ: { timestamp, processedOn, token }
   * - SQS: { receiptHandle, sentTimestamp }
   * - RabbitMQ: { deliveryTag, redelivered }
   */
  metadata?: Record<string, unknown>;
}

/**
 * Raw job data from the queue system.
 *
 * This is a normalized representation that works across all providers.
 * Provider-specific details are in the `provider` context.
 */
export interface WorkerJob {
  /** Task ID (from job payload, not provider's external ID) */
  id: string;

  /** Task name/type identifier */
  name: string;

  /** Task payload data */
  data: Record<string, unknown>;

  /** Number of times this job has been attempted (1-indexed) */
  attempts: number;

  /** Maximum attempts before permanent failure */
  maxAttempts: number;

  /** Provider-specific context (ephemeral, not persisted) */
  provider: ProviderContext;
}

/**
 * Handler function that processes a raw job from the queue.
 *
 * This is a LOW-LEVEL handler that receives raw queue job data.
 * The client doesn't know about TaskContext, TaskResult, or domain concepts.
 * It just processes jobs and returns results or throws errors.
 *
 * @param job - Raw job from queue system (BullMQ, SQS, etc.)
 * @returns The result value (any) or throws an error to trigger retry
 */
export type WorkerJobHandler = (job: WorkerJob) => Promise<unknown>;

/**
 * Worker lifecycle events (raw, no domain knowledge)
 */
export interface WorkerEvents {
  /**
   * Called when a job completes successfully
   */
  onCompleted?: (jobId: string, result: unknown) => void;

  /**
   * Called when a job fails (after all retries exhausted)
   */
  onFailed?: (jobId: string, error: Error) => void;

  /**
   * Called when the worker encounters an error
   */
  onError?: (error: Error) => void;
}

/**
 * Minimal interface for worker operations.
 *
 * This is a PURE ADAPTER interface - it should:
 * - Accept a job handler function
 * - Process jobs from the queue
 * - Call the handler with raw job data
 * - Provide lifecycle hooks
 *
 * It should NOT:
 * - Know about TaskContext, TaskResult, or domain types
 * - Update the database
 * - Do logging (beyond what the queue system requires)
 * - Build contexts or orchestrate workflows
 *
 * All orchestration belongs in TaskWorker.ts
 */
export interface IWorkerClient {
  /**
   * Start processing jobs from the queue
   */
  start(): Promise<void>;

  /**
   * Stop processing jobs and close connections
   */
  stop(): Promise<void>;

  /**
   * Register event handlers for worker lifecycle events
   * @param events - Object containing event handler functions
   */
  on(events: WorkerEvents): void;
}
