import { beforeAll, describe, expect, it } from 'bun:test';
import { TaskId } from '@backend/tasks/domain/TaskId';
import type { TaskRecord } from '@backend/tasks/domain/TaskRecord';
import { newTaskRecord } from '@backend/tasks/domain/TaskRecord';
import { createTasksHttpHandler } from '@backend/tasks/handlers/http/TasksHttpHandler';
import { createTasksRepo } from '@backend/tasks/repos/TasksRepo';
import { setupHttpIntegrationTest } from '@backend/testing/integration/httpIntegrationTest';

// Response types for JSON parsing
interface ListTasksResponse {
  tasks: TaskRecord[];
  count: number;
  limit?: number;
  offset?: number;
}

interface GetTaskResponse {
  task: TaskRecord;
}

interface QueueStatsResponse {
  stats: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
}

describe('TasksHttpHandler Integration Tests', () => {
  const { getHttpServer, getHttpClient, getTestAuth, getConfig, getLogger } =
    setupHttpIntegrationTest();

  // Helper to create a task directly in the database for testing
  // Note: BullMQ doesn't allow colons in queue names, so we use 'test-task' instead of 'test:task'
  const createTestTask = async (
    overrides: Parameters<typeof newTaskRecord>[2] = {},
  ) => {
    const appConfig = getConfig();
    const repo = createTasksRepo({ appConfig });
    const task = newTaskRecord('test-task', 'test-task', {
      payload: { test: 'data' },
      status: 'pending',
      priority: 'normal',
      ...overrides,
    });
    const {
      id: _id,
      createdAt: _createdAt,
      updatedAt: _updatedAt,
      ...data
    } = task;
    const result = await repo.create(task.id, data);
    return result._unsafeUnwrap();
  };

  beforeAll(async () => {
    const config = getConfig();
    const logger = getLogger();

    const handlers = [
      createTasksHttpHandler({
        logger,
        appConfig: config,
      }),
    ];

    await getHttpServer().start(handlers);
  });

  describe('GET /api/tasks', () => {
    it('should return tasks with admin token (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      // Create some test tasks
      await createTestTask({ status: 'pending' });
      await createTestTask({ status: 'completed' });

      const response = await client.get('/api/tasks', { headers });

      expect(response.status).toBe(200);

      const data: ListTasksResponse = await response.json();
      expect(data.tasks).toBeDefined();
      expect(Array.isArray(data.tasks)).toBe(true);
      expect(data.tasks.length).toBeGreaterThanOrEqual(2);
      expect(data.count).toBeGreaterThanOrEqual(2);
    });

    it('should filter by status', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      // Create tasks with different statuses
      await createTestTask({ status: 'pending' });
      await createTestTask({ status: 'failed' });

      const response = await client.get('/api/tasks?status=failed', {
        headers,
      });

      expect(response.status).toBe(200);

      const data: ListTasksResponse = await response.json();
      expect(data.tasks.every((t) => t.status === 'failed')).toBe(true);
    });

    it('should filter by taskName', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      // Create tasks with different names
      const task = newTaskRecord('unique:task:name', 'unique:task:name', {
        status: 'pending',
      });
      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...data
      } = task;
      const repo = createTasksRepo({ appConfig: getConfig() });
      await repo.create(task.id, data);

      const response = await client.get(
        '/api/tasks?taskName=unique:task:name',
        {
          headers,
        },
      );

      expect(response.status).toBe(200);

      const responseData: ListTasksResponse = await response.json();
      expect(responseData.tasks.length).toBeGreaterThanOrEqual(1);
      expect(
        responseData.tasks.every((t) => t.taskName === 'unique:task:name'),
      ).toBe(true);
    });

    it('should apply limit and offset', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      // Create multiple tasks
      for (let i = 0; i < 5; i++) {
        await createTestTask();
      }

      const response = await client.get('/api/tasks?limit=2&offset=1', {
        headers,
      });

      expect(response.status).toBe(200);

      const data: ListTasksResponse = await response.json();
      expect(data.tasks.length).toBe(2);
      expect(data.limit).toBe(2);
      expect(data.offset).toBe(1);
    });

    it('should return 401 when no auth header provided', async () => {
      const client = getHttpClient();

      const response = await client.get('/api/tasks');

      expect(response.status).toBe(401);
    });

    it('should return 403 when token has no admin permissions', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const token = await auth.createUnauthorizedToken();
      const headers = auth.createBearerHeaders(token);

      const response = await client.get('/api/tasks', { headers });

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should retrieve task by id with admin token (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const createdTask = await createTestTask();

      const response = await client.get(`/api/tasks/${createdTask.id}`, {
        headers,
      });

      expect(response.status).toBe(200);

      const data: GetTaskResponse = await response.json();
      expect(data.task).toBeDefined();
      expect(data.task.id).toBe(createdTask.id);
      expect(data.task.taskName).toBe('test-task');
    });

    it('should return 404 when task not found', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const nonExistentId = TaskId();
      const response = await client.get(`/api/tasks/${nonExistentId}`, {
        headers,
      });

      expect(response.status).toBe(404);
    });

    it('should return 401 when no auth header provided', async () => {
      const client = getHttpClient();

      const response = await client.get('/api/tasks/some-id');

      expect(response.status).toBe(401);
    });

    it('should return 403 when token has no admin permissions', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const token = await auth.createUnauthorizedToken();
      const headers = auth.createBearerHeaders(token);

      const response = await client.get('/api/tasks/some-id', { headers });

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/tasks/:id/cancel', () => {
    it('should cancel pending task (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const task = await createTestTask({ status: 'pending' });

      const response = await client.post(
        `/api/tasks/${task.id}/cancel`,
        {},
        { headers },
      );

      expect(response.status).toBe(200);

      const data: GetTaskResponse = await response.json();
      expect(data.task).toBeDefined();
      expect(data.task.status).toBe('cancelled');
    });

    it('should cancel delayed task (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const task = await createTestTask({
        status: 'delayed',
        delayUntil: new Date(Date.now() + 60000),
      });

      const response = await client.post(
        `/api/tasks/${task.id}/cancel`,
        {},
        { headers },
      );

      expect(response.status).toBe(200);

      const data: GetTaskResponse = await response.json();
      expect(data.task.status).toBe('cancelled');
    });

    it('should return error for active task (400)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const task = await createTestTask({ status: 'active' });

      const response = await client.post(
        `/api/tasks/${task.id}/cancel`,
        {},
        { headers },
      );

      expect(response.status).toBe(400);
    });

    it('should return error for completed task (400)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const task = await createTestTask({ status: 'completed' });

      const response = await client.post(
        `/api/tasks/${task.id}/cancel`,
        {},
        { headers },
      );

      expect(response.status).toBe(400);
    });

    it('should return 404 when task not found', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const nonExistentId = TaskId();
      const response = await client.post(
        `/api/tasks/${nonExistentId}/cancel`,
        {},
        { headers },
      );

      expect(response.status).toBe(404);
    });

    it('should return 401 when no auth header provided', async () => {
      const client = getHttpClient();

      const response = await client.post('/api/tasks/some-id/cancel', {});

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/tasks/:id/retry', () => {
    it('should retry failed task (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const task = await createTestTask({
        status: 'failed',
        attempts: 3,
        error: {
          success: false,
          reason: 'Test failure',
          lastAttemptAt: new Date(),
        },
        failedAt: new Date(),
      });

      const response = await client.post(
        `/api/tasks/${task.id}/retry`,
        {},
        { headers },
      );

      expect(response.status).toBe(200);

      const data: GetTaskResponse = await response.json();
      expect(data.task).toBeDefined();
      expect(data.task.status).toBe('pending');
      expect(data.task.attempts).toBe(0);
      expect(data.task.error).toBeNull();
    });

    it('should return error for pending task (400)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const task = await createTestTask({ status: 'pending' });

      const response = await client.post(
        `/api/tasks/${task.id}/retry`,
        {},
        { headers },
      );

      expect(response.status).toBe(400);
    });

    it('should return error for active task (400)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const task = await createTestTask({ status: 'active' });

      const response = await client.post(
        `/api/tasks/${task.id}/retry`,
        {},
        { headers },
      );

      expect(response.status).toBe(400);
    });

    it('should return 404 when task not found', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const nonExistentId = TaskId();
      const response = await client.post(
        `/api/tasks/${nonExistentId}/retry`,
        {},
        { headers },
      );

      expect(response.status).toBe(404);
    });

    it('should return 401 when no auth header provided', async () => {
      const client = getHttpClient();

      const response = await client.post('/api/tasks/some-id/retry', {});

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/tasks/stats/queue/:queueName', () => {
    it('should return queue stats with admin token (200)', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const headers = await auth.createAdminHeaders();

      const response = await client.get('/api/tasks/stats/queue/test-queue', {
        headers,
      });

      expect(response.status).toBe(200);

      const data: QueueStatsResponse = await response.json();
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.waiting).toBe('number');
      expect(typeof data.stats.active).toBe('number');
      expect(typeof data.stats.completed).toBe('number');
      expect(typeof data.stats.failed).toBe('number');
      expect(typeof data.stats.delayed).toBe('number');
    });

    it('should return 401 when no auth header provided', async () => {
      const client = getHttpClient();

      const response = await client.get('/api/tasks/stats/queue/test-queue');

      expect(response.status).toBe(401);
    });

    it('should return 403 when token has no admin permissions', async () => {
      const client = getHttpClient();
      const auth = getTestAuth();
      const token = await auth.createUnauthorizedToken();
      const headers = auth.createBearerHeaders(token);

      const response = await client.get('/api/tasks/stats/queue/test-queue', {
        headers,
      });

      expect(response.status).toBe(403);
    });
  });
});
