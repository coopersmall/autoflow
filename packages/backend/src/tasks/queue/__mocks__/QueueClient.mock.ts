import { mock } from 'bun:test';
import type { IQueueClient, QueueJob } from '@backend/tasks/domain/QueueClient';
import type { ExtractMockMethods } from '@core/types';

/**
 * Creates a mocked QueueClient for unit testing.
 *
 * @returns Mocked IQueueClient with all methods as mock functions
 *
 * @example
 * ```typescript
 * const mockClient = getMockedQueueClient();
 * mockClient.enqueue.mockResolvedValue(ok({ id: 'job-123', name: 'test', data: {} }));
 *
 * const result = await mockClient.enqueue(correlationId, task);
 * expect(mockClient.enqueue).toHaveBeenCalledWith(correlationId, task);
 * ```
 */
export function getMockedQueueClient(): ExtractMockMethods<IQueueClient> {
  return {
    enqueue: mock(),
    remove: mock(),
    getJob: mock(),
    getStats: mock(),
    close: mock(),
  };
}

/**
 * Creates a test QueueJob for use in tests.
 *
 * @param overrides - Partial QueueJob to override defaults
 * @returns A complete QueueJob
 */
export function createTestQueueJob(
  overrides: Partial<QueueJob> = {},
): QueueJob {
  return {
    id: 'job-123',
    name: 'test:task',
    data: {},
    attemptsMade: 0,
    timestamp: Date.now(),
    ...overrides,
  };
}
