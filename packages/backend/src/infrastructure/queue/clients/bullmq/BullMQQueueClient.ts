import type { CorrelationId } from '@core/domain/CorrelationId';
import { ErrorWithMetadata } from '@core/errors/ErrorWithMetadata';
import { type Job, Queue, type QueueOptions } from 'bullmq';
import Redis from 'ioredis';
import { err, ok, type Result } from 'neverthrow';
import type {
  IQueueClient,
  QueueJob,
  QueueJobInput,
} from '../../domain/QueueClient.ts';
import type { QueueConfig } from '../../domain/QueueConfig.ts';
import type { QueueStats } from '../../domain/QueueStats.ts';

/**
 * Factory type for creating BullMQ Queue instances.
 * Useful for dependency injection in tests.
 */
export type QueueFactory = (name: string, options: QueueOptions) => Queue;

/**
 * Default factory that creates real BullMQ Queue instances
 */
const defaultQueueFactory: QueueFactory = (name, options) =>
  new Queue(name, options);

/**
 * Dependencies that can be injected for testing
 */
export interface BullMQQueueClientDeps {
  createQueue?: QueueFactory;
}

/**
 * Factory function to create a BullMQ queue client
 */
export function createBullMQQueueClient(
  {
    queueName,
    redisUrl,
    config,
  }: {
    queueName: string;
    redisUrl: string;
    config: QueueConfig;
  },
  deps: BullMQQueueClientDeps = {},
): IQueueClient {
  return Object.freeze(
    new BullMQQueueClient(queueName, redisUrl, config, deps),
  );
}

/**
 * Minimal BullMQ adapter that implements IQueueClient.
 *
 * This is a PURE ADAPTER - it only:
 * - Translates domain types to BullMQ types
 * - Calls BullMQ APIs
 * - Translates BullMQ responses back to domain types
 *
 * NO business logic:
 * - No database operations
 * - No logging
 * - No complex error handling
 *
 * All orchestration (DB + logging + error handling) belongs in TaskQueue.ts
 */
class BullMQQueueClient implements IQueueClient {
  private readonly queue: Queue;

  constructor(
    private readonly queueName: string,
    redisUrl: string,
    private readonly config: QueueConfig,
    deps: BullMQQueueClientDeps = {},
  ) {
    const createQueue = deps.createQueue ?? defaultQueueFactory;

    // Initialize BullMQ Queue with Redis connection
    // Map provider-agnostic config to BullMQ-specific options
    this.queue = createQueue(queueName, {
      connection: getRedisConnection(redisUrl),
      // connection: { url: redisUrl },
      defaultJobOptions: {
        removeOnComplete: config.completedJobRetention,
        removeOnFail: config.failedJobRetention,
      },
    });
  }

  async enqueue(
    correlationId: CorrelationId,
    job: QueueJobInput,
  ): Promise<Result<QueueJob, ErrorWithMetadata>> {
    try {
      // Create BullMQ job
      const bullmqJob = await this.queue.add(job.name, job.data, {
        jobId: job.id,
        priority: job.priority ? this.mapPriority(job.priority) : 3,
        delay: job.delay,
        attempts: job.maxAttempts,
        // Map provider-agnostic retry config to BullMQ backoff options
        backoff: {
          type: this.config.retry.strategy,
          delay: this.config.retry.initialDelay,
        },
      });

      // Convert BullMQ Job to generic QueueJob
      return ok(this.toQueueJob(bullmqJob));
    } catch (error) {
      return err(
        new ErrorWithMetadata('Failed to enqueue job', 'InternalServer', {
          correlationId,
          jobId: job.id,
          jobName: job.name,
          queueName: this.queueName,
          cause: error,
        }),
      );
    }
  }

  async remove(
    correlationId: CorrelationId,
    jobId: string,
  ): Promise<Result<void, ErrorWithMetadata>> {
    try {
      const job = await this.queue.getJob(jobId);

      if (!job) {
        // Job not found - this is OK, might have already been processed
        return ok(undefined);
      }

      await job.remove();
      return ok(undefined);
    } catch (error) {
      return err(
        new ErrorWithMetadata(
          'Failed to remove job from queue',
          'InternalServer',
          {
            correlationId,
            jobId,
            queueName: this.queueName,
            cause: error,
          },
        ),
      );
    }
  }

  async getJob(
    correlationId: CorrelationId,
    jobId: string,
  ): Promise<Result<QueueJob | null, ErrorWithMetadata>> {
    try {
      const job = await this.queue.getJob(jobId);
      if (!job) {
        return ok(null);
      }
      return ok(this.toQueueJob(job));
    } catch (error) {
      return err(
        new ErrorWithMetadata('Failed to get job', 'InternalServer', {
          correlationId,
          jobId,
          queueName: this.queueName,
          cause: error,
        }),
      );
    }
  }

  async getStats(
    correlationId: CorrelationId,
  ): Promise<Result<QueueStats, ErrorWithMetadata>> {
    try {
      const counts = await this.queue.getJobCounts(
        'waiting',
        'active',
        'completed',
        'failed',
        'delayed',
      );

      return ok({
        queueName: this.queueName,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        completed: counts.completed ?? 0,
        failed: counts.failed ?? 0,
        delayed: counts.delayed ?? 0,
      });
    } catch (error) {
      return err(
        new ErrorWithMetadata('Failed to get job counts', 'InternalServer', {
          correlationId,
          queueName: this.queueName,
          cause: error,
        }),
      );
    }
  }

  async close(): Promise<void> {
    await this.queue.close();
  }

  // Private helper methods

  /**
   * Map priority to BullMQ priority (lower number = higher priority)
   */
  private mapPriority(
    priority: 'critical' | 'high' | 'normal' | 'low',
  ): number {
    switch (priority) {
      case 'critical':
        return 1;
      case 'high':
        return 2;
      case 'normal':
        return 3;
      case 'low':
        return 4;
      default:
        return 3;
    }
  }

  /**
   * Convert BullMQ Job to generic QueueJob
   * This abstracts away BullMQ-specific types
   */
  private toQueueJob(job: Job): QueueJob {
    return {
      id: job.id ?? 'unknown',
      name: job.name,
      data: job.data,
      attemptsMade: job.attemptsMade,
      timestamp: job.timestamp,
    };
  }
}

let RedisConnection: Redis | undefined;

function getRedisConnection(redisUrl: string): Redis {
  if (!RedisConnection) {
    RedisConnection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  }
  return RedisConnection;
}
