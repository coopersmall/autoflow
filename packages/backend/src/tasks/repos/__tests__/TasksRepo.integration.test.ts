/**
 * TasksRepo Integration Tests
 *
 * Tests complete task repository operations with real database:
 * - JSON payload preservation (property tests)
 * - Status transitions (property tests)
 * - Priority handling (property tests)
 * - Bulk updates (property tests)
 * - Pagination and filtering
 * - Timestamps
 *
 * Uses property-based testing for data preservation invariants, with specific
 * unit tests only for functionality that doesn't fit the property model.
 */

import { describe, expect, it } from 'bun:test';
import { createMockContext } from '@backend/infrastructure/context/__mocks__/Context.mock';
import type { TaskId } from '@backend/tasks/domain/TaskId';
import { TaskId as TaskIdConstructor } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import { newTaskRecord } from '@backend/tasks/domain/TaskRecord';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import { setupIntegrationTest } from '@backend/testing/integration/integrationTest';
import { UserId } from '@core/domain/user/user';
import { isAppError } from '@core/errors';
import * as fc from 'fast-check';

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

  describe('Property Tests', () => {
    // Arbitraries for property-based testing
    // Generate valid JSON objects (not primitives, null, or arrays)
    const jsonPayloadArb = fc.dictionary(
      fc.string(),
      fc.oneof(
        fc.string(),
        fc.integer(),
        fc.boolean(),
        fc.constant(null),
        fc.array(fc.string()),
      ),
    );
    const statusArb = fc.constantFrom(
      'pending',
      'active',
      'completed',
      'failed',
      'cancelled',
      'delayed',
    );
    const priorityArb = fc.constantFrom('low', 'normal', 'high', 'critical');

    it('should preserve any JSON payload through create/get round-trip', async () => {
      const repo = createRepo();

      await fc.assert(
        fc.asyncProperty(jsonPayloadArb, async (payload) => {
          const task = createTask({ payload });

          const createResult = await repo.create(
            createMockContext(),
            task.id,
            toCreateData(task),
          );

          expect(createResult.isOk()).toBe(true);
          const created = createResult._unsafeUnwrap();

          const getResult = await repo.get(createMockContext(), created.id);
          expect(getResult.isOk()).toBe(true);

          const retrieved = getResult._unsafeUnwrap();
          expect(retrieved.payload).toEqual(payload);
        }),
        { numRuns: 50 },
      );
    });

    it('should accept any valid status on update', async () => {
      const repo = createRepo();

      await fc.assert(
        fc.asyncProperty(statusArb, async (newStatus) => {
          const task = createTask({ status: 'pending' });

          await repo.create(createMockContext(), task.id, toCreateData(task));

          const updateResult = await repo.update(createMockContext(), task.id, {
            status: newStatus,
          });

          expect(updateResult.isOk()).toBe(true);
          const updated = updateResult._unsafeUnwrap();
          expect(updated.status).toBe(newStatus);
        }),
        { numRuns: 20 },
      );
    });

    it('should preserve task priority through operations', async () => {
      const repo = createRepo();

      await fc.assert(
        fc.asyncProperty(priorityArb, async (priority) => {
          const task = createTask({ priority });

          const createResult = await repo.create(
            createMockContext(),
            task.id,
            toCreateData(task),
          );

          expect(createResult.isOk()).toBe(true);

          const getResult = await repo.get(createMockContext(), task.id);
          expect(getResult.isOk()).toBe(true);

          const retrieved = getResult._unsafeUnwrap();
          expect(retrieved.priority).toBe(priority);
        }),
        { numRuns: 20 },
      );
    });

    it('should apply all bulk updates consistently', async () => {
      const repo = createRepo();

      const updatesArb = fc
        .array(
          fc.record({
            status: statusArb,
          }),
          { minLength: 1, maxLength: 10 },
        )
        .chain((statuses) =>
          fc.constant(
            statuses.map((status, index) => ({
              task: createTask({ status: 'pending' }),
              newData: status,
              index,
            })),
          ),
        );

      await fc.assert(
        fc.asyncProperty(updatesArb, async (updates) => {
          // Create all tasks
          for (const { task } of updates) {
            await repo.create(createMockContext(), task.id, toCreateData(task));
          }

          // Bulk update with new statuses
          const bulkUpdates = updates.map(({ task, newData }) => ({
            id: task.id,
            data: newData,
          }));

          const bulkResult = await repo.bulkUpdate(bulkUpdates);
          expect(bulkResult.isOk()).toBe(true);

          // Verify all updates were applied
          for (const { task, newData } of updates) {
            const getResult = await repo.get(createMockContext(), task.id);
            expect(getResult.isOk()).toBe(true);
            const retrieved = getResult._unsafeUnwrap();
            expect(retrieved.status).toBe(newData.status);
          }
        }),
        { numRuns: 20 },
      );
    });
  });

  describe('CRUD operations', () => {
    it('should persist task to database', async () => {
      const repo = createRepo();
      const task = createTask();

      const result = await repo.create(
        createMockContext(),
        task.id,
        toCreateData(task),
      );

      expect(result.isOk()).toBe(true);
      const created = result._unsafeUnwrap();
      expect(created.id).toBe(task.id);
      expect(created.taskName).toBe('test:task');
      expect(created.status).toBe('pending');
    });

    it('should retrieve task by ID', async () => {
      const repo = createRepo();
      const task = createTask();

      await repo.create(createMockContext(), task.id, toCreateData(task));
      const result = await repo.get(createMockContext(), task.id);

      expect(result.isOk()).toBe(true);
      const retrieved = result._unsafeUnwrap();
      expect(retrieved.id).toBe(task.id);
      expect(retrieved.taskName).toBe(task.taskName);
    });

    it('should modify task fields on update', async () => {
      const repo = createRepo();
      const task = createTask({ status: 'pending' });
      await repo.create(createMockContext(), task.id, toCreateData(task));

      const result = await repo.update(createMockContext(), task.id, {
        status: 'active',
        startedAt: new Date(),
      });

      expect(result.isOk()).toBe(true);
      const updated = result._unsafeUnwrap();
      expect(updated.status).toBe('active');
      expect(updated.startedAt).toBeDefined();
    });

    it('should remove task from database', async () => {
      const repo = createRepo();
      const task = createTask();
      await repo.create(createMockContext(), task.id, toCreateData(task));

      const deleteResult = await repo.delete(createMockContext(), task.id);
      expect(deleteResult.isOk()).toBe(true);

      const getResult = await repo.get(createMockContext(), task.id);
      expect(getResult.isErr()).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should return not found error for non-existent task', async () => {
      const repo = createRepo();
      const nonExistentId = TaskIdConstructor('non-existent-task');

      const result = await repo.get(createMockContext(), nonExistentId);

      expect(result.isErr()).toBe(true);
      const error = result._unsafeUnwrapErr();
      expect(isAppError(error)).toBe(true);
    });
  });

  describe('timestamps', () => {
    it('should set createdAt and updatedAt timestamps on create', async () => {
      const repo = createRepo();
      const task = createTask();
      const beforeCreate = new Date(Date.now() - 100);

      const result = await repo.create(
        createMockContext(),
        task.id,
        toCreateData(task),
      );

      expect(result.isOk()).toBe(true);
      const created = result._unsafeUnwrap();
      expect(created.createdAt.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
      expect(created.updatedAt).toBeDefined();
      expect(created.updatedAt?.getTime()).toBeGreaterThanOrEqual(
        beforeCreate.getTime(),
      );
    });

    it('should update updatedAt timestamp on update', async () => {
      const repo = createRepo();
      const task = createTask();
      await repo.create(createMockContext(), task.id, toCreateData(task));

      await new Promise((resolve) => setTimeout(resolve, 10));

      const beforeUpdate = new Date();
      const result = await repo.update(createMockContext(), task.id, {
        status: 'active',
      });

      expect(result.isOk()).toBe(true);
      const updated = result._unsafeUnwrap();
      expect(updated.updatedAt?.getTime()).toBeGreaterThanOrEqual(
        beforeUpdate.getTime(),
      );
    });
  });

  describe('filtering and pagination', () => {
    it('should filter tasks by status', async () => {
      const repo = createRepo();

      const pendingTask = createTask({ status: 'pending' });
      const activeTask = createTask({ status: 'active' });
      const completedTask = createTask({ status: 'completed' });

      await repo.create(
        createMockContext(),
        pendingTask.id,
        toCreateData(pendingTask),
      );
      await repo.create(
        createMockContext(),
        activeTask.id,
        toCreateData(activeTask),
      );
      await repo.create(
        createMockContext(),
        completedTask.id,
        toCreateData(completedTask),
      );

      const result = await repo.getByStatus('pending');

      expect(result.isOk()).toBe(true);
      const tasks = result._unsafeUnwrap();
      expect(tasks.length).toBe(1);
      expect(tasks[0].id).toBe(pendingTask.id);
    });

    it('should filter by taskName', async () => {
      const repo = createRepo();

      const emailTask = newTaskRecord('emails:send', 'emails:send', {
        status: 'pending',
      });
      const orderTask = newTaskRecord('orders:process', 'orders:process', {
        status: 'pending',
      });
      await repo.create(
        createMockContext(),
        emailTask.id,
        toCreateData(emailTask),
      );
      await repo.create(
        createMockContext(),
        orderTask.id,
        toCreateData(orderTask),
      );

      const result = await repo.listTasks({ taskName: 'emails:send' });

      expect(result.isOk()).toBe(true);
      const tasks = result._unsafeUnwrap();
      expect(tasks.every((t) => t.taskName === 'emails:send')).toBe(true);
    });

    it('should filter by userId', async () => {
      const repo = createRepo();

      const user1Task = createTask({ userId: 'user-1' });
      const user2Task = createTask({ userId: 'user-2' });
      await repo.create(
        createMockContext(),
        user1Task.id,
        toCreateData(user1Task),
      );
      await repo.create(
        createMockContext(),
        user2Task.id,
        toCreateData(user2Task),
      );

      const result = await repo.listTasks({ userId: UserId('user-1') });

      expect(result.isOk()).toBe(true);
      const tasks = result._unsafeUnwrap();
      expect(tasks.every((t) => t.userId === 'user-1')).toBe(true);
    });

    it('should respect limit parameter', async () => {
      const repo = createRepo();

      for (let i = 0; i < 5; i++) {
        const task = createTask({ status: 'pending' });
        await repo.create(createMockContext(), task.id, toCreateData(task));
      }

      const result = await repo.getByStatus('pending', 2);

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(2);
    });

    it('should apply limit to listTasks', async () => {
      const repo = createRepo();

      for (let i = 0; i < 10; i++) {
        const task = createTask();
        await repo.create(createMockContext(), task.id, toCreateData(task));
      }

      const result = await repo.listTasks({ limit: 5 });

      expect(result.isOk()).toBe(true);
      expect(result._unsafeUnwrap()).toHaveLength(5);
    });

    it('should apply offset to listTasks', async () => {
      const repo = createRepo();

      const taskIds: TaskId[] = [];
      for (let i = 0; i < 5; i++) {
        const task = createTask();
        await repo.create(createMockContext(), task.id, toCreateData(task));
        taskIds.push(task.id);
      }

      const allResult = await repo.listTasks({ limit: 10 });
      const offsetResult = await repo.listTasks({ limit: 10, offset: 2 });

      expect(allResult.isOk()).toBe(true);
      expect(offsetResult.isOk()).toBe(true);

      const allTasks = allResult._unsafeUnwrap();
      const offsetTasks = offsetResult._unsafeUnwrap();

      expect(offsetTasks.length).toBe(allTasks.length - 2);
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

      await repo.create(createMockContext(), task.id, toCreateData(task));
      const result = await repo.get(createMockContext(), task.id);

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

    it('should preserve unchanged fields after update', async () => {
      const repo = createRepo();
      const task = createTask({
        status: 'pending',
        priority: 'high',
        payload: { original: 'data' },
      });
      await repo.create(createMockContext(), task.id, toCreateData(task));

      const result = await repo.update(createMockContext(), task.id, {
        status: 'active',
      });

      expect(result.isOk()).toBe(true);
      const updated = result._unsafeUnwrap();
      expect(updated.priority).toBe('high');
      expect(updated.payload).toEqual({ original: 'data' });
    });
  });
});
