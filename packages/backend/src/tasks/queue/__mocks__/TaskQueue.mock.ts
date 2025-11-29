import { mock } from 'bun:test';
import type { ITaskQueue } from '@backend/tasks/domain/TaskQueue';
import type { ExtractMockMethods } from '@core/types';

/**
 * Creates a mocked TaskQueue for unit testing.
 *
 * @returns Mocked ITaskQueue with all methods as mock functions
 *
 * @example
 * ```typescript
 * const mockQueue = getMockedTaskQueue();
 * mockQueue.enqueue.mockResolvedValue(ok({ id: 'job-123', name: 'test', data: {} }));
 *
 * const result = await mockQueue.enqueue(correlationId, task);
 * expect(mockQueue.enqueue).toHaveBeenCalledWith(correlationId, task);
 * ```
 */
export function getMockedTaskQueue(): ExtractMockMethods<ITaskQueue> {
  return {
    enqueue: mock(),
    remove: mock(),
    getJob: mock(),
    getJobCounts: mock(),
    close: mock(),
  };
}

/**
 * Creates a factory function that returns mocked TaskQueues.
 * Useful for testing code that creates queues by name.
 *
 * @param mockQueue - Optional pre-configured mock to return
 * @returns A factory function that returns the mock queue
 */
export function getMockedTaskQueueFactory(
  mockQueue = getMockedTaskQueue(),
): (queueName: string) => ExtractMockMethods<ITaskQueue> {
  return (_queueName: string) => mockQueue;
}
