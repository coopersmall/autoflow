import {
  partialUserSchema,
  type User,
  type UserId,
  updateUserSchema,
  userIdSchema,
  userSchema,
} from '@core/domain/user/user.ts';
import type { ValidationError } from '@core/errors/ValidationError.ts';
import { validate } from '@core/validation/validate.ts';
import type { Result } from 'neverthrow';

export function validUser(input: unknown): Result<User, ValidationError> {
  return validate(userSchema, input);
}

export function validUserId(input: unknown): Result<UserId, ValidationError> {
  return validate(userIdSchema, input);
}

export function validPartialUser(
  input: unknown,
): Result<Omit<User, 'id' | 'createdAt' | 'updatedAt'>, ValidationError> {
  return validate(partialUserSchema, input);
}

export function validUpdateUser(
  input: unknown,
): Result<Partial<User>, ValidationError> {
  return validate(updateUserSchema, input);
}
