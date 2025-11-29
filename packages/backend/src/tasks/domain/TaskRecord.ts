import {
  type TaskError,
  taskErrorSchema,
} from '@backend/tasks/domain/TaskError';
import { TaskId, taskIdSchema } from '@backend/tasks/domain/TaskId';
import {
  type TaskPriority,
  taskPrioritySchema,
} from '@backend/tasks/domain/TaskPriority';
import {
  type TaskResult,
  taskResultSchema,
} from '@backend/tasks/domain/TaskResult';
import {
  type TaskStatus,
  taskStatusSchema,
} from '@backend/tasks/domain/TaskStatus';
import { createItemSchema } from '@core/domain/Item';
import zod from 'zod';

// Re-export types for convenience
export { taskIdSchema, taskPrioritySchema, taskStatusSchema };
export type { TaskError, TaskId, TaskPriority, TaskResult, TaskStatus };

// Base schema extending Item
const baseTaskRecordSchema = createItemSchema(taskIdSchema).extend({
  taskName: zod
    .string()
    .describe('Task type identifier (e.g., users:send-welcome-email)'),
  queueName: zod.string().describe('Name of the queue the task is assigned to'),
  payload: zod.record(zod.unknown()).describe('Task-specific data'),
  status: taskStatusSchema,
  priority: taskPrioritySchema.default('normal'),

  // Execution tracking
  attempts: zod
    .number()
    .int()
    .min(0)
    .default(0)
    .describe('Number of execution attempts'),
  maxAttempts: zod
    .number()
    .int()
    .min(1)
    .default(3)
    .describe('Maximum number of retry attempts'),

  // Timestamps
  enqueuedAt: zod.coerce.date().describe('When the task was first enqueued'),
  startedAt: zod.coerce
    .date()
    .nullish()
    .describe('When the task started processing'),
  completedAt: zod.coerce
    .date()
    .nullish()
    .describe('When the task completed successfully'),
  failedAt: zod.coerce
    .date()
    .nullish()
    .describe('When the task permanently failed'),

  // Results/Errors
  result: taskResultSchema
    .nullish()
    .describe('Result data for successful tasks'),
  error: taskErrorSchema.nullish().describe('Error data for failed tasks'),

  // Context
  userId: zod
    .string()
    .nullish()
    .describe('Optional user ID for user-scoped tasks'),

  // Queue provider integration
  externalId: zod.string().nullish().describe('Queue provider job/message ID'),
  delayUntil: zod.coerce
    .date()
    .nullish()
    .describe('Delay task execution until this timestamp'),
});

// Versioned schema (v1)
const taskRecordV1Schema = baseTaskRecordSchema.extend({
  schemaVersion: zod.literal(1),
});

export const taskRecordSchema = zod.discriminatedUnion('schemaVersion', [
  taskRecordV1Schema,
]);

export type TaskRecord = zod.infer<typeof taskRecordSchema>;

// Partial schema for creating tasks (omit system-managed fields)
const partialTaskRecordV1Schema = taskRecordV1Schema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const partialTaskRecordSchema = zod.discriminatedUnion('schemaVersion', [
  partialTaskRecordV1Schema,
]);

export type PartialTaskRecord = zod.infer<typeof partialTaskRecordSchema>;

// Update schema for partial updates
const updateTaskRecordV1Schema = taskRecordV1Schema
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .partial();

export const updateTaskRecordSchema = zod.discriminatedUnion('schemaVersion', [
  updateTaskRecordV1Schema,
]);

export type UpdateTaskRecord = zod.infer<typeof updateTaskRecordSchema>;

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
