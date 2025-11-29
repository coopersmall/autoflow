import { TaskId } from '@backend/tasks/domain/TaskId';
import type {
  IWorkerClient,
  ProviderContext,
  WorkerEvents,
  WorkerJob,
  WorkerJobHandler,
} from '@backend/tasks/domain/WorkerClient';
import { type Job, type Processor, Worker, type WorkerOptions } from 'bullmq';
import Redis from 'ioredis';

/**
 * Factory type for creating BullMQ Worker instances.
 * Useful for dependency injection in tests.
 */
export type WorkerFactory = (
  name: string,
  processor: Processor,
  options: WorkerOptions,
) => Worker;

/**
 * Default factory that creates real BullMQ Worker instances
 */
const defaultWorkerFactory: WorkerFactory = (name, processor, options) =>
  new Worker(name, processor, options);

/**
 * Dependencies that can be injected for testing
 */
export interface BullMQWorkerClientDeps {
  createWorker?: WorkerFactory;
}

/**
 * Factory function to create a BullMQ worker client
 */
export function createBullMQWorkerClient(
  {
    queueName,
    redisUrl,
    handler,
  }: {
    queueName: string;
    redisUrl: string;
    handler: WorkerJobHandler;
  },
  deps: BullMQWorkerClientDeps = {},
): IWorkerClient {
  return new BullMQWorkerClient(queueName, redisUrl, handler, deps);
}

/**
 * Minimal BullMQ adapter that implements IWorkerClient.
 *
 * This is a PURE ADAPTER - it only:
 * - Translates BullMQ Job to generic WorkerJob
 * - Calls the handler function
 * - Translates results back to BullMQ
 * - Provides lifecycle hooks
 *
 * NO business logic:
 * - No database operations
 * - No logging (except BullMQ's own logging)
 * - No context building
 * - No task domain knowledge
 *
 * All orchestration (DB + logging + context building) belongs in TaskWorker.ts
 */
class BullMQWorkerClient implements IWorkerClient {
  private worker?: Worker;
  private events?: WorkerEvents;
  private readonly createWorker: WorkerFactory;

  constructor(
    private readonly queueName: string,
    private readonly redisUrl: string,
    private readonly handler: WorkerJobHandler,
    deps: BullMQWorkerClientDeps = {},
  ) {
    this.createWorker = deps.createWorker ?? defaultWorkerFactory;
  }

  async start(): Promise<void> {
    // Create BullMQ Worker with Redis connection
    this.worker = this.createWorker(
      this.queueName,
      async (job: Job) => {
        const externalId = job.id ?? TaskId();

        // Build provider context with BullMQ-specific details
        const providerContext: ProviderContext = {
          provider: 'bullmq',
          externalId,
          // Extend lock for long-running tasks
          extendLock: job.token
            ? async (durationMs: number) => {
                // biome-ignore lint: Turnary operator ensures job.token is defined
                await job.extendLock(job.token!, durationMs);
              }
            : undefined,
          metadata: {
            timestamp: job.timestamp,
            processedOn: job.processedOn,
            token: job.token,
          },
        };

        // Convert BullMQ Job to generic WorkerJob
        const workerJob: WorkerJob = {
          id: externalId,
          name: job.name,
          data: job.data,
          attempts: job.attemptsMade + 1, // BullMQ is 0-indexed, normalize to 1-indexed
          maxAttempts: job.opts.attempts ?? 3,
          provider: providerContext,
        };

        // Call the handler with generic job data
        // Handler can throw to trigger retry, or return result
        const result = await this.handler(workerJob);
        return result;
      },
      {
        connection: getRedisConnection(this.redisUrl),
        // connection: { url: this.redisUrl },
      },
    );

    // Register event handlers to forward BullMQ events to our generic events
    this.worker.on('completed', (job, result) => {
      this.events?.onCompleted?.(job.id ?? 'unknown', result);
    });

    this.worker.on('failed', (job, error) => {
      this.events?.onFailed?.(job?.id ?? 'unknown', error);
    });

    this.worker.on('error', (error) => {
      this.events?.onError?.(error);
    });
  }

  async stop(): Promise<void> {
    await this.worker?.close();
  }

  on(events: WorkerEvents): void {
    this.events = events;
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
