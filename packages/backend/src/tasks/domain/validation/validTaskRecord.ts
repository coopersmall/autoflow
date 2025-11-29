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
import type { ValidationError } from '@core/errors/ValidationError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validTaskRecord(
  input: unknown,
): Result<TaskRecord, ValidationError> {
  return validate(taskRecordSchema, input);
}

export function validTaskId(input: unknown): Result<TaskId, ValidationError> {
  return validate(taskIdSchema, input);
}

export function validTaskStatus(
  input: unknown,
): Result<TaskStatus, ValidationError> {
  return validate(taskStatusSchema, input);
}

export function validPartialTaskRecord(
  input: unknown,
): Result<PartialTaskRecord, ValidationError> {
  return validate(partialTaskRecordSchema, input);
}

export function validUpdateTaskRecord(
  input: unknown,
): Result<UpdateTaskRecord, ValidationError> {
  return validate(updateTaskRecordSchema, input);
}
