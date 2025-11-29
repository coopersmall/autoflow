import { mock } from 'bun:test';
import { getMockedSharedRepo } from '@backend/repos/__mocks__/SharedRepo.mock';
import { TaskId } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksRepo } from '@backend/tasks/domain/TasksRepo';
import type { ExtractMockMethods } from '@core/types';

/**
 * Creates a mocked TasksRepo for unit testing.
 *
 * @returns Mocked ITasksRepo with all methods as mock functions
 *
 * @example
 * ```typescript
 * const mockRepo = getMockedTasksRepo();
 * mockRepo.get.mockResolvedValue(ok(taskRecord));
 *
 * const result = await mockRepo.get(taskId);
 * expect(mockRepo.get).toHaveBeenCalledWith(taskId);
 * ```
 */
export function getMockedTasksRepo(): ExtractMockMethods<ITasksRepo> {
  return {
    ...getMockedSharedRepo(),
    getByStatus: mock(),
    getByTaskName: mock(),
    getByUserId: mock(),
    listTasks: mock(),
    bulkUpdate: mock(),
  };
}

/**
 * Creates a test TaskRecord for use in tests.
 *
 * @param overrides - Partial TaskRecord to override defaults
 * @returns A complete TaskRecord
 */
export function createTestTaskRecord(
  overrides: Partial<TaskRecord> = {},
): TaskRecord {
  const now = new Date();
  return {
    id: TaskId('task-123'),
    taskName: 'test:task',
    queueName: 'test:task',
    payload: {},
    status: 'pending',
    priority: 'normal',
    attempts: 0,
    maxAttempts: 3,
    enqueuedAt: now,
    createdAt: now,
    updatedAt: now,
    schemaVersion: 1,
    ...overrides,
  };
}
