import { mock } from 'bun:test';
import type { IQueueClientFactory } from '@backend/tasks/domain/QueueClientFactory';
import type { ExtractMockMethods } from '@core/types';

/**
 * Creates a mocked QueueClientFactory for unit testing.
 *
 * @returns Mocked IQueueClientFactory with all methods as mock functions
 *
 * @example
 * ```typescript
 * const mockClient = getMockedQueueClient();
 * const mockFactory = getMockedQueueClientFactory();
 * mockFactory.getQueueClient.mockReturnValue(ok(mockClient));
 *
 * const result = mockFactory.getQueueClient('my-queue');
 * expect(mockFactory.getQueueClient).toHaveBeenCalledWith('my-queue');
 * ```
 */
export function getMockedQueueClientFactory(): ExtractMockMethods<IQueueClientFactory> {
  return {
    getQueueClient: mock(),
  };
}
