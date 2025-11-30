import { mock } from 'bun:test';
import type {
  IWorkerClient,
  ProviderContext,
  WorkerJob,
} from '@backend/infrastructure/queue/domain/WorkerClient';
import type { ExtractMockMethods } from '@core/types';

/**
 * Creates a mocked WorkerClient for unit testing.
 *
 * @returns Mocked IWorkerClient with all methods as mock functions
 *
 * @example
 * ```typescript
 * const mockClient = getMockedWorkerClient();
 * mockClient.start.mockResolvedValue(undefined);
 *
 * await mockClient.start();
 * expect(mockClient.start).toHaveBeenCalled();
 * ```
 */
export function getMockedWorkerClient(): ExtractMockMethods<IWorkerClient> {
  return {
    start: mock(),
    stop: mock(),
    on: mock(),
  };
}

/**
 * Creates a test ProviderContext for use in tests.
 *
 * @param overrides - Partial ProviderContext to override defaults
 * @returns A complete ProviderContext
 */
export function createTestProviderContext(
  overrides: Partial<ProviderContext> = {},
): ProviderContext {
  return {
    provider: 'bullmq',
    externalId: 'job-123',
    extendLock: mock(),
    metadata: {},
    ...overrides,
  };
}

/**
 * Creates a test WorkerJob for use in tests.
 *
 * @param overrides - Partial WorkerJob to override defaults
 * @returns A complete WorkerJob
 */
export function createTestWorkerJob(
  overrides: Partial<WorkerJob> = {},
): WorkerJob {
  return {
    id: 'task-123',
    name: 'test:task',
    data: { taskId: 'task-123' },
    attempts: 1,
    maxAttempts: 3,
    provider: createTestProviderContext(),
    ...overrides,
  };
}
