import type { TaskStatus } from '@backend/tasks/domain/TaskStatus';
import { validTaskStatus } from '@backend/tasks/domain/validation/validTaskRecord';
import type { UserId } from '@core/domain/user/user';
import { validUserId } from '@core/domain/user/validation/validUser';
import type { ValidationError } from '@core/errors/ValidationError';
import { optional, validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';
import zod from 'zod';

export function validOptionalTaskStatusParam(
  input: unknown,
): Result<TaskStatus | undefined, ValidationError> {
  return optional(validTaskStatus)(input);
}

export function validOptionalTaskNameParam(
  input: unknown,
): Result<string | undefined, ValidationError> {
  return optional(taskNameValidator)(input);
}

export function validOptionalUserIdParam(
  input: unknown,
): Result<UserId | undefined, ValidationError> {
  return optional(validUserId)(input);
}

export function validOptionalLimitParam(
  input: unknown,
): Result<number | undefined, ValidationError> {
  return optional(limitValidator)(input);
}

export function validOptionalOffsetParam(
  input: unknown,
): Result<number | undefined, ValidationError> {
  return optional(offsetValidator)(input);
}

// Limit: positive integer, min 1, max 100
const limitSchema = zod.coerce.number().int().min(1).max(100);
const limitValidator = (data: unknown) => validate(limitSchema, data);

// Offset: non-negative integer, min 0
const offsetSchema = zod.coerce.number().int().min(0);
const offsetValidator = (data: unknown) => validate(offsetSchema, data);

// String filter: non-empty string, max 100 chars
const taskNameSchema = zod.string().min(1).max(100);
const taskNameValidator = (data: unknown) => validate(taskNameSchema, data);
