# Background Tasks Architecture

**Version:** 5.0.0  
**Last Updated:** 2025-11-27  
**Status:** Production Ready

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture Principles](#architecture-principles)
- [Core Concepts](#core-concepts)
- [Service Layer Architecture](#service-layer-architecture)
- [Audit Trail Architecture](#audit-trail-architecture)
- [Directory Structure](#directory-structure)
- [Domain Objects](#domain-objects)
- [Database Schema](#database-schema)
- [Architecture Patterns](#architecture-patterns)
- [Implementation Phases](#implementation-phases)
- [Usage Examples](#usage-examples)
- [Deployment Guide](#deployment-guide)
- [Testing Strategy](#testing-strategy)
- [Operational Considerations](#operational-considerations)

---

## Overview

This document describes the comprehensive architecture for implementing **asynchronous background tasks** in the Autoflow project using **BullMQ** as the queue technology and **PostgreSQL** for permanent audit trails.

### Key Design Goals

1. **Locality of Behavior** - Task logic lives with the service that owns it
2. **Independent Deployment** - Workers can be deployed separately from the web application
3. **Scalability** - Workers can be scaled independently per queue
4. **Type Safety** - Full TypeScript support with Zod validation
5. **Testability** - Comprehensive unit and integration testing
6. **Consistency** - Follows established codebase patterns (Drizzle, Zod, JSONB, Result types)
7. **Complete Audit Trail** - All task executions recorded in PostgreSQL
8. **Admin Operations** - Centralized retry/cancel operations for any task

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Web Application (src/app/backend/server/)              │
│  - HTTP server                                           │
│  - Services enqueue tasks via Schedulers                │
│  - Never imports Workers                                 │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├─→ 1. Create TaskRecord (PostgreSQL)
                 │
                 └─→ 2. Enqueue to BullMQ (Redis)
                 ↓
┌─────────────────────────────────────────────────────────┐
│  Redis (BullMQ Backend)                                  │
│  - Ephemeral task queues (7-day retention)             │
│  - Job state management                                  │
│  - Retry logic and scheduling                           │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│  Worker Application (src/app/workers/)                   │
│  - Standalone process                                    │
│  - Processes tasks via Workers                          │
│  - Updates TaskRecord on state changes                  │
│  - Can be deployed independently                        │
│  - Can be scaled horizontally                           │
└────────────────┬────────────────────────────────────────┘
                 │
                 └─→ Update TaskRecord (PostgreSQL)
                 ↓
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL (Permanent Audit Trail)                      │
│  - Complete task lifecycle records                      │
│  - Success and failure tracking                         │
│  - Queryable history for analytics                      │
│  - Survives Redis restarts                             │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture Principles

### 1. Separation of Web and Worker Applications

**Web Application:**

- Imports only `Schedulers` (task producers)
- Enqueues tasks to queues
- Creates audit records in PostgreSQL
- Remains lightweight and stateless
- Does not process background tasks

**Worker Application:**

- Imports only `Workers` (task consumers)
- Processes tasks from queues
- Updates audit records on state changes
- Separate entry point: `src/app/workers/index.ts`
- Deployed independently (Docker, Kubernetes, etc.)

### 2. Locality of Behavior

Task logic lives within the service that owns it:

```
src/lib/services/users/
├── UsersService.ts
├── repos/
├── cache/
├── handlers/
│   └── http/
│       └── UsersHttpHandler.ts        ← User CRUD (NO task endpoints)
└── tasks/                             ← Task logic here
    ├── UsersTaskScheduler.ts          ← Web app uses this
    ├── UsersTaskWorker.ts             ← Worker app uses this
    └── domain/
        └── UsersTaskPayloads.ts       ← Shared types
```

**Important:** Tasks are internal implementation details. No HTTP handlers in `tasks/` directory.

### 3. Dual Storage Strategy

**Redis (BullMQ) - Ephemeral:**

- Fast job queue processing
- Retry logic and scheduling
- Worker coordination
- 7-day retention (configurable)

**PostgreSQL - Permanent:**

- Complete task lifecycle audit trail
- All statuses: pending, active, completed, failed
- Queryable for analytics and debugging
- Permanent retention (with cleanup policies)

### 4. Unified Service Architecture

```
TasksService (Unified Service)
  ↓
TasksRepo → PostgreSQL (Audit Trail)
TaskQueue → BullMQ/Redis (Operations)

Purpose:
  - Query task history, analytics, statistics
  - Retry/cancel operations, admin actions
  - Unified interface for all task management
```

**Separation of Concerns:**

- `TasksService` = All task queries AND operations (retry/cancel)
- `TaskScheduler` (in scheduler/) = Task scheduling (creates tasks in DB + BullMQ)
- `TaskWorker` (in worker/) = Task execution (processes tasks, updates DB)

### 5. Admin-Only HTTP Access

**Design Decision:** Task audit logs are exposed ONLY to admins via HTTP API.

**Rationale:**

- Tasks are implementation details, not user-facing features
- Users care about outcomes ("Email sent"), not task status
- Polling for task status is awkward UX
- Most tasks complete quickly (< 5 seconds)

**Who Has Access:**

- ✅ Admins via `TasksHttpHandler` (requires `admin` or `read:tasks` permission)
- ✅ Operations team for monitoring
- ✅ Internal services via `TasksService`
- ❌ End users do NOT have task endpoints

**Exception:** Only create user-facing task endpoints if you have specific use cases like:

- Long-running exports (5+ minutes)
- User-initiated retries
- Job history UI

### 6. Shared Infrastructure

```
src/lib/tasks/                       ← Shared infrastructure
├── services/                        ← Service layer (TasksService)
├── scheduler/                       ← Task scheduling (TaskScheduler factory)
├── worker/                          ← Task processing (TaskWorker factory)
├── domain/                          ← Zod schemas & interfaces
├── repos/                           ← TasksRepo (audit trail)
├── queue/                           ← Queue clients (BullMQ)
└── handlers/                        ← HTTP handlers (admin only)

Tasks are defined using TaskDefinition pattern:
- Use defineTask() to create task definitions
- Use createTaskScheduler() to schedule tasks
- Use createTaskWorker() to process tasks
```

### 7. Drizzle + Zod Pattern

**Database Schema (Drizzle):**

- Table definition with indexes
- Uses JSONB `data` column for flexibility
- Standard columns: `id`, `user_id`, `data`, `created_at`, `updated_at`

**Domain Objects (Zod):**

- Branded types (TaskId, TaskRecordId)
- Versioned schemas (schemaVersion)
- Discriminated unions for type safety
- Validation functions

---

## Core Concepts

### Task (BullMQ) - Ephemeral

A **Task** represents a unit of work in the queue:

- Lives in Redis/BullMQ
- Has a unique ID (branded `TaskId`)
- Has a name (e.g., `users:send-welcome-email`)
- Contains a typed payload
- Managed by BullMQ (retries, delays, etc.)

### TaskRecord (PostgreSQL) - Permanent

A **TaskRecord** represents the audit trail:

- Lives in PostgreSQL `tasks` table
- Tracks complete lifecycle (pending → active → completed/failed)
- Stores results for successful tasks
- Stores errors for failed tasks
- Queryable for analytics and debugging

### Queue

A **Queue** is a named collection of tasks:

- Example: `users`, `integrations`, `reports`
- Tasks are added to queues by Schedulers
- Tasks are processed from queues by Workers
- Multiple workers can process from the same queue

### Scheduler

A **Scheduler** (Task Producer) enqueues tasks:

- Lives in service's `tasks/` folder
- Used by web application
- Creates TaskRecord in PostgreSQL
- Enqueues to BullMQ
- Exposes domain-specific methods
- Example: `UsersTaskScheduler.sendWelcomeEmail()`

### Worker

A **Worker** (Task Consumer) processes tasks:

- Lives in service's `tasks/` folder
- Used by worker application
- Updates TaskRecord on state changes
- Registers handlers for specific task names
- Has full access to service layer

### TasksService

A **Service** for managing all task operations:

- Extends `SharedService`
- Provides query methods (getByStatus, getByTaskName, getByUserId, listTasks)
- Provides operation methods (cancelTask, retryTask, getQueueStats)
- Has access to both TasksRepo (audit) and TaskQueue (BullMQ)
- Used by HTTP handlers and internal services
- Single unified interface for all task management

---

## Service Layer Architecture

### Unified Service Pattern

```
┌────────────────────────────────────────────────────────┐
│ TasksService (Unified Task Management)                 │
│                                                         │
│ Query Methods:                                         │
│ - getByStatus(status)                                  │
│ - getByTaskName(name)                                  │
│ - getByUserId(userId)                                  │
│ - listTasks(filters)                                   │
│ - get(taskId)                                          │
│                                                         │
│ Operation Methods:                                     │
│ - cancelTask(correlationId, taskId)                    │
│ - retryTask(correlationId, taskId)                     │
│ - getQueueStats(correlationId, queueName)              │
│                                                         │
│ Dependencies: TasksRepo, TaskQueue                     │
│ Access: TasksRepo → PostgreSQL (audit trail)           │
│         TaskQueue → BullMQ/Redis (operations)          │
│ Purpose: Complete task management interface            │
└────────────────────────────────────────────────────────┘
```

### Why Unified Service?

**Single Interface:**

- All task operations in one place
- Simpler API surface for consumers
- Easier to discover available operations

**Organized by Actions:**

- Query actions in `services/actions/queries/`
- Operation actions in `services/actions/operations/`
- Service delegates to action functions
- Actions are independently testable

**Clear Separation:**

- TasksService = Task management (queries + operations)
- TaskScheduler = Task creation (web app)
- TaskWorker = Task processing (worker app)

---

## Audit Trail Architecture

### Why Both Redis and PostgreSQL?

| Storage            | Purpose              | Retention | Use Case                             |
| ------------------ | -------------------- | --------- | ------------------------------------ |
| **Redis (BullMQ)** | Job queue processing | 7 days    | Fast processing, retries, scheduling |
| **PostgreSQL**     | Audit trail          | Permanent | Analytics, debugging, compliance     |

### Task Lifecycle Flow

```
1. User Action (e.g., create account)
   ↓
2. Service calls Scheduler
   ↓
3. Scheduler creates TaskRecord in PostgreSQL (status: 'pending')
   ↓
4. Scheduler enqueues to BullMQ/Redis
   ↓
5. Worker picks up task → UPDATE TaskRecord (status: 'active', startedAt)
   ↓
6a. Success → UPDATE TaskRecord (status: 'completed', completedAt, result)
   OR
6b. Retry → UPDATE TaskRecord (attempts++)
   ↓
7b. Final failure → UPDATE TaskRecord (status: 'failed', failedAt, error)
```

### Querying Task History

```typescript
// Create TasksService
import { createTasksService } from '@backend/tasks';

const tasksService = createTasksService({ logger, appConfig: () => config });

// Get all failed tasks
const recentFailures = await tasksService.getByStatus('failed');

// Get all tasks for a specific user
const userTasks = await tasksService.getByUserId(userId);

// Get all tasks of a specific type
const emailTasks = await tasksService.getByTaskName('users:send-welcome-email');

// List tasks with filters
const tasks = await tasksService.listTasks({
  status: 'pending',
  userId: UserId('user-123'),
  limit: 50,
  offset: 0,
});

// Get queue statistics
const stats = await tasksService.getQueueStats(
  correlationId,
  'users:send-welcome-email',
);
// Returns: { queueName, waiting, active, completed, failed, delayed }
```

### Retry/Cancel Operations

```typescript
// Create TasksService
import { createTasksService } from '@backend/tasks';

const tasksService = createTasksService({ logger, appConfig: () => config });

// Retry a failed task
await tasksService.retryTask(correlationId, taskId);

// Cancel a pending task
await tasksService.cancelTask(correlationId, taskId);
```

---

## Directory Structure

```
packages/backend/src/
├── infrastructure/
│   └── db/
│       └── schema.ts                            # Drizzle schema (tasks table)
│
└── tasks/                                       # ← Task feature module
    ├── README.md                                # This file
    ├── index.ts                                 # Public exports
    │
    ├── TasksService.ts                          # Unified task management
    ├── domain/
    │   └── TasksService.ts                      # Service interface
    ├── actions/                                 # Action functions
    │   ├── operations/
    │   │   ├── cancelTask.ts                    # Cancel operation
    │   │   ├── retryTask.ts                     # Retry operation
    │   │   └── __tests__/
    │   └── queries/
    │       ├── getTasksByStatus.ts
    │       ├── getTasksByTaskName.ts
    │       ├── getTasksByUserId.ts
    │       ├── listTasks.ts
    │       ├── getQueueStats.ts
    │       └── __tests__/
    ├── __tests__/
    │   └── TasksService.integration.test.ts
    ├── __mocks__/
    │   └── TasksService.mock.ts
    │
    ├── scheduler/                               # Task scheduling
    │   ├── TaskScheduler.ts                     # Factory: createTaskScheduler()
    │   ├── __tests__/
    │   └── __mocks__/
    │
    ├── worker/                                  # Task processing
    │   ├── TaskWorker.ts                        # Factory: createTaskWorker()
    │   ├── clients/
    │   │   ├── WorkerClientFactory.ts
    │   │   └── bullmq/
    │   │       ├── BullMQWorkerClient.ts
    │   │       └── __tests__/
    │   ├── __tests__/
    │   └── __mocks__/
    │
    ├── queue/                                   # Queue clients
    │   ├── TaskQueue.ts                         # Factory: createTaskQueue()
    │   ├── clients/
    │   │   ├── QueueClientFactory.ts
    │   │   └── bullmq/
    │   │       ├── BullMQQueueClient.ts
    │   │       └── __tests__/
        │   ├── __tests__/
        │   │   └── TasksService.integration.test.ts
        │   └── __mocks__/
        │       └── TasksService.mock.ts
        │
        ├── scheduler/                           # Task scheduling
        │   ├── TaskScheduler.ts                 # Factory: createTaskScheduler()
        │   ├── __tests__/
        │   └── __mocks__/
        │
        ├── worker/                              # Task processing
        │   ├── TaskWorker.ts                    # Factory: createTaskWorker()
        │   ├── clients/
        │   │   ├── WorkerClientFactory.ts
        │   │   └── bullmq/
        │   │       ├── BullMQWorkerClient.ts
        │   │       └── __tests__/
        │   ├── __tests__/
        │   └── __mocks__/
        │
        ├── queue/                               # Queue clients
        │   ├── TaskQueue.ts                     # Factory: createTaskQueue()
        │   ├── clients/
        │   │   ├── QueueClientFactory.ts
        │   │   └── bullmq/
        │   │       ├── BullMQQueueClient.ts
        │   │       └── __tests__/
        │   ├── __tests__/
        │   └── __mocks__/
        │
        ├── domain/                              # Domain entities and interfaces
        │   ├── TaskDefinition.ts                # defineTask() helper
        │   ├── TaskRecord.ts                    # PostgreSQL audit record (Zod)
        │   ├── TaskId.ts                        # Branded ID type
        │   ├── TaskStatus.ts                    # Status enum
        │   ├── TaskPriority.ts                  # Priority enum
        │   ├── TaskResult.ts                    # Success result
        │   ├── TaskError.ts                     # Error result (domain)
        │   ├── TaskContext.ts                   # Task handler context
        │   ├── TaskQueue.ts                     # Queue interface
        │   ├── QueueClient.ts                   # Queue client interface
        │   ├── WorkerClient.ts                  # Worker client interface
        │   ├── TasksRepo.ts                     # ITasksRepo interface
        │   ├── TasksService.ts                  # ITasksService interface
        │   ├── QueueStats.ts                    # Queue statistics
        │   └── validation/
        │       ├── validTaskRecord.ts
        │       └── validTaskStats.ts
        │
        ├── repos/                               # Data access layer
        │   ├── TasksRepo.ts                     # Extends SharedRepo
        │   ├── __tests__/
        │   │   └── TasksRepo.integration.test.ts
        │   └── __mocks__/
        │
        ├── errors/                              # Task-specific errors
        │   ├── TaskError.ts                     # Error factories
        │   └── __tests__/
        │
        └── handlers/                            # Admin-only HTTP handlers
            └── http/
                ├── TasksHttpHandler.ts          # Admin API
                ├── routes/                      # Route handlers
                │   ├── cancelTask.ts
                │   ├── retryTask.ts
                │   ├── getTaskById.ts
                │   ├── listTasks.ts
                │   ├── getQueueStats.ts
                │   └── validation/
                ├── __tests__/
                │   └── TasksHttpHandler.integration.test.ts
                └── __mocks__/
```

### Key Points

1. **Unified service** - TasksService handles both queries and operations
2. **TasksHttpHandler is admin-only** - Lives in `src/lib/tasks/handlers/http/`
3. **Action pattern** - Service delegates to action functions in `services/actions/`
4. **Factory functions** - createTaskScheduler(), createTaskWorker(), createTaskQueue()
5. **Task definitions** - Use defineTask() to create typed task definitions

---

## Domain Objects

### TaskRecord Entity (PostgreSQL Audit)

**Location:** `src/lib/tasks/domain/TaskRecord.ts`

```typescript
import { newId } from '@/lib/domain/Id';
import { createItemSchema } from '@/lib/domain/Item';
import zod from 'zod';

// Branded ID type
export type TaskId = zod.infer<typeof taskIdSchema>;
export const TaskId = newId<TaskId>;

// Task status enum
export const taskStatusSchema = zod.enum([
  'pending', // Queued, waiting to start
  'active', // Currently processing
  'completed', // Successfully finished
  'failed', // Permanently failed (all retries exhausted)
  'delayed', // Scheduled for future execution
]);
export type TaskStatus = zod.infer<typeof taskStatusSchema>;

// Task priority enum
export const taskPrioritySchema = zod.enum([
  'low',
  'normal',
  'high',
  'critical',
]);
export type TaskPriority = zod.infer<typeof taskPrioritySchema>;

// Result for successful tasks
const taskResultSchema = zod.strictObject({
  success: zod.literal(true),
  output: zod.unknown().optional(),
  duration: zod.number().describe('Processing time in milliseconds'),
});

// Error for failed tasks
const taskErrorSchema = zod.strictObject({
  success: zod.literal(false),
  reason: zod.string().describe('Error message'),
  stackTrace: zod.string().optional(),
  lastAttemptAt: zod.coerce.date(),
});

// Base schema extending Item
const baseTaskRecordSchema = createItemSchema(taskIdSchema).extend({
  taskName: zod.string(),
  queueName: zod.string(),
  payload: zod.record(zod.unknown()),
  status: taskStatusSchema,
  priority: taskPrioritySchema,

  // Execution tracking
  attempts: zod.number().int().min(0),
  maxAttempts: zod.number().int().min(1),

  // Timestamps
  enqueuedAt: zod.coerce.date(),
  startedAt: zod.coerce.date().optional(),
  completedAt: zod.coerce.date().optional(),
  failedAt: zod.coerce.date().optional(),

  // Results/Errors
  result: taskResultSchema.optional(),
  error: taskErrorSchema.optional(),

  // Context
  userId: zod.string().optional(),
  externalId: zod.string().optional(),
  delayUntil: zod.coerce.date().optional(),
});

// Versioned schema
const taskRecordV1Schema = baseTaskRecordSchema.extend({
  schemaVersion: zod.literal(1),
});

export const taskRecordSchema = zod.discriminatedUnion('schemaVersion', [
  taskRecordV1Schema,
]);

export type TaskRecord = zod.infer<typeof taskRecordSchema>;

// Factory function
export function newTaskRecord(
  taskName: string,
  queueName: string,
  overrides?: Partial<
    Omit<
      TaskRecord,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'schemaVersion'
      | 'taskName'
      | 'queueName'
    >
  >,
): TaskRecord {
  return {
    id: TaskId(),
    taskName,
    queueName,
    payload: {},
    status: 'pending',
    priority: 'normal',
    attempts: 0,
    maxAttempts: 3,
    enqueuedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    schemaVersion: 1,
    ...overrides,
  };
}
```

### Service Interface

```typescript
// src/lib/tasks/domain/TasksService.ts
export interface ITasksService extends ISharedService<TaskId, TaskRecord> {
  // Query methods
  getByStatus(
    status: TaskStatus,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;
  getByTaskName(
    taskName: string,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;
  getByUserId(userId: UserId): Promise<Result<TaskRecord[], ErrorWithMetadata>>;
  listTasks(
    filters?: ListTasksFilters,
  ): Promise<Result<TaskRecord[], ErrorWithMetadata>>;

  // Operation methods
  cancelTask(
    correlationId: CorrelationId,
    taskId: TaskId,
  ): Promise<Result<TaskRecord, ErrorWithMetadata>>;
  retryTask(
    correlationId: CorrelationId,
    taskId: TaskId,
  ): Promise<Result<TaskRecord, ErrorWithMetadata>>;
  getQueueStats(
    correlationId: CorrelationId,
    queueName: string,
  ): Promise<Result<QueueStats, ErrorWithMetadata>>;
}

// src/lib/tasks/domain/TasksRepo.ts
export interface ListTasksFilters {
  status?: TaskStatus;
  taskName?: string;
  userId?: UserId;
  limit?: number;
  offset?: number;
}
```

---

## Database Schema

### Drizzle Schema

**Location:** `src/db/schema.ts`

```typescript
import { json, pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tasks = pgTable(
  'tasks',
  {
    id: text('id').primaryKey(), // TaskId
    userId: text('user_id') // Optional - for user-scoped tasks
      .references(() => users.id),
    data: json('data').notNull().default({}), // TaskRecord (JSONB)
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    // Standard indexes
    userIdIdx: index('tasks_user_id_idx').on(table.userId),
    createdAtIdx: index('tasks_created_at_idx').on(table.createdAt.desc()),

    // JSONB field indexes for common queries
    statusIdx: index('tasks_status_idx').on(sql`((data->>'status'))`),
    taskNameIdx: index('tasks_task_name_idx').on(sql`((data->>'taskName'))`),
  }),
);
```

---

## Architecture Patterns

### 1. TasksService (Unified Service)

**Location:** `src/lib/tasks/services/TasksService.ts`

```typescript
class TasksService
  extends SharedService<TaskId, TaskRecord>
  implements ITasksService
{
  constructor(
    private readonly context: TasksServiceContext,
    private readonly actions = {
      getTasksByStatus,
      getTasksByTaskName,
      getTasksByUserId,
      listTasks,
      getQueueStats,
      cancelTask,
      retryTask,
    },
  ) {
    const appConfig = context.appConfig;
    super('tasks', {
      ...context,
      repo: () => createTasksRepo({ appConfig }),
      newId: TaskId,
    });
  }

  // Query methods - delegate to action functions
  async getByStatus(status: TaskStatus) {
    return this.actions.getTasksByStatus(
      { tasksRepo: this.tasksRepo },
      { status },
    );
  }

  async getByUserId(userId: UserId) {
    return this.actions.getTasksByUserId(
      { tasksRepo: this.tasksRepo },
      { userId },
    );
  }

  async listTasks(filters?: ListTasksFilters) {
    return this.actions.listTasks({ tasksRepo: this.tasksRepo }, { filters });
  }

  // Operation methods - delegate to action functions
  async cancelTask(correlationId: CorrelationId, taskId: TaskId) {
    return this.actions.cancelTask(
      {
        tasksRepo: this.tasksRepo,
        taskQueue: this.taskQueue,
        logger: this.context.logger,
      },
      { correlationId, taskId },
    );
  }

  async retryTask(correlationId: CorrelationId, taskId: TaskId) {
    return this.actions.retryTask(
      {
        tasksRepo: this.tasksRepo,
        taskQueue: this.taskQueue,
        logger: this.context.logger,
      },
      { correlationId, taskId },
    );
  }
}
```

### 2. TaskScheduler (Factory Function)

**Location:** `src/lib/tasks/scheduler/TaskScheduler.ts`

```typescript
// Factory function - returns ITaskScheduler interface
export function createTaskScheduler(
  config: TaskSchedulerConfig,
): ITaskScheduler {
  return new TaskScheduler(config);
}

class TaskScheduler implements ITaskScheduler {
  async schedule<TPayload>(
    correlationId: CorrelationId,
    task: TaskDefinition<TPayload>,
    payload: TPayload,
    options?: ScheduleOptions,
  ): Promise<Result<TaskRecord, ErrorWithMetadata>> {
    // 1. Validate payload
    const validationResult = task.validator(payload);
    if (validationResult.isErr()) return err(validationError);

    // 2. Create task record
    const taskRecord = newTaskRecord(task.queueName, task.queueName, {
      payload,
      status: isDelayed ? 'delayed' : 'pending',
      priority: task.options.priority,
      userId: options?.userId,
      delayUntil: isDelayed ? new Date(Date.now() + delayMs) : undefined,
    });

    // 3. Save to database
    const createResult = await this.tasksRepo.create(taskRecord.id, taskRecord);
    if (createResult.isErr()) return err(createResult.error);

    // 4. Enqueue to BullMQ
    const queue = this.getQueue(task.queueName);
    const enqueueResult = await queue.enqueue(
      correlationId,
      createResult.value,
    );
    if (enqueueResult.isErr()) return err(enqueueResult.error);

    return ok(createResult.value);
  }
}
```

### 3. TaskWorker (Factory Function)

**Location:** `src/lib/tasks/worker/TaskWorker.ts`

```typescript
// Factory function - returns TaskWorker instance
export function createTaskWorker(config: TaskWorkerConfig): TaskWorker {
  return new TaskWorker(config);
}

class TaskWorker {
  async start(): Promise<Result<void, ErrorWithMetadata>> {
    // Set up BullMQ worker with event handlers
    this.setupEventHandlers();
    await this.workerClient.start();
    return ok(undefined);
  }

  private setupEventHandlers() {
    // Update database on task state changes
    this.workerClient.on('active', async (job) => {
      await this.tasksRepo.update(job.taskId, {
        status: 'active',
        startedAt: new Date(),
      });
    });

    this.workerClient.on('completed', async (job, result) => {
      await this.tasksRepo.update(job.taskId, {
        status: 'completed',
        completedAt: new Date(),
        result: {
          success: true,
          output: result.output,
          duration: result.duration,
        },
      });
    });

    this.workerClient.on('failed', async (job, error, isFinalAttempt) => {
      await this.tasksRepo.update(job.taskId, {
        status: isFinalAttempt ? 'failed' : 'active',
        attempts: job.attempts,
        ...(isFinalAttempt && { failedAt: new Date(), error }),
      });
    });
  }
}
```

### 4. TasksHttpHandler (Admin API)

**Location:** `src/lib/tasks/handlers/http/TasksHttpHandler.ts`

```typescript
class TasksHttpHandler extends SharedHTTPHandler<TaskId, TaskRecord> {
  constructor(
    private readonly ctx: {
      logger: ILogger;
      appConfig: IAppConfigurationService;
      tasksService: () => ITasksService;
    },
  ) {
    /* ... */
  }

  routes() {
    return [
      // Standard CRUD
      ...super.routes({
        type: 'api',
        readPermissions: ['admin', 'read:tasks'],
        writePermissions: ['admin'],
      }),

      // Query routes
      this.getByStatus(), // GET /api/tasks/status/:status
      this.listTasks(), // GET /api/tasks (with filters)
      this.getQueueStats(), // GET /api/tasks/queue/:queueName/stats

      // Operation routes
      this.retryTask(), // POST /api/tasks/:id/retry
      this.cancelTask(), // POST /api/tasks/:id/cancel
    ];
  }
}
```

## Usage Examples

### Defining a Task

```typescript
// Define a task with type-safe payload
import { defineTask } from '@/lib/tasks/domain/TaskDefinition';
import { validate } from '@/utils/validate';
import { z } from 'zod';

// 1. Define payload schema
const welcomeEmailPayloadSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  name: z.string(),
});

type WelcomeEmailPayload = z.infer<typeof welcomeEmailPayloadSchema>;

// 2. Create task definition
const sendWelcomeEmailTask = defineTask<WelcomeEmailPayload>({
  queueName: 'users:send-welcome-email',
  validator: (data) => validate(welcomeEmailPayloadSchema, data),
  handler: async (payload, ctx) => {
    ctx.logger.info('Sending welcome email', { email: payload.email });

    // Send email logic here...
    await sendEmail(payload.email, payload.name);

    return ok({
      success: true as const,
      duration: 150,
      output: { sent: true },
    });
  },
  options: {
    priority: 'high',
    maxAttempts: 3,
  },
});
```

### Scheduling Tasks (Web App)

```typescript
// In your service (e.g., UsersService)
import { createTaskScheduler } from '@/lib/tasks/scheduler/TaskScheduler';
import { CorrelationId } from '@/lib/domain/CorrelationId';
import { UserId } from '@/lib/domain/user/user';

class UsersService {
  async create(data: Partial<User>): Promise<Result<User, ErrorWithMetadata>> {
    const userResult = await super.create(data);
    if (userResult.isErr()) return err(userResult.error);

    const user = userResult.value;

    // Schedule welcome email task
    const scheduler = createTaskScheduler({ logger, appConfig });
    const taskResult = await scheduler.schedule(
      CorrelationId(),
      sendWelcomeEmailTask,
      {
        userId: user.id,
        email: user.email,
        name: user.name,
      },
      { userId: UserId(user.id) },
    );

    if (taskResult.isErr()) {
      this.logger.error('Failed to schedule welcome email', taskResult.error);
      // Don't fail user creation
    }

    return ok(user);
  }
}
```

### Processing Tasks (Worker App)

```typescript
// Create and start a worker
import { createTaskWorker } from '@/lib/tasks/worker/TaskWorker';

const worker = createTaskWorker({
  logger,
  appConfig,
  task: sendWelcomeEmailTask,
});

const startResult = await worker.start();
if (startResult.isErr()) {
  console.error('Failed to start worker', startResult.error);
  process.exit(1);
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  await worker.stop();
  process.exit(0);
});
```

### Managing Tasks (Admin)

```typescript
// Create TasksService
import { createTasksService } from '@backend/tasks';

const tasksService = createTasksService({ logger, appConfig: () => config });

// Get failed tasks
const failures = await tasksService.getByStatus('failed');

// Get tasks for a specific user
const userTasks = await tasksService.getByUserId(UserId('user-123'));

// List tasks with filters
const pendingTasks = await tasksService.listTasks({
  status: 'pending',
  taskName: 'users:send-welcome-email',
  limit: 50,
});

// Get queue statistics
const stats = await tasksService.getQueueStats(
  CorrelationId(),
  'users:send-welcome-email',
);
// Returns: { queueName, waiting, active, completed, failed, delayed }

// Retry a failed task
await tasksService.retryTask(CorrelationId(), taskId);

// Cancel a pending task
await tasksService.cancelTask(CorrelationId(), taskId);
```

---

## API Routes (Admin Only)

### Query Routes

```
GET    /api/tasks                      # List all tasks (with optional filters)
GET    /api/tasks/:id                  # Get specific task by ID
GET    /api/tasks/queue/:queueName/stats  # Get queue statistics
```

**Query Parameters for `/api/tasks`:**

- `status` - Filter by task status (pending, active, completed, failed, delayed, cancelled)
- `taskName` - Filter by task name
- `userId` - Filter by user ID
- `limit` - Maximum number of results (default: 100)
- `offset` - Pagination offset (default: 0)

### Operation Routes

```
POST   /api/tasks/:id/retry            # Retry a failed task
POST   /api/tasks/:id/cancel           # Cancel a pending or delayed task
```

**All routes require `admin` or `read:tasks`/`write:tasks` permissions.**

---

## Testing Strategy

### Unit Tests (✅ 233 tests passing)

**Service Layer:**

- `cancelTask.test.ts` - 11 tests for cancel operation
- `retryTask.test.ts` - 12 tests for retry operation

**Queue/Worker Clients:**

- `BullMQQueueClient.test.ts` - 18 tests for queue operations
- `BullMQWorkerClient.test.ts` - 16 tests for worker operations
- `QueueClientFactory.test.ts` - Factory tests
- `WorkerClientFactory.test.ts` - Factory tests

**Scheduler/Worker:**

- `TaskScheduler.test.ts` - Scheduling logic tests
- `TaskWorker.test.ts` - Worker lifecycle tests
- `TaskQueue.test.ts` - Queue facade tests

**Domain:**

- `TaskDefinition.test.ts` - Task definition tests

### Integration Tests (✅ All passing)

**Repository Layer:**

- `TasksRepo.integration.test.ts` - Database operations
  - CRUD operations
  - Query methods (getByStatus, getByTaskName, getByUserId, listTasks)
  - Bulk updates
  - Data integrity

**Service Layer:**

- `TasksService.integration.test.ts` - 24 tests
  - Query methods (getByStatus, getByTaskName, getByUserId, listTasks)
  - Queue statistics
  - Cancel/retry operations
  - Error handling

**HTTP Layer:**

- `TasksHttpHandler.integration.test.ts` - HTTP endpoint tests
  - Route handling
  - Permission checks
  - Request/response validation

**End-to-End:**

- `taskFlow.integration.test.ts` - Complete task lifecycle
  - Task definition → schedule → process → audit trail
  - Success and failure scenarios
  - Database updates on state changes

---

## Operational Considerations

### Monitoring

**Key Metrics:**

- Tasks by status (pending, active, completed, failed)
- Success rate by task type
- Average task duration
- Failure rate trends

**Dashboards:**

- Use TasksService.getStats() for real-time metrics
- Query audit trail for historical analysis

### Retention Policies

**Redis:** 7 days  
**PostgreSQL:**

- Completed tasks: 90 days
- Failed tasks: 1 year (longer for debugging)

---

**Document Version:** 5.0.0  
**Last Updated:** 2025-11-27
