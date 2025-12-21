import {
  partialUserSchema,
  type User,
  type UserId,
  updateUserSchema,
  userIdSchema,
  userSchema,
} from '@core/domain/user/user';
import type { AppError } from '@core/errors/AppError';
import { validate } from '@core/validation/validate';
import type { Result } from 'neverthrow';

export function validUser(input: unknown): Result<User, AppError> {
  return validate(userSchema, input);
}

export function validUserId(input: unknown): Result<UserId, AppError> {
  return validate(userIdSchema, input);
}

export function validPartialUser(
  input: unknown,
): Result<Omit<User, 'id' | 'createdAt' | 'updatedAt'>, AppError> {
  return validate(partialUserSchema, input);
}

export function validUpdateUser(
  input: unknown,
): Result<Partial<User>, AppError> {
  return validate(updateUserSchema, input);
}
