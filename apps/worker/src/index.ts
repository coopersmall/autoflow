import {
  createAppConfigurationService,
  createTaskWorker,
  getLogger,
} from '@autoflow/backend';
import { tasks } from './tasks.manifest';

/**
 * Worker application entry point.
 *
 * Starts a TaskWorker for each task defined in tasks.config.ts.
 * Each worker processes tasks from its queue.
 *
 * Usage:
 *   bun run apps/worker/src/index.ts
 */
async function main(): Promise<void> {
  const logger = getLogger({ service: 'workers' });
  const appConfig = createAppConfigurationService();

  logger.info('Starting workers', { taskCount: tasks.length });

  // Create and start a worker for each task
  const workerResults = await Promise.all(
    tasks.map(async (task) => {
      const worker = createTaskWorker({
        logger,
        appConfig,
        task,
      });

      const result = await worker.start();

      if (result.isErr()) {
        logger.error('Failed to start worker', result.error, {
          queueName: task.queueName,
        });
        return { worker, started: false, queueName: task.queueName };
      }

      return { worker, started: true, queueName: task.queueName };
    }),
  );

  // Check if all workers started successfully
  const failedWorkers = workerResults.filter((r) => !r.started);
  if (failedWorkers.length > 0) {
    logger.error('Some workers failed to start', undefined, {
      failed: failedWorkers.map((w) => w.queueName),
    });
    process.exit(1);
  }

  const workers = workerResults.map((r) => r.worker);

  logger.info('All workers started successfully', {
    queues: tasks.map((t) => t.queueName),
  });

  // Graceful shutdown handler
  const shutdown = async (signal: string): Promise<void> => {
    logger.info('Received shutdown signal, stopping workers', { signal });

    await Promise.all(workers.map((worker) => worker.stop()));

    logger.info('All workers stopped');
    process.exit(0);
  };

  process.on('SIGTERM', () => {
    shutdown('SIGTERM').catch((err: unknown) => {
      logger.error('Error during shutdown', err);
    });
  });
  process.on('SIGINT', () => {
    shutdown('SIGINT').catch((err: unknown) => {
      logger.error('Error during shutdown', err);
    });
  });
}

main().catch((_error: unknown) => {
  process.exit(1);
});
