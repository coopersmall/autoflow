import { mock } from 'bun:test';
import { getMockedSharedService } from '@backend/services/__mocks__/SharedService.mock';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import type { ITasksService } from '@backend/tasks/domain/TasksService';
import type { ExtractMockMethods } from '@core/types';

export function getMockedTasksService(): ExtractMockMethods<ITasksService> {
  return {
    ...getMockedSharedService<TaskId, TaskRecord>(),
    getByStatus: mock(),
    getByTaskName: mock(),
    getByUserId: mock(),
    getQueueStats: mock(),
    listTasks: mock(),
    cancelTask: mock(),
    retryTask: mock(),
  };
}
