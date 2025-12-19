import type { TaskId } from '@backend/tasks/domain/TaskId';
import { taskIdSchema } from '@backend/tasks/domain/TaskId';
import {
  type PartialTaskRecord,
  partialTaskRecordSchema,
  type TaskRecord,
  type TaskStatus,
  taskRecordSchema,
  taskStatusSchema,
  type UpdateTaskRecord,
  updateTaskRecordSchema,
} from '@backend/tasks/domain/TaskRecord';
import type { AppError } from '@core/errors';

import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validTaskRecord(input: unknown): Result<TaskRecord, AppError> {
  return validate(taskRecordSchema, input);
}

export function validTaskId(input: unknown): Result<TaskId, AppError> {
  return validate(taskIdSchema, input);
}

export function validTaskStatus(input: unknown): Result<TaskStatus, AppError> {
  return validate(taskStatusSchema, input);
}

export function validPartialTaskRecord(
  input: unknown,
): Result<PartialTaskRecord, AppError> {
  return validate(partialTaskRecordSchema, input);
}

export function validUpdateTaskRecord(
  input: unknown,
): Result<UpdateTaskRecord, AppError> {
  return validate(updateTaskRecordSchema, input);
}
