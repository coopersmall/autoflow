import { describe, expect, it } from 'bun:test';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import { TaskId as TaskIdConstructor } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import { newTaskRecord } from '@backend/tasks/domain/TaskRecord';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { UserId } from '@core/domain/user/user';

describe('TasksRepo Integration Tests', () => {
  const { getConfig } = setupIntegrationTest();

  const createRepo = () => {
    const appConfig = getConfig();
    return createTasksRepo({ appConfig });
  };

  const createTask = (overrides: Partial<TaskRecord> = {}): TaskRecord => {
    return newTaskRecord('test:task', 'test:task', {
      payload: { test: 'data' },
      status: 'pending',
      priority: 'normal',
      ...overrides,
    });
  };

  /** Extract data portion for repo.create() - excludes id, createdAt, updatedAt */
  const toCreateData = (task: TaskRecord) => {
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...data
    } = task;
    return data;
  };

  describe('create()', () => {
    it('should persist task to database', async () => {
      const repo = createRepo();
      const task = createTask();

      const result = await repo.create(task.id, toCreateData(task));

      expect(result.isOk()).toBe(true);
      const created = result._unsafeUnwrap();
      expect(created.id).toBe(task.id);
      expect(created.taskName).toBe('test:task');
      expect(created.status).toBe('pending');
    });

    it('should store payload correctly', async () => {
      const repo = createRepo();
      const task = createTask({
        payload: {
          email: 'test@example.com',
          count: 42,
          nested: { key: 'value' },
        },
      });

      const result = await repo.create(task.id, toCreateData(task));

      expect(result.isOk()).toBe(true);
      const created = result._unsafeUnwrap();
      expect(created.payload).toEqual({
        email: 'test@example.com',
        count: 42,
        nested: { key: 'value' },
      });
    });

    it('should set createdAt and updatedAt timestamps', async () => {
      const repo = createRepo();
      const task = createTask();
      // Use a timestamp slightly in the past to avoid race conditions
      // where the DB timestamp could be a few ms before our Date.now()
      const beforeCreate = new Date(Date.now() - 100);

      const result = await repo.create(task.id, toCreateData(task));

      expect(result.isOk()).toBe(true);
      const created = result._unsafeUnwrap();
      expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      // updatedAt is set to defaultNow() by the database schema
      expect(created.updatedAt).toBeDefined();
      expect(created.updatedAt?.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
    });
  });

  describe('get()', () => {
    it('should retrieve task by ID', async () => {
      const repo = createRepo();
      const task = createTask();

      await repo.create(task.id, toCreateData(task));
      const result = await repo.get(task.id);

      expect(result.isOk()).toBe(true);
      const retrieved = result._unsafeUnwrap();
      expect(retrieved.id).toBe(task.id);
      expect(retrieved.taskName).toBe(task.taskName);
    });

    it('should return not found error for non-existent task', async () => {
      const repo = createRepo();
      const nonExistentId = TaskIdConstructor('non-existent-task');

      const result = await repo.get(nonExistentId);

      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr().name).toBe('NotFoundError');
    });
  });

  describe('getByStatus()', () => {
    it('should filter tasks by status', async () => {
      const repo = createRepo();

      // Create tasks with different statuses
      const pendingTask = createTask({ status: 'pending' });
      const activeTask = createTask({ status: 'active' });
      const completedTask = createTask({ status: 'completed' });

      await repo.create(pendingTask.id, toCreateData(pendingTask));
      await repo.create(activeTask.id, toCreateData(activeTask));
      await repo.create(completedTask.id, toCreateData(completedTask));

      const result = await repo.getByStatus('pending');

      expect(result.isOk()).toBe(true);
      const tasks = result._unsafeUnwrap();
      expect(tasks.length).toBe(1);
      expect(tasks[0].id).toBe(pendingTask.id);
    });

    it('should return empty array when no tasks match status', async () => {
      const repo = createRepo();
      const task = createTask({ status: 'pending' });
      await repo.create(task.id, toCreateData(task));

      const result = await repo.getByStatus('failed');

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(0);
    });

    it('should respect limit parameter', async () => {
      const repo = createRepo();

      // Create multiple pending tasks
      for (let i = 0; i < 5; i++) {
        const task = createTask({ status: 'pending' });
        await repo.create(task.id, toCreateData(task));
      }

      const result = await repo.getByStatus('pending', 2);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(2);
    });
  });

  describe('listTasks()', () => {
    it('should return all tasks with no filters', async () => {
      const repo = createRepo();

      const task1 = createTask();
      const task2 = createTask();
      await repo.create(task1.id, toCreateData(task1));
      await repo.create(task2.id, toCreateData(task2));

      const result = await repo.listTasks();

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap().length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      const repo = createRepo();

      const pendingTask = createTask({ status: 'pending' });
      const completedTask = createTask({ status: 'completed' });
      await repo.create(pendingTask.id, toCreateData(pendingTask));
      await repo.create(completedTask.id, toCreateData(completedTask));

      const result = await repo.listTasks({ status: 'completed' });

      expect(result.isOk()).toBe(true);
      const tasks = result._unsafeUnwrap();
      expect(tasks.every((t) => t.status === 'completed')).toBe(true);
    });

    it('should filter by taskName', async () => {
      const repo = createRepo();

      const emailTask = newTaskRecord('emails:send', 'emails:send', {
        status: 'pending',
      });
      const orderTask = newTaskRecord('orders:process', 'orders:process', {
        status: 'pending',
      });
      await repo.create(emailTask.id, toCreateData(emailTask));
      await repo.create(orderTask.id, toCreateData(orderTask));

      const result = await repo.listTasks({ taskName: 'emails:send' });

      expect(result.isOk()).toBe(true);
      const tasks = result._unsafeUnwrap();
      expect(tasks.every((t) => t.taskName === 'emails:send')).toBe(true);
    });

    it('should filter by userId', async () => {
      const repo = createRepo();

      const user1Task = createTask({ userId: 'user-1' });
      const user2Task = createTask({ userId: 'user-2' });
      await repo.create(user1Task.id, toCreateData(user1Task));
      await repo.create(user2Task.id, toCreateData(user2Task));

      const result = await repo.listTasks({ userId: UserId('user-1') });

      expect(result.isOk()).toBe(true);
      const tasks = result._unsafeUnwrap();
      expect(tasks.every((t) => t.userId === 'user-1')).toBe(true);
    });

    it('should apply limit', async () => {
      const repo = createRepo();

      for (let i = 0; i < 10; i++) {
        const task = createTask();
        await repo.create(task.id, toCreateData(task));
      }

      const result = await repo.listTasks({ limit: 5 });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(5);
    });

    it('should apply offset', async () => {
      const repo = createRepo();

      // Create tasks and track their IDs
      const taskIds: TaskId[] = [];
      for (let i = 0; i < 5; i++) {
        const task = createTask();
        await repo.create(task.id, toCreateData(task));
        taskIds.push(task.id);
      }

      const allResult = await repo.listTasks({ limit: 10 });
      const offsetResult = await repo.listTasks({ limit: 10, offset: 2 });

      expect(allResult.isOk()).toBe(true);
      expect(offsetResult.isOk()).toBe(true);

      const allTasks = allResult._unsafeUnwrap();
      const offsetTasks = offsetResult._unsafeUnwrap();

      // Offset should skip first 2 tasks
      expect(offsetTasks.length).toBe(allTasks.length - 2);
    });
  });

  describe('update()', () => {
    it('should modify task fields', async () => {
      const repo = createRepo();
      const task = createTask({ status: 'pending' });
      await repo.create(task.id, toCreateData(task));

      const result = await repo.update(task.id, {
        status: 'active',
        startedAt: new Date(),
      });

      expect(result.isOk()).toBe(true);
      const updated = result._unsafeUnwrap();
      expect(updated.status).toBe('active');
      expect(updated.startedAt).toBeDefined();
    });

    it('should update updatedAt timestamp', async () => {
      const repo = createRepo();
      const task = createTask();
      await repo.create(task.id, toCreateData(task));

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      const beforeUpdate = new Date();
      const result = await repo.update(task.id, { status: 'active' });

      expect(result.isOk()).toBe(true);
      const updated = result._unsafeUnwrap();
      expect(updated.updatedAt?.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
    });

    it('should preserve unchanged fields', async () => {
      const repo = createRepo();
      const task = createTask({
        status: 'pending',
        priority: 'high',
        payload: { original: 'data' },
      });
      await repo.create(task.id, toCreateData(task));

      const result = await repo.update(task.id, { status: 'active' });

      expect(result.isOk()).toBe(true);
      const updated = result._unsafeUnwrap();
      expect(updated.priority).toBe('high');
      expect(updated.payload).toEqual({ original: 'data' });
    });
  });

  describe('bulkUpdate()', () => {
    it('should update multiple tasks efficiently', async () => {
      const repo = createRepo();

      const task1 = createTask({ status: 'pending' });
      const task2 = createTask({ status: 'pending' });
      const task3 = createTask({ status: 'pending' });

      await repo.create(task1.id, toCreateData(task1));
      await repo.create(task2.id, toCreateData(task2));
      await repo.create(task3.id, toCreateData(task3));

      const result = await repo.bulkUpdate([
        { id: task1.id, data: { status: 'completed' } },
        { id: task2.id, data: { status: 'failed' } },
        { id: task3.id, data: { status: 'active' } },
      ]);

      expect(result.isOk()).toBe(true);

      // Verify updates applied
      const get1 = await repo.get(task1.id);
      const get2 = await repo.get(task2.id);
      const get3 = await repo.get(task3.id);

      expect(get1._unsafeUnwrap().status).toBe('completed');
      expect(get2._unsafeUnwrap().status).toBe('failed');
      expect(get3._unsafeUnwrap().status).toBe('active');
    });

    it('should return count of updated rows', async () => {
      const repo = createRepo();

      const task1 = createTask();
      const task2 = createTask();
      await repo.create(task1.id, toCreateData(task1));
      await repo.create(task2.id, toCreateData(task2));

      const result = await repo.bulkUpdate([
        { id: task1.id, data: { status: 'completed' } },
        { id: task2.id, data: { status: 'completed' } },
      ]);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toBe(2);
    });
  });

  describe('delete()', () => {
    it('should remove task from database', async () => {
      const repo = createRepo();
      const task = createTask();
      await repo.create(task.id, toCreateData(task));

      const deleteResult = await repo.delete(task.id);
      expect(deleteResult.isOk()).toBe(true);

      const getResult = await repo.get(task.id);
      expect(getResult.isErr()).toBe(true);
      expect(getResult._unsafeUnwrapErr().name).toBe('NotFoundError');
    });

    it('should return the deleted task', async () => {
      const repo = createRepo();
      const task = createTask({
        taskName: 'to-delete',
        payload: { important: 'data' },
      });
      await repo.create(task.id, toCreateData(task));

      const result = await repo.delete(task.id);

      expect(result.isOk()).toBe(true);
      const deleted = result._unsafeUnwrap();
      expect(deleted.taskName).toBe('to-delete');
      expect(deleted.payload).toEqual({ important: 'data' });
    });
  });

  describe('data integrity', () => {
    it('should store and retrieve all task fields correctly', async () => {
      const repo = createRepo();
      const now = new Date();

      const task = createTask({
        taskName: 'full:test',
        queueName: 'full:test',
        payload: { complex: { nested: 'data' }, array: [1, 2, 3] },
        status: 'failed',
        priority: 'critical',
        attempts: 3,
        maxAttempts: 5,
        enqueuedAt: now,
        startedAt: now,
        failedAt: now,
        error: { success: false, reason: 'Test error', lastAttemptAt: now },
        userId: 'user-123',
        externalId: 'external-456',
        delayUntil: now,
      });

      await repo.create(task.id, toCreateData(task));
      const result = await repo.get(task.id);

      expect(result.isOk()).toBe(true);
      const retrieved = result._unsafeUnwrap();

      expect(retrieved.taskName).toBe('full:test');
      expect(retrieved.queueName).toBe('full:test');
      expect(retrieved.payload).toEqual({
        complex: { nested: 'data' },
        array: [1, 2, 3],
      });
      expect(retrieved.status).toBe('failed');
      expect(retrieved.priority).toBe('critical');
      expect(retrieved.attempts).toBe(3);
      expect(retrieved.maxAttempts).toBe(5);
      expect(retrieved.userId).toBe('user-123');
      expect(retrieved.externalId).toBe('external-456');
      expect(retrieved.error?.reason).toBe('Test error');
    });
  });
});
